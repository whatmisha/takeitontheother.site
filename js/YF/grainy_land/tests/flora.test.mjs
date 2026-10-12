import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,floraSurfaceDefaults,switchMode,normalizeSettings,regenerate,editForm,makeDocument,readDocument} from '../document.js';
import {floraParts,editFloraPart,resizeFloraStack} from '../flora.js';
import {bakeFlora,signedField} from '../flora-field.js';
import {getLayers,withLayers,editLayer,convertLayer,addLayer} from '../layers.js';
import {addCustomColor,colorIsUsed} from '../custom-colors.js';
import {splitVectorSegment,moveVectorNode} from '../vector-path.js';
import {layerExportPlan} from '../layers-export.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';
const settings=()=>normalizeSettings({...defaults,mode:'flora'});
const shape=(l,s)=>floraParts(l,s).map(p=>[p.id,p.parent,p.path,p.origin]);
test('Flora validates discrete controls and bounds untrusted edits',()=>{
 const s=normalizeSettings({...settings(),floraCount:5.7,floraBranches:2.4,floraScale:999,floraRecognition:null});
 assert.equal(s.floraCount,6);assert.equal(s.floraBranches,2);assert.equal(s.floraScale,180);assert.equal(s.floraRecognition,55);
 assert.equal(getLayers({...s,floraLayout:'single'}).length,1);
 for(const layout of ['single','cluster','field']){const a={...s,floraLayout:layout};for(const l of getLayers(a))assert.ok(floraParts(l,a).every(p=>p.path.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y))));}
});
test('Flora geometry is seeded, palette-independent, and controlled by recognizability',()=>{
 const s=settings(),l=getLayers(s)[0],before=shape(l,s);
 assert.deepEqual(shape(l,s),before);assert.deepEqual(shape(l,{...s,grain:0,terrain:'#11FF00',light:'#FFFFFF'}),before);
 assert.notDeepEqual(shape({...l,seed:1234},s),before);
 assert.notDeepEqual(shape(l,{...s,floraRecognition:0}),shape(l,{...s,floraRecognition:100}));
 assert.deepEqual(floraParts(l,s).filter(p=>Number(p.id.slice(1))<10).map(p=>p.id),floraParts(l,{...s,floraBranches:1}).map(p=>p.id));
});
test('Moving a stem socket carries descendants and preserves their local edits',()=>{
 const s=settings();let l=getLayers(s)[0];const petal=floraParts(l,s).find(p=>p.id==='p1');
 l=editFloraPart(l,s,'p1',{path:moveVectorNode(petal.local,3,[.17,-.43])});
 const before=floraParts(l,s),stem=before[0],tip=stem.local[2];
 l=editFloraPart(l,s,'p0',{path:moveVectorNode(stem.local,2,[tip.x+.1,tip.y-.1])});
 const after=floraParts(l,s).find(p=>p.id==='p1');
 assert.deepEqual(after.local,before.find(p=>p.id==='p1').local);
 assert.ok(Math.abs(after.origin[0]-petal.origin[0]-.1)<.0001);assert.ok(Math.abs(after.origin[1]-petal.origin[1]+.1)<.0001);
});
test('Insertions preserve attachment node identity; detached parts keep their position',()=>{
 const s=settings();let l=getLayers(s)[0];const before=floraParts(l,s),origin=before.find(p=>p.id==='p1').origin;
 l=editFloraPart(l,s,'p0',{path:splitVectorSegment(before[0].local,0,.5),reindex:{at:1,delta:1}});
 assert.ok(floraParts(l,s).find(p=>p.id==='p1').origin.every((v,i)=>Math.abs(v-origin[i])<.00001));
 l=editFloraPart(l,s,'p1',{detached:true});const p0=floraParts(l,s)[0];
 l=editFloraPart(l,s,'p0',{path:moveVectorNode(p0.local,3,[.2,-.5])});
 assert.ok(floraParts(l,s).find(p=>p.id==='p1').origin.every((v,i)=>Math.abs(v-origin[i])<.00001));
 l=editFloraPart(l,s,'p1',{detached:false});assert.notDeepEqual(floraParts(l,s).find(p=>p.id==='p1').origin,origin);
});
test('Generate keeps manual petal paths; Drawn conversion freezes all Flora geometry',()=>{
 let s=settings(),l=getLayers(s)[0],p=floraParts(l,s)[1];l=editFloraPart(l,s,p.id,{path:moveVectorNode(p.local,3,[.12,-.2])});
 s=withLayers(s,[l]);const generated=regenerate(s,988),g=getLayers(generated)[0];
 assert.deepEqual(floraParts(l,s)[1].local,floraParts(g,generated)[1].local);assert.notEqual(g.seed,l.seed);
 s=convertLayer(s,l.id);const frozen=getLayers(s)[0],before=shape(frozen,s);
 const altered=regenerate({...s,floraScale:180,floraLayout:'field',floraCount:12,floraBranches:5,floraRecognition:0},8877);
 assert.deepEqual(shape(getLayers(altered)[0],altered),before);
});
test('Flora edits preserve Landscape and Abstract and round-trip through JSON/share',async()=>{
 let s={...editForm(defaults,0,{x:.2}),mode:'flora'},l=getLayers(s)[0];s=editLayer(s,l.id,{opacity:60});
 assert.equal(s.landscapeForms[0].x,.2);const land=s.landscapeForms;
 s=addLayer({...s,mode:'abstract'},'vector').settings;s={...s,mode:'flora'};
 const re=readDocument(JSON.parse(JSON.stringify(makeDocument(s))));assert.deepEqual(re,s);assert.deepEqual(re.landscapeForms,land);
 const codec=new ShareCodec({pristineDefaults:defaults});assert.deepEqual(normalizeSettings((await codec.decode(await codec.encode(s))).full),s);
});
test('Custom colors survive on parent and parts and cannot be deleted while used',()=>{
 const {settings:s,id}=addCustomColor(settings());let l=getLayers(s)[0];l=editFloraPart(l,s,'p1',{group:id});
 const a=editLayer(withLayers(s,[l]),l.id,{group:id}),b=readDocument(makeDocument(a));
 assert.equal(getLayers(b)[0].group,id);assert.equal(floraParts(getLayers(b)[0],b)[1].group,id);assert.ok(colorIsUsed(b,id));
});
test('Count changes preserve surviving edits and drawn layers; empty stack stays empty on Generate',()=>{
 let s=withLayers(settings(),getLayers(settings()));s=editLayer(s,'flora-1',{name:'My flower'});s=addLayer(s).settings;
 const shrunk=resizeFloraStack({...s,floraCount:2});assert.equal(getLayers(shrunk).length,3);assert.equal(getLayers(shrunk)[0].name,'My flower');assert.equal(getLayers(shrunk).at(-1).mode,'drawn');
 assert.equal(getLayers(resizeFloraStack({...shrunk,floraCount:5})).filter(l=>l.flora).length,5);
 assert.deepEqual(getLayers(regenerate(withLayers(s,[]),92)),[]);
});
test('Signed fields are isotropic; baked Flora masks are deterministic and have clear margins',()=>{
 const mask=new Uint8Array(49);mask[24]=1;const d=signedField(mask,7,7,1);assert.equal(d[24],1);assert.equal(d[23],-1);assert.equal(d[17],-1);assert.ok(Math.abs(d[16]+Math.SQRT2)<.0001);
 const s=settings(),l=getLayers(s)[0],f=bakeFlora(l,s);assert.equal(bakeFlora(l,s),f);assert.ok(f.width<=762&&f.height<=442);assert.ok(f.pixels[0]<128);
 assert.notDeepEqual(bakeFlora(l,{...s,floraMerge:0}).pixels,bakeFlora(l,{...s,floraMerge:100}).pixels);
});
test('Layer export treats each plant as a single independent PNG',()=>{
 const plan=layerExportPlan(settings());assert.equal(plan.entries.length,5);assert.ok(plan.entries.filter(e=>e.index>=0).length===4);
});

test('Flora surface defaults are scoped to mode entry and retain edits through round trips',async()=>{
 const surface=s=>Object.fromEntries(Object.keys(floraSurfaceDefaults).map(k=>[k,s[k]]));
 const land={...defaults,grain:17,contrast:135},flora=switchMode(land,'flora');
 assert.deepEqual(surface(flora),floraSurfaceDefaults);assert.equal(flora.sky,land.sky);
 assert.deepEqual(surface(normalizeSettings({mode:'flora'})),floraSurfaceDefaults);
 const edited={...flora,grain:72,softness:29},back=switchMode(edited,'landscape');
 assert.deepEqual(surface(back),surface(land));assert.equal(switchMode(back,'flora').grain,72);
 assert.deepEqual(surface(switchMode(switchMode(edited,'abstract'),'flora')),surface(edited));
 assert.equal(switchMode(readDocument(makeDocument(back)),'flora').softness,29);
 const codec=new ShareCodec({pristineDefaults:defaults}),shared=await codec.decode(await codec.encode(back));
 assert.deepEqual(surface(switchMode(shared.full,'flora')),surface(edited));
 assert.deepEqual(surface(normalizeSettings(edited)),surface(edited));
 assert.equal(switchMode({...defaults,mode:'abstract',glow:66},'landscape').glow,66);
 assert.deepEqual(surface(normalizeSettings(defaults)),surface(defaults));
});


test('Cluster has a dominant head, staggered junctions and both directions of growth',()=>{
 const directions=new Set(),positions=new Set(),colorPlans=new Set();
 for(const seed of [152274286,3124604871,949521042,230997082,3350086222,2973545222,1111927890,617675128]){
  const s={...settings(),seed},stack=getLayers(s),plants=stack.map(l=>floraParts(l,s));
  const tips=plants.map(p=>p.find(part=>part.id==='p1').origin);
  assert.ok(Math.max(...tips.map(p=>p[1]))-Math.min(...tips.map(p=>p[1]))>.3);
  const extent=p=>Math.max(...p.filter(q=>q.kind==='petal'&&Number(q.id.slice(1))<10).flatMap(q=>q.local.map(n=>Math.hypot(n.x*s.width/s.height,n.y))));
  assert.ok(extent(plants[0])>extent(plants[1])*1.1);
  const stem=plants[0][0];directions.add(Math.sign(stem.path[2].x-stem.path[0].x));
  positions.add(tips.map(p=>p.map(x=>x.toFixed(1)).join(',')).join('/'));
  colorPlans.add(stack.map(l=>l.group).join(','));
 }
 assert.equal(directions.size,2);assert.ok(positions.size>=6);assert.ok(colorPlans.size>1);
});

test('All generated Flora joints remain attached across layout and control extremes',()=>{
 for(const floraLayout of ['single','cluster','field'])for(const floraRecognition of [0,100])for(const floraBend of [0,100]){
  const s={...settings(),seed:2973545222,floraLayout,floraCount:12,floraBranches:5,floraRecognition,floraBend};
  for(const layer of getLayers(s)){
   const parts=floraParts(layer,s);assert.equal(parts.length,30);
   for(const p of parts){
    assert.ok(p.path.every(n=>[n.x,n.y,...n.in,...n.out].every(Number.isFinite)));
    if(!p.parent)continue;const parent=parts.find(q=>q.id===p.parent),socket=parent.path[p.parentNode];
    assert.ok(Math.abs(p.path[0].x-socket.x)<1e-10&&Math.abs(p.path[0].y-socket.y)<1e-10);
   }
  }
 }
});


test('Branch chains preserve existing geometry when more blossoms are added',()=>{
 const s={...settings(),seed:152274286},l=getLayers(s)[0];
 const full=floraParts(l,{...s,floraBranches:5});
 for(let count=1;count<5;count++){
  const parts=floraParts(l,{...s,floraBranches:count});
  for(const p of parts)assert.deepEqual(p,full.find(q=>q.id===p.id));
 }
 const nested=full.filter(p=>p.kind==='branch'&&p.parent!=='p0');assert.ok(nested.length>0);
 for(const p of full.filter(p=>p.parent))assert.ok(full.findIndex(q=>q.id===p.parent)<full.indexOf(p));
 const stem=full[0];assert.ok(Math.abs(stem.local[1].y-stem.local[3].y)>.005);
});

test('Editing and hiding a nested branch propagates through its descendants',()=>{
 const s={...settings(),seed:152274286};let l=getLayers(s)[0];
 const initial=floraParts(l,s),child=initial.find(p=>p.kind==='branch'&&p.parent!=='p0');assert.ok(child);
 const petal=initial.find(p=>p.parent===child.id&&p.kind==='petal');
 l=editFloraPart(l,s,petal.id,{path:moveVectorNode(petal.local,3,[.13,-.16])});
 const before=floraParts(l,s),parent=before.find(p=>p.id===child.parent),socket=parent.local[child.parentNode];
 l=editFloraPart(l,s,parent.id,{path:moveVectorNode(parent.local,child.parentNode,[socket.x+.07,socket.y-.04])});
 const after=floraParts(l,s),oldSocket=parent.path[child.parentNode],newSocket=after.find(p=>p.id===parent.id).path[child.parentNode];
 const delta=[newSocket.x-oldSocket.x,newSocket.y-oldSocket.y];
 assert.ok(Math.abs(delta[0]-.07)<1e-4&&Math.abs(delta[1]+.04)<1e-4);
 for(const p of before.filter(p=>p.id===child.id||p.parent===child.id)){
  const q=after.find(q=>q.id===p.id);assert.deepEqual(q.local,p.local);
  assert.ok(Math.abs(q.origin[0]-p.origin[0]-delta[0])<1e-9&&Math.abs(q.origin[1]-p.origin[1]-delta[1])<1e-9);
 }
 l=editFloraPart(l,s,parent.id,{hidden:true});
 const hidden=floraParts(l,s);assert.ok(hidden.find(p=>p.id===child.id).hidden);assert.ok(hidden.find(p=>p.id===petal.id).hidden);
 l=editFloraPart(l,s,child.id,{detached:true});
 const detached=floraParts(l,s);assert.equal(detached.find(p=>p.id===child.id).hidden,false);assert.equal(detached.find(p=>p.id===petal.id).hidden,false);
});
