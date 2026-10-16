// Seeded composition planning is separate from flower geometry and document state.
// Raster samples of real contours let placement compare overlap, cropping and gaps.
import {floraParts} from './flora.js?v=petal-motion-1';
import {flattenVectorPath} from './vector-path.js?v=petal-motion-1';
import {localToCanvas} from './transforms.js?v=petal-motion-1';
import {sharedParameters,effectiveSettings} from './object-model.js?v=unified-document-1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const flower=l=>l.flora?.generator==='flower';
export const compositionRank=l=>l.composition?.rank??l.flora?.index??0;
export const autoFlower=l=>flower(l)&&l.parameterMode!=='individual'&&l.mode==='auto'&&!l.locked;
function random(seed){let n=seed>>>0;return(a=0,b=1)=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return a+(b-a)*((t^t>>>14)>>>0)/4294967296;};}
const role=rank=>rank===0?'hero':rank<3?'support':'accent';
const round=v=>Math.round(v*10000)/10000;
function bounds(polys){const points=polys.flat();if(!points.length)return null;const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};}
function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function footprint(s,l){
 const transform=p=>localToCanvas(p,{x:0,y:0,scaleX:1,scaleY:1,...l},s.width/s.height);
 let parts=[];
 if(l.flora)parts=floraParts(l,s).filter(p=>!p.hidden).map(p=>({head:p.kind==='petal',poly:flattenVectorPath(p.path).map(transform)}));
 else if(l.vectorPath)parts=[{head:true,poly:flattenVectorPath(l.vectorPath).map(transform)}];
 else if(l.strokes?.length){const points=l.strokes.filter(p=>p.kind==='paint').flatMap(stroke=>stroke.points.map(transform));return {samples:points.map(([x,y])=>[x,y,1]),head:bounds([points])};}
 const box=bounds(parts.map(p=>p.poly));if(!box)return {samples:[],head:null};
 const aspect=s.width/s.height,step=Math.max(1/Math.max(24,Math.round(80/aspect)),Math.max((box.right-box.left)*aspect,box.bottom-box.top)/128);
 if(step<=0)return {samples:[],head:box};
 const samples=[];
 for(let y=box.top+step/2;y<box.bottom;y+=step)for(let x=box.left+step/aspect/2;x<box.right;x+=step/aspect){
  let body=false,head=false;for(const part of parts)if(inside(x,y,part.poly)){body=true;head ||=part.head;}
  if(body)samples.push([x,y,head?1:.2]);
 }
 // Very thin profiles still contribute a few contour samples.
 if(!samples.length)for(const p of parts)for(const [x,y]of p.poly.filter((_,i)=>i%4===0))samples.push([x,y,p.head?1:.2]);
 return {samples,head:bounds(parts.filter(p=>p.head).map(p=>p.poly))??box};
}
function intent(s){
 const p=sharedParameters(s,'flower'),r=random(s.seed^0x7394bd15),sign=r()<.5?-1:1;
 return {density:p.fDensity/100,sign,
  focus:[p.fCenterX/100+sign*r(.08,.18),p.fCenterY/100+r(-.14,.03)],
  fieldSide:r(.12,.30)};
}
function anchor(plan,rank,r){
 const {focus,density,sign}=plan,spread=1.24-density*.58;
 if(rank===0)return [focus[0]+r(-.07,.07),focus[1]+r(-.06,.06)];
 // Unequal clusters form one field, with open space between them.
 const left=sign>0?plan.fieldSide:1-plan.fieldSide;
 const centers=[focus,[left,.76],[1-left,.22]],c=centers[rank%3];
 return [c[0]+r(-.15,.15)*spread,c[1]+r(-.13,.13)*spread];
}
function groundStem(layer,settings,margin){
 const stem=floraParts(layer,settings).find(p=>p.kind==='stem');
 if(!stem||stem.hidden||stem.manual)return layer;
 const root=localToCanvas([stem.path[0].x,stem.path[0].y],layer,settings.width/settings.height);
 const down=layer.scaleY*(layer.flipY?-1:1)*Math.cos((layer.rotation||0)*Math.PI/180);
 if(down<.25)return layer;
 return {...layer,composition:{...layer.composition,stemExtension:round(Math.max(0,(1+margin-root[1])/down)),stemLengthRef:effectiveSettings(settings,layer).fStem}};
}
export function composeFlowers(settings,stack,{ids=null,includeIndividual=false}={}){
 const chosen=stack.filter(l=>flower(l)&&!l.locked&&(ids?ids.includes(l.id)&&(includeIndividual||autoFlower(l)):autoFlower(l)));
 if(!chosen.length)return stack;
 // Keep the deliberate one-flower framing (including Six cup) without a layout offset.
 if(stack.filter(l=>l.visible!==false&&flower(l)).length===1&&chosen.length===1&&!stack.some(l=>!chosen.includes(l)&&l.visible!==false&&(l.flora||l.vectorPath||l.strokes?.length)))return stack;
 const plan=intent(settings),aspect=settings.width/settings.height,cols=80,rows=Math.max(24,Math.round(cols/aspect)),occupied=new Float32Array(cols*rows),heads=[];
 const toCell=(x,y)=>x<0||x>=1||y<0||y>=1?-1:Math.floor(y*rows)*cols+Math.floor(x*cols);
 const add=(f,dx=0,dy=0)=>{for(const [x,y,w]of f.samples){const at=toCell(x+dx,y+dy);if(at>=0)occupied[at]=Math.max(occupied[at],w);}if(f.head)heads.push({x:(f.head.left+f.head.right)/2+dx,y:(f.head.top+f.head.bottom)/2+dy});};
 const fixed=stack.filter(l=>!chosen.includes(l)),used=new Set(fixed.filter(flower).map(compositionRank));
 for(const l of fixed)if(l.visible!==false)add(footprint(settings,l));
 const planned=new Map();
 const ordered=[...chosen].sort((a,b)=>Number(b.visible!==false)-Number(a.visible!==false)||compositionRank(a)-compositionRank(b));
 for(const original of ordered){
  let rank=0;while(used.has(rank))rank++;used.add(rank);
  const r=random((settings.seed^Math.imul((original.flora.index??0)+1,2654435761))>>>0);
  const lean=round((rank===0?plan.sign*.35:((rank%2?1:-1)*.65))+r(-.25,.25));
  const l={...original,composition:{rank,role:role(rank),lean},x:0,y:0,scaleX:1,scaleY:1};
  const f=footprint(settings,l),head=f.head;
  if(!head||!f.samples.length){planned.set(l.id,l);continue;}
  const cx=(head.left+head.right)/2,cy=(head.top+head.bottom)/2;
  let best=null;
  for(let candidate=0;candidate<64;candidate++){
   const target=anchor(plan,rank,r,aspect),dx=clamp(target[0]-cx,-1,1),dy=clamp(target[1]-cy,-1,1);
   let total=0,off=0,overlap=0,headTotal=0,headOff=0;
   for(const [x,y,w]of f.samples){total+=w;if(w===1)headTotal++;const at=toCell(x+dx,y+dy);if(at<0){off+=w;if(w===1)headOff++;}else overlap+=w*occupied[at];}
   const crop=headOff/Math.max(1,headTotal),cover=overlap/Math.max(1,total),desiredCover=rank===0?0:.01+plan.density*.07;
   const nearest=heads.length?Math.min(...heads.map(p=>Math.hypot((target[0]-p.x)*aspect,target[1]-p.y))):1;
   const targetCrop=rank===0?.06:rank<3?.09:.17;
   // Intentional overlaps and edge crops are allowed; swallowed heads are not.
   const score=7*Math.max(0,crop-.35)**2+1.4*Math.abs(crop-targetCrop)+3.5*Math.abs(cover-desiredCover)
    +7*Math.max(0,cover-.55)**2+1.6*Math.max(0,.15-nearest)+.12*off/Math.max(1,total)
    +(rank===0?.7*Math.hypot(target[0]-plan.focus[0],target[1]-plan.focus[1]):0);
   if(!best||score<best.score)best={dx,dy,score};
  }
  l.x=round(best.dx);l.y=round(best.dy);
  const grounded=rank<3||r()<.84,placed=grounded?groundStem(l,settings,r(.06,.18)):l;planned.set(l.id,placed);
  if(placed.visible!==false)add(footprint(settings,placed));
 }
 return stack.map(l=>planned.get(l.id)??l);
}
