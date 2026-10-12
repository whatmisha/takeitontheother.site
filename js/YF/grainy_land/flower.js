// F: a single corolla built from curved petal profiles in a tilted local plane.
// Geometry stays separate from palette, pigment and spray rendering.
import {flowerProfiles} from './flower-profiles.js?v=flower-f-5';
export const flowerTypes=Object.fromEntries(Object.entries(flowerProfiles).map(([id,p])=>[id,p.label]));
export const flowerDefaults={fType:'radial',fScale:110,fPetals:6,fOpening:75,fWidth:55,fCurl:35,fAsymmetry:40,fRecognition:60,fTilt:35,fRotation:0,fCenterX:50,fCenterY:53,fStem:65,fBend:35,fMerge:30,fLayers:null};
export const flowerRanges={fScale:[40,180,1],fPetals:[3,12,1],fOpening:[0,100,1],fWidth:[0,100,1],fCurl:[-100,100,1],fAsymmetry:[0,100,1],fRecognition:[0,100,1],fTilt:[0,85,1],fRotation:[-180,180,1],fCenterX:[5,95,1],fCenterY:[5,95,1],fStem:[0,100,1],fBend:[-100,100,1],fMerge:[0,100,1]};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function normalizeFlowerParams(s={}){
 const out={fType:Object.hasOwn(flowerTypes,s.fType)?s.fType:'radial'};
 for(const [key,[min,max,step]] of Object.entries(flowerRanges))out[key]=Math.round(clamp(s[key]!=null&&Number.isFinite(Number(s[key]))?Number(s[key]):flowerDefaults[key],min,max)/step)*step;
 return out;
}
function random(seed){let n=seed>>>0;return(a=0,b=1)=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return a+(b-a)*((t^t>>>14)>>>0)/4294967296;};}
export function flowerType(layer,settings){return Object.hasOwn(flowerTypes,settings.fType)?settings.fType:'radial';}
const node=(x,y,ix=x,iy=y,ox=x,oy=y)=>({x,y,in:[ix,iy],out:[ox,oy],smooth:false});
function outline(points){return points.map(([x,y],i)=>{const p=points[(i+points.length-1)%points.length],q=points[(i+1)%points.length],dx=(q[0]-p[0])*.15,dy=(q[1]-p[1])*.15;return {...node(x,y,x-dx,y-dy,x+dx,y+dy),smooth:i!==0};});}
// A ribbon sampled along a smooth centerline; side handles follow its tangent.
// The flower's attachment stays at node 2, including at Stem length 0.
function stemPath(tip,length,width,bend,asym,r){
 const sway=bend*length*r(.12,.32),counter=bend*length*r(-.11,.11)*asym;
 const center=t=>[tip[0]*t+sway*Math.sin(Math.PI*t)+counter*Math.sin(2*Math.PI*t),-length*t];
 const tangent=t=>[tip[0]+sway*Math.PI*Math.cos(Math.PI*t)+counter*2*Math.PI*Math.cos(2*Math.PI*t),-length];
 const side=(t,sign)=>{const c=center(t),d=tangent(t),n=Math.max(.00001,Math.hypot(...d)),w=width*(.55-.18*t);return [c[0]-d[1]/n*w*sign,c[1]+d[0]/n*w*sign];};
 const junction=(t,sign)=>{const p=side(t,sign),d=tangent(t),before=sign<0?t/3:-(1-t)/3,after=sign<0?(1-t)/3:-t/3;
  return {...node(...p,p[0]-d[0]*before,p[1]-d[1]*before,p[0]+d[0]*after,p[1]+d[1]*after),smooth:true};};
 const left=r(.40,.62),right=r(.38,.62),rootOut=side(left/3,-1),rootIn=side(right/3,1);
 return [node(0,0,width*.14,length*.015,...rootOut),junction(left,-1),
  node(...tip,tip[0]-width*.38,tip[1]+width*.48,tip[0]+width*.38,tip[1]+width*.48),
  junction(right,1),node(width*.40,length*.015,...rootIn,width*.2,length*.015)];
}
// The profile selects coefficients and a contour only. Every family uses the
// same arrangement, growth, deformation, projection and attachment pipeline.
export function buildFlowerParts(layer,raw){
 const s={...flowerDefaults,...raw};
 return buildFlowerFromProfile(layer,s,flowerProfiles[flowerType(layer,s)]);
}
export function buildFlowerFromProfile(layer,raw,profile){
 const s={...flowerDefaults,...raw},seed=(layer.seed+layer.flora.variant*1013904223)>>>0,r=random(seed^0x748FAC13);
 const aspect=s.width/s.height,unit=Math.min(1,aspect),size=s.fScale/100*unit,opening=s.fOpening/100,asym=s.fAsymmetry/100,abstract=1-s.fRecognition/100;
 const tilt=s.fTilt*Math.PI/180,rotation=s.fRotation*Math.PI/180,ct=Math.cos(tilt),st=Math.sin(tilt),cr=Math.cos(rotation),sr=Math.sin(rotation);
 const center=[s.fCenterX/100,s.fCenterY/100],length=s.fStem/100*.78*unit,bend=s.fBend/100,root=[center[0]-bend*.19*unit/aspect,center[1]+length];
 const tip=[(center[0]-root[0])*aspect,-length],width=(.023+.073*abstract)*size;
 const stem={id:'p0',name:'Stem',kind:'stem',path:stemPath(tip,length,width,bend,asym,random(seed^0x94FAB127)),parent:null,parentNode:0,origin:root,shade:.5,hidden:s.fStem===0};
 const {arrangement:a,length:l,width:w,neck:n,growth:g,bend:b,projection:z}=profile;
 const count=s.fPetals,phase=r(-a.phase,a.phase)*(a.phaseBase+a.phaseAsymmetry*asym),base=l.radius*size,petals=[];
 // Fixed random slots keep the seed stable when coefficients are adjusted.
 // Large-scale growth is shared; individual variation is local to each petal.
 const hero=r(-Math.PI,Math.PI),wave=r(-Math.PI,Math.PI),shear=r(-g.shear,g.shear)*abstract;
 const span=a.span+opening*a.openingSpan,spread=z.spread+z.openingSpread*opening,curl=s.fCurl/100;
 for(let j=0;j<count;j++){
  const pr=random((seed+j*2246822519+0xFA413)>>>0),noise=Array.from({length:6},()=>pr());
  const sample=(slot,min,max)=>min+(max-min)*noise[slot],t=j/Math.max(1,count-Number(a.includeEnd));
  const angle=(t-a.origin)*span+phase+sample(0,-a.jitter,a.jitter)*asym;
  const hierarchy=1+(g.asymmetry*asym+g.abstraction*abstract+g.bias)*Math.cos(angle-hero)+g.wave*asym*Math.cos(2*angle+wave);
  const len=base*clamp(hierarchy+sample(1,...l.noise)*asym,l.min??-Infinity,l.max??Infinity)*(l.edge+l.edgeWave*Math.sin(t*Math.PI));
  const halfWidth=len*(w.base+s.fWidth/100*w.control+abstract*w.abstraction)*w.multiplier*(1+sample(2,...w.noise)*asym);
  const sideCurl=sample(3,-b.lateralNoise,b.lateralNoise)*asym+curl*b.lateralCurl;
  const skew=sample(4,-b.skew,b.skew)*asym,tipSkew=sample(5,-b.tip,b.tip)*asym,contourNoise=sample(4,-b.contourNoise,b.contourNoise)*asym;
  const axis=[Math.sin(angle),-Math.cos(angle)],normal=[Math.cos(angle),Math.sin(angle)],neck=n.base+n.abstraction*abstract;
  function point(p){
   const u=p.u+(p.tipShift??0)*tipSkew,side=p.side,pw=(p.width==='neck'?neck:p.width)+(p.widthNoise??0)*contourNoise;
   const reach=len*(u*spread-curl*b.retreat*u*u*u),lateral=halfWidth*(side*pw*(1+side*skew)+sideCurl*u*u);
   let x=axis[0]*reach+normal[0]*lateral,y=axis[1]*reach+normal[1]*lateral;
   x+=shear*y+abstract*g.warp*Math.sin(hero)*y*y/base;
   y+=abstract*g.warp*Math.cos(hero)*x*x/base;
   const depth=len*((z.linear+z.openingLinear*opening)*u+(z.arch+z.closingArch*(1-opening))*Math.sin(u*Math.PI*.75)+curl*u*u*z.curl);
   const py=y*ct-depth*st;return [x*cr-py*sr,x*sr+py*cr];
  }
  const path=outline([[0,0],...profile.contour.map(point)]),depth=-Math.cos(angle)*st+z.depthOffset;
  petals.push({id:'p'+(j+1),name:'Petal '+(j+1),kind:'petal',path,parent:'p0',parentNode:2,origin:[0,0],shade:.5,depth});
 }
 // An optional profile envelope bounds broad crowns without changing Size or
 // Position. Null means the contour's own dimensions define its full reach.
 const reach=Math.max(...petals.flatMap(p=>p.path.flatMap(n=>[[n.x,n.y],n.in,n.out].map(q=>Math.hypot(...q)))));
 const fit=profile.maxRadius==null?1:Math.min(1,profile.maxRadius*size/reach);
 if(fit<1)for(const p of petals)p.path=p.path.map(n=>({...n,x:n.x*fit,y:n.y*fit,in:n.in.map(v=>v*fit),out:n.out.map(v=>v*fit)}));
 petals.sort((a,b)=>a.depth-b.depth);return [stem,...petals];
}
