在前端项目中，我们经常会见到 `package.json` 这个文件，但很多人并没有真正了解它的作用。简单来说，`package.json` 就像项目的“说明书”与“配置中心”，既提供给开发者阅读，也会被 npm、pnpm、yarn 等包管理工具以及 Node.js 生态中的各种工具自动解析和使用。

它主要用于描述一个项目的基本信息、依赖关系、脚本命令以及运行配置等内容。

类似的配置文件在其他技术生态中也很常见，例如：

- Maven 的 `pom.xml`
- Gradle 的 `build.gradle`
- Python 的 `pyproject.toml`
- Rust 的 `Cargo.toml`

它们本质上都属于“项目元数据配置文件”，用于告诉构建工具或包管理工具如何管理项目。

---

## package.json 的作用

`package.json` 的核心作用主要包括以下几个方面：

- 描述项目信息（名称、版本、作者等）
- 管理项目依赖
- 定义项目脚本命令
- 指定运行环境要求
- 配置模块入口
- 为构建工具提供配置
- 支持项目发布到 npm 仓库

---

## package.json 的生成方式

通常在创建项目时，脚手架工具（如 Vite、Vue CLI、Create React App 等）会自动帮我们生成 `package.json` 文件。

当然，也可以手动初始化：

```
npm init
```

快速生成默认配置：

```
npm init -y
```

生成后，文件通常位于项目根目录：

```
project/
├── src/
├── public/
├── node_modules/
├── package.json
└── package-lock.json
```

---

## package.json 与依赖安装

项目创建完成后，通常需要安装依赖：

```
npm install
```

执行后，npm 会读取 `package.json` 中记录的依赖信息，并自动下载对应的第三方包。

例如：

```
{  
	"dependencies": {    
		"vue": "^3.5.0"  
	}
}
```

npm 会自动安装 Vue。

---

# package.json 常见字段

下面是 `package.json` 中最常见、最重要的一些字段。

---

## name

项目名称。

```
{  
	"name": "my-project"
}
```

注意：

- npm 包名通常要求全小写
- 不能包含空格
- 发布到 npm 时必须唯一

---

## version

项目版本号。

```
{  
	"version": "1.0.0"
}
```

通常遵循 SemVer（语义化版本）规范：

```
主版本号.次版本号.修订号
MAJOR.MINOR.PATCH
```

例如：

```
1.4.2
```

含义：

- MAJOR：破坏性更新
- MINOR：功能新增
- PATCH：问题修复

---

## description

项目描述信息。

```
{  
	"description": "A modern Vue application"
}
```

---

## keywords

项目关键词。

```
{  
	"keywords": ["vue", "vite", "frontend"]
}
```

主要用于 npm 搜索。

---

## author

作者信息。

```
{  
	"author": "xiaf"
}
```

也可以写成：

```
{  
	"author": {    
		"name": "xiaf",    
		"email": "example@gmail.com"  
	}
}
```

---

## license

开源协议。

```
{  
	"license": "MIT"
}
```

常见协议：

- MIT
- Apache-2.0
- GPL
- ISC

---

## scripts

定义脚本命令。

这是前端项目中最常用的字段之一。

```
{  
	"scripts": {    
		"dev": "vite",    
		"build": "vite build",    
		"test": "vitest"  
	}
}
```

执行方式：

```
npm run dev
npm run build
```

其中部分命令可以省略 `run`：

```
npm start
npm test
```

本质上，`scripts` 是对命令的封装，方便统一项目操作。

---

## dependencies

生产环境依赖。

```
{  
	"dependencies": {    
		"vue": "^3.5.0",    
		"axios": "^1.8.0"  
	}
}
```

这些依赖通常在项目运行时需要使用。

例如：

- Vue
- React
- Axios
- Express

安装命令：

```
npm install axios
```

---

## devDependencies

开发环境依赖。

```
{  
	"devDependencies": {    
		"vite": "^7.0.0",    
		"eslint": "^9.0.0"  
	}
}
```

这类依赖仅在开发阶段使用。

例如：

- Vite
- Webpack
- ESLint
- TypeScript
- Vitest

安装命令：

```
npm install vite -D
```

等价于：

```
npm install vite --save-dev
```

---

## peerDependencies

对宿主环境依赖的声明。

常用于插件开发。

例如：

```
{  
	"peerDependencies": {    
		"react": "^18.0.0"  
	}
}
```

含义：

当前库需要宿主项目自行安装 React。

典型场景：

- React 插件
- Vue 插件
- ESLint 插件

---

## optionalDependencies

可选依赖。

即使安装失败，也不会导致整个安装过程失败。

```
{  
	"optionalDependencies": {    
		"fsevents": "^2.3.0"  
	}
}
```

常用于：

- 平台相关依赖
- 可选功能模块

---

## engines

指定运行环境。

```
{  
	"engines": {    
		"node": ">=20",    
		"npm": ">=10"  
	}
}
```

用于限制 Node.js 或 npm 版本。

---

## type

指定模块类型。

```
{  
	"type": "module"
}
```

常见值：

- `commonjs`
- `module`

影响：

- 是否使用 `import/export`
- Node.js 如何解析模块

---

## main

项目入口文件。

```
{  
	"main": "index.js"
}
```

CommonJS 项目中较常见。

---

## module

ES Module 入口。

```
{  
	"module": "dist/index.esm.js"
}
```

常用于库开发。

---

## exports

显式声明导出内容。

```
{  
	"exports": {    
		".": "./dist/index.js"  
	}
}
```

相比 `main` 更现代、更安全。

---

## bin

定义全局命令。

```
{  
	"bin": {    
		"my-cli": "./bin/index.js"  
	}
}
```

常用于 CLI 工具开发。

例如：

```
npm install -g my-cli
```

安装后即可直接执行：

```
my-cli
```

---

## private

是否私有项目。

```
{  
	"private": true
}
```

设置后无法发布到 npm。

前端业务项目通常都会开启。

---

## workspaces

Monorepo 工作区配置。

```
{  
	"workspaces": [ "packages/*" ]
}
```

常用于：

- pnpm workspace
- npm workspace
- Monorepo 项目

---

## packageManager

指定推荐的包管理工具。

```
{  
	"packageManager": "pnpm@10.0.0"
}
```

用于统一团队环境。

---

# 一个典型的 package.json 示例

```
{  
	"name": "smart-vision",  
	"version": "1.0.0",  
	"private": true,  
	"type": "module",  
	"scripts": {    
		"dev": "vite",    
		"build": "vite build",    
		"preview": "vite preview"  
	},  
	"dependencies": {    
		"vue": "^3.5.0",    
		"axios": "^1.8.0"  
	},  
	"devDependencies": {    
		"vite": "^7.0.0",    
		"@vitejs/plugin-vue": "^6.0.0"  
	},  
	"engines": {    
		"node": ">=20"  
	}
}
```

---

# package.json 与 package-lock.json 的关系

- `package.json`
    - 记录“依赖规则”
    - 更偏向人为维护
- `package-lock.json`
    - 记录“实际安装结果”
    - 保证团队依赖一致性

例如：

```
"vue": "^3.5.0"
```

允许安装：

```
3.5.1
3.5.2
3.5.8
```

而 `package-lock.json` 会精确记录：

```
vue@3.5.8
```

避免不同环境安装出不同版本。

---

# 总结

`package.json` 是 Node.js 与前端工程化体系中的核心配置文件之一。

它不仅仅是一个“依赖列表”，更是整个项目的：

- 元数据中心
- 依赖管理中心
- 构建配置入口
- 脚本调度中心

现代前端项目中的很多工具：

- Vite
- Webpack
- ESLint
- TypeScript
- Vitest
- Babel

都会读取 `package.json` 中的信息进行工作，因此理解它的结构和作用非常重要。

---

# 参考资料

1. npm 官方文档：npm Docs
	https://docs.npmjs.com/cli/v10/configuring-npm/package-json
2. package.json 最全详解-CSDN博客
	https://blog.csdn.net/qq_34703156/article/details/121401990