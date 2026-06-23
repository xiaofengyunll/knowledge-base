# Redis 集群与运维

## 概述
本文讲解 Redis 的持久化、主从复制、哨兵、集群、内存管理和监控，
帮助你理解生产环境运维 Redis 的关键原理和决策依据。

前置知识：Redis 基本操作和应用模式。

---

## 持久化原理

### RDB（Redis Database Backup）

RDB 是某个时间点的**全量快照**。

**SAVE vs BGSAVE**：
```
SAVE   → 主线程执行 → 阻塞所有请求 → 不推荐
BGSAVE → fork 子进程 → 子进程生成 RDB → 主进程继续服务 → 推荐
```

**BGSAVE 写时复制（COW, Copy-On-Write）**：
1. fork() 创建子进程，子进程共享父进程的内存页表
2. 两个进程最初指向相同的物理内存页
3. 父进程继续处理写请求：修改一个内存页时，OS 先复制该页，父进程改新页
4. 子进程读的始终是 fork 时刻的快照，不受父进程修改影响

这里的代价：如果 BGSAVE 期间有大量写入，COW 会导致大量内存页被复制，
内存使用量可能翻倍。

**触发条件**：
```
save 900 1   # 900 秒内至少 1 次写 → 触发 BGSAVE
save 300 10  # 300 秒内至少 10 次写 → 触发 BGSAVE
save 60 10000 # 60 秒内至少 10000 次写 → 触发 BGSAVE
```

需要根据数据重要性和写入频率调整。

### AOF（Append Only File）

AOF 是**命令日志**，记录所有写入命令。

**三种写盘策略**：

| 策略 | fsync 频率 | 数据安全 | 性能 |
|------|-----------|---------|------|
| always | 每条命令后 | 最好 | 最差 |
| everysec | 每秒一次（默认） | 丢 1 秒 | 高 |
| no | 由 OS 决定（通常 30s） | 丢很多 | 最高 |

**AOF 重写（BGREWRITEAOF）**：
- AOF 持续追加会导致文件膨胀
- 重写不读取旧 AOF 文件，而是读当前内存数据，生成最精简的命令
- 如 6 次 INCR 合并为 1 次 SET，删除的 key 不再记录
- 也是 fork 子进程执行，父进程继续服务

重写期间的新写入存在 AOF 重写缓冲区，重写完成后追加到新 AOF 文件尾。

### 混合持久化（Redis 4.0+）

```
AOF 文件内容 = RDB 头（全量快照） + AOF 尾（增量日志）
```

结合两者优点：
- 恢复速度快（RDB 头快速恢复大部分数据）
- 数据完整（AOF 尾保证增量部分）

### 选择指南

```
允许少量数据丢失（秒级）→ RDB
不允许数据丢失 → AOF everysec + RDB 定期备份
都不能接受 → Redis 可能不是最佳选择，考虑数据库
```

---

## 内存管理

### 内存模型

```
used_memory      # Redis 分配的内存总量
used_memory_rss  # OS 角度看 Redis 占用的物理内存
mem_fragmentation_ratio = used_memory_rss / used_memory
```

- ratio > 1.5：有严重的内存碎片
- ratio < 1：发生了 swap（部分数据被换出到磁盘）

### 碎片整理

Redis 4.0+ 支持主动碎片整理：

```
activedefrag yes
active-defrag-ignore-bytes 100mb  # 碎片超过 100MB 才开始整理
active-defrag-threshold-lower 10  # 碎片率超过 110% 开始
```

原理：在 serverCron 中分批次扫描内存、移动数据、回收碎片，
每次只占用少量 CPU 时间（默认 25%），不影响正常请求。

### 过期键删除策略

Redis 结合两种策略：

**惰性删除**：每次访问 key 时检查是否过期，如果过期就删除。
问题：如果 key 没人访问，永远不会被删除（内存泄漏）。

**定期删除**：serverCron 每 100ms 执行一次（默认 hz=10），
随机抽取一些 key 检查，过期了就删除。限制单次执行时间不超过 25ms。

这两种策略配合意味着：过期 key 不会立即释放内存，
可能在过期后几分钟甚至更久才被删除。

### 内存淘汰策略（8 种）

当内存满时决定删除哪些 key：

| 策略 | 行为 |
|------|------|
| noeviction | 拒绝写入，只允许读和删（默认） |
| allkeys-lru | 所有 key 中淘汰最近最少使用的 |
| volatile-lru | 有过期时间的 key 中淘汰 LRU |
| allkeys-lfu | 所有 key 中淘汰使用频率最低的（Redis 4.0+） |
| volatile-lfu | 有过期时间的 key 中淘汰 LFU |
| allkeys-random | 所有 key 中随机淘汰 |
| volatile-random | 有过期时间的 key 中随机淘汰 |
| volatile-ttl | 有过期时间的 key 中淘汰 TTL 最短的 |

**LRU vs LFU**：
LRU 看"最后一次访问是什么时候"→ 访问频率低的可能被保留。
LFU 看"访问频率有多高"→ 更精准但额外开销大。

Redis 的 LRU 不是精确的（需要双链表），而是在样本中选：
- maxmemory-samples 5（默认 5 个样本中选 LRU 的）
- 样本越多越精确，但计算成本也越高

### 选择建议

- 纯缓存用途 → allkeys-lru 或 allkeys-lfu
- 缓存 + 持久化数据混合 → volatile-lru
- 不知道选什么 → allkeys-lru

---

## 主从复制

### 全量复制

```
Master                     Slave
  |                          |
  |  ← PSYNC ? -1  ←---------|  (第一次同步)
  |                          |
  |  → FULLRESYNC runid offset →|
  |                          |
  |  BGSAVE → RDB 文件       |
  |                          |
  |  → 发送 RDB 文件 →------→|  加载 RDB
  |                          |
  |  期间新写放在 replication|
  |  buffer                  |
  |                          |
  |  → 发送 buffer →--------→|  执行增量数据
  |                          |
  |  完成                    |  完成
```

关键时间窗口：Master 生成和传输 RDB 期间，新写入积压在 replication buffer 中。
如果 RDB 传输很慢（大内存+慢网络），buffer 可能会满，导致全量复制重来。

### 增量复制

```
Master                        Slave
  runid: aaa                   runid: null
  offset: 5000
  repl_backlog: [..............X]
                              |
  runid: aaa      断开！------|
  offset: 5100                 |
  repl_backlog: [..............X......]  重连
                              |
                              |  → PSYNC aaa 5000 →
                              |
  ← CONTINUE ←---------------|  (5000 还在 backlog 里，增量复制)
```

### 关键参数

**repl-backlog-size**：积压缓冲区大小。

```
repl-backlog-size = 断线重连窗口（秒） × 写入速率（字节/秒）

例如：断线重连窗口 = 60 秒，写入速率 = 10MB/s
      repl-backlog-size = 60 × 10MB = 600MB
```

如果 slave 断线期间主库的写入量超过了 backlog 的容量，
slave 重连后不得不重新全量复制。

**client-output-buffer-limit slave**：

```
client-output-buffer-limit slave 256mb 64mb 60
```

- 硬限制 256MB：达到后立即断开
- 软限制 64MB，持续 60 秒：达到后如果持续超过 60 秒，断开

---

## Sentinel 哨兵

### 架构

最少需要 3 个 Sentinel 实例（保证选举多数派）：

```
Sentinel-1 ←→ Sentinel-2
    ↕            ↕
Sentinel-3  ←→  Master
                  ↕
                Slave-1
                  ↕
                Slave-2
```

### 三任务

1. **监控**：每 1 秒向所有实例发 PING，检查存活状态
2. **通知**：通过 Pub/Sub 通知客户端主从变更
3. **故障转移**：master 下线时选新 master

### SDOWN vs ODOWN

```
SDOWN（主观下线）：Sentinel-1 自己 PING Master 超时 → 认为 Master 挂了
                    → 向其他 Sentinel 询问：你看到 Master 活着吗？

ODOWN（客观下线）：有 quorum 个 Sentinel 都说 Master 挂了
                    → 达成共识 → 开始故障转移
```

### Leader Sentinel 选举

类似 Raft 协议的简化版：
1. Sentinel 向其他 Sentinel 请求"选我当 Leader"
2. 先到先得（FIFO），每个纪元只投一票
3. 获得多数票且 >= quorum → 当选

### 故障转移流程

```
1. Leader 选出：经过 Sentinel 选举
2. 选新主：从 Slave 中选（过滤掉下线、超时过长的）
   选优先级：
   ① replica-priority 最低的（人工指定）
   ② 复制偏移量最大的（数据最新）
   ③ runid 最小的（字典序，当偏移量相同时）
3. 配置其他从：SLAVEOF new-master
4. 通知客户端：+switch-master 事件
```

### TILT 模式

当系统时钟出现大幅跳跃（如 NTP 校时）时，Sentinel 进入 TILT 模式：
- 暂停所有操作（不执行故障转移）
- 30 秒后退出 TILT，恢复正常

这是自我保护机制——在时钟不可信的情况下，所有基于时间的判断（心跳超时）都不可靠。

---

## Cluster 集群

### 哈希槽 16384

```
slot = CRC16(key) % 16384

16384 的原因（出自 Redis 作者 antirez）：
- 16384 / 8 = 2048 字节（心跳包中槽位信息的大小）
- 65536（CRC16 的最大值）会导致心跳包 8KB = 太大
- 集群节点一般不超过 1000 个，16384 个槽足够了
```

### MOVED vs ASK 重定向

```
MOVED：客户端请求的 key 不在当前节点，在另一节点
       → 永久重定向 → 客户端更新槽映射缓存

ASK：槽正在迁移中，此 key 已被迁移到目标节点
     → 临时重定向 → 客户端只针对本次请求去到目标节点
```

区别：MOVED 触发客户端更新槽映射表，ASK 不更新。

### 槽迁移（Resharding）

```
redis-cli --cluster reshard <host>:<port>

内部流程：
1. 源节点：SETSLOT <slot> MIGRATING <target-node-id>
2. 目标节点：SETSLOT <slot> IMPORTING <source-node-id>
3. MIGRATE 逐个迁移 key：
   DUMP key → 序列化 key 值 → RESTORE 到目标节点
4. 完成：SETSLOT <slot> NODE <target-node-id>（源和目标都执行）
```

迁移期间，请求可能收到 ASK 重定向。

### 脑裂

当网络分区时，可能出现两个 master 持有相同的槽：

```
[Master A] --X-- [Master B (原 Slave)]
    |                  |
[Client 1]        [Client 2]
向 A 写入          向 B 写入
```

网络恢复后，B 重新成为 A 的 slave，B 上的所有写入丢失。

缓解措施：
- cluster-require-full-coverage yes：如果任意槽没有节点负责，拒绝写入
- min-replicas-to-write 1：至少有一个从库时才接受写入

---

## 监控关键指标

### INFO 核心指标解读

**Server**：
- uptime_in_seconds：运行时长

**Clients**：
- connected_clients：当前连接数
- blocked_clients：阻塞等待中的客户端数（BLPOP 等）

**Memory**：
- used_memory：Redis 分配的内存
- mem_fragmentation_ratio：内存碎片率

**Stats**：
- instantaneous_ops_per_sec：每秒操作数（QPS）
- evicted_keys：被淘汰的 key 数（非零说明内存不够，有淘汰）
- keyspace_hits / keyspace_misses：缓存命中/未命中 → hit_rate = hits/(hits+misses)
- expired_keys：过期的 key 总数

**Replication**：
- master_repl_offset：主库复制偏移量
- slave_repl_offset：从库复制偏移量
- 差值 = 主从延迟

**Keyspace**：
- 每个 db 的 key 数量和平均 TTL

### 慢查询日志

```
slowlog-log-slower-than 10000  # 超过 10000 微秒（10ms）记录
slowlog-max-len 128             # 最多存 128 条
```

查询：`SLOWLOG GET 10`

### 延迟监控

```
LATENCY LATEST  # 最近延迟事件
LATENCY HISTORY command  # 命令延迟历史
LATENCY DOCTOR  # 自动诊断建议
```

---

## 日常运维脚本

### 备份

```bash
# 后台 RDB 备份
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backup/redis/dump_$(date +%Y%m%d_%H%M%S).rdb
```

### 健康检查

```bash
# 连接检查
redis-cli -h host -p port -a password PING

# 内存检查
redis-cli INFO memory | grep used_memory_human

# 主从检查
redis-cli INFO replication | grep role
```

### 故障排查顺序

1. `PING`：还活着吗？
2. `INFO stats`：QPS、命中率、淘汰 key 数
3. `INFO memory`：内存使用和碎片率
4. `SLOWLOG GET 10`：有没有慢命令
5. `CLIENT LIST`：连接数是否异常
6. `MONITOR`：危险！实时看所有命令（生产环境慎用，极耗性能）

---

## 总结

1. **RDB + AOF 混合持久化是当前最佳实践**，兼顾恢复速度和数据安全
2. **内存淘汰策略根据用途选择**，纯缓存用 allkeys-lru，混合数据用 volatile-lru
3. **哨兵最少 3 个**，少于 3 个选不出 Leader
4. **Cluster 的槽迁移不是无感的**，大 key 迁移时会阻塞
5. **监控命中率、碎片率、主从延迟**是 Redis 运维的三个核心指标
