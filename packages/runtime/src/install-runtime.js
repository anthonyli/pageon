// Kept self-contained so the exact same function runs in exported HTML.
export function installRuntime(config, createDeckEditSession, document, window, fallbackSource = '', createFloatingToolbar, createVisualExporter, createFileSaver, createExportMenu, installNotes, createOfflineNoteForm, createFloatingPanel, createNoteTarget, createNoteAnimations, createColorPalette) {
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
    if(text.length<=12000&&(direct||children.length===0||children.every(child=>child.hasAttribute('data-pageon-note-range')))){result.push(element);return}
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
style.textContent=config.floatingStyle;
const bar=document.createElement('div');
bar.className='bar';
bar.setAttribute('role','toolbar');
const editButton=document.createElement('button');
editButton.type='button';
editButton.textContent=TEXT.edit;
editButton.className='edit-button';
const saveButton=document.createElement('button');
saveButton.type='button';
saveButton.textContent=TEXT.save;
const notesButton=document.createElement('button');
notesButton.type='button';
notesButton.className='notes-button';
notesButton.disabled=true;
notesButton.textContent=TEXT.edit==='编辑'?'批注':'Notes';
notesButton.setAttribute('aria-expanded','false');
notesButton.setAttribute('aria-controls','pageon-note-form');
const dragHandle=document.createElement('span');
dragHandle.className='drag-handle';
dragHandle.setAttribute('role','button');
dragHandle.tabIndex=0;
dragHandle.setAttribute('aria-label',TEXT.move);
dragHandle.title=TEXT.move;
dragHandle.textContent='⠿';
bar.append(dragHandle,editButton,saveButton,notesButton);
const brand=document.createElement('a');
brand.className='brand';
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
if(config.ui===false){editButton.hidden=true;notesButton.hidden=true;saveButton.hidden=true;dragHandle.hidden=true;}
shadow.append(style,bar);

let floating;
let exportMenu;
const status=document.createElement('span');
status.className='file-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
bar.append(status);
const reportStatus=message=>{if(destroyed)return;status.textContent=message;status.hidden=false;floating?.refresh();};
const fileSaver=createFileSaver({window,lang:TEXT.edit==='编辑'?'zh':'en',fileName:config.fileName,isDestroyed:()=>destroyed,onStatus:reportStatus});
if(fileSaver.canSave&&!config.onSave){saveButton.textContent=fileSaver.labels.save;saveButton.title=fileSaver.labels.choose;}

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
  exportMenu?.close();
  selected=null;
  notesButton.disabled=true;
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
    notesForm.hide();
    notesButton.setAttribute('aria-expanded','false');
  }
  notesForm.select(null);
  editButton.textContent=value?TEXT.done:TEXT.edit;
  floating?.setEditing(value);
  emit('modechange',value?'edit':'browse');
  if(value&&editingNotice&&!noticeDismissed){
    editingNotice.hidden=false;
    floating?.refresh();
  }
};

// Reuse the early head script when present so Space still precedes deck handlers.
// Limited DOM implementations can use the editor without the visual overlay.
const ownsNotes=!window.PageOnNotes&&typeof window.requestAnimationFrame==='function'&&typeof window.URLSearchParams==='function';
const notes=window.PageOnNotes||(ownsNotes?installNotes(document,window,{noteCharacters:config.noteCharacters},createNoteAnimations):null);
if(ownsNotes)cleanups.push(()=>notes.destroy());
const notesForm=createOfflineNoteForm({document,paletteFactory:createColorPalette,paletteColors:config.paletteColors,animations:createNoteAnimations({allowCharacters:config.noteCharacters}),lang:TEXT.edit==='编辑'?'zh':'en',createFloatingPanel,createNoteTarget,anchor:notesButton,onClose(){notesButton.setAttribute('aria-expanded','false');},onMarkerModeChange(mode){
  if(!['auto','always','edit'].includes(mode))return;
  document.documentElement.setAttribute('data-pageon-note-markers',mode);
  notes?.refresh();emit('change',getSelection());
},onChange(node,value,target,animation,character,color,textColor){
  if(!target.write(value,animation,character,color,textColor))return;
  notes?.refresh();
  emit('change',getSelection());
}});
notesForm.panel.id='pageon-note-form';
shadow.append(notesForm.panel);
cleanups.push(()=>notesForm.destroy());
const selectNote=node=>{
  if(!editing||!node?.isConnected)return;
  selected=node;
  notesButton.disabled=false;
  notesForm.select(node);
  floating?.follow(node);
  emit('selectionchange',getSelection());
};
listen(notesButton,'click',()=>{
  if(!editing)setEditing(true);
  notesForm.select(selected);
  if(notesForm.panel.hidden)notesForm.show();else notesForm.hide();
  notesButton.setAttribute('aria-expanded',String(!notesForm.panel.hidden));
  notesForm.select(selected);
  floating?.refresh();
});
listen(document,'pageon:note-select',event=>{
  if(!editing)return;
  selectNote(event.detail?.node);
  notesForm.show(false);
  notesButton.setAttribute('aria-expanded',String(!notesForm.panel.hidden));
  floating?.refresh();
});
listen(editButton,'click',()=>setEditing(!editing));
const serialize = () => {
  if(destroyed)throw new Error('runtime-destroyed');
  const wasEditing=editing;
  const priorSelected=selected;
  const notesOpen=!notesForm.panel.hidden;
  try {
    setEditing(false);
    ensureMounted();
    const copy=document.documentElement.cloneNode(true);
    copy.querySelectorAll('pageon-runtime, [data-pageon-extension]').forEach(node=>node.remove());
    copy.querySelectorAll('#pageon-notes-script,pageon-notes').forEach(node=>node.remove());
    if([...copy.querySelectorAll('[data-pageon-note]')].some(node=>(node.getAttribute('data-pageon-note')||'').trim())){
      const script=document.createElement('script');
      script.id='pageon-notes-script';
      script.textContent='('+installNotes.toString()+')(document,window,{noteCharacters:'+!!config.noteCharacters+'},'+createNoteAnimations.toString()+');';
      (copy.querySelector('head')||copy).prepend(script);
    }
    if(!copy.querySelector('#pageon-local-runtime-script') && runtimeSource){
      const script=document.createElement('script');
      script.id='pageon-local-runtime-script';
      script.textContent=runtimeSource;
      (copy.querySelector('body')||copy).appendChild(script);
    }
    const html='<!doctype html>\n'+copy.outerHTML;
    return { html, fileName: config.fileName.replace(/\.html?$/i,'')+'-edited.html', runtimeVersion: config.version };
  } finally { if(wasEditing){setEditing(true);selectNote(priorSelected);if(notesOpen)notesForm.show();else notesForm.hide();notesButton.setAttribute('aria-expanded',String(notesOpen));floating?.refresh();} }
};
const save = (copy = false) => {
  if(saving || destroyed)return Promise.resolve();
  saving=true;
  saveButton.disabled=true;
  const finish=()=>{saving=false;saveButton.disabled=false;};
  const failed=error=>{reportStatus(fileSaver.labels.failed);throw error;};
  try {
    if(config.onSave&&!copy){
      return Promise.resolve(config.onSave(serialize())).catch(failed).finally(finish);
    }
    if(!copy&&fileSaver.canSave){
      return fileSaver.save(serialize).catch(failed).finally(finish);
    }
    const artifact=serialize();
    const blob=new Blob([artifact.html],{type:'text/html;charset=utf-8'});
    const link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    link.download=artifact.fileName;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    reportStatus(fileSaver.labels.downloaded);
    finish();
    return Promise.resolve();
  } catch(error) { finish();reportStatus(fileSaver.labels.failed);return Promise.reject(error); }
};
notes?.setInputGuard?.(event=>{
  if(event.target!==host||!notesForm.panel.contains(shadow.activeElement))return false;
  if(event.type==='keydown'&&event.key==='Escape'){event.preventDefault();notesForm.close();}
  if(event.type==='keydown'&&config.shortcuts&&!event.isComposing&&(event.metaKey||event.ctrlKey)&&event.key?.toLowerCase()==='s'){
    event.preventDefault();save().catch(error=>emit('error',error));
  }
  return true;
});
cleanups.push(()=>notes?.setInputGuard?.(null));
listen(saveButton,'click',()=>{save().catch(error=>emit('error',error));});

let visualExporter=null;
const exportItems=[{label:fileSaver.labels.copy,action:()=>save(true).catch(error=>emit('error',error))}];
if(config.imageExport!==false&&typeof createVisualExporter==='function'){
visualExporter=createVisualExporter({document,window,downloadTarget:shadow,fileName:config.fileName,lang:TEXT.edit==='编辑'?'zh':'en',
  beforeCapture(){
    const wasEditing=editing, priorSelected=selected, active=document.activeElement;
    const selection=window.getSelection?.();
    const range=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;
    setEditing(false);
    return ()=>{if(wasEditing&&!destroyed){setEditing(true);selected=priorSelected?.isConnected?priorSelected:null;active?.focus?.({preventScroll:true});if(range&&selection){selection.removeAllRanges();selection.addRange(range);}}};
  },
  onStatus({busy,message,error}){
    exportMenu?.buttons.slice(1).forEach(button=>{button.disabled=busy;});
    reportStatus(message);
    if(error)emit('error',error);
    floating?.refresh();
  },
});
for(const [label,method] of [[visualExporter.labels.image,'exportImage'],[visualExporter.labels.pdf,'exportPdf']]){
  exportItems.push({label,separator:method==='exportImage',action:()=>visualExporter[method]().catch(()=>{})});
}
cleanups.push(()=>visualExporter.destroy());
}
exportMenu=createExportMenu({document,window,parent:bar,before:notesButton,label:fileSaver.labels.export,items:exportItems,
  onOpenChange:open=>floating?.setEditing(editing||open)});
if(config.ui===false){exportMenu.trigger.hidden=true;exportMenu.buttons.forEach(button=>{button.hidden=true;});}
cleanups.push(()=>exportMenu.destroy());


listen(window,'click',event=>{
  if(!editing||event.target===host||event.target.closest?.('[data-pageon-extension]'))return;
  event.stopImmediatePropagation();
  const noteTarget=event.target.closest?.('[data-pageon-note-range]')||event.target.closest?.('[data-pageon-note]')||event.target;
  const node=event.target.closest&&event.target.closest('[data-artifact-local-node]');
  selected=event.target.closest?.('[data-pageon-note-range]')||node||(noteTarget!==document.body&&noteTarget!==document.documentElement?noteTarget:null);
  notesButton.disabled=!selected;
  floating?.follow(selected);
  if(!notesForm.panel.hidden&&noteTarget!==document.body&&noteTarget!==document.documentElement){
    event.preventDefault();
    selectNote(noteTarget);
    return;
  }
  notesForm.select(selected);
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
  if(event.type==='keydown'&&config.shortcuts&&!event.isComposing&&(event.metaKey||event.ctrlKey)&&event.key?.toLowerCase()==='s'){
    event.preventDefault();event.stopImmediatePropagation();save().catch(error=>emit('error',error));return;
  }
  if(event.type==='keydown'&&config.shortcuts&&event.ctrlKey&&event.altKey){
    if(event.code==='KeyE'){event.preventDefault();setEditing(!editing);return;}
    if(event.code==='KeyS'){event.preventDefault();save().catch(error=>emit('error',error));return;}
  }
  if(!editing||event.target===host)return;
  if(event.type==='pointerdown')notesForm.hide();
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
if(config.ui!==false){
  floating=createFloatingToolbar({host,root:shadow,bar,handle:dragHandle,win:window,moveWhileEditing:true,label:TEXT.expand});
  cleanups.push(()=>floating.destroy());
}
function getSelection(){
  return selected?.isConnected ? {nodeId:selected.getAttribute('data-artifact-local-node'),kind:selected.localName==='text'?'svg-text':'text'} : null;
}
listen(document,'input',event=>{
  if(editing && event.target.closest?.('[data-artifact-local-node]')){floating?.refresh();emit('change',getSelection());}
});
const controller={
  saveCopy:()=>save(true),
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
if(visualExporter){
  controller.exportImage=()=>visualExporter.exportImage();
  controller.exportPdf=()=>visualExporter.exportPdf();
}
window.PageOnRuntime=controller;
return controller;

}
