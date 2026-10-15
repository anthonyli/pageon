import { createNoteAnimations, NOTE_ANIMATIONS } from "@pageon/note-animations";

export const NOTE_ATTRIBUTE = "data-pageon-note";
export const NOTE_ANIMATION_ATTRIBUTE = "data-pageon-note-animation";
export const readNoteAnimation = node => node?.getAttribute(NOTE_ANIMATION_ATTRIBUTE) || "none";
export const readNoteCharacter = node => node?.getAttribute("data-pageon-note-character") || "";
export const readNoteColor = node => {
  const color = node?.getAttribute("data-pageon-note-color");
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color.toLowerCase() : "#ffcc39";
};
export const NOTE_MARKER_MODES = [
  { id: "auto", label: "自动" }, { id: "always", label: "始终显示" }, { id: "edit", label: "仅编辑时显示" },
];
export function readNoteMarkerMode(doc) {
  const mode = doc?.documentElement?.getAttribute("data-pageon-note-markers");
  return ["always", "edit"].includes(mode) ? mode : "auto";
}
export function recordNoteMarkerMode(entries, doc, mode) {
  if (!doc?.documentElement || !["auto", "always", "edit"].includes(mode) || readNoteMarkerMode(doc) === mode) return false;
  doc.documentElement.setAttribute("data-pageon-note-markers", mode);
  entries.set("$pageon-notes", { noteMarkers: mode });
  return true;
}
export const NOTE_LIMIT = 2000;
export const NOTE_MESSAGES = {
  "文字批注普通导出免费；角色形象仅高级导出支持。": "Text notes are free with standard export. Character notes require premium export.",
  "角色形象仅高级导出支持 · 1 Credit": "Character notes require premium export · 1 Credit",
  "此文件包含角色批注，请选择高级导出；如需免费普通导出，请先将出现方式改为无动画。": "This file contains character notes. Choose premium export, or change their entrance animation to None for free standard export.",

  "角色形象": "Character",
  "圆圈": "Circle",
  "角色颜色": "Character color",
  "批注颜色": "Note color",
  "划选文字颜色": "Selected text color",
  "使用原色": "Use original color",
  "自定义颜色": "Custom color",
  "更多设置": "More settings",
  "批注标记（整个文档）": "Note markers (whole document)",
  "自动": "Auto",
  "始终显示": "Always show",
  "仅编辑时显示": "Show only while editing",
  "自动：演示稿预览和播放时隐藏序号，普通文档显示。高亮背景始终保留。": "Auto: hide numbers when previewing or presenting slides; show them in ordinary documents. Highlight backgrounds stay visible.",
  "软糖": "Jelly",
  "小星": "Spark",
  "小蛙": "Frog",
  "自己的图片": "My image",
  "上传角色图片": "Upload character image",
  "选择图片": "Choose image",
  "已保存自定义图片": "Custom image saved",
  "尚未选择图片": "No image selected",
  "支持 PNG、WebP、JPG（最大 2 MB），推荐透明背景。图片随 HTML 保存。": "PNG, WebP or JPG, up to 2 MB. Transparent backgrounds work best. The image is saved in the HTML.",
  "图片无法读取，请选择 2 MB 以内的 PNG、WebP 或 JPG。": "Could not read the image. Choose a PNG, WebP or JPG under 2 MB.",
  "正在处理图片…": "Processing image\u2026",
  "随机跳跃、滚动或滑行，停稳后在角色旁显示文字。": "A random hop, roll or glide, then text appears beside the character.",
  "预览效果": "Preview",

  "出现方式": "Entrance animation",
  ...Object.fromEntries(NOTE_ANIMATIONS.map(effect => [effect.label.zh, effect.label.en])),
  "点击标记查看；幻灯片按空格逐条显示，每条 2 秒。": "Click a marker to read. In slides, press Space for each note, shown for 2 seconds.",
  "批注": "Notes",
  "批注内容": "Note text",
  "选择页面中的内容以添加批注。": "Select content in the page to add a note.",
  "批注会随 HTML 保存；点击标记查看。幻灯片中按空格逐条显示，每条 2 秒。": "Notes are saved in the HTML. Click a marker to read one. In slides, press Space to show each note for 2 seconds.",
  "保存批注": "Save note",
  "删除批注": "Delete note",
  "修改批注": "Edit note",
  "收起批注": "Collapse notes",
  "登录后可导出带批注的 HTML": "Sign in to export HTML with notes",
  "登录状态暂时无法验证，请稍后重试。": "Could not verify your sign-in. Please try again later.",
};

export function readNote(node) {
  return (node?.getAttribute(NOTE_ATTRIBUTE) || "").slice(0, NOTE_LIMIT);
}

export function setNote(node, text, animation = readNoteAnimation(node), character = readNoteCharacter(node), color = readNoteColor(node)) {
  const note = typeof text === "string" ? text.trim().slice(0, NOTE_LIMIT) : "";
  if (note && typeof character === "string" && character.length <= 190000 && character) node.setAttribute("data-pageon-note-character", character);
  else node.removeAttribute("data-pageon-note-character");
  if (note && /^#[0-9a-f]{6}$/i.test(color || "")) node.setAttribute("data-pageon-note-color", color.toLowerCase());
  else node.removeAttribute("data-pageon-note-color");
  if (note) node.setAttribute(NOTE_ATTRIBUTE, note);
  else node.removeAttribute(NOTE_ATTRIBUTE);
  if (note && typeof animation === "string" && animation !== "none") node.setAttribute(NOTE_ANIMATION_ATTRIBUTE, animation);
  else node.removeAttribute(NOTE_ANIMATION_ATTRIBUTE);
}

export function recordNote(entries, node, text) {
  const id = node?.getAttribute("data-artifact-edit") || node?.getAttribute("data-artifact-node");
  if (!id || !node.isConnected) return false;
  const note = typeof text === "string" ? text.trim().slice(0, NOTE_LIMIT) : "";
  if (note === readNote(node)) return false;
  const previous = entries.get(id);
  entries.set(id, { ...(typeof previous === "string" ? { html: previous } : previous), note });
  setNote(node, note);
  return true;
}

export function applyNoteEntries(doc, entries, findNode) {
  for (const [id, value] of entries) {
    if (id === "$pageon-notes" && ["auto", "always", "edit"].includes(value?.noteMarkers)) {
      doc.documentElement.setAttribute("data-pageon-note-markers", value.noteMarkers);
      continue;
    }
    if (typeof value?.note !== "string") continue;
    const node = findNode(doc, id);
    if (node) setNote(node, value.note, value.noteAnimation ?? readNoteAnimation(node), value.noteCharacter ?? readNoteCharacter(node), value.noteColor ?? readNoteColor(node));
  }
}

export function hasDocumentNotes(html) {
  if (!html || !html.includes(NOTE_ATTRIBUTE)) return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll(`[${NOTE_ATTRIBUTE}]`)].some(node => readNote(node).trim());
}

export function hasDocumentCharacterNotes(html) {
  if (!html || !html.includes(NOTE_ANIMATION_ATTRIBUTE)) return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll(`[${NOTE_ATTRIBUTE}]`)].some(node => readNote(node).trim() && readNoteAnimation(node) === "companion");
}

// Run before the page's own keyboard listeners. The payload is self-contained,
// with note text stored only in escaped HTML attributes, never in JavaScript.
export function attachNotesRuntime(doc, { noteCharacters = true } = {}) {
  doc.querySelectorAll("#pageon-notes-script,pageon-notes").forEach(node => node.remove());
  if (![...doc.querySelectorAll(`[${NOTE_ATTRIBUTE}]`)].some(node => readNote(node).trim())) return;
  const script = doc.createElement("script");
  script.id = "pageon-notes-script";
  script.textContent = `(${installNotes.toString()})(document, window, {noteCharacters:${!!noteCharacters}}, ${createNoteAnimations.toString()});`.replace(/<\/script/gi, "<\\/script");
  doc.head.prepend(script);
}

/** Shared by sanitized editor views and exported/preview HTML. */
export function installNotes(doc, win, { onSelect, lang, noteCharacters = true } = {}, animationsFactory = createNoteAnimations) {
  win.PageOnNotes?.destroy();
  const animations = animationsFactory({ allowCharacters: noteCharacters });
  const markersHidden = new win.URLSearchParams(win.location?.search || "").get("pageon-notes") === "off";
  const attr = "data-pageon-note";
  const text = node => (node?.getAttribute(attr) || "").trim().slice(0, 2000);
  const unique = items => {
    const seen = new Set();
    return items.filter(node => { const group = node.getAttribute('data-pageon-note-range'); if (!group) return true; if (seen.has(group)) return false; seen.add(group); return true; });
  };
  const zh = (lang || doc.documentElement.lang || "en").startsWith("zh");
  const slideSelector = ".slide,[data-slide],.reveal .slides section";
  let presenter, host, root, tip, observer, frame, timer, currentSlide, shown = 0, spaceDown = false, destroyed = false;
  let nodes = [];
  const markers = new Map();
  const cleanups = [];
  let inputGuard = null;
  const listen = (target, type, handler, capture = false) => {
    target.addEventListener(type, handler, capture);
    cleanups.push(() => target.removeEventListener(type, handler, capture));
  };
  const editing = () => !!onSelect || doc.documentElement.dataset.artifactMode === "edit" ||
    doc.documentElement.dataset.artifactLocalEdit === "true";
  const visibleRect = node => {
    if (!node?.isConnected || node.closest('[hidden],[inert],[aria-hidden="true"]')) return null;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = win.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return null;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= win.innerHeight || rect.left >= win.innerWidth) return null;
    return rect;
  };
  const isPresentation = () => {
    const groups = new Map();
    for (const slide of doc.querySelectorAll(slideSelector)) {
      if (slide.querySelector(slideSelector) || slide.closest('[data-pageon-extension],[data-artifact-no-reveal],[role="dialog"],.carousel,.swiper,.slider,[aria-roledescription="carousel"]')) continue;
      if (slide.closest('.reveal .slides')) return true;
      const siblings = groups.get(slide.parentElement) || [];
      siblings.push(slide); groups.set(slide.parentElement, siblings);
    }
    for (const [parent, slides] of groups) {
      if (slides.length < 2) continue;
      if (slides.some(slide => slide.hasAttribute('data-slide')) || parent.matches('.slides,.slide-container,.presentation,.deck,[data-presentation]')) return true;
      // A generic .slide class alone is insufficient: ordinary cards and
      // carousels use it too. Require a page-sized slide on screen.
      if (slides.some(slide => {
        const rect = visibleRect(slide);
        return rect && rect.width >= win.innerWidth * .6 && rect.height >= win.innerHeight * .6;
      })) return true;
    }
    return false;
  };
  const activeSlide = () => {
    const slides = [...doc.querySelectorAll(slideSelector)].filter(node =>
      !node.querySelector(slideSelector) && !node.closest('[data-artifact-no-reveal],[role="dialog"],[data-pageon-extension]'));
    if (slides.length < 2) return null;
    const candidates = slides.map(node => ({ node, rect: visibleRect(node) })).filter(item => item.rect);
    const active = candidates.filter(({ node }) => node.matches('.active,.present,[data-active="true"],[aria-current="true"]'));
    return (active.length ? active : candidates).sort((a, b) => {
      const area = ({ rect }) => Math.max(0, Math.min(rect.right, win.innerWidth) - Math.max(0, rect.left)) *
        Math.max(0, Math.min(rect.bottom, win.innerHeight) - Math.max(0, rect.top));
      return area(b) - area(a);
    })[0]?.node || null;
  };
  const hide = () => {
    win.clearTimeout(timer);
    presenter?.cancel(); presenter = null;
    if (tip) animations.cancel(tip);
    if (tip) { tip.hidden = true; tip.textContent = ""; }
  };
  const syncSlide = () => {
    const next = activeSlide();
    if (next !== currentSlide) { currentSlide = next; shown = 0; hide(); }
    return next;
  };
  const show = node => {
    hide();
    if (!tip || !text(node)) return;
    tip.textContent = text(node);
    tip.hidden = false;
    if (animations.present && node.getAttribute("data-pageon-note-animation") === "companion") {
      presenter = animations.present({ tip, root, node, character: node.getAttribute("data-pageon-note-character"),
        onSettled: () => { timer = win.setTimeout(hide, 2000); } });
    } else {
      animations.play(tip, node.getAttribute("data-pageon-note-animation"));
      timer = win.setTimeout(hide, 2000);
    }
  };
  const refresh = () => {
    if (destroyed || !doc.body) return;
    if (!host) {
      host = doc.createElement("pageon-notes");
      host.setAttribute("data-artifact-no-edit", "");
      host.setAttribute("data-pageon-extension", "");
      host.style.cssText = "position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;display:block!important;overflow:hidden!important;";
      root = host.attachShadow({ mode: "open" });
      const style = doc.createElement("style");
      style.textContent = ':host{font:14px/1.5 system-ui,sans-serif;color-scheme:light dark}button{position:fixed;pointer-events:auto;width:24px;height:24px;padding:0;border:1px solid #fff;border-radius:50%;background:#0f766e;color:#fff;font:bold 12px/22px system-ui;box-shadow:0 1px 4px #0004;cursor:pointer}button:focus-visible{outline:2px solid #0f766e;outline-offset:3px}[hidden]{display:none!important}.tip{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);box-sizing:border-box;width:max-content;max-width:min(640px,calc(100vw - 32px));max-height:40vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;color:#182022;padding:16px 20px;border:1px solid #dfe5e7;border-radius:12px;box-shadow:0 8px 32px #0004;pointer-events:auto;font:16px/1.6 system-ui,sans-serif}@media print{:host{display:none!important}}';
      tip = doc.createElement("div");
      tip.className = "tip";
      tip.setAttribute("role", "status");
      tip.setAttribute("aria-live", "polite");
      tip.hidden = true;
      root.append(style, tip);
      doc.body.append(host);
    }
    // Older exports forced selected text to black. Unconfigured ranges now
    // inherit each original parent's color, including mixed-color selections.
    for (const mark of doc.querySelectorAll('[data-pageon-note-range][data-pageon-note]')) {
      const value = mark.getAttribute('data-pageon-note-text-color');
      const color = /^#[0-9a-f]{6}$/i.test(value || '') ? value : 'inherit';
      for (const property of ['color', '-webkit-text-fill-color']) {
        const expected = property === 'color' && color !== 'inherit'
          ? `rgb(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)})` : color;
        if (![color, expected].includes(mark.style.getPropertyValue(property)) || mark.style.getPropertyPriority(property) !== 'important')
          mark.style.setProperty(property, color, 'important');
      }
    }
    nodes = unique([...doc.querySelectorAll(`[${attr}]`)].filter(node => text(node) && !node.closest('[data-pageon-extension],script,style,template')));
    for (const [node, marker] of markers) {
      if (!nodes.includes(node)) { marker.remove(); markers.delete(node); }
    }
    const mode = doc.documentElement.getAttribute("data-pageon-note-markers");
    const hideNumbers = !editing() && (mode === "edit" || (mode !== "always" && isPresentation()));
    nodes.forEach((node, index) => {
      if (markersHidden) return;
      let marker = markers.get(node);
      if (!marker) {
        marker = doc.createElement("button");
        marker.type = "button";
        marker.addEventListener("click", event => {
          event.preventDefault(); event.stopPropagation();
          show(node);
          onSelect?.(node);
          doc.dispatchEvent(new win.CustomEvent("pageon:note-select", { detail: { node } }));
        });
        markers.set(node, marker);
        root.append(marker);
      }
      const color = node.getAttribute("data-pageon-note-color");
      marker.style.backgroundColor = /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#ffcc39";
      marker.style.color = "#000";
      marker.textContent = String(index + 1);
      marker.setAttribute("aria-label", `${zh ? "批注" : "Note"} ${index + 1}`);
      const rect = visibleRect(node);
      marker.hidden = hideNumbers || !rect;
      if (rect) {
        marker.style.left = `${Math.max(0, Math.min(win.innerWidth - 24, rect.right - 12))}px`;
        marker.style.top = `${Math.max(0, Math.min(win.innerHeight - 24, rect.top - 12))}px`;
      }
    });
    if (!editing()) syncSlide();
  };
  const schedule = () => {
    if (destroyed || frame) return;
    frame = win.requestAnimationFrame(() => { frame = null; refresh(); });
  };
  const editableEvent = event => event.composedPath().some(node => node === host || node?.isContentEditable ||
    node?.matches?.('input,textarea,select,button,a[href],audio,video,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="slider"],[role="combobox"]'));
  const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const space = event => event.code === "Space" || event.key === " " || event.key === "Spacebar";
  // Closed-shadow input events are retargeted to the toolbar host. Let its
  // editor identify focused inputs before the original deck's capture handlers.
  for (const type of ["keydown", "keypress", "keyup"]) {
    listen(win, type, event => { if (inputGuard?.(event)) event.stopImmediatePropagation(); }, true);
  }
  listen(win, "keydown", event => {
    if (!space(event) || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || editing() || editableEvent(event)) return;
    if (spaceDown) { stop(event); return; }
    const slide = syncSlide();
    if (!slide || !doc.querySelector(`[${attr}]`)) return;
    stop(event);
    spaceDown = true;
    if (event.repeat) return;
    const notes = [...slide.querySelectorAll(`[${attr}]`)];
    if (slide.hasAttribute(attr)) notes.unshift(slide);
    const pending = unique(notes.filter(node => text(node)));
    if (shown < pending.length) { refresh(); show(pending[shown++]); return; }
    hide();
    // Delegate to the deck's existing right-arrow handler, never change its
    // active classes or invent page indexes. Direct arrow keys are untouched.
    const target = event.target?.dispatchEvent ? event.target : doc;
    for (const type of ["keydown", "keyup"]) target.dispatchEvent(new win.KeyboardEvent(type, {
      key: "ArrowRight", code: "ArrowRight", keyCode: 39, which: 39, bubbles: true, cancelable: true,
    }));
    schedule();
  }, true);
  listen(win, "keypress", event => { if (space(event) && spaceDown) stop(event); }, true);
  listen(win, "keyup", event => { if (space(event) && spaceDown) { spaceDown = false; stop(event); } }, true);
  listen(doc, "pointerdown", event => { if (editing() && !event.composedPath().includes(host)) hide(); }, true);
  listen(win, "blur", () => { spaceDown = false; hide(); });
  const reposition = () => { presenter?.reposition(); schedule(); };
  listen(win, "resize", reposition);
  listen(doc, "scroll", reposition, true);
  if (win.visualViewport) { listen(win.visualViewport, "resize", reposition); listen(win.visualViewport, "scroll", reposition); }
  listen(doc, "pageon:note-preview", event => {
    const node = event.detail?.node;
    if (node?.ownerDocument !== doc || !node.isConnected || node.closest("[data-pageon-extension]")) return;
    refresh(); show(node);
  });
  listen(doc, "transitionend", schedule, true);
  listen(doc, "animationend", schedule, true);
  listen(doc, "DOMContentLoaded", refresh);
  observer = new win.MutationObserver(records => {
    if (records.some(record => record.target !== host && !host?.contains(record.target))) schedule();
  });
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: [attr, "data-pageon-note-text-color", "data-pageon-note-color", "data-pageon-note-markers", "class", "style", "hidden", "inert", "aria-hidden", "data-artifact-mode", "data-artifact-local-edit"] });
  refresh();

  const api = { refresh, setInputGuard(handler) { inputGuard = handler; }, destroy() {
    destroyed = true; hide();
    if (frame) win.cancelAnimationFrame(frame);
    observer?.disconnect(); cleanups.forEach(cleanup => cleanup()); host?.remove();
    if (win.PageOnNotes === api) delete win.PageOnNotes;
  } };
  win.PageOnNotes = api;
  return api;
}
