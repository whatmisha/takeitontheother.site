import {FLOWER_MOTION} from './flower-motion.js?v=petal-motion-1';
import {MAX_LAYERS} from './layer-limits.js?v=petal-motion-1';
import {effectiveSettings} from './object-model.js?v=petal-motion-1';
import { floraParts } from './flora.js?v=petal-motion-1';
import { flattenVectorPath } from './vector-path.js?v=petal-motion-1';
import { groupColor } from './custom-colors.js?v=petal-motion-1';
const cache=new Map(),motionCache=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Linear-time separable squared Euclidean distance transform.
function edt(out,w,h){const n=Math.max(w,h),f=new Float64Array(n),d=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
 function line(len){let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;for(let q=1;q<len;q++){let s;do{s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);if(s<=z[k])k--;else break;}while(k>=0);k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}k=0;for(let q=0;q<len;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])**2+f[v[k]];}}
 for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=out[y*w+x];line(h);for(let y=0;y<h;y++)out[y*w+x]=d[y];}
 for(let y=0;y<h;y++){for(let x=0;x<w;x++)f[x]=out[y*w+x];line(w);for(let x=0;x<w;x++)out[y*w+x]=d[x];}return out;
}
export function signedField(mask,w,h,step){const a=new Float32Array(mask.length),b=new Float32Array(mask.length);for(let i=0;i<a.length;i++){a[i]=mask[i]?1e9:0;b[i]=mask[i]?0:1e9;}const inside=edt(a,w,h),outside=edt(b,w,h);const distance=new Float32Array(mask.length);for(let i=0;i<distance.length;i++)distance[i]=(Math.sqrt(inside[i])-Math.sqrt(outside[i]))*step;return distance;}
function blur(data,w,h,r){
 if(r<1)return data;
 const a=new Float32Array(data.length),b=new Float32Array(data.length),den=2*r+1;
 for(let y=0;y<h;y++){
  const row=y*w;let sum=0;
  for(let k=-r;k<=r;k++)sum+=data[row+clamp(k,0,w-1)];
  for(let x=0;x<w;x++){
   a[row+x]=sum/den;
   sum+=data[row+Math.min(x+r+1,w-1)]-data[row+Math.max(x-r,0)];
  }
 }
 // Visit adjacent pixels, not entire strided columns. Float64 sums and the
 // per-column addition order preserve the old Float32 output bit for bit.
 const sums=new Float64Array(w);
 for(let k=-r;k<=r;k++){const row=clamp(k,0,h-1)*w;for(let x=0;x<w;x++)sums[x]+=a[row+x];}
 for(let y=0;y<h;y++){
  const row=y*w,add=Math.min(y+r+1,h-1)*w,remove=Math.max(y-r,0)*w;
  for(let x=0;x<w;x++){b[row+x]=sums[x]/den;sums[x]+=a[add+x]-a[remove+x];}
 }
 return b;
}
// Geometry owns the contour and the topmost part at each sample. Palette
// changes reuse those buffers and only rebuild RGB. Keep one palette per shape.
let cacheBytes=96*1024*1024;
export function setFloraCacheBudget(bytes){cacheBytes=Math.max(1024*1024,bytes);}
function remember(map,key,field,limit){
 map.delete(key);map.set(key,field);
 let bytes=0;for(const f of map.values())bytes+=f.pixels.byteLength+f.colors.byteLength+f.owners.byteLength;
 while(map.size>limit||bytes>cacheBytes&&map.size>1){const first=map.keys().next().value,f=map.get(first);bytes-=f.pixels.byteLength+f.colors.byteLength+f.owners.byteLength;map.delete(first);}
 return field;
}
function paintColors(field,palette,coverage){
 const {owners,width:w,height:h,shadingRadius}=field,len=owners.length;
 const rgb=Array.from({length:3},()=>new Float32Array(len));
 const mask=coverage?null:new Float32Array(len);
 for(let i=0;i<len;i++)if(owners[i]){const color=palette[owners[i]-1];for(let k=0;k<3;k++)rgb[k][i]=color[k];if(mask)mask[i]=1;}
 coverage ||= blur(mask,w,h,shadingRadius);
 const blurred=rgb.map(c=>blur(c,w,h,shadingRadius)),colors=new Uint8Array(len*4);
 for(let i=0;i<len;i++){
  const at=i*4,weight=Math.max(coverage[i],.00001);
  for(let k=0;k<3;k++)colors[at+k]=Math.round(clamp(blurred[k][i]/weight,0,1)*255);
  colors[at+3]=Math.round(clamp(coverage[i]*8,0,1)*255);
 }
 return colors;
}
export function bakeFlora(layer,settings){
 const mergeKey=layer.flora.generator==='flower'?'fMerge':'floraMerge';
 const merge=layer.flora.frozen?.[mergeKey]??effectiveSettings(settings,layer)[mergeKey];
 const parts=floraParts(layer,settings).filter(p=>!p.hidden),aspect=settings.width/settings.height;
 const geometryKey=JSON.stringify([parts.map(p=>[p.path,p.kind,p.shade]),merge,aspect]);
 const colorNames=parts.map(p=>groupColor(settings,p.group??layer.group)),colorKey=JSON.stringify(colorNames);
 const key=JSON.stringify([geometryKey,colorKey]),moving=!!layer[FLOWER_MOTION],map=moving?motionCache:cache,slot=moving?layer.id:geometryKey,limit=moving?MAX_LAYERS:MAX_LAYERS+4;
 let field=map.get(slot);
 if(field?.geometryKey===geometryKey&&field.colorKey===colorKey){map.delete(slot);map.set(slot,field);return field;}
 const palette=colorNames.map(hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255));
 if(field?.geometryKey===geometryKey)return remember(map,slot,{...field,key,colorKey,colors:paintColors(field,palette)},limit);
 const polys=parts.map(p=>flattenVectorPath(p.path));
 // Preserve the established sampling grid and edge appearance in this pass.
 let left=0,top=0,right=1,bottom=1;for(const poly of polys)for(const [x,y]of poly){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 left-=.24/aspect;right+=.24/aspect;top-=.24;bottom+=.24;
 const step=Math.max((bottom-top)/440,(right-left)*aspect/760),w=Math.ceil((right-left)*aspect/step)+1,h=Math.ceil((bottom-top)/step)+1;
 const bounds=[left,top,(w-1)*step/aspect,(h-1)*step],len=w*h,mask=new Float32Array(len),owners=new Uint16Array(len);
 polys.forEach((poly,index)=>{
  const ys=poly.map(p=>(p[1]-top)/step),y0=clamp(Math.floor(Math.min(...ys)),0,h-1),y1=clamp(Math.ceil(Math.max(...ys)),0,h-1);
  for(let y=y0;y<=y1;y++){
   const py=top+y*step,cross=[];
   for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a[1]>py)!==(b[1]>py))cross.push((a[0]+(py-a[1])*(b[0]-a[0])/(b[1]-a[1])-left)*aspect/step);}
   cross.sort((a,b)=>a-b);
   for(let c=0;c+1<cross.length;c+=2)for(let x=clamp(Math.ceil(cross[c]),0,w-1);x<=Math.min(w-1,Math.floor(cross[c+1]));x++){
    const at=y*w+x;mask[at]=1;owners[at]=index+1;
   }
  }
 });
 const radius=Math.round(merge/100*.026/step),merged=radius?blur(blur(mask,w,h,radius),w,h,radius):mask;
 const binary=new Uint8Array(len),threshold=radius?.30:.5;for(let i=0;i<len;i++)binary[i]=merged[i]>threshold?1:0;
 const distance=signedField(binary,w,h,step),shadingRadius=Math.max(2,Math.round(.048/step));
 // Keep native RGBA uploads: WebGL 1 luminance/alpha textures require costly
 // conversion on some GPUs. Only RG is used; the obsolete shade pass is gone.
 const coverage=blur(mask,w,h,shadingRadius),pixels=new Uint8Array(len*4);
 for(let i=0;i<len;i++){
  const at=i*4,d=Math.round((clamp(distance[i],-1,1)*.5+.5)*65535);
  pixels[at]=d>>8;pixels[at+1]=d&255;pixels[at+3]=255;
 }
 field={key,geometryKey,colorKey,width:w,height:h,bounds,pixels,owners,shadingRadius};
 field.colors=paintColors(field,palette,coverage);
 return remember(map,slot,field,limit);
}
