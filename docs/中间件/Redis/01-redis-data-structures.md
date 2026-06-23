# Redis 数据结构深入

## 概述
本文深入讲解 Redis 七大核心数据结构的底层实现原理、编码转换机制和使用场景，
帮助你理解"为什么选择这种数据结构"而不仅仅是"怎么用"。

前置知识：基本 Redis 命令（GET/SET/HSET 等）。

---

## String — 不仅仅是字符串

### 底层原理：SDS（Simple Dynamic String）

Redis 没有使用 C 语言的 char* 字符串，而是自己实现了 SDS：

- **len 字段**：O(1) 获取字符串长度（C 字符串需要 O(N) 遍历）
- **free 字段**：记录预分配空间，减少内存重分配次数
- **二进制安全**：不依赖 \0 判断结尾，可以存储任意二进制数据（图片、序列化对象）
- **空间预分配**：长度 < 1MB 时分配 2×len+1，>= 1MB 时分配 len+1MB+1
- **惰性空间释放**：缩短字符串时不立即释放内存，通过 free 记录可用空间

### 三种编码方式

String 在 Redis 内部有三种编码，根据值的类型和长度自动切换：

| 编码 | 条件 | 存储结构 |
|------|------|----------|
| int | 值是整数且在 long 范围内 | 直接存整数，无额外内存开销 |
| embstr | 值 <= 44 字节（Redis 3.2+）| 一次内存分配，robj + sds 连续存储，只读不可修改 |
| raw | 值 > 44 字节 | 两次内存分配，robj 和 sds 分离存储 |

**embstr vs raw 的设计意图**：embstr 将 redisObject 和 SDS 放在连续内存中，
一次 malloc/free 搞定，CPU 缓存友好。但只要对 embstr 做任何修改（如 APPEND），
就会转为 raw 编码——因为 embstr 的内存块没有预留 free 空间。

### 原子操作

Redis 是单线程处理命令的，所以 INCR/DECR 天然原子，无需加锁：

- INCR/DECR：原子增减，返回操作后的值
- INCRBYFLOAT：浮点数原子增减
- GETSET：原子设置新值并返回旧值
- SETNX：不存在才设置，返回 1（成功）或 0（失败）

### 使用场景

- **缓存**：最基本的用法，将数据库查询结果以 JSON 字符串存储，设置 TTL
- **计数器**：利用 INCR 原子性实现文章阅读量、点赞数、库存扣减
- **分布式 ID 生成器**：INCR 一个 key 产生全局递增 ID
- **分布式锁**：SET key value NX EX seconds（详细见生产实践篇）

### 常见坑

- 大 Key：单个 String 超过 10KB 开始影响性能，超过 1MB 是严重问题，
  会导致 Redis 主线程阻塞（DEL 大对象时释放内存耗时）
- embstr 修改陷阱：看似读取再写入，实际触发了 embstr→raw 转换
- SETNX 原子性：Redis 2.6.12 前 SETNX 不支持同时设过期时间，
  需要 SETNX + EXPIRE 两步，但这两步不原子，可能死锁

### 示例代码

```java
// 写入 String 并设 TTL
redisTemplate.opsForValue().set("user:1001", userJson, 600, TimeUnit.SECONDS);

// 原子递增计数器
Long newCount = redisTemplate.opsForValue().increment("article:views:42");
```

---

## Hash — 对象存储的最佳选择

### 底层原理

Hash 有两种底层编码：

**ziplist（压缩列表）**：
- 连续内存块，所有 field-value 紧密排列
- 通过偏移量定位元素，不需要指针
- 内存效率极高，但查找是 O(N)
- 编码转换条件（同时满足才用 ziplist）：
  - 所有 field 和 value 的字节数都 <= hash-max-ziplist-value（默认 64）
  - 总 field 数 <= hash-max-ziplist-entries（默认 512）

**hashtable（哈希表）**：
- 标准 dict 结构，含两个 hash 表（ht[0] 和 ht[1]）
- 支持 O(1) 查找
- 使用 MurmurHash2 哈希算法

### 渐进式 Rehash

Redis 的 rehash 不是一次性完成的，而是分摊到每次操作中：

1. 给 ht[1] 分配 ht[0].used*2 的空间
2. 设置 rehashidx = 0，标记 rehash 开始
3. 每次对 Hash 的增删改查操作，顺手把 ht[0] 的 rehashidx 桶迁移到 ht[1]
4. rehashidx 递增，直到全部迁移完成，释放 ht[0]

这样即使上百万个 key，rehash 也不会阻塞主线程。但 rehash 期间，
每次操作需要查两个表，有明显的性能下降。

### Hash vs String 存储对象

以用户信息 `{name:"张三", age:25, email:"zhang@example.com"}` 为例：

| 维度 | String（整体存 JSON） | Hash（每字段一个 field） |
|------|----------------------|------------------------|
| 读取单字段 | 取出整个 JSON 反序列化 | HGET 直接拿到单值 |
| 更新单字段 | 读→改→写整个 JSON | HSET 直接设单值 |
| 内存占用 | 更少（一个 key） | 更多（ziplist 约多 30%，hashtable 多几倍） |
| 过期 | 整个 key 统一过期 | 无法字段级 TTL |

**选择准则**：频繁更新单字段或有大量字段（几十个）且分别读取 → Hash；
字段少、整体读写、需要过期 → String。

### 使用场景

- **对象缓存**：用户信息、商品详情
- **购物车**：用户 ID 为 key，商品 ID 为 field，数量为 value
- **实时统计**：HINCRBY 原子增减

### 常见坑

- ziplist 转 hashtable 的瞬间：如果某个 field value 突然超过 64 字节，触发编码转换，这一瞬间有阻塞风险
- Hash 不支持嵌套：无法存储 "field 的值是另一个 Hash"
- field 过多导致 hgetall 慢：用 HSCAN 替代

### 示例代码

```java
// 存储用户信息
redisTemplate.opsForHash().put("user:1001", "name", "张三");
redisTemplate.opsForHash().put("user:1001", "age", "25");

// 读取单个字段
String name = (String) redisTemplate.opsForHash().get("user:1001", "name");
```

---

## List — 不只是队列

### 底层原理：Quicklist

Redis 3.2 前 List 在元素少时用 ziplist，元素多时用 linkedlist。
这有两个问题：linkedlist 节点碎片多且指针开销大（每个节点存 prev/next 两个指针）。

Redis 3.2 引入了 **quicklist**：

- quicklist 是一个 linkedlist，每个节点指向一个 ziplist
- list-max-ziplist-size：控制每个 ziplist 最多存多少元素（默认 -2，即 8KB）
- list-compress-depth：控制两端不压缩、中间节点压缩（LZF 算法）
- 两端操作（LPUSH/LPOP/RPUSH/RPOP）直接在头尾 ziplist 中完成
- 中间操作需要找到对应 ziplist，在其内部操作

这种设计综合了 linkedlist 的灵活增删和 ziplist 的内存效率。

### 阻塞弹出

BLPOP/BRPOP 是 List 的独特能力——如果列表为空不是立即返回 nil，而是阻塞等待：

1. 客户端发出 BLPOP key timeout
2. 如果列表有元素，立即弹出返回
3. 如果列表为空，客户端进入阻塞状态（timeout 秒内）
4. 元素到达时，第一个阻塞的客户端收到并返回

阻塞队列的实现原理：
- 每个阻塞 key 维护一个等待客户端链表
- 新数据写入时，检查是否有客户端在等待
- 超时由 serverCron 定时任务处理

### 使用场景

- **消息队列**：LPUSH + RPOP/BLPOP（简单场景，无 ACK 机制）
- **最新列表**：LPUSH + LTRIM 保持最近 N 条（朋友圈时间线、最新评论）
- **栈**：LPUSH + LPOP

### 常见坑

- 元素数量极大时慎用 LRANGE 0 -1（获取全部），可能阻塞
- BLPOP 等待期间，客户端和 Redis 之间的连接必须保持
- BLPOP 的 key 不存在时也会阻塞（与 key 有值但 list 为空效果相同）

### 示例代码

```java
// 左边推入，右边弹出 → 队列
redisTemplate.opsForList().leftPush("task:queue", taskJson);
String task = (String) redisTemplate.opsForList().rightPop("task:queue");

// 保持列表最多 100 条
redisTemplate.opsForList().leftPush("recent:posts", postId);
redisTemplate.opsForList().trim("recent:posts", 0, 99);
```

---

## Set — 集合运算的力量

### 底层原理

Set 有两种编码：

**intset（整数集合）**：
- 紧凑整数数组，保持有序
- 支持 int16/int32/int64 三种内部编码，根据最大元素自动升级
- 查找使用二分查找 O(log N)
- 每次插入可能需要升级编码并重新分配内存
- 编码转换条件：全部是整数 AND 元素数 <= set-max-intset-entries（默认 512）

**hashtable（哈希表）**：
- 和 Hash 的 hashtable 相同结构，只是 value 固定为 NULL
- O(1) 查找

### 集合运算的实现

交集（SINTER）：
- 遍历最小的集合，对每个元素检查在其他集合是否都存在
- 优先选择最小的集合来遍历，减少比较次数

并集（SUNION）：
- 遍历所有集合，用 hashtable 去重

差集（SDIFF）：
- 遍历第一个集合，对每个元素检查是否在后续集合都不存在

### 使用场景

- **标签系统**：用户标签、文章标签
- **共同好友**：SINTER user:friends:1 user:friends:2
- **可能认识的人**：SDIFF + SUNION 组合
- **抽奖**：SRANDMEMBER（不删除，可重复中奖）、SPOP（删除，不重复）
- **唯一计数**：SCARD 返回集合大小

### 常见坑

- intset 升级不可逆：int16 一旦升级到 int32，以后即使所有元素是 int16 可表达的也不会降级
- SINTER 计算成本：大集合之间做交集很慢
- SMEMBERS 在大集合中很危险：一次性返回全部元素，阻塞 + 网络开销大，用 SSCAN 替代

### 示例代码

```java
// 添加标签
redisTemplate.opsForSet().add("article:tags:100", "Java", "Redis", "Spring");

// 共同标签
Set<Object> common = redisTemplate.opsForSet()
    .intersect("article:tags:100", "article:tags:200");
```

---

## ZSet — 有序集合与跳表

### 底层原理：Skiplist + Dict

ZSet 同时使用两种数据结构：

- **skiplist（跳表）**：按 score 排序，支持范围查询和按排名查询
- **dict（字典）**：member → score 映射，支持 O(1) 单点查询

两个数据结构指向同一个 member 对象（共享内存），不重复存储。

### 跳表原理

Redis 跳表的关键特性：

- 每个节点有 1~32 层（随机生成，每层概率 1/4）
- 第 0 层是完整链表，上层是"高速通道"
- 查找复杂度 O(log N)，最坏 O(N)（所有节点都是 1 层）
- 插入/删除也是 O(log N)
- span 跨度字段：记录同层两节点之间跳过了多少第 0 层节点，用于快速计算排名

**为什么用跳表而不是平衡树（如红黑树）？**
- 跳表实现简单（不到 200 行代码）
- 跳表支持范围查询（平衡树也一样，不是差异点）
- 跳表天然适合区间查找和按排名查询
- ZRANK/ZREVRANK 命令利用 span 实现 O(log N) 排名

### Score 相同的情况

score 相同时，按 member 的字典序排序。所以 `(score=1, "a")` 排在 `(score=1, "b")` 前面。

### 使用场景

- **排行榜**：ZADD + ZREVRANGE 获取 Top N，ZREVRANK 查询用户排名
- **延迟队列**：score=执行时间戳，ZRANGEBYSCORE 0 now 拉取到期任务
- **带权重的标签**：ZADD tags:article:100 0.8 "Java" 0.5 "Redis"
- **滑动窗口限流器**：member=请求唯一标识+时间，score=时间戳，ZREMRANGEBYSCORE 清理窗口外数据

### 常见坑

- ZSet 的 member 在 skiplist 和 dict 中各存一份指针，内存占用比 Set 大约一倍
- ZRANGE with large offset 很慢：ZRANGE key 100000 100010 需要遍历前 10 万个节点
- ZREMRANGEBYRANK/ZREMRANGEBYSCORE 操作大范围时阻塞风险

### 示例代码

```java
// 写入排行榜分数
redisTemplate.opsForZSet().add("game:leaderboard", "player:1001", 9800);
redisTemplate.opsForZSet().add("game:leaderboard", "player:1002", 10200);

// 获取 Top 10
Set<Object> top10 = redisTemplate.opsForZSet()
    .reverseRange("game:leaderboard", 0, 9);

// 查询用户排名
Long rank = redisTemplate.opsForZSet()
    .reverseRank("game:leaderboard", "player:1001");
```

---

## BitMap — 位操作与统计

### 底层原理

BitMap 不是一种独立的数据类型，它的底层是 String。
String 是字节数组，每个字节有 8 个 bit，Redis 提供了一组位操作命令直接操作这些 bit。

- SETBIT key offset 1：将第 offset 位设为 1
- offset 的范围理论上无限制，Redis 会自动扩展 String 的长度
- 存储效率：1 亿个用户的签到记录只需 12.5MB（1亿/8/1024/1024）

### 使用场景

- **用户签到**：SETBIT checkin:2026-06 1001 1（用户 1001 在 6 月第 20 天签到）
- **活跃用户统计**：BITCOUNT checkin:2026-06（统计签到总人数）
- **用户在线状态**：BITFIELD 可一次操作多个连续位
- **布隆过滤器的位数组**：用 BITFIELD 批量操作

### 常见坑

- offset 过大导致瞬间分配大内存：SETBIT key 99999999 1 会创建 12.5MB 的字符串
- BITCOUNT 是全量计数，不支持范围，需要用 BITFIELD + 偏移量计算

### 示例代码

```java
// 用户签到（第 1001 号用户在第 19 天签到）
redisTemplate.opsForValue().setBit("checkin:202606", 1001, true);

// 统计签到用户数
Long bitCount = redisTemplate.execute(
    (RedisCallback<Long>) connection ->
        connection.bitCount("checkin:202606".getBytes())
);
```

---

## HyperLogLog — 基数统计的奇迹

### 底层原理

HLL 基于伯努利试验的数学原理：进行 N 次抛硬币，记录连续正面最长的次数 K，
则通过 2^K 可以估算 N 的大小。

Redis 的实际实现：
- 使用 16384 个 6-bit 寄存器（共 12KB），每个寄存器记录看到的最大前导零位数
- 插入时对元素做 64-bit hash，前 14 位决定落在哪个寄存器，后 50 位统计前导零
- 查询时对 16384 个寄存器做**调和平均**（减少极端值的影响），再乘以修正因子

### 误差分析

- 标准误差 0.81%（无论数据集大小）
- 12KB 可统计 2^64 个不同元素

### 使用场景

- **UV 统计**：PFADD page:uv:20260620 userId，PFCOUNT page:uv:20260620
- **合并统计**：PFMERGE 合并多天 UV

### 常见坑

- 不能获取具体元素列表（不像 Set 有 SMEMBERS）
- 小数据量（<1000）时误差可能比预想的大
- PFCOUNT 复杂度 O(N)，N=寄存器数量=16384，常数时间

### 示例代码

```java
// 统计页面 UV
HyperLogLogOperations<String, String> hllOps = redisTemplate.opsForHyperLogLog();
hllOps.add("page:uv:homepage", "user:1001", "user:1002", "user:1003");
Long uv = hllOps.size("page:uv:homepage");
```

---

## Geo — 地理位置

### 底层原理

Geo 的底层不是独立类型，而是用 ZSet 存储：

1. 通过 GeoHash 算法将经纬度编码为 base32 字符串
2. GeoHash 字符串作为 ZSet 的 member
3. 经纬度转为 52-bit 整数作为 ZSet 的 score

这样 Geo 的范围查询（方圆 N 公里）等价于 ZSet 的 ZRANGEBYSCORE，
查询效率 O(log N + M)（M = 返回的元素数）。

**GeoHash 的特性**：
- 两个点的 GeoHash 前缀相同长度越长，距离越近
- 是一个 Z 形空间填充曲线，相邻格子可能有跳跃

### 距离计算

GEODIST 使用 Haversine 公式计算球面距离。

### 常见坑

- GeoHash 编码有边界问题：两个很近的点可能在 GeoHash 的不同分支
- 数据量大时 GEOHASH 可读性差

### 示例代码

```java
// 添加地理位置
GeoOperations<String, String> geoOps = redisTemplate.opsForGeo();
geoOps.add("places", new Point(116.397128, 39.916527), "beijing");
geoOps.add("places", new Point(121.473701, 31.230416), "shanghai");

// 查询距离
Distance dist = geoOps.distance("places", "beijing", "shanghai", Metrics.KILOMETERS);
```

---

## Stream — 可靠消息队列

### 底层原理

Stream 用**基数树（Radix Tree / Rax）**存储消息，这是 Redis 中唯一使用 Rax 的数据结构。

关键概念：
- **消息 ID**：格式为 `timestamp-sequence`（如 1687332000000-0），自动生成保证递增
- **消费组**：多个消费者一起消费，每条消息只会被组内一个消费者处理
- **PEL（Pending Entries List）**：记录已分发但未被 ACK 的消息 ID + 消费者名称 + 投递次数
- **last_delivered_id**：消费组已分发的最后一条消息 ID

### 与 Redis List 消息队列的对比

| 维度 | List | Stream |
|------|------|--------|
| ACK 确认 | 无（取走即删） | XACK 确认 |
| 消息回溯 | 不支持 | XREAD 支持历史消息重读 |
| 消费者组 | 不支持 | 支持 |
| 消息持久化 | 取走即删 | ACK 后可通过 MAXLEN 裁剪 |
| 内存占用 | 小 | 较大（Rax + PEL 开销） |

### 与 Kafka 的对比

| 维度 | Redis Stream | Kafka |
|------|-------------|-------|
| 定位 | 轻量消息队列 | 分布式流平台 |
| 存储 | 内存（+持久化可选） | 磁盘顺序写 |
| 分区 | 无（单个 Stream 一个"分区"）| 多分区 |
| ACK 粒度 | 单条消息 | Offset 批量确认 |
| 消费保证 | 至少一次（XACK 前崩溃会重投）| 至少一次 |
| 适用规模 | 中小规模，低延迟 | 大规模，高吞吐 |

### 使用场景

- **消息队列**：需要 ACK、重试、消费者组的场景

### 常见坑

- PEL 膨胀：如果消费者一直不 ACK，PEL 会越来越大，XREADGROUP 变慢
- Stream 没有自动过期：需要 XADD MAXLEN 约等于 ~ 手动裁剪
- 不支持分区：单个 Stream 的吞吐量受限于单线程

### 示例代码

```java
// 创建消费组
redisTemplate.opsForStream().createGroup("orders", ReadOffset.from("0"), "order-processors");

// 消费消息
List<MapRecord<String, Object, Object>> messages = redisTemplate.opsForStream()
    .read(Consumer.from("order-processors", "consumer-1"),
          StreamReadOptions.empty().count(10),
          StreamOffset.create("orders", ReadOffset.lastConsumed()));
```

---

## 总结

1. **String** 是万能容器，但要知道 embstr/raw/int 的切换时机
2. **Hash** 存对象优于 String 当且仅当你需要频繁读写单字段
3. **ZSet** 的跳表+字典双结构是理解其时间和空间成本的关键
4. **HyperLogLog** 用 12KB 解决 UV 统计是一个"算法替代存储"的经典案例
5. **Stream** 弥补了 List 在可靠消息场景的不足，但和 Kafka 的定位有本质区别
