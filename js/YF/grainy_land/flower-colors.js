// Palette roles, not baked RGB: recoloring the scene also recolors its flowers.
// Stable per-flower / per-petal streams do not depend on the number of objects.
const clamp=v=>Math.max(0,Math.min(1,v));
function random(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export function colorFlower(parts,layer,s){
 const seed=(layer.seed+Math.imul(layer.flora.index+1,2654435761)+Math.imul(layer.flora.variant,1013904223))>>>0,r=random(seed^0x85EBCA6B);
 const palette=[...new Set([layer.group??'depth','depth','terrain','light',...(s.customColors??[]).map(c=>c.id)])];
 const between=clamp((s.fColorVariation??0)/100),within=clamp((s.fPetalColors??0)/100);
 const primary=r()<between?palette[Math.floor(r()*palette.length)]:layer.group;
 const others=palette.filter(g=>g!==primary),secondary=others[Math.floor(r()*others.length)],third=others.find(g=>g!==secondary)??primary;
 const phase=r(),count=parts.filter(p=>p.kind==='petal').length;
 return parts.map(p=>{
  let group=primary;
  if(p.kind==='petal'&&within>0){
   const index=Number(p.id.slice(1))-1,pr=random(seed^Math.imul(index+1,2246822519)),t=((index/Math.max(1,count)+phase)%1);
   if(s.fColorPattern==='alternating'){
    if(index%2===1&&pr()<within)group=secondary;
    else if(index%3===2&&pr()<within*.65)group=third;
   }else if(s.fColorPattern==='scattered'){
    if(pr()<within)group=pr()<.72?secondary:third;
   }else if(t<within*.8)group=t<within*.26?third:secondary;
  }
  return {...p,group:group===layer.group?null:group};
 });
}
