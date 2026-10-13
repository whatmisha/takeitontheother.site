// Runtime pose only: symbols survive normalization but never enter JSON or presets.
export const FLOWER_MOTION=Symbol.for('grainy-land.flower-motion');
const tau=Math.PI*2;
function random(seed,id){let n=seed>>>0;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n=Math.imul(n^n>>>16,2246822519);n=Math.imul(n^n>>>13,3266489917);return ((n^n>>>16)>>>0)/4294967296;};}

// A smooth bend with an undeformed collar. Transform Bezier handles with the
// local Jacobian so smooth anchors retain their tangent, including manual paths.
export function bendPetal(path,aspect,swing,stretch){
 const root=path[0],radius=Math.max(...path.map(n=>Math.hypot((n.x-root.x)*aspect,n.y-root.y)));
 if(radius<1e-8)return path;
 return path.map(n=>{
  const x=(n.x-root.x)*aspect,y=n.y-root.y,r=Math.hypot(x,y),t=Math.max(0,Math.min(1,(r/radius-.18)/.82));
  const weight=t*t*(3-2*t),derivative=6*t*(1-t)/(.82*radius),angle=swing*weight,scale=1+stretch*weight,c=Math.cos(angle),s=Math.sin(angle);
  const rx=x*c-y*s,ry=x*s+y*c,px=root.x+scale*rx/aspect,py=root.y+scale*ry;
  const handle=h=>{
   const dx=(h[0]-n.x)*aspect,dy=h[1]-n.y,dr=r>1e-8?(x*dx+y*dy)/r:0;
   return [px+(scale*(dx*c-dy*s)+derivative*dr*(stretch*rx-scale*swing*ry))/aspect,
    py+scale*(dx*s+dy*c)+derivative*dr*(stretch*ry+scale*swing*rx)];
  };
  return {...n,x:px,y:py,in:handle(n.in),out:handle(n.out)};
 });
}
export function poseFlowerParts(parts,layer,settings){
 const motion=layer[FLOWER_MOTION];
 if(!motion||layer.locked||layer.flora?.generator!=='flower'||!motion.amount||!motion.angle)return parts;
 const aspect=settings.width/settings.height,strength=1-Math.exp(-motion.amount*8);
 return parts.map(p=>{
  if(p.kind!=='petal'||p.hidden)return p;
  const r=random((layer.seed+layer.flora.variant*1013904223)>>>0,layer.id+':'+p.id),phase=r()*tau,second=r()*tau;
  const wave=(Math.sin(motion.angle+phase)-Math.sin(phase))*.78+(Math.sin(2*motion.angle+second)-Math.sin(second))*.22;
  const swing=wave*strength*(.32+r()*.14),stretch=(Math.cos(motion.angle+second)-Math.cos(second))*strength*.055;
  const local=bendPetal(p.local,aspect,swing,stretch),[ox,oy]=p.origin;
  const path=local.map(n=>({...n,x:n.x+ox,y:n.y+oy,in:[n.in[0]+ox,n.in[1]+oy],out:[n.out[0]+ox,n.out[1]+oy]}));
  return {...p,local,path};
 });
}
