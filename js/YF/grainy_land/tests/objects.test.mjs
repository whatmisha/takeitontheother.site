import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSettings,regenerate,makeDocument,readDocument} from '../document.js';
import {defaults,switchMode} from '../legacy-document.js';
import {getLayers,withLayers,editLayer,duplicateLayer,removeLayer,convertLayer} from '../layers.js';
import {addObject,countLimits,resizeObjects,setParameterMode,editObjectParameters,editSharedParameters} from '../object-actions.js';
import {effectiveSettings,modeLabels} from '../object-model.js';
import {floraParts} from '../flora.js';
import {createLayerScene} from '../scene.js';
import {layerExportPlan} from '../layers-export.js';
import {addCustomColor,removeCustomColor,colorIsUsed} from '../custom-colors.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';
const flower=()=>switchMode(defaults,'f');
const layer=(s,id)=>getLayers(s).find(l=>l.id===id);
const shape=(s,id)=>floraParts(layer(s,id),s);

test('one shared palette, surface and custom IDs survive mixed-document JSON and share',async()=>{
 let s=addCustomColor(normalizeSettings(defaults)).settings;for(const kind of ['spot','plant','flower'])s=addObject(s,kind).settings;
 s=normalizeSettings({...s,sky:'#112233',grain:21});s=editLayer(s,getLayers(s)[0].id,{group:'custom-1'});
 const codec=new ShareCodec({pristineDefaults:defaults});for(const a of [readDocument(makeDocument(s)),normalizeSettings((await codec.decode(await codec.encode(s))).full)])assert.deepEqual(a,s);
});

test('Regenerate changes unpinned Auto and Individual seeds but preserves locked objects',()=>{
 let s=resizeObjects(flower(),'flower',3),ids=getLayers(s).map(l=>l.id);s=setParameterMode(s,ids[1],'individual');s=editLayer(s,ids[2],{locked:true});const next=regenerate(s,48);
 for(const id of ids.slice(0,2))assert.notEqual(layer(next,id).seed,layer(s,id).seed);assert.deepEqual(layer(next,ids[1]).parameters,layer(s,ids[1]).parameters);assert.deepEqual(layer(next,ids[2]),layer(s,ids[2]));
});

test('manual additions, duplicates and deletions update actual counts and protect individual objects',()=>{
 let s=resizeObjects(flower(),'flower',3),added=addObject(s,'flower');s=added.settings;assert.equal(s.objectDefaults.flower.fCount,4);assert.equal(layer(s,added.id).parameterMode,'individual');
 const copy=duplicateLayer(s,added.id);s=copy.settings;assert.equal(s.objectDefaults.flower.fCount,5);
 const locked=getLayers(s)[0].id;s=editLayer(s,locked,{locked:true});
 s=resizeObjects(s,'flower',0);assert.equal(s.objectDefaults.flower.fCount,3);assert.equal(countLimits(s,'flower').min,3);assert.ok(layer(s,added.id)&&layer(s,copy.id)&&layer(s,locked));
 s=removeLayer(s,added.id);assert.equal(s.objectDefaults.flower.fCount,2);s=resizeObjects(s,'flower',99);assert.equal(getLayers(s).length,32);assert.throws(()=>addObject(s,'plant'),/Maximum/);
});
test('Plant arrangement changes do not delete layers, including Centered',()=>{
 let s=switchMode(defaults,'flora');s=withLayers(s,getLayers(s));const ids=getLayers(s).map(l=>l.id);
 for(const floraLayout of ['single','field','cluster']){s=editSharedParameters(s,'plant',{floraLayout});assert.deepEqual(getLayers(s).map(l=>l.id),ids);assert.equal(s.objectDefaults.plant.floraCount,4);}
});
test('Individual geometry ignores shared controls until returned to Auto',()=>{
 const added=addObject(defaults,'flower');let s=added.settings;const id=added.id,before=shape(s,id);
 s=editSharedParameters(s,'land',{scale:200,flow:1});s=editSharedParameters(s,'flower',{fType:'cup'});assert.deepEqual(shape(s,id),before);
 s=setParameterMode(s,id,'auto');assert.equal(effectiveSettings(s,layer(s,id)).fType,'cup');s=editSharedParameters(s,'flower',{fType:'lobed'});assert.equal(effectiveSettings(s,layer(s,id)).fType,'lobed');
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
test('duplicating a Flower retains geometry and creates an independent Individual object',()=>{
 const s=normalizeSettings(flower()),id=getLayers(s)[0].id,before=shape(s,id),copy=duplicateLayer(s,id);
 assert.equal(layer(copy.settings,copy.id).parameterMode,'individual');assert.deepEqual(shape(copy.settings,copy.id),before);
 const edited=editObjectParameters(copy.settings,copy.id,{fType:'cup'});assert.deepEqual(shape(edited,id),before);assert.notDeepEqual(shape(edited,copy.id),before);
});

test('custom colors used by any kind remain protected in the unified palette',()=>{
 let {settings:s,id}=addCustomColor(normalizeSettings(flower()));s=editLayer(s,getLayers(s)[0].id,{group:id});s=addObject(s,'land').settings;
 assert.equal(colorIsUsed(s,id),true);assert.throws(()=>removeCustomColor(s,id));s=removeLayer(s,getLayers(s).find(l=>l.group===id).id);assert.equal(removeCustomColor(s,id).customColors.length,0);
});

test('mixed Land and Spot keep their own geometry source; counts and ZIP treat each object once',()=>{
 let s=flower();for(const kind of ['plant','land','spot'])s=addObject(s,kind).settings;
 const scene=createLayerScene(s);assert.equal(scene.find(l=>l.kind==='land').geometryB[2],0);assert.equal(scene.find(l=>l.kind==='spot').geometryB[2],1);
 assert.equal(s.objectDefaults.plant.floraCount,1);assert.equal(s.objectDefaults.flower.fCount,1);assert.equal(layerExportPlan(s).entries.length,5);
});
test('Composition changes keep Individual, pinned and locked objects and layer order',()=>{
 let s=resizeObjects(flower(),'flower',4),ids=getLayers(s).map(l=>l.id);
 s=setParameterMode(s,ids[1],'individual');s=editLayer(s,ids[2],{mode:'pinned',x:.4});s=editLayer(s,ids[3],{locked:true});
 const arranged=editSharedParameters(s,'flower',{fDensity:85});assert.deepEqual(getLayers(arranged).map(l=>l.id),ids);for(const id of ids.slice(1))assert.deepEqual(layer(arranged,id),layer(s,id));
});
test('shipped Plant and Flora presets have explicit object kinds, correct counts and names',()=>{
 assert.deepEqual(modeLabels,{landscape:'Land',abstract:'Spot',flora:'Plant',f:'Flora'});
 for(const [name,kind,mode] of [['field','plant','flora'],['six-cup','flower','f']]){
  const s=JSON.parse(readFileSync(new URL('../presets/'+name+'.json',import.meta.url)));assert.equal(s.mode,mode);assert.deepEqual(normalizeSettings(s),normalizeSettings(normalizeSettings(s)));
  assert.ok(getLayers(s).filter(l=>l.flora).every(l=>l.kind===kind&&l.name.startsWith(kind==='plant'?'Plant':'Flower')));
 }
});
