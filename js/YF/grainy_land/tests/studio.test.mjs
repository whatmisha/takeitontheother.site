import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {localToCanvas,canvasToLocal} from '../transforms.js';
import {defaults,normalizeSettings,makeDocument,readDocument,regenerate} from '../document.js';
import {withLayers,getLayers,addLayer,editLayer} from '../layers.js';
import {editSelection,duplicateSelection,reorderSelection,resizeSelection} from '../selection.js';
import {createLayerScene} from '../scene.js';
import {motionFrame} from '../motion.js';
import {encodePNG} from '../tiled-export.js';
import {makeTIFF} from '../print-color.js';
import {resizedForm} from '../form-editor.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('rotation and reflection keep canvas/local coordinates invertible and resize center fixed',()=>{
 for(const aspect of [.5,1,16/9])for(const rotation of [0,40,90,-170])for(const flipX of [true,false]){
  const l={x:.1,y:-.2,scaleX:1.3,scaleY:.7,rotation,flipX,flipY:!flipX},p=[.17,.8],world=localToCanvas(p,l,aspect),local=canvasToLocal(world,l,aspect);local.forEach((v,i)=>close(v,p[i]));
  const next={...l,...resizedForm(l,.8,1.2,world,aspect)};localToCanvas(p,next,aspect).forEach((v,i)=>close(v,world[i]));
 }
});
test('groups transform and duplicate independently, survive documents and keep locked layers',()=>{
 let s=withLayers(defaults,[]);s=addLayer(s,'vector').settings;s=addLayer(s,'drawn').settings;const ids=getLayers(s).map(l=>l.id);
 s=editLayer(s,ids[0],{x:-.1,collection:'Hills'});s=editLayer(s,ids[1],{x:.1,collection:'Hills'});
 const moved=editSelection(s,ids,{x:.1},ids[0]);close(getLayers(moved)[1].x,.3);
 const rotated=editSelection(s,ids,{rotation:90},ids[0]);close(getLayers(rotated)[0].x,0);assert.ok(getLayers(rotated)[0].y<0);
 const scaled=editSelection(s,ids,{scaleX:2},ids[0]);close(getLayers(scaled)[0].x,-.2);close(getLayers(scaled)[1].x,.2);
 const resized=resizeSelection(s,ids,2,.5,[.6,.7]);close(getLayers(resized)[0].x,-.3);close(getLayers(resized)[1].x,.1);close(getLayers(resized)[0].y,.1);
 const copy=duplicateSelection(s,ids);assert.equal(getLayers(copy.settings).length,4);assert.notEqual(getLayers(copy.settings).at(-1).collection,'Hills');assert.equal(copy.mapping[ids[0]],copy.ids[0]);assert.deepEqual(getLayers(copy.settings).slice(-2).map(l=>l.id),copy.ids);
 assert.deepEqual(readDocument(makeDocument(rotated)),rotated);assert.deepEqual(getLayers(regenerate(rotated,4)),getLayers(rotated));
 const locked=editLayer(s,ids[0],{locked:true});assert.deepEqual(getLayers(editSelection(locked,ids,{rotation:40}))[0],getLayers(locked)[0]);
 const reordered=reorderSelection(copy.settings,copy.ids,ids[0],'after');assert.deepEqual(getLayers(reordered).slice(0,2).map(l=>l.id),copy.ids);
});
test('local material inherits globals until overridden and does not leak between layers',()=>{
 const added=addLayer(defaults,'vector'),s=editLayer(added.settings,added.id,{material:{grain:0,glow:70,grainSize:2}}),scene=createLayerScene({...s,grain:90,glow:15});
 assert.equal(scene.at(-1).materialA[0],0);assert.equal(scene.at(-1).materialA[3],.7);assert.equal(scene[0].materialA[0],.9);assert.equal(scene[0].materialA[3],.15);
 assert.deepEqual(readDocument(makeDocument(s)),s);assert.deepEqual(normalizeSettings(s),s);
});
test('animation loop returns to its exact initial geometry and keeps locked layers still',()=>{
 let s=addLayer(defaults,'vector').settings;s=editLayer(s,getLayers(s).at(-1).id,{locked:true});const first=motionFrame(s,0),last=motionFrame(s,1),mid=motionFrame(s,.3);
 assert.deepEqual(last,first);assert.deepEqual(getLayers(mid).at(-1),getLayers(s).at(-1));assert.notDeepEqual(getLayers(mid)[0],getLayers(first)[0]);
});
test('streamed PNG preserves scanlines, dimensions, alpha and DPI across bands',async()=>{
 const width=5,height=3,rgba=Uint8Array.from({length:width*height*4},(_,i)=>i*13%256);
 async function* bands(){yield {rgba:rgba.slice(0,40),height:2};yield {rgba:rgba.slice(40),height:1};}
 const bytes=new Uint8Array(await (await encodePNG(width,height,bands(),{dpi:300})).arrayBuffer()),v=new DataView(bytes.buffer),idat=[];let phys;
 for(let i=8;i<bytes.length;){const n=v.getUint32(i),type=String.fromCharCode(...bytes.slice(i+4,i+8));if(type==='IDAT')idat.push(bytes.slice(i+8,i+8+n));if(type==='pHYs')phys=v.getUint32(i+8);i+=12+n;}
 assert.equal(v.getUint32(16),width);assert.equal(v.getUint32(20),height);assert.equal(phys,11811);
 const raw=inflateSync(Buffer.concat(idat.map(x=>Buffer.from(x)))),decoded=new Uint8Array(rgba.length),stride=width*4;
 for(let y=0;y<height;y++){assert.equal(raw[y*(stride+1)],1);for(let x=0;x<stride;x++)decoded[y*stride+x]=(raw[y*(stride+1)+x+1]+(x>=4?decoded[y*stride+x-4]:0))&255;}
 assert.deepEqual(decoded,rgba);
});
test('TIFF stores CMYK strips, DPI and the exact ICC payload',async()=>{
 const icc=new Uint8Array(128).fill(42),strips=[new Uint8Array([1,2,3]),new Uint8Array([4,5])];
 const b=new Uint8Array(await makeTIFF(2,65,strips,{channels:4,dpi:300,icc,rowsPerStrip:64}).arrayBuffer()),v=new DataView(b.buffer),tags=new Map();
 for(let i=0;i<v.getUint16(8,true);i++){const at=10+i*12;tags.set(v.getUint16(at,true),{count:v.getUint32(at+4,true),value:v.getUint32(at+8,true)});}
 assert.equal(tags.get(262).value,5);assert.equal(tags.get(277).value,4);assert.equal(v.getUint32(tags.get(282).value,true),300);
 const at=tags.get(34675).value;assert.deepEqual(b.slice(at,at+128),icc);
 const offsets=tags.get(273).value;strips.forEach((strip,i)=>{const pos=v.getUint32(offsets+i*4,true);assert.deepEqual(b.slice(pos,pos+strip.length),strip);});
});

test('animation preserves distances between members of a group',()=>{
 let s=withLayers(defaults,[]);s=addLayer(s,'vector').settings;s=addLayer(s,'vector').settings;const ids=getLayers(s).map(l=>l.id);
 s=editLayer(s,ids[0],{x:-.12,y:.05,collection:'Hills'});s=editLayer(s,ids[1],{x:.2,y:-.1,collection:'Hills'});
 const distance=state=>{const [a,b]=getLayers(state);return Math.hypot((a.x-b.x)*state.width/state.height,a.y-b.y);};
 close(distance(motionFrame(s,.21)),distance(s));assert.deepEqual(motionFrame(s,0),motionFrame(s,1));
});
