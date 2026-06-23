# JavaScript 核心机制与技术指南

ES6+ 常用语法，闭包、作用域链、原型链、事件循环等 JavaScript 核心机制。

---

## 一、作用域与作用域链

### 1.1 作用域类型

JavaScript 有三种作用域：

| 作用域 | 说明 |
|---|---|
| 全局作用域 | 代码在任何函数外定义，全局可访问 |
| 函数作用域 | 在函数内部定义，仅函数内可访问 |
| 块级作用域 | `{}` 包裹，`let`/`const` 声明的变量仅在该块内有效 |

```javascript
var a = 1;        // 全局作用域
let b = 2;        // 全局作用域（但不在 window 对象上）

function foo() {
    var c = 3;    // 函数作用域
    let d = 4;    // 函数作用域
    if (true) {
        var e = 5;    // var 无视块，提升到函数作用域
        let f = 6;    // 块级作用域，仅在 if 内
        const g = 7;  // 块级作用域，仅在 if 内
    }
    console.log(e); // 5 —— var 穿透了块
    console.log(f); // ReferenceError
}
```

**`var` vs `let`/`const` 的核心区别**：`var` 没有块级作用域，且存在变量提升（声明提升，初始化不提升）；`let`/`const` 有暂时性死区（TDZ），在声明前访问会抛出 ReferenceError。

### 1.2 作用域链

**作用域链的本质是一个指向变量对象的指针链表。**

```javascript
const global = 'global';

function outer() {
    const outerVar = 'outer';

    function inner() {
        const innerVar = 'inner';
        console.log(innerVar);  // 当前作用域
        console.log(outerVar);  // 沿链向上查找 outer 作用域
        console.log(global);    // 沿链向上查找 global 作用域
    }

    inner();
}
```

查找规则：**从当前执行上下文的变量对象开始，沿 `[[Scope]]` 链逐级向上，直到全局执行上下文。** 每一级函数在执行时会创建一个新的执行上下文，并将其 `[[Scope]]` 指向创建它的函数的变量对象。

### 1.3 词法作用域（静态作用域）

JavaScript 的作用域是**词法作用域**：函数的作用域在**定义时**确定，而非调用时。

```javascript
const value = 'global';

function bar() {
    console.log(value);
}

function foo() {
    const value = 'local';
    bar();  // 输出 'global'，不是 'local'
}

foo();
```

`bar` 定义在全局，其 `[[Scope]]` 指向全局变量对象，与在哪里调用无关。

---

## 二、闭包

### 2.1 定义

**闭包 = 函数 + 该函数能访问的自由变量。**

当一个函数可以记住并访问它所在的词法作用域，即使这个函数在词法作用域之外执行，就产生了闭包。

```javascript
function createCounter() {
    let count = 0;          // 被闭包"捕获"的变量
    return function () {
        count++;            // 访问外部函数的变量
        return count;
    };
}

const counter = createCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3
```

`count` 变量本应在 `createCounter` 执行完毕后被回收，但内部函数持有对它的引用，使 `count` 存活在堆内存中。

### 2.2 经典问题：循环中的闭包

```javascript
// ❌ 错误写法
for (var i = 1; i <= 5; i++) {
    setTimeout(function () {
        console.log(i);  // 全部输出 6
    }, i * 1000);
}

// ✅ 方案一：let 块级作用域
for (let i = 1; i <= 5; i++) {
    setTimeout(function () {
        console.log(i);  // 1 2 3 4 5
    }, i * 1000);
}

// ✅ 方案二：IIFE 传参
for (var i = 1; i <= 5; i++) {
    (function (j) {
        setTimeout(function () {
            console.log(j);  // 1 2 3 4 5
        }, j * 1000);
    })(i);
}
```

根因：`var` 声明的 `i` 在全局/函数作用域中只有一份，所有回调共享同一个 `i`。`let` 为每次迭代创建一个独立绑定；IIFE 创建独立函数作用域并将当前值作为参数传入。

### 2.3 实际应用

```javascript
// 模块模式
const Module = (function () {
    const privateData = new WeakMap();  // 私有变量

    return class {
        constructor(name) {
            privateData.set(this, { name, createdAt: Date.now() });
        }
        getName() {
            return privateData.get(this).name;
        }
    };
})();

// 函数柯里化
function multiply(a) {
    return function (b) {
        return a * b;
    };
}
const double = multiply(2);
console.log(double(5)); // 10
```

### 2.4 内存与注意事项

闭包持有的引用会阻止垃圾回收。不需要的闭包应解除引用：

```javascript
let heavyData = new Array(10000000);
const closure = () => console.log(heavyData.length);
// 如果不再需要：
heavyData = null;  // 但闭包仍持有引用，数据不会回收
```

**最佳实践**：只捕获真正需要的变量，大型数据使用 WeakMap 或将引用置为 null 后不再通过闭包访问。

---

## 三、原型链

### 3.1 原型基础

JavaScript 通过原型实现继承。每个对象有一个内部属性 `[[Prototype]]`（通过 `__proto__` 或 `Object.getPrototypeOf` 访问），指向其原型对象。

```javascript
const obj = {};
// obj.__proto__ === Object.prototype
// Object.prototype.__proto__ === null  （原型链终点）
```

**三者的三角关系：**

```javascript
function Person(name) {
    this.name = name;
}

Person.prototype.sayHi = function () {
    console.log(`Hi, ${this.name}`);
};

const p = new Person('Alice');

// 三角关系：
p.__proto__ === Person.prototype;            // 实例 → 原型
Person.prototype.constructor === Person;     // 原型 → 构造函数
Person.prototype.__proto__ === Object.prototype;  // 原型链向上
Object.prototype.__proto__ === null;         // 终点
```

### 3.2 属性查找（原型链搜索）

```javascript
function Animal() {}
Animal.prototype.type = 'animal';

function Dog() {}
Dog.prototype = Object.create(Animal.prototype);  // Dog.prototype.__proto__ → Animal.prototype
Dog.prototype.constructor = Dog;
Dog.prototype.bark = function () { return 'woof'; };

const d = new Dog();
console.log(d.bark());   // 在 Dog.prototype 上找到
console.log(d.type);     // 沿链在 Animal.prototype 上找到
console.log(d.toString()); // 沿链在 Object.prototype 上找到
console.log(d.unknown);    // 沿链到头，返回 undefined
```

查找路径：`d` → `Dog.prototype` → `Animal.prototype` → `Object.prototype` → `null`

### 3.3 `instanceof` 原理

```javascript
function myInstanceof(instance, constructor) {
    let proto = Object.getPrototypeOf(instance);
    while (proto) {
        if (proto === constructor.prototype) return true;
        proto = Object.getPrototypeOf(proto);
    }
    return false;
}
```

### 3.4 ES6 class 的实质

ES6 `class` 本质上仍然是原型继承，只是语法糖：

```javascript
class Animal {
    constructor(name) {
        this.name = name;
    }
    speak() {
        console.log(`${this.name} makes a sound`);
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name);
        this.breed = breed;
    }
    speak() {
        console.log(`${this.name} barks`);
    }
}

// 等价于 ES5：
function Animal(name) {
    this.name = name;
}
Animal.prototype.speak = function () {
    console.log(this.name + ' makes a sound');
};

function Dog(name, breed) {
    Animal.call(this, name);
    this.breed = breed;
}
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
Dog.prototype.speak = function () {
    console.log(this.name + ' barks');
};
```

| 特性 | ES5 原型 | ES6 class |
|---|---|---|
| 声明提升 | 函数声明提升 | 无提升（类名进入 TDZ） |
| 内部实现 | `[[Call]]` + `[[Construct]]` | 仅 `[[Construct]]`，不能无 new 调用 |
| 枚举性 | 原型方法可枚举 | 原型方法不可枚举 |
| 严格模式 | 手动开启 | 自动严格模式 |

---

## 四、事件循环（Event Loop）

### 4.1 核心概念

JavaScript 是**单线程**语言，通过事件循环实现异步非阻塞。

```
┌───────────────────────────┐
│         调用栈             │
│     (Call Stack)          │
│  同步代码在此执行           │
│  后进先出 (LIFO)           │
└──────────┬────────────────┘
           │ 遇到异步操作
           ▼
┌──────────────────────────┐    ┌──────────────────────┐
│    Web APIs / Node APIs   │    │   微任务队列            │
│  setTimeout, fetch,       │    │   Microtask Queue     │
│  DOM events, I/O          │    │   Promise.then/catch  │
│    处理异步操作              │    │   MutationObserver    │
└──────────┬───────────────┘    │   queueMicrotask      │
           │ 定时到期/响应就绪    └──────────┬───────────┘
           ▼                                │
┌──────────────────────────┐               │
│   宏任务队列              │◄──────────────┘
│   Task Queue             │   优先级最低
│   setTimeout/setInterval │
│   I/O, UI rendering      │
│   setImmediate (Node)    │
└──────────┬───────────────┘
           │
           ▼
      【事件循环】
  1. 执行一个宏任务
  2. 清空所有微任务
  3. 必要时渲染 UI
  4. 取下一个宏任务
```

### 4.2 执行顺序

```javascript
console.log('1');

setTimeout(() => {
    console.log('2');
}, 0);

Promise.resolve().then(() => {
    console.log('3');
});

console.log('4');

// 输出：1 4 3 2
```

**执行过程**：
1. 同步代码 `1`、`4` 入栈执行
2. `setTimeout` 回调进入宏任务队列
3. `Promise.then` 进入微任务队列
4. 同步代码执行完毕，调用栈清空
5. **清空微任务队列** → 执行 `3`
6. 从宏任务队列取一个任务 → 执行 `2`

**关键规则：每个宏任务执行完毕后，必须清空微任务队列，再进入下一个宏任务。**

### 4.3 完整示例

```javascript
console.log('script start');

setTimeout(() => {
    console.log('setTimeout');
}, 0);

Promise.resolve()
    .then(() => {
        console.log('promise1');
    })
    .then(() => {
        console.log('promise2');
    });

async function foo() {
    console.log('async start');
    await bar();
    console.log('async end');  // await 之后 = Promise.then
}

async function bar() {
    console.log('bar');
}

foo();

console.log('script end');

// 输出：
// script start
// async start
// bar
// script end
// promise1
// async end
// promise2
// setTimeout
```

要点解释：
- `async` 函数内部 `await` 之前的代码是同步的
- `await bar()` → `bar()` 同步执行；`await` 后面的代码等价于 `.then()` 回调，进入微任务队列
- 微任务可以嵌套产生新的微任务（promise1 → promise2），必须全部清空

### 4.4 Node.js 中的事件循环

Node.js 有 6 个阶段，每个阶段有一个 FIFO 回调队列：

```
   ┌───────────────────────────┐
┌─▶│           timers          │  setTimeout / setInterval 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  系统操作回调（如 TCP 错误）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  内部使用
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  检索新 I/O 事件；执行 I/O 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate() 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  socket.on('close', ...)
   └───────────────────────────┘
```

```javascript
// setTimeout 0 vs setImmediate
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// 输出顺序不确定（取决于 event loop 启动用时）
// 若在 poll 阶段启动 → immediate 先；否则 timeout 先
// 但在 I/O 回调内部，setImmediate 一定先于 setTimeout
```

`process.nextTick()` 不属于任何阶段，它在**每个阶段结束后立即执行**，优先级高于微任务。

---

## 五、this 绑定规则

### 5.1 四种绑定规则（优先级从高到低）

```javascript
// 1. new 绑定 —— 最高优先级
function Person(name) {
    this.name = name;      // this = 新创建的对象
}
const p = new Person('Alice');

// 2. 显式绑定 (call / apply / bind)
function greet() {
    console.log(this.name);
}
greet.call({ name: 'Bob' });   // this = { name: 'Bob' }
greet.apply({ name: 'Bob' });  // 同上，参数传数组
const bound = greet.bind({ name: 'Bob' });
bound();  // bind 返回的函数的 this 不可再被修改

// 3. 隐式绑定（方法调用）
const obj = {
    name: 'Charlie',
    greet: function () {
        console.log(this.name);
    }
};
obj.greet();  // this = obj

// ❌ 隐式丢失
const fn = obj.greet;
fn();  // this = undefined (严格模式) 或 window (非严格模式)

// 4. 默认绑定
greet();  // 独立调用：this = undefined (严格模式) / window (非严格模式)
```

### 5.2 箭头函数的 this

箭头函数**没有自己的 `this`**，其 `this` 继承自外层词法作用域，且**不可被 `call`/`apply`/`bind` 改变**。

```javascript
const obj = {
    name: 'obj',
    traditional() {
        setTimeout(function () {
            console.log(this.name);  // undefined —— this = window/undefined
        }, 100);
    },
    arrow() {
        setTimeout(() => {
            console.log(this.name);  // 'obj' —— this 继承自 arrow 的 this
        }, 100);
    }
};
obj.arrow();
```

---

## 六、ES6+ 常用语法

### 6.1 解构赋值

```javascript
// 数组解构
const [a, b = 2, ...rest] = [1, undefined, 3, 4];
// a=1, b=2(默认值), rest=[3,4]

// 交换变量
let x = 1, y = 2;
[x, y] = [y, x];

// 对象解构
const { name, age: AGE = 18, ...other } = { name: 'Alice', city: 'NY' };
// name='Alice', AGE=18(默认值), other={city:'NY'}

// 深层解构
const { data: { user: { info } } } = response;
// 取 response.data.user.info，链上任何一层为 null 都会报错

// 函数参数解构
function greet({ name, age }) {
    console.log(`${name}, ${age}`);
}
```

### 6.2 展开运算符

```javascript
// 数组合并
const arr = [...[1, 2], ...[3, 4]];  // [1,2,3,4]

// 浅拷贝
const copy = { ...original };
const merged = { ...defaults, ...user };  // user 覆盖 defaults

// 剩余参数
function sum(...nums) {
    return nums.reduce((a, b) => a + b, 0);
}
console.log(sum(1, 2, 3, 4)); // 10
```

### 6.3 模板字符串

```javascript
const name = 'Alice';
const msg = `Hello ${name},
the result is ${1 + 2}`;

// 标签模板
function highlight(strings, ...values) {
    return strings.reduce((result, str, i) =>
        `${result}${str}<strong>${values[i] || ''}</strong>`, '');
}
highlight`Hello ${name}, score: ${95}`;
// "Hello <strong>Alice</strong>, score: <strong>95</strong>"
```

### 6.4 可选链与空值合并

```javascript
// 可选链 ?.  —— 前面为 null/undefined 时短路返回 undefined
const street = user?.address?.street;         // 不会抛 TypeError
const result = callback?.();                   // 安全函数调用
const val = arr?.[0];                          // 安全数组访问

// 空值合并 ?? —— 只有 null/undefined 才用默认值
const page = userPage ?? 1;       // 0 或 '' 不会被替换
const old = userPage || 1;        // 0、''、false 都会被替换
```

### 6.5 Map / Set / WeakMap

```javascript
// Map —— 键可以是任意类型，保持插入顺序
const map = new Map();
map.set(obj, 'value');
map.get(obj);
map.has(obj);
map.delete(obj);
for (const [key, value] of map) { }  // 可迭代

// Set —— 唯一值集合
const set = new Set([1, 2, 2, 3]);  // {1, 2, 3}

// WeakMap —— 键必须是对象，键被回收时条目自动删除，不可迭代
const wm = new WeakMap();
// 典型场景：缓存、私有数据
const cache = new WeakMap();
function compute(obj) {
    if (cache.has(obj)) return cache.get(obj);
    const result = /* 昂贵计算 */;
    cache.set(obj, result);
    return result;
}
```

### 6.6 for...of vs for...in

```javascript
const arr = ['a', 'b', 'c'];
arr.foo = 'bar';

for (const i in arr)  console.log(i);   // "0" "1" "2" "foo"  —— 键名
for (const v of arr)  console.log(v);   // "a" "b" "c"         —— 值（可迭代协议）
```

### 6.7 Symbol

```javascript
// 创建唯一键，避免属性冲突
const KEY = Symbol('key');
const obj = { [KEY]: 'secret' };
obj[KEY]; // 'secret'
Object.keys(obj);       // []  —— Symbol 不可枚举
Object.getOwnPropertySymbols(obj);  // [Symbol(key)]

// 全局 Symbol
const s1 = Symbol.for('app.foo');
Symbol.keyFor(s1);  // 'app.foo'
Symbol.keyFor(Symbol('local')); // undefined — 非全局

// 知名 Symbol
// Symbol.iterator  —— 定义默认迭代器
// Symbol.toPrimitive —— 定义对象转原始值行为
// Symbol.toStringTag —— 修改 Object.prototype.toString 的标签
```

### 6.8 迭代器与生成器

```javascript
// 自定义可迭代对象
const range = {
    from: 1,
    to: 5,
    [Symbol.iterator]() {
        let current = this.from;
        return { next: () => current <= this.to
            ? { value: current++, done: false }
            : { done: true }
        };
    }
};
console.log([...range]); // [1, 2, 3, 4, 5]

// 生成器函数 function*
function* idGenerator() {
    let id = 1;
    while (true) {
        yield id++;
    }
}
const gen = idGenerator();
gen.next(); // { value: 1, done: false }

// yield* 委托
function* combined() {
    yield* [1, 2];
    yield* generator();
}

// 双向通信
function* twoWay() {
    const a = yield 'give me a';
    const b = yield `got ${a}, give me b`;
    return a + b;
}
const g = twoWay();
g.next();        // { value: 'give me a', done: false }
g.next(10);      // { value: 'got 10, give me b', done: false }
g.next(20);      // { value: 30, done: true }
```

### 6.9 Proxy 与 Reflect

```javascript
const target = { name: 'Alice', age: 25 };
const handler = {
    get(obj, prop) {
        if (prop in obj) {
            return obj[prop];
        }
        throw new ReferenceError(`Property "${prop}" does not exist`);
    },
    set(obj, prop, value) {
        if (prop === 'age' && typeof value !== 'number') {
            throw new TypeError('age must be a number');
        }
        obj[prop] = value;
        return true;
    }
};
const proxy = new Proxy(target, handler);
proxy.name;   // 'Alice'
proxy.xxx;    // ReferenceError
proxy.age = 'a'; // TypeError
```

---

## 七、异步编程

### 7.1 Promise

```javascript
// Promise 三态：pending → fulfilled / rejected，不可逆
new Promise((resolve, reject) => {
    // 同步执行
    setTimeout(() => resolve('done'), 1000);
})
.then(v => v.toUpperCase())
.then(v => console.log(v))          // 'DONE'
.catch(err => console.error(err))
.finally(() => console.log('cleanup'));  // 无论成功失败都执行

// 静态方法
Promise.all([p1, p2, p3]);       // 全部成功 → 结果数组；一个失败 → 立即 reject
Promise.allSettled([p1, p2]);    // 全部完成（无论成败），返回 {status, value/reason}[]
Promise.race([p1, p2]);          // 第一个完成的，无论成败
Promise.any([p1, p2]);           // 第一个成功的；全部失败则 AggregateError
Promise.resolve(42);             // 包装为已解决
Promise.reject(new Error('x'));  // 包装为已拒绝

// then 中 return 的值默认包装为 Promise.resolve
// then 中 throw 的值默认包装为 Promise.reject
```

### 7.2 async/await

```javascript
async function fetchData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data;
    } catch (err) {
        console.error('fetch failed:', err);
        throw err;  // async 函数始终返回 Promise
    }
}

// 并发 await
const [users, posts] = await Promise.all([
    fetchUsers(),
    fetchPosts()
]);

// 循环中的串行 vs 并行
for (const url of urls) {
    await fetch(url);  // 串行：一个接一个
}
await Promise.all(urls.map(url => fetch(url)));  // 并行：同时发出
```

### 7.3 错误处理最佳实践

```javascript
// Promise 链必须有一个 .catch
fetchData()
    .then(process)
    .catch(handleError);  // 捕获链上任何一环的错误

// async/await 必须 try-catch 或附加 .catch
async function main() {
    try {
        await riskyOp();
    } catch (err) {
        // 处理错误
    }
}
// 或者
main().catch(console.error);

// 顶层未处理的 rejection
process.on('unhandledRejection', (reason, promise) => { /* ... */ });
```

---

## 八、垃圾回收

### 8.1 标记-清除（Mark-and-Sweep）

V8 的主流 GC 算法。从根对象（全局对象、当前执行栈中的变量）出发，深度遍历所有引用，标记"可达"对象。清扫阶段回收未标记对象。

### 8.2 引用计数（已废弃）

IE6/7 的旧算法。循环引用导致泄漏：

```javascript
const a = {};
const b = {};
a.ref = b;
b.ref = a;
// 即使不再使用 a b，引用计数永远不为 0
```

现代引擎已用标记-清除解决此问题。

### 8.3 常见内存泄漏

```javascript
// 1. 未清理的定时器
const timer = setInterval(() => { /* 引用大对象 */ }, 1000);
// 解决：组件卸载时 clearInterval(timer)

// 2. 未移除的事件监听
element.addEventListener('click', handler);
// 解决：removeEventListener 或使用 once: true

// 3. 游离的 DOM 引用
let element = document.getElementById('target');
element.remove();    // DOM 从树上移除，但 JS 变量仍引用
element = null;      // 解除引用，GC 可以回收

// 4. 闭包持有大对象
function outer() {
    const bigData = new Array(10000000);
    return () => bigData;  // bigData 无法回收
}
// 解决：仅捕获需要的变量，或令 bigData = null

// 5. console.log
// 开发模式下 console.log 的对象会被浏览器保留，生产环境应移除
```

### 8.4 V8 的分代回收

- **新生代（Young Generation）**：存活时间短的对象，使用 Scavenge 算法（复制），频繁但快速
- **老生代（Old Generation）**：经过多次 GC 仍存活的对象，使用标记-清除 + 标记-整理，频率低但耗时长

---

## 九、模块化

### 9.1 ESM（ES Module）

```javascript
// 命名导出
export const foo = 1;
export function bar() {}

// 默认导出
export default class MyClass {}

// 同时导出
export { named1, named2 };
export { default as MyClass } from './module';

// 导入
import MyClass, { foo, bar as baz } from './module.js';
import * as Module from './module.js';
import('./module.js').then(m => m.default());  // 动态导入，返回 Promise

// 静态特征：
// - import 必须在模块顶层
// - 不能放在 if 中（需条件加载时用 import()）
// - 编译时确定依赖，支持 tree-shaking
```

### 9.2 与 CommonJS 差异

| 特性 | ESM | CommonJS |
|---|---|---|
| 加载时机 | 编译时（静态） | 运行时（动态） |
| 值类型 | 只读引用（值变化会反映） | 值的拷贝 |
| this | undefined | 指向 module.exports |
| 循环依赖 | 能正确处理（因为有静态分析） | 可能拿到不完整对象 |
| tree-shaking | 支持 | 不支持 |

---

## 十、类型转换核心规则

### 10.1 ToPrimitive

对象转原始值的调用流程：

```javascript
// 1. 如果有 Symbol.toPrimitive，调用
// 2. 如果 hint 是 "string"，调用 toString() → valueOf()
// 3. 如果 hint 是 "number" 或 "default"，调用 valueOf() → toString()
// 4. 失败则 TypeError

const obj = {
    [Symbol.toPrimitive](hint) {
        if (hint === 'number') return 42;
        if (hint === 'string') return 'hello';
        return 'default';
    }
};
console.log(+obj);     // 42    (hint: number)
console.log(`${obj}`); // hello (hint: string)
console.log(obj + ''); // default (hint: default)
```

### 10.2 宽松相等（==）规则速记

```javascript
null == undefined;        // true（仅此一对）
NaN == NaN;               // false
0 == '0';                 // true  —— 字符串先转数字
0 == [];                  // true  —— [].valueOf()→[]→[].toString()→""
0 == '';                  // true
2 == [2];                 // true  —— [2].toString()→"2"→Number→2
true == 1;                // true  —— 布尔转数字
[] == ![];                // true  —— 惊喜
// ![] → false（[] 是 truthy） → false 转数字 0 → [].toString()→"" → ""转数字 0
```

> 日常开发：统一使用 `===`，只有 `x == null`（等价于 `x === null || x === undefined`）是可接受的用法，因为它简洁且安全。

---

## 十一、扁平化、去重等常用操作

```javascript
const arr = [1, [2, [3, [4]]]];

// 扁平化
arr.flat(Infinity);              // [1, 2, 3, 4]
arr.flatMap(x => [x, x * 2]);   // 先 map 再 flat(1)

// 去重
[...new Set([1, 2, 2, 3])];     // [1, 2, 3]

// 对象数组按字段去重
const uniqueBy = (arr, key) =>
    [...new Map(arr.map(item => [item[key], item])).values()];
```

---

## 十二、内存视角：堆与栈

```
┌──────────────────┐
│  栈（Stack）       │ ← 原始值、引用地址、函数调用帧
│  number, string,  │   LIFO，CPU 管理，速度快
│  boolean, null,   │
│  undefined, symbol│
├──────────────────┤
│  堆（Heap）        │ ← 对象、数组、函数、闭包变量
│  {}  []  function │   动态分配，GC 管理
│  Date  RegExp     │
└──────────────────┘
```

```javascript
let a = 10;
let b = a;   // 值拷贝：b = 10
a = 20;      // b 仍然是 10

let obj1 = { x: 1 };
let obj2 = obj1;  // 引用拷贝：obj2 和 obj1 指向同一个堆对象
obj1.x = 2;       // obj2.x 也是 2
```

`const` 声明的引用类型不可重新赋值，但内部属性可修改：

```javascript
const obj = { name: 'Alice' };
obj.name = 'Bob';    // OK
obj = {};            // TypeError
```

---

## 十三、总结速查图

```
JavaScript 核心体系
├── 执行机制
│   ├── 作用域链：词法作用域，[[Scope]] 链表
│   ├── 闭包：函数 + 能访问的外部变量
│   ├── 事件循环：宏任务 → 清空微任务 → 渲染 → 下一个宏任务
│   └── 垃圾回收：标记-清除 + 分代回收
├── 对象模型
│   ├── 原型链：obj → __proto__ → ... → null
│   ├── this：new > 显式 > 隐式 > 默认，箭头函数无自己的 this
│   └── class：原型继承的语法糖
├── 异步编程
│   ├── Promise：pending → fulfilled / rejected
│   ├── async/await：生成器 + Promise 的语法糖
│   └── 微任务优先于宏任务
└── ES6+ 工具
    ├── 解构 / 展开 / 模板字符串
    ├── Map / Set / WeakMap / Symbol
    ├── 可选链 / 空值合并
    ├── Proxy / Reflect
    └── ESM 静态模块
```
