# Redis 进阶操作

## 概述
本文讲解 Pipeline、事务、Lua 脚本、Pub/Sub 和 Stream 五个进阶操作机制的原理、
适用场景和局限。这些是 Redis 从"缓存工具"进化为"数据平台"的关键能力。

前置知识：Redis 基本数据结构、Spring Data Redis 基础操作。

---

## Pipeline — 批量操作的利器

### 问题背景：RTT 累积

Redis 是请求-响应模型。客户端发送一个命令，等待 Redis 执行并返回结果，再发下一个命令。
每对请求-响应之间有一个 RTT（Round Trip Time，往返时间）。

如果 RTT = 1ms，批量执行 1000 条命令需要 1000ms = 1 秒（不含执行时间）。
实际上 Redis 执行 1000 条简单命令只需要几毫秒，99.9% 的时间耗在网络等待上。

### Pipeline 原理

Pipeline 允许客户端：
1. 把多条命令打包到发送缓冲区
2. 一次性发送到 Redis
3. Redis 顺序执行所有命令
4. Redis 一次性返回所有结果
5. 客户端从缓冲区读出所有结果

这样 1000 条命令只需要 **1 次 RTT**，时间从 1000ms 降到约 2-3ms。

### 内部机制

```
client buffer  →  [CMD1][CMD2][CMD3] → 一次性发送
                                         ↓
                                    Redis 顺序执行
                                         ↓
client buffer ←  [RSP1][RSP2][RSP3] ← 一次性返回
```

关键点：
- 命令在 Redis 端不是并发执行的（单线程），是顺序执行
- 但不保证原子性——其他客户端的命令可能穿插在 Pipeline 的命令之间
- Redis 的内存中需要暂存所有响应，直到全部发送

### Pipeline vs 事务

| 维度 | Pipeline | 事务 (MULTI/EXEC) |
|------|----------|-------------------|
| 批量发送 | 支持 | 支持 |
| 原子性 | 不保证（中间可插入其他客户端命令） | 保证（EXEC 前所有命令排队，EXEC 时原子提交） |
| 执行方式 | 收到一条执行一条 | 先入队，EXEC 时批量执行 |
| WATCH CAS | 不支持 | 支持 |
| 使用场景 | 批量写入、批量读取 | 需要原子性的批量操作 |

### Spring 中使用 Pipeline

```java
List<Object> results = redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
    for (int i = 0; i < 1000; i++) {
        connection.stringCommands().set(
            ("key:" + i).getBytes(),
            ("value:" + i).getBytes()
        );
    }
    return null; // Pipeline 中返回 null
});
```

注意：executePipelined 的回调返回值必须是 null，实际结果在方法返回的 List 中。

---

## 事务 — 不完整但够用的原子性

### MULTI/EXEC 机制

Redis 事务的流程：

1. **MULTI**：标记事务开始
2. 后续命令全部**入队**（存入队列，不执行）
3. **EXEC**：取出所有命令，顺序执行，返回结果数组
4. 或 **DISCARD**：清空队列，放弃事务

```
Client: MULTI
Client: SET k1 v1          → QUEUED（入队）
Client: INCR counter       → QUEUED（入队）
Client: LPUSH list a b c   → QUEUED（入队）
Client: EXEC
Redis:  [OK, 1, 3]         ← 三个结果依次返回
```

### 事务的原子性边界

Redis 事务的"原子"含义：
- EXEC 执行期间，其他客户端的命令不会插入
- 但事务中的某个命令执行失败了，其他命令**仍然执行，不会回滚**

这就区分了两种错误：

**编译时错误（语法错误）**：
- 如 SET 缺少参数，入队时就能发现
- 此时 EXEC 返回错误，整个事务全部不执行

**运行时错误（逻辑错误）**：
- 如 INCR 用在 String 上，命令语法正确但类型不对
- 只有执行到这条命令时才知道错误
- 其他命令照常执行，不会回滚

这就是 Redis 事务与关系型数据库事务的最大区别——**不支持回滚**。

Redis 官方文档对此的解释是：Redis 的错误通常是编程错误，应该在开发阶段发现，
不需要为生产环境支持回滚（回滚会极大增加复杂度，不值得）。

### WATCH — 乐观锁 CAS 模式

WATCH 提供了 CAS（Compare And Swap）能力：

1. WATCH key：监视 key 的变化
2. MULTI + 入队操作
3. EXEC：如果 key 在 WATCH 后到 EXEC 前没有被其他客户端修改，则执行事务
4. 如果 key 被改了，EXEC 返回 nil，事务被放弃

典型应用：扣减库存

```java
// 伪代码
WATCH stock:product:1001
currentStock = GET stock:product:1001  // 假设 10
if currentStock >= 1:
    MULTI
    DECR stock:product:1001
    EXEC  // 如果库存被其他请求改了，这里返回 nil，需要重试
```

### Spring 事务 API

Spring 提供了 `@Transactional` 支持，但别被名字迷惑——它只是把操作组到同一个连接，
和关系型数据库的事务完全不同：

```java
redisTemplate.setEnableTransactionSupport(true);

// MULTI
List<Object> results = redisTemplate.execute(new SessionCallback<List<Object>>() {
    @Override
    public List<Object> execute(RedisOperations operations) {
        operations.multi(); // 开始事务
        operations.opsForValue().set("key1", "val1");
        operations.opsForValue().increment("counter");
        return operations.exec(); // 提交
    }
});
```

---

## Lua 脚本 — Redis 的服务端编程

### 为什么需要 Lua

Pipeline 只能减少 RTT，不能保证原子性。事务能保证原子性但不能做条件判断。
Lua 脚本同时拥有两者——原子性 + 程序逻辑。

### EVAL 执行流程

```
EVAL "return redis.call('GET', KEYS[1])" 1 mykey
     ↓
[Lua 脚本]
[KEYS: {"mykey"}]  [ARGV: {}]
     ↓
Lua 5.1 引擎 → 解释执行 → redis.call() 调用 Redis 命令
     ↓
返回结果
```

- EVAL 执行期间，整个 Redis 被脚本独占——其他所有命令都在等待
- 这是真正的原子性：脚本中所有操作作为一个整体执行

### EVALSHA — 脚本缓存

EVAL 每次都传输完整脚本，脚本很长时占用网络带宽。
EVALSHA 允许传输脚本的 SHA1 摘要（40 字节），Redis 从缓存中加载脚本执行：

```
SCRIPT LOAD "return redis.call('GET', KEYS[1])"
→ "a1b2c3d4..." (SHA1)

EVALSHA a1b2c3d4... 1 mykey
→ 从脚本缓存中加载执行
```

脚本缓存在 Redis 重启后丢失，所以使用 EVALSHA 时要处理 NOSCRIPT 错误（回退到 EVAL）。

### 脚本规范和 lua-time-limit

- Lua 脚本中不能有随机操作（如 TIME、RANDOMKEY），因为它们破坏主从复制的确定性
- Redis 提供 redis.log() 写日志、redis.error_reply() 返回错误
- lua-time-limit 默认 5 秒：脚本运行超过 5 秒，Redis 接受 SCRIPT KILL 命令终止它
- 但如果脚本已经执行了写操作，只能 SHUTDOWN NOSAVE（防止数据不一致）

### Spring RedisScript

```java
DefaultRedisScript<Long> script = new DefaultRedisScript<>();
script.setScriptText("return redis.call('INCR', KEYS[1])");
script.setResultType(Long.class);

Long result = redisTemplate.execute(script, List.of("counter:my"));
```

---

## Pub/Sub — 发布订阅

### 订阅模型

Redis Pub/Sub 的核心数据结构：

- **pubsub_channels（字典）**：频道名 → 订阅该频道的客户端链表
- **pubsub_patterns（链表）**：模式订阅列表（如 `news:*`）

发布流程：
1. PUBLISH channel message
2. 查 pubsub_channels，找到所有订阅该频道的客户端
3. 遍历 pubsub_patterns，匹配模式，找到订阅匹配模式的客户端
4. 向每个客户端推送消息

### 消息语义

Pub/Sub 是**即发即忘（fire-and-forget）**模型：
- 没有消息队列：消息不会被存储
- 订阅者不在线时，消息直接丢弃
- 没有 ACK 机制：发出去了不管是否到达

这意味着 Pub/Sub 适合通知类场景（聊天、实时推送、配置变更通知），
绝对不适合处理需要可靠投递的业务消息（订单、支付）。

### 消息丢失的三大场景

1. **订阅者离线**：PUBLISH 时订阅者不在线，消息丢弃
2. **客户端缓冲区满**：订阅者积压的消息超过 output-buffer-limit，连接被强制断开
3. **网络中断**：TCP 断连期间的消息全部丢失

### 与可靠消息队列的对比

Redis Pub/Sub 像是一个广播喇叭，Redis Stream 像是一个信箱。
选型很简单：**消息不能丢 → 别用 Pub/Sub**。

---

## Stream — Redis 的可靠消息队列

### 消费组模型

```
Stream: orders
├── 1687332000000-0: {orderId:1001}
├── 1687332000001-0: {orderId:1002}
├── 1687332000002-0: {orderId:1003}
└── ...

消费组: order-processors
├── consumer-1 (正在处理 1687332000000-0)
├── consumer-2 (正在处理 1687332000001-0)
└── consumer-3 (空闲)

PEL (Pending Entries List 待确认列表):
├── 1687332000000-0: consumer-1, 已投递 30s
└── 1687332000001-0: consumer-2, 已投递 5s
```

### 消息确认与重投

正常流程：
1. XREADGROUP 读取新消息
2. 处理业务逻辑
3. XACK 确认完成

异常处理：
- 消费者崩溃（未 XACK）：消息留在 PEL 中
- XAUTOCLAIM：将长时间未 ACK 的消息转移给其他消费者
- XCLAIM：手动转移指定消息的所有权

```bash
# 查看 PEL 中的消息
XPENDING orders order-processors

# 将 consumer-1 超过 60 秒未 ACK 的消息转移给 consumer-2
XAUTOCLAIM orders order-processors consumer-2 60000 0-0
```

### 消息持久化与裁剪

Stream 的消息存储在内存中（可通过 RDB/AOF 持久化），
如果不主动删除，会无限增长。控制方式是最大长度：

```bash
XADD orders MAXLEN ~ 10000 * field1 value1
```

- MAXLEN ~ 10000 中的 `~` 表示近似裁剪，性能好但有少量误差
- 不加 `~` 则是精确裁剪，但性能差

### 常见坑

- Stream 不支持分区，单机吞吐量上限是 Redis 单线程的极限
- PEL 膨胀是最常见的线上问题：消费者逻辑有 bug 导致不 ACK
- XREADGROUP 阻塞等待时，Redis 连接在这段时间内不能用于其他操作

---

## 总结

1. **Pipeline 解决 RTT 问题**，事务解决原子性问题，Lua 同时解决两者
2. **Redis 事务不支持回滚**，别把它当关系型数据库事务用
3. **Pub/Sub 消息会丢失**，有可靠性要求的场景用 Stream
4. **Lua 脚本执行期间 Redis 是阻塞的**，脚本要短要快（< 1ms 最好，< 5s 必须）
5. **Stream 填补了 Redis 在可靠消息队列上的空白**，但和 Kafka 定位不同
