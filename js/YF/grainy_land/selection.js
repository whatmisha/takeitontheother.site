import {localToCanvas,canvasToLocal} from './transforms.js?v=studio-1';
import {getLayers,withLayers,duplicateLayer,MAX_LAYERS} from './layers.js?v=studio-1';
export function editSelection(settings,ids,patch,primary=ids[0]){
 const stack=getLayers(settings),chosen=stack.filter(l=>ids.includes(l.id)&&!l.locked),base=chosen.find(l=>l.id===primary)??chosen[0];if(!base)return settings;
 const center=[chosen.reduce((v,l)=>v+l.x,0)/chosen.length,chosen.reduce((v,l)=>v+l.y,0)/chosen.length],aspect=settings.width/settings.height;
 const sx=patch.scaleX!=null?patch.scaleX/base.scaleX:1,sy=patch.scaleY!=null?patch.scaleY/base.scaleY:1;
 const angle=patch.rotation!=null?(patch.rotation-(base.rotation||0))*Math.PI/180:0,c=Math.cos(angle),s=Math.sin(angle);
 const flipX=patch.flipX!=null&&patch.flipX!==!!base.flipX,flipY=patch.flipY!=null&&patch.flipY!==!!base.flipY;
 const geometric=['x','y','scaleX','scaleY','rotation','flipX','flipY'].some(k=>Object.hasOwn(patch,k));
 return withLayers(settings,stack.map(l=>{
  if(!chosen.includes(l))return l;let next={...l,...patch};
  if(chosen.length>1){
   let x=(l.x-center[0])*sx*(flipX?-1:1)*aspect,y=(l.y-center[1])*sy*(flipY?-1:1);
   next.x=center[0]+(x*c-y*s)/aspect+(patch.x!=null?patch.x-base.x:0);next.y=center[1]+x*s+y*c+(patch.y!=null?patch.y-base.y:0);
   next.scaleX=l.scaleX*sx;next.scaleY=l.scaleY*sy;
   if(patch.rotation!=null)next.rotation=(l.rotation||0)+angle*180/Math.PI;
   if(flipX)next.flipX=!l.flipX;if(flipY)next.flipY=!l.flipY;
  }
  if(patch.material)next.material={...l.material,...patch.material};
  if(geometric&&l.mode==='auto')next.mode='pinned';return next;
 }));
}
export function duplicateSelection(settings,ids){
 const stack=getLayers(settings),chosen=stack.filter(l=>ids.includes(l.id));if(stack.length+chosen.length>MAX_LAYERS)throw Error('Maximum '+MAX_LAYERS+' layers per composition.');
 let next=settings;const copies=[],mapping={},groups=new Map();for(const l of chosen){const added=duplicateLayer(next,l.id);next=added.settings;copies.push(added.id);mapping[l.id]=added.id;if(l.collection){if(!groups.has(l.collection)){let name=l.collection+' copy',i=2;while(getLayers(next).some(x=>x.collection===name))name=l.collection+' copy '+i++;groups.set(l.collection,name);}next=editSelection(next,[added.id],{collection:groups.get(l.collection)});}}
 const all=getLayers(next),originals=all.filter(l=>!copies.includes(l.id)),insert=1+Math.max(...originals.map((l,i)=>ids.includes(l.id)?i:-1));originals.splice(insert,0,...copies.map(id=>all.find(l=>l.id===id)));next=withLayers(next,originals);
 return {settings:next,ids:copies,mapping,id:copies.at(-1)};
}

export function reorderSelection(settings,ids,targetId,placement='before'){
 const stack=[...getLayers(settings)].reverse(),moving=stack.filter(l=>ids.includes(l.id));if(!moving.length||moving.some(l=>l.locked)||ids.includes(targetId))return settings;
 const rest=stack.filter(l=>!ids.includes(l.id)),index=rest.findIndex(l=>l.id===targetId);if(index<0)return settings;rest.splice(index+(placement==='after'?1:0),0,...moving);return withLayers(settings,rest.reverse());
}

// Resize around the visible selection center without adding a second translation.
export function resizeSelection(settings,ids,sx,sy,center){
 const chosen=getLayers(settings).filter(l=>ids.includes(l.id)&&!l.locked);if(!chosen.length)return settings;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 sx=clamp(sx,Math.max(...chosen.map(l=>.25/l.scaleX)),Math.min(...chosen.map(l=>3/l.scaleX)));
 sy=clamp(sy,Math.max(...chosen.map(l=>.25/l.scaleY)),Math.min(...chosen.map(l=>3/l.scaleY)));
 return withLayers(settings,getLayers(settings).map(l=>{
  if(!chosen.some(c=>c.id===l.id))return l;const next={...l,scaleX:l.scaleX*sx,scaleY:l.scaleY*sy,mode:l.mode==='auto'?'pinned':l.mode};
  if(chosen.length===1){const local=canvasToLocal(center,l,settings.width/settings.height),moved=localToCanvas(local,next,settings.width/settings.height);next.x=l.x+center[0]-moved[0];next.y=l.y+center[1]-moved[1];}
  else {next.x=center[0]+(.5+l.x-center[0])*sx-.5;next.y=center[1]+(.5+l.y-center[1])*sy-.5;}
  return next;
 }));
}
