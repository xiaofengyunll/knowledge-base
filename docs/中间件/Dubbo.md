# 简介

Apache Dubbo 是一款高性能、轻量级的 RPC 服务开发框架，由阿里巴巴开源并捐赠给 Apache 基金会，目前是 Apache 顶级项目。它提供了服务自动注册与发现、负载均衡、集群容错、动态配置等微服务治理能力，帮助开发者从单体架构平滑过渡到分布式微服务架构。

## Dubbo 能做什么？

在分布式系统中，服务之间需要通过网络互相调用。Dubbo 解决了以下核心问题：

- **服务发现**：服务提供者启动后自动注册到注册中心，消费者从注册中心获取服务地址列表，无需硬编码 IP 和端口。
- **远程通信**：屏蔽底层网络细节，让远程调用像本地方法调用一样简单，同时支持多种协议（dubbo、triple、rest、gRPC 等）。
- **负载均衡**：在多个服务提供者之间分摊请求压力，支持随机、轮询、最少活跃调用等多种策略。
- **集群容错**：当某个节点故障时自动切换到其他可用节点，支持 failover、failfast、failsafe 等容错模式。
- **流量管控**：支持服务分组、版本路由、参数路由、限流降级等精细化流量控制。

## Dubbo 3.3.x 核心特性

Dubbo 3.3.x 是目前最新的稳定版本系列，相比 Dubbo 2.x 带来了多项架构性升级：

### Triple X 协议

Triple 协议基于 gRPC 和 HTTP/2，同时支持 Protobuf 和纯 Java POJO 序列化。它统一了东西向（微服务间）和南北向（网关到服务）流量，使得 Dubbo 服务可以直接被浏览器、HTTP 客户端和 gRPC 客户端调用。

### 应用级服务发现

Dubbo 2.x 使用接口级服务发现（每个接口独立注册），在规模增大时会给注册中心带来巨大压力。3.x 默认使用应用级服务发现（以应用为粒度注册），大幅减少注册数据量，是大规模集群的标准模式。

### 三层模型架构

引入 Framework → Application → Module 三层生命周期模型：

```
Framework (全局)
├── Application A (应用)
│   ├── Module A1 (模块)
│   └── Module A2 (模块)
└── Application B (应用)
    └── Module B1 (模块)
```

这个模型让同一个 JVM 内可以运行多个独立的 Dubbo 应用或模块，实现多应用共享部署和模块级资源隔离。

### Spring Boot 3.x 完整兼容

Dubbo 3.3.x 完全兼容 Spring Boot 3.x 和 JDK 17/21，通过 `dubbo-spring-boot-starter` 实现零 XML 自动配置。

### 单端口双协议

3.3.0 起支持同一端口同时发布 dubbo 和 triple 协议，通过 `ext-protocol` 和 `preferred-protocol` 配置实现协议的无感升级。

---

# 核心概念

在深入配置之前，先了解 Dubbo 的几个核心角色：

| 角色 | 说明 |
|------|------|
| **Provider** | 服务提供者，暴露服务的应用 |
| **Consumer** | 服务消费者，调用远程服务的应用 |
| **Registry** | 注册中心，负责服务地址的注册与发现（Nacos、Zookeeper 等） |
| **Monitor** | 监控中心，统计服务调用次数和耗时 |
| **Container** | 服务运行容器 |

一次典型的 RPC 调用流程：

```
Consumer → Registry(订阅) → Provider(通知) → Consumer(调用) → Provider(返回)
                                                                  ↓
                                                           Monitor(上报)
```

1. Provider 启动后，向 Registry 注册自己提供的服务
2. Consumer 启动后，向 Registry 订阅所需的服务
3. Registry 将 Provider 地址列表推送给 Consumer
4. Consumer 基于负载均衡策略选择一个 Provider 发起远程调用
5. 调用统计信息异步上报至 Monitor

---

# 配置项介绍

Dubbo 3.3.x 支持多种配置方式：Spring Boot 的 `application.yml`、JVM `-D` 参数、环境变量、外部 `dubbo.properties` 文件以及 API 编程配置。以下以 `application.yml` 为示例，按组件分类介绍核心配置项。

> 以下配置项均基于 Dubbo 3.3.x 官方文档，以 `dubbo.application.*`、`dubbo.registry.*` 等 Spring Boot 前缀格式书写。

## 配置优先级

Dubbo 支持多种配置来源，优先级从高到低：

1. **JVM 参数（-D）** — `-Ddubbo.application.name=demo`
2. **环境变量** — `DUBBO_APPLICATION_NAME=demo`
3. **外部配置**（如 Nacos/Apollo 配置中心）
4. **Spring Environment** 中的 `dubbo.*` 属性（`application.yml` 等）
5. **注解/API/XML 编程配置**
6. **classpath 下的 `dubbo.properties`**

## 配置覆盖规则

在 3.3.x 中需要注意：如果定义了多个相同类型的配置组件（如多个 registry），标签名相同的属性会互相覆盖。例如：

```yaml
dubbo:
  registry:
    address: nacos://localhost:8848
  registries:
    hz:
      address: nacos://10.0.0.1:8848
      group: hangzhou
```

这里 `registries.hz` 的 `group: hangzhou` 可能会覆盖到默认 registry 上。**建议始终使用带 ID 的 `registries` / `protocols` 写法，避免与顶层单数形式混用。**

## dubbo.application

应用基础配置，定义当前应用的身份标识和全局行为。

```yaml
dubbo:
  application:
    name: user-service                    # 应用名称（必填）
    version: 1.0.0                        # 应用版本
    owner: team-platform                  # 应用负责人
    organization: platform-department     # 所属部门/BU
    environment: production               # 环境标识：dev/test/production
    logger: slf4j                         # 日志框架
    register-consumer: true               # 纯消费者是否注册到注册中心
    register-mode: all                    # 注册模式：all/instance/interface
    metadata-type: local                  # 元数据类型：local（默认）/remote
    compiler: javassist                   # 动态代理编译器：javassist/jdk
    shutwait: 3000                        # 优雅关闭等待时间（ms）
    qos-enable: true                      # 是否启用 QoS 运维命令
    qos-port: 22222                       # QoS 监听端口
    qos-accept-foreign-ip: false          # 是否允许外部 IP 连接 QoS
```

### 注册模式 register-mode

这是 Dubbo 3.x 的重要配置：

| 值 | 行为 |
|----|------|
| `all` | 同时注册接口级和应用级服务发现（默认，兼容过渡） |
| `instance` | 仅应用级服务发现（3.x 推荐，大规模集群首选） |
| `interface` | 仅接口级服务发现（与 2.x 兼容） |

从 2.x 升级时，可先使用 `all`，业务验证通过后切换到 `instance`。

### QoS 配置

QoS（Quality of Service）是 Dubbo 的在线运维命令通道，通过 telnet 连接后可以执行 `ls`、`online`、`offline` 等命令：

```bash
telnet localhost 22222
> ls          # 列出所有服务
> online      # 手动上线服务
> offline     # 手动下线服务
```

生产环境建议 `qos-accept-foreign-ip: false`，仅允许本机访问。

## dubbo.registry

注册中心配置，决定服务如何注册与被发现。

```yaml
dubbo:
  registry:
    address: nacos://localhost:8848       # 注册中心地址（必填）
    protocol: nacos                       # 注册中心协议：nacos/zookeeper/consul/etcd
    username: admin                       # 认证用户名（Nacos 开启鉴权时需要）
    password: admin123                    # 认证密码
    timeout: 5000                         # 注册中心请求超时（ms）
    session: 60000                        # 会话超时（ms，Zookeeper 有效）
    check: true                           # 启动时是否检查注册中心可用
    register: true                        # 是否向此注册中心注册服务
    subscribe: true                       # 是否从此注册中心订阅服务
    group: dubbo                          # 注册中心分组（Nacos 多环境隔离）
    cluster: default                      # 注册中心集群标识
    simplified: true                      # 是否简化注册 URL（减少数据量）
```

### 支持的注册中心

| 注册中心 | address 格式 | 适用场景 |
|----------|-------------|----------|
| Nacos | `nacos://host:8848` | 推荐，支持配置中心一体化 |
| Zookeeper | `zookeeper://host:2181` | 经典选型，生态成熟 |
| Consul | `consul://host:8500` | 适合已有 Consul 基础设施的团队 |
| Etcd | `etcd://host:2379` | Kubernetes 环境常用 |
| Redis | `redis://host:6379` | 轻量场景，不建议大规模使用 |

### 多注册中心

Dubbo 3.3.x 支持同时注册到多个注册中心：

```yaml
dubbo:
  registries:
    hz:                                   # ID 为 hz
      address: nacos://nacos-hz:8848
      group: hangzhou
    sh:                                   # ID 为 sh
      address: nacos://nacos-sh:8848
      group: shanghai
```

在 `@DubboService` 或 `@DubboReference` 中通过 `registry` 属性指定：

```java
@DubboService(registry = {"hz", "sh"})    // 同时注册到两个中心
@DubboReference(registry = "hz")          // 仅从 hz 订阅
```

## dubbo.protocol

协议配置，定义服务以什么协议暴露和通信。

```yaml
dubbo:
  protocol:
    name: tri                             # 协议名称（必填）
    port: 20880                           # 监听端口，-1 表示自动分配
    host: 192.168.1.100                   # 监听 IP（多网卡时指定）
    serialization: hessian2               # 序列化方式
    threads: 200                          # 业务线程池大小
    core-threads: 20                      # 核心线程数
    queues: 0                             # 线程池队列长度，0 表示同步队列
    payload: 8388608                      # 请求/响应最大字节数（默认 8MB）
    heartbeat: 10000                      # 心跳间隔（ms）
    accesslog: true                       # 开启访问日志
    ssl-enabled: false                    # 是否启用 SSL/TLS
    iothreads: 1                          # IO 线程数（Netty）
    accepts: 0                            # 最大连接数，0 表示不限制
    buffer: 8192                          # 网络缓冲区大小
    charset: UTF-8                        # 字符编码
    dispatcher: all                       # 消息派发方式：all/direct/message/execution/connection
    server: netty                         # 服务端实现：netty（默认）
    client: netty                         # 客户端实现：netty（默认）
```

### 协议选择

| 协议 | 适用场景 |
|------|----------|
| **triple**（推荐） | Dubbo 3.x 首选，基于 HTTP/2，支持流式调用和浏览器直连 |
| **dubbo** | Dubbo 2.x 经典协议，TCP 长连接 + 二进制传输，内部 RPC 最常用 |
| **rest** | RESTful HTTP 接口，适合对外暴露 API |
| **gRPC** | 基于 HTTP/2 + Protobuf，适合与 gRPC 生态融合 |

### Triple 协议调优

```yaml
dubbo:
  protocol:
    name: tri
  rpc:
    tri:
      max-concurrent-streams: 256         # 最大并发流数
      max-frame-size: 1048576             # 最大帧大小
      initial-window-size: 1048576        # 初始流量控制窗口
      header-table-size: 4096             # HPACK 头部表大小
      enable-push: false                  # 是否启用服务端推送
```

### 单端口双协议（3.3.0+）

在服务迁移期间，允许同一端口同时服务 dubbo 和 triple 协议的调用方：

```yaml
dubbo:
  protocol:
    name: dubbo                           # 主协议
    port: 20880
    ext-protocol: tri                     # 扩展协议，同时发布 triple
    preferred-protocol: tri               # 优先使用 triple，consumer 3.3+ 自动识别
```

这样旧的 dubbo 协议消费者不受影响，而新的 triple 消费者可以自动选择 triple 协议通信，实现平滑升级。

## dubbo.provider

提供者端默认配置，对当前应用暴露的所有服务生效。

```yaml
dubbo:
  provider:
    timeout: 3000                         # 远程调用超时时间（ms），默认 1000
    retries: 2                            # 重试次数（不含第一次），默认 2
    loadbalance: random                   # 负载均衡策略：random/roundrobin/leastactive/consistenthash
    cluster: failover                     # 集群容错模式
    actives: 0                            # 每服务方法最大并发调用数，0 不限制
    executes: 0                           # 每服务方法最大并行执行数，0 不限制
    connections: 0                        # 连接数限制，0 表示共享长连接
    delay: 0                              # 延迟注册时间（ms），用于等待 Spring 初始化
    weight: 100                           # 权重（负载均衡使用）
    dynamic: true                         # 是否动态注册（true 允许动态上下线）
    accesslog: true                       # 开启访问日志
    serialization: hessian2               # 序列化方式
    filter: token,exception               # 过滤器链（逗号分隔）
    async: false                          # 是否默认异步执行
    token: false                          # 令牌验证（true 或自定义 token 字符串）
    version: 1.0.0                        # 服务版本号
    group: default                        # 服务分组
    protocol: dubbo                       # 协议名称
```

### 集群容错模式

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| `failover` | 失败自动切换（默认） | 读操作首选 |
| `failfast` | 快速失败，立即报错 | 非幂等写操作 |
| `failsafe` | 失败忽略，记录日志 | 非关键旁路逻辑 |
| `failback` | 失败后定时重试 | 必须成功的异步通知 |
| `forking` | 并行调用多个节点，返回最快结果 | 低延迟要求 |
| `broadcast` | 广播调用所有节点 | 通知类场景 |
| `available` | 遍历可用节点调用 | 简单容错 |
| `mergeable` | 合并多个节点返回结果 | 聚合查询 |

### 负载均衡策略

| 策略 | 说明 |
|------|------|
| `random` | 随机（默认），按权重随机选择 |
| `roundrobin` | 轮询，按权重循环分配 |
| `leastactive` | 最少活跃调用数，请求优先发到当前处理请求最少的节点 |
| `consistenthash` | 一致性 Hash，相同参数总是路由到同一节点 |

### 重要：provider 配置的 timeout 默认值陷阱

`dubbo.provider.timeout` 默认值是 **1000ms（1秒）**。如果服务方法执行时间超过 1 秒，会触发超时异常。生产环境中很多查询或批处理耗时可能超过 1 秒，建议根据实际业务显式设置 timeout：

```yaml
dubbo:
  provider:
    timeout: 5000    # 调整为 5 秒
```

也可在方法级别单独配置：

```java
@DubboService(timeout = 10000)  // 该服务 10 秒超时
```

## dubbo.consumer

消费者端默认配置，对当前应用引用的所有服务生效。

```yaml
dubbo:
  consumer:
    timeout: 3000                         # 远程调用超时（ms）
    retries: 0                            # 重试次数（写操作建议设为 0）
    loadbalance: random                   # 负载均衡策略
    cluster: failover                     # 集群容错模式
    check: false                          # 启动时是否检查提供者存在（建议 false）
    init: false                           # 是否在启动时就初始化服务引用
    lazy: false                           # 是否懒加载连接
    connections: 1                        # 连接数
    actives: 0                            # 每服务方法最大并发调用数
    version: 1.0.0                        # 目标服务版本号
    group: default                        # 目标服务分组
    generic: false                        # 是否泛化调用
    async: false                          # 是否异步调用
    validation: false                     # 是否开启参数校验
    filter: ""                            # 过滤器链
    mesh-enable: false                    # 是否启用 Mesh 模式（3.1.0+）
```

### 关键配置建议

1. **check: false** — Dubbo 默认启动时检查服务提供者是否存在。在微服务环境下，服务启动顺序不确定，建议设为 false 避免启动时因依赖服务未就绪而启动失败。
2. **写操作的 retries 设为 0** — 默认重试 2 次可能导致重复写入，对于非幂等的插入/更新操作务必关闭重试。
3. **timeout 要配** — consumer 端 timeout 优先级高于 provider 端，建议两端协调配置。

## dubbo.config-center

配置中心配置。Dubbo 3.x 支持将各类配置（应用配置、流量路由规则、降级规则等）托管到外部配置中心实现动态推送。

```yaml
dubbo:
  config-center:
    address: nacos://localhost:8848       # 配置中心地址
    protocol: nacos                       # 协议
    namespace: dubbo                      # 命名空间（多租户隔离）
    group: dubbo                          # 分组
    username: admin
    password: admin123
    timeout: 30000                        # 请求超时（ms）
    check: true                           # 启动时检查配置中心可用
```

配置中心与注册中心可以共用同一个 Nacos 实例，只需将 `dubbo.registry` 和 `dubbo.config-center` 指向同一地址。

## dubbo.metadata-report

元数据中心配置。当 `metadata-type` 设为 `remote` 时，服务的元数据（方法签名、参数类型等）会上报到元数据中心而非注册中心，进一步减轻注册中心压力。

```yaml
dubbo:
  metadata-report:
    address: nacos://localhost:8848
    protocol: nacos
    timeout: 10000
    cycle-report: true                    # 是否周期上报
    retry-times: 3                        # 上报失败重试次数
    retry-period: 3000                    # 重试间隔（ms）
```

## dubbo.metrics

监控指标配置，支持 Prometheus 导出和 Pushgateway 推送。

```yaml
dubbo:
  metrics:
    prometheus:
      exporter:
        enabled: true                     # 启用 Prometheus HTTP 端点
        enable-http-service-discovery: false
      pushgateway:
        enabled: false                    # 定时推送到 Pushgateway
        base-url: http://pushgateway:9091
        job: dubbo-metrics
        push-interval: 30
```

启用后可通过 `http://host:port/metrics` 访问 Prometheus 格式的指标数据。

## dubbo.tracing

链路追踪配置（3.3.x 新增），内置支持 OTLP 和 Zipkin 导出。

```yaml
dubbo:
  tracing:
    enabled: true
    sampling:
      probability: 0.1                    # 采样率 10%
    propagation:
      type: W3C                           # 上下文传播标准：W3C/B3
    baggage:
      enabled: true
    tracing-exporter:
      otlp-config:
        endpoint: http://otel-collector:4317
        compression-method: gzip
        timeout: 10s
    # 或者使用 Zipkin
    # tracing-exporter:
    #   zipkin-config:
    #     endpoint: http://zipkin:9411/api/v2/spans
```

---

# 使用示例

以下是一个完整的 Dubbo 3.3.x + Spring Boot 3.x 示例，包含 Provider 和 Consumer 两端。

## 项目结构

```
dubbo-demo/
├── dubbo-demo-api/          # 公共 API 模块（服务接口定义）
│   └── DemoService.java
├── dubbo-demo-provider/     # 服务提供者
│   ├── DemoServiceImpl.java
│   ├── ProviderApplication.java
│   └── resources/application.yml
└── dubbo-demo-consumer/     # 服务消费者
    ├── ConsumerApplication.java
    └── resources/application.yml
```

## 环境准备

- JDK 17+
- Nacos Server 2.x（或 Zookeeper 3.8+）
- Spring Boot 3.2+

## Maven 依赖

首先通过 BOM 统一管理 Dubbo 版本：

```xml
<!-- 父 pom.xml -->
<properties>
    <dubbo.version>3.3.0</dubbo.version>
    <spring-boot.version>3.2.5</spring-boot.version>
</properties>

<dependencyManagement>
    <dependencies>
        <!-- Dubbo BOM -->
        <dependency>
            <groupId>org.apache.dubbo</groupId>
            <artifactId>dubbo-bom</artifactId>
            <version>${dubbo.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <!-- Spring Boot BOM -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>${spring-boot.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

公共 API 模块：

```xml
<!-- dubbo-demo-api/pom.xml -->
<dependencies>
    <!-- 仅需接口定义，无需 Dubbo 依赖 -->
</dependencies>
```

Provider 和 Consumer 模块：

```xml
<dependencies>
    <!-- Dubbo Spring Boot Starter -->
    <dependency>
        <groupId>org.apache.dubbo</groupId>
        <artifactId>dubbo-spring-boot-starter</artifactId>
    </dependency>
    <!-- Nacos 注册中心 Starter -->
    <dependency>
        <groupId>org.apache.dubbo</groupId>
        <artifactId>dubbo-nacos-spring-boot-starter</artifactId>
    </dependency>
    <!-- Spring Boot Starter -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter</artifactId>
    </dependency>
</dependencies>
```

## 公共 API

定义服务接口，这是 Provider 和 Consumer 之间的契约：

```java
// dubbo-demo-api/src/main/java/com/example/demo/DemoService.java
package com.example.demo;

public interface DemoService {

    String sayHello(String name);

    UserInfo getUserInfo(Long userId);
}
```

```java
// dubbo-demo-api/src/main/java/com/example/demo/UserInfo.java
package com.example.demo;

import java.io.Serializable;

public class UserInfo implements Serializable {
    private Long id;
    private String name;
    private Integer age;

    // getters and setters...
}
```

## Provider 服务提供者

### application.yml

```yaml
# dubbo-demo-provider/src/main/resources/application.yml
spring:
  application:
    name: dubbo-demo-provider

dubbo:
  application:
    name: dubbo-demo-provider
    logger: slf4j
    qos-enable: true
    qos-port: 22222
    qos-accept-foreign-ip: false
  protocol:
    name: tri                           # 使用 Triple 协议
    port: 20880
  registry:
    address: nacos://127.0.0.1:8848
    username: nacos
    password: nacos
  provider:
    timeout: 5000
    retries: 2
    loadbalance: random
```

### 服务实现

```java
// dubbo-demo-provider/src/main/java/com/example/demo/impl/DemoServiceImpl.java
package com.example.demo.impl;

import com.example.demo.DemoService;
import com.example.demo.UserInfo;
import org.apache.dubbo.config.annotation.DubboService;

@DubboService(version = "1.0.0", group = "prod")
public class DemoServiceImpl implements DemoService {

    @Override
    public String sayHello(String name) {
        return "Hello, " + name + "!";
    }

    @Override
    public UserInfo getUserInfo(Long userId) {
        // 模拟数据库查询
        UserInfo user = new UserInfo();
        user.setId(userId);
        user.setName("User-" + userId);
        user.setAge(25);
        return user;
    }
}
```

### 启动类

```java
// dubbo-demo-provider/src/main/java/com/example/demo/ProviderApplication.java
package com.example.demo;

import org.apache.dubbo.config.spring.context.annotation.EnableDubbo;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@EnableDubbo
public class ProviderApplication {
    public static void main(String[] args) {
        SpringApplication.run(ProviderApplication.class, args);
    }
}
```

## Consumer 服务消费者

### application.yml

```yaml
# dubbo-demo-consumer/src/main/resources/application.yml
spring:
  application:
    name: dubbo-demo-consumer

dubbo:
  application:
    name: dubbo-demo-consumer
    logger: slf4j
  registry:
    address: nacos://127.0.0.1:8848
    username: nacos
    password: nacos
  consumer:
    timeout: 5000
    retries: 0                          # 写操作建议禁重试
    check: false                        # 不检查提供者是否存在
```

### 服务调用

```java
// dubbo-demo-consumer/src/main/java/com/example/demo/ConsumerApplication.java
package com.example.demo;

import org.apache.dubbo.config.annotation.DubboReference;
import org.apache.dubbo.config.spring.context.annotation.EnableDubbo;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Component;

@SpringBootApplication
@EnableDubbo
public class ConsumerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConsumerApplication.class, args);
    }
}

@Component
class DemoClient implements CommandLineRunner {

    @DubboReference(version = "1.0.0", group = "prod")
    private DemoService demoService;

    @Override
    public void run(String... args) {
        String greeting = demoService.sayHello("World");
        System.out.println(greeting);

        UserInfo user = demoService.getUserInfo(1001L);
        System.out.println("User: " + user.getName() + ", Age: " + user.getAge());
    }
}
```

## 启动验证

1. 启动 Nacos Server（默认 `localhost:8848`，用户名/密码 `nacos/nacos`）
2. 先启动 Provider，查看日志确认注册成功
3. 再启动 Consumer，观察调用输出

```bash
# 检查注册中心中是否有 dubbo-demo-provider
curl http://localhost:8848/nacos/v1/ns/service/list

# 通过 QoS 查看 Provider 暴露的服务
telnet localhost 22222
> ls
# 输出: com.example.demo.DemoService:1.0.0:prod
```

## 高级用法示例

### 异步调用

```java
// 在 @DubboReference 中启用异步
@DubboReference(version = "1.0.0")
private DemoService demoService;

public void asyncCall() {
    // 先发起调用
    String result = demoService.sayHello("Async");
    // 获取异步 Future
    CompletableFuture<String> future = RpcContext.getServiceContext().getCompletableFuture();
    // 异步等待结果
    future.thenAccept(r -> System.out.println("Async result: " + r));
}
```

### 泛化调用

无需依赖服务接口即可调用，适合网关或测试工具场景：

```java
@Component
class GenericClient {
    private GenericService genericService;

    public GenericClient(ApplicationModel applicationModel) {
        ReferenceConfig<GenericService> reference = new ReferenceConfig<>();
        reference.setInterface("com.example.demo.DemoService");
        reference.setVersion("1.0.0");
        reference.setGeneric("true");
        this.genericService = reference.get();
    }

    public Object callSayHello(String name) {
        return genericService.$invoke("sayHello",
                new String[]{"java.lang.String"},
                new Object[]{name});
    }
}
```

### 本地存根（Stub）

在 Consumer 端对远程调用做预处理和降级：

```java
// Stub 类必须实现同一接口，且有一个接收接口代理的构造方法
public class DemoServiceStub implements DemoService {
    private final DemoService demoService;

    public DemoServiceStub(DemoService demoService) {
        this.demoService = demoService;
    }

    @Override
    public String sayHello(String name) {
        if (name == null || name.isEmpty()) {
            return "Name cannot be empty";    // 本地逻辑，不发起远程调用
        }
        try {
            return demoService.sayHello(name);
        } catch (Exception e) {
            return "Service unavailable";     // 降级返回
        }
    }
}

// 引用时关联 Stub
@DubboReference(version = "1.0.0", stub = "com.example.demo.stub.DemoServiceStub")
private DemoService demoService;
```

---

# 常见问题与注意事项

## 配置层面的坑

**1. timeout 默认 1 秒太短**

这是最常见的问题。`dubbo.provider.timeout` 默认 1000ms，稍重一点的查询就会超时。务必根据业务 SLA 设置合理值。

**2. 写操作重试导致的重复写入**

`retries` 默认值是 2（共调用 3 次）。对于非幂等的写操作（插入、更新），一次超时不代表请求未到达服务端，重试可能造成重复数据。这种情况应设置 `retries: 0`：

```java
@DubboReference(version = "1.0.0", retries = 0)  // 写操作禁用重试
```

**3. 启动时 Provider 不存在**

`dubbo.consumer.check` 默认 `true`，启动时会检查依赖的 Provider 是否可用。在微服务环境下启动顺序不确定，建议设为 `false`。

**4. 序列化兼容性问题**

Dubbo 3.x 默认使用 hessian2 序列化。如果 Provider 和 Consumer 使用不同版本或不同的序列化配置，会出现 `SerializationException`。确保两端版本一致，必要时显式指定：

```java
@DubboService(serialization = "hessian2")    // Provider
@DubboReference(serialization = "hessian2")  // Consumer
```

**5. 线程池耗尽**

默认业务线程池为 200 个线程，队列长度为 0（SynchronousQueue）。如果所有线程都在处理慢请求，新请求会直接被拒绝抛出 `RejectedExecutionException`。监控线程池状态，必要时扩容：

```yaml
dubbo:
  provider:
    threads: 500
    queues: 100                           # 增加缓冲队列
```

## 从 Dubbo 2.x 升级 3.3.x 的关键点

1. **注解改名**：`@Service` → `@DubboService`，`@Reference` → `@DubboReference`
2. **注册模式切换**：建议分阶段操作，先 `register-mode: all`，稳定后切到 `instance`
3. **协议升级**：利用 `ext-protocol: tri` + `preferred-protocol: tri` 实现无感迁移到 Triple
4. **JDK 升级**：Dubbo 3.3.x 需要 JDK 17+，Spring Boot 3.x
5. **元数据中心**：如果 `metadata-type` 设为 `remote`，务必先部署元数据中心

---

> **参考来源**：[Apache Dubbo 3.3 官方文档](https://cn.dubbo.apache.org/zh-cn/overview/mannual/java-sdk/reference-manual/config/) | [Spring Boot 开发指南](https://cn.dubbo.apache.org/zh-cn/overview/mannual/java-sdk/tasks/develop/springboot/) | [配置项参考手册](https://cn.dubbo.apache.org/zh-cn/overview/mannual/java-sdk/reference-manual/config/properties/)
