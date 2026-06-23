# Spring Boot 集成 Redis

## 概述
本文深入讲解 Spring Data Redis 的架构设计、配置决策和序列化机制，
帮助你理解 Spring Boot 自动配置背后的原理，做出正确的技术选型。

前置知识：Spring Boot 自动配置基本概念。

---

## 依赖与驱动选择

### 依赖树分析

spring-boot-starter-data-redis 的核心依赖链：

```
spring-boot-starter-data-redis
├── spring-data-redis (核心 API)
├── lettuce-core (默认 Redis 客户端)
├── spring-boot-starter (自动配置)
└── commons-pool2 (可选连接池，需手动加)
```

关键点：commons-pool2 不是自动引入的——虽然参考文档中常见的连接池配置都依赖它，
但如果不用连接池（默认 Lettuce 不需要），可以不引入。

### Lettuce vs Jedis：架构对比

这是 Spring Boot 生态中最常见的 Redis 客户端选择：

**Lettuce（Spring Boot 默认）**：
- 基于 Netty，异步事件驱动模型
- 单连接复用（一个连接同时处理多个请求，通过 Redis 的请求-响应协议帧区分）
- 线程安全，所有操作都可以共享同一个连接实例
- 天然支持 Redis Cluster、Sentinel、读写分离
- 4.x 前同步/异步两套 API，5.x 统一到 Reactive Streams

**Jedis（传统选择）**：
- 基于连接池（JedisPool），同步阻塞 IO
- 每个 Jedis 实例 = 一个 TCP 连接，非线程安全
- 简单直观，适合低并发场景
- 3.x 开始支持 Cluster、Sentinel

**选择依据**：
- 高并发场景 → Lettuce（连接复用，内存占用小）
- 简单场景、团队熟悉 → Jedis
- Spring Boot 2.x+ → Lettuce 是默认，无需额外配置
- Redis Cluster → Lettuce（天然支持，Jedis Cluster 有很多坑）

---

## 自动配置原理

### RedisAutoConfiguration 加载链

Spring Boot 在启动时通过 `@AutoConfiguration` 顺序加载 Redis 相关配置：

1. **RedisAutoConfiguration**：
   - 检测 classpath 中有 RedisConnectionFactory
   - 注册 RedisTemplate（基于 Lettuce 或 Jedis 的连接工厂）
   - 注册 StringRedisTemplate

2. **LettuceConnectionConfiguration**（默认）：
   - @ConditionalOnClass(RedisClient.class)：classpath 中有 Lettuce 才生效
   - @ConditionalOnMissingBean(RedisConnectionFactory.class)：没有自定义连接工厂时才创建
   - 读取 spring.data.redis.*、spring.data.redis.lettuce.pool.* 配置

3. **JedisConnectionConfiguration**（备选）：
   - @ConditionalOnClass({Jedis.class, JedisConnection.class})
   - 只有 classpath 中有 Jedis 且没有 Lettuce 时才会加载

### LettuceConnectionFactory 生命周期

连接工厂有几种状态：
- **未初始化**：afterPropertiesSet() 调用前
- **已初始化，未连接**：LettuceClient 已创建，TCP 未建立（惰性连接）
- **已连接**：TCP 已建立，可处理命令

默认是惰性连接——应用启动时不会立刻连接 Redis，
只有第一个 Redis 命令到达时才建立连接。可以通过 `setEagerInitialization(true)` 改为启动时连接。

### Shutdown 顺序

应用关闭时，@PreDestroy 触发 destroy()：
1. 关闭所有 LettuceClient（发送 QUIT 命令 → 关闭 TCP）
2. 释放连接池中的连接（如果启用了 commons-pool2）

---

## 连接配置详解

### 单机模式

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      database: 0
      password: 123456
      timeout: 2000ms          # 命令超时
      connect-timeout: 2000ms  # 连接超时（Socket 连接建立时间）
```

- database：Redis 的逻辑数据库编号（0-15，默认 16 个）
- timeout：命令超时，超时后抛出 RedisCommandTimeoutException
- connect-timeout：TCP 连接建立的超时，对连接池很重要（不能连接等太久）

### Sentinel 模式

```yaml
spring:
  data:
    redis:
      password: 123456
      timeout: 2000ms
      sentinel:
        master: mymaster
        nodes:
          - sentinel1:26379
          - sentinel2:26379
          - sentinel3:26379
        password: sentinel-password  # Sentinel 本身有密码时配置
```

实现原理：
- Lettuce 连接 Sentinel 节点列表
- 用 SENTINEL get-master-addr-by-name 获取当前 master 地址
- 连接 master 进行读写
- 订阅 +switch-master 频道，主从切换时自动重连

### Cluster 模式

```yaml
spring:
  data:
    redis:
      password: 123456
      timeout: 2000ms
      cluster:
        nodes:
          - node1:6379
          - node2:6379
          - node3:6379
        max-redirects: 3
```

实现原理：
- 初始连接到任意一个节点，发送 CLUSTER SLOTS 获取全部 16384 个槽的分布
- 缓存槽→节点的映射在本地（槽映射表）
- 请求时计算 key 的 CRC16 % 16384 得到槽号
- 查映射表找到目标节点，直接发命令
- 收到 MOVED 重定向时更新映射表并重试
- max-redirects：重试次数上限，超过则抛异常

### 三种模式的关系

- 单机和 Sentinel/Cluster 是互斥的
- Sentinel 和 Cluster 也是互斥的
- 切换只需改配置，代码不用变（都用 RedisTemplate 操作）

---

## 序列化机制

这是 Spring Data Redis 中**最重要的配置决策**。序列化器决定了：
- key/value 在 Redis 中长什么样（debug 时看到的乱码就来自错误的序列化器）
- 序列化性能
- 序列化后的大小
- 不同语言的互操作性

### 四种序列化器对比

**JdkSerializationRedisSerializer（默认）**：
- 格式：Java 原生 ObjectOutputStream
- 可读性：差，Redis 中看到 `\xac\xed\x00\x05t\x00\x04user` 这样的二进制
- 要求：类必须实现 Serializable
- 大小：大（含完整类元信息）
- 跨语言：只有 Java 能反序列化
- 为什么是默认：Spring Boot 团队为了"不用配置就能工作"
- **生产环境绝不推荐**

**Jackson2JsonRedisSerializer**：
- 格式：JSON
- 可读性：好
- 要求：必须指定 class 类型（如 `new Jackson2JsonRedisSerializer<>(User.class)`）
- 如果存多种类型，需要多个 RedisTemplate 实例
- 跨语言：支持

**GenericJackson2JsonRedisSerializer**：
- 格式：JSON + @class 字段
- 可读性：好
- 不要求指定 class，自动存类名（如 `{"@class":"com.example.User","name":"张三"}`）
- 风险：如果类迁移包路径或重命名，旧数据反序列化失败
- 跨语言：可以被读取，但 @class 字段含义只有 Java 懂

**StringRedisSerializer（通用推荐）**：
- 格式：UTF-8 字节数组
- 只负责 String ↔ byte[] 的转换
- key 用这个、value 手动 JSON 序列化/反序列化
- 返回的 String 需要自己用 Jackson/Gson 做序列化
- 跨语言：支持

### 推荐方案

```java
@Bean
public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
    RedisTemplate<String, Object> template = new RedisTemplate<>();
    template.setConnectionFactory(factory);

    // Key 使用 StringRedisSerializer（明文可读）
    template.setKeySerializer(new StringRedisSerializer());
    template.setHashKeySerializer(new StringRedisSerializer());

    // Value 使用 Jackson2JsonRedisSerializer
    Jackson2JsonRedisSerializer<Object> valueSerializer =
        new Jackson2JsonRedisSerializer<>(Object.class);
    template.setValueSerializer(valueSerializer);
    template.setHashValueSerializer(valueSerializer);

    return template;
}
```

---

## RedisTemplate — 五大操作接口

### 架构设计

RedisTemplate 是对 Redis 命令的高级封装，它的执行链路为：

```
opsForValue().get("key")
  → RedisTemplate.execute(connection -> ...)
    → RedisConnection.get(key)
      → 序列化 key (String → byte[])
      → Lettuce 发送 GET 命令
      → 收到响应 byte[]
      → 反序列化 value (byte[] → Object)
```

五大操作接口：

| 接口 | 返回类型 | 主要方法 |
|------|---------|---------|
| opsForValue() | ValueOperations | get/set/increment/decrement/setBit |
| opsForHash() | HashOperations | put/get/delete/entries/increment |
| opsForList() | ListOperations | leftPush/rightPop/range/trim |
| opsForSet() | SetOperations | add/remove/members/intersect/union/diff |
| opsForZSet() | ZSetOperations | add/range/rank/score/count |

### execute vs executePipelined

- execute：单条命令的同步执行，返回一个结果
- executePipelined：批量命令的管道执行，回调中写入多条命令，最后由 Redis 批量执行和返回

---

## StringRedisTemplate

StringRedisTemplate 继承 RedisTemplate<String, String>，
两个 key/value 的序列化器都固定为 StringRedisSerializer。

适用场景：
- 不需要存复杂对象，只存字符串/数字
- 需要自行控制序列化

如果可以就用 StringRedisTemplate，它的行为最可预测。

---

## 连接池调优

### Lettuce 的连接模型

Lettuce 的连接含义与 Jedis 不同：
- Lettuce 默认一个连接就能处理所有并发请求（异步复用）
- Lettuce 启用连接池的意义：多个 Redis 节点、读写分离、或者你想用多个连接分散负载

### commons-pool2 连接池配置

```yaml
spring:
  data:
    redis:
      lettuce:
        pool:
          max-active: 8     # 连接池最大连接数
          max-idle: 8       # 连接池最大空闲连接数
          min-idle: 2       # 连接池最小空闲连接数（始终保留至少 2 个连接待用）
          max-wait: 2000ms  # 获取连接最大等待时间
```

**推荐值计算**：
- max-active：约为数据库连接池大小 × 1~2（比如 20 个 Tomcat 线程 × 1 = 20）
- min-idle = 2（有连接预热效果，避免前几个请求建立连接的延迟）
- max-wait = 2000ms（超过这个时间获取不到连接就抛异常）

---

## 总结

1. **Lettuce 是 Spring Boot 默认和推荐选择**，异步事件驱动，适合高并发
2. **序列化器是第一个必须改的配置**：不要用默认的 JDK 序列化器，用 Jackson JSON
3. **三种连接模式（单机/Sentinel/Cluster）代码不变**，只改配置即可切换
4. **Lettuce 默认不需要连接池**，单连接足够处理所有并发
5. **StringRedisTemplate 是最安全的选择**，序列化行为完全可控
