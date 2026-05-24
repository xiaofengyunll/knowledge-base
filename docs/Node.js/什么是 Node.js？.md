# Node.js 是什么?
_**Node.js 是一个开源的跨平台 JavaScript 运行时环境。**_

这是 Node.js 官方对 Node.js 的描述。

简单来说，Node.js 的出现使 JavaScript 不再局限于浏览器环境。即使脱离浏览器，JavaScript 代码依然可以运行，因为 Node.js 为 JavaScript 提供了独立的运行时环境，以及执行代码所需的系统能力和 API。

Node.js 采用单线程事件循环（Event Loop）机制运行 JavaScript 代码。一个 Node.js 应用通常运行在单一进程中，JavaScript 主线程不会像传统服务器模型那样为每一个请求创建独立线程。

当程序执行文件读取、网络请求、数据库访问等 I/O 操作时，Node.js 通常不会阻塞当前线程，而是将这些操作交给底层系统或线程池处理。当任务完成后，再通过回调、Promise 或 async/await 的方式通知 JavaScript 主线程继续执行。

# Node.js 与浏览器的差异
Node.js 将 JavaScript 从浏览器环境扩展到了服务端与系统级开发领域，但 Node.js 与浏览器之间仍然存在明显差异，其中最核心的区别在于运行环境与生态体系的不同。

在浏览器中，JavaScript 主要用于与 Web 平台进行交互，例如操作 DOM、处理页面事件以及调用浏览器提供的各种 Web API。因此，浏览器环境中提供了 `document`、`window`、`navigator` 等对象。

而在 Node.js 中，并不存在浏览器相关的 API，因为 Node.js 并不负责页面渲染。相反，Node.js 提供了大量面向系统级开发的能力，例如文件系统访问、网络通信、进程管理等。因此，Node.js 提供了诸如 `fs`、`path`、`http`、`net` 等核心模块，这些能力通常无法直接在浏览器中获得。

例如，在浏览器中，JavaScript 对文件访问受到严格限制，通常只能在用户授权的前提下访问指定文件；而 Node.js 则可以直接对操作系统文件系统进行读写操作。

另一个重要区别在于运行环境的可控性。

Node.js 的运行环境通常由开发者自行控制，因此 Node.js 的版本、运行参数以及依赖环境都相对稳定统一。而浏览器环境则由用户决定，开发者无法确定用户使用的是哪一种浏览器、什么版本，以及是否支持某些新特性，因此前端开发往往需要考虑兼容性问题。

在模块系统方面，Node.js 早期主要采用 CommonJS 规范，通过 `require()` 和 `module.exports` 实现模块加载与导出。随着 ECMAScript Modules（ESM）逐渐成为 JavaScript 官方标准，Node.js 也从 v12 开始逐步支持 ES Modules。

因此，在现代 Node.js 中，开发者既可以使用：

```
const fs = require('fs')
```

也可以使用：

```
import fs from 'fs'
```

而在浏览器环境中，标准模块化方案主要是 ES Modules，因此通常使用 `import/export`，而不支持 CommonJS 的 `require()` 机制。