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
export function buildFlowerParts(layer,raw){
 const s={...flowerDefaults,...raw},seed=(layer.seed+layer.flora.variant*1013904223)>>>0,r=random(seed^0x748FAC13),type=flowerType(layer,s);
 const aspect=s.width/s.height,unit=Math.min(1,aspect),size=s.fScale/100*unit,opening=s.fOpening/100,asym=s.fAsymmetry/100,recognition=s.fRecognition/100;
 const tilt=s.fTilt*Math.PI/180,rotation=s.fRotation*Math.PI/180,ct=Math.cos(tilt),st=Math.sin(tilt),cr=Math.cos(rotation),sr=Math.sin(rotation);
 const center=[s.fCenterX/100,s.fCenterY/100],length=s.fStem/100*.78*unit,bend=s.fBend/100,root=[center[0]-bend*.19*unit/aspect,center[1]+length];
 const tip=[(center[0]-root[0])*aspect,-length],width=(.024+.045*(1-recognition))*size,sway=bend*length*.34;
 // Node 2 is the flower center. Every petal shares this editable attachment.
 const stem=[node(0,0,width*.3,length*.025,-width*.6,-length*.22),node(tip[0]*.42-width*.6+sway,-length*.5,tip[0]*.12-width*.6+sway,-length*.28,tip[0]*.77-width*.35,-length*.74),node(...tip,tip[0]-width*.33,-length*.93,tip[0]+width*.33,-length*.93),node(tip[0]*.42+width*.6+sway,-length*.5,tip[0]*.77+width*.35,-length*.74,tip[0]*.12+width*.6+sway,-length*.28),node(width*.4,0,width*.6,-length*.22,width*.3,length*.025)];
 const parts=[{id:'p0',name:'Stem',kind:'stem',path:stem,parent:null,parentNode:0,origin:root,shade:.5,hidden:s.fStem===0}];
 const count=s.fPetals,phase=type==='fan'?0:r(-.28,.28),base=.31*size,petals=[];
 for(let j=0;j<count;j++){
  // Each petal owns a stream. Changing size/tilt never reshuffles its character.
  const pr=random((seed+j*2246822519+0xFA413)>>>0),t=j/Math.max(1,count-1);
  const angle=(type==='fan'?(t-.5)*(1.05+opening*2.5):j/count*Math.PI*2)+phase+pr(-.26,.26)*asym;
  const len=base*(1+pr(-.35,.28)*asym)*(type==='fan'?.8+.2*Math.sin(t*Math.PI):1);
  const halfWidth=len*(.11+s.fWidth/100*.40)*(type==='lobed'?1.65:1)*(1+pr(-.25,.25)*asym);
  const curl=s.fCurl/100,sideCurl=pr(-.65,.65)*asym+(type==='lobed'?pr(-.30,.30):0);
  const cup=type==='cup',spread=cup?.30+.70*opening:type==='lobed'?.65+.25*opening:.55+.45*opening;
  const axis=[Math.sin(angle),-Math.cos(angle)],normal=[Math.cos(angle),Math.sin(angle)];
  function point(u,side,profile){
   const reach=len*u*spread,lateral=halfWidth*(side*profile+sideCurl*u*u);
   const x=axis[0]*reach+normal[0]*lateral,y=axis[1]*reach+normal[1]*lateral;
   // Cup depth and tip curl survive projection at side views; no lighting is baked in.
   const z=len*((cup?(1.35-.45*opening)*u:(.08+.55*(1-opening))*Math.sin(u*Math.PI*.75))+curl*u*u*.50);
   const py=y*ct-z*st;return [x*cr-py*sr,x*sr+py*cr];
  }
  const neck=(.10+.22*(1-recognition))*(type==='lobed'?2:1);
  const points=[[0,0],point(.20,-1,neck),point(.52,-1,.78),point(.82,-1,1),point(1,0,.0),point(.82,1,.92+pr(-.22,.22)*asym),point(.48,1,.72),point(.18,1,neck)];
  const path=outline(points),depth=-Math.cos(angle)*st+(cup?.4:0);
  petals.push({id:'p'+(j+1),name:'Petal '+(j+1),kind:'petal',path,parent:'p0',parentNode:2,origin:[0,0],shade:.5,depth});
 }
 // Stable IDs survive depth ordering, editing and layer export.
 petals.sort((a,b)=>a.depth-b.depth);return [...parts,...petals];
}
