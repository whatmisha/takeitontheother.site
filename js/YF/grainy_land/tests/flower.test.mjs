import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {flowerProfiles} from '../flower-profiles.js';
import {defaults,switchMode,normalizeSettings,makeDocument,readDocument,regenerate} from '../document.js';
import {buildFlowerParts,buildFlowerFromProfile,flowerType,flowerRanges} from '../flower.js';
import {getLayers,withLayers,editLayer,convertLayer} from '../layers.js';
import {floraParts,editFloraPart} from '../flora.js';
import {bakeFlora} from '../flora-field.js';
import {FloraEditor} from '../flora-editor.js';
import {moveVectorNode,splitVectorSegment} from '../vector-path.js';
import {colorIsUsed,addCustomColor} from '../custom-colors.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';
const start=()=>switchMode(defaults,'f');
// Ignore only floating-point reassociation below 1e-10 canvas units. GPU pixel
// equality is checked separately by flower-preservation.html against saved hashes.
const canonical=value=>JSON.stringify(value,(key,v)=>typeof v==='number'?Math.round(v*1e10)/1e10:v);
const shape=(s,l=getLayers(s)[0])=>floraParts(l,s).map(p=>[p.id,p.path,p.hidden]);
test('F starts with one flower, keeps four separate layer stacks and remembers its surface',async()=>{
 let s=start();assert.equal(s.mode,'f');assert.equal(getLayers(s).length,1);assert.equal(getLayers(s)[0].flora.generator,'flower');
 s=editLayer(s,'flower-1',{name:'My flower',opacity:72});s={...s,grain:21};
 const flora=switchMode(s,'flora');assert.equal(getLayers(flora).length,4);assert.equal(flora.grain,49);
 const back=switchMode(flora,'f');assert.deepEqual(back.fLayers,s.fLayers);assert.equal(back.grain,21);assert.equal(getLayers(switchMode(s,'landscape')).length,8);
 assert.deepEqual(readDocument(makeDocument(s)),s);
 const codec=new ShareCodec({pristineDefaults:defaults});assert.deepEqual(normalizeSettings((await codec.decode(await codec.encode(s))).full),s);
});
test('All flower types are reproducible, keep one stem and have finite attached petals at extreme viewpoints',()=>{
 const types=new Set();for(let seed=0;seed<32;seed++){const s={...start(),seed};types.add(flowerType(getLayers(s)[0],s));}assert.deepEqual([...types],['radial']);
 for(const fType of ['fan','cup','lobed','radial'])for(const fTilt of [0,35,85])for(const fPetals of [3,12])for(const aspect of [.56,1,1.78]){
  const s={...start(),fType,fTilt,fPetals,width:1080*aspect,height:1080},l=getLayers(s)[0],parts=floraParts(l,s),stem=parts.find(p=>p.id==='p0');
  assert.equal(parts.length,fPetals+1);assert.equal(parts.filter(p=>p.kind==='stem').length,1);
  for(const p of parts){assert.ok(p.path.every(n=>[n.x,n.y,...n.in,...n.out].every(Number.isFinite)));if(p.parent)assert.deepEqual([p.path[0].x,p.path[0].y],[stem.path[2].x,stem.path[2].y]);}
  assert.deepEqual(shape(s),shape({...s,grain:0,terrain:'#FFFFFF'}));
 }
});
test('F controls change geometry without reshuffling the chosen type; invalid inputs are bounded',()=>{
 for(const fType of ['fan','cup','lobed','radial']){
  const s={...start(),fType},before=shape(s);
  for(const key of ['fScale','fPetals','fOpening','fWidth','fCurl','fAsymmetry','fRecognition','fTilt','fRotation','fCenterX','fCenterY','fStem','fBend'])assert.notDeepEqual(shape({...s,[key]:flowerRanges[key][0]}),before,key+' affects '+fType);
  assert.equal(flowerType(getLayers(s)[0],{...s,fTilt:80}),fType);
 }
 const s=normalizeSettings({...start(),fType:'invalid',fTilt:999,fPetals:100,fScale:null});assert.equal(s.fType,'radial');assert.equal(s.fTilt,85);assert.equal(s.fPetals,12);assert.equal(s.fScale,110);
});
test('Moving the flower center carries petals and their local edits; stem zero does not hide the bloom',()=>{
 const s=start();let l=getLayers(s)[0],parts=floraParts(l,s),p=parts.find(p=>p.id==='p1');
 l=editFloraPart(l,s,'p1',{path:moveVectorNode(p.local,3,[.2,-.2])});parts=floraParts(l,s);const stem=parts[0],old=stem.local[2];
 l=editFloraPart(l,s,'p0',{path:moveVectorNode(stem.local,2,[old.x+.1,old.y-.08])});const after=floraParts(l,s);
 for(const p of parts.filter(p=>p.parent)){const q=after.find(q=>q.id===p.id);assert.deepEqual(q.local,p.local);assert.ok(Math.abs(q.origin[0]-p.origin[0]-.1)<.0001);}
 const noStem=floraParts(getLayers(s)[0],{...s,fStem:0});assert.equal(noStem.filter(p=>p.hidden).length,1);assert.equal(noStem.filter(p=>!p.hidden).length,s.fPetals);
});
test('F regenerate preserves manual edits and pinning; Drawn freezes all flower parameters and merge',()=>{
 let s=start(),l=getLayers(s)[0],p=floraParts(l,s).find(p=>p.id==='p1');l=editFloraPart(l,s,'p1',{path:moveVectorNode(p.local,3,[.1,-.2])});s=withLayers(s,[l]);
 const changed=regenerate(s,994);assert.notEqual(getLayers(changed)[0].seed,l.seed);assert.deepEqual(getLayers(changed)[0].flora.edits,l.flora.edits);
 const pinned=editLayer(s,l.id,{mode:'pinned'});assert.deepEqual(shape(regenerate(pinned,33)),shape(pinned));
 const drawn=convertLayer(s,l.id),before=shape(drawn),baked=bakeFlora(getLayers(drawn)[0],drawn);
 const altered=regenerate({...drawn,fType:'radial',fPetals:12,fTilt:85,fScale:50,fMerge:100},728);
 assert.deepEqual(shape(altered),before);assert.equal(bakeFlora(getLayers(altered)[0],altered),baked);
});
test('Custom colors on F parts are protected even while another mode is active',()=>{
 let {settings:s,id}=addCustomColor(start()),l=getLayers(s)[0];l=editFloraPart(l,s,'p1',{group:id});s=withLayers(s,[l]);assert.equal(colorIsUsed(switchMode(s,'landscape'),id),true);
});

test('Flower center follows the attachment after inserting a stem anchor',()=>{
 const s=start();let layer=getLayers(s)[0];const stem=floraParts(layer,s)[0];
 layer=editFloraPart(layer,s,stem.id,{path:splitVectorSegment(stem.local,0,.5),reindex:{at:1,delta:1}});
 const editor=new FloraEditor({layer:()=>layer,tool:{settings:s}}),center=editor.center();
 assert.equal(center.node,3);for(const petal of floraParts(layer,s).filter(p=>p.parent))assert.deepEqual(petal.origin,[center.part.path[center.node].x,center.part.path[center.node].y]);
});

test('Generated F stems keep a smooth tangent at side junctions',()=>{
 for(let seed=0;seed<8;seed++)for(const fBend of [-100,-35,0,35,100]){
  const s={...start(),seed,fBend},stem=floraParts(getLayers(s)[0],s)[0];
  for(const i of [1,3]){const n=stem.local[i],a=[n.x-n.in[0],n.y-n.in[1]],b=[n.out[0]-n.x,n.out[1]-n.y];assert.ok((a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b))>.99999);}
 }
});
test('Default F petals fit the canvas across families; recognition changes their contours continuously',()=>{
 for(const fType of ['fan','cup','lobed','radial'])for(let seed=0;seed<24;seed++){
  const s={...start(),seed,fType},l=getLayers(s)[0],petals=floraParts(l,s).filter(p=>p.kind==='petal');
  for(const p of petals)for(const n of p.path)assert.ok(n.x>0&&n.x<1&&n.y>0&&n.y<1,'Default bloom remains visible');
  const geometry=value=>floraParts(l,{...s,fRecognition:value}).filter(p=>p.kind==='petal').flatMap(p=>p.path.flatMap(n=>[n.x,n.y]));
  const clear=geometry(100),near=geometry(99),abstract=geometry(0),delta=to=>Math.max(...to.map((n,i)=>Math.abs(n-clear[i])));
  assert.ok(delta(near)<.015,'Small recognition changes have no shape jump');assert.ok(delta(abstract)>(['cup','radial'].includes(fType)?.005:.02),'Recognition changes petals, not only stem width');
 }
});

test('Cup and Radial preserve the preferred BEFORE corollas across controls and seeds',async()=>{
 const {buildFlowerParts:before}=await import('./reviews/flower-growth-20/flower-before.js');
 for(const fType of ['cup','radial'])for(const seed of [0,17,1565559100])for(const fTilt of [0,35,85])for(const fRecognition of [0,60,100]){
  const s={...start(),seed,fType,fTilt,fRecognition},l=getLayers(s)[0],petals=parts=>parts.filter(p=>p.kind==='petal');
  assert.equal(canonical(petals(buildFlowerParts(l,s))),canonical(petals(before(l,s))));
 }
});


test('Shared profile pipeline preserves all approved families at default and extreme settings',()=>{
 const samples=JSON.parse(readFileSync(new URL('./fixtures/flower-approved.json',import.meta.url),'utf8'));
 for(const sample of samples){
  const s={...start(),...sample.settings,seed:sample.seed},layer=getLayers(s)[0];layer.flora.variant=sample.variant;
  const hash=createHash('sha256').update(canonical(buildFlowerParts(layer,s))).digest('hex');
  assert.equal(hash,sample.geometryHash,sample.id);
 }
});
test('An unregistered profile combines arrangement, contour, growth and depth through the same generator',()=>{
 const recipe=JSON.parse(JSON.stringify({...flowerProfiles.radial,label:'Test hybrid',
  arrangement:flowerProfiles.fan.arrangement,growth:flowerProfiles.lobed.growth,
  projection:flowerProfiles.cup.projection,maxRadius:.43}));
 const s={...start(),fType:'unregistered'},layer=getLayers(s)[0],before=JSON.stringify(recipe);
 const parts=buildFlowerFromProfile(layer,s,recipe);
 assert.deepEqual(parts,buildFlowerFromProfile(layer,s,JSON.parse(before)));
 assert.equal(JSON.stringify(recipe),before,'Building must not mutate profile data');
 assert.equal(parts.length,s.fPetals+1);assert.equal(new Set(parts.map(p=>p.id)).size,parts.length);
 for(const p of parts){
  assert.ok(p.path.every(n=>[n.x,n.y,...n.in,...n.out].every(Number.isFinite)));
  if(p.kind==='petal'){assert.equal(p.parent,'p0');assert.equal(p.parentNode,2);assert.deepEqual([p.path[0].x,p.path[0].y],[0,0]);}
 }
 for(const fType of Object.keys(flowerProfiles))assert.notDeepEqual(parts,buildFlowerParts(layer,{...s,fType}));
 for(const fType of Object.keys(flowerProfiles))assert.deepEqual(parts,buildFlowerFromProfile(layer,{...s,fType},recipe),'The engine must not dispatch by a built-in type');
 const changed=buildFlowerFromProfile({...layer,seed:layer.seed+1},s,recipe);assert.notDeepEqual(parts,changed);
 for(const key of ['fOpening','fCurl','fTilt','fRecognition']){
  const nearby=buildFlowerFromProfile(layer,{...s,[key]:s[key]+1},recipe);assert.notDeepEqual(parts,nearby);
  for(const p of parts.filter(p=>p.kind==='petal')){
   const next=nearby.find(q=>q.id===p.id);
   assert.ok(p.path.every((n,i)=>Math.hypot(n.x-next.path[i].x,n.y-next.path[i].y)<.02),'Small control changes stay continuous');
  }
 }
});
