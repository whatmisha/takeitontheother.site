import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,switchMode,normalizeSettings,makeDocument} from '../document.js';
import {getLayers,withLayers,editLayer,convertLayer} from '../layers.js';
import {floraParts,editFloraPart} from '../flora.js';
import {moveVectorNode,splitVectorSegment} from '../vector-path.js';
import {localToCanvas} from '../transforms.js';
import {createLayerScene} from '../scene.js';
import {bakeFlora} from '../flora-field.js';
import {motionFrame} from '../motion.js';
import {FLOWER_MOTION,bendPetal} from '../flower-motion.js';
const start=()=>switchMode(defaults,'f');
const pose=(s,phase)=>{const frame=normalizeSettings(motionFrame(s,phase)),layer=createLayerScene(frame)[0];return {frame,layer,parts:floraParts(layer,frame)};};
const attach=({frame,layer,parts})=>{
 for(const p of parts.filter(p=>p.parent&&!p.detached)){
  const parent=parts.find(q=>q.id===p.parent),socket=parent.path[p.parentNode];
  assert.deepEqual([p.path[0].x,p.path[0].y],[socket.x,socket.y],p.id+' stays attached in local space');
  assert.deepEqual(localToCanvas([p.path[0].x,p.path[0].y],layer,frame.width/frame.height),localToCanvas([socket.x,socket.y],layer,frame.width/frame.height),p.id+' stays attached after layer transform');
 }
};
test('Every flower type animates petals independently while preserving attachment and Bezier collars',()=>{
 for(const fType of ['radial','cup','fan','lobed'])for(const aspect of [.56,1,1.78])for(const fTilt of [0,85]){
  let s={...start(),fType,fTilt,width:1080*aspect,height:1080,motionAmount:20};
  const l=getLayers(s)[0];s=editLayer(s,l.id,{rotation:47,flipX:true,scaleX:1.3,scaleY:.8});
  const base=pose(s,0),before=JSON.stringify(s),ratios=[];
  for(const phase of [.125,.35,.75]){
   const mid=pose(s,phase);attach(mid);assert.deepEqual(mid.parts[0],base.parts[0],'Stem geometry is unchanged');
   for(const p of mid.parts.filter(p=>p.kind==='petal')){
    const rest=base.parts.find(q=>q.id===p.id);
    assert.deepEqual(p.path[0],rest.path[0],'Attachment anchor and handles stay fixed');
    assert.notDeepEqual(p.local,rest.local,'The free part moves');
    assert.ok(p.path.every(n=>[n.x,n.y,...n.in,...n.out].every(Number.isFinite)));
    const a=rest.local[3],b=p.local[3];ratios.push(Math.atan2(b.y,b.x*aspect)-Math.atan2(a.y,a.x*aspect));
   }
  }
  assert.ok(Math.max(...ratios)-Math.min(...ratios)>.04,'Petals do not move as a rigid crown');
  assert.equal(JSON.stringify(s),before,'Animation never edits source settings');
 }
});
test('Loop seam, zero Motion and locked flowers preserve exact source geometry',()=>{
 const s=start();assert.equal(motionFrame(s,0),s);assert.equal(motionFrame(s,1),s);assert.equal(motionFrame(s,-1),s);
 assert.equal(motionFrame({...s,motionAmount:0},.4).motionAmount,0);assert.deepEqual(pose({...s,motionAmount:0},.4).parts,pose(s,0).parts);
 const a=pose(s,.3),b=pose(s,1.3);assert.deepEqual(a.parts,b.parts);
 const near=pose(s,1-1e-7).parts,rest=pose(s,0).parts;
 for(let i=0;i<near.length;i++)for(let j=0;j<near[i].path.length;j++)assert.ok(Math.hypot(near[i].path[j].x-rest[i].path[j].x,near[i].path[j].y-rest[i].path[j].y)<1e-6);
 const locked=editLayer(s,getLayers(s)[0].id,{locked:true});assert.deepEqual(pose(locked,.4).parts,pose(locked,0).parts);
 assert.deepEqual(getLayers(motionFrame(locked,.4)),getLayers(locked));
 assert.equal(JSON.stringify(makeDocument(motionFrame(s,.4))).includes('flower-motion'),false);
 assert.ok(getLayers(normalizeSettings(motionFrame(s,.4)))[0][FLOWER_MOTION],'Runtime pose reaches renderer through normalization');
});
test('Edited/reindexed stem sockets, manual petals, hidden stem and frozen flowers retain their attachment',()=>{
 let s=start(),l=getLayers(s)[0],parts=floraParts(l,s),stem=parts[0];
 l=editFloraPart(l,s,'p0',{path:splitVectorSegment(stem.local,0,.5),reindex:{at:1,delta:1}});
 parts=floraParts(l,s);const p=parts.find(p=>p.id==='p1');
 l=editFloraPart(l,s,'p1',{path:moveVectorNode(p.local,3,[p.local[3].x+.03,p.local[3].y-.05]),group:'light'});
 s=withLayers(s,[l]);attach(pose(s,.4));
 assert.equal(pose(s,.4).parts.find(p=>p.id==='p1').group,'light');
 const frozen=convertLayer(s,l.id);attach(pose({...frozen,fType:'cup',fPetals:12},.35));
 attach(pose({...start(),fStem:0},.4));
 const detached=editFloraPart(l,s,'p1',{detached:true});
 const a=pose(withLayers(s,[detached]),0).parts.find(p=>p.id==='p1'),b=pose(withLayers(s,[detached]),.4).parts.find(p=>p.id==='p1');
 assert.deepEqual(a.origin,b.origin);assert.deepEqual(a.path[0],b.path[0]);
});
test('Petal bending keeps smooth Bezier tangents collinear and does not change the root tangent',()=>{
 const s=start(),path=floraParts(getLayers(s)[0],s).find(p=>p.id==='p1').local;
 const bent=bendPetal(path,s.width/s.height,.45,.08);assert.deepEqual(bent[0],path[0]);
 for(const n of bent.filter(n=>n.smooth)){
  const a=[n.x-n.in[0],n.y-n.in[1]],b=[n.out[0]-n.x,n.out[1]-n.y];
  assert.ok(Math.abs(a[0]*b[1]-a[1]*b[0])<1e-12,'Smooth tangent survives deformation');
 }
});
test('Plant, Land and Spot retain their existing geometry; Flower motion follows object type across modes',()=>{
 for(const mode of ['flora','landscape','abstract']){
  const s=switchMode(defaults,mode),frame=motionFrame(s,.4);
  assert.ok(getLayers(frame).every(l=>!l[FLOWER_MOTION]));
  if(mode==='flora')assert.deepEqual(floraParts(getLayers(frame)[0],frame),floraParts(getLayers(s)[0],s));
 }
 const s=start(),l=getLayers(s)[0],land=withLayers({...switchMode(defaults,'landscape'),objectDefaults:{flower:s}},[l]);
 assert.notDeepEqual(pose(land,.4).parts,pose(land,0).parts);attach(pose(land,.4));
});

test('Different flowers have independent phases, and moving poses do not evict the still field',()=>{
 const s=start(),l=getLayers(s)[0],other={...l,id:'another-flower'},a=withLayers(s,[l]),b=withLayers(s,[other]);
 assert.notDeepEqual(pose(a,.35).parts,pose(b,.35).parts);
 const still=bakeFlora(l,s);
 for(let i=1;i<=40;i++){const frame=motionFrame(s,i/41);bakeFlora(getLayers(frame)[0],frame);}
 assert.equal(bakeFlora(l,s),still,'Stopping instantly reuses the full-quality still field');
});
