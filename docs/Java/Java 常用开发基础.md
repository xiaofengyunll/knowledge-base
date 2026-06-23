# Java 常用开发基础

> 系统性学习 Java 核心基础：面向对象、异常、泛型、多线程、集合、IO、反射、注解等。

---

# 1. 面向对象编程思想

## 1.1 三大（四）基本特征

面向对象编程（OOP）的核心思想是 **将数据和操作数据的方法封装在一起，以对象为基本单位来构建程序**。

### 封装（Encapsulation）

**将数据（字段）和操作数据的方法绑定在一起，隐藏内部实现细节，只暴露有限的接口。**

```java
public class BankAccount {
    private String accountNumber;   // 私有字段，外部不可直接访问
    private double balance;

    public BankAccount(String accountNumber) {
        this.accountNumber = accountNumber;
        this.balance = 0;
    }

    // 通过公共方法控制访问
    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("金额必须大于 0");
        this.balance += amount;
    }

    public void withdraw(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("金额必须大于 0");
        if (amount > this.balance) throw new IllegalStateException("余额不足");
        this.balance -= amount;
    }

    public double getBalance() {
        return this.balance;
    }

    // 账号只能读取，不可修改
    public String getAccountNumber() {
        return this.accountNumber;
    }
}
```

**封装的好处**：
- 保护数据完整性（通过方法校验）
- 降低耦合（调用者不依赖内部实现）
- 易于维护（修改内部实现不影响外部）

**访问修饰符**：

| 修饰符 | 同类 | 同包 | 子类 | 全局 |
|--------|------|------|------|------|
| `private` | ✓ | | | |
| `default`（缺省） | ✓ | ✓ | | |
| `protected` | ✓ | ✓ | ✓ | |
| `public` | ✓ | ✓ | ✓ | ✓ |

### 继承（Inheritance）

**子类继承父类的属性和方法，实现代码复用，建立"is-a"关系。**

```java
// 父类
public class Animal {
    protected String name;

    public Animal(String name) {
        this.name = name;
    }

    public void eat() {
        System.out.println(name + " 正在进食");
    }
}

// 子类
public class Dog extends Animal {
    public Dog(String name) {
        super(name);  // 调用父类构造器
    }

    @Override
    public void eat() {
        System.out.println(name + " 正在啃骨头");  // 重写父类方法
    }

    public void bark() {
        System.out.println(name + " 汪汪叫");
    }
}
```

**关键规则**：
- Java **单继承**：一个类只能有一个直接父类（`extends` 一个类）
- 子类通过 `super` 关键字访问父类成员
- 构造器不被继承，但子类构造器必须调用父类构造器（隐式或显式 `super()`）
- `@Override` 注解确保方法正确重写

### 多态（Polymorphism）

**同一个行为在不同对象上表现出不同形式。编译时看左边，运行时看右边。**

```java
// 编译时类型 = 父类，运行时类型 = 子类
Animal animal = new Dog("旺财");

animal.eat();  // 输出: 旺财 正在啃骨头  → 调用的是 Dog 的 eat()

// animal.bark();  // 编译错误！编译时只能看到 Animal 的方法
```

**多态的三个必要条件**：
1. 继承关系（`extends` 或 `implements`）
2. 方法重写（`@Override`）
3. 父类引用指向子类对象（向上转型）

```java
// 多态的典型应用
public class Zoo {
    public void feed(Animal animal) {  // 接收 Animal，实际传入任意子类
        animal.eat();                   // 运行时多态，调用实际类型的方法
    }
}

zoo.feed(new Dog("大黄"));   // 大黄 正在啃骨头
zoo.feed(new Cat("小花"));   // 小花 正在吃鱼
```

**重载 vs 重写**：

| | 重载（Overload） | 重写（Override） |
|---|---|---|
| 发生位置 | 同一类中 | 父子类之间 |
| 方法签名 | 方法名相同，**参数不同** | 方法名相同，**参数相同** |
| 返回值 | 可以不同 | 相同或其子类（协变） |
| 访问修饰符 | 可以任意 | 不能比父类更严格 |
| 多态类型 | 编译时多态 | 运行时多态 |

### 抽象（Abstraction）

**只暴露必要信息，隐藏不相关的细节。通过抽象类和接口实现。**

## 1.2 接口与抽象类

### 抽象类

**不能实例化的类，用于被子类继承，可以包含抽象方法和具体方法。**

```java
public abstract class Shape {
    protected String color;

    public Shape(String color) {
        this.color = color;
    }

    // 抽象方法：子类必须实现
    public abstract double area();

    // 具体方法：子类可直接使用
    public void display() {
        System.out.println("这是一个 " + color + " 的图形，面积 = " + area());
    }
}

public class Circle extends Shape {
    private double radius;

    public Circle(String color, double radius) {
        super(color);
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }
}
```

### 接口

**定义行为规范，一个类可以实现多个接口，实现"like-a"关系。**

```java
// 接口定义行为契约
public interface Flyable {
    void fly();  // 默认 public abstract
}

public interface Swimmable {
    void swim();
}

// 一个类可以实现多个接口
public class Duck implements Flyable, Swimmable {
    @Override
    public void fly() {
        System.out.println("鸭子飞起来了");
    }

    @Override
    public void swim() {
        System.out.println("鸭子在水里游");
    }
}
```

### 接口的现代特性（Java 8+）

```java
public interface Modern {
    // 抽象方法（默认 public abstract）
    void doSomething();

    // 默认方法（Java 8+）—— 提供默认实现，子类可重写
    default void log(String msg) {
        System.out.println("[LOG] " + msg);
    }

    // 静态方法（Java 8+）—— 属于接口，通过接口名调用
    static int add(int a, int b) {
        return a + b;
    }

    // 私有方法（Java 9+）—— 供默认方法复用
    private String format(String msg) {
        return "[Modern] " + msg;
    }
}
```

### 抽象类 vs 接口

| 维度 | 抽象类 | 接口 |
|------|--------|------|
| 继承 | 单继承 (`extends`) | 多实现 (`implements`) |
| 关键字 | `abstract class` | `interface` |
| 构造器 | 可以有 | 不能有 |
| 成员变量 | 可以有实例变量 | 只能有 `public static final` 常量 |
| 方法 | 可以有抽象+具体方法 | 抽象方法 + `default`/`static` 方法 |
| 访问修饰符 | 任意 | 方法默认 `public` |
| 语义 | "is-a" 关系 | "can-do / like-a" 契约 |
| 设计场景 | 有共同父类、共享状态时 | 定义跨层级的通用行为时 |

---

## 1.3 SOLID 设计原则

| 原则 | 说明 | 核心思想 |
|------|------|----------|
| **S**RP 单一职责 | 一个类只负责一件事 | "只有一个原因引起变化" |
| **O**CP 开闭原则 | 对扩展开放，对修改关闭 | 新增功能应加新代码，不改旧代码 |
| **L**SP 里氏替换 | 子类可以替换父类使用 | 子类不应破坏父类的行为契约 |
| **I**SP 接口隔离 | 不应强迫类实现不需要的接口 | 大接口拆分为多个小接口 |
| **D**IP 依赖倒置 | 依赖抽象而非具体实现 | 高层模块不应依赖低层实现 |

```java
// DIP 示例：依赖接口而非具体类
// 坏的做法
public class NotificationService {
    private EmailSender sender = new EmailSender();  // 紧耦合
}
// 好的做法
public class NotificationService {
    private final MessageSender sender;  // 依赖接口

    public NotificationService(MessageSender sender) {
        this.sender = sender;             // 构造器注入
    }
}
```

---

# 2. 异常处理

## 2.1 Java 异常体系

```
                    Throwable
                   /         \
              Error           Exception
         (不可恢复)          /          \
                   RuntimeException     checked Exception
                    (非受检异常)         (受检异常)
```

- **Error**：JVM 内部错误，程序无法处理（如 `OutOfMemoryError`、`StackOverflowError`）
- **Exception**：程序可以捕获和处理
  - **RuntimeException（非受检异常）**：编译时不强制处理（如 `NullPointerException`、`IndexOutOfBoundsException`）
  - **受检异常（checked）**：编译时强制 try-catch 或 throws（如 `IOException`、`SQLException`）

## 2.2 异常处理机制

### try-catch-finally

```java
public String readFile(String path) {
    BufferedReader reader = null;
    try {
        reader = new BufferedReader(new FileReader(path));
        return reader.readLine();
    } catch (FileNotFoundException e) {
        System.err.println("文件未找到: " + path);
        return null;
    } catch (IOException e) {
        System.err.println("读取失败: " + e.getMessage());
        return null;
    } finally {
        // 无论是否异常，都会执行（除非 System.exit(0)）
        try {
            if (reader != null) reader.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

### try-with-resources（Java 7+）

```java
// 实现了 AutoCloseable 接口的资源会自动关闭
public String readFile(String path) {
    try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
        return reader.readLine();
    } catch (IOException e) {
        System.err.println("读取失败: " + e.getMessage());
        return null;
    }
    // reader 自动关闭，无需 finally
}
```

### 多异常捕获（Java 7+）

```java
try {
    // ...
} catch (IOException | SQLException e) {  // 多异常使用 | 分隔
    System.err.println("IO或数据库异常: " + e.getMessage());
}
```

### throw vs throws

| 关键字 | 位置 | 作用 |
|--------|------|------|
| `throw` | 方法体内 | 手动抛出一个异常对象 |
| `throws` | 方法签名上 | 声明该方法可能抛出的异常 |

```java
// throws: 声明异常，交给调用者处理
public void transfer(Account from, Account to, double amount) throws InsufficientBalanceException {
    if (from.getBalance() < amount) {
        // throw: 手动抛出异常
        throw new InsufficientBalanceException("余额不足: " + from.getBalance());
    }
    from.debit(amount);
    to.credit(amount);
}
```

## 2.3 自定义异常

```java
// 业务异常：继承 RuntimeException（非受检，推荐）
public class InsufficientBalanceException extends RuntimeException {
    public InsufficientBalanceException(String message) {
        super(message);
    }
}

// 或继承 Exception（受检异常，强制处理）
public class BusinessException extends Exception {
    private final String errorCode;

    public BusinessException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
```

## 2.4 最佳实践

1. **不要吞掉异常**：`catch (Exception e) {}` 是灾难
2. **尽早抛出，延迟捕获**：底层抛具体异常，顶层统一捕获处理
3. **使用非受检异常**：现代 Java 偏向 RuntimeException，配合全局异常处理器
4. **异常链**：抛出新异常时保留原始异常 `new MyException("msg", originalException)`
5. **finally 中不 return/throw**：会覆盖 try 块中的返回值和异常

```java
// 异常链最佳实践
try {
    // ...
} catch (SQLException e) {
    throw new BusinessException("ERR_DB", "数据库操作失败", e);  // 保留根因
}
```

---

# 3. 泛型

## 3.1 为什么需要泛型

泛型（Generic）的核心目标：**在编译时进行类型检查，避免运行时的 ClassCastException**。

```java
// 无泛型时代（Java 1.4 以前）
List list = new ArrayList();
list.add("hello");
list.add(123);        // 可以添加任意类型
String s = (String) list.get(0);  // 强制转型，运行时可能出错

// 有泛型后（Java 5+）
List<String> list = new ArrayList<>();
list.add("hello");
// list.add(123);      // 编译错误！类型安全
String s = list.get(0);  // 无需转型
```

## 3.2 泛型类、接口、方法

### 泛型类

```java
// T = Type, E = Element, K = Key, V = Value（命名约定）
public class Box<T> {
    private T content;

    public void put(T content) {
        this.content = content;
    }

    public T get() {
        return content;
    }
}

Box<String> stringBox = new Box<>();
stringBox.put("Hello");
String s = stringBox.get();  // 无需转型
```

### 泛型接口

```java
public interface Repository<T, ID> {
    T findById(ID id);
    void save(T entity);
}

public class UserRepository implements Repository<User, Long> {
    @Override
    public User findById(Long id) { /* ... */ }

    @Override
    public void save(User entity) { /* ... */ }
}
```

### 泛型方法

```java
public class Utils {
    // 泛型方法：在返回值前声明类型参数
    public static <T> T firstOrNull(List<T> list) {
        return list.isEmpty() ? null : list.get(0);
    }

    // 多个类型参数
    public static <K, V> Map<K, V> singletonMap(K key, V value) {
        Map<K, V> map = new HashMap<>();
        map.put(key, value);
        return map;
    }
}

// 调用时编译器自动推断类型
String first = Utils.firstOrNull(Arrays.asList("a", "b", "c"));
```

## 3.3 类型擦除

**Java 泛型通过"类型擦除"实现**：编译后泛型信息被擦除，替换为原始类型（Object 或上界）。

```java
// 源码
List<String> list1 = new ArrayList<>();
List<Integer> list2 = new ArrayList<>();

// 编译后（字节码层面）
List list1 = new ArrayList();
List list2 = new ArrayList();

// 两者的 Class 是同一个
System.out.println(list1.getClass() == list2.getClass());  // true
```

**类型擦除的影响**：
- 无法用 `instanceof` 检查泛型类型 → `list instanceof List<String>` 编译错误
- 无法创建泛型数组 → `new T[10]` 编译错误
- 静态字段不能使用泛型类型参数
- 无法重载参数化类型相同的方法

```java
// 绕过泛型擦除的坑
public class GenericClass<T> {
    // 不能这样写（编译错误）
    // T[] array = new T[10];

    // 正确的做法：通过反射或传入 Class
    public T[] createArray(Class<T> clazz, int size) {
        return (T[]) java.lang.reflect.Array.newInstance(clazz, size);
    }
}
```

## 3.4 通配符与边界

### 上界通配符 `? extends T`（生产者）

**只能读取，不能写入**（除了 null）。适用于从结构中读取数据的场景。

```java
// 可以接收 List<Number> 或 List<Integer> 或 List<Double>
public double sum(List<? extends Number> numbers) {
    double total = 0;
    for (Number n : numbers) {  // 可以安全地向上转型读取
        total += n.doubleValue();
    }
    // numbers.add(123);  // 编译错误！无法写入
    return total;
}

List<Integer> intList = Arrays.asList(1, 2, 3);
List<Double> doubleList = Arrays.asList(1.5, 2.5, 3.5);
System.out.println(sum(intList));    // 6.0
System.out.println(sum(doubleList)); // 7.5
```

### 下界通配符 `? super T`（消费者）

**只能写入，读取时返回 Object**。适用于向结构中写入数据的场景。

```java
// 可以向 List<Integer>、List<Number>、List<Object> 写入 Integer
public void addNumbers(List<? super Integer> list) {
    list.add(1);
    list.add(2);
    list.add(3);

    // Integer first = list.get(0);  // 编译错误！读取只能得到 Object
    Object obj = list.get(0);        // 只能当作 Object 读取
}
```

### PECS 原则（Producer Extends, Consumer Super）

```java
// 使用 PECS 原则设计通用方法
public class Collections {
    // src 是生产者 → extends；dest 是消费者 → super
    public static <T> void copy(List<? super T> dest, List<? extends T> src) {
        for (int i = 0; i < src.size(); i++) {
            dest.set(i, src.get(i));  // 从 src 读，往 dest 写
        }
    }
}
```

### 无界通配符 `?`

适用于不关心类型、只使用 Object 方法的场景。

```java
// 检查列表是否包含 null
public static boolean containsNull(List<?> list) {
    for (Object obj : list) {
        if (obj == null) return true;
    }
    return false;
}
```

---

# 4. 多线程与并发

## 4.1 线程的创建方式

### 方式一：继承 Thread 类

```java
public class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println(Thread.currentThread().getName() + " 正在执行");
    }
}

MyThread t = new MyThread();
t.start();  // 启动线程（调用 run 只是普通方法调用！）
```

### 方式二：实现 Runnable 接口（推荐）

```java
public class MyTask implements Runnable {
    @Override
    public void run() {
        System.out.println(Thread.currentThread().getName() + " 正在执行");
    }
}

Thread t = new Thread(new MyTask());
t.start();
```

### 方式三：实现 Callable + Future（有返回值）

```java
public class MyCallable implements Callable<String> {
    @Override
    public String call() throws Exception {
        Thread.sleep(1000);
        return "任务完成";
    }
}

// 通过 FutureTask 获取返回值
FutureTask<String> futureTask = new FutureTask<>(new MyCallable());
new Thread(futureTask).start();
String result = futureTask.get();  // 阻塞等待结果
```

### Runnable vs Callable

| | Runnable | Callable |
|---|---|---|
| 返回值 | 无 (`void`) | 有（泛型） |
| 异常 | 不能抛出受检异常 | 可以抛出受检异常 |
| 方法 | `run()` | `call()` |

## 4.2 线程生命周期

```
        NEW（新建）
          │ start()
          ↓
       RUNNABLE（可运行）
     ┌────────┼─────────┐
     │ 获取锁/CPU调度     │
     ↓                   ↓
BLOCKED（阻塞）     RUNNING（运行中）
WAITING（等待）         │
TIMED_WAITING          ↓
     │               TERMINATED（终止）
     └──────────────────┘
```

## 4.3 线程安全与同步

### 问题：竞态条件

```java
public class Counter {
    private int count = 0;

    // 非线程安全！count++ 不是原子操作（读-改-写）
    public void increment() {
        count++;
    }
}
```

### synchronized 关键字

```java
public class SafeCounter {
    private int count = 0;

    // 同步方法：同一时刻只有一个线程可以执行
    public synchronized void increment() {
        count++;
    }

    // 同步代码块：更细粒度的控制
    public void decrement() {
        synchronized (this) {
            count--;
        }
    }

    public synchronized int getCount() {
        return count;
    }
}
```

**synchronized 的三种锁对象**：
- 实例方法 → 锁是 `this`（当前实例）
- 静态方法 → 锁是 `类.class`（Class 对象）
- 同步代码块 → 指定任意对象作为锁

### volatile 关键字

```java
public class FlagExample {
    // volatile 保证可见性：一个线程修改后，其他线程立即可见
    private volatile boolean flag = false;

    public void setFlag() {
        flag = true;  // 写入主内存
    }

    public void waitForFlag() {
        while (!flag) {  // 每次从主内存读取
            // 等待...
        }
    }
}
```

### synchronized vs volatile

| | synchronized | volatile |
|---|---|---|
| 原子性 | 保证 | 不保证 |
| 可见性 | 保证 | 保证 |
| 有序性 | 保证 | 部分保证（禁止指令重排） |
| 性能 | 较重 | 较轻 |
| 适用场景 | 复合操作 | 标志位、状态标记 |

### Lock 接口（java.util.concurrent.locks）

```java
public class LockCounter {
    private int count = 0;
    private final Lock lock = new ReentrantLock();

    public void increment() {
        lock.lock();
        try {
            count++;
        } finally {
            lock.unlock();  // 必须在 finally 中释放
        }
    }
}
```

## 4.4 线程池

**为什么用线程池**：线程创建/销毁开销大，线程池复用线程，控制并发数。

### Executor 框架

```java
// 核心线程池类型
// 1. 固定大小线程池
ExecutorService fixedPool = Executors.newFixedThreadPool(5);

// 2. 缓存线程池（动态伸缩）
ExecutorService cachedPool = Executors.newCachedThreadPool();

// 3. 单线程池（顺序执行）
ExecutorService singlePool = Executors.newSingleThreadExecutor();

// 4. 定时任务线程池
ScheduledExecutorService scheduledPool = Executors.newScheduledThreadPool(3);
```

### 推荐使用 ThreadPoolExecutor（阿里巴巴规范）

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    5,                              // corePoolSize：核心线程数
    10,                             // maximumPoolSize：最大线程数
    60L, TimeUnit.SECONDS,          // keepAliveTime：空闲线程存活时间
    new LinkedBlockingQueue<>(100), // workQueue：任务队列
    new ThreadPoolExecutor.CallerRunsPolicy() // 拒绝策略
);

// 提交任务
executor.execute(() -> { /* 无返回值 */ });

Future<String> future = executor.submit(() -> {
    // 有返回值的任务
    return "result";
});
String result = future.get();  // 阻塞等待结果
```

**线程池工作流程**：
```
提交任务
  ↓
核心线程未满？ → 创建核心线程执行
  ↓ 已满
任务队列未满？ → 放入队列等待
  ↓ 已满
最大线程未满？ → 创建临时线程执行
  ↓ 已满
执行拒绝策略
```

**四种拒绝策略**：

| 策略 | 行为 |
|------|------|
| `AbortPolicy`（默认） | 抛出 RejectedExecutionException |
| `CallerRunsPolicy` | 由调用者线程执行 |
| `DiscardPolicy` | 直接丢弃新任务 |
| `DiscardOldestPolicy` | 丢弃队列中最旧的任务 |

## 4.5 并发工具类（JUC）

### CountDownLatch（倒计数门闩）

```java
// 等待 N 个线程都完成后再继续
CountDownLatch latch = new CountDownLatch(3);

for (int i = 0; i < 3; i++) {
    new Thread(() -> {
        // 干活...
        latch.countDown();  // 计数 -1
    }).start();
}

latch.await();  // 阻塞直到计数为 0
System.out.println("所有线程已完成");
```

### CyclicBarrier（循环屏障）

```java
// 所有线程到达屏障后才一起继续执行
CyclicBarrier barrier = new CyclicBarrier(3, () -> {
    System.out.println("所有线程到达，执行回调");
});

for (int i = 0; i < 3; i++) {
    new Thread(() -> {
        // 部分工作
        barrier.await();  // 等待其他线程
        // 继续后续工作
    }).start();
}
```

### Semaphore（信号量）

```java
// 限流：同时最多允许 3 个线程访问
Semaphore semaphore = new Semaphore(3);

for (int i = 0; i < 10; i++) {
    new Thread(() -> {
        try {
            semaphore.acquire();  // 获取许可
            // 访问受限资源...
        } finally {
            semaphore.release();  // 释放许可
        }
    }).start();
}
```

### ConcurrentHashMap

```java
// 线程安全的 HashMap，高并发下性能优于 Hashtable
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.put("key", 1);
map.putIfAbsent("key", 2);  // 不存在才放入（原子操作）

// JDK 8 的计算方法（原子操作）
map.compute("counter", (k, v) -> v == null ? 1 : v + 1);
```

### ThreadLocal

```java
// 每个线程拥有独立的变量副本，线程隔离
public class RequestContext {
    private static final ThreadLocal<String> currentUser = new ThreadLocal<>();

    public static void setUser(String user) {
        currentUser.set(user);
    }

    public static String getUser() {
        return currentUser.get();
    }

    // 必须调用 remove 防止内存泄漏！
    public static void clear() {
        currentUser.remove();
    }
}
```

---

# 5. 集合框架

## 5.1 集合框架概览

```
                    Collection
                   /          \
              List              Set                Queue/Deque
              ├ ArrayList       ├ HashSet             ├ LinkedList
              ├ LinkedList      ├ LinkedHashSet       ├ PriorityQueue
              └ Vector          └ TreeSet             └ ArrayDeque
              (有序可重复)        (无序不可重复)           (队列/双端队列)

                          Map
                          ├ HashMap
                          ├ LinkedHashMap
                          ├ TreeMap
                          └ Hashtable / ConcurrentHashMap
                          (键值对, 键不可重复)
```

## 5.2 List

| 实现类 | 底层结构 | 特点 | 适用场景 |
|--------|----------|------|----------|
| `ArrayList` | 数组 | 查改快，增删慢（需移动元素） | 频繁随机访问 |
| `LinkedList` | 双向链表 | 增删快，查改慢 | 频繁插入删除 |
| `Vector` | 数组 | 线程安全（synchronized） | 已过时，用 CopyOnWriteArrayList 替代 |

```java
List<String> list = new ArrayList<>();
list.add("A");
list.add("B");
list.add(1, "C");    // 指定位置插入
list.get(0);         // 按索引访问
list.remove("A");    // 按元素删除
list.remove(0);      // 按索引删除
list.contains("B");  // 是否包含

// 遍历方式
for (String s : list) { }               // for-each
list.forEach(s -> System.out.println(s)); // Lambda
list.stream().filter(s -> s.startsWith("A")); // Stream
```

### ArrayList 扩容机制

初始容量 10（或指定），每次扩容为原来的 **1.5 倍**（`oldCapacity + oldCapacity >> 1`）。频繁扩容影响性能，预估大小时使用 `new ArrayList<>(expectedSize)`。

## 5.3 Set

| 实现类 | 底层 | 特点 |
|--------|------|------|
| `HashSet` | HashMap | 无序，O(1) 增删查 |
| `LinkedHashSet` | LinkedHashMap | 按插入顺序，O(1) |
| `TreeSet` | TreeMap（红黑树） | 按自然排序或比较器排序，O(log n) |

```java
Set<String> set = new HashSet<>();
set.add("apple");
set.add("apple");  // 重复元素不会被添加
set.contains("apple");  // true

// TreeSet 自定义排序
Set<User> users = new TreeSet<>(Comparator.comparing(User::getAge));
```

## 5.4 Map

| 实现类 | 底层 | 特点 |
|--------|------|------|
| `HashMap` | 数组+链表+红黑树 | 无序，O(1)，允许 null 键值 |
| `LinkedHashMap` | HashMap+双向链表 | 按插入顺序或访问顺序 |
| `TreeMap` | 红黑树 | 按 key 排序，O(log n) |
| `Hashtable` | 数组+链表 | 线程安全（synchronized），不允许 null |

```java
Map<String, Integer> map = new HashMap<>();
map.put("one", 1);
map.get("one");              // 返回 1
map.getOrDefault("two", 0);  // 不存在返回默认值 0
map.containsKey("one");      // 是否包含键

// 遍历方式
map.forEach((k, v) -> System.out.println(k + " = " + v));

for (Map.Entry<String, Integer> entry : map.entrySet()) {
    System.out.println(entry.getKey() + " = " + entry.getValue());
}
```

### HashMap 原理

**JDK 1.8 结构**：数组 + 链表 + 红黑树

- 通过 `key.hashCode()` 计算哈希值
- 哈希冲突时用**链表**存储，JDK 1.8 中链表长度 ≥ 8 且数组长度 ≥ 64 时转为红黑树
- 默认初始容量 16，负载因子 0.75
- 扩容时重哈希（rehash）

**为什么重写 equals 必须重写 hashCode**：
- `hashCode` 用于定位桶位置，`equals` 用于对比元素
- `hashCode` 不等 → 两个对象一定不相等（不相遇）
- `hashCode` 相等 → 两个对象可能相等，用 `equals` 确认

## 5.5 排序与比较

### Comparable（自然排序）

```java
public class Student implements Comparable<Student> {
    private String name;
    private int score;

    @Override
    public int compareTo(Student other) {
        return Integer.compare(this.score, other.score);  // 按分数升序
    }
}

Collections.sort(students);  // 自动使用 compareTo
```

### Comparator（自定义排序）

```java
// 按名字排序
students.sort(Comparator.comparing(Student::getName));

// 先按分数降序，再按名字升序
students.sort(Comparator.comparing(Student::getScore).reversed()
                         .thenComparing(Student::getName));
```

---

# 6. IO 与 NIO

## 6.1 IO 分类

```
Java IO
├── 字节流（以 Stream 结尾）
│   ├── InputStream (抽象基类)
│   │   ├── FileInputStream
│   │   ├── BufferedInputStream
│   │   └── ObjectInputStream
│   └── OutputStream (抽象基类)
│       ├── FileOutputStream
│       ├── BufferedOutputStream
│       └── ObjectOutputStream
│
├── 字符流（以 Reader/Writer 结尾）
│   ├── Reader
│   │   ├── FileReader → 用 InputStreamReader + FileInputStream 替代
│   │   ├── BufferedReader
│   │   └── InputStreamReader（字节→字符 桥接）
│   └── Writer
│       ├── FileWriter
│       ├── BufferedWriter
│       └── OutputStreamWriter
```

## 6.2 字节流

```java
// 文件复制（字节流）
public void copyFile(String src, String dest) {
    try (FileInputStream fis = new FileInputStream(src);
         FileOutputStream fos = new FileOutputStream(dest)) {

        byte[] buffer = new byte[8192];  // 8KB 缓冲区
        int bytesRead;
        while ((bytesRead = fis.read(buffer)) != -1) {
            fos.write(buffer, 0, bytesRead);
        }
    } catch (IOException e) {
        e.printStackTrace();
    }
}
```

## 6.3 字符流

```java
// 读取文本文件（按行）
public List<String> readLines(String path) {
    List<String> lines = new ArrayList<>();
    try (BufferedReader reader = new BufferedReader(
             new InputStreamReader(new FileInputStream(path), StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
            lines.add(line);
        }
    } catch (IOException e) {
        e.printStackTrace();
    }
    return lines;
}

// 写入文本文件
public void writeLines(String path, List<String> lines) {
    try (BufferedWriter writer = new BufferedWriter(
             new OutputStreamWriter(new FileOutputStream(path), StandardCharsets.UTF_8))) {
        for (String line : lines) {
            writer.write(line);
            writer.newLine();
        }
    } catch (IOException e) {
        e.printStackTrace();
    }
}
```

**为什么不用 FileReader/FileWriter**：它们使用系统默认编码，跨平台时可能乱码。始终显式指定 `StandardCharsets.UTF_8`。

## 6.4 序列化

```java
// 实现 Serializable 接口标记可序列化
public class User implements Serializable {
    private static final long serialVersionUID = 1L;  // 版本控制

    private String name;
    private transient String password;  // transient 字段不参与序列化

    // 构造器、getter/setter...
}

// 序列化到文件
try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("user.obj"))) {
    oos.writeObject(new User("张三", "123456"));
}

// 从文件反序列化
try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream("user.obj"))) {
    User user = (User) ois.readObject();
    System.out.println(user.getName());  // "张三"
    System.out.println(user.getPassword());  // null（transient 不被序列化）
}
```

## 6.5 NIO 核心概念

NIO（New IO / Non-blocking IO）面向**缓冲区**和**通道**，支持非阻塞 IO。

### Buffer（缓冲区）

```java
// Buffer 的四个核心属性：capacity, limit, position, mark
ByteBuffer buffer = ByteBuffer.allocate(1024);  // 分配堆内存
// ByteBuffer buffer = ByteBuffer.allocateDirect(1024);  // 分配直接内存

buffer.put("hello".getBytes());  // 写入
buffer.flip();                   // 切换为读模式（limit=position, position=0）
byte[] bytes = new byte[buffer.remaining()];
buffer.get(bytes);               // 读取
System.out.println(new String(bytes));  // hello
buffer.clear();                  // 切换为写模式
```

### Channel（通道）

```java
// 使用 NIO 进行文件复制
try (FileChannel srcChannel = FileChannel.open(Paths.get("src.txt"), StandardOpenOption.READ);
     FileChannel destChannel = FileChannel.open(Paths.get("dest.txt"),
             StandardOpenOption.CREATE, StandardOpenOption.WRITE)) {

    // 方式一：transferTo/transferFrom（零拷贝，最高效）
    srcChannel.transferTo(0, srcChannel.size(), destChannel);

    // 方式二：ByteBuffer 手动操作
    // ByteBuffer buffer = ByteBuffer.allocateDirect(8192);
    // while (srcChannel.read(buffer) != -1) {
    //     buffer.flip();
    //     destChannel.write(buffer);
    //     buffer.clear();
    // }
}
```

### Files 工具类（Java 7 NIO.2）

```java
// 读取所有行
List<String> lines = Files.readAllLines(Paths.get("file.txt"), StandardCharsets.UTF_8);

// 写入
Files.write(Paths.get("file.txt"), lines, StandardCharsets.UTF_8);

// 流式读取大文件
try (Stream<String> stream = Files.lines(Paths.get("large.txt"))) {
    stream.filter(line -> line.contains("keyword"))
          .forEach(System.out::println);
}

// 文件和目录操作
Files.createDirectories(Paths.get("dir/subdir"));
Files.copy(src, dest, StandardCopyOption.REPLACE_EXISTING);
Files.move(src, dest);
Files.delete(path);
Files.walkFileTree(path, new SimpleFileVisitor<>() { /* 遍历文件树 */ });
```

---

# 7. Lambda 与 Stream

## 7.1 Lambda 表达式

Lambda 本质是**匿名函数的简洁写法**，用于实现函数式接口（只有一个抽象方法的接口）。

```java
// 传统匿名内部类
Runnable r1 = new Runnable() {
    @Override
    public void run() {
        System.out.println("Hello");
    }
};

// Lambda 表达式（等价）
Runnable r2 = () -> System.out.println("Hello");

// 多参数、有返回值
Comparator<String> comp = (a, b) -> a.compareToIgnoreCase(b);

// 带类型声明和多行代码
BiFunction<Integer, Integer, Integer> add = (Integer a, Integer b) -> {
    int result = a + b;
    return result;
};
```

## 7.2 函数式接口

Java 内置四大核心函数式接口：

| 接口 | 方法 | 作用 | 示例 |
|------|------|------|------|
| `Function<T, R>` | `R apply(T t)` | 转换，T→R | `s -> s.length()` |
| `Consumer<T>` | `void accept(T t)` | 消费 | `s -> System.out.println(s)` |
| `Supplier<T>` | `T get()` | 生产 | `() -> new User()` |
| `Predicate<T>` | `boolean test(T t)` | 判断 | `s -> s.isEmpty()` |

```java
// Function：列表转字符串长度列表
List<String> names = Arrays.asList("Alice", "Bob", "Charlie");
List<Integer> lengths = names.stream()
    .map(s -> s.length())  // map 接收 Function<String, Integer>
    .collect(Collectors.toList());

// Consumer：遍历列表
names.forEach(name -> System.out.println(name));

// Predicate：过滤
List<String> longNames = names.stream()
    .filter(name -> name.length() > 3)  // filter 接收 Predicate<String>
    .collect(Collectors.toList());

// Supplier：延迟生成
Supplier<Double> randomSupplier = Math::random;
```

## 7.3 方法引用

```java
// 四种方法引用形式
// 1. 静态方法引用：ClassName::staticMethod
Function<String, Integer> f1 = Integer::parseInt;  // s -> Integer.parseInt(s)

// 2. 实例方法引用：instance::method
String prefix = "Hello";
Function<String, String> f2 = prefix::concat;  // s -> prefix.concat(s)

// 3. 类的实例方法引用：ClassName::instanceMethod
Function<String, Integer> f3 = String::length;  // s -> s.length()

// 4. 构造器引用：ClassName::new
Supplier<User> f4 = User::new;  // () -> new User()
```

## 7.4 Stream API

**Stream 不存储数据，它是对数据源的计算操作管道。**

```
数据源 → 中间操作（惰性，返回 Stream） → 终端操作（触发计算，返回结果）
         filter, map, sorted...         collect, forEach, reduce...
```

### 创建 Stream

```java
// 从集合
Stream<String> s1 = list.stream();
Stream<String> s2 = list.parallelStream();  // 并行流

// 从数组
Stream<String> s3 = Arrays.stream(array);

// 直接创建
Stream<String> s4 = Stream.of("a", "b", "c");
Stream<Integer> s5 = Stream.iterate(0, n -> n + 2);  // 无限流 0, 2, 4...
Stream<Double> s6 = Stream.generate(Math::random);    // 无限随机流
```

### 中间操作

```java
List<String> names = Arrays.asList("Alice", "Bob", "Charlie", "David", "Eve");

// filter：过滤
names.stream().filter(n -> n.length() > 3)
// [Alice, Charlie, David]

// map：转换
names.stream().map(String::toUpperCase)
// [ALICE, BOB, CHARLIE, DAVID, EVE]

// flatMap：扁平化
List<List<String>> nested = Arrays.asList(Arrays.asList("a", "b"), Arrays.asList("c", "d"));
nested.stream().flatMap(List::stream).collect(Collectors.toList());
// [a, b, c, d]

// distinct：去重
// sorted：排序
// peek：调试（查看元素）
// limit / skip：截取 / 跳过
Stream.iterate(1, n -> n + 1).skip(5).limit(3)
// [6, 7, 8]
```

### 终端操作

```java
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);

// collect：收集为集合
List<Integer> doubled = numbers.stream().map(n -> n * 2).collect(Collectors.toList());

// reduce：归约
int sum = numbers.stream().reduce(0, (a, b) -> a + b);  // 15
int sum2 = numbers.stream().mapToInt(Integer::intValue).sum();  // 更高效

// 聚合操作
long count = numbers.stream().filter(n -> n > 3).count();  // 2
int max = numbers.stream().max(Integer::compareTo).orElse(0);  // 5
boolean allMatch = numbers.stream().allMatch(n -> n > 0);  // true
boolean anyMatch = numbers.stream().anyMatch(n -> n > 10);  // false

// 分组
Map<String, List<User>> usersByCity = users.stream()
    .collect(Collectors.groupingBy(User::getCity));

// 分区
Map<Boolean, List<Integer>> partition = numbers.stream()
    .collect(Collectors.partitioningBy(n -> n % 2 == 0));
// {false=[1,3,5], true=[2,4]}
```

### Stream 注意事项

- **Stream 只能消费一次**，再次使用会抛 IllegalStateException
- 中间操作是**惰性的**，只有终端操作触发时才会执行
- **不要修改数据源**：Stream 操作期间修改源数据会导致不可预期的结果
- 大集合使用 `parallelStream()` 注意线程安全

---

# 8. 反射机制

## 8.1 什么是反射

**反射（Reflection）允许程序在运行时动态获取类的信息、创建对象、调用方法、访问字段。** 它是 Spring、MyBatis 等框架的核心基础。

```java
// 获取 Class 对象的三种方式
Class<?> clazz1 = User.class;                      // 通过类名
Class<?> clazz2 = user.getClass();                 // 通过实例
Class<?> clazz3 = Class.forName("com.demo.User");  // 通过全限定名（推荐）
```

## 8.2 核心操作

### 创建对象

```java
Class<?> clazz = Class.forName("com.demo.User");

// 无参构造（User 必须有 public 无参构造器）
User user = (User) clazz.getDeclaredConstructor().newInstance();

// 有参构造
Constructor<?> constructor = clazz.getConstructor(String.class, int.class);
User user2 = (User) constructor.newInstance("张三", 25);
```

### 调用方法

```java
Method method = clazz.getDeclaredMethod("setName", String.class);
method.invoke(user, "李四");  // user.setName("李四")

// 调用私有方法
Method privateMethod = clazz.getDeclaredMethod("secretMethod");
privateMethod.setAccessible(true);  // 绕过访问控制
privateMethod.invoke(user);
```

### 访问字段

```java
Field field = clazz.getDeclaredField("name");
field.setAccessible(true);  // 私有字段需要

String name = (String) field.get(user);  // 取值
field.set(user, "王五");                  // 设值
```

### 获取注解信息（框架的基础）

```java
// 检查类是否有某注解
if (clazz.isAnnotationPresent(Service.class)) {
    Service annotation = clazz.getAnnotation(Service.class);
    String beanName = annotation.value();
}

// 检查方法注解
Method method = clazz.getMethod("transfer");
if (method.isAnnotationPresent(Transactional.class)) {
    Transactional tx = method.getAnnotation(Transactional.class);
    Class<?>[] rollbackFor = tx.rollbackFor();
}
```

## 8.3 反射的代价与注意事项

- **性能开销**：反射调用比直接调用慢，频繁调用建议缓存 Method/Field 对象
- **破坏封装性**：`setAccessible(true)` 可绕过访问控制
- **编译时安全检查失效**：类型错误推迟到运行时
- **API 变迁**：JDK 9+ 模块系统可能限制对内部 API 的访问

---

# 9. 注解

## 9.1 常用内置注解

```java
@Override              // 声明方法重写
@Deprecated            // 标记已过时
@SuppressWarnings      // 抑制编译警告
@FunctionalInterface   // 标记函数式接口
@SafeVarargs           // 抑制泛型可变参数警告
```

## 9.2 元注解

元注解用于**定义注解的注解**：

```java
@Target(ElementType.METHOD)       // 注解可以用在哪些地方
@Retention(RetentionPolicy.RUNTIME) // 注解保留到哪个阶段
@Documented                        // 是否包含在 JavaDoc 中
@Inherited                         // 是否允许子类继承
@Repeatable                        // 是否可重复标注（Java 8+）
public @interface MyAnnotation {
    String value() default "";
    int priority() default 1;
}
```

**@Target 取值**：TYPE（类/接口）、FIELD、METHOD、PARAMETER、CONSTRUCTOR、ANNOTATION_TYPE、TYPE_PARAMETER（Java 8+）等。

**@Retention 取值**：

| 值 | 保留阶段 | 说明 |
|------|------|------|
| `SOURCE` | 源码 | 编译时丢弃，如 `@Override` |
| `CLASS` | 编译后 class 文件 | JVM 加载时丢弃（默认值） |
| `RUNTIME` | 运行时 | 可通过反射读取，如 `@Transactional` |

## 9.3 自定义注解

```java
// 定义一个方法级别的权限校验注解
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequirePermission {
    String value();           // 所需权限
    String[] roles() default {};  // 所需角色（数组）
}

// 使用
public class AdminService {
    @RequirePermission(value = "user:delete", roles = {"ADMIN"})
    public void deleteUser(Long id) {
        // ...
    }
}

// 通过反射 + AOP 解析注解（在切面中）
@Aspect
public class PermissionAspect {
    @Before("@annotation(requirePermission)")
    public void check(RequirePermission requirePermission) {
        String permission = requirePermission.value();
        String[] roles = requirePermission.roles();
        // 校验权限...
    }
}
```

## 9.4 注解处理器（编译时）

```java
// 使用注解处理器自动生成代码（如 MapStruct、Lombok 的原理）
// 继承 AbstractProcessor
@SupportedAnnotationTypes("com.demo.RequirePermission")
@SupportedSourceVersion(SourceVersion.RELEASE_17)
public class PermissionProcessor extends AbstractProcessor {
    @Override
    public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment roundEnv) {
        for (TypeElement annotation : annotations) {
            for (Element element : roundEnv.getElementsAnnotatedWith(annotation)) {
                // 生成代码或做编译期检查
            }
        }
        return true;
    }
}
```

---

# 总结

| 模块 | 核心思想 | 关键知识点 |
|------|----------|------------|
| OOP | 封装继承多态抽象，SOLID 原则 | 接口 vs 抽象类，多态三条件，DI |
| 异常 | 分离错误处理与业务逻辑 | try-with-resources，受检vs非受检，异常链 |
| 泛型 | 编译时类型安全 | 类型擦除，PECS，通配符边界 |
| 多线程 | 并发执行与线程安全 | synchronized/volatile/Lock，线程池，JUC 工具 |
| 集合 | 统一的数据结构 API | HashMap 原理，hashCode=equals，Stream+Collector |
| IO/NIO | 字节流/字符流/通道/缓冲区 | try-with-resources，UTF-8，零拷贝 |
| Lambda/Stream | 声明式数据处理 | 函数式接口，中间 vs 终端操作，reduce |
| 反射 | 运行时类型信息与动态操作 | Class/Method/Field，setAccessible，性能考量 |
| 注解 | 元数据标记，编译或运行时处理 | @Target/@Retention，AOP+注解，注解处理器 |

Java 基础的掌握程度决定了你能多好地使用 Spring、MyBatis 等框架，因为这些框架大量运用了反射、注解、代理、泛型、多线程等技术。**把基础打扎实，框架学习才会事半功倍。**
