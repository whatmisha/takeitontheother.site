import test from 'node:test';
import assert from 'node:assert/strict';
import {signedField,bakeFlora} from '../flora-field.js';
import {bakeFlora as before} from './fixtures/field-before-cpu.js';
import {defaults,switchMode} from '../legacy-document.js';
import {getLayers} from '../layers.js';
import {floraParts,editFloraPart} from '../flora.js';
import {motionFrame} from '../motion.js';

function brute(mask,w,h,step){
 const out=new Float32Array(mask.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;let best=1e9;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(!!mask[i]!==!!mask[yy*w+xx])best=Math.min(best,(x-xx)**2+(y-yy)**2);
  out[i]=(mask[i]?1:-1)*Math.sqrt(best)*step;
 }
 return out;
}
test('Binary EDT agrees with exhaustive Euclidean distances, including holes, borders and uniform masks',()=>{
 for(const [w,h]of [[1,1],[1,9],[9,1],[3,3],[2,6]])for(let bits=0;bits<2**(w*h);bits++){
  const mask=Uint8Array.from({length:w*h},(_,i)=>(bits>>>i)&1),copy=mask.slice();
  assert.deepEqual(signedField(mask,w,h,.013),brute(mask,w,h,.013));assert.deepEqual(mask,copy);
 }
});
test('Binary EDT retains exact distance on non-square random masks',()=>{
 let state=89213;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
 for(const [w,h]of [[31,17],[12,43],[46,8]])for(const density of [.02,.2,.5,.97]){
  const mask=Uint8Array.from({length:w*h},()=>random()<density?1:0);
  assert.deepEqual(signedField(mask,w,h,.004),brute(mask,w,h,.004));
 }
});
function compare(layer,s){
 const old=before(layer,s),now=bakeFlora(layer,s);
 for(const key of ['width','height','bounds','pixels','colors','owners'])assert.deepEqual(now[key],old[key],key);
 return now;
}
test('Animated fields and cropped color washes are byte-identical across types, aspect ratios and fusion extremes',()=>{
 for(const type of ['radial','cup','fan','lobed','plant'])for(const aspect of [.56,1,1.78])for(const merge of [0,100]){
  const s=motionFrame({...switchMode(defaults,type==='plant'?'flora':'f'),fType:type,width:1080*aspect,height:1080,fMerge:merge,floraMerge:merge,motionAmount:20,fPetalColors:100,fColorVariation:100},.37);
  const layer=getLayers(s).find(l=>l.flora);compare(layer,s);
  const recolored={...s,sky:'#000000',depth:'#FFFFFF',terrain:'#010102',light:'#007FFF'};
  const a=compare(layer,recolored),b=compare(layer,s);assert.equal(a.pixels,b.pixels,'Recoloring retains the geometry buffer');
 }
});
test('Color support handles hidden parts, empty fields and large manually edited petals',()=>{
 const s=switchMode(defaults,'f');let layer=getLayers(s)[0];
 for(const part of floraParts(layer,s))layer=editFloraPart(layer,s,part.id,{hidden:true});
 const empty=compare(layer,s);assert.ok(empty.colors.every(v=>v===0));
 layer=getLayers(s)[0];
 const petal=floraParts(layer,s).find(p=>p.kind==='petal');
 const at=([x,y])=>[x*2.8-.7,y*2.8+.2];
 const path=petal.local.map(n=>{const [x,y]=at([n.x,n.y]);return {...n,x,y,in:at(n.in),out:at(n.out)};});
 layer=editFloraPart(layer,s,petal.id,{path,detached:true,group:'sky'});
 compare(layer,s);compare(layer,{...s,sky:'#FFFFFF',fMerge:100});
});
