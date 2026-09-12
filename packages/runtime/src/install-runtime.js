// Kept self-contained so the exact same function runs in exported HTML.
export function installRuntime(config, createDeckEditSession, document, window, fallbackSource = '') {
const Node = window.Node || globalThis.Node;
const MutationObserver = window.MutationObserver || globalThis.MutationObserver;
const getComputedStyle = window.getComputedStyle?.bind(window) || globalThis.getComputedStyle;
const Blob = window.Blob || globalThis.Blob;
const URL = window.URL || globalThis.URL;
const cleanups = [];
const listeners = new Map();
let destroyed = false;
let saving = false;
let selected = null;
const listen = (target, type, handler, capture = false) => {
  target.addEventListener(type, handler, capture);
  cleanups.push(() => target.removeEventListener?.(type, handler, capture));
};
const emit = (type, value) => {
  for (const handler of listeners.get(type) || []) {
    try { handler(value); } catch (error) { if (type !== 'error') emit('error', error); }
  }
};
window.PageOnRuntime?.destroy?.();
const TEXT=config.text;
const existingEditStyle=document.getElementById('pageon-local-style');
const editStyle=existingEditStyle || document.createElement('style');
editStyle.id='pageon-local-style';
editStyle.textContent=config.editStyle;
if(!existingEditStyle)cleanups.push(()=>editStyle.remove());
const isPremium=document.documentElement.getAttribute('data-pageon-tier')==='premium';
const excluded=new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','CANVAS','TEMPLATE','IFRAME','OBJECT','EMBED','IMG','VIDEO','AUDIO','INPUT','TEXTAREA','SELECT','OPTION','BR','HR']);
const runtimeScript=fallbackSource ? null : document.currentScript;
const runtimeSource=fallbackSource || (runtimeScript?runtimeScript.textContent:'');
let editing=false;
const deckEdit=createDeckEditSession(document);

const findNodes=()=>{
  const result=[];
  const visit=element=>{
    if(element.hasAttribute('data-artifact-no-edit')||element.hasAttribute('data-pageon-extension'))return;
    if(element.tagName.toLowerCase()==='svg'){
      element.querySelectorAll('text').forEach(t=>{const v=(t.textContent||'').replace(/\s+/g,' ').trim(); if(v&&v.length<=12000){result.push(t);} });
      return;
    }
    if(excluded.has(element.tagName)||element.hasAttribute('data-artifact-no-edit'))return;
    const text=(element.textContent||'').replace(/\s+/g,' ').trim();
    if(!text)return;
    const children=[...element.children].filter(child=>{
      if(child.tagName.toLowerCase()==='svg')return true;
      return !excluded.has(child.tagName)&&(child.textContent||'').trim();
    });
    const direct=[...element.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&(node.textContent||'').trim());
    if(text.length<=12000&&(direct||children.length===0)){result.push(element);return}
    children.forEach(visit);
  };
  [...document.body.children].filter(element=>element.tagName!=='PAGEON-RUNTIME'&&element.tagName!=='ARTIFACT-STUDIO-RUNTIME').forEach(visit);
  return result;
};

const host=document.createElement('pageon-runtime');
host.id='pageon-runtime';
host.setAttribute('data-tier',isPremium?'premium':'free');
const shadow=host.attachShadow({mode:'closed'});
  host.setAttribute('data-artifact-no-edit','');
const style=document.createElement('style');
style.textContent=':host{position:fixed;right:18px;bottom:18px;z-index:2147483647;display:block;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.bar{display:flex;flex-wrap:wrap;max-width:calc(100vw - 32px);box-sizing:border-box;align-items:center;gap:7px;padding:8px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(7,26,29,.96);box-shadow:0 16px 45px rgba(7,26,29,.28);color:#fff;font-size:12px;backdrop-filter:blur(12px)}button{border:0;border-radius:8px;padding:8px 10px;background:#fff;color:#071a1d;font:700 12px/1 inherit;cursor:pointer}button:first-of-type{background:#1f9d8b;color:#fff}.drag-handle{cursor:grab;touch-action:none;user-select:none;padding:8px 4px;color:#8edbcd;font-size:20px;line-height:1}.drag-handle:active{cursor:grabbing}.drag-handle:focus-visible{outline:2px solid #8edbcd;border-radius:4px}a{color:#8edbcd;text-decoration:none;font-weight:700;padding:0 4px;white-space:nowrap}';
const bar=document.createElement('div');
bar.className='bar';
const editButton=document.createElement('button');
editButton.type='button';
editButton.textContent=TEXT.edit;
const saveButton=document.createElement('button');
saveButton.type='button';
saveButton.textContent=TEXT.save;
const dragHandle=document.createElement('span');
dragHandle.className='drag-handle';
dragHandle.setAttribute('role','button');
dragHandle.tabIndex=0;
dragHandle.setAttribute('aria-label',TEXT.move);
dragHandle.title=TEXT.move;
dragHandle.textContent='⠿';
bar.append(dragHandle,editButton,saveButton);
const brand=document.createElement('a');
brand.href=config.homeUrl;
brand.target='_blank';
brand.rel='noreferrer';
brand.textContent=TEXT.brand;
if(!isPremium)bar.appendChild(brand);
let editingNotice=null;
let noticeDismissed=false;
if(config.temporaryEdits){
  editingNotice=document.createElement('div');
  editingNotice.className='editing-notice';
  editingNotice.setAttribute('role','status');
  editingNotice.hidden=true;
  editingNotice.textContent=TEXT.warning;
  const closeNotice=document.createElement('button');
  closeNotice.type='button';
  closeNotice.className='notice-close';
  closeNotice.setAttribute('aria-label',TEXT.closeNotice);
  closeNotice.title=TEXT.closeNotice;
  closeNotice.textContent='×';
  listen(closeNotice,'click',()=>{
    noticeDismissed=true;
    editingNotice.hidden=true;
    editButton.focus();
  });
  editingNotice.appendChild(closeNotice);
  style.textContent+='.editing-notice{position:relative;box-sizing:border-box;flex-basis:100%;max-width:300px;padding-right:28px;line-height:1.6;color:#fde6b2}.editing-notice[hidden]{display:none}.editing-notice .notice-close{position:absolute;top:0;right:0;padding:0;width:24px;height:24px;background:transparent;color:inherit;font:20px/24px sans-serif}.notice-close:hover{opacity:.75}.notice-close:focus-visible{outline:2px solid #8edbcd;outline-offset:1px}';
  bar.appendChild(editingNotice);
}
if(config.ui==='sidebar'){
  style.textContent+=':host{top:16px;bottom:auto;right:16px;width:180px}.bar{flex-direction:column;align-items:stretch}.drag-handle{align-self:center}';
}
if(config.ui===false){editButton.hidden=true;saveButton.hidden=true;dragHandle.hidden=true;}
shadow.append(style,bar);

let drag=null;
let moved=false;
const positionToolbar=(left,top)=>{
  const rect=host.getBoundingClientRect();
  const x=Math.max(8,Math.min(left,window.innerWidth-rect.width-8));
  const y=Math.max(8,Math.min(top,window.innerHeight-rect.height-8));
  host.style.left=x+'px';
  host.style.top=y+'px';
  host.style.right='auto';
  host.style.bottom='auto';
  moved=true;
};
listen(dragHandle,'pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false)return;
  event.preventDefault();
  const rect=host.getBoundingClientRect();
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
  dragHandle.setPointerCapture(event.pointerId);
});
listen(dragHandle,'pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  event.preventDefault();
  positionToolbar(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);
});
const finishDrag=event=>{
  if(!drag||event.pointerId!==drag.id)return;
  drag=null;
  if(dragHandle.hasPointerCapture(event.pointerId))dragHandle.releasePointerCapture(event.pointerId);
};
['pointerup','pointercancel','lostpointercapture'].forEach(type=>listen(dragHandle,type,finishDrag));
listen(dragHandle,'click',event=>event.preventDefault());
listen(dragHandle,'keydown',event=>{
  const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
  if(!delta)return;
  event.preventDefault();
  const rect=host.getBoundingClientRect();
  positionToolbar(rect.left+delta[0],rect.top+delta[1]);
});
listen(window,'resize',()=>{
  if(!moved)return;
  const rect=host.getBoundingClientRect();
  positionToolbar(rect.left,rect.top);
});

const ensureMounted=()=>{
  if(destroyed)return;
  host.id='pageon-runtime';
  if(runtimeScript){
    runtimeScript.id='pageon-local-runtime-script';
    if(runtimeScript.textContent!==runtimeSource)runtimeScript.textContent=runtimeSource;
    if(!runtimeScript.isConnected)document.body.appendChild(runtimeScript);
  }
  if(!editStyle.isConnected)(document.head||document.documentElement).appendChild(editStyle);
  if(!host.isConnected)document.body.appendChild(host);
  if(!style.isConnected)shadow.prepend(style);
  if(!bar.isConnected)shadow.appendChild(bar);
  if(isPremium){
    if(brand.isConnected)brand.remove();
  }else{
    if(brand.getAttribute('href')!==config.homeUrl)brand.setAttribute('href',config.homeUrl);
    if(brand.textContent!==TEXT.brand)brand.textContent=TEXT.brand;
    if(!brand.isConnected)bar.appendChild(brand);
  }
};

const setEditing=value=>{
  if(destroyed)return;
  selected=null;
  if(document.activeElement?.isContentEditable)document.activeElement.blur();
  editing=value;
  if(value)deckEdit.enter();
  document.querySelectorAll('[data-artifact-local-node]').forEach(element=>{
    element.removeAttribute('data-artifact-local-node');
    element.removeAttribute('contenteditable');
    element.removeAttribute('spellcheck');
  });
  if(value){
    document.documentElement.dataset.artifactLocalEdit='true';
    findNodes().forEach((element,index)=>{
      element.dataset.artifactLocalNode=String(index+1);
      element.contentEditable='true';
      element.spellcheck=true;
    });
  }else{
    document.documentElement.removeAttribute('data-artifact-local-edit');
    deckEdit.exit();
  }
  editButton.textContent=value?TEXT.done:TEXT.edit;
  emit('modechange',value?'edit':'browse');
  if(value&&editingNotice&&!noticeDismissed){
    editingNotice.hidden=false;
    if(moved){
      const rect=host.getBoundingClientRect();
      positionToolbar(rect.left,rect.top);
    }
  }
};

listen(editButton,'click',()=>setEditing(!editing));
const serialize = () => {
  if(destroyed)throw new Error('runtime-destroyed');
  const wasEditing=editing;
  try {
    setEditing(false);
    ensureMounted();
    const copy=document.documentElement.cloneNode(true);
    copy.querySelectorAll('pageon-runtime, [data-pageon-extension]').forEach(node=>node.remove());
    if(!copy.querySelector('#pageon-local-runtime-script') && runtimeSource){
      const script=document.createElement('script');
      script.id='pageon-local-runtime-script';
      script.textContent=runtimeSource;
      (copy.querySelector('body')||copy).appendChild(script);
    }
    const html='<!doctype html>\n'+copy.outerHTML;
    return { html, fileName: config.fileName.replace(/\.html?$/i,'')+'-edited.html', runtimeVersion: config.version };
  } finally { if(wasEditing)setEditing(true); }
};
const save = () => {
  if(saving || destroyed)return Promise.resolve();
  saving=true;
  try {
    const artifact=serialize();
    if(config.onSave){
      return Promise.resolve(config.onSave(artifact)).finally(()=>{saving=false;});
    }
    const blob=new Blob([artifact.html],{type:'text/html;charset=utf-8'});
    const link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    link.download=artifact.fileName;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    saving=false;
    return Promise.resolve();
  } catch(error) { saving=false; return Promise.reject(error); }
};
listen(saveButton,'click',()=>{save().catch(error=>emit('error',error));});

listen(window,'click',event=>{
  if(!editing||event.target===host||event.target.closest?.('[data-pageon-extension]'))return;
  event.stopImmediatePropagation();
  const node=event.target.closest&&event.target.closest('[data-artifact-local-node]');
  selected=node || null;
  emit('selectionchange',getSelection());
  if(node&&(node.tagName==='text'||node.tagName==='TEXT')){
    event.preventDefault();
    event.stopImmediatePropagation();
    const cs=getComputedStyle(node);
    const rect=node.getBoundingClientRect();
    const overlay=document.createElement('div');
    overlay.setAttribute('contenteditable','true');
    overlay.style.cssText='position:absolute;left:'+(rect.left+(document.documentElement.scrollLeft||0))+'px;top:'+(rect.top+(document.documentElement.scrollTop||0))+'px;z-index:99999;min-width:'+rect.width+'px;min-height:'+rect.height+'px;box-sizing:border-box;outline:1px dashed rgba(31,157,139,.6);background:rgba(31,157,139,.05);color:'+(cs.fill&&cs.fill!=='none'?cs.fill:'#111')+';font-family:'+cs.fontFamily+';font-size:'+cs.fontSize+';font-weight:'+cs.fontWeight+';white-space:pre;line-height:normal;padding:0;border-radius:2px;display:inline-block;';
    node.style.visibility='hidden';
    overlay.textContent=node.textContent;
    document.body.appendChild(overlay);
    overlay.focus();
    const r=document.createRange(); r.selectNodeContents(overlay);
    const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
    listen(overlay,'blur',()=>{ node.textContent=overlay.textContent; node.style.visibility=''; overlay.remove(); });
    listen(overlay,'keydown',e=>{ if(e.key==='Escape'){e.preventDefault(); overlay.blur();} });
    return;
  }
  const control=event.target.closest&&event.target.closest('a[href],button');
  if(control&&control.hasAttribute('data-artifact-local-node')){
    event.preventDefault();
    event.stopImmediatePropagation();
    control.focus();
  }
},true);

const isolateEditingKeyboard=event=>{
  if(event.target.closest?.('[data-pageon-extension]'))return;
  if(event.type==='keydown'&&config.shortcuts&&event.ctrlKey&&event.altKey){
    if(event.code==='KeyE'){event.preventDefault();setEditing(!editing);return;}
    if(event.code==='KeyS'){event.preventDefault();save().catch(error=>emit('error',error));return;}
  }
  if(!editing||event.target===host)return;
  event.stopImmediatePropagation();
};
['keydown','keypress','keyup','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','wheel','dblclick'].forEach(type=>{
  listen(window,type,isolateEditingKeyboard,true);
});

// Keep toolbar events out of the original document's presentation handlers.
['click','dblclick','pointerdown','pointermove','pointerup','pointercancel','mousedown','mouseup','touchstart','touchend','keydown','keypress','keyup'].forEach(type=>{
  listen(host,type,event=>event.stopPropagation());
});

let mountCheckQueued=false;
const queueMountCheck=()=>{
  if(mountCheckQueued||destroyed)return;
  mountCheckQueued=true;
  queueMicrotask(()=>{
    mountCheckQueued=false;
    ensureMounted();
  });
};
const rootObserver=new MutationObserver(queueMountCheck);
rootObserver.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
const shadowObserver=new MutationObserver(queueMountCheck);
shadowObserver.observe(shadow,{childList:true,subtree:true,characterData:true});
ensureMounted();
function getSelection(){
  return selected?.isConnected ? {nodeId:selected.getAttribute('data-artifact-local-node'),kind:selected.localName==='text'?'svg-text':'text'} : null;
}
listen(document,'input',event=>{
  if(editing && event.target.closest?.('[data-artifact-local-node]'))emit('change',getSelection());
});
const controller={
  enterEdit(){setEditing(true);},
  exitEdit(){setEditing(false);},
  getSelection,
  apply(operation){
    if(destroyed||!editing)throw new Error('runtime-not-editing');
    if(operation?.type!=='set-text'||typeof operation.value!=='string')throw new TypeError('invalid-operation');
    const node=[...document.querySelectorAll('[data-artifact-local-node]')].find(node=>node.getAttribute('data-artifact-local-node')===operation.nodeId);
    if(!node||node.children.length||node.closest('pageon-runtime,[data-pageon-extension]'))throw new Error('unsupported-edit-node');
    node.textContent=operation.value;
    selected=node;
    emit('change',getSelection());
  },
  serialize,
  save,
  on(type,handler){
    if(destroyed)throw new Error('runtime-destroyed');
    if(!listeners.has(type))listeners.set(type,new Set());
    listeners.get(type).add(handler);
    return ()=>listeners.get(type)?.delete(handler);
  },
  destroy(){
    if(destroyed)return;
    setEditing(false);
    destroyed=true;
    rootObserver.disconnect?.();shadowObserver.disconnect?.();
    cleanups.forEach(cleanup=>cleanup());listeners.clear();host.remove();
    if(window.PageOnRuntime===controller)delete window.PageOnRuntime;
  },
};
window.PageOnRuntime=controller;
return controller;

}
