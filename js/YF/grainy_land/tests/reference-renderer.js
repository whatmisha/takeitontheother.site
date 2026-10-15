// Test-only reference compiler. All geometry/color bytes still come from the
// current field implementation, whose exact values have independent Node fixtures.
import {LandscapeRenderer} from '../render.js?v=gpu-perf-1';
const response=await fetch(new URL('./fixtures/gpu-before.glsl',import.meta.url));
if(!response.ok)throw Error('Cannot load the GPU visual reference');
// Clean Background is an intentional visual change. Remove only its two grain
// terms from the frozen shader; retain every object/material calculation.
const reference=(await response.text()).split('\n').filter(line=>!line.includes('background*=')).join('\n');
export function createReferenceRenderer(){
 const prototype=WebGLRenderingContext.prototype,original=prototype.shaderSource;
 prototype.shaderSource=function(shader,source){return original.call(this,shader,source.includes('precision highp float;')?reference:source);};
 try{return new LandscapeRenderer();}finally{prototype.shaderSource=original;}
}
export function pixelDifference(a,b){
 let max=0,total=0,changed=0;
 for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);total+=d;if(d)changed++;}
 return {max,mean:total/a.length,changed};
}
