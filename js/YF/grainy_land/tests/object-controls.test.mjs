import test from 'node:test';
import assert from 'node:assert/strict';
import {ObjectUI} from '../object-ui.js';
import {defaults,switchMode} from '../legacy-document.js';
import {getLayers,editLayer} from '../layers.js';
import {resizeObjects,countLimits} from '../object-actions.js';
import {selectedLayers,selectionValue,editSelection,deleteSelection} from '../selection.js';

class Input extends EventTarget {
 constructor(id,value){super();this.id=id;this.value=String(value);this.attributes={};}
 setAttribute(key,value){this.attributes[key]=value;}
 select(){}
 blur(){document.activeElement=null;this.dispatchEvent(new Event('blur'));}
 key(key){const e=new Event('keydown',{cancelable:true});Object.defineProperty(e,'key',{value:key});this.dispatchEvent(e);}
}
test('count drafts commit once on Enter, cancel on Escape, and invalid drafts never remove objects',()=>{
 const previous=globalThis.document,range=new Input('count',3),value=new Input('value',3);
 globalThis.document={getElementById:id=>id==='count'?range:value,activeElement:null};
 const calls=[],tool={settings:resizeObjects(switchMode(defaults,'f'),'flower',3),history:{flush(){},beginTransaction(label){calls.push('begin');},endTransaction(){calls.push('end');}},presets:{markDirty(){}},applySnapshot(s,options){assert.equal(options.deferRender,true);this.settings=s;}};
 const ui=new ObjectUI(tool,()=>{},{});
 try{
  const binding=ui.bindSlider(range,value,()=>({value:tool.settings.objectDefaults.flower.fCount}),n=>ui.live(resizeObjects(tool.settings,'flower',n),'Count'),0,32,1);
  const before=getLayers(tool.settings);
  document.activeElement=value;value.value='1';value.dispatchEvent(new Event('input'));value.value='12';value.dispatchEvent(new Event('input'));
  assert.deepEqual(getLayers(tool.settings),before);assert.equal(tool.settings.objectDefaults.flower.fCount,3);
  value.key('Escape');assert.equal(value.value,'3');assert.deepEqual(calls,[]);
  document.activeElement=value;value.value='5';value.key('Enter');assert.equal(tool.settings.objectDefaults.flower.fCount,5);assert.deepEqual(calls,['begin','end']);
  ui.syncSlider(binding,0,32);
  for(const draft of ['', 'invalid']){document.activeElement=value;value.value=draft;value.key('Enter');assert.equal(tool.settings.objectDefaults.flower.fCount,5);}
  assert.deepEqual(calls,['begin','end']);
  document.activeElement=value;value.value='';value.key('Escape');assert.equal(value.value,'5');
  ui.destroy();range.value='9';range.dispatchEvent(new Event('input'));assert.equal(tool.settings.objectDefaults.flower.fCount,5);
 }finally{ui.destroy();globalThis.document=previous;}
});
test('mixed property cancellation preserves Mixed and selection edits skip locks regardless of primary',()=>{
 let s=resizeObjects(switchMode(defaults,'f'),'flower',3),ids=getLayers(s).map(l=>l.id);
 s=editLayer(s,ids[0],{group:'terrain',opacity:40});s=editLayer(s,ids[1],{group:'depth',locked:true});
 const chosen=selectedLayers(s,ids);assert.equal(selectionValue(chosen,l=>l.group).mixed,true);
 const after=editSelection(s,ids,{group:'light',opacity:70},ids[1]);
 assert.deepEqual(getLayers(after).find(l=>l.id===ids[1]),getLayers(s).find(l=>l.id===ids[1]));
 for(const l of selectedLayers(after,ids,{editable:true})){assert.equal(l.group,'light');assert.equal(l.opacity,70);}
 assert.deepEqual(getLayers(deleteSelection(s,ids)).map(l=>l.id),[ids[1]]);
 const previous=globalThis.document,range=new Input('mixed',40),value=new Input('mixed-value','');
 globalThis.document={getElementById:id=>id==='mixed'?range:value,activeElement:value};
 const ui=new ObjectUI({history:{}},()=>{},{});
 try{ui.bindSlider(range,value,()=>({value:40,mixed:true}),()=>assert.fail('Escape must not commit'),0,100,1);value.key('Escape');assert.equal(value.value,'');assert.equal(value.placeholder,'Mixed');document.activeElement=value;value.blur();assert.equal(value.value,'');assert.equal(value.placeholder,'Mixed');}finally{ui.destroy();globalThis.document=previous;}
});
