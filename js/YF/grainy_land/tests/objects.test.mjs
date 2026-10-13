import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,normalizeSettings,switchMode,regenerate,makeDocument,readDocument} from '../document.js';
import {getLayers,withLayers,editLayer,duplicateLayer,removeLayer,convertLayer} from '../layers.js';
import {addObject,countLimits,resizeObjects,setParameterMode,editObjectParameters,editSharedParameters,copyObjectToScene} from '../object-actions.js';
import {effectiveSettings,modeLabels} from '../object-model.js';
import {floraParts} from '../flora.js';
import {createLayerScene} from '../scene.js';
import {layerExportPlan} from '../layers-export.js';
import {addCustomColor,removeCustomColor,colorIsUsed} from '../custom-colors.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';
const flower=()=>switchMode(defaults,'f');
const layer=(s,id)=>getLayers(s).find(l=>l.id===id);
const shape=(s,id)=>floraParts(layer(s,id),s);

test('four independent scene palettes, surface, seed and custom IDs survive JSON and share',async()=>{
 let s=defaults;const saved={};
 for(const [i,mode] of ['landscape','abstract','flora','f'].entries()){
  s=switchMode(s,mode);s=addCustomColor(s).settings;
  s=normalizeSettings({...s,seed:101+i,sky:['#112233','#445566','#778899','#AABBCC'][i],grain:21+i,customColors:[{id:'custom-1',name:'Local',color:['#123456','#234567','#345678','#456789'][i]}]});
  s=editLayer(s,getLayers(s)[0].id,{group:'custom-1'});saved[mode]={sky:s.sky,grain:s.grain,seed:s.seed,customColors:s.customColors,stack:getLayers(s)};
 }
 const codec=new ShareCodec({pristineDefaults:defaults});
 for(const serialized of [readDocument(makeDocument(s)),normalizeSettings((await codec.decode(await codec.encode(s))).full)]){
  for(const mode of Object.keys(saved)){const a=switchMode(serialized,mode);assert.deepEqual({sky:a.sky,grain:a.grain,seed:a.seed,customColors:a.customColors,stack:getLayers(a)},saved[mode]);}
 }
});
test('Generate changes only eligible Auto objects in active scene',()=>{
 let s=resizeObjects(flower(),'flower',3),ids=getLayers(s).map(l=>l.id);
 s=setParameterMode(s,ids[1],'individual');s=editLayer(s,ids[2],{locked:true});
 const original=structuredClone(s),other=switchMode(s,'flora');s=switchMode(other,'f');
 const beforeOther=switchMode(s,'flora'),next=regenerate(s,48);
 assert.notEqual(layer(next,ids[0]).seed,layer(s,ids[0]).seed);
 for(const id of ids.slice(1))assert.deepEqual(layer(next,id),layer(original,id));
 const afterOther=switchMode(next,'flora');assert.equal(afterOther.seed,beforeOther.seed);assert.deepEqual(getLayers(afterOther),getLayers(beforeOther));
});
test('manual additions, duplicates and deletions update actual counts and protect individual objects',()=>{
 let s=resizeObjects(flower(),'flower',3),added=addObject(s,'flower');s=added.settings;assert.equal(s.fCount,4);assert.equal(layer(s,added.id).parameterMode,'individual');
 const copy=duplicateLayer(s,added.id);s=copy.settings;assert.equal(s.fCount,5);
 const locked=getLayers(s)[0].id;s=editLayer(s,locked,{locked:true});
 s=resizeObjects(s,'flower',0);assert.equal(s.fCount,3);assert.equal(countLimits(s,'flower').min,3);assert.ok(layer(s,added.id)&&layer(s,copy.id)&&layer(s,locked));
 s=removeLayer(s,added.id);assert.equal(s.fCount,2);s=resizeObjects(s,'flower',99);assert.equal(getLayers(s).length,32);assert.throws(()=>addObject(s,'plant'),/Maximum/);
});
test('Plant arrangement changes do not delete layers, including Centered',()=>{
 let s=switchMode(defaults,'flora');s=withLayers(s,getLayers(s));const ids=getLayers(s).map(l=>l.id);
 for(const floraLayout of ['single','field','cluster']){s=normalizeSettings({...s,floraLayout});assert.deepEqual(getLayers(s).map(l=>l.id),ids);assert.equal(s.floraCount,4);}
});
test('foreign Individual geometry ignores native and origin scene controls; Auto inherits a local family profile',()=>{
 let added=addObject(defaults,'flower'),s=added.settings,id=added.id;const before=shape(s,id);
 s=normalizeSettings({...s,scale:200,flow:1,fType:'cup'});assert.deepEqual(shape(s,id),before);
 let source=switchMode(s,'f');source={...source,fType:'fan',fPetals:12};s=switchMode(source,'landscape');assert.deepEqual(shape(s,id),before);
 s=setParameterMode(s,id,'auto');assert.deepEqual(shape(s,id),before);
 s=editSharedParameters(s,'flower',{fType:'lobed'});assert.notDeepEqual(shape(s,id),before);assert.equal(effectiveSettings(s,layer(s,id)).fType,'lobed');assert.equal(switchMode(s,'f').fType,'fan');
});
test('Auto flowers vary by default; zero variation matches shapes and Individual conversion has no jump',()=>{
 let s=resizeObjects(flower(),'flower',4),ids=getLayers(s).map(l=>l.id);assert.notDeepEqual(shape(s,ids[0]),shape(s,ids[1]));
 s=editSharedParameters(s,'flower',{fSizeVariation:0,fShapeVariation:0,fPoseVariation:0});for(const id of ids)assert.deepEqual(shape(s,id).filter(p=>p.kind==='petal').map(p=>p.local),shape(s,ids[0]).filter(p=>p.kind==='petal').map(p=>p.local));
 s=editSharedParameters(s,'flower',{fSizeVariation:100,fShapeVariation:100,fPoseVariation:100});
 assert.notDeepEqual(shape(s,ids[0]),shape(s,ids[1]));assert.deepEqual(shape(s,ids[0]),shape(s,ids[0]));
 const before=shape(s,ids[0]);s=setParameterMode(s,ids[0],'individual');assert.deepEqual(shape(s,ids[0]),before);
 s=editObjectParameters(s,ids[0],{fType:'cup'});s=editSharedParameters(s,'flower',{fType:'fan',fPetals:9});assert.equal(effectiveSettings(s,layer(s,ids[0])).fType,'cup');assert.equal(effectiveSettings(s,layer(s,ids[1])).fType,'fan');
 const drawn=convertLayer(s,ids[1]),frozen=shape(drawn,ids[1]);assert.deepEqual(shape({...drawn,fScale:40,fType:'radial'},ids[1]),frozen);
});
test('copy to another scene retains geometry and uses destination palette roles without linking source',()=>{
 let s=flower();s={...s,depth:'#123456'};const id=getLayers(s)[0].id,before=shape(s,id),copy=copyObjectToScene(s,id,'landscape');
 assert.equal(copy.settings.depth,defaults.depth);assert.equal(layer(copy.settings,copy.id).kind,'flower');assert.equal(layer(copy.settings,copy.id).parameterMode,'individual');assert.deepEqual(shape(copy.settings,copy.id),before);
 const edited=editObjectParameters(copy.settings,copy.id,{fType:'cup'});assert.deepEqual(shape(switchMode(edited,'f'),id),before);
});
test('custom colors can be removed independently in another scene',()=>{
 let {settings:s,id}=addCustomColor(flower());s=editLayer(s,getLayers(s)[0].id,{group:id});
 let land=addCustomColor(switchMode(s,'landscape')).settings;assert.equal(colorIsUsed(land,id),false);land=removeCustomColor(land,id);
 const original=switchMode(land,'f');assert.equal(original.customColors.length,1);assert.equal(colorIsUsed(original,id),true);assert.throws(()=>removeCustomColor(original,id));
});
test('mixed Land and Spot keep their own geometry source; counts and ZIP treat each object once',()=>{
 let s=flower();for(const kind of ['plant','land','spot'])s=addObject(s,kind).settings;
 const scene=createLayerScene(s);assert.equal(scene.find(l=>l.kind==='land').geometryB[2],0);assert.equal(scene.find(l=>l.kind==='spot').geometryB[2],1);
 assert.equal(s.floraCount,1);assert.equal(s.fCount,1);assert.equal(layerExportPlan(s).entries.length,5);
});
test('Composition changes keep Individual, pinned and locked objects and layer order',()=>{
 let s=resizeObjects(flower(),'flower',4),ids=getLayers(s).map(l=>l.id);
 s=setParameterMode(s,ids[1],'individual');s=editLayer(s,ids[2],{mode:'pinned',x:.4});s=editLayer(s,ids[3],{locked:true});
 const arranged=editSharedParameters(s,'flower',{fDensity:85});assert.deepEqual(getLayers(arranged).map(l=>l.id),ids);for(const id of ids.slice(1))assert.deepEqual(layer(arranged,id),layer(s,id));
});
test('shipped Plant and Flora presets have explicit object kinds, correct counts and names',()=>{
 assert.deepEqual(modeLabels,{landscape:'Land',abstract:'Spot',flora:'Plant',f:'Flora'});
 for(const [name,kind,mode] of [['field','plant','flora'],['six-cup','flower','f']]){
  const s=JSON.parse(readFileSync(new URL('../presets/'+name+'.json',import.meta.url)));assert.equal(s.mode,mode);assert.deepEqual(s,normalizeSettings(s));
  assert.ok(getLayers(s).filter(l=>l.flora).every(l=>l.kind===kind&&l.name.startsWith(kind==='plant'?'Plant':'Flower')));
 }
});
