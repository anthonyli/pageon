export const RUNTIME_EDIT_STYLE = "\n    html[data-artifact-local-edit=\"true\"] [data-artifact-local-node]{cursor:text!important;outline:1px dashed rgba(31,157,139,.45)!important;outline-offset:3px}\n    html[data-artifact-local-edit=\"true\"] [data-artifact-local-node]:hover{outline:1px dashed rgba(31,157,139,.85)!important;background:rgba(31,157,139,.04)!important}\n    html[data-artifact-local-edit=\"true\"] [data-artifact-local-node]:focus{outline:2px solid #1f9d8b!important;outline-offset:3px;box-shadow:0 0 0 5px rgba(31,157,139,.1)!important}\n    @media print{pageon-runtime{display:none!important}}\n  ";

export const PREVIEW_EDIT_STYLE = "\n    html[data-artifact-mode=\"edit\"] [data-artifact-edit]{cursor:text;border-radius:2px;outline:1px dashed rgba(31,157,139,.45);outline-offset:3px;transition:outline-color .15s,box-shadow .15s,background-color .15s}\n    html[data-artifact-mode=\"edit\"] [data-artifact-edit]:hover{outline:1px dashed rgba(31,157,139,.85);background:rgba(31,157,139,.04)}\n    html[data-artifact-mode=\"edit\"] [data-artifact-edit][data-artifact-selected=\"true\"]{outline:2px solid #1f9d8b;outline-offset:3px;box-shadow:0 0 0 5px rgba(31,157,139,.1)}\n    html[data-artifact-mode=\"preview\"] [data-artifact-edit]{outline:none!important;cursor:inherit!important}\n  ";

// Shared by the basic and advanced downloaded files.
export const FLOATING_TOOLBAR_STYLE = `
  :host{position:fixed;right:18px;bottom:18px;z-index:2147483647;display:block;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  [hidden]{display:none!important}
  .bar{display:flex;flex-wrap:wrap;max-width:calc(100vw - 32px);box-sizing:border-box;align-items:center;gap:6px;padding:6px;
    border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(7,26,29,.97);box-shadow:0 6px 22px rgba(7,26,29,.18);color:#fff;font-size:13px;line-height:1.4;backdrop-filter:blur(12px)}
  button{box-sizing:border-box;border:1px solid transparent;border-radius:7px;min-height:36px;padding:7px 11px;background:transparent;color:#e0eeeb;font:inherit;font-weight:500;cursor:pointer;white-space:nowrap}
  button:hover{background:rgba(255,255,255,.09)}
  button:focus-visible{outline:2px solid #8edbcd;outline-offset:2px}
  button:disabled{opacity:.45;cursor:default}
  .bar>.edit-button{background:#1f9d8b;color:#fff;font-weight:600}
  .bar>.edit-button:hover{background:#188b7c}
  .drag-handle{cursor:grab;touch-action:none;user-select:none;padding:7px 4px;color:#8ba7a2;font-size:20px;line-height:1}
  .drag-handle:active{cursor:grabbing}.drag-handle:focus-visible{outline:2px solid #8edbcd;border-radius:4px}
  .brand{color:#a1beb8;text-decoration:none;font-weight:400;font-size:11px;padding:3px 6px 3px 12px;margin-left:2px;border-left:1px solid #ffffff24;white-space:nowrap}
  .brand:hover{color:#c5e5dc}.brand:focus-visible{outline:2px solid #8edbcd;outline-offset:2px;border-radius:3px}
  .file-status{flex-basis:100%;max-width:340px;padding:3px 6px;line-height:1.5;font-size:12px;overflow-wrap:anywhere}
  .export-control{position:relative;display:inline-flex;align-items:center}
  .export-trigger{display:inline-flex;align-items:center;gap:7px}
  .export-trigger>span{display:flex;color:inherit}
  .export-trigger svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .export-menu{position:absolute;z-index:30;bottom:calc(100% + 8px);left:0;box-sizing:border-box;width:184px;max-width:calc(100vw - 24px);overflow:auto;padding:5px;
    background:#fff;color:#182022;border:1px solid #dfe5e7;border-radius:10px;box-shadow:0 8px 24px #102b2926}
  .bar .export-menu button{display:flex;justify-content:flex-start;width:100%;min-height:36px;padding:8px 10px;background:transparent;color:#182022;border:0;text-align:left;font:500 13px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .bar .export-menu button:hover,.bar .export-menu button:focus-visible{background:#edf7f5;color:#087f73}
  .bar .export-menu button:focus-visible{outline:2px solid #1f9d8b;outline-offset:-2px}
  .bar .export-menu .menu-separator{border-top:1px solid #e5ece9;border-radius:0 0 6px 6px;margin-top:4px;padding-top:11px}
  @media(pointer:coarse){button,.bar .export-menu button{min-height:44px}.drag-handle{min-width:24px;padding:12px 6px}}
  @media(max-width:520px){.bar:not(.editor) .brand{flex-basis:100%;text-align:right;border-left:0;padding:2px 6px}}
`;

export const TOOLBAR_DOCK_STYLE = `
  :host([data-toolbar-docking]:not([data-toolbar-paused])){transition:left .28s ease,top .28s ease,width .28s ease,height .28s ease}
  :host([data-toolbar-docking]:not([data-toolbar-paused]))>.bar{width:max-content;transition:opacity .18s ease}
  :host([data-toolbar-dragging]){transition:none!important}
  :host([data-docked]){overflow:hidden;border-radius:10px;background:#071a1d;box-shadow:0 4px 16px #071a1d33}
  :host([data-docked])>.bar{opacity:0;visibility:hidden;pointer-events:none}
  :host([data-docked][data-dock-edge=left]){border-radius:0 10px 10px 0}
  :host([data-docked][data-dock-edge=right]){border-radius:10px 0 0 10px}
  :host([data-docked][data-dock-edge=top]){border-radius:0 0 10px 10px}
  :host([data-docked][data-dock-edge=bottom]){border-radius:10px 10px 0 0}
  .dock-tab{position:absolute;inset:0;width:100%;height:100%;padding:8px!important;border:0;border-radius:inherit!important;display:flex;align-items:center;justify-content:center;background:#071a1d!important;color:#8edbcd!important;cursor:pointer}
  .dock-tab[hidden]{display:none!important}
  .dock-tab svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .dock-tab:focus-visible{outline:2px solid #8edbcd;outline-offset:-3px}
  @media(prefers-reduced-motion:reduce){:host([data-toolbar-docking]),:host([data-toolbar-docking])>.bar{transition:none!important}}
`;
