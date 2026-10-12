import { normalizeVectorPath } from './vector-path.js?v=flora-growth-1';
export const floraDefaults={floraLayout:'cluster',floraCount:4,floraScale:112,floraRecognition:55,floraBranches:3,floraOpening:76,floraBend:60,floraMerge:65,floraFusion:35,floraLayers:null};
export const floraRanges={floraCount:[1,12,1],floraScale:[50,180,1],floraRecognition:[0,100,1],floraBranches:[1,5,1],floraOpening:[0,100,1],floraBend:[0,100,1],floraMerge:[0,100,1],floraFusion:[0,100,1]};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mixSize=(t,a,b)=>a+(b-a)*t;
function rng(seed){let n=seed>>>0;return(a=0,b=1)=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return a+(b-a)*((t^t>>>14)>>>0)/4294967296;};}
const node=(x,y,ix=x,iy=y,ox=x,oy=y)=>({x,y,in:[ix,iy],out:[ox,oy],smooth:false});
function outline(points,tension=.75){return points.map(([x,y],i)=>{const p=points[(i+points.length-1)%points.length],q=points[(i+1)%points.length],dx=(q[0]-p[0])*tension/6,dy=(q[1]-p[1])*tension/6;return {...node(x,y,x-dx,y-dy,x+dx,y+dy),smooth:true};});}
function rotate(path,angle,sx=1,sy=1){const c=Math.cos(angle),s=Math.sin(angle),at=([x,y])=>[x*sx*c-y*sy*s,x*sx*s+y*sy*c];return path.map(n=>{const [x,y]=at([n.x,n.y]);return {...n,x,y,in:at(n.in),out:at(n.out)};});}
export function normalizeFlora(value){
 if(!value||typeof value!=='object')return null;
 const edits={};for(const [id,v]of Object.entries(value.edits??{}).slice(0,80)){
  if(!/^p\d+$/.test(id)||!v||typeof v!=='object')continue;const path=normalizeVectorPath(v.path);
  edits[id]={...(path?{path}:{}),...(v.hidden===true?{hidden:true}:{}),...(v.sockets&&typeof v.sockets==='object'?{sockets:Object.fromEntries(Object.entries(v.sockets).filter(([id,n])=>/^p\d+$/.test(id)&&Number.isInteger(n)&&n>=0&&n<48))}:{}),...(typeof v.group==='string'&&/^(terrain|depth|light|sky|custom-[a-zA-Z0-9_-]+)$/.test(v.group)?{group:v.group}:{}),...(v.detached===true?{detached:true,origin:Array.isArray(v.origin)&&v.origin.length===2?v.origin.map(x=>clamp(Number(x)||0,-2,3)):[0,0]}:{})};
 }
 return {index:clamp(Math.round(Number(value.index)||0),0,31),variant:(Number(value.variant)||0)>>>0,edits,
 ...(value.frozen&&typeof value.frozen==='object'?{frozen:normalizeFloraParams(value.frozen)}:{})};
}
export function normalizeFloraParams(s){const out={};for(const [k,[a,b,step]]of Object.entries(floraRanges))out[k]=Math.round(clamp(s[k]!=null&&Number.isFinite(Number(s[k]))?Number(s[k]):floraDefaults[k],a,b)/step)*step;out.floraLayout=['single','cluster','field'].includes(s.floraLayout)?s.floraLayout:'cluster';return out;}
export function floraTemplate(settings){const count=settings.floraLayout==='single'?1:settings.floraCount??4;return Array.from({length:count},(_,i)=>({id:'flora-'+(i+1),name:'Plant '+(i+1),source:0,mode:'auto',seed:settings.seed,salt:0,layout:'auto',group:i>0&&rng((settings.seed+i*1597334677)>>>0)()<.24?'terrain':'depth',x:0,y:0,scaleX:1,scaleY:1,visible:true,locked:false,opacity:100,strokes:[],hasBase:false,geometry:null,flora:{index:i,variant:0,edits:{}}}));}
const geometryCache=new Map();
export function floraParts(layer,settings){
 if(!layer.flora)return [];
 const s={...floraDefaults,...settings,...layer.flora.frozen},f=layer.flora,key=JSON.stringify([layer.seed,f,s.width/s.height,...Object.keys(floraDefaults).filter(k=>k!=='floraLayers').map(k=>s[k])]);
 if(geometryCache.has(key))return geometryCache.get(key);
 const r=rng((layer.seed+f.index*2654435761+f.variant*1013904223)>>>0),aspect=s.width/s.height;
 const size=s.floraScale/100,recognition=s.floraRecognition/100,abstract=1-recognition,opening=s.floraOpening/100,bend=s.floraBend/100;
 const single=s.floraLayout==='single',field=s.floraLayout==='field',count=single?1:s.floraCount;
 // A shared plan provides hierarchy and a direction of growth. Individual plants
 // use their own stream, so rerolling a part never changes another plant's shape.
 const plan=rng((layer.seed^0x51F2AC39)>>>0),family=Math.floor(plan(0,4)),mirror=plan()<.5?-1:1;
 const tilt=plan(.35,.95)*mirror,phase=plan(0,Math.PI*2),index=f.index;
 const arrangements=[
  [[.63,.57,1.25],[.20,.81,.66],[.91,.05,.84],[.86,.87,.56]],
  [[.40,.56,1.12],[.85,.67,.85],[.10,.86,.60],[.67,-.02,.78]],
  [[.66,.43,1.15],[.24,.75,.90],[.03,.14,.58],[.81,.97,.57]],
  [[.77,.56,1.32],[.23,.90,.74],[.41,.04,.61],[.01,.49,.69]]
 ];
 let anchor=arrangements[family][index%4].slice();
 if(index>=4){const a=phase+index*2.399963;anchor=[.5+Math.cos(a)*.53,.55+Math.sin(a)*.57,r(.36,.65)];}
 if(mirror<0)anchor[0]=1-anchor[0];
 if(single)anchor=[.5,.48,1];
 if(field){const t=(index+.5)/count;anchor=[.05+t*.90+r(-.09,.09),r(.15,.88),r(.38,.82)];}
 const angle=single?r(-.3,.3)*bend:tilt*(.35+bend*.9)+r(-.42,.42)*abstract;
 const head=[anchor[0]+r(-.07,.07),anchor[1]+r(-.10,.10)];
 const height=Math.max((single?.59:field?r(.25,.65):r(.45,.80))*size,
  (1.1-head[1])/Math.max(.35,Math.cos(angle)));
 const lean=r(-.30,.30)*bend*size;
 const tip=[lean*Math.cos(angle)+height*Math.sin(angle),lean*Math.sin(angle)-height*Math.cos(angle)];
 const origin=[head[0]-tip[0]/aspect,head[1]-tip[1]];
 const parts=[];
 function add(kind,path,parent=null,parentNode=0,at=[0,0],shade=0,stableId=null){const id=stableId??'p'+parts.length;parts.push({id,name:kind==='stem'?'Stem':kind==='branch'?'Branch '+(parts.filter(p=>p.kind==='branch').length+1):'Petal '+(parts.filter(p=>p.kind==='petal').length+1),kind,path,parent,parentNode,origin:at,shade});return id;}
 const stems=new Map();
 function addStem(length,width,lean,turn,parent,parentNode,at,id,random){
  // A curved ribbon with independent left/right junction heights. The tip is
  // always node 2; existing point editing and attachment IDs stay predictable.
  const leftT=random(.34,.76),rightT=random(.25,.69);
  const sway=random(-.16,.16)*length*bend,counter=random(-.05,.05)*length*bend;
  const center=t=>[lean*t+sway*Math.sin(Math.PI*t)+counter*Math.sin(Math.PI*2*t),-length*t];
  const derivative=t=>[lean+sway*Math.PI*Math.cos(Math.PI*t)+counter*Math.PI*2*Math.cos(Math.PI*2*t),-length];
  const normal=t=>{const [x,y]=derivative(t),n=Math.hypot(x,y);return [-y/n,x/n];};
  const side=(t,sign)=>{const c=center(t),n=normal(t);return [c[0]+n[0]*width*.52*sign,c[1]+n[1]*width*.52*sign];};
  const junction=(t,sign)=>{const [x,y]=side(t,sign),d=derivative(t),before=sign<0?t/3:-(1-t)/3,after=sign<0?(1-t)/3:-t/3;
   return {...node(x,y,x-d[0]*before,y-d[1]*before,x+d[0]*after,y+d[1]*after),smooth:true};};
  const rootOut=side(leftT*.32,-1),rootIn=side(rightT*.32,1),cap=center(1-Math.min(.15,width*.55/length)),n=normal(1);
  const path=[node(0,0,width*.1,length*.01,...rootOut),junction(leftT,-1),
   node(lean,-length,cap[0]-n[0]*width*.45,cap[1]-n[1]*width*.45,cap[0]+n[0]*width*.45,cap[1]+n[1]*width*.45),
   junction(rightT,1),node(width*.45,length*.018,...rootIn,width*.22,length*.018)];
  const result=add(parent?'branch':'stem',rotate(path,turn),parent,parentNode,at,.5,id);
  stems.set(result,{length,width,tipAngle:turn+Math.atan2(derivative(1)[0],length)});return result;
 }
 const growthSeed=(layer.seed+f.index*2654435761+f.variant*1013904223)>>>0;
 const main=addStem(height,(.025+.14*abstract)*size*anchor[2],lean,angle,null,0,origin,'p0',rng(growthSeed^0x741D9C23));
 const heads=Math.round(s.floraBranches),branchIds=[];
 for(let b=0;b<heads;b++){
  // Independent streams keep existing blossoms stable when Blossoms is increased.
  const br=rng((growthSeed+b*2246822519+0x37A21D)>>>0);
  let parent=main,headScale=1;
  if(b>0){
   const nested=branchIds.length>0&&br()<(.22+.65*abstract);
   const trunk=nested?branchIds[Math.floor(br(0,branchIds.length))]:main;
   const source=parts.find(p=>p.id===trunk),sourceStem=stems.get(trunk);
   const side=br()<.5?-1:1,socket=side<0?1:3,n=source.path[socket];
   // The shoot follows its parent's local direction before bending outward.
   const tangent=[(n.out[0]-n.in[0])*-side,(n.out[1]-n.in[1])*-side];
   const axis=Math.atan2(tangent[0],-tangent[1]),turn=axis+side*br(.38,1.05)*(.75+.35*abstract);
   const len=Math.min(sourceStem.length*br(nested?.52:.22,nested?.95:.58),(.46+.12*abstract)*size)*br(.85,1.12);
   const width=sourceStem.width*br(.55,.86),curve=br(-.22,.22)*len*bend;
   parent=addStem(len,width,curve,turn,trunk,socket,[0,0],'p'+(b*10),br);
   branchIds.push(parent);headScale=br(.32,nested?.56:.72);
  }
  const headAngle=stems.get(parent).tipAngle+r(-1.15,1.15)*(.3+abstract),petals=5;
  const headSize=(single?.34:field?.25:.37)*size*anchor[2]*r(.92,1.08)*headScale;
  const prominent=Math.floor(r(b===0?3:2,6)),form=Math.floor(r(0,3));
  for(let j=0;j<petals;j++){
   const t=j/(petals-1),fan=(t-.5)*(1.1+opening*2.4),turn=fan+r(-.75,.75)*abstract;
   const small=j>=prominent?mixSize(recognition,.26,.68):1;
   const len=headSize*r(.65,1.40)*small,width=headSize*(.20+.32*opening+.16*abstract)*r(.58,1.20)*small;
   const curl=r(-1.2,1.2)*abstract,neck=.18+.32*recognition;
   // Unequal paddles, hooked lobes and long tongues share a narrow attachment.
   // Keep five stable part IDs and the stem's tip at node 2 for manual edits.
   let points;
   if(form===1&&j%2===0)points=[[0,0],[-width*neck,-len*.32],[-width*.92,-len*.75],[-width*.60+curl*width,-len*1.18],
    [width*.48+curl*width,-len*1.05],[width*.78,-len*.65],[width*.16,-len*.28]];
   else if(form===2&&j%2===1)points=[[0,0],[-width*.20,-len*.34],[-width*.70,-len*.65],[-width*.82+curl*width,-len],
    [width*.35+curl*width,-len*1.10],[width,-len*.79],[width*.60,-len*.40]];
   else points=[[0,0],[-width*neck,-len*.28],[-width,-len*.65],[-width*.5+curl*width,-len],
    [width*.32+curl*width,-len*(.94+r(-.18,.14)*abstract)],[width*.8,-len*.69],[width*.3,-len*.24]];
   const along=j>=3&&br()<abstract*.8;
   const socket=along?(j%2?1:3):2;
   const petalAngle=headAngle+turn+(along?(socket===1?-.5:.5)*abstract:0);
   add('petal',rotate(outline(points,.85),petalAngle,(form===2?.8:1)*(along?.72:1),(form===2?1.2:1)*(along?.72:1)),parent,socket,[0,0],.5,'p'+(b*10+j+1));
  }
 }
 // Local coordinates use isotropic canvas units before aspect correction.
 const resolved=[];
 for(const p of parts){const edit=f.edits?.[p.id]??{},parent=resolved.find(q=>q.id===p.parent),parentNode=f.edits?.[p.parent]?.sockets?.[p.id]??p.parentNode,socket=parent?parent.path[Math.min(parentNode,parent.path.length-1)]:null;
  const at=edit.detached?edit.origin:socket?[socket.x,socket.y]:p.origin;
  const local=edit.path??p.path.map(n=>({...n,x:n.x/aspect,in:[n.in[0]/aspect,n.in[1]],out:[n.out[0]/aspect,n.out[1]]}));
  const path=local.map(n=>({...n,x:n.x+at[0],y:n.y+at[1],in:[n.in[0]+at[0],n.in[1]+at[1]],out:[n.out[0]+at[0],n.out[1]+at[1]]}));
  resolved.push({...p,parentNode,local,path,origin:at,hidden:!!edit.hidden||!edit.detached&&!!parent?.hidden,manual:!!edit.path,group:edit.group??null,detached:!!edit.detached});
 }
 geometryCache.set(key,resolved);while(geometryCache.size>96)geometryCache.delete(geometryCache.keys().next().value);return resolved;
}
export function editFloraPart(layer,settings,id,patch){
 const part=floraParts(layer,settings).find(p=>p.id===id);if(!part||layer.locked)return layer;
 const f=structuredClone(layer.flora),edit={...f.edits[id],...patch};
 if(patch.reindex){const {at,delta}=patch.reindex;edit.sockets={...edit.sockets};for(const child of floraParts(layer,settings).filter(p=>p.parent===id))edit.sockets[child.id]=child.parentNode+(child.parentNode>=at?delta:0);delete edit.reindex;}
 if(patch.path){edit.path=normalizeVectorPath(patch.path);if(!edit.path)return layer;
  // The attachment remains fixed while moving individual anchors or handles.
  if(part.parent&&!edit.detached&&!part.detached){const origin=edit.path[0],dx=origin.x,dy=origin.y;edit.path=edit.path.map(n=>({...n,x:n.x-dx,y:n.y-dy,in:[n.in[0]-dx,n.in[1]-dy],out:[n.out[0]-dx,n.out[1]-dy]}));}
 }
 if(patch.detached===true)edit.origin=part.origin.slice();
 if(patch.reset){delete f.edits[id];}else{delete edit.reset;f.edits[id]=edit;}
 return {...layer,flora:f};
}
export function resizeFloraStack(settings){
 if(!Array.isArray(settings.floraLayers))return settings;
 const count=settings.floraLayout==='single'?1:settings.floraCount,stack=settings.floraLayers,plants=stack.filter(l=>l.flora),other=stack.filter(l=>!l.flora);
 const next=plants.slice(0,count),templates=floraTemplate({...settings,floraCount:count});
 for(let i=next.length;i<count&&next.length+other.length<16;i++){let n=i+1;while(stack.some(l=>l.id==='flora-'+n)||next.some(l=>l.id==='flora-'+n))n++;next.push({...templates[i],id:'flora-'+n,name:'Plant '+n,flora:{index:i,variant:0,edits:{}}});}
 return {...settings,floraLayers:[...next,...other]};
}
