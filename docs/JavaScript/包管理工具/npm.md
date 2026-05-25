npm 是 Node.js 默认自带的包管理工具，因此通常在安装 Node.js 后，就可以直接使用 npm。

npm 的主要功能包括：

- **包管理**：帮助开发者安装、更新和删除项目依赖。
- **版本管理**：通过语义化版本控制管理依赖版本。
- **包发布**：允许开发者将自己的模块发布到 npm 仓库中供其他开发者使用。
- **命令行工具**：提供项目初始化、脚本执行、依赖管理等丰富功能。

---

# 依赖查询

开发过程中，我们经常需要查看当前项目已经安装的依赖。

可以使用以下命令查看当前项目中的依赖列表：

```
npm ls
```

如果需要查看全局安装的依赖，可以使用：

```
npm ls -g --depth=0
```

如果需要搜索 npm 仓库中的模块，可以使用：

```
npm search <keyword>
```

例如：

```
npm search react
```

该命令会在整个 npm 仓库中搜索相关模块，而不是搜索本地项目中的依赖。

---

# 模块安装

在项目中，我们通常通过以下命令安装依赖模块：

```
npm install <module-name>
```

例如：

```
npm install react
```

## 全局安装与本地安装

有时，我们会通过 npm 安装一些工具类软件，例如 Claude Code、Codex、TypeScript 等。

这种情况下，通常会添加 `-g` 参数进行全局安装：

```
npm install -g <module-name>
```

而 npm 默认采用的是本地安装方式。

---

## 本地安装

本地安装时，npm 会将模块安装到当前项目目录下的 `node_modules` 文件夹中。

这种方式具有以下特点：

- 不同项目之间的依赖相互隔离
- 每个项目都可以使用自己所需的依赖版本
- 可以避免项目之间的版本冲突
- 更有利于保证项目运行的稳定性

不过，这也意味着多个项目可能会分别保存同一个模块的副本。

---

## 全局安装

全局安装会将模块安装到系统级目录中，所有项目都可以共享使用。

其优点包括：

- 节省重复安装带来的存储开销
- 可以直接在命令行中使用对应工具

但也存在一些问题：

- 不同项目可能依赖不同版本的工具
- 全局版本不易随项目进行隔离管理
- 多人协作时可能导致环境不一致

因此，一般遵循以下原则：

- **工具类模块** 更适合全局安装，例如 `typescript`、`pnpm`、`claude-code`
- **项目运行依赖** 通常采用本地安装，例如 `react`、`pinia`、`dayjs`

---

# 模块卸载

通过以下命令卸载模块：

```
npm uninstall <module-name>
```

如果需要卸载全局模块：

```
npm uninstall -g <module-name>
```

---

# 更新模块

可以使用以下命令更新依赖：

```
npm update <module-name>
```

如果不指定模块名称，则会更新当前项目中允许更新的所有依赖：

```
npm update
```

---

# 创建模块

创建 npm 模块时，`package.json` 文件是必不可少的。

可以通过以下命令初始化项目：

```
npm init
```

该命令会通过交互式方式生成 `package.json` 文件。

如果希望快速生成默认配置，可以使用：

```
npm init -y
```

---

## 发布模块

在发布模块之前，需要先登录 npm 账号。如果账号不存在，npm 会根据提示引导完成注册。

```
npm login
```

登录成功后，即可通过以下命令发布模块：

```
npm publish
```

发布完成后，其他开发者便可以通过 `npm install` 安装该模块。

---

# 版本号

在使用 npm 下载和发布模块时，经常会接触到版本号。

npm 使用的是 **语义化版本控制（Semantic Versioning）**。

版本格式如下：

```
MAJOR.MINOR.PATCH
```

例如：

```
1.4.2
```

---

## 版本号含义

### MAJOR（主版本号）

当进行了不兼容的 API 修改时递增。

例如：

```
2.0.0
```

通常意味着旧版本代码可能无法继续兼容。

---

### MINOR（次版本号）

当新增功能且保持向下兼容时递增。

例如：

```
1.1.0
```

---

### PATCH（补丁版本号）

当进行问题修复或小范围优化时递增。

例如：

```
1.0.1
```

---

## 额外标记

### 预发布版本

例如：

```
1.0.0-alpha
1.0.0-beta.1
```

表示当前版本仍处于测试阶段。

常见标记：

- alpha：早期测试版
- beta：公开测试版
- rc：候选发布版（Release Candidate）

---

### 构建元数据

例如：

```
1.0.0+build.1
```

用于记录构建信息，一般不会影响版本比较。

---

## 安装示例

安装指定版本：

```
npm install package-name@1.2.3
```

安装当前主版本下的最新兼容版本：

```
npm install package-name@^1.2.3
```

例如：

```
^1.2.3
```

通常会匹配：

```
1.x.x
```

但不会升级到 `2.x.x`。

---

# npm 常用命令

| 命令                                    | 说明                                       |
| ------------------------------------- | ---------------------------------------- |
| `npm init`                            | 交互式创建 `package.json` 文件                  |
| `npm init -y`                         | 快速生成默认 `package.json`                    |
| `npm install package-name`            | 本地安装指定依赖                                 |
| `npm install -g package-name`         | 全局安装指定模块                                 |
| `npm install`                         | 安装 `package.json` 中的所有依赖                 |
| `npm install package-name --save-dev` | 安装开发依赖                                   |
| `npm update package-name`             | 更新指定依赖                                   |
| `npm uninstall package-name`          | 卸载本地依赖                                   |
| `npm uninstall -g package-name`       | 卸载全局模块                                   |
| `npm ls`                              | 查看当前项目依赖树                                |
| `npm ls -g --depth=0`                 | 查看全局安装模块                                 |
| `npm info package-name`               | 查看模块详细信息                                 |
| `npm search keyword`                  | 搜索 npm 仓库中的模块                            |
| `npm login`                           | 登录 npm 账号                                |
| `npm publish`                         | 发布模块到 npm 仓库                             |
| `npm cache clean --force`             | 清理 npm 缓存                                |
| `npm audit`                           | 检查依赖中的安全漏洞                               |
| `npm audit fix`                       | 自动修复已知漏洞                                 |
| `npm outdated`                        | 查看可更新依赖                                  |
| `npm run script-name`                 | 运行脚本                                     |
| `npm start`                           | 运行 `start` 脚本                            |
| `npm test`                            | 运行 `test` 脚本                             |
| `npm version patch`                   | 更新补丁版本号                                  |
| `npm version minor`                   | 更新次版本号                                   |
| `npm version major`                   | 更新主版本号                                   |
| `npm ci`                              | 基于 `package-lock.json` 安装依赖，常用于 CI/CD 环境 |

# 参考资料
1. 菜鸟教程：
	https://www.runoob.com/nodejs/nodejs-npm.html
2. Semantic Versioning 官方规范：  
	https://semver.org/lang/zh-CN/