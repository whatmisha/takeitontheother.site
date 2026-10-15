import {defaults,switchMode} from '../document.js?v=flower-field-2';
import {addObject,resizeObjects} from '../object-actions.js?v=flower-field-2';
import {LandscapeRenderer} from '../render.js?v=flower-field-2';
import {renderPNG} from '../png-export.js?v=flower-field-2';
import {renderLayersZIP} from '../layers-export.js?v=flower-field-2';
import {readStoredZip} from './zip-reader.js';
const frame=document.querySelector('#app'),out=document.querySelector('#results'),log=[];
const pause=()=>new Promise(r=>setTimeout(r,70));
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);out.textContent=log.join('\n');if(!ok)throw Error(name);};
try{
 for(let i=0;i<250&&!frame.contentDocument?.documentElement.dataset.ready;i++)await pause();
 const d=frame.contentDocument,w=frame.contentWindow,$=id=>d.getElementById(id),errors=[];
 w.addEventListener('error',e=>errors.push(e.message));
 const click=async id=>{$(id).click();await pause();};
 const set=async(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new w.Event('input',{bubbles:true}));$(id).dispatchEvent(new w.Event('change',{bubbles:true}));$(id).blur();$(id).dispatchEvent(new w.FocusEvent('blur'));await pause();};
 const rows=()=>[...d.querySelectorAll('#layerList > [data-layer-id]')],selected=()=>d.querySelector('#layerList .layer-select[aria-pressed="true"]');
 check('App ready',d.documentElement.dataset.ready==='true');
 // Use a known empty Flora scene; the startup preset may contain mixed objects.
 await click('presetDropdownToggle');d.querySelector('#presetDropdownMenu [data-value="Ember"]').click();await pause();
 check('New terminology',d.querySelector('label[for="modeFlora"]').textContent==='Plant'&&d.querySelector('label[for="modeFlower"]').textContent==='Flora');
 await click('modeFlower');await set('fCountValue',3);check('Flowers count creates three Auto layers',rows().length===3&&rows().every(r=>r.textContent.includes('Flower · Auto')));
 check('Arrange actions are removed',!$('arrange-flower')&&!$('arrange-plant'));
 check('Composition defaults have variation', $('fSizeVariationValue').value==='90'&&$('fShapeVariationValue').value==='55'&&$('fPoseVariationValue').value==='60');
 check('Flora uses Field without an Arrangement selector', !$('fArrangement'));
 const artwork=()=>$('mainCanvas').toDataURL();const diagonal=artwork();await set('fDensityValue',95);check('Density synchronizes both controls and redraws', $('fDensitySlider').value==='95'&&artwork()!==diagonal);
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',code:'KeyZ',metaKey:true,bubbles:true}));await pause();check('Density drag is undoable', $('fDensityValue').value==='55');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',code:'KeyZ',metaKey:true,shiftKey:true,bubbles:true}));await pause();check('Density redo restores controls', $('fDensityValue').value==='95');
 await click('generateBtn');check('Generate keeps flower count', $('fCountValue').value==='3');
 await set('fColorPattern','alternating');check('Flower color pattern changes', $('fColorPattern').value==='alternating');
 await set('fMinSizeValue',10);await set('fMaxSizeValue',210);check('Size range is editable', $('fMinSizeSlider').value==='10'&&$('fMaxSizeSlider').value==='210');
 await click('newFlowerLayer');check('Manual Flower is Individual and count follows',rows().length===4&&$('fCountValue').value==='4'&&selected().textContent.includes('Individual'));
 await set('individual-fType','cup');await set('fType','fan');check('Individual type ignores shared type', $('individual-fType').value==='cup');
 await click('layerDuplicate');check('Duplicate increments total',rows().length===5&&$('fCountValue').value==='5');
 await click('layerDelete');check('Delete updates total',rows().length===4&&$('fCountValue').value==='4');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',code:'KeyZ',metaKey:true,bubbles:true}));await pause();check('Undo restores deleted object and count',rows().length===5&&$('fCountValue').value==='5');
 await set('fCountValue',0);check('Count decrease protects manual objects',rows().length===2&&$('fCountValue').value==='2');
 rows()[0].querySelector('.layer-select').click();await pause();await set('copyObjectScene','landscape');check('Copy opens Land with a Flower Individual', $('modeLandscape').checked&&selected().textContent.includes('Flower · Individual'));
 d.querySelector('[data-parameter-mode="auto"]').click();await pause();check('Foreign Auto gets local shared controls',!!$('shared-flower')&&!$('shared-flower').hidden);
 await set('shared-flower-fColorPattern','scattered');await set('shared-flower-fDensity',22);check('Foreign Flower exposes composition settings', $('shared-flower-fColorPattern').value==='scattered'&&$('shared-flower-fDensity').value==='22');
 await set('shared-flower-fCount',2);check('Foreign count also creates Auto of its own type',rows().filter(r=>r.textContent.includes('Flower ·')).length===2);
 await set('skyColorHex','#123456');check('Land palette changes', $('skyColorHex').value.toUpperCase()==='#123456');
 await click('modeFlower');check('Flora retains its independent palette and count', $('skyColorHex').value.toUpperCase()===defaults.sky&&$('fCountValue').value==='2');
 await click('modeLandscape');check('Land palette and foreign objects restore', $('skyColorHex').value.toUpperCase()==='#123456'&&rows().filter(r=>r.textContent.includes('Flower ·')).length===2);
 await click('modeFlora');check('Plant has separate count and add label', $('floraCountValue').value==='4'&&$('newPlantLayer').textContent==='+ Plant');
 await set('floraLayout','single');check('Centered arrangement preserves all Plants', rows().length===4&&$('floraCountValue').value==='4');
 await click('newPlantLayer');check('Manual Plant starts Individual and increments Plants', $('floraCountValue').value==='5'&&selected().textContent.includes('Plant · Individual'));
 await set('floraCountValue',32);check('Plant supports 32 objects including manual additions',rows().length===32&&$('floraCountValue').value==='32'&&$('newPlantLayer').disabled);
 await click('modeFlower');await set('fCountValue',32);check('Flora supports 32 objects including manual additions',rows().length===32&&$('fCountValue').value==='32'&&$('newFlowerLayer').disabled);
 check('No UI errors',errors.length===0&&!$('operationStatus').textContent);
 const renderer=new LandscapeRenderer();try{
  let s={...switchMode(defaults,'f'),width:320,height:180};s=resizeObjects(s,'flower',2);for(const kind of ['plant','spot','land'])s=addObject(s,kind).settings;
  const {blob}=await renderPNG(renderer,{...s,transparentBackground:true}),img=await createImageBitmap(blob);check('Mixed scene PNG decodes',img.width===320&&img.height===180);img.close();
  const zip=await renderLayersZIP(renderer,s),files=readStoredZip(new Uint8Array(await zip.blob.arrayBuffer()));check('Mixed scene ZIP contains five objects plus Background',files.length===6);
  for(const f of files){const bitmap=await createImageBitmap(new Blob([f.bytes],{type:'image/png'}));check('ZIP PNG decodes: '+f.name,bitmap.width===320&&bitmap.height===180);bitmap.close();}
 }finally{renderer.destroy();}
 check('All object model checks passed',true);
}catch(e){out.textContent+='\nERROR '+e.stack;}
