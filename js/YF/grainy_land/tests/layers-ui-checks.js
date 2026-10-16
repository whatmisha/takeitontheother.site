import {defaults,switchMode} from '../legacy-document.js';
import {withLayers} from '../layers.js';
import {LandscapeRenderer} from '../render.js?v=layers-polish-1';
const frame=document.querySelector('#app'),out=document.querySelector('#results'),log=[];
const pause=(ms=60)=>new Promise(r=>setTimeout(r,ms));
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);out.textContent=log.join('\n');if(!ok)throw Error(name);};
try{
 for(let i=0;i<250&&!frame.contentDocument?.documentElement.dataset.ready;i++)await pause();
 const d=frame.contentDocument,w=frame.contentWindow,$=id=>d.getElementById(id),errors=[];
 w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const click=async id=>{$(id).click();await pause();};
 const set=async(id,value)=>{$(id).value=String(value);$(id).focus();$(id).blur();await pause();};
 const rows=()=>[...$('layerList').querySelectorAll(':scope > [data-layer-id]')];
 const row=id=>rows().find(r=>r.dataset.layerId===id),bg=$('backgroundLayer').closest('.background-row'),list=$('layerList');
 check('App ready',d.documentElement.dataset.ready==='true');
 check('Action names', $('generateBtn').textContent==='Regenerate'&&$('transparentBackground').getAttribute('aria-label')==='No background'&&$('transparentBackground').closest('label').textContent.trim()==='No background');
 check('Background is the final item in the scrolling stack',bg.parentElement===list&&list.lastElementChild===bg&&w.getComputedStyle(bg).position==='static');
 const pills=[...d.querySelectorAll('.layer-create button')];
 check('All add actions use shared pills',pills.length===7&&pills.every(b=>b.classList.contains('pill-toggle')&&b.querySelector('span')&&w.getComputedStyle(b).borderRadius==='999px'));
 check('Add actions follow the stack',list.nextElementSibling===d.querySelector('.layer-create'));
 await click('presetDropdownToggle');d.querySelector('#presetDropdownMenu [data-value="Six Cup"]').click();await pause();await click('settings-flower');await set('fCountValue',32);
 check('Full 32-layer stack plus Background',rows().length===32&&list.lastElementChild===bg);
 list.scrollTop=180;await pause();const previous=rows(),thumbs=new Map(previous.map(r=>[r.dataset.layerId,r.querySelector('canvas')])),scroll=list.scrollTop,id=previous[5].dataset.layerId;
 let paints=0;const proto=w.CanvasRenderingContext2D.prototype,put=proto.putImageData;
 proto.putImageData=function(...args){if(this.canvas.classList.contains('layer-thumb'))paints++;return put.apply(this,args);};
 try{const eye=row(id).querySelector('[data-action="eye"]');eye.focus({preventScroll:true});eye.click();await pause();}finally{proto.putImageData=put;}
 check('Visibility updates only its own row (31 / 32 retained)',previous.filter(r=>r===row(r.dataset.layerId)).length===31);
 check('All 32 thumbnail canvases are retained',rows().every(r=>r.querySelector('canvas')===thumbs.get(r.dataset.layerId)));
 check('No unchanged thumbnail repaints',paints===0);
 check('Scroll and focused visibility control survive',Math.abs(list.scrollTop-scroll)<1&&d.activeElement===row(id).querySelector('[data-action="eye"]'));
 check('Changed row reflects visibility',row(id).classList.contains('is-hidden'));
 row(id).querySelector('[data-action="eye"]').click();await pause();check('Reused handlers read current visibility',!row(id).classList.contains('is-hidden'));
 const expand=row(id).querySelector('.flora-expand');expand.click();await pause();
 check('Parts expansion survives reconciliation',row(id).querySelector('.flora-expand').getAttribute('aria-expanded')==='true'&&row(id).nextElementSibling.classList.contains('flora-children'));
 const children=row(id).nextElementSibling.children.length;await set('fPetalsValue',11);
 check('Expanded parts follow shared geometry settings',row(id).nextElementSibling.children.length>children);
 row(id).querySelector('.flora-expand').click();await pause();
 row(id).querySelector('.layer-select').click();await pause();const ordered=rows();
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'[',code:'BracketLeft',bubbles:true}));await pause();
 check('Reordering retains every row and keeps Background last',ordered.every(r=>r===row(r.dataset.layerId))&&rows().at(-1).dataset.layerId===id&&list.lastElementChild===bg);
 list.scrollTop=list.scrollHeight;await pause();check('Background scrolls into view at the bottom',bg.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom+1);
 const visible=$('backgroundVisibility').getAttribute('aria-pressed');await click('backgroundVisibility');check('Background visibility still toggles',$('backgroundVisibility').getAttribute('aria-pressed')!==visible);await click('backgroundVisibility');
 const rect=bg.getBoundingClientRect();$('backgroundLayer').dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:rect.left+40,clientY:rect.top+15}));await pause();
 check('Background hover works inside the stack',$('layerHoverOverlay').dataset.layerId==='background'&&!$('layerHoverOverlay').hidden);
 list.dispatchEvent(new w.PointerEvent('pointerleave',{pointerType:'mouse'}));await pause();
 check('Pills are natively disabled at capacity',pills.every(b=>b.disabled));
 const count=rows().length;await click('newFlowerLayer');check('Disabled pill cannot add a 33rd object',rows().length===count);
 await click('layerDelete');await click('newFlowerLayer');check('Add action restores an Individual Flower',rows().length===32&&d.querySelector('.layer-select[aria-pressed="true"]').textContent.includes('Individual'));
 check('Background remains unique after edits and additions',d.querySelectorAll('#backgroundLayer').length===1&&list.lastElementChild===bg);
 check('No application errors',errors.length===0);
 const renderer=new LandscapeRenderer(),read=s=>{renderer.render(s,160,90);const p=new Uint8Array(160*90*4);renderer.gl.readPixels(0,0,160,90,renderer.gl.RGBA,renderer.gl.UNSIGNED_BYTE,p);return p;},same=(a,b)=>a.every((v,i)=>v===b[i]);
 try{
  for(const mode of ['landscape','abstract','flora','f'])for(const skyToneAmount of [0,80]){
   const s={...withLayers(switchMode(defaults,mode),[]),backgroundVisible:true,skyToneAmount,toneAmount:80};
   const zero=read({...s,grain:0}),full=read({...s,grain:100});check(mode+' Background ignores grain, tones '+skyToneAmount,same(zero,full));
   if(!skyToneAmount)check(mode+' empty Background is flat',full.every((v,i)=>v===full[i%4]));
  }
  const s=switchMode(defaults,'f');check('Object grain is preserved',!same(read({...s,grain:0}),read({...s,grain:100})));
 }finally{renderer.destroy();}
 check('All Layers and background checks passed',true);
}catch(error){out.textContent+='\nERROR '+error.stack;}
