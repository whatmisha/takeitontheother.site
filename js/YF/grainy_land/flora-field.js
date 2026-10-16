import {FLOWER_MOTION} from './flower-motion.js?v=petal-motion-1';
import {MAX_LAYERS} from './layer-limits.js?v=petal-motion-1';
import {effectiveSettings} from './object-model.js?v=unified-document-1';
import { floraParts } from './flora.js?v=petal-motion-1';
import { flattenVectorPath } from './vector-path.js?v=petal-motion-1';
import { groupColor } from './custom-colors.js?v=unified-document-1';
const cache=new Map(),motionCache=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Exact squared Euclidean distances for a binary mask. In the vertical pass
// one distance is always zero; store only the distance to the opposite value.
// Two row-major scans find it without building a parabola envelope per column.
export function signedField(mask,w,h,step){
 const len=mask.length,vertical=new Float32Array(len),distance=new Float32Array(len);
 const nearest=new Int32Array(w),far=1e9;
 nearest.fill(-1);
 for(let y=0;y<h;y++){
  const row=y*w;
  for(let x=0;x<w;x++){
   const i=row+x;
   if(y&&!!mask[i]!==!!mask[i-w])nearest[x]=y-1;
   const delta=y-nearest[x];
   vertical[i]=nearest[x]<0?far:Math.min(far,delta*delta);
  }
 }
 nearest.fill(-1);
 for(let y=h-1;y>=0;y--){
  const row=y*w;
  for(let x=0;x<w;x++){
   const i=row+x;
   if(y<h-1&&!!mask[i]!==!!mask[i+w])nearest[x]=y+1;
   if(nearest[x]>=0){const delta=nearest[x]-y;vertical[i]=Math.min(vertical[i],delta*delta);}
  }
 }
 // Horizontal lower envelopes still provide Euclidean (not chamfer) distance.
 // Reuse row scratch buffers and write only the nonzero side of the signed field.
 const f=new Float64Array(w),v=new Int32Array(w),z=new Float64Array(w+1);
 for(let y=0;y<h;y++){
  const row=y*w;
  for(let inside=0;inside<2;inside++){
   let needed=false;
   for(let x=0;x<w;x++){
    const same=!!mask[row+x]===!!inside;
    f[x]=same?vertical[row+x]:0;needed ||= same;
   }
   if(!needed)continue;
   let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
   for(let q=1;q<w;q++){
    let split;
    do{const p=v[k];split=((f[q]+q*q)-(f[p]+p*p))/(2*q-2*p);if(split<=z[k])k--;else break;}while(k>=0);
    k++;v[k]=q;z[k]=split;z[k+1]=Infinity;
   }
   k=0;
   for(let x=0;x<w;x++){
    while(z[k+1]<x)k++;
    if(!!mask[row+x]===!!inside){
     const delta=x-v[k];
     // The original two-pass transform stores squared distances in Float32.
     distance[row+x]=(inside?1:-1)*Math.sqrt(Math.fround(delta*delta+f[v[k]]))*step;
    }
   }
  }
 }
 return distance;
}
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
function paintColors(field,palette){
 const {owners,width:w,height:h,shadingRadius:r,colorBounds}=field;
 const colors=new Uint8Array(owners.length*4);
 if(!colorBounds)return colors;
 // The box filter has finite support. Keep the original sample coordinates and
 // include its full radius; clamping then agrees with the full-canvas filter.
 const x0=Math.max(0,colorBounds[0]-r),y0=Math.max(0,colorBounds[1]-r);
 const x1=Math.min(w-1,colorBounds[2]+r),y1=Math.min(h-1,colorBounds[3]+r);
 const cw=x1-x0+1,ch=y1-y0+1,len=cw*ch;
 const rgb=Array.from({length:3},()=>new Float32Array(len)),mask=new Float32Array(len);
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
  const owner=owners[(y+y0)*w+x+x0];
  if(owner){const i=y*cw+x,color=palette[owner-1];for(let k=0;k<3;k++)rgb[k][i]=color[k];mask[i]=1;}
 }
 const coverage=blur(mask,cw,ch,r),blurred=rgb.map(c=>blur(c,cw,ch,r));
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
  const i=y*cw+x,at=((y+y0)*w+x+x0)*4,weight=Math.max(coverage[i],.00001);
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
 let colorBounds=null;
 polys.forEach((poly,index)=>{
  const ys=poly.map(p=>(p[1]-top)/step),y0=clamp(Math.floor(Math.min(...ys)),0,h-1),y1=clamp(Math.ceil(Math.max(...ys)),0,h-1);
  for(let y=y0;y<=y1;y++){
   const py=top+y*step,cross=[];
   for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a[1]>py)!==(b[1]>py))cross.push((a[0]+(py-a[1])*(b[0]-a[0])/(b[1]-a[1])-left)*aspect/step);}
   cross.sort((a,b)=>a-b);
   for(let c=0;c+1<cross.length;c+=2){
    const x0=clamp(Math.ceil(cross[c]),0,w-1),x1=Math.min(w-1,Math.floor(cross[c+1]));
    if(x1<x0)continue;
    const start=y*w+x0,end=y*w+x1+1;
    mask.fill(1,start,end);owners.fill(index+1,start,end);
    if(colorBounds){colorBounds[0]=Math.min(colorBounds[0],x0);colorBounds[1]=Math.min(colorBounds[1],y);colorBounds[2]=Math.max(colorBounds[2],x1);colorBounds[3]=Math.max(colorBounds[3],y);}
    else colorBounds=[x0,y,x1,y];
   }
  }
 });
 const radius=Math.round(merge/100*.026/step),merged=radius?blur(blur(mask,w,h,radius),w,h,radius):mask;
 const binary=new Uint8Array(len),threshold=radius?.30:.5;for(let i=0;i<len;i++)binary[i]=merged[i]>threshold?1:0;
 const distance=signedField(binary,w,h,step),shadingRadius=Math.max(2,Math.round(.048/step));
 // Keep native RGBA uploads: WebGL 1 luminance/alpha textures require costly
 // conversion on some GPUs. Only RG is used; the obsolete shade pass is gone.
 const pixels=new Uint8Array(len*4);
 for(let i=0;i<len;i++){
  const at=i*4,d=Math.round((clamp(distance[i],-1,1)*.5+.5)*65535);
  pixels[at]=d>>8;pixels[at+1]=d&255;pixels[at+3]=255;
 }
 field={key,geometryKey,colorKey,width:w,height:h,bounds,pixels,owners,shadingRadius,colorBounds};
 field.colors=paintColors(field,palette);
 return remember(map,slot,field,limit);
}
