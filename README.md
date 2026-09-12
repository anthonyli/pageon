# PageOn

[English](README.md) · [简体中文](README.zh-CN.md)

A local HTML editor with a portable editing runtime. Open a file, convert it through the PageOn API, edit its text and download an HTML copy that remains editable.

**No sign-in, payments, API key or database setup is required.** The application starts locally; conversion of uploaded files uses a remote service. The bundled example works without that service.

The interface defaults to English. Use the **language icon + 中 / EN** button in the header to switch the home screen, editor and exported toolbar to Chinese. Your choice is remembered in this browser when storage is available. Switching languages keeps the current draft and does not translate the document content.

The example opens in the current interface language: English opens the English example; Chinese opens the Chinese example. Changing the interface language after opening does not replace the document content. Build output includes English examples and Chinese `.zh-CN.html` variants.

## Quick start

Requirements: Node.js 22.12 or newer and npm 10 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal, normally `http://127.0.0.1:5173`. No `.env` file is required. Click **Try an offline example** to start immediately, even if the remote conversion endpoint is unavailable.

For a clean reproducible installation, use `npm ci` instead of `npm install`.

## Use your own HTML

1. Choose or drop an `.html` or `.htm` file, up to 1 MiB.
2. Conversion starts automatically and opens the editor when complete. If it fails, use **Retry conversion**.
3. Edit static text, including supported SVG text. Switch to **Done** to preview the original page interactions.
4. In the editor, choose a floating or sidebar toolbar for the exported file and select **Download HTML**.
5. Open the downloaded file directly and use its built-in editing controls.

Files, converted results and drafts stay in tab memory after conversion. **Download before refreshing or closing the tab.** A started browser download does not guarantee the file was saved by the browser. External fonts, images, scripts and CDN resources in your document may still require a network connection.

## Conversion API

HTML conversion automatically uses the official PageOn API. **No environment variables, API key or service setup are required.**

```text
https://pageon.cc/api/open-source/transform
```

An internet connection is required to convert your own files. Your HTML is sent to PageOn for conversion; editing and downloading happen locally afterward. The bundled examples work without the conversion service.

The official API returns HTML with PageOn branding and a fixed link to **https://pageon.cc**. If conversion fails or the service is busy, retry later.

## Customize editing interactions

The same Runtime powers floating controls, a sidebar, and custom controls. PageOn attribution remains visible and links to **https://pageon.cc**. No public option disables, renames or redirects it. Website paid exports remain a separate official service.

```js
import { createRuntime } from '@pageon/runtime';

// Only mount directly into a trusted document, never an untrusted upload.
const runtime = createRuntime({
  document,
  fileName: 'my-page.html',
  ui: 'sidebar', // 'floating', 'sidebar', or false for custom controls
});

runtime.enterEdit();
runtime.on('selectionchange', selection => console.log(selection));
runtime.exitEdit();
await runtime.save();
```

`ui: false` hides the built-in editing buttons, not the brand. The controller exposes `enterEdit`, `exitEdit`, `getSelection`, `apply`, `serialize`, `save`, `on` and `destroy`. The controller is also available as `window.PageOnRuntime` in exported files. `Ctrl+Alt+E` toggles editing; `Ctrl+Alt+S` saves a copy.

`apply({ type: 'set-text', nodeId, value })` edits a selected plain-text node. It rejects structured nodes with child elements so links and formatting are not silently replaced. The node ID is stable within an editing session, not a universal ID across arbitrary document rewrites. `serialize()` synchronously returns `{ html, fileName, runtimeVersion }`. `save()` uses a single-flight guard and returns a Promise.

An optional `onSave(artifact)` callback changes the host's storage behavior for the current session. JavaScript closures and host callbacks are not serialized into downloaded files; those files use the default local download behavior. Use the `examples/custom-controls.html` example for self-contained custom controls. Mark their UI container with `data-pageon-extension` so it is not editable; such temporary UI is removed from saved copies and recreated by its own script.

The Runtime factory serializes self-contained functions. The provided build preserves these functions without minification. Custom bundlers must preserve this behavior and test the actual saved HTML, not only the application bundle.

## Build and test

```bash
npm test
npm run build
npm run preview
```

`dist/` contains the static application. `dist/runtime/pageon-runtime.js` is a self-contained browser script. The root `examples/` directory contains standalone HTML examples checked into the repository, so you can open them without installing dependencies or building:

| Controls | English | 简体中文 |
| --- | --- | --- |
| Floating | [Open example](examples/floating.html) | [打开示例](examples/floating.zh-CN.html) |
| Sidebar | [Open example](examples/sidebar.html) | [打开示例](examples/sidebar.zh-CN.html) |
| Custom | [Open example](examples/custom-controls.html) | [打开示例](examples/custom-controls.zh-CN.html) |

The examples are generated from the shared sample and Runtime. After changing their source, regenerate them with:

```bash
npm run build:runtime
```

## Project structure

```text
examples/              Standalone English and Chinese HTML examples
apps/playground/       Local application
packages/editor/       Shared React editor and isolated preview
packages/runtime/      Portable editing runtime and HTML assembly
packages/protocol/     Public conversion contract
packages/api-client/   Anonymous conversion client
packages/ui/           Editor UI dependencies
tests/public/          Tests independent of the private converter
scripts/               Runtime/example builds
```

All workspace packages are local and marked `private: true`. No npm publication is required to run this project.

## Compatibility and boundaries

- Static HTML and supported SVG text can be edited and saved.
- Editing uses a script-disabled document; interactive preview uses a separate opaque-origin iframe. Do not combine `allow-scripts` and `allow-same-origin` for untrusted uploads.
- React/Vue-managed dynamic text is not written back into JSX, component state or templates. Runtime edits to such text may be temporary.
- The sample fixture is trusted, original content. It is not a sanitizer for uploaded HTML.
- There is no template marketplace, paid template content, cloud file storage or checkout in this app.
- Brand rules describe the official API and unmodified distribution; editable source and HTML cannot provide absolute tamper prevention.

## Contributing and license

Issues and contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

PageOn-authored code, documentation and original examples in this repository are licensed under the **MIT License**. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The private converter, account and payment systems, and paid templates are outside this distribution and its license.

The official conversion API for this app always returns HTML with PageOn branding and a fixed `https://pageon.cc` link; callers cannot disable or replace either. The official Runtime and application retain this behavior. These are official service and product rules, not additional MIT conditions: MIT permits modified versions, including changes to the branding code, provided the required copyright and permission notices are retained. The software license does not imply PageOn endorsement of a fork.
