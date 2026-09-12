import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { DOMParser } from "linkedom";
import { createRuntimeCode } from "@pageon/runtime";
import { createDemo } from "../apps/playground/src/demo.js";

const root = fileURLToPath(new URL("..", import.meta.url));
await mkdir(resolve(root, "dist/runtime"), { recursive: true });
await mkdir(resolve(root, "examples"), { recursive: true });
await writeFile(resolve(root, "dist/runtime/pageon-runtime.js"), createRuntimeCode());
for (const lang of ["en", "zh"]) {
  const suffix = lang === "zh" ? ".zh-CN" : "";
  for (const ui of ["floating", "sidebar"]) {
    await writeFile(resolve(root, `examples/${ui}${suffix}.html`), createDemo(ui, lang, DOMParser).exportTemplate);
  }
const custom = createDemo(false, lang, DOMParser).exportTemplate.replace("</body>", `<script>
(() => {
  const controls = document.createElement('aside');
  controls.setAttribute('data-pageon-extension', '');
  controls.style.cssText = 'position:fixed;top:12px;left:12px;display:flex;gap:8px;padding:12px;background:#173c35;border-radius:10px;z-index:99999';
  ${JSON.stringify(lang === 'zh' ? [['编辑', 'enterEdit'], ['完成', 'exitEdit'], ['保存副本', 'save']] : [['Edit', 'enterEdit'], ['Done', 'exitEdit'], ['Save copy', 'save']])}.forEach(([label, method]) => {
    const button = document.createElement('button'); button.textContent = label;
    button.style.cssText = 'background:white;color:#173c35;padding:8px 12px;border:0;border-radius:6px;cursor:pointer';
    button.addEventListener('click', () => Promise.resolve(window.PageOnRuntime[method]()).catch(() => alert(${JSON.stringify(lang === 'zh' ? '保存失败，请重试。' : 'Save failed. Please try again.')})));
    controls.appendChild(button);
  });
  document.body.appendChild(controls);
})();
</script></body>`);
  await writeFile(resolve(root, `examples/custom-controls${suffix}.html`), custom);
}
console.log("Built Runtime in dist/runtime/ and 6 bilingual HTML examples in examples/.");
