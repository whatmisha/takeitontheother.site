import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSettings,regenerate,makeDocument,readDocument} from '../document.js';
import {defaults,switchMode} from '../legacy-document.js';
import {getLayers,editLayer} from '../layers.js';
import {addObject,resizeObjects,editSharedParameters,setParameterMode} from '../object-actions.js';
import {effectiveSettings} from '../object-model.js';
import {floraParts} from '../flora.js';
import {flattenVectorPath} from '../vector-path.js';
import {localToCanvas} from '../transforms.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';
const base=()=>normalizeSettings(switchMode(defaults,'f'));
const layer=(s,id)=>getLayers(s).find(l=>l.id===id);
const shape=(s,l)=>floraParts(l,s);

test('adding Flowers preserves every existing layer, silhouette and transform exactly',()=>{
 let s=base();for(let count=2;count<=8;count++){
  const before=getLayers(s).map(l=>({id:l.id,layer:structuredClone(l),shape:shape(s,l)}));
  s=resizeObjects(s,'flower',count);assert.equal(s.objectDefaults.flower.fCount,count);
  for(const b of before){assert.deepEqual(layer(s,b.id),b.layer);assert.deepEqual(shape(s,layer(s,b.id)),b.shape);}
 }
 const roles=getLayers(s).slice(1).map(l=>l.composition.role);assert.deepEqual(roles.slice(0,3),['support','support','accent']);
 assert.ok(new Set(getLayers(s).map(l=>effectiveSettings(s,l).fScale)).size>3);
});
test('count reduction removes accents first and leaves remaining objects unchanged',()=>{
 let s=resizeObjects(base(),'flower',7),before=getLayers(s);s=resizeObjects(s,'flower',3);
 assert.deepEqual(getLayers(s),before.slice(0,3));
 s=resizeObjects(s,'flower',5);assert.equal(s.objectDefaults.flower.fCount,5);
 assert.equal(new Set(getLayers(s).map(l=>l.flora.index)).size,5);
});
test('Density preserves Individual, pinned, locked and unrelated layers; Regenerate respects pins and locks',()=>{
 let s=resizeObjects(base(),'flower',6),ids=getLayers(s).map(l=>l.id);
 s=setParameterMode(s,ids[1],'individual');s=editLayer(s,ids[2],{mode:'pinned',x:.27});s=editLayer(s,ids[3],{locked:true});const added=addObject(s,'plant');s=added.settings;
 const density=editSharedParameters(s,'flower',{fDensity:100}),generated=regenerate(s,42);
 for(const id of [...ids.slice(1,4),added.id])assert.deepEqual(layer(density,id),layer(s,id));
 for(const id of ids.slice(2,4))assert.deepEqual(layer(generated,id),layer(s,id));
 assert.notEqual(layer(generated,added.id).seed,layer(s,added.id).seed);assert.deepEqual(layer(generated,ids[1]).parameters,layer(s,ids[1]).parameters);
 for(const next of [density,generated]){assert.deepEqual(getLayers(next).map(l=>l.id),getLayers(s).map(l=>l.id));assert.notDeepEqual(layer(next,ids[0]),layer(s,ids[0]));}
});

test('Field density and seeds give deterministic but distinct compositions',()=>{
 const s=resizeObjects(base(),'flower',6);
 const low=editSharedParameters(s,'flower',{fDensity:0}),high=editSharedParameters(s,'flower',{fDensity:100});
 assert.deepEqual(low,editSharedParameters(s,'flower',{fDensity:0}));assert.notDeepEqual(getLayers(low),getLayers(high));
 assert.deepEqual(regenerate(high,42),regenerate(high,42));assert.notDeepEqual(getLayers(regenerate(high,42)),getLayers(regenerate(high,43)));
 assert.equal('fArrangement' in normalizeSettings({...s,fArrangement:'cluster'}),false);
});
test('all flower types retain visible heads in wide and tall compositions',()=>{
 for(const [width,height]of [[1920,1080],[1080,1920]])for(const fType of ['fan','cup','lobed','radial'])for(const seed of [48761,42,991]){
  let s=editSharedParameters({...base(),width,height,seed},'flower',{fType});s=regenerate(resizeObjects(s,'flower',6),seed);
  for(const l of getLayers(s)){
   const points=shape(s,l).filter(p=>p.kind==='petal').flatMap(p=>flattenVectorPath(p.path).map(p=>localToCanvas(p,l,width/height)));
   assert.ok(points.every(p=>p.every(Number.isFinite)));
   assert.ok(points.some(([x,y])=>x>=0&&x<=1&&y>=0&&y<=1),fType+' '+seed+' '+l.id+' has visible head');
  }
 }
});
test('composition roles, geometry, shared settings and layer geometry survive JSON and share',async()=>{
 let s=regenerate(resizeObjects(base(),'flower',5),413);s=editSharedParameters(s,'flower',{fColorPattern:'scattered',fDensity:83});
 const codec=new ShareCodec({pristineDefaults:defaults});
 for(const a of [readDocument(makeDocument(s)),normalizeSettings((await codec.decode(await codec.encode(s))).full)]){
  assert.deepEqual(getLayers(a),getLayers(s));assert.equal(a.objectDefaults.flower.fColorPattern,'scattered');assert.equal(a.objectDefaults.flower.fDensity,83);
 }
 const edited=editSharedParameters(s,'flower',{fColorPattern:'alternating',fDensity:21});assert.equal(edited.objectDefaults.flower.fColorPattern,'alternating');assert.equal(s.objectDefaults.flower.fColorPattern,'scattered');
});
test('approved single flower and Six cup shapes ignore composition variation until composed',()=>{
 for(const initial of [base(),JSON.parse(readFileSync(new URL('../presets/six-cup.json',import.meta.url)))]){
  const s=normalizeSettings(initial),l=getLayers(s)[0],before=shape(s,l);
  assert.equal(getLayers(s).length,1);
  const changed=editSharedParameters(s,'flower',{fSizeVariation:100,fShapeVariation:100,fPoseVariation:100,fDensity:100});
  assert.deepEqual(shape(changed,getLayers(changed)[0]),before);assert.deepEqual(getLayers(changed)[0],l);
 }
});
