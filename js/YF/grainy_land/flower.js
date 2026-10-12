// F: a single corolla built from curved petal profiles in a tilted local plane.
// Geometry stays separate from palette, pigment and spray rendering.
export const flowerTypes={random:'Random',fan:'Fan',cup:'Cup',lobed:'Lobed',radial:'Radial'};
export const flowerDefaults={fType:'random',fScale:110,fPetals:6,fOpening:75,fWidth:55,fCurl:35,fAsymmetry:40,fRecognition:60,fTilt:35,fRotation:0,fCenterX:50,fCenterY:53,fStem:65,fBend:35,fMerge:30,fLayers:null};
export const flowerRanges={fScale:[40,180,1],fPetals:[3,12,1],fOpening:[0,100,1],fWidth:[0,100,1],fCurl:[-100,100,1],fAsymmetry:[0,100,1],fRecognition:[0,100,1],fTilt:[0,85,1],fRotation:[-180,180,1],fCenterX:[5,95,1],fCenterY:[5,95,1],fStem:[0,100,1],fBend:[-100,100,1],fMerge:[0,100,1]};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function normalizeFlowerParams(s={}){
 const out={fType:Object.hasOwn(flowerTypes,s.fType)?s.fType:'random'};
 for(const [key,[min,max,step]] of Object.entries(flowerRanges))out[key]=Math.round(clamp(s[key]!=null&&Number.isFinite(Number(s[key]))?Number(s[key]):flowerDefaults[key],min,max)/step)*step;
 return out;
}
function random(seed){let n=seed>>>0;return(a=0,b=1)=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return a+(b-a)*((t^t>>>14)>>>0)/4294967296;};}
export function flowerType(layer,settings){return settings.fType==='random'?['fan','cup','lobed','radial'][Math.floor(random((layer.seed+layer.flora.variant*1013904223)>>>0)(0,4))]:settings.fType;}
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
export function buildFlowerParts(layer,raw){
 const s={...flowerDefaults,...raw},seed=(layer.seed+layer.flora.variant*1013904223)>>>0,r=random(seed^0x748FAC13),type=flowerType(layer,s);
 const aspect=s.width/s.height,unit=Math.min(1,aspect),size=s.fScale/100*unit,opening=s.fOpening/100,asym=s.fAsymmetry/100,abstract=1-s.fRecognition/100;
 const tilt=s.fTilt*Math.PI/180,rotation=s.fRotation*Math.PI/180,ct=Math.cos(tilt),st=Math.sin(tilt),cr=Math.cos(rotation),sr=Math.sin(rotation);
 const center=[s.fCenterX/100,s.fCenterY/100],length=s.fStem/100*.78*unit,bend=s.fBend/100,root=[center[0]-bend*.19*unit/aspect,center[1]+length];
 const tip=[(center[0]-root[0])*aspect,-length],width=(.023+.073*abstract)*size;
 const parts=[{id:'p0',name:'Stem',kind:'stem',path:stemPath(tip,length,width,bend,asym,random(seed^0x94FAB127)),parent:null,parentNode:0,origin:root,shade:.5,hidden:s.fStem===0}];
 const count=s.fPetals,phase=r(-.3,.3)*asym,base=.35*size,petals=[];
 // Coherent large-scale bias gives one side of the corolla more weight. It is
 // shared by every petal; Asymmetry adds individual differences on top of it.
 const hero=r(-Math.PI,Math.PI),wave=r(-Math.PI,Math.PI),shear=r(-.32,.32)*abstract;
 const fan=type==='fan',cup=type==='cup',lobed=type==='lobed';
 const span=fan?1.05+opening*2.9:lobed?2.2+opening*2.4:Math.PI*2;
 for(let j=0;j<count;j++){
  const pr=random((seed+j*2246822519+0xFA413)>>>0),t=j/Math.max(1,count-1);
  const angle=(fan||lobed?(t-.5)*span:j/count*Math.PI*2)+phase+pr(-.40,.40)*asym;
  const hierarchy=1+(.50*asym+.28*abstract+(lobed?.12:0))*Math.cos(angle-hero)+.12*asym*Math.cos(2*angle+wave);
  const len=base*clamp(hierarchy+pr(-.35,.25)*asym,.38,1.65)*(fan?.83+.17*Math.sin(t*Math.PI):1);
  const halfWidth=len*(.10+s.fWidth/100*.36+abstract*.16)*(lobed?1.20:fan?1.10:1)*(1+pr(-.25,.28)*asym);
  const curl=s.fCurl/100,sideCurl=pr(-.70,.70)*asym+curl*.28,spread=cup?.24+.70*opening:lobed?.67+.24*opening:.55+.45*opening;
  const axis=[Math.sin(angle),-Math.cos(angle)],normal=[Math.cos(angle),Math.sin(angle)];
  const skew=pr(-.24,.24)*asym,tipSkew=pr(-.16,.16)*asym;
  function point(u,side,profile){
   const reach=len*(u*spread-curl*.14*u*u*u),lateral=halfWidth*(side*profile*(1+side*skew)+sideCurl*u*u);
   let x=axis[0]*reach+normal[0]*lateral,y=axis[1]*reach+normal[1]*lateral;
   // A shared bend broadens abstract forms without making the edge noisy.
   x+=shear*y+abstract*.17*Math.sin(hero)*y*y/base;
   y+=abstract*.17*Math.cos(hero)*x*x/base;
   const z=len*((cup?(1.22-.40*opening)*u:(.08+.50*(1-opening))*Math.sin(u*Math.PI*.75))+curl*u*u*.50);
   const py=y*ct-z*st;return [x*cr-py*sr,x*sr+py*cr];
  }
  const neck=.12+.42*abstract;
  // Broad tips for the fan; a turned lip for cups; uneven paddles for lobes;
  // elongated petals for a radial bloom. All retain an editable shared root.
  const profile=fan?
   [[.18,-1,neck],[.50,-1,.65],[.85,-1,1],[1+tipSkew,-.55,.9],[.98-tipSkew,.45,.98],[.80,1,.94],[.45,1,.70],[.17,1,neck]]:
   cup?[[.20,-1,neck],[.52,-1,.65],[.87,-1,.93],[1.08+tipSkew,-.48,.76],[1-tipSkew,.45,1],[.80,1,1],[.47,1,.72],[.18,1,neck]]:
   lobed?[[.18,-1,neck],[.48,-1,.88],[.78,-1,1],[1+tipSkew,-.36,.8],[1.03-tipSkew,.35,.9],[.65,1,1.10],[.37,1,.83],[.16,1,neck]]:
   [[.20,-1,neck],[.52,-1,.76],[.80,-1,.94],[1+tipSkew,0,0],[.84,1,1],[.52,1,.78],[.18,1,neck]];
  const path=outline([[0,0],...profile.map(p=>point(...p))]),depth=-Math.cos(angle)*st+(cup?.4:0);
  petals.push({id:'p'+(j+1),name:'Petal '+(j+1),kind:'petal',path,parent:'p0',parentNode:2,origin:[0,0],shade:.5,depth});
 }
 // Keep a single bloom inside its size envelope. Explicit Size / Position still
 // allow cropping, but a long cup petal cannot leave the canvas at default values.
 const reach=Math.max(...petals.flatMap(p=>p.path.flatMap(n=>[[n.x,n.y],n.in,n.out].map(q=>Math.hypot(...q))))),fit=Math.min(1,.43*size/reach);
 if(fit<1)for(const p of petals)p.path=p.path.map(n=>({...n,x:n.x*fit,y:n.y*fit,in:n.in.map(v=>v*fit),out:n.out.map(v=>v*fit)}));
 petals.sort((a,b)=>a.depth-b.depth);return [...parts,...petals];
}
