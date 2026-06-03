# 什么是 AOP ？

AOP（Aspect Oriented Programming）即**面向切面编程**，它是一种编程思想，并不是 Spring 独有的技术，Spring AOP 只是 AOP 的一种实现方式。

AOP 的核心思想是：

> 将程序中的“横切关注点”从核心业务逻辑中分离出来。

所谓横切关注点（Cross-Cutting Concerns），指的是那些在系统中大量重复出现，但又不属于核心业务逻辑的功能，例如日志记录、权限校验、事务管理、性能监控、异常处理、缓存处理等场景。

一个系统中的往往存在多个业务方法都需要记录日志：

```
public void createOrder() {    
	System.out.println("记录日志");    
	// 业务逻辑
}

public void payOrder() {    
	System.out.println("记录日志");    
	// 业务逻辑
}
```

这种方式会导致**大量重复代码** 、**业务代码与非业务代码耦合**以及**后期维护困难** 等问题。而 AOP 可以将这些公共逻辑统一抽离：

```
日志逻辑      -> 切面业务逻辑      -> 核心代码
```

从而实现：

- 降低代码冗余
- 提高可维护性
- 提高模块解耦能力
- 更方便扩展公共功能

---

# Spring AOP

Spring Framework 中的 Spring AOP 是 AOP 思想的一种具体实现。

Spring AOP 基于动态代理机制实现，它会在运行时为目标对象创建代理对象，并在方法执行前后插入额外逻辑，从而实现功能增强。

Spring AOP 底层主要使用以下两种代理方式：

- **JDK 动态代理**  
    Java 官方提供的动态代理实现方式，基于接口进行代理。目标对象必须实现接口。
- **CGLIB 动态代理**  
    一种基于字节码生成的代理技术，通过继承目标类并生成子类的方式实现代理，因此不依赖接口。

Spring 会根据目标对象的情况自动选择代理方式：
```
实现了接口 -> 默认使用 JDK 动态代理  
未实现接口 -> 使用 CGLIB 动态代理
```

---

# Spring AOP 核心概念

## 1. 切面（Aspect）

切面表示对横切关注点的模块化封装，可以简单理解为公共功能逻辑。

在 Spring 中，通常通过 `@Aspect` 注解定义切面：

```
@Aspect
@Component
public class LogAspect {}
```

---

## 2. 连接点（Join Point）

连接点表示程序运行过程中的某个执行点。例如：方法调用、方法执行、异常抛出。

但在 Spring AOP 中：

> Join Point 通常特指“方法执行”。

---

## 3. 切入点（Pointcut）

切入点用于定义：

> “哪些方法需要被增强”。

它本质上是一个匹配规则。

例如：
```
@Pointcut("execution(* com.demo.service.*.*(..))")
```

表示 **com.demo.service 包下所有方法** 都会被切面拦截。

通过切入点表达式匹配连接点的概念是 AOP 的核心，Spring 默认使用 AspectJ 切入点表达式语言。

---

## 4. 通知（Advice）

通知表示：

> 在切入点匹配的方法执行时，具体要执行的增强逻辑。

简单理解为 *”什么时候执行什么逻辑“* ？

例如在方法执行前打印日志，执行后提交事务，异常时记录错误信息等。

---

## 5. 目标对象（Target Object）

目标对象表示：

> 被 AOP 增强的原始对象。

例如：

```
@Service
public class UserService {}
```

由于 Spring AOP 是基于 Spring Bean 进行增强的，因此：

> 任何被 Spring 容器管理的 Bean，都有可能成为目标对象。

因此，上述 `UserService` 在满足切面匹配条件时，就可能被 Spring AOP 增强，从而成为目标对象。

---

## 6. AOP 代理（AOP Proxy）

Spring AOP 不会直接修改原对象，而是：

> 为目标对象生成一个代理对象。

程序实际调用的是代理对象，而不是原始对象。

代理对象会在方法执行前后插入增强逻辑。

---

## 7. 织入（Weaving）

织入表示：

> 将切面应用到目标对象的过程。

织入可以发生在：

- 编译时
- 类加载时
- 运行时

而 Spring AOP 采用的是：

> 运行时织入

---

## 8. 引入（Introduction）

引入用于：

> 在不修改原类代码的情况下，为类动态添加新的方法或接口。

这是 AOP 中较少使用但比较高级的特性。

---

# Spring AOP 通知类型

Spring AOP 中常见的通知类型如下。

---

## 1. 前置通知（Before Advice）

在目标方法执行之前运行。

```
@Before("pointcut()")
```

常用于日志记录、权限校验、参数检查等。

特点：

- 无法阻止目标方法执行
- 除非主动抛出异常

---

## 2. 返回后通知（After Returning Advice）

在目标方法正常返回后执行。

```
@AfterReturning("pointcut()")
```

特点：

- 方法必须正常结束
- 出现异常时不会执行

常用于**返回值处理** 、**成功日志记录** 等场景。

---

## 3. 异常通知（After Throwing Advice）

当目标方法抛出异常时执行。

```
@AfterThrowing("pointcut()")
```

常用于**异常日志记录** 、**异常监控** 、**告警处理** 等场景

---

## 4. 最终通知（After / Finally Advice）

无论方法是否发生异常，都会执行。

```
@After("pointcut()")
```

类似于**finally**，常用于**资源释放**、**清理操作** 。

---

## 5. 环绕通知（Around Advice）

环绕通知是 Spring AOP 中最强大的通知类型。

它可以：

- 在方法前执行逻辑
- 在方法后执行逻辑
- 控制是否执行目标方法
- 修改返回值
- 捕获异常

例如：

```
@Around("pointcut()")
```

它本质上类似：

```
try {    
	// 前置逻辑    
	
	// 方法执行    
	
	// 后置逻辑
} catch() {}
```

大多数复杂的 AOP 功能，底层通常都基于环绕通知实现。

# 参考资料

1. AOP 概念 :: Spring Framework - Spring 框架
	https://docs.springframework.org.cn/spring-framework/reference/core/aop/introduction-defn.html
2. 使用AOP - Java教程 - 廖雪峰的官方网站
	https://liaoxuefeng.com/books/java/spring/aop/index.html
3. 深入理解AOP（面向切面编程）：从基础到高级用法
	https://www.cnblogs.com/forges/p/18750309