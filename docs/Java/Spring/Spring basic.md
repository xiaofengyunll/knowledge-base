# Spring 核心技术指南  
  
> 基于 spring-basic 项目 demo，涵盖 IoC、DI、AOP、Bean 生命周期、事务管理、自动配置六大核心模块。  
  
---  
  
## 1. IoC 容器  
  
### 原理  
  
**Inversion of Control（控制反转）** 是 Spring 框架的基石。在传统编程中，对象自己通过 `new` 创建依赖；在 IoC 中，对象的创建和依赖关系管理被"反转"给了容器。开发者只需描述"我需要什么"，容器负责创建并装配。  
  
Spring IoC 容器本质上是一个 **Bean 工厂**，它：  
- 读取配置元数据（XML / 注解 / Java 代码）  
- 根据元数据创建对象（Bean）  
- 管理 Bean 之间的依赖关系  
- 维护 Bean 的完整生命周期  
  
**核心接口**：`BeanFactory`（基础）和 `ApplicationContext`（高级，增加了国际化、事件发布、AOP 等）。  
  
### 容器创建的三种方式  
  
Spring 经历了三代配置方式，逐步从繁琐走向简洁：  
  
| 方式 | 时代 | 特点 |  
|------|------|------|  
| XML 配置 | Spring 1.x/2.x | 配置与代码分离，但冗长 |  
| 注解 + JavaConfig | Spring 3.x/4.x | 类型安全，IDE 友好 |  
| 编程式注册 | Spring 5.x+ | 极简，无需任何配置文件 |  
  
#### XML 方式（ClassPathXmlApplicationContext）  
  
```java  
// resources/ioc-beans.xml  
// <bean id="xmlGreetingService"  
//       class="cn.cqut.springbasic.ioc.service.GreetingService">  
//     <property name="prefix" value="XML-Bean"/>  
// </bean>  
  
ApplicationContext ctx = new ClassPathXmlApplicationContext("ioc-beans.xml");  
GreetingService service = ctx.getBean("xmlGreetingService", GreetingService.class);  
System.out.println(service.greet("World")); // XML-Bean: World!  
```  
  
Spring 解析 XML 时，使用 `BeanDefinitionParserDelegate` 将 `<bean>` 标签解析为 `BeanDefinition` 对象，再由 `DefaultListableBeanFactory` 基于这些定义创建实例。  
  
#### 注解方式（AnnotationConfigApplicationContext）  
  
```java  
@Configuration  
@ComponentScan("cn.cqut.springbasic.ioc")  
public class IocConfig {  
  
    @Bean  
    public GreetingService greetingService() {  
        GreetingService service = new GreetingService();        service.setPrefix("你好");  
        return service;    }}  
  
ApplicationContext ctx = new AnnotationConfigApplicationContext(IocConfig.class);GreetingService service = ctx.getBean(GreetingService.class);  
System.out.println(service.greet("Spring")); // 你好: Spring!  
```  
  
`@Configuration` 声明的类会被 CGLIB 代理，确保 `@Bean` 方法内即使被多次调用也返回同一个单例实例。  
  
#### 编程式注册（GenericApplicationContext）  
  
```java  
GenericApplicationContext ctx = new GenericApplicationContext();  
ctx.registerBean("greetingService", GreetingService.class,  
        b -> b.getConstructorArgumentValues()              .addGenericArgumentValue("Programmatic"));ctx.refresh();  
  
GreetingService service = ctx.getBean(GreetingService.class);  
System.out.println(service.greet("World")); // Programmatic: World!  
```  
  
`registerBean()` 利用 `Supplier` 和 `BeanDefinitionCustomizer` 直接在容器中注册 Bean，零配置文件。  
  
---  
  
## 2. 依赖注入 (DI)  
  
### 原理  
  
**Dependency Injection（依赖注入）** 是 IoC 的实现方式。容器在创建 Bean 时，自动将其依赖的其他 Bean"注入"进来，而不是让对象自己查找或创建。  
  
Spring 支持三种注入方式：  
  
| 方式 | 推荐度 | 说明 |  
|------|--------|------|  
| 构造器注入 | **强烈推荐** | 不可变，依赖明确，易于测试 |  
| Setter 注入 | 可选 | 适用于可选依赖 |  
| 字段注入 (`@Autowired`) | 不推荐 | 难以测试，隐藏依赖，破坏不可变性 |  
  
### 构造器注入示例  
  
```java  
// 定义接口  
public interface MessageService {  
    String send(String message, String recipient);}  
  
// 实现 1：邮件  
@Service("emailMessageService")  
public class EmailMessageService implements MessageService {  
    @Override    public String send(String message, String recipient) {        return String.format("[Email] 发送给 %s: %s", recipient, message);    }}  
  
// 实现 2：短信  
@Service("smsMessageService")  
public class SmsMessageService implements MessageService {  
    @Override    public String send(String message, String recipient) {        return String.format("[SMS] 发送给 %s: %s", recipient, message);    }}  
```  
  
```java  
// 消费者：构造器注入 + @Qualifier 消除歧义  
@Service  
public class NotificationService {  
  
    private final MessageService messageService;  
    @Value("${app.notification.default-recipient:user@example.com}")    private String defaultRecipient;  
    // 当有多个 MessageService 实现时，@Qualifier 指定具体 Bean    public NotificationService(@Qualifier("emailMessageService") MessageService messageService) {        this.messageService = messageService;    }  
    public String notify(String message) {        return messageService.send(message, defaultRecipient);    }}  
```  
  
### 关键机制  
  
- **`@Qualifier`**：按名称精确指定要注入的 Bean，解决多实现歧义  
- **`@Value`**：注入外部配置属性，支持默认值 (`:default`)  
- **构造器注入的优势**：字段可声明为 `final`，对象创建后依赖不可变；单元测试时可以直接 `new` 传参，无需启动 Spring 容器  
  
---  
  
## 3. 面向切面编程 (AOP)  
  
### 原理  
  
**AOP（Aspect-Oriented Programming）** 将横切关注点（日志、安全、缓存等）从核心业务逻辑中分离出来，提高模块化程度。  
  
Spring AOP 基于 **动态代理**：  
- 如果目标类实现了接口 → 使用 JDK 动态代理  
- 如果目标类没有接口 → 使用 CGLIB 字节码代理  
  
**核心概念**：  
  
```  
┌──────────────────────────────────────┐  
│              Aspect（切面）            ││  ┌─────────────────────────────────┐ │  
│  │   Pointcut（切入点）: 在哪切      │ ││  │   Advice（通知）:  切了做什么     │ ││  │   JoinPoint（连接点）: 可切入的点 │ ││  └─────────────────────────────────┘ │  
└──────────────────────────────────────┘  
```  
  
**通知类型**：  
| 类型 | 注解 | 执行时机 |  
|------|------|----------|  
| 前置通知 | `@Before` | 目标方法执行前 |  
| 后置通知 | `@AfterReturning` | 目标方法正常返回后 |  
| 异常通知 | `@AfterThrowing` | 目标方法抛异常后 |  
| 最终通知 | `@After` | 目标方法执行后（无论是否异常） |  
| 环绕通知 | `@Around` | 包围目标方法，可控制执行 |  
  
### 示例 1：方法执行时间日志（@Around）  
  
```java  
@Aspect  
@Component  
public class LoggingAspect {  
  
    // 切入 UserService 的所有 public 方法  
    @Around("execution(* cn.cqut.springbasic.aop.service.UserService.*(..))")  
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {  
        String methodName = joinPoint.getSignature().getName();        long start = System.currentTimeMillis();  
  
        try {            Object result = joinPoint.proceed(); // 执行目标方法  
            long elapsed = System.currentTimeMillis() - start;  
            System.out.printf("[AOP日志] %s() 耗时 %dms, 返回: %s%n",  
                    methodName, elapsed, result);            return result;        } catch (Exception e) {            System.out.printf("[AOP日志] %s() 异常: %s%n", methodName, e.getMessage());  
            throw e;        }    }}  
```  
  
`ProceedingJoinPoint.proceed()` 是环绕通知的核心——调用它才会执行目标方法，不调用则不执行。  
  
### 示例 2：权限校验（自定义注解 + @Before）  
  
```java  
// 自定义注解  
@Target(ElementType.METHOD)  
@Retention(RetentionPolicy.RUNTIME)  
public @interface RequirePermission {  
    String value(); // 所需权限值  
}  
```  
  
```java  
@Aspect  
@Component  
public class PermissionAspect {  
  
    // 切入所有标注了 @RequirePermission 的方法  
    @Before("@annotation(requirePermission)")  
    public void checkPermission(RequirePermission requirePermission) {  
        String required = requirePermission.value();        String currentUserPermission = "read"; // 模拟当前用户权限  
  
        if (!required.equals(currentUserPermission)) {            throw new SecurityException(                String.format("权限不足: 需要 '%s', 当前 '%s'", required, currentUserPermission));        }        System.out.println("[AOP权限] 权限校验通过: " + required);  
    }}  
```  
  
```java  
// 使用  
@Service  
public class UserService {  
  
    @RequirePermission("read")    public String getUser(Long id) {        return "User-" + id;    }  
    @RequirePermission("write")    public String updateUser(Long id) {        return "Updated-User-" + id;    }}  
```  
  
自定义注解作为切入点标记，配合 AOP 切面，将权限校验逻辑与业务代码完全解耦。  
  
### 示例 3：透明缓存（@Around）  
  
```java  
@Aspect  
@Component  
public class CacheAspect {  
  
    private final Map<String, Object> cache = new ConcurrentHashMap<>();  
    @Around("execution(* cn.cqut.springbasic.aop.service.UserService.get*(..))")  
    public Object checkCache(ProceedingJoinPoint joinPoint) throws Throwable {  
        String key = joinPoint.getSignature().getName() + ":" + joinPoint.getArgs()[0];        if (cache.containsKey(key)) {  
            System.out.println("[AOP缓存] 命中缓存: " + key);  
            return cache.get(key);  
        }        Object result = joinPoint.proceed();        cache.put(key, result);  
        System.out.println("[AOP缓存] 写入缓存: " + key);  
        return result;    }}  
```  
  
不修改任何业务代码，即可为 `get` 开头的方法添加缓存能力。  
  
---  
  
## 4. Bean 生命周期  
  
### 原理  
  
Spring 容器管理 Bean 从创建到销毁的完整过程。理解这个生命周期对于正确处理资源初始化、连接建立、资源释放至关重要。  
  
### 完整生命周期流程  
  
```  
┌─────────────────────────────────────────────────────────┐  
│ 1. 构造方法 (Constructor)                                ││         ↓                                                │  
│ 2. 依赖注入（@Autowired / setter）                        ││         ↓                                                │  
│ 3. BeanPostProcessor.postProcessBeforeInitialization()  │  
│         ↓                                                │  
│ 4. @PostConstruct 方法                                    ││         ↓                                                │  
│ 5. InitializingBean.afterPropertiesSet()                │  
│         ↓                                                │  
│ 6. @Bean(initMethod) 自定义初始化方法                     ││         ↓                                                │  
│ 7. BeanPostProcessor.postProcessAfterInitialization()   │  
│         ↓                                                │  
│ 8. Bean 就绪，提供服务                                    ││         ↓                                                │  
│ 9. @PreDestroy 方法                                       ││         ↓                                                │  
│ 10. DisposableBean.destroy()                            │  
│         ↓                                                │  
│ 11. @Bean(destroyMethod) 自定义销毁方法                   │└─────────────────────────────────────────────────────────┘  
```  
  
### 代码示例  
  
```java  
public class LifecycleBean implements InitializingBean, DisposableBean {  
  
    public LifecycleBean() {        System.out.println("[生命周期] 1. 构造方法");  
    }  
    // ---- 初始化阶段 ----  
    @PostConstruct  // JSR-250 标准注解  
    public void postConstruct() {        System.out.println("[生命周期] 2. @PostConstruct");  
    }  
    @Override  // Spring 接口  
    public void afterPropertiesSet() {        System.out.println("[生命周期] 3. InitializingBean.afterPropertiesSet()");  
    }  
    public void customInit() {        System.out.println("[生命周期] 4. @Bean(initMethod = \"customInit\")");  
    }  
    // ---- 销毁阶段 ----  
    @PreDestroy  // JSR-250 标准注解  
    public void preDestroy() {        System.out.println("[生命周期] 5. @PreDestroy");  
    }  
    @Override  // Spring 接口  
    public void destroy() {        System.out.println("[生命周期] 6. DisposableBean.destroy()");  
    }  
    public void customDestroy() {        System.out.println("[生命周期] 7. @Bean(destroyMethod = \"customDestroy\")");  
    }}  
```  
  
```java  
@Configuration  
public class LifecycleConfig {  
  
    @Bean(initMethod = "customInit", destroyMethod = "customDestroy")  
    public LifecycleBean lifecycleBean() {  
        return new LifecycleBean();    }}  
```  
  
### BeanPostProcessor  
  
`BeanPostProcessor` 可以拦截容器中**所有 Bean** 的初始化：  
  
```java  
@Component  
public class LifecyclePostProcessor implements BeanPostProcessor {  
  
    @Override  
    public Object postProcessBeforeInitialization(Object bean, String beanName) {  
        if (beanName.contains("lifecycle")) {            System.out.println("[后处理器] 初始化前: " + beanName);  
        }        return bean;    }  
    @Override  
    public Object postProcessAfterInitialization(Object bean, String beanName) {  
        if (beanName.contains("lifecycle")) {            System.out.println("[后处理器] 初始化后: " + beanName);  
        }        return bean;    }}  
```  
  
### 关键要点  
  
- **`@PostConstruct` 优先于 `InitializingBean`**：JSR-250 标准注解在 Spring 接口方法之前执行  
- **`@PreDestroy` 优先于 `DisposableBean`**：同理，销毁顺序反之  
- **BeanPostProcessor 作用范围**：默认拦截容器内所有 Bean，需要按 `beanName` 过滤  
- **只对 singleton 作用域完整执行**：prototype Bean 的销毁方法不会被 Spring 调用  
  
---  
  
## 5. 声明式事务管理  
  
### 原理  
  
Spring 事务管理分为 **编程式事务**（手动 begin/commit/rollback）和 **声明式事务**（`@Transactional` 注解）。  
  
**声明式事务的核心机制**：  
1. Spring 为标注了 `@Transactional` 的类创建 AOP 代理  
2. 方法调用被 AOP 拦截  
3. 代理方法通过 `TransactionManager` 开启事务  
4. 执行实际业务方法  
5. 根据执行结果决定 commit 或 rollback  
  
```  
客户端 → 代理对象 → @Around 切面 → TransactionManager.begin()                  → target.方法()  
                  → 成功 → commit()                  → 异常 → rollback()```  
  
**关键属性**：  
  
| 属性 | 说明 | 默认值 |  
|------|------|--------|  
| `propagation` | 事务传播行为 | `REQUIRED`（有则加入，无则新建） |  
| `isolation` | 事务隔离级别 | `DEFAULT`（跟随数据库） |  
| `rollbackFor` | 触发回滚的异常类型 | RuntimeException/Error |  
| `timeout` | 超时时间（秒） | 无限制 |  
| `readOnly` | 只读事务 | false |  
  
**特别注意**：默认只对 RuntimeException 回滚，受检异常（checked exception）不触发回滚。实际项目中通常配置 `rollbackFor = Exception.class`。  
  
### 代码示例  
  
```java  
// 实体类  
public class Account {  
    private Long id;    private String owner;    private Double balance;    // getters/setters...}  
  
// MyBatis Mapper  
@Mapper  
public interface AccountMapper {  
    @Select("SELECT * FROM account WHERE id = #{id}")    Account findById(Long id);  
    @Update("UPDATE account SET balance = balance - #{amount} WHERE id = #{id}")    int debit(@Param("id") Long id, @Param("amount") Double amount);  
    @Update("UPDATE account SET balance = balance + #{amount} WHERE id = #{id}")    int credit(@Param("id") Long id, @Param("amount") Double amount);}  
```  
  
```java  
@Service  
public class TransferService {  
  
    @Autowired  
    private AccountMapper accountMapper;  
  
    // 正常转账 —— 提交事务  
    @Transactional(rollbackFor = Exception.class)  
    public void transfer(Long fromId, Long toId, Double amount) {  
        accountMapper.debit(fromId, amount);  // 扣款  
        accountMapper.credit(toId, amount);   // 入账  
        // 方法正常结束 → 事务自动提交  
    }  
    // 异常转账 —— 回滚事务  
    @Transactional(rollbackFor = Exception.class)  
    public void transferWithException(Long fromId, Long toId, Double amount) {  
        accountMapper.debit(fromId, amount);  
        accountMapper.credit(toId, amount);  
        throw new RuntimeException("转账过程中发生异常，触发回滚！");  
        // 抛出 RuntimeException → 事务自动回滚，扣款和入账都撤销  
    }  
    // 无事务的查询  
    public Account getAccount(Long id) {  
        return accountMapper.findById(id);  
    }}  
```  
  
### 事务验证输出  
  
```  
转账前: Alice = 1000.0, Bob = 500.0  
  
--- 正常转账 100.0 ---转账后: Alice = 900.0, Bob = 600.0   ← 数据一致  
  
--- 异常转账 200.0 ---转账后: Alice = 900.0, Bob = 600.0   ← 回滚成功，数据未变  
```  
  
### 常见陷阱  
  
1. **同类内部调用无效**：同一类中 `this.method()` 不经过代理，`@Transactional` 不生效（需要通过 `@Autowired self` 或拆分类解决）  
2. **非 public 方法无效**：CGLIB 代理只拦截 public 方法  
3. **受检异常不回滚**：必须通过 `rollbackFor` 显式指定  
  
---  
  
## 6. 自动配置  
  
### 原理  
  
**Spring Boot Auto-Configuration** 的核心思想是 **约定优于配置**：根据 classpath 中存在的类、已定义的 Bean、环境属性等条件，自动创建和配置 Bean。  
  
**工作流程**：  
```  
启动  
  ↓@SpringBootApplication → @EnableAutoConfiguration  
  ↓读取 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports  ↓获取所有 @AutoConfiguration 类  
  ↓对每个配置类评估 @Conditional* 条件  
  ↓条件满足 → 创建 Bean条件不满足 → 跳过  
```  
  
**常用条件注解**：  
  
| 注解 | 条件 |  
|------|------|  
| `@ConditionalOnClass` | classpath 中存在指定类 |  
| `@ConditionalOnMissingClass` | classpath 中不存在指定类 |  
| `@ConditionalOnBean` | 容器中存在指定 Bean |  
| `@ConditionalOnMissingBean` | 容器中不存在指定 Bean |  
| `@ConditionalOnProperty` | 配置属性满足指定值 |  
| `@ConditionalOnExpression` | SpEL 表达式为 true |  
  
### 实现自定义 Starter  
  
**第 1 步：配置属性类**  
  
```java  
@ConfigurationProperties(prefix = "greeting")  
public class GreetingProperties {  
    private String prefix = "Hello";  // 默认值  
    private String suffix = "!";      // 默认值  
    // getters/setters...}  
```  
  
`@ConfigurationProperties` 将 `application.yaml` 中的 `greeting.*` 配置自动绑定到这个类的字段。  
  
**第 2 步：自动配置的服务**  
  
```java  
public class GreetingService {  
  
    private final GreetingProperties properties;  
    public GreetingService(GreetingProperties properties) {        this.properties = properties;    }  
    public String greet(String name) {        return properties.getPrefix() + " " + name + properties.getSuffix();    }}  
```  
  
**第 3 步：Auto-Configuration 类**  
  
```java  
@AutoConfiguration  
@EnableConfigurationProperties(GreetingProperties.class)  
@ConditionalOnClass(GreetingService.class)  
public class GreetingAutoConfiguration {  
  
    @Bean  
    @ConditionalOnMissingBean    public GreetingService greetingService(GreetingProperties properties) {  
        return new GreetingService(properties);    }}  
```  
  
关键设计意图：  
- `@ConditionalOnClass`：确保依赖类存在时才触发  
- `@ConditionalOnMissingBean`：如果用户已手动定义同名 Bean，则使用用户的  
- `@EnableConfigurationProperties`：将 Properties 类注册到容器并激活属性绑定  
  
**第 4 步：注册自动配置类**  
  
`resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`：  
```  
cn.cqut.springbasic.autoconfig.GreetingAutoConfiguration  
```  
  
注意：Spring Boot 2.x 使用 `spring.factories` 文件，Spring Boot 3.x/4.x 改为 `AutoConfiguration.imports`。  
  
**第 5 步：外部化配置**  
  
`application-autoconfig.yaml`：  
```yaml  
greeting:  
  prefix: "你好"  
  suffix: "~"  
```  
  
### 运行效果  
  
```  
自动配置模块已启动！  
你好 Spring~        ← prefix + name + suffix```  
  
用户可以通过外部配置文件定制行为，无需修改任何代码。  
  
---  
  
## 总结  
  
| 模块 | 核心思想 | 关键注解/技术 |  
|------|----------|---------------|  
| IoC 容器 | 控制反转，容器管理对象 | `@Configuration`, `@Bean`, `ApplicationContext` |  
| 依赖注入 | 声明式获取依赖 | `@Qualifier`, `@Value`, 构造器注入 |  
| AOP | 横切关注点分离 | `@Aspect`, `@Around`, 自定义注解 |  
| Bean 生命周期 | 容器管理完整生灭过程 | `@PostConstruct`, `BeanPostProcessor`, `@PreDestroy` |  
| 事务管理 | 声明式，AOP 代理 | `@Transactional(rollbackFor)` |  
| 自动配置 | 约定优于配置，按条件装配 | `@AutoConfiguration`, `@ConditionalOnClass` |  
  
Spring 的本质可以概括为：**IoC 容器管理对象 + AOP 横切增强 + 自动配置简化使用**。掌握这六大模块，就掌握了 Spring 框架的核心。