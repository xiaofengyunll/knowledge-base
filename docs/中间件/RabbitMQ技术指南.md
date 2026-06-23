# RabbitMQ 技术指南

> 理论为主，示例为辅。示例代码来自本项目的 Spring Boot 4.1 + Java 21 Demo。

---

## 目录

1. [消息队列概述](#1-消息队列概述)
2. [RabbitMQ 核心架构](#2-rabbitmq-核心架构)
3. [AMQP 协议与消息流转](#3-amqp-协议与消息流转)
4. [Exchange 类型详解](#4-exchange-类型详解)
5. [消息可靠性机制](#5-消息可靠性机制)
6. [消费者策略](#6-消费者策略)
7. [死信队列](#7-死信队列)
8. [重试机制](#8-重试机制)
9. [常见应用模式](#9-常见应用模式)
10. [Spring AMQP 实战示例](#10-spring-amqp-实战示例)
11. [运维与监控](#11-运维与监控)

---

## 1. 消息队列概述

### 1.1 什么是消息队列（MQ）

消息队列是一种**异步通信中间件**，生产者将消息发送到队列，消费者从队列中取出消息进行处理。它在生产者和消费者之间建立了一个缓冲区，使两者可以**独立运行、独立扩展**。

```
┌──────────┐      ┌──────────────┐      ┌──────────┐
│ Producer │ ───→ │  Message Q   │ ───→ │ Consumer │
└──────────┘      └──────────────┘      └──────────┘
```

### 1.2 为什么需要 MQ — 三大核心价值

| 价值 | 说明 | 适用场景 |
|------|------|---------|
| **异步处理** | 发送方无需等待接收方处理完成，立即返回 | 日志上报、通知推送 |
| **系统解耦** | 生产者和消费者互不知道对方存在，各自独立演化 | 微服务间通信、订单下游处理 |
| **削峰填谷** | 突发流量暂存到队列，消费者按自身节奏消费 | 秒杀、流量高峰期缓冲 |

### 1.3 主流 MQ 产品对比

| 特性 | RabbitMQ | Kafka | RocketMQ |
|------|----------|-------|----------|
| 吞吐量 | 万级/秒 | 百万级/秒 | 十万级/秒 |
| 延迟 | 微秒级 | 毫秒级 | 毫秒级 |
| 协议 | AMQP 0-9-1 | 自定义协议 | 自定义协议（类JMS） |
| 消息路由 | 强大灵活（Exchange/Binding） | 简单（Topic分区） | 较丰富（Tag/Selector） |
| 消息可靠性 | 极高（ACK + 持久化 + 事务） | 高（副本机制） | 高（同步刷盘） |
| 适用场景 | 业务消息、RPC调用 | 日志、大数据流 | 电商交易、金融 |

**RabbitMQ 的核心优势：** AMQP 标准协议、灵活的路由模型、完善的消息可靠性保障。

---

## 2. RabbitMQ 核心架构

### 2.1 整体架构

```
┌────────────────────── Broker ──────────────────────┐
│                                                      │
│  ┌────────────────── Virtual Host ─────────────────┐ │
│  │                                                  │ │
│  │  Producer ──→ [Exchange] ──Binding──→ [Queue]   │ │
│  │                      │                      │    │ │
│  │                      │                      ↓    │ │
│  │                      │                  Consumer  │ │
│  │                      │                            │ │
│  │                      └──Binding──→ [Queue] ──→ Consumer │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### Broker（消息代理）
RabbitMQ 服务器本身。接收客户端连接，管理消息的路由和投递。

#### Virtual Host（vhost）
**逻辑隔离单元**。每个 vhost 拥有独立的 Exchange、Queue、Binding 和权限体系。不同应用可以分配不同 vhost，实现资源隔离。

- 默认 vhost：`/`
- 连接时指定：`amqp://user:pass@host:5672/vhost`

#### Connection（连接）
客户端与 Broker 之间的 **TCP 长连接**。创建和销毁成本高，一个应用通常维持一个 Connection。

#### Channel（信道）
建立在 Connection 之上的**轻量级虚拟连接**。一个 Connection 可以创建多个 Channel，Channel 之间相互独立。

**为什么需要 Channel？**
- TCP 连接的创建/销毁成本极高
- 多线程并发时，共享一个 Connection 存在线程安全问题
- Channel 是线程隔离的，每个线程使用独立的 Channel

```
Connection (TCP)
  ├── Channel 1 (producer thread)
  ├── Channel 2 (consumer thread A)
  └── Channel 3 (consumer thread B)
```

#### Exchange（交换机）
接收生产者发送的消息，根据**路由规则**将消息分发到一个或多个队列。

**Exchange 不存储消息**，它只是一个路由表。如果没有任何队列绑定到 Exchange，消息将被**丢弃**（除非配置了 alternate-exchange）。

#### Queue（队列）
**存储消息的缓冲区**。消费者从队列中取出消息进行消费。Queue 是 RabbitMQ 中最核心的消息存储单元。

#### Binding（绑定）
Exchange 和 Queue 之间的**路由规则**。在绑定时指定 `routingKey`，Exchange 根据它决定消息投递到哪个 Queue。

### 2.3 消息流转全过程

```
1. Producer 创建 Connection → 在 Connection 上创建 Channel
2. Producer 通过 Channel 发送消息到 Exchange，携带 routingKey
3. Exchange 根据 routingKey 结合 Binding 规则，决定投递到哪些 Queue
4. 消息在 Queue 中持久化存储（如配置了 durable）
5. Broker 将消息推送给（或等待 Consumer 拉取）监听该 Queue 的 Consumer
6. Consumer 处理完后发送 ACK（确认），Broker 将该消息从 Queue 中删除
```

---

## 3. AMQP 协议与消息流转

### 3.1 AMQP 0-9-1 模型

AMQP（Advanced Message Queuing Protocol）是一套**开放标准**的应用层协议。RabbitMQ 实现了 AMQP 0-9-1。

AMQP 模型的核心三要素：**Exchange、Queue、Binding**。

### 3.2 消息结构

一条 AMQP 消息由以下部分组成：

```
┌─────────────────────────────┐
│         Properties          │  ← 消息属性（元数据）
├─────────────────────────────┤
│         Headers             │  ← 自定义头部
├─────────────────────────────┤
│         Body                │  ← 消息体（字节流）
└─────────────────────────────┘
```

**消息属性（Properties）包括：**

| 属性 | 说明 |
|------|------|
| `content-type` | 内容类型，如 `application/json` |
| `content-encoding` | 编码方式 |
| `delivery-mode` | 投递模式：1=非持久化, 2=持久化 |
| `priority` | 消息优先级（0-9） |
| `correlation-id` | 关联ID，用于RPC模式 |
| `reply-to` | 回复队列，用于RPC模式 |
| `expiration` | 消息过期时间（ms），即 TTL |
| `message-id` | 消息唯一ID |
| `timestamp` | 时间戳 |
| `user-id` | 发送者用户ID |

### 3.3 消息生命周期

```
[Published] → [Routed] → [Queued] → [Delivered] → [Acknowledged/Rejected]
                  ↘                              ↗
               [Dropped]                  [Dead-Lettered]
```

- **Published**：生产者发送消息
- **Routed**：Exchange 匹配到至少一个 Queue
- **Queued**：消息存储在队列中等待消费
- **Delivered**：Broker 将消息投递给消费者
- **Acknowledged**：消费者确认，消息被删除
- **Rejected**：消费者拒绝，进入死信或丢弃
- **Dead-Lettered**：消息因 TTL/队列溢出/被拒绝而进入死信队列

---

## 4. Exchange 类型详解

RabbitMQ 提供四种标准的 Exchange 类型和一种特殊的 Default Exchange。

### 4.1 Direct Exchange（直接交换机）

**精确匹配 routing key。**

```
Exchange: "async.exchange" (type=direct)

  Binding: routingKey="async.routing" → Queue "async.queue"
  Binding: routingKey="task.log"      → Queue "log.queue"

  消息 routingKey="async.routing" → 投递到 async.queue
  消息 routingKey="other"         → 丢弃（无匹配绑定）
```

**适用场景：** 一对一的精确投递，单播通信。

**本项目示例：**

```java
// 声明 DirectExchange
@Bean
public DirectExchange asyncExchange() {
    return new DirectExchange("async.exchange");
}

// 绑定：routingKey 必须完全匹配
@Bean
public Binding asyncBinding(Queue asyncQueue, DirectExchange asyncExchange) {
    return BindingBuilder.bind(asyncQueue).to(asyncExchange).with("async.routing");
}
```

### 4.2 Topic Exchange（主题交换机）

**基于模式的 routing key 匹配。** routing key 使用 `.` 分隔的单词列表，Binding key 支持通配符：

- `*` 匹配**恰好**一个单词
- `#` 匹配**零个或多个**单词

```
Exchange: "order.topic" (type=topic)

  Binding: routingKey="order.sms"   → Queue "sms.queue"
  Binding: routingKey="order.email" → Queue "email.queue"
  Binding: routingKey="order.*"     → Queue "all.order.queue"   (匹配 order.sms、order.email)
  Binding: routingKey="order.#"     → Queue "all.queue"         (匹配 order.*, order.a.b.c...)
```

**适用场景：** 消息多播，按规则将消息路由到不同消费者。如订单系统通知。

**本项目示例：**

```java
@Bean
public TopicExchange orderTopicExchange() {
    return new TopicExchange("order.topic");
}

// smsQueue 只接收 routingKey="order.sms" 的消息
@Bean
public Binding smsBinding(Queue smsQueue, TopicExchange orderTopicExchange) {
    return BindingBuilder.bind(smsQueue).to(orderTopicExchange).with("order.sms");
}

// emailQueue 只接收 routingKey="order.email" 的消息
@Bean
public Binding emailBinding(Queue emailQueue, TopicExchange orderTopicExchange) {
    return BindingBuilder.bind(emailQueue).to(orderTopicExchange).with("order.email");
}
```

### 4.3 Fanout Exchange（广播交换机）

**忽略 routing key，将消息投递到所有绑定的队列。**

```
Exchange: "broadcast.exchange" (type=fanout)

  Binding: → Queue "queue.A"
  Binding: → Queue "queue.B"
  Binding: → Queue "queue.C"

  消息 routingKey="anything" → 投递到 queue.A、queue.B、queue.C（全部）
```

**适用场景：** 广播通知、配置更新推送。所有消费者都收到相同消息。

```java
@Bean
public FanoutExchange fanoutExchange() {
    return new FanoutExchange("broadcast.exchange");
}

// 绑定时不指定 routingKey
@Bean
public Binding fanoutBinding(Queue queue, FanoutExchange exchange) {
    return BindingBuilder.bind(queue).to(exchange);
}
```

### 4.4 Headers Exchange（头部交换机）

**根据消息 Header 属性而非 routing key 进行路由。**

匹配规则由 Header 中的 `x-match` 决定：

- `x-match = all`：所有指定的 header 都必须匹配
- `x-match = any`：至少匹配一个指定的 header

**适用场景：** 复杂的条件路由，不常用。

### 4.5 Default Exchange（默认交换机）

RabbitMQ 内置的**无名交换机**（名称为空字符串 `""`），类型为 Direct。

它的特殊之处在于：**自动为每个 Queue 创建一条 Binding，routing key 就是队列名称。**

```java
// 发送时使用空字符串作为 exchange，队列名作为 routingKey
rabbitTemplate.convertAndSend("", "peak.queue", message);

// 等价于
rabbitTemplate.convertAndSend("peak.queue", message);
```

**本项目中的应用（Demo 3 削峰填谷）：**

```java
// 不声明Exchange，直接向队列名发送（使用默认交换机）
public static final String PEAK_QUEUE = "peak.queue";

// 发送时直接使用队列名作为 routingKey
rabbitTemplate.convertAndSend(RabbitMqConfig.PEAK_QUEUE, message);
```

### 4.6 Exchange 对比总结

| Exchange 类型 | 路由依据 | 匹配方式 | 典型场景 |
|---------------|---------|----------|---------|
| **Direct** | routing key | 精确匹配 | 单播、点对点 |
| **Topic** | routing key 模式 | 通配符匹配 | 多播、按规则路由 |
| **Fanout** | 无 | 全部投递 | 广播 |
| **Headers** | 消息 Header | Header 键值匹配 | 复杂条件路由（少用） |
| **Default** | 队列名称 | 精确匹配 | 简单场景 |

---

## 5. 消息可靠性机制

RabbitMQ 提供多层可靠性保障，从**发送端 → Broker → 消费端**全链路都有对应的机制。

### 5.1 投递端可靠性

#### 事务模式（性能差，不推荐）

```java
channel.txSelect();
try {
    channel.basicPublish(exchange, routingKey, props, body);
    channel.txCommit();
} catch (Exception e) {
    channel.txRollback();
}
```

**缺点：** 每条消息阻塞等待 Broker 确认，吞吐量下降 **250 倍**。

#### Publisher Confirm（推荐）

发送方异步等待 Broker 的确认。这是 RabbitMQ **推荐的生产者可靠性方案**。

**Spring AMQP 中开箱即用：**

```yaml
spring:
  rabbitmq:
    publisher-confirm-type: correlated  # 开启发布确认
    publisher-returns: true             # 监听无法路由的消息
```

工作流程：

```
Producer ──发送消息──→ Broker
                      │
                      ├── 消息成功路由到队列 → 返回 Confirm ACK
                      ├── 消息无队列可投递   → 返回 Confirm NACK
                      └── 消息无队列可投递   → 触发 ReturnCallback
```

Confirm 和 Return 的区别：
- **Confirm**：确认消息是否到达 Broker
- **Return**：消息到达 Broker 但无法路由到任何队列时回调

#### Mandatory 标志

`mandatory=true`：如果消息无法路由到任何队列，Broker 将消息**退回**给生产者（触发 ReturnCallback）。

`mandatory=false`（默认）：无法路由的消息被**静默丢弃**。

```java
// Spring AMQP
rabbitTemplate.setMandatory(true);
rabbitTemplate.setReturnsCallback(returned -> {
    System.out.println("消息被退回: " + returned.getMessage());
});
```

### 5.2 Broker 端可靠性 — 持久化

#### 队列持久化（Durable Queue）

```java
// 队列持久化：Broker 重启后队列依然存在（但不保证其中的消息不丢失）
@Bean
public Queue durableQueue() {
    return QueueBuilder.durable("my.queue").build();
    // 等价于：new Queue("my.queue", true)
}
```

**注意：** 持久化队列 ≠ 消息不丢失。还需要消息本身标记为持久化。

#### 消息持久化（Persistent Message）

```java
// Spring AMQP 中设置 deliveryMode=2 即持久化消息
MessageProperties props = new MessageProperties();
props.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
// 或
rabbitTemplate.convertAndSend(exchange, routingKey, message, msg -> {
    msg.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
    return msg;
});
```

**持久化 = 队列持久化（Durable=true）+ 消息持久化（DeliveryMode=2）**

但注意：持久化消息是先写**内存**再异步刷盘的。要保证最高可靠性，需要配合 **Mirror Queue（镜像队列）**。

### 5.3 消费端可靠性 — ACK 机制

#### 自动确认（Auto ACK）

```java
@RabbitListener(queues = "my.queue")  // 默认 ackMode="AUTO"
public void handle(String message) {
    // 方法正常返回 → 自动 ACK
    // 方法抛异常 → 自动 NACK（可能 requeue）
}
```

**风险：** 消费者在处理消息的过程中崩溃，消息丢失。

#### 手动确认（Manual ACK）

```java
@RabbitListener(queues = "ack.queue", ackMode = "MANUAL")
public void handle(String message, Channel channel,
                   @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
    try {
        // 业务处理...
        channel.basicAck(tag, false);  // 单条确认
    } catch (Exception e) {
        channel.basicNack(tag, false, true);  // 失败，重新入队
    }
}
```

**手动 ACK 的三个操作：**

| 操作 | API | 含义 |
|------|-----|------|
| **basicAck** | `channel.basicAck(tag, multiple)` | 确认消费成功，消息从队列删除 |
| **basicNack** | `channel.basicNack(tag, multiple, requeue)` | 消费失败。requeue=true → 重新入队；requeue=false → 丢弃或进入DLX |
| **basicReject** | `channel.basicReject(tag, requeue)` | 单条拒绝（不支持批量），功能同Nack |

**本项目示例（Demo 4）：**

```java
@RabbitListener(queues = RabbitMqConfig.ACK_QUEUE, ackMode = "MANUAL")
public void handle(String message, Channel channel,
                   @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
    int taskNum = Integer.parseInt(message.replace("Task-", ""));
    if (taskNum % 2 == 0) {
        // 偶数 → 成功确认
        channel.basicAck(tag, false);
    } else {
        // 奇数 → 拒绝且不重新入队
        channel.basicNack(tag, false, false);
    }
}
```

### 5.4 可靠性三角

```
                    Publisher Confirm
                    (发出去了吗？)
                         ↓
              ┌──────────────────────┐
              │       Broker         │
              │  ┌────────────────┐  │
              │  │ Durable Queue  │  │
              │  │  + Persistent  │  │
              │  │    Message     │  │
              │  └────────────────┘  │
              └──────────────────────┘
                         ↓
                    Manual ACK
                    (处理成功了吗？)
```

三条铁律确保消息不丢失：
1. **发送端**：Publisher Confirm + mandatory
2. **Broker**：队列持久化 + 消息持久化
3. **消费端**：手动ACK，处理成功后才确认

---

## 6. 消费者策略

### 6.1 Push vs Pull

RabbitMQ 默认使用 **Push 模式**（Broker 主动推送消息给消费者）。

```
Broker ──Push──→ Consumer (消息一到达队列就推送)
```

### 6.2 Prefetch（QoS — Quality of Service）

**控制推送速率的核心参数**。限制每个消费者**未确认消息的数量**。

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        prefetch: 5  # 每个消费者最多同时持有5条未确认的消息
```

工作原理：

```
Queue: [msg100, msg99, ..., msg1]
                ↓ (prefetch=5)
Consumer 收到: msg1 ~ msg5（开始处理，未ACK）
                ↓ (ACK msg1 后)
Consumer 收到: msg6（始终保持最多5条未ACK）
```

**prefetch 的作用：**

| prefetch 值 | 行为 | 适用场景 |
|-------------|------|---------|
| **1** | 每次只取1条，处理完再取下一条 | 公平调度：谁处理快谁多拿 |
| **大值（如250）** | 大量消息预取到客户端缓存 | 高性能吞吐场景 |
| **0（无限制）** | 消息全部分发，可能导致消费不均 | ❌ 不推荐 |

**prefetch 与削峰：** prefetch 设小值（如5），消费者以固定速度处理，队列中的消息堆积但不丢失，实现削峰填谷。

### 6.3 消费端的并发模型

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        concurrency: 3       # 最少消费者线程数
        max-concurrency: 10  # 最大消费者线程数
```

RabbitMQ 的消费者是**单线程**的（每个 Channel 一个线程）。提高并发 = 增加消费者线程数。

**并发方案对比：**

| 方案 | 说明 | 适用场景 |
|------|------|---------|
| 增加消费者实例 | 水平扩展，启动更多应用 | 微服务架构 |
| 增加并发线程 | `concurrency` 参数 | 单应用内扩展 |
| 批量ACK | `batchSize` + 批量确认 | 高吞吐但允许少量丢失 |

### 6.4 消费幂等性

**消息可能被投递多次**（重试、网络超时、消费者崩溃恢复），消费端必须具备**幂等性**。

常见实现方式：
- 数据库唯一键约束
- Redis 记录已处理的消息ID
- 业务状态机（如：只有"待处理"→"处理中"→"已完成"）

---

## 7. 死信队列

### 7.1 什么情况下消息会变成死信？

消息变成死信（Dead Letter）的三种情况：

| 条件 | 配置方式 |
|------|---------|
| **消息被拒绝**（Nack/Reject 且 requeue=false） | 消费端调用 `basicNack(tag, false, false)` |
| **消息过期（TTL）** | 队列级别 `x-message-ttl` 或消息级别 `expiration` |
| **队列已满** | `x-max-length` 或 `x-max-length-bytes` |

### 7.2 DLX/DLQ 工作原理

```
┌──────────────┐     x-dead-letter-exchange      ┌──────────────┐
│ main.business│ ───────────────────────────────→ │ dead.letter. │
│   .queue     │                                   │  exchange    │
│              │  (消息变成死信时自动路由)            │              │
└──────────────┘                                   └──────┬───────┘
                                                          │
                                                          ↓ (binding)
                                                   ┌──────────────┐
                                                   │ dead.letter. │
                                                   │   .queue     │
                                                   │   (DLQ)      │
                                                   └──────────────┘
                                                        ↑
                                                   DLQ Consumer 监听
                                                   (人工介入/告警)
```

配置步骤：

1. 声明 DLX（死信交换机）和 DLQ（死信队列）
2. 在主队列上通过 `x-dead-letter-exchange` 参数指定 DLX
3. 监听 DLQ 进行告警或人工处理

**本项目示例（Demo 6）：**

```java
// Step 1: 声明 DLX + DLQ + Binding
@Bean
public DirectExchange deadLetterExchange() {
    return new DirectExchange("dead.letter.exchange");
}

@Bean
public Queue deadLetterQueue() {
    return QueueBuilder.durable("dead.letter.queue").build();
}

@Bean
public Binding dlqBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
    return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange)
            .with("dead.letter.routing");
}

// Step 2: 主队列挂载 DLX（核心配置）
@Bean
public Queue mainBusinessQueue() {
    return QueueBuilder.durable("main.business.queue")
            .withArgument("x-dead-letter-exchange", "dead.letter.exchange")
            .withArgument("x-dead-letter-routing-key", "dead.letter.routing")
            .build();
}

// Step 3: 监听 DLQ
@RabbitListener(queues = "dead.letter.queue")
public void handleDeadLetter(String message) {
    // 记录日志、发送告警、人工介入
}
```

### 7.3 死信队列的最佳实践

- **必须有专门监控**：DLQ 有消息 = 有业务异常，应有告警
- **消息头保留原信息**：死信消息会添加 `x-death` header，记录死亡原因、来源队列、死亡次数
- **不要直接丢弃**：从 DLQ 处理后再丢弃，保证可追溯
- **按原因分类**：可以为不同死信原因配置不同的 DLQ

---

## 8. 重试机制

### 8.1 为什么需要重试？

消费端的临时故障（数据库连接超时、网络抖动等）不应直接让消息进入死信。通过重试可以**自动恢复**绝大多数临时异常。

### 8.2 Spring Retry 配置

**本项目示例（Demo 5）：**

```java
@Configuration
public class RetryConfig {

    @Bean
    public RetryTemplate retryTemplate() {
        RetryTemplate template = new RetryTemplate();

        // 重试策略：最多3次重试
        SimpleRetryPolicy retryPolicy = new SimpleRetryPolicy();
        retryPolicy.setMaxAttempts(3);

        // 退避策略：初始500ms，每次乘2（500ms → 1000ms → 2000ms）
        ExponentialBackOffPolicy backOff = new ExponentialBackOffPolicy();
        backOff.setInitialInterval(500);
        backOff.setMultiplier(2.0);

        template.setRetryPolicy(retryPolicy);
        template.setBackOffPolicy(backOff);
        return template;
    }
}
```

### 8.3 重试策略类型

| 策略 | 实现类 | 行为 |
|------|--------|------|
| **固定间隔** | `FixedBackOffPolicy` | 每次等待固定时间后重试 |
| **指数退避** | `ExponentialBackOffPolicy` | 等待时间指数增长：1s → 2s → 4s → 8s |
| **随机退避** | `UniformRandomBackOffPolicy` | 在[min, max]区间随机等待 |
| **永不重试** | `NeverRetryPolicy` | 仅执行1次 |

### 8.4 重试 vs 死信队列的配合

```
消息到达
  ↓
消费者处理
  ├── 成功 → ACK → 完成
  │
  └── 失败 → 第1次重试（500ms后）
                ├── 成功 → ACK → 完成
                └── 失败 → 第2次重试（1s后）
                             ├── 成功 → ACK → 完成
                             └── 失败 → 第3次重试（2s后）
                                           ├── 成功 → ACK → 完成
                                           └── 失败 → Reject(requeue=false) → 进入DLQ
```

**关键原则：**
1. 重试次数不宜过多（3~5次即可）
2. 重试间隔逐步增长（指数退避），避免对下游造成压力
3. 重试耗尽后进入 DLQ，不阻塞队列
4. **确保重试是幂等的**

---

## 9. 常见应用模式

### 9.1 异步处理

**问题：** 同步处理导致接口响应慢，用户体验差。

**方案：** 接到请求后立即返回，将任务发到 MQ 异步处理。

```
同步：  Request → [处理1 → 处理2 → 处理3] → Response  (3秒)
异步：  Request → [入队列] → Response               (50ms)
                    ↓
                 [处理1 → 处理2 → 处理3]（后台异步）
```

**本项目 Demo 1：**

```java
// 发送方：发完立即返回
rabbitTemplate.convertAndSend(ASYNC_EXCHANGE, ASYNC_ROUTING_KEY, message);
System.out.println("Sent! Sender continues immediately...");

// 接收方：异步处理
@RabbitListener(queues = ASYNC_QUEUE)
public void handle(String message) {
    System.out.println("Received: " + message);
    // 耗时处理...
}
```

### 9.2 业务解耦

**问题：** 订单服务直接调用短信服务、邮件服务，强耦合。

**方案：** 订单服务只发消息，下游服务各自订阅。

```
解耦前：
  OrderService ──调用──→ SmsService
               ──调用──→ EmailService
  （SmsService 挂了 → 订单创建失败）

解耦后：
  OrderService ──发消息──→ MQ ──→ SmsService
                                 ──→ EmailService
  （SmsService 挂了 → 邮件照发，短信消息在队列中等恢复）
```

**本项目 Demo 2：**

```java
// 订单服务：只发消息，不关心下游
rabbitTemplate.convertAndSend("order.topic", "order.sms", orderMessage);
rabbitTemplate.convertAndSend("order.topic", "order.email", orderMessage);

// 短信服务：独立监听
@RabbitListener(queues = "order.sms.queue")
public void handleSms(String orderMessage) { ... }

// 邮件服务：独立监听
@RabbitListener(queues = "order.email.queue")
public void handleEmail(String orderMessage) { ... }
```

### 9.3 削峰填谷

**问题：** 瞬时流量高峰可能压垮后端服务（如秒杀、抢购）。

**方案：** MQ 作为缓冲区，消息积压在队列中，消费者按固定速率消费。

```
瞬时10000请求/秒
       ↓
    ┌──────┐
    │  MQ  │  ← 缓冲层（消息堆积在这里）
    └──┬───┘
       ↓ (100请求/秒 匀速消费)
   Consumer
```

**本项目 Demo 3：**

```java
// 消费者：prefetch=5，每条处理间隔200ms（模拟慢处理）
@RabbitListener(queues = "peak.queue")
public void handle(String message) throws InterruptedException {
    Thread.sleep(200);  // 模拟慢消费
    System.out.println("Processed: " + message);
}

// 生产者：快速发送100条
for (int i = 1; i <= 100; i++) {
    rabbitTemplate.convertAndSend("peak.queue", "Message-" + i);
}
// 结果：100条消息在队列中堆积，消费者以每秒5条的速率匀速消费
```

### 9.4 RPC 模式

**问题：** 需要像调用本地方法一样调用远程服务，并获得返回值。

**方案：** 利用 `reply-to` + `correlation-id` 实现请求-响应。

```
Client ──[请求]──→ rpc.queue ──→ Server
  ↑                                  │
  └──[响应]──── reply.queue ─────────┘
```

Spring AMQP 提供了 `AsyncRabbitTemplate` 支持 RPC：

```java
// 发送方（异步等待响应）
AsyncRabbitTemplate.RabbitConverterFuture<String> future =
    asyncRabbitTemplate.convertSendAndReceive(exchange, routingKey, request);

future.whenComplete((response, ex) -> {
    if (ex != null) handleError(ex);
    else processResponse(response);
});
```

---

## 10. Spring AMQP 实战示例

### 10.1 核心依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.retry</groupId>
    <artifactId>spring-retry</artifactId>
</dependency>
```

### 10.2 基础配置

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: admin
    password: admin123
    virtual-host: /
    # 生产者配置
    publisher-confirm-type: correlated
    publisher-returns: true
    # 消费者配置
    listener:
      simple:
        prefetch: 5
        concurrency: 3
        max-concurrency: 10
        acknowledge-mode: auto  # auto / manual / none
```

### 10.3 声明 Queue / Exchange / Binding (RabbitMqConfig.java)

本项目将所有声明集中在 `RabbitMqConfig` 中：

```java
@Configuration
public class RabbitMqConfig {

    // ===== Demo 1: Direct Exchange =====
    public static final String ASYNC_QUEUE = "async.queue";
    public static final String ASYNC_EXCHANGE = "async.exchange";
    public static final String ASYNC_ROUTING_KEY = "async.routing";

    @Bean public Queue asyncQueue() {
        return QueueBuilder.durable(ASYNC_QUEUE).build();
    }
    @Bean public DirectExchange asyncExchange() {
        return new DirectExchange(ASYNC_EXCHANGE);
    }
    @Bean public Binding asyncBinding() {
        return BindingBuilder.bind(asyncQueue()).to(asyncExchange())
                .with(ASYNC_ROUTING_KEY);
    }

    // ===== Demo 2: Topic Exchange =====
    public static final String ORDER_TOPIC_EXCHANGE = "order.topic";
    // ... (SMS Queue, Email Queue, bindings with "order.sms", "order.email")

    // ===== Demo 6: DLX/DLQ =====
    @Bean public Queue mainBusinessQueue() {
        return QueueBuilder.durable(MAIN_QUEUE)
                .withArgument("x-dead-letter-exchange", DLX_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", DLX_ROUTING_KEY)
                .build();
    }
}
```

### 10.4 发送消息（RabbitTemplate）

```java
// 最简单的发送
rabbitTemplate.convertAndSend(exchange, routingKey, payload);

// 发送时设置属性
rabbitTemplate.convertAndSend(exchange, routingKey, payload, msg -> {
    msg.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
    msg.getMessageProperties().setExpiration("10000");   // 10秒TTL
    msg.getMessageProperties().setPriority(5);            // 优先级
    return msg;
});
```

### 10.5 接收消息（@RabbitListener）

```java
// 自动确认 — 最简单
@RabbitListener(queues = "async.queue")
public void handle(String message) { ... }

// 手动确认 — 精细控制
@RabbitListener(queues = "ack.queue", ackMode = "MANUAL")
public void handle(String msg, Channel channel,
                   @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
    channel.basicAck(tag, false);
}

// 直接抛异常进入 DLQ
@RabbitListener(queues = "main.business.queue")
public void handle(String msg) {
    throw new AmqpRejectAndDontRequeueException("Failed: " + msg);
}
```

### 10.6 项目完整运行方式

```bash
# 启动 RabbitMQ（Docker）
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:4.1-management

# 启动 Demo 应用
mvn spring-boot:run

# 观察6个Demo按顺序执行，控制台输出各场景的消息流向
```

---

## 11. 运维与监控

### 11.1 管理界面

RabbitMQ 自带 Web 管理界面（需启用 `rabbitmq_management` 插件）。

- 端口：`15672`
- 功能：查看 Queue/Exchange/Binding、消息速率、消费者状态、Connection/Channel 列表

### 11.2 关键监控指标

| 指标 | 说明 | 告警阈值建议 |
|------|------|-------------|
| **Queue Ready Messages** | 队列中待消费消息数 | > 10000 需关注 |
| **Queue Unacked Messages** | 已投递但未确认的消息 | > prefetch 值异常 |
| **Message Rates** | 入队/出队速率 | 突发下降需排查 |
| **Connection Count** | 连接数 | 接近上限需扩容 |
| **Memory Usage** | Broker 内存占用 | > 80% 触发内存告警 |
| **Disk Usage** | 磁盘占用 | > 80% 触发磁盘告警 |

### 11.3 常见问题排查

| 现象 | 可能原因 | 排查方向 |
|------|---------|----------|
| 消息丢失 | 未持久化或未ACK | 确认队列持久化+消息持久化+手动ACK |
| 消息堆积 | 消费者处理太慢 | 增加消费者实例或优化处理逻辑 |
| 消费重复 | 网络超时重投递 | 消费者做幂等处理 |
| 连接断开 | 网络不稳定或心跳超时 | 检查心跳配置、网络策略 |
| 内存告警 | 消息堆积过大 | 增加消费者或设置TTL/队列长度上限 |

### 11.4 常用 RabbitMQ 管理命令

```bash
# 列出所有队列及消息数
rabbitmqctl list_queues name messages messages_ready messages_unacknowledged

# 列出所有 Exchange
rabbitmqctl list_exchanges name type durable

# 列出所有 Binding
rabbitmqctl list_bindings

# 列出所有连接
rabbitmqctl list_connections name user state

# 清空队列
rabbitmqctl purge_queue <queue_name>

# 查看 vhost 状态
rabbitmqctl list_vhosts name messages
```

---

## 附录

### A. RabbitMQ 常用特殊参数

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `x-message-ttl` | 队列级别消息TTL（毫秒） | `10000` |
| `x-expires` | 队列自动删除时间（毫秒） | `3600000` |
| `x-max-length` | 队列最大消息条数 | `10000` |
| `x-max-length-bytes` | 队列最大容量（字节） | `1073741824` |
| `x-dead-letter-exchange` | 死信交换机 | `"dead.letter.exchange"` |
| `x-dead-letter-routing-key` | 死信路由键 | `"dead.letter.routing"` |
| `x-max-priority` | 队列支持的最大优先级 | `10` |
| `x-queue-mode` | 队列模式：`default`/`lazy` | `"lazy"` |

### B. 参考资料

本指南中的示例代码均来自项目 [rabbitmq-demo](src/main/java/cn/cqut/rqd/)，包含以下 Demo：

| Demo | 目录 | 涉及概念 |
|------|------|---------|
| Demo 1 | `demo01_async` | 异步处理、DirectExchange |
| Demo 2 | `demo02_decoupling` | 业务解耦、TopicExchange |
| Demo 3 | `demo03_peak_shaving` | 削峰填谷、Prefetch、Default Exchange |
| Demo 4 | `demo04_ack` | 手动ACK/NACK |
| Demo 5 | `demo05_retry` | 指数退避重试、RetryTemplate |
| Demo 6 | `demo06_dlq` | 死信队列、DLX、AmqpRejectAndDontRequeueException |
