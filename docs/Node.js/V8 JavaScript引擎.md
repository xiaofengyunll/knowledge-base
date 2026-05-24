# 为什么需要 JS 引擎
我们编写的 JavaScript 代码通常运行在浏览器或 Node.js 环境中，但真正负责执行这些代码的，其实是 JavaScript 引擎。

计算机底层的 CPU 并不能直接识别 JavaScript 代码，它只能执行机器指令。而不同架构的 CPU 所支持的指令集也并不相同。因此，需要一个能够理解 JavaScript 语法，并将其转换为底层机器指令的组件，这个组件就是 JavaScript 引擎。

# V8 JS 引擎
V8 是目前最主流、影响力最大的 JavaScript 引擎之一，由 Google 使用 C++ 开发并开源。它最初作为 Chrome 浏览器的 JavaScript 引擎推出，后来也成为 Node.js 的核心组成部分。

V8 的核心目标是：**让 JavaScript 尽可能接近原生语言的执行效率。**

传统脚本语言通常采用“边解析边执行”的方式，因此运行速度相对较慢。而 V8 引入了即时编译（JIT，Just-In-Time Compilation）机制，会在代码运行过程中动态分析热点代码，并将高频执行的 JavaScript 编译为高效的机器指令，从而显著提升性能。

现代 V8 并不是一个简单的“解释器”，而是一套完整的高性能运行体系，内部主要包含以下核心模块：

- Parser（解析器）：负责将 JavaScript 源码解析为 AST（抽象语法树）
- Ignition（解释器）：将 AST 转换为字节码并执行
- TurboFan（优化编译器）：对热点代码进行深度优化并生成高性能机器码
- Garbage Collector（垃圾回收器）：负责自动内存管理与垃圾回收
- Runtime & Builtins：提供 JavaScript 运行时能力与内置对象支持

V8 之所以能够拥有极高性能，还大量使用了多种运行时优化技术，例如：

- JIT 即时编译
- Hidden Class（隐藏类）
- Inline Cache（内联缓存）
- Escape Analysis（逃逸分析）
- Generational GC（分代垃圾回收）

这些优化使 JavaScript 在现代浏览器与 Node.js 环境中具备了极高的执行效率，也推动了 JavaScript 从“网页脚本语言”逐渐发展为服务端、桌面端甚至移动端的重要开发语言。

如今，V8 不仅应用于 Chrome 与 Node.js，还被广泛用于 Electron、Deno、Bun（部分兼容场景）等现代 JavaScript 运行时生态中，是现代 JavaScript 技术体系的重要基础设施。

# 其他 JS 引擎
除了最常见的 V8 之外，JavaScript 生态中还存在许多不同的 JavaScript 引擎。不同浏览器、运行时以及嵌入式环境，通常会根据自身需求选择不同的引擎实现。

JavaScriptCore 是由 Apple 开发并维护的 JavaScript 引擎，主要用于 WebKit 内核浏览器，例如 Safari。JavaScriptCore 最初由 KDE 项目的 KJS 引擎演化而来，后来苹果为其加入字节码解释器与 JIT 编译器，并发展出了著名的 SquirrelFish 与 Nitro 执行引擎，使其性能得到显著提升。

SpiderMonkey 是历史上第一款 JavaScript 引擎，由 Brendan Eich 在 Mozilla Foundation 工作期间开发完成。它最早用于 Netscape Navigator 浏览器，目前主要用于 Mozilla Firefox。SpiderMonkey 见证了 JavaScript 从简单脚本语言发展为现代应用开发语言的整个过程，在 JavaScript 历史中具有重要地位。

Chakra 是 Microsoft 推出的 JavaScript 引擎，主要用于 Internet Explorer 以及早期版本的 Microsoft Edge。后来微软还推出了 ChakraCore 开源版本。不过随着 Edge 浏览器转向 Chromium 内核，现代 Edge 已经改为使用 V8 引擎。

Rhino 是由 Mozilla Foundation 管理的 JavaScript 引擎，其最大的特点是完全使用 Java 编写，并运行在 JVM 之上。它主要用于 Java 环境中嵌入 JavaScript，例如测试工具 HTMLUnit 等场景。后来，Oracle 在 Java 8 中推出了 Nashorn 引擎，用于替代 Rhino。Nashorn 同样运行于 JVM，并增强了 Java 与 JavaScript 之间的互操作能力，但随着 GraalVM 的发展，Nashorn 已逐渐停止维护。

KJS 是 KDE 项目的 ECMAScript 引擎，最初用于 Konqueror 浏览器。虽然如今已经较少被提及，但它实际上是 JavaScriptCore 的前身之一，因此也间接影响了 Safari 的 JavaScript 执行体系。

QuickJS 是一款轻量级 JavaScript 引擎，由 Fabrice Bellard 开发。它体积小、启动速度快，并支持较新的 ECMAScript 标准，因此常被用于脚本工具、嵌入式运行环境以及一些轻量级运行时中。

Hermes 是由 Meta 为 React Native 专门开发的 JavaScript 引擎。Hermes 更关注移动端场景，重点优化了应用启动速度、内存占用以及包体积，因此特别适合 Android 等资源受限的移动设备。

JerryScript 则是 Samsung 推出的超轻量 JavaScript 引擎，主要面向 IoT 与嵌入式设备。它可以在极低内存环境下运行，因此常见于智能家居、低功耗设备以及微控制器场景。

目前，现代主流 JavaScript 生态基本形成了以 V8、SpiderMonkey 与 JavaScriptCore 为核心的浏览器引擎格局。其中，Chrome 与 Node.js 使用 V8，Firefox 使用 SpiderMonkey，而 Safari 使用 JavaScriptCore。