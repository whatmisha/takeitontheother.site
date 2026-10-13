import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalizeSettings,makeDocument,readDocument,regenerate,switchMode} from '../document.js';
import {getLayers,addLayer,addBlueLayer,withLayers} from '../layers.js';
import {layerExportPlan} from '../layers-export.js';
import {FormEditor} from '../form-editor.js';
test('Background visibility survives documents, Generate and mode changes independently of export toggles',()=>{
 const s=normalizeSettings({...defaults,backgroundVisible:false});
 assert.equal(normalizeSettings({}).backgroundVisible,true);
 assert.deepEqual(readDocument(makeDocument(s)),s);
 assert.equal(regenerate(s,3).backgroundVisible,false);assert.equal(switchMode(s,'f').backgroundVisible,true);
 assert.equal(s.transparentBackground,false);assert.equal(s.previewTransparent,false);
 const plan=layerExportPlan(s);assert.equal(plan.entries.at(-1).name,'09-Background-hidden.png');
 assert.ok(!layerExportPlan({...s,transparentBackground:true}).entries.some(e=>e.index===-1));
});
test('Blue action creates one visible independent layer and works with one slot left',()=>{
 let s=defaults;const before=getLayers(s),added=addBlueLayer(s),stack=getLayers(added.settings);
 assert.equal(stack.length,before.length+1);assert.equal(stack[0].id,added.id);assert.equal(stack[0].visible,true);assert.deepEqual(stack.slice(1),before);
 s=added.settings;while(getLayers(s).length<31)s=addLayer(s).settings;
 assert.equal(getLayers(addBlueLayer(s).settings).length,32);assert.throws(()=>addBlueLayer(addBlueLayer(s).settings),/Maximum/);
});
test('Send to back/front preserves selection order and rejects locks and active gestures',()=>{
 const previous=globalThis.document;globalThis.document={getElementById:()=>({querySelector:()=>null})};
 try{
  const initial=withLayers(defaults,getLayers(defaults)),ids=getLayers(initial).slice(2,4).map(l=>l.id);
  const e=Object.create(FormEditor.prototype);e.tool={settings:initial};e.selected=ids[0];e.selectedIds=new Set(ids);e.endOpacity=()=>{};
  e.change=(_tool,s)=>{e.tool.settings=s;};
  e.edgeLayer(-1);assert.deepEqual(getLayers(e.tool.settings).slice(0,2).map(l=>l.id),ids);
  e.edgeLayer(1);assert.deepEqual(getLayers(e.tool.settings).slice(-2).map(l=>l.id),ids);
  const before=e.tool.settings;e.gesture={};e.edgeLayer(-1);assert.equal(e.tool.settings,before);e.gesture=null;
  e.tool.settings=withLayers(before,getLayers(before).map(l=>l.id===ids[0]?{...l,locked:true}:l));const locked=e.tool.settings;e.edgeLayer(-1);assert.deepEqual(e.tool.settings,locked);
 }finally{globalThis.document=previous;}
});
