# PageOn

[English](README.md) · [简体中文](README.zh-CN.md)

可以本地运行的 HTML 编辑器。通过官网 API 转换 HTML 后，本地编辑并下载；导出的文件自带编辑 Runtime，重新打开后可以继续修改。

**无需登录、支付、API Key 或数据库。** 本地启动与完全离线处理是两回事：上传自己的文件需要远程转换；内置示例不依赖转换服务。

界面默认使用英文。通过顶部 **语言图标 + 中 / EN** 按钮 可切换首页、编辑器及导出工具栏的语言；浏览器允许存储时会记住选择。切换语言会保留当前编辑内容，不会翻译文档正文。

示例按进入时的界面语言打开：英文界面打开英文示例，中文界面打开中文示例。打开后切换界面语言不会替换文档正文。构建产物包含英文示例及中文 `.zh-CN.html` 版本。

## 本地启动

需要 Node.js 22.12 或更新版本，以及 npm 10 或更新版本。

```bash
npm install
npm run dev
```

打开终端显示的地址，默认是 `http://127.0.0.1:5173`。无需配置 `.env`。点击 **Try an offline example** 即可使用内置示例，即使远程服务不可用也能编辑和下载。复现锁文件中的依赖时使用 `npm ci`。

## 编辑自己的文件

1. 选择或拖入 `.html` / `.htm` 文件，最大 1 MiB。
2. 自动开始转换，完成后直接进入编辑；失败时可点击 **重试转换**。
3. 编辑静态文字或支持的 SVG 文字，点击 **Done** 预览原页面交互。
4. 在编辑界面中选择导出文件的浮动工具栏或侧边栏，点击 **Download HTML**。
5. 直接打开下载的文件，用内置工具栏继续编辑。

转换后的文件和草稿只保存在当前标签页内存中。**刷新或关闭前请下载保存。** 下载已启动不等于浏览器已成功保存文件。原 HTML 的外部图片、字体、脚本和 CDN 资源仍可能需要网络。

## 官网转换 API

HTML 转换默认直接调用 PageOn 官网 API，**无需配置环境变量、API Key 或自行搭建服务**。

```text
https://pageon.cc/api/open-source/transform
```

转换自己的文件需要联网，HTML 会发送到官网进行转换；后续编辑和下载在本地完成。内置示例不依赖转换服务。

官方接口生成的 HTML 带有 PageOn 品牌，链接固定为 **https://pageon.cc**。遇到转换失败或服务繁忙时，稍后重试即可。

## 定制交互

浮动工具栏、侧边栏和自定义控件使用同一个 Runtime。品牌保留，跳转固定为 **https://pageon.cc**，不提供关闭、替换或修改地址的公共配置。官网付费去品牌属于独立的官方服务。

```js
import { createRuntime } from '@pageon/runtime';

// 只对可信文档直接挂载；不要直接挂载未经处理的上传内容。
const runtime = createRuntime({ document, fileName: 'my-page.html', ui: 'sidebar' });
runtime.enterEdit();
runtime.on('selectionchange', selection => console.log(selection));
runtime.exitEdit();
await runtime.save();
```

`ui` 支持 `floating`、`sidebar`、`false`。`false` 只隐藏默认编辑按钮，品牌仍保留。控制器提供 `enterEdit`、`exitEdit`、`getSelection`、`apply`、`serialize`、`save`、`on` 和 `destroy`；导出文件中也可通过 `window.PageOnRuntime` 使用。`Ctrl+Alt+E` 切换编辑，`Ctrl+Alt+S` 保存副本。

`apply({ type: 'set-text', nodeId, value })` 用于纯文字节点，不会覆盖包含子元素的复杂结构。节点 ID 只在本次编辑会话中稳定。`serialize()` 同步返回 `{ html, fileName, runtimeVersion }`；`save()` 返回 Promise，防止同一实例重复执行保存。

`onSave(artifact)` 可替换当前宿主的保存方式，但闭包和回调不会自动写进下载文件；下载文件默认仍使用本地保存。需要自包含的定制控件时参考根目录的 `examples/custom-controls.html`。控件容器标记 `data-pageon-extension`，避免被识别成可编辑正文；保存时清除临时控件，重新打开时由其脚本重建。

Runtime 使用自包含函数生成单文件脚本，项目提供的构建不压缩这些函数。更换构建工具时，需要验证生成并保存的 HTML 能继续运行。

## 构建与测试

```bash
npm test
npm run build
npm run preview
```

`dist/` 包含本地应用的静态产物，`dist/runtime/pageon-runtime.js` 为自包含脚本；根目录 `examples/` 中的示例会随仓库一起提供，无需安装依赖或构建，即可下载后双击打开。

| 工具栏 | English | 简体中文 |
| --- | --- | --- |
| 悬浮 | [Open example](examples/floating.html) | [打开示例](examples/floating.zh-CN.html) |
| 侧边 | [Open example](examples/sidebar.html) | [打开示例](examples/sidebar.zh-CN.html) |
| 自定义 | [Open example](examples/custom-controls.html) | [打开示例](examples/custom-controls.zh-CN.html) |

示例由共享示例源码与 Runtime 自动生成。修改源码后，运行 `npm run build:runtime` 更新示例，避免直接维护生成的 HTML。

源码目录：`apps/playground` 是本地应用，`packages` 下包含共享编辑器、Runtime、公开协议、客户端和必要 UI，`tests/public` 是不依赖私有转换器的测试。所有包保持 `private: true`，本地运行不要求发布 npm。

## 能力边界

- 支持静态 HTML 和 SVG 文字；React/Vue 动态文字不承诺回写组件源码、状态或模板。
- 编辑文档禁用原脚本；交互预览使用隔离来源。不要同时给上传内容开放 `allow-scripts` 与 `allow-same-origin`。
- 内置示例是原创可信内容，不是任意上传 HTML 的清洗器。
- 不包含模板广场、付费模板、云文件存储或收银台。
- 品牌约束适用于官方 API 与未修改的发行版；源码和 HTML 可编辑，不能提供绝对防篡改保护。

## 贡献与许可

欢迎反馈问题和贡献改进，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

本仓库中 PageOn 原创代码、文档和示例采用 **MIT 许可证**。参见 [LICENSE](LICENSE) 和 [第三方说明](THIRD_PARTY_NOTICES.md)。私有转换核心、账户支付系统及付费模板不在本发行目录及其许可范围内。

本项目使用的官方转换接口必须生成带 PageOn 品牌的 HTML，链接固定为 `https://pageon.cc`，调用方不能通过参数关闭品牌或更换链接。官方 Runtime 和应用保持这一行为。这是官方服务和产品规则，不是 MIT 的附加限制：在保留必要版权与许可声明的前提下，MIT 允许修改软件，包括品牌相关代码。代码许可不代表 PageOn 对第三方分支的背书。
