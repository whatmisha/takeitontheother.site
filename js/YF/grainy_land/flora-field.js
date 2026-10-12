import { floraParts } from './flora.js?v=flora-growth-1';
import { flattenVectorPath } from './vector-path.js?v=flora-growth-1';
import { groupColor } from './custom-colors.js?v=flora-growth-1';
const cache=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Linear-time separable squared Euclidean distance transform.
function edt(input,w,h){const out=new Float32Array(input),n=Math.max(w,h),f=new Float64Array(n),d=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
 function line(len){let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;for(let q=1;q<len;q++){let s;do{s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);if(s<=z[k])k--;else break;}while(k>=0);k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}k=0;for(let q=0;q<len;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])**2+f[v[k]];}}
 for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=out[y*w+x];line(h);for(let y=0;y<h;y++)out[y*w+x]=d[y];}
 for(let y=0;y<h;y++){for(let x=0;x<w;x++)f[x]=out[y*w+x];line(w);for(let x=0;x<w;x++)out[y*w+x]=d[x];}return out;
}
export function signedField(mask,w,h,step){const a=new Float32Array(mask.length),b=new Float32Array(mask.length);for(let i=0;i<a.length;i++){a[i]=mask[i]?1e9:0;b[i]=mask[i]?0:1e9;}const inside=edt(a,w,h),outside=edt(b,w,h);return Float32Array.from(inside,(d,i)=>(Math.sqrt(d)-Math.sqrt(outside[i]))*step);}
function blur(data,w,h,r){if(r<1)return data;const a=new Float32Array(data.length),b=new Float32Array(data.length),den=2*r+1;for(let y=0;y<h;y++){let sum=0;for(let k=-r;k<=r;k++)sum+=data[y*w+clamp(k,0,w-1)];for(let x=0;x<w;x++){a[y*w+x]=sum/den;sum+=data[y*w+clamp(x+r+1,0,w-1)]-data[y*w+clamp(x-r,0,w-1)];}}for(let x=0;x<w;x++){let sum=0;for(let k=-r;k<=r;k++)sum+=a[clamp(k,0,h-1)*w+x];for(let y=0;y<h;y++){b[y*w+x]=sum/den;sum+=a[clamp(y+r+1,0,h-1)*w+x]-a[clamp(y-r,0,h-1)*w+x];}}return b;}
export function bakeFlora(layer,settings){
 const parts=floraParts(layer,settings).filter(p=>!p.hidden),key=JSON.stringify([parts,layer.group,settings.floraMerge,settings.sky,settings.terrain,settings.depth,settings.light,settings.customColors,settings.width/settings.height]);
 if(cache.has(key))return cache.get(key);
 const aspect=settings.width/settings.height,polys=parts.map(p=>flattenVectorPath(p.path));
 let left=0,top=0,right=1,bottom=1;for(const poly of polys)for(const [x,y]of poly){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 left-=.24/aspect;right+=.24/aspect;top-=.24;bottom+=.24;
 const step=Math.max((bottom-top)/440,(right-left)*aspect/760),w=Math.ceil((right-left)*aspect/step)+1,h=Math.ceil((bottom-top)/step)+1;
 const bounds=[left,top,(w-1)*step/aspect,(h-1)*step],len=w*h,mask=new Float32Array(len),tone=new Float32Array(len),rgb=Array.from({length:3},()=>new Float32Array(len));
 // Scanline fill retains separate editable contours while combining their coverage.
 polys.forEach((poly,index)=>{const part=parts[index],color=groupColor(settings,part.group??layer.group).slice(1).match(/../g).map(x=>parseInt(x,16)/255);
  const ys=poly.map(p=>(p[1]-top)/step),y0=clamp(Math.floor(Math.min(...ys)),0,h-1),y1=clamp(Math.ceil(Math.max(...ys)),0,h-1);
  for(let y=y0;y<=y1;y++){const py=top+y*step,cross=[];for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a[1]>py)!==(b[1]>py))cross.push((a[0]+(py-a[1])*(b[0]-a[0])/(b[1]-a[1])-left)*aspect/step);}
   cross.sort((a,b)=>a-b);for(let c=0;c+1<cross.length;c+=2)for(let x=clamp(Math.ceil(cross[c]),0,w-1);x<=Math.min(w-1,Math.floor(cross[c+1]));x++){const at=y*w+x;mask[at]=1;tone[at]=part.kind==='petal'?Math.min(1,part.shade*.65+.52*((x-cross[c])/Math.max(1,cross[c+1]-cross[c]))**2):part.shade;for(let k=0;k<3;k++)rgb[k][at]=color[k];}
  }
 });
 const fusion=(layer.flora.frozen?.floraMerge??settings.floraMerge)/100,radius=Math.round(fusion*.026/step);
 const merged=radius?blur(blur(mask,w,h,radius),w,h,radius):mask;
 const binary=Uint8Array.from(merged,x=>x>(radius?.30:.5)?1:0),distance=signedField(binary,w,h,step);
 const shadingRadius=Math.max(2,Math.round(.048/step)),coverage=blur(mask,w,h,shadingRadius),shade=blur(tone,w,h,shadingRadius),color=rgb.map(c=>blur(c,w,h,shadingRadius));
 const pixels=new Uint8Array(len*4),colors=new Uint8Array(len*4);
 for(let i=0;i<len;i++){const d=Math.round((clamp(distance[i],-1,1)*.5+.5)*65535),weight=Math.max(coverage[i],.00001);pixels.set([d>>8,d&255,Math.round(clamp(shade[i]/weight,0,1)*255),255],i*4);for(let k=0;k<3;k++)colors[i*4+k]=Math.round(clamp(color[k][i]/weight,0,1)*255);colors[i*4+3]=Math.round(clamp(coverage[i]*8,0,1)*255);}
 const result={key,width:w,height:h,bounds,pixels,colors};cache.set(key,result);while(cache.size>20)cache.delete(cache.keys().next().value);return result;
}
