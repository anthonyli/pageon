// Original PageOn example shared by the website and offline playground.
const copy = {
  "en": {
    "title": "PageOn Editable HTML Example",
    "label": "PageOn · Portable Editable HTML",
    "heading": "This page is just the beginning.",
    "intro": "This is a PageOn HTML example. Click text to make changes, then export a standalone file you can keep editing offline, with no software to install.",
    "storageTitle": "Cloud file storage",
    "storageBody": "Your files are never stored on our servers.",
    "shareTitle": "Shareable file",
    "shareBody": "Export once. Anyone receiving the file can open it, edit it, and save another copy.",
    "editsTitle": "Local edits",
    "editsBody": "Edit locally as often as you like. No account or additional payment required."
  },
  "zh": {
    "title": "PageOn 可编辑内容示例",
    "label": "PageOn · 可携带的可编辑 HTML",
    "heading": "这一页，不是终点。",
    "intro": "这是一份 PageOn 示例 HTML。直接点击文字修改，再导出为无需安装软件、离线也能继续编辑的独立文件。",
    "storageTitle": "云端文件存储",
    "storageBody": "你的文件不会被保存在我们的服务器上。",
    "shareTitle": "可传播文件",
    "shareBody": "一次导出，接收者也可以打开、编辑和继续保存。",
    "editsTitle": "本地修改次数",
    "editsBody": "本地使用不计次数，不需要账号，也不会二次收费。"
  }
};

export function getDemoHtml(lang = "en") {
  const language = lang === "zh" ? "zh" : "en";
  const text = copy[language];
  return `<!doctype html>
<html lang="${language === "zh" ? "zh-CN" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${text.title}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#071a1d;color:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}main{min-height:100vh;padding:7vw;background:radial-gradient(circle at 78% 16%,rgba(31,157,139,.16),transparent 34%),#071a1d}.label{margin:0;color:#35bba7;font-size:12px;font-weight:760;letter-spacing:.16em;text-transform:uppercase}h1{max-width:850px;margin:22px 0 18px;font-size:clamp(42px,7vw,76px);line-height:1.03;letter-spacing:-.05em;font-weight:730}main>p{max-width:760px;margin:0;color:rgba(255,255,255,.66);font-size:18px;line-height:1.75}.metrics{margin-top:50px;display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.card{min-height:190px;padding:24px;border:1px solid rgba(255,255,255,.11);border-radius:16px;background:#0d2629}.metric{color:#35bba7;font-size:42px;font-weight:760}.card h2{margin:28px 0 8px;font-size:17px}.card p{margin:0;color:rgba(255,255,255,.58);font-size:14px;line-height:1.6}@media(max-width:680px){main{padding:54px 24px}.metrics{grid-template-columns:1fr}h1{font-size:44px}}
  </style>
</head>
<body>
  <main>
    <p class="label">${text.label}</p>
    <h1>${text.heading}</h1>
    <p>${text.intro}</p>
    <section class="metrics">
      <article class="card"><div class="metric">0</div><h2>${text.storageTitle}</h2><p>${text.storageBody}</p></article>
      <article class="card"><div class="metric">1</div><h2>${text.shareTitle}</h2><p>${text.shareBody}</p></article>
      <article class="card"><div class="metric">∞</div><h2>${text.editsTitle}</h2><p>${text.editsBody}</p></article>
    </section>
  </main>
</body>
</html>`;

}

export const demoHtml = getDemoHtml();
