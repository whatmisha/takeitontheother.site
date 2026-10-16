import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,normalizeSettings,makeDocument,readDocument,regenerate} from '../document.js';
import {addObject,resizeObjects,editSharedParameters,editObjectParameters,setParameterMode,countLimits} from '../object-actions.js';
import {getLayers,editLayer,withLayers,duplicateLayer,convertLayer,addLayer} from '../layers.js';
import {createLayerScene,adjacentColors} from '../scene.js';
import {floraParts} from '../flora.js';
import {effectiveSettings,sharedParameters} from '../object-model.js';
import {motionFrame} from '../motion.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';
const clean=v=>JSON.parse(JSON.stringify(v));
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/scenes-before-unification.json',import.meta.url)));
for(const fixture of fixtures)test('migration preserves '+fixture.name+' geometry, parts and tones',()=>{
 const s=normalizeSettings(fixture.settings);
 assert.deepEqual(clean(createLayerScene(s)),fixture.scene);
 assert.deepEqual(adjacentColors(s),fixture.colors);
 assert.deepEqual(clean(createLayerScene(s).filter(l=>l.flora).map(l=>floraParts(l,s))),fixture.parts);
 assert.deepEqual(readDocument(clean(makeDocument(s))),s);
 for(const key of ['mode','sceneMemory','surfaceMemory','landscapeLayers','abstractLayers','floraLayers','fLayers'])assert.ok(!(key in s));
});
test('all old named presets remain, four exact current scenes are added',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../presets/manifest.json',import.meta.url)));
 assert.deepEqual(manifest.presets.map(p=>p.name),['Flower Flow','Ember','Drift','Six Cup','Field','Land','Spot','Plant','Flora']);
 for(const name of ['Land','Spot','Plant','Flora'])assert.deepEqual(normalizeSettings(JSON.parse(readFileSync(new URL('../presets/'+name.toLowerCase()+'.json',import.meta.url)))),normalizeSettings(fixtures.find(f=>f.name===name).settings));
});
test('each kind has independent shared parameters and manual objects are Individual',()=>{
 let s=withLayers(defaults,[]);for(const kind of ['land','spot','plant','flower'])s=addObject(s,kind,{auto:true}).settings;
 const before=createLayerScene(s),n=editSharedParameters(s,'spot',{scale:150}),after=createLayerScene(n);
 assert.equal(sharedParameters(n,'land').scale,100);assert.equal(sharedParameters(n,'spot').scale,150);
 for(let i of [0,2,3])assert.deepEqual(before[i],after[i]);assert.notDeepEqual(before[1].geometryA,after[1].geometryA);
 const added=addObject(n,'flower');s=added.settings;assert.equal(s.layers.at(-1).parameterMode,'individual');const parts=floraParts(s.layers.at(-1),s);
 s=editSharedParameters(s,'flower',{fType:'cup',fScale:220});assert.deepEqual(floraParts(s.layers.at(-1),s),parts);
 s=editObjectParameters(s,added.id,{fType:'fan'});assert.equal(effectiveSettings(s,s.layers.at(-1)).fType,'fan');
});
test('counts are actual object totals, zero is stable, protected objects survive reduction',()=>{
 let s=withLayers(defaults,[]);s=resizeObjects(s,'plant',3);s=resizeObjects(s,'flower',4);const individual=addObject(s,'flower');s=individual.settings;
 assert.equal(sharedParameters(s,'flower').fCount,5);assert.equal(sharedParameters(s,'plant').floraCount,3);
 s=editLayer(s,s.layers.find(l=>l.kind==='flower').id,{mode:'pinned'});s=resizeObjects(s,'flower',0);assert.equal(countLimits(s,'flower').value,2);
 s=resizeObjects(s,'plant',0);assert.equal(sharedParameters(s,'plant').floraCount,0);assert.equal(normalizeSettings(s).layers.length,2);
});
test('Regenerate varies all unpinned procedural kinds, including Individual; protects pins, locks and manual geometry',()=>{
 let s=withLayers(defaults,[]);for(const kind of ['land','spot','plant','flower'])s=addObject(s,kind).settings;
 s=editLayer(s,s.layers[0].id,{mode:'pinned'});s=editLayer(s,s.layers[1].id,{locked:true});s=addLayer(s,'drawn').settings;s=addLayer(s,'vector').settings;
 const next=regenerate(s,89213);
 for(let i of [0,1,4,5])assert.deepEqual(next.layers[i],s.layers[i]);
 for(let i of [2,3]){assert.notEqual(next.layers[i].seed,s.layers[i].seed);assert.deepEqual(next.layers[i].parameters,s.layers[i].parameters);assert.equal(next.layers[i].x,s.layers[i].x);}
});
test('global appearance, custom colors, mixed layer order and animation survive JSON and snapshots',()=>{
 let s=withLayers(defaults,[]);for(const kind of ['land','spot','plant','flower'])s=addObject(s,kind).settings;
 s=normalizeSettings({...s,sky:'#123456',grain:17,toneProfile:'botanical',customColors:[{id:'custom-1',name:'Mint',color:'#55AA99'}]});s=editLayer(s,s.layers[2].id,{group:'custom-1'});
 const result=readDocument(clean(makeDocument(s)));assert.deepEqual(result,s);assert.equal(motionFrame(s,.25).layers.length,4);assert.equal(motionFrame(s,.25).layers[3].flora.generator,'flower');
 assert.deepEqual(normalizeSettings({...s,mode:'abstract',sceneMemory:{}}),s);
});
test('Auto conversion returns to shared parameters and duplication preserves visible Individual geometry',()=>{
 let s=resizeObjects(withLayers(defaults,[]),'flower',2),id=s.layers[0].id;s=setParameterMode(s,id,'individual');const copy=duplicateLayer(s,id);assert.deepEqual(floraParts(copy.settings.layers[0],copy.settings),floraParts(copy.settings.layers[1],copy.settings));
 s=setParameterMode(s,id,'auto');s=editSharedParameters(s,'flower',{fType:'fan'});assert.equal(effectiveSettings(s,s.layers[0]).fType,'fan');
});

test('share links preserve all four object types and shared defaults in one document',async()=>{
 let s=withLayers(defaults,[]);for(const kind of ['land','spot','plant','flower'])s=addObject(s,kind).settings;
 s=editSharedParameters(s,'spot',{scale:145});s=editSharedParameters(s,'flower',{fType:'cup'});
 const codec=new ShareCodec({pristineDefaults:defaults});const link=await codec.encode(s),decoded=await codec.decode(link);
 assert.deepEqual(normalizeSettings(decoded.full),s);
});
