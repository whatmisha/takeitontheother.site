import {normalizeSettings,makeDocument,readDocument,regenerate} from '../document.js?v=unified-document-1';
import {LandscapeRenderer} from '../render.js';
import {motionFrame} from '../motion.js';
import {renderPNG} from '../png-export.js';
import {renderLayersZIP} from '../layers-export.js';
import {readStoredZip} from './zip-reader.js';
const frame=document.querySelector('#app'),out=document.querySelector('#results'),log=[];
const pause=()=>new Promise(r=>setTimeout(r,90));
const check=(label,ok)=>{log.push((ok?'PASS ':'FAIL ')+label);out.textContent=log.join('\n');if(!ok)throw Error(label);};
try{
 for(let i=0;i<250&&!frame.contentDocument?.documentElement.dataset.ready;i++)await pause();
 const d=frame.contentDocument,w=frame.contentWindow,$=id=>d.getElementById(id);
 const {app}=await w.eval("import('/grainy_land/tool.js?v=video-timestamps-1')");
 const errors=[];w.addEventListener('error',e=>errors.push(e.message));
 const click=async id=>{$(id).click();await pause();};
 const set=async(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new w.Event('input',{bubbles:true}));$(id).dispatchEvent(new w.Event('change',{bubbles:true}));$(id).blur();$(id).dispatchEvent(new w.FocusEvent('blur'));await pause();};
 const snapshot=()=>JSON.stringify(app.getSnapshot()),art=()=>$('mainCanvas').toDataURL(),rows=()=>[...d.querySelectorAll('#layerList > [data-layer-id]')];
 const initial=snapshot(),image=art();
 check('Startup uses one six-layer Flower Flow document',app.settings.layers.length===6&&!('mode' in app.getSnapshot()));
 for(const kind of ['land','spot','plant','flower']){await click('settings-'+kind);check(kind+' tab changes neither document nor pixels',snapshot()===initial&&art()===image);}
 check('Tabs do not mark preset dirty',!app.presets.isDirty);
 check('No foreign-settings or copy-to-scene UI',!$('foreignObjectSettings')&&!$('copyObjectScene'));
 await click('presetDropdownToggle');check('All five existing and four added presets are listed', ['Flower Flow','Ember','Drift','Six Cup','Field','Land','Spot','Plant','Flora'].every(name=>d.querySelector('#presetDropdownMenu [data-value="'+name+'"]')));await click('presetDropdownToggle');
 await click('settings-plant');check('Absent Plant type shows zero without adding objects',$('floraCountValue').value==='0'&&rows().length===6);
 await set('floraCountValue',2);check('Plant count adds two Auto Plants to the same scene',rows().length===8&&app.settings.layers.filter(l=>l.kind==='plant').length===2);
 await click('settings-flower');check('Flower count still reads actual flowers',$('fCountValue').value==='3');
 await set('fScaleValue',125);check('Flower size updates shared Flower parameters',app.settings.objectDefaults.flower.fScale===125);
 await click('settings-land');const land=app.settings.objectDefaults.land.scale;await set('scaleValue',85);await click('settings-spot');check('Land and Spot parameters are independent',$('scaleValue').value!=='85');await set('scaleValue',135);await click('settings-land');check('Land settings restore without switching scenes',$('scaleValue').value==='85'&&rows().length===8);
 const flower=app.settings.layers.find(l=>l.kind==='flower');d.querySelector('[data-layer-id="'+flower.id+'"] .layer-select').click();await pause();check('Selecting Flower opens its settings tab',$('settings-flower').getAttribute('aria-selected')==='true');
 await click('settings-land');check('Manual tab navigation keeps layer selection',d.querySelector('[data-layer-id="'+flower.id+'"] .layer-select').getAttribute('aria-pressed')==='true');
 await click('newSpotLayer');const added=app.settings.layers.at(-1);check('Manual Spot starts Individual and selects Spot tab',added.kind==='spot'&&added.parameterMode==='individual'&&$('settings-spot').getAttribute('aria-selected')==='true');
 const individual=JSON.stringify(added.parameters);await set('scaleValue',175);check('Shared edits leave Individual parameters intact',JSON.stringify(app.settings.layers.at(-1).parameters)===individual);
 await click('newFlowerLayer');check('Manual Flower increments total',$('fCountValue').value==='4');
 await set('skyColorHex','#345678');await click('settings-plant');check('Palette is global across all tabs',$('skyColorHex').value.toUpperCase()==='#345678');
 const beforeRegen=app.getSnapshot();await click('generateBtn');const regenerated=app.getSnapshot();check('Regenerate varies every unpinned procedural type',beforeRegen.layers.every((l,i)=>l.mode!=='auto'||l.locked||regenerated.layers[i].seed!==l.seed));
 check('Regenerate retains Individual parameters',beforeRegen.layers.filter(l=>l.parameterMode==='individual').every(l=>JSON.stringify(l.parameters)===JSON.stringify(regenerated.layers.find(n=>n.id===l.id).parameters)));
 await app.undo();await pause();check('Undo restores complete mixed scene',snapshot()===JSON.stringify(beforeRegen));await app.redo();await pause();check('Redo restores regeneration',snapshot()===JSON.stringify(regenerated));
 check('JSON round trip preserves entire unified scene',JSON.stringify(readDocument(makeDocument(app.getSnapshot())))===snapshot());
 // Switching tabs never interrupts or forks a Pen draft.
 await click('penTool');const canvas=$('canvasContainer'),rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,clientX:rect.x+rect.width*.3,clientY:rect.y+rect.height*.3,button:0,pointerId:1}));canvas.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,clientX:rect.x+rect.width*.3,clientY:rect.y+rect.height*.3,button:0,pointerId:1}));await click('settings-land');check('Pen stays active across settings tabs',$('penTool').getAttribute('aria-pressed')==='true');
 d.querySelector('[data-form-tool=move]').click();
 const r=new LandscapeRenderer();try{
 const fixtures=await(await fetch('./fixtures/scenes-before-unification.json')).json(),hashes=await(await fetch('./fixtures/pixels-before-unification.json')).json();
 for(const {name,settings} of fixtures)for(const phase of [0,.25]){
  r.render(motionFrame(normalizeSettings(settings),phase),320,180);const gl=r.gl,p=new Uint8Array(320*180*4);gl.readPixels(0,0,320,180,gl.RGBA,gl.UNSIGNED_BYTE,p);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',p))).map(v=>v.toString(16).padStart(2,'0')).join('');check(name+' pixel preservation at '+phase,hash===hashes.find(e=>e.name===name&&e.phase===phase).hash);
 }
 const mixed={...app.getSnapshot(),width:320,height:180,transparentBackground:true};const {blob}=await renderPNG(r,mixed),img=await createImageBitmap(blob);check('Mixed transparent PNG decodes',img.width===320&&img.height===180);img.close();
 const zip=await renderLayersZIP(r,mixed),files=readStoredZip(new Uint8Array(await zip.blob.arrayBuffer()));check('Layer ZIP contains every mixed layer',files.length===mixed.layers.length);
 }finally{r.destroy();}
 check('No UI errors',errors.length===0&&!$('operationStatus').textContent);
 check('All unified editor checks passed',true);
}catch(e){out.textContent+='\nERROR '+e.stack;}
