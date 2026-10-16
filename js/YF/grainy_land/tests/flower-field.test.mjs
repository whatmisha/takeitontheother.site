import test from 'node:test';
import assert from 'node:assert/strict';
import {regenerate,normalizeSettings,makeDocument,readDocument} from '../document.js';
import {defaults,switchMode} from '../legacy-document.js';
import {getLayers,withLayers,editLayer,convertLayer} from '../layers.js';
import {resizeObjects,setParameterMode,editSharedParameters} from '../object-actions.js';
import {effectiveSettings} from '../object-model.js';
import {floraParts,editFloraPart} from '../flora.js';
import {localToCanvas} from '../transforms.js';
import {layerExportPlan} from '../layers-export.js';
import {colorIsUsed,removeCustomColor} from '../custom-colors.js';
const field=(count=12,seed=44)=>regenerate(resizeObjects(switchMode(defaults,'f'),'flower',count),seed);
const colors=(s,l)=>floraParts(l,s).map(p=>p.group??l.group);

test('32 Plants and Flowers survive documents and export plans without truncation',()=>{
 for(const [mode,kind,key]of [['flora','plant','floraCount'],['f','flower','fCount']]){
  const s=resizeObjects(switchMode(defaults,mode),kind,32),round=readDocument(makeDocument(s));
  assert.equal(s.objectDefaults[kind][key],32);assert.equal(getLayers(round).length,32);assert.deepEqual(getLayers(round),getLayers(s));
  assert.equal(layerExportPlan(s).entries.length,33);assert.equal(resizeObjects(s,kind,99).objectDefaults[kind][key],32);
 }
});
test('size limits expand differences; zero variation restores common petal geometry',()=>{
 const s=editSharedParameters(field(),'flower',{fMinSize:5,fMaxSize:250,fSizeVariation:100});
 const sizes=getLayers(s).map(l=>effectiveSettings(s,l).fScale);assert.ok(Math.max(...sizes)/Math.min(...sizes)>10);
 const uniform=editSharedParameters(s,'flower',{fSizeVariation:0,fShapeVariation:0,fPoseVariation:0});
 assert.equal(new Set(getLayers(uniform).map(l=>effectiveSettings(uniform,l).fScale)).size,1);
});
test('most stems leave the lower edge while head positions and zero-length stems remain valid',()=>{
 for(const [width,height]of [[1920,1080],[1080,1920]])for(const seed of [11,44,991]){
  let s={...switchMode(defaults,'f'),width,height,seed};s=regenerate(resizeObjects(s,'flower',32),seed);
  let roots=0,extended=0;
  for(const l of getLayers(s)){
   const parts=floraParts(l,s),stem=parts.find(p=>p.kind==='stem'),root=localToCanvas([stem.path[0].x,stem.path[0].y],l,width/height);
   if(root[1]>1)roots++;
   if(l.composition?.stemExtension){
    extended++;const original={...l,composition:{...l.composition,stemExtension:0}},before=floraParts(original,s).filter(p=>p.kind==='petal');
    const heads=parts.filter(p=>p.kind==='petal');for(let i=0;i<heads.length;i++)assert.ok(Math.hypot(heads[i].origin[0]-before[i].origin[0],heads[i].origin[1]-before[i].origin[1])<1e-10);
   }
  }
  assert.ok(roots>=25,`${width} ${seed}: ${roots} roots hidden`);assert.ok(extended>10);
  const noStem=editSharedParameters(s,'flower',{fStem:0});assert.ok(getLayers(noStem).every(l=>floraParts(l,noStem).find(p=>p.kind==='stem').hidden));
 }
});
test('flower and petal palettes are deterministic, editable and use the current palette',()=>{
 const s=field(),layers=getLayers(s),combinations=new Set(layers.map(l=>colors(s,l).join(':')));assert.ok(combinations.size>5);
 assert.ok(layers.some(l=>new Set(colors(s,l)).size===3));
 const uniform=editSharedParameters(s,'flower',{fColorVariation:0,fPetalColors:0});for(const l of layers)assert.deepEqual([...new Set(colors(uniform,l))],[l.group]);
 const patterns=['grouped','alternating','scattered'].map(fColorPattern=>layers.map(l=>colors(editSharedParameters(s,'flower',{fColorPattern}),l)));
 assert.notDeepEqual(patterns[0],patterns[1]);assert.notDeepEqual(patterns[1],patterns[2]);
 const custom=editSharedParameters({...s,customColors:[{id:'custom-1',name:'Mint',color:'#80C9A1'}]},'flower',{fColorVariation:100,fPetalColors:100});
 assert.ok(layers.some(l=>colors(custom,l).includes('custom-1')));assert.equal(colorIsUsed(custom,'custom-1'),true);assert.throws(()=>removeCustomColor(custom,'custom-1'));
 let l=layers[0];l=editFloraPart(l,s,'p1',{group:'sky'});const edited=withLayers(s,[l,...layers.slice(1)]);
 assert.equal(floraParts(l,{...edited,fColorPattern:'scattered',fPetalColors:100}).find(p=>p.id==='p1').group,'sky');
});
test('Individual and Drawn keep their mixed colors and rooted stems when shared controls change',()=>{
 let s=field(6),l=getLayers(s)[2],before=floraParts(l,s);s=setParameterMode(s,l.id,'individual');l=getLayers(s).find(p=>p.id===l.id);
 assert.deepEqual(floraParts(l,s),before);const changed={...s,fColorVariation:0,fPetalColors:0,fMinSize:100,fMaxSize:250,fStem:0};assert.deepEqual(floraParts(l,changed),before);
 const drawn=convertLayer(field(6),l.id),d=getLayers(drawn).find(p=>p.id===l.id),frozen=floraParts(d,drawn);
 assert.deepEqual(floraParts(d,{...drawn,fColorPattern:'scattered',fPetalColors:0,fStem:0}),frozen);
 assert.deepEqual(readDocument(makeDocument(s)),normalizeSettings(s));
});
