import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultVectorPath,normalizeVectorPath,moveVectorNode,toggleVectorNode,splitVectorSegment,removeVectorNode,vectorSegment,cubicPoint,flattenVectorPath,vectorDistance,MAX_VECTOR_NODES} from '../vector-path.js';
import {defaults,regenerate,makeDocument,readDocument} from '../document.js';
import {addLayer,getLayers,editLayer,duplicateLayer,convertLayer} from '../layers.js';
import {bakePaint} from '../paint.js';
import {createLayerScene} from '../scene.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00003,`${a} ≈ ${b}`);
test('vector paths normalize invalid coordinates and bound node count',()=>{
 assert.equal(normalizeVectorPath([]),null);assert.equal(normalizeVectorPath([{},null]),null);
 const p=normalizeVectorPath(Array.from({length:100},()=>({x:99,y:-99,in:[NaN,0]})));
 assert.equal(p.length,MAX_VECTOR_NODES);assert.deepEqual(p[0],{x:3,y:-2,in:[3,-2],out:[3,-2],smooth:false});
});
test('anchor motion carries handles; smooth handles pair, Alt preserves the opposite handle',()=>{
 const p=defaultVectorPath(),m=moveVectorNode(p,0,[.6,.3]);
 near(m[0].in[0]-p[0].in[0],.1);near(m[0].out[1]-p[0].out[1],.05);assert.equal(p[0].x,.5);
 const paired=moveVectorNode(p,0,[.6,.4],'out')[0],independent=moveVectorNode(p,0,[.6,.4],'out',true)[0];
 near((paired.in[0]-.5)*.15-(paired.in[1]-.25)*.1,0);
 near(Math.hypot(paired.in[0]-.5,paired.in[1]-.25),.1380712);
 near(independent.in[0],p[0].in[0]);assert.equal(independent.smooth,false);
 const corner=toggleVectorNode(p,0);assert.deepEqual(corner[0].in,[.5,.25]);assert.equal(corner[0].smooth,false);
 assert.equal(toggleVectorNode(corner,0)[0].smooth,true);
});
test('adding a point splits the cubic without changing its contour; three nodes is the minimum',()=>{
 const p=defaultVectorPath(),split=splitVectorSegment(p,3,.37),curve=vectorSegment(p,3);
 assert.equal(split.length,5);
 for(let i=0;i<=20;i++){const t=i/20,expected=cubicPoint(curve,t),actual=t<=.37?cubicPoint(vectorSegment(split,3),t/.37):cubicPoint(vectorSegment(split,4),(t-.37)/.63);actual.forEach((v,j)=>near(v,expected[j]));}
 const three=removeVectorNode(p,0);assert.equal(three.length,3);assert.equal(removeVectorNode(three,0),three);
});
test('vector layers survive generation, transforms, duplication, JSON and conversion to drawn',()=>{
 const added=addLayer(defaults,'vector'),id=added.id,p=moveVectorNode(getLayers(added.settings).at(-1).vectorPath,0,[.42,.14]);
 const s=editLayer(added.settings,id,{vectorPath:p,x:.1,scaleX:.7},{manual:true});
 const l=getLayers(s).at(-1);assert.equal(l.mode,'vector');assert.equal(l.hasBase,false);
 assert.deepEqual(getLayers(regenerate({...s,scale:200,flow:0,folds:0},123)).at(-1),l);
 assert.deepEqual(createLayerScene(s).at(-1),createLayerScene(regenerate({...s,scale:200,flow:0,folds:0},123)).at(-1));
 assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))),s);
 const copied=duplicateLayer(s,id);assert.equal(getLayers(copied.settings).at(-1).mode,'vector');assert.deepEqual(getLayers(copied.settings).at(-1).vectorPath,p);
 const drawn=getLayers(convertLayer(s,id)).at(-1);assert.equal(drawn.mode,'drawn');assert.equal(drawn.hasBase,false);assert.deepEqual(drawn.vectorPath,p);
 const locked=editLayer(s,id,{locked:true});assert.deepEqual(editLayer(locked,id,{vectorPath:defaultVectorPath()}),locked);
});
test('signed vector distance renders a filled shape and combines with ordered paint and erase',()=>{
 const path=defaultVectorPath(),polygon=flattenVectorPath(path);
 assert.ok(Math.abs(vectorDistance(.5,.5,polygon)-.25)<.0005);assert.ok(vectorDistance(.1,.1,polygon)<0);
 const sample=(f,x,y)=>f.lower[Math.round((y-f.bounds[1])/f.bounds[3]*(f.height-1))*f.width+Math.round((x-f.bounds[0])/f.bounds[2]*(f.width-1))];
 const erase={kind:'erase',rx:.08,ry:.08,points:[[.5,.5]]},paint={...erase,kind:'paint'};
 assert.ok(sample(bakePaint([],path),.5,.5)>.24);
 assert.ok(sample(bakePaint([erase],path),.5,.5)<-.07);
 assert.ok(sample(bakePaint([erase,paint],path),.5,.5)>.07);
 const moved=path.map(n=>({...n,x:n.x+.5,in:[n.in[0]+.5,n.in[1]],out:[n.out[0]+.5,n.out[1]]}));
 assert.ok(sample(bakePaint([],moved),.5,.5)<0,'edited contours invalidate the cached distance field');
});
