# MySQL 数据库技术指南

关系型数据库核心原理：表结构设计、SQL 编写、索引、事务、锁机制、SQL 性能优化及 InnoDB 存储引擎。

---

## 一、表结构设计

### 1.1 范式理论

| 范式 | 核心规则 | 反例 |
|------|---------|------|
| 1NF | 列不可再分，所有字段都是原子值 | 一个字段存 `"篮球,足球"` |
| 2NF | 非主键列必须完全依赖于主键（消除部分依赖） | 联合主键 `(order_id, product_id)`，但 `product_name` 只依赖 `product_id` |
| 3NF | 非主键列不能传递依赖于主键 | `province_id` → `province_name`，不应同时存 `city_id` 和 `province_name` |

实际开发中，**允许适度反范式**：高频查询的关联字段冗余存储，用空间换时间。

### 1.2 字段类型选择原则

- **越小越好**：能用 `TINYINT` 不用 `INT`，能用 `CHAR(32)` 不用 `VARCHAR(255)`
- **越简单越好**：能用整型不用字符型，字符型比较代价高
- **避免 NULL**：NULL 让索引、聚合、比较都变复杂，尽量 `NOT NULL` + 默认值
- **时间存储**：用 `DATETIME`（8 字节，范围 1000~9999 年）而非 `TIMESTAMP`（4 字节，2038 年溢出），除非需要时区自动转换
- **金额存储**：用 `DECIMAL` 而非 `FLOAT/DOUBLE`，浮点数有精度丢失

### 1.3 字符集

```sql
-- 建库建表推荐
CREATE DATABASE mydb DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE t (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL DEFAULT '',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`utf8mb4` 支持完整的 Unicode（含 emoji），MySQL 的 `utf8` 是阉割版，只支持 3 字节。

### 1.4 主键设计

- **推荐自增 ID** 或 **雪花 ID**（分布式），避免 UUID（无序导致 B+ 树页分裂严重）
- InnoDB 的主键是聚簇索引，数据按主键顺序物理存储，插入有序主键可减少页分裂
- 没有显式主键时，InnoDB 选第一个唯一非空索引作为聚簇索引，都没有则建隐藏的 6 字节 `row_id`

---

## 二、SQL 编写

### 2.1 JOIN

| 类型 | 含义 |
|------|------|
| `INNER JOIN` | 两表匹配的行 |
| `LEFT JOIN` | 左表全保留，右表无匹配补 NULL |
| `RIGHT JOIN` | 右表全保留（实际中改为 LEFT JOIN + 调换顺序） |
| `CROSS JOIN` | 笛卡尔积 |
| `NATURAL JOIN` | 自动按同名列关联（不推荐，列名变化会静默破坏） |

**JOIN 本质是嵌套循环**：驱动表（外层）每条记录去被驱动表（内层）找匹配。小表驱动大表，被驱动表的关联列必须有索引。

### 2.2 子查询与派生表

```sql
-- 关联子查询：外层每行执行一次，慎用
SELECT name FROM users u WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.amount > 100
);

-- 派生表：FROM 中的子查询，会生成临时表，大数据量慎用
SELECT * FROM (
    SELECT user_id, COUNT(*) cnt FROM orders GROUP BY user_id
) t WHERE cnt > 5;
```

MySQL 8.0 优化器对子查询的优化增强很多（如自动将 `IN` 子查询转为 semi-join），但复杂子查询仍建议用 JOIN 改写。

### 2.3 UNION

- `UNION` 去重（需要额外排序），`UNION ALL` 不去重（直接拼接）
- 明确不需要去重时，务必用 `UNION ALL`

### 2.4 GROUP BY 与聚合

```sql
-- WHERE 在分组前过滤，HAVING 在分组后过滤
SELECT dept_id, AVG(salary) avg_sal
FROM employees
WHERE status = 'active'
GROUP BY dept_id
HAVING avg_sal > 10000;
```

`GROUP BY` 默认排序，不需要排序时加 `ORDER BY NULL`（MySQL 8.0 起 GROUP BY 不再隐式排序）。

### 2.5 窗口函数（MySQL 8.0+）

```sql
-- ROW_NUMBER / RANK / DENSE_RANK
SELECT name, dept_id, salary,
    ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rn
FROM employees;

-- 累积求和
SELECT date, amount,
    SUM(amount) OVER (ORDER BY date) AS cumulative
FROM sales;
```

### 2.6 分页优化

```sql
-- 传统 OFFSET 越往后越慢（需要扫描前 N 条再丢弃）
SELECT * FROM t ORDER BY id LIMIT 100000, 20;  -- 慢

-- 方案一：延迟关联
SELECT t.* FROM t
INNER JOIN (SELECT id FROM t ORDER BY id LIMIT 100000, 20) tmp
ON t.id = tmp.id;

-- 方案二：记录上次 ID（适合滚动加载）
SELECT * FROM t WHERE id > 100000 ORDER BY id LIMIT 20;
```

---

## 三、索引

### 3.1 B+ 树原理

InnoDB 使用 B+ 树作为索引结构：

- 非叶子节点只存键值（不存数据），单个节点能存更多键 → 树更矮 → IO 更少
- 叶子节点形成有序双向链表，支持范围查询和排序
- 所有数据都在叶子节点，每次查询的 IO 次数约等于树高（通常 3~4 层）
- 聚簇索引的叶子节点存完整行数据；二级索引的叶子节点存主键值

### 3.2 索引类型

| 类型 | 说明 |
|------|------|
| 主键索引（聚簇） | 叶子存完整行数据，一张表只有一个 |
| 唯一索引 | 保证唯一性，允许一个 NULL（MySQL 中多个 NULL 不算重复） |
| 普通索引 | 加速查询和排序 |
| 联合索引 | 多列组合，**最左前缀原则** |
| 前缀索引 | 只索引列的前 N 个字符，省空间但无法用于 ORDER BY |
| 全文索引 | 文本搜索，支持 `MATCH ... AGAINST` |
| 空间索引 | 地理数据（R-Tree） |

### 3.3 最左前缀原则

联合索引 `(a, b, c)` 相当于创建了 `(a)`、`(a, b)`、`(a, b, c)` 三个索引：

```sql
INDEX idx_abc (a, b, c)

-- 能用索引
WHERE a = 1                -- 用 a
WHERE a = 1 AND b = 2      -- 用 a,b
WHERE a = 1 AND b = 2 AND c = 3  -- 用 a,b,c
WHERE a = 1 AND c = 3      -- 只用 a（c 断开了）

-- 不能用索引（不满足最左前缀）
WHERE b = 2                -- 跳过 a
WHERE c = 3                -- 跳过 a,b

-- 范围查询后失效
WHERE a = 1 AND b > 2 AND c = 3  -- 只用 a,b（b 用了范围，c 失效）
```

**技巧**：等值查询列放前面，范围查询列放最后；区分度高的列放前面。

### 3.4 索引失效场景

- `LIKE '%xxx'` 或 `LIKE '%xxx%'` 以 `%` 开头
- 对索引列使用函数：`WHERE DATE(create_time) = '2025-01-01'`
- 对索引列运算：`WHERE id + 1 = 10`（应写成 `WHERE id = 9`）
- 隐式类型转换：`WHERE phone = 13800138000`（phone 是 `VARCHAR` 时索引失效）
- `OR` 连接非索引列：`WHERE a = 1 OR b = 2`（若 b 无索引，整体可能不走索引）
- `!=`、`<>`、`NOT IN`、`IS NULL`（不一定全失效，取决于数据分布和优化器选择）

### 3.5 覆盖索引

查询列全部命中索引时，无需回表查完整行数据，性能提升明显：

```sql
-- 有联合索引 idx_abc(a, b, c)
SELECT a, b, c FROM t WHERE a = 1;  -- 覆盖索引，Extra: Using index
SELECT * FROM t WHERE a = 1;        -- 需要回表
```

`EXPLAIN` 的 `Extra` 列出现 `Using index` 表示覆盖索引。

### 3.6 索引下推（ICP）

MySQL 5.6+ 将 `WHERE` 中能用索引的条件在存储引擎层过滤，减少回表次数：

```sql
INDEX idx_name_age (name, age)
SELECT * FROM t WHERE name LIKE '张%' AND age = 25;
-- 引擎层先按 name 范围扫描，再按 age 过滤后才回表
```

---

## 四、事务

### 4.1 ACID

| 特性 | 含义 | 实现机制 |
|------|------|---------|
| 原子性 (Atomicity) | 事务是一个不可分割的单位 | undo log（回滚日志） |
| 一致性 (Consistency) | 事务前后数据满足所有约束 | AID 共同保证 |
| 隔离性 (Isolation) | 并发事务之间互不干扰 | 锁 + MVCC |
| 持久性 (Durability) | 提交后数据永久保存 | redo log（重做日志） |

### 4.2 隔离级别

| 级别 | 脏读 | 不可重复读 | 幻读 | 实现 |
|------|------|-----------|------|------|
| READ UNCOMMITTED | 可能 | 可能 | 可能 | 不加锁读 |
| READ COMMITTED | 不会 | 可能 | 可能 | 每次读最新快照 |
| REPEATABLE READ（默认） | 不会 | 不会 | 部分解决 | 事务开始时创建快照 |
| SERIALIZABLE | 不会 | 不会 | 不会 | 读加共享锁 |

InnoDB 的 REPEATABLE READ 通过**间隙锁**解决了大部分幻读问题（当前读场景），但快照读仍可能产生幻读。

### 4.3 MVCC（多版本并发控制）

核心思想：**读不阻塞写，写不阻塞读**。

每行记录有两个隐藏列：

- `trx_id`：最近修改该行的事务 ID
- `roll_pointer`：指向 undo log 中上一版本

**ReadView** 记录当前活跃事务列表，通过可见性规则判断应读取哪个版本：

- 数据版本的 trx_id = 当前事务 ID → 可见
- 数据版本的 trx_id < 最小活跃事务 ID → 已提交，可见
- 数据版本的 trx_id > 最大活跃事务 ID → 不可见，沿 roll_pointer 找上一版本
- 否则看 trx_id 是否在活跃列表中：不在则可见，在则不可见

READ COMMITTED 每次读创建新 ReadView；REPEATABLE READ 只在第一次读时创建一次。

### 4.4 undo log

- 记录数据修改前的旧值
- 用于**事务回滚**和 **MVCC 读历史版本**
- 存储在共享表空间 `ibdata1` 或独立的 undo 表空间
- 由 purge 线程清理不再需要的旧版本

### 4.5 redo log

- 记录数据页的物理修改（"对表空间 X、页 Y、偏移量 Z 写入 A"）
- 用于**崩溃恢复**
- WAL（Write-Ahead Logging）：先写 redo log，再写数据页
- 两个文件循环写：`ib_logfile0`、`ib_logfile1`
- `innodb_flush_log_at_trx_commit`：
  - `1`（推荐）：每次提交刷盘，不丢数据
  - `2`：每次提交写 OS 缓存，每秒刷盘，丢 1 秒数据
  - `0`：每秒写 OS 缓存并刷盘，可能丢 1 秒数据

---

## 五、锁机制

### 5.1 锁的粒度

| 粒度 | 锁谁 | 并发 | 开销 |
|------|------|------|------|
| 表锁 | 整张表 | 低 | 小 |
| 行锁 | 单行 | 高 | 大 |
| 页锁 | 数据页 | 中 | 中 |

InnoDB 默认行锁，MyISAM 仅支持表锁。

### 5.2 共享锁与排他锁

| 锁类型 | 简称 | 互斥关系 | 典型场景 |
|--------|------|---------|---------|
| 共享锁 | S 锁 | 与 X 锁互斥，与 S 锁兼容 | `SELECT ... LOCK IN SHARE MODE`（8.0+ 改为 `FOR SHARE`） |
| 排他锁 | X 锁 | 与任何锁互斥 | `UPDATE`、`DELETE`、`INSERT`、`SELECT ... FOR UPDATE` |

```sql
-- 显式加锁
SELECT * FROM t WHERE id = 1 FOR UPDATE;   -- 加 X 锁
SELECT * FROM t WHERE id = 1 FOR SHARE;     -- 加 S 锁
```

### 5.3 行锁的三种实现

| 锁类型 | 说明 | 锁住内容 |
|--------|------|---------|
| Record Lock | 锁定索引记录本身 | 具体的索引记录 |
| Gap Lock | 锁定索引记录间的间隙 | 间隙（不含记录本身） |
| Next-Key Lock | Record + Gap | 左开右闭区间 |

**间隙锁只存在于 REPEATABLE READ 隔离级别**，目的是防幻读。READ COMMITTED 下不使用间隙锁，只加记录锁。

### 5.4 锁加在索引上

InnoDB 的行锁是加在**索引**上的，不是加在数据行上：

```sql
-- name 列无索引
SELECT * FROM t WHERE name = 'Alice' FOR UPDATE;
-- 全表扫描 → 所有记录都被锁 + 间隙锁（在 RR 下），近似表锁！
```

**行锁必须命中索引**，否则退化为表锁。

### 5.5 死锁

死锁产生的四个必要条件：
1. 互斥：资源一次只能被一个事务使用
2. 占有且等待：持有资源的同时等待其他资源
3. 不可抢占：已持有的资源不能被强制剥夺
4. 循环等待：事务间形成等待环

**应对策略**：
- 按固定顺序访问资源（如先锁 id 小的记录）
- 缩短事务时间
- 使用 `SELECT ... FOR UPDATE NOWAIT` 或 `SKIP LOCKED`（MySQL 8.0+）
- InnoDB 自带死锁检测，会自动回滚开销最小的事务

### 5.6 意向锁

表级锁，标记事务意图在更细粒度上加锁：
- **意向共享锁（IS）**：事务打算在行上加共享锁
- **意向排他锁（IX）**：事务打算在行上加排他锁

作用是快速判断表中是否有行级锁，避免逐行检查。

---

## 六、SQL 性能优化

### 6.1 EXPLAIN 解读

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 100;
```

| 字段 | 含义 | 关注点 |
|------|------|--------|
| `id` | 执行顺序 | 同 id 从上到下；不同 id 越大越先执行 |
| `select_type` | 查询类型 | SIMPLE/PRIMARY/DERIVED/SUBQUERY/DEPENDENT SUBQUERY |
| `type` | **访问方式（关键）** | system > const > eq_ref > ref > range > index > ALL |
| `possible_keys` | 可能使用的索引 | |
| `key` | 实际使用的索引 | NULL 表示没走索引 |
| `key_len` | 使用索引的字节数 | |
| `ref` | 索引比较的列/常量 | |
| `rows` | **预估扫描行数** | 越少越好 |
| `filtered` | 被过滤行的百分比 | |
| `Extra` | 额外信息 | Using index/Using filesort/Using temporary/Using where |

### 6.2 type 访问类型（由好到差）

| type | 含义 |
|------|------|
| `system` | 表仅一行 |
| `const` | 主键或唯一键等值查询，最多一条 |
| `eq_ref` | 关联查询时被驱动表用主键/唯一键匹配 |
| `ref` | 普通索引等值查询 |
| `range` | 索引范围扫描（`>`、`<`、`IN`、`BETWEEN`） |
| `index` | 全索引扫描（遍历整个索引树） |
| `ALL` | 全表扫描（最差） |

优化目标至少到 `range`，最好到 `ref`。

### 6.3 Extra 关键信息

| 值 | 含义 |
|----|------|
| `Using index` | 覆盖索引，无需回表（好） |
| `Using where` | 存储引擎返回行后由 Server 层过滤 |
| `Using index condition` | 索引下推（ICP） |
| `Using filesort` | 额外排序，未利用索引排序（需优化） |
| `Using temporary` | 使用临时表（GROUP BY/DISTINCT/UNION，需优化） |
| `Using join buffer` | 被驱动表无索引，使用了 join buffer（需优化） |

### 6.4 优化原则

1. **先看慢查询日志**：`long_query_time` 设为 0.1 秒，分析真正慢的 SQL
2. **减少访问数据量**：只查需要的列（不用 `SELECT *`），只查需要的行（合理 WHERE 条件）
3. **避免大事务**：拆分为小事务，减少锁持有时间
4. **批量操作分批**：`INSERT INTO ... VALUES (1),(2)...(1000)` 每批 500~1000 条，避免长事务
5. **ORDER BY 利用索引**：排序列也在索引中可以避免 filesort
6. **Count 优化**：
   - `COUNT(*)` ≈ `COUNT(1)` > `COUNT(列)`（`COUNT(列)` 不统计 NULL）
   - 精确计数用 `COUNT(*)`，近似估值用 `SHOW TABLE STATUS` 或 `EXPLAIN`
7. **避免 SELECT ... FOR UPDATE 锁范围过大**：必须在有索引的列上使用

### 6.5 慢查询日志配置

```sql
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0.1;
SET GLOBAL log_queries_not_using_indexes = ON;
SET GLOBAL log_slow_admin_statements = ON;
```

### 6.6 常用诊断命令

```sql
-- 查看当前所有连接
SHOW PROCESSLIST;
-- 或更详细的
SELECT * FROM information_schema.INNODB_TRX;       -- 当前事务
SELECT * FROM information_schema.INNODB_LOCKS;     -- 锁信息（8.0-）
SELECT * FROM information_schema.INNODB_LOCK_WAITS; -- 锁等待（8.0-）
SELECT * FROM performance_schema.data_locks;        -- 锁信息（8.0+）
SELECT * FROM performance_schema.data_lock_waits;   -- 锁等待（8.0+）

-- 查看 InnoDB 状态（含最近死锁信息）
SHOW ENGINE INNODB STATUS\G
```

---

## 七、InnoDB 存储引擎核心原理

### 7.1 架构概览

```
┌─────────────────────────────────────────────┐
│                  Server 层                   │
│  (连接管理、查询缓存、解析器、优化器、执行器)    │
├─────────────┬──────────────┬────────────────┤
│ InnoDB      │  MyISAM      │  Memory        │
│ (默认引擎)   │  (旧引擎)     │  (内存引擎)     │
└─────────────┴──────────────┴────────────────┘
```

InnoDB 内部架构：

```
┌──────────────────────────────────┐
│        内存结构 (Buffer Pool)      │
│  ┌────────────────────────────┐  │
│  │  数据页 / 索引页 / undo 页   │  │
│  │  自适应哈希索引              │  │
│  │  Change Buffer             │  │
│  │  Log Buffer                │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│        磁盘结构                   │
│  系统表空间 / 独立表空间 (.ibd)    │
│  redo log / undo log / binlog    │
│  双写缓冲                         │
└──────────────────────────────────┘
```

### 7.2 内存结构

#### Buffer Pool

- InnoDB 最重要的内存区域，缓存数据页和索引页
- 大小由 `innodb_buffer_pool_size` 控制，建议设为物理内存的 50%~80%
- 使用 **LRU 变体算法**：分 young 区（热数据）和 old 区（冷数据），新读入的页先放 old 区头部，避免全表扫描冲掉热数据
- 页大小默认 16KB

#### Change Buffer

- 当二级索引页不在 Buffer Pool 时，INSERT/UPDATE/DELETE 的修改先写入 Change Buffer
- 等该页被读入时再合并（merge），减少随机 IO
- 仅适用于普通二级索引，唯一索引需检查唯一性，不能缓写

#### Adaptive Hash Index

- 对频繁访问的索引页自动建立哈希索引，加速等值查询
- 不可手动创建，由 InnoDB 自动维护

#### Log Buffer

- 暂存 redo log 的内存区域，默认 16MB
- 事务提交时刷入磁盘 redo log 文件

### 7.3 磁盘结构

#### 表空间

| 类型 | 说明 |
|------|------|
| 系统表空间 (`ibdata1`) | 数据字典、undo log（可独立）、双写缓冲、Change Buffer |
| 独立表空间 (`.ibd`) | 每张表的数据和索引，默认开启 |
| 通用表空间 | 多张表共享，MySQL 5.7+ |
| 临时表空间 | 临时表、排序临时表 |
| undo 表空间 | MySQL 5.7+ 可独立存放 undo log |

#### 页（Page）结构

数据存储的基本单位，默认 16KB：

```
┌─────────────────────┐
│  File Header (38B)  │
├─────────────────────┤
│  Page Header (56B)  │
├─────────────────────┤
│  Infimum + Supremum │  ← 虚拟最小/最大记录
├─────────────────────┤
│  User Records       │  ← 实际数据行
├─────────────────────┤
│  Free Space         │
├─────────────────────┤
│  Page Directory     │  ← 槽（slot）数组，二分查找页内记录
├─────────────────────┤
│  File Trailer (8B)  │  ← 校验和，保证页完整性
└─────────────────────┘
```

#### 行（Row）格式

| 格式 | 特点 |
|------|------|
| `COMPACT` | 基本格式，变长字段长度列表 + NULL 位图 |
| `REDUNDANT` | 旧格式，兼容 |
| `DYNAMIC`（默认） | BLOB/TEXT 溢出页只存前 20 字节指针 |
| `COMPRESSED` | 支持页级压缩 |

### 7.4 脏页刷盘与 Checkpoint

- **脏页**：内存中修改过但未写入磁盘的数据页
- **Checkpoint**：某个时间点，脏页被批量写入磁盘，redo log 中该点之前的记录可以被覆盖
- Checkpoint 有两种：
  - **Sharp Checkpoint**：全部脏页刷盘（关闭时）
  - **Fuzzy Checkpoint**：部分脏页刷盘（运行时，逐步进行）
- 刷盘时机：Buffer Pool 满、redo log 满、定期刷盘、MySQL 空闲时

### 7.5 双写缓冲（Doublewrite Buffer）

解决**部分写失效**问题：16KB 的页写到一半断电，导致页损坏且 redo log 无法恢复（redo log 作用于页内，需页本身完整）。

流程：
1. 先将脏页写入 doublewrite buffer（磁盘上 2MB 连续区域）
2. 再写入实际表空间
3. 写第 2 步时崩溃 → 重启时用 doublewrite buffer 中完整副本恢复

### 7.6 三大日志对比

| 日志 | 层级 | 内容 | 作用 | 写入时机 |
|------|------|------|------|---------|
| **redo log** | InnoDB 引擎层 | 物理日志：页的修改 | 崩溃恢复 | 事务执行中持续写 |
| **undo log** | InnoDB 引擎层 | 逻辑日志：修改前的旧值 | 回滚 + MVCC | 修改数据前写 |
| **binlog** | Server 层 | 逻辑日志：SQL 语句或行变更 | 主从复制、数据恢复 | 事务提交时写 |

**两阶段提交**（保证 redo log 和 binlog 一致）：
1. Prepare 阶段：写 redo log，标记为 prepare 状态
2. Commit 阶段：写 binlog
3. 写 redo log commit 标记
4. 崩溃恢复时，检查 prepare 状态的 redo log：对应 binlog 完整则提交，否则回滚

### 7.7 InnoDB 与 MyISAM 对比

| 特性 | InnoDB | MyISAM |
|------|--------|--------|
| 事务 | 支持 | 不支持 |
| 行级锁 | 支持 | 仅表锁 |
| 外键 | 支持 | 不支持 |
| 崩溃恢复 | redo log 保证 | 崩溃后表易损坏 |
| MVCC | 支持 | 不支持 |
| 全文索引 | 5.6+ 支持 | 较早支持 |
| 空间索引 | 5.7+ 支持 | 支持 |
| COUNT(*) | 需要全索引/全表扫描 | 维护了行数变量，直接返回 |
| 适用场景 | 高并发、事务场景 | 只读/日志/归档 |

### 7.8 关键参数

```ini
[mysqld]
# InnoDB 专用
innodb_buffer_pool_size = 8G          # 内存核心参数，物理内存 50%~80%
innodb_log_file_size = 1G             # redo log 文件大小
innodb_log_buffer_size = 16M          # log buffer 大小
innodb_flush_log_at_trx_commit = 1    # 每次提交刷 redo log
innodb_flush_method = O_DIRECT        # 绕过 OS 缓存直接写磁盘
innodb_io_capacity = 2000             # SSD 建议调高此值
innodb_page_size = 16384              # 默认 16KB，一般不改
innodb_file_per_table = ON            # 每表独立表空间
innodb_doublewrite = ON               # 开启双写缓冲

# 连接相关
max_connections = 500
wait_timeout = 600

# 二进制日志
binlog_format = ROW                   # STATEMENT/ROW/MIXED，推荐 ROW
sync_binlog = 1                       # 每次提交刷 binlog，与 innodb_flush_log_at_trx_commit=1 组成双一配置
expire_logs_days = 7                  # binlog 保留天数
```

---

## 八、常见问题速查

### 8.1 UPDATE 没加索引导致锁全表

```sql
-- 危险：status 无索引，RR 级别下锁全表
UPDATE orders SET amount = 100 WHERE status = 'pending';
-- 解决：给 status 加索引
CREATE INDEX idx_status ON orders(status);
```

### 8.2 长事务危害

- undo log 无法清理，导致表空间膨胀
- 锁一直持有，阻塞其他事务
- 从库延迟（主库提交后从库才开始回放长事务）

排查：`SELECT * FROM information_schema.INNODB_TRX WHERE trx_started < NOW() - INTERVAL 60 SECOND;`

### 8.3 隐式字符集转换导致全表扫描

```sql
-- utf8mb4 的表和 utf8 的表 JOIN 时，后者会被转换为 utf8mb4
-- 这种转换会让索引失效
-- 解决：统一字符集
```

### 8.4 大量短连接性能差

每次连接都要创建线程、认证、分配资源。解决方案：
- 使用连接池
- 开启 `skip_name_resolve` 关闭 DNS 反向解析
- 适当调大 `back_log`

---

*最后更新：2026-06-21*
