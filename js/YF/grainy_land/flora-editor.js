import {floraParts,editFloraPart} from './flora.js?v=flower-f-5';
import {getLayers,editLayer,layerSettingsKey} from './layers.js?v=flower-f-5';
import {localToCanvas,canvasToLocal} from './transforms.js?v=flower-f-5';
import {moveVectorNode,setVectorNodesSmooth,splitVectorSegment,vectorSegment,cubicPoint,flattenVectorPath,vectorDistance} from './vector-path.js?v=flower-f-5';
import {groupColor} from './custom-colors.js?v=flower-f-5';
const byId=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
function svg(tag,attrs){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
export class FloraEditor{
 constructor(editor){this.e=editor;this.editing=false;this.partId=null;this.node=0;this.expanded=new Set();}
 parts(){return floraParts(this.e.layer()??{},this.e.tool.settings);}
 part(){return this.parts().find(p=>p.id===this.partId);}
 init(){const e=this.e,on=(target,event,handler,capture=false)=>target.addEventListener(event,handler,{signal:e.abort.signal,capture});this.svg=byId('floraOverlay');
  on(byId('editFloraParts'),'click',()=>this.open(!this.editing));
  on(byId('regeneratePlant'),'click',()=>{const l=e.layer();if(l?.flora&&!l.locked)e.change(e.tool,editLayer(e.tool.settings,l.id,{flora:{...l.flora,variant:l.flora.variant+1}}),'Regenerate plant');});
  on(byId('floraSmooth'),'click',()=>this.smooth(true));on(byId('floraCorner'),'click',()=>this.smooth(false));on(byId('floraDeletePoint'),'click',()=>this.deletePoint());
  on(byId('floraResetPart'),'click',()=>this.patch({reset:true},'Reset plant part'));
  on(byId('floraDetach'),'click',()=>this.patch({detached:!this.part()?.detached},'Plant attachment'));
  on(byId('floraHidePart'),'click',()=>this.patch({hidden:!this.e.layer()?.flora.edits?.[this.partId]?.hidden},'Part visibility'));
  for(const [id,angle,scale]of [['floraRotateLeft',-15,1],['floraRotateRight',15,1],['floraPartSmaller',0,.9],['floraPartLarger',0,1.1]])on(byId(id),'click',()=>this.transform(angle,scale));
  on(e.container,'dblclick',event=>{
   if(event.button!==0||e.space)return;
   if(this.editing){const segment=event.target.closest('[data-flora-segment]');if(segment){this.stop(event);const p=this.part();if(p.local.length>=48)return;const i=Number(segment.dataset.floraSegment),pos=this.point(event),curve=vectorSegment(p.local,i);let at=.5,d=Infinity;for(let t=.02;t<1;t+=.02){const q=cubicPoint(curve,t),dist=(q[0]-pos[0]+p.origin[0])**2+(q[1]-pos[1]+p.origin[1])**2;if(dist<d){d=dist;at=t;}}this.node=i+1;this.patch({path:splitVectorSegment(p.local,i,at),reindex:{at:i+1,delta:1}},'Add plant point');}return;}
   const id=e.hit(e.point(event)),l=getLayers(e.tool.settings).find(l=>l.id===id);if(!l?.flora||l.locked)return;this.stop(event);e.select(id,{individual:true});this.open(true);this.chooseAt(this.point(event));
  },true);
  on(e.container,'pointerdown',event=>this.down(event),true);on(e.container,'pointermove',event=>this.move(event),true);
  on(e.container,'pointerup',event=>{if(this.drag?.pointerId===event.pointerId){this.stop(event);this.finish();}},true);
  on(e.container,'pointercancel',()=>this.cancel(),true);on(e.container,'lostpointercapture',()=>this.cancel(),true);on(window,'blur',()=>this.cancel());
  on(document,'keydown',event=>{
   if((!this.editing&&!this.drag)||event.target.closest('input,select,textarea,[contenteditable="true"],dialog,[role="dialog"],.modal-overlay'))return;
   if(event.key==='Escape'){this.stop(event);if(this.drag)this.cancel();else this.open(false);return;}
   if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&this.drag){this.stop(event);this.cancel();return;}
   if(!this.editing||event.metaKey||event.ctrlKey||event.altKey)return;
   if(['Delete','Backspace'].includes(event.key)){this.stop(event);this.deletePoint();return;}
   if(e.container.contains(event.target)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){this.stop(event);const p=this.part();if(!p)return;const n=p.local[this.node],step=event.shiftKey?10:1;if(this.node===0&&p.parent&&!p.detached)return;this.patch({path:moveVectorNode(p.local,this.node,[n.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/e.tool.settings.width,n.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/e.tool.settings.height])},'Move plant point');}
  },true);return this;
 }
 stop(event){event.preventDefault();event.stopImmediatePropagation();}
 open(value){this.cancel();const e=this.e,l=e.layer();e.vector?.deactivate();e.cancel();this.editing=!!value&&!!l?.flora&&!l.locked&&l.visible&&l.mode!=='drawn';this.layerId=e.selected;
  if(this.editing){e.paintTool='move';this.expanded.add(l.id);this.partId=this.part()?.id??this.parts().find(p=>p.kind==='petal')?.id??'p0';}
  this.e.listKey='';e.sync();e.tool.render();e.container.focus({preventScroll:true});
 }
 deactivate(){this.cancel();this.editing=false;}
 select(id,part){if(this.e.selected!==id)this.e.select(id,{individual:true});this.partId=part;this.node=0;this.open(true);}
 point(event){const s=this.e.tool.settings;return canvasToLocal(this.e.point(event),this.e.layer(),s.width/s.height);}
 chooseAt(point){const candidates=this.parts().filter(p=>!p.hidden).map(p=>({p,d:vectorDistance(point[0],point[1],flattenVectorPath(p.path))})),inside=candidates.filter(x=>x.d>=0);const chosen=inside.at(-1)??candidates.sort((a,b)=>b.d-a.d)[0];if(chosen){this.partId=chosen.p.id;this.node=0;this.e.sync();this.e.tool.render();}}
 patch(patch,label){const l=this.e.layer();if(!l||l.locked||!this.part())return;const updated=editFloraPart(l,this.e.tool.settings,this.partId,patch);this.e.change(this.e.tool,editLayer(this.e.tool.settings,l.id,{flora:updated.flora}),label);}
 smooth(value){const p=this.part();if(p)this.patch({path:setVectorNodesSmooth(p.local,[this.node],value)},value?'Smooth plant point':'Corner plant point');}
 protectedPoint(){const p=this.part();return !!p&&(this.node===0&&p.parent&&!p.detached||this.parts().some(child=>child.parent===p.id&&!child.detached&&child.parentNode===this.node));}
 deletePoint(){const p=this.part();if(!p)return;if(p.local.length<=3||this.protectedPoint()){this.e.report('Keep the attachment and at least three points.');return;}const at=this.node,path=p.local.filter((_,i)=>i!==at);this.node=Math.min(at,path.length-1);this.patch({path,reindex:{at,delta:-1}},'Delete plant point');}
 transform(angle,scale){const p=this.part();if(!p)return;const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),aspect=this.e.tool.settings.width/this.e.tool.settings.height,at=([x,y])=>[(x*aspect*c-y*s)*scale/aspect,(x*aspect*s+y*c)*scale];this.patch({path:p.local.map(n=>{const [x,y]=at([n.x,n.y]);return {...n,x,y,in:at(n.in),out:at(n.out)};})},'Transform plant part');}
 center(){const parts=this.parts(),part=parts.find(p=>p.id==='p0'),node=parts.find(p=>p.parent==='p0')?.parentNode??2;return {part,node};}
 centerEditable(){const l=this.e.layer();return l?.flora?.generator==='flower'&&l.mode!=='drawn'&&!l.locked&&l.visible&&this.e.paintTool==='move'&&!this.e.vector?.pen;}
 down(event){const e=this.e;
  if(!this.editing&&this.centerEditable()&&event.button===0&&!e.space&&event.target.closest('[data-flower-center]')){
   this.stop(event);e.container.focus({preventScroll:true});this.layerId=e.selected;
   const {part,node}=this.center();
   this.drag={center:true,pointerId:event.pointerId,part,side:'anchor',node,layer:e.layer(),snapshot:e.tool.getSnapshot(),origin:this.point(event),started:false};
   e.container.setPointerCapture(event.pointerId);return;
  }
  if(!this.editing||event.button!==0||e.space||e.layer()?.locked)return;const control=event.target.closest('[data-flora-node]');if(!control){if(event.target.closest('[data-flora-segment]')){this.stop(event);return;}const hit=e.hit(e.point(event));if(hit!==e.selected){this.open(false);return;}this.stop(event);this.chooseAt(this.point(event));return;}
  this.stop(event);e.container.focus({preventScroll:true});this.node=Number(control.dataset.floraNode);const part=this.part(),side=control.dataset.floraSide;e.sync();
  if(this.node===0&&side==='anchor'&&part.parent&&!part.detached){this.e.report('This point stays connected. Move the stem or use Detach.');return;}
  this.drag={pointerId:event.pointerId,part,side,node:this.node,layer:e.layer(),snapshot:e.tool.getSnapshot(),origin:this.point(event),started:false};e.container.setPointerCapture(event.pointerId);e.tool.render();
 }
 move(event){const g=this.drag,e=this.e;if(!g||g.pointerId!==event.pointerId)return;this.stop(event);const point=this.point(event);if(!g.started&&Math.hypot(point[0]-g.origin[0],point[1]-g.origin[1])<.001)return;
  if(!g.started){e.tool.history.flush();e.tool.history.beginTransaction(g.center?'Move flower center':'Edit plant part');g.started=true;}
  const at=g.center?[g.part.local[g.node].x+point[0]-g.origin[0],g.part.local[g.node].y+point[1]-g.origin[1]]:[point[0]-g.part.origin[0],point[1]-g.part.origin[1]],path=moveVectorNode(g.part.local,g.node,at,g.side,event.altKey),updated=editFloraPart(g.layer,g.snapshot,g.part.id,{path});
  const next=editLayer(g.snapshot,g.layer.id,{flora:updated.flora});e.tool.settingsStore.set(layerSettingsKey(g.snapshot.mode),next[layerSettingsKey(g.snapshot.mode)]);
 }
 finish(){const g=this.drag;if(!g)return;this.drag=null;if(g.started)this.e.tool.history.endTransaction();if(this.e.container.hasPointerCapture(g.pointerId))this.e.container.releasePointerCapture(g.pointerId);}
 cancel(){const g=this.drag;if(!g)return;this.drag=null;if(g.started){this.e.tool.applySnapshot(g.snapshot);this.e.tool.history.endTransaction();}if(this.e.container.hasPointerCapture(g.pointerId))this.e.container.releasePointerCapture(g.pointerId);}
 sync(){const e=this.e,l=e.layer(),editable=!!l?.flora&&l.mode!=='drawn';if(!editable||l.locked||!l.visible||e.selected!==this.layerId)this.deactivate();
  byId('regeneratePlant').textContent=l?.flora?.generator==='flower'?'Regenerate flower':'Regenerate plant';
  byId('floraControls').hidden=!editable;byId('floraPartControls').hidden=!this.editing;byId('editFloraParts').textContent=this.editing?'Done editing':'Edit parts';byId('editFloraParts').setAttribute('aria-pressed',String(this.editing));
  this.svg.toggleAttribute('hidden',!this.editing&&!this.centerEditable());if(!this.editing){this.svg.replaceChildren();return;}e.overlay.hidden=true;
  const p=this.part();if(!p){this.partId=this.parts()[0]?.id;return;}this.node=Math.min(this.node,p.local.length-1);
  byId('floraPartName').textContent=p.name+' · '+(p.manual?'Edited':'Auto')+' · Point '+(this.node+1)+' / '+p.local.length;
  byId('floraDetach').hidden=!p.parent;byId('floraDetach').textContent=p.detached?'Attach':'Detach';byId('floraHidePart').textContent=l.flora.edits?.[p.id]?.hidden?'Show part':'Hide part';byId('floraHidePart').title=p.hidden&&!l.flora.edits?.[p.id]?.hidden?'Hidden with its parent. Show the parent or detach this part.':'';
  byId('floraDeletePoint').disabled=p.local.length<=3||this.protectedPoint();
  const colors=[{id:null,name:'Inherit',color:groupColor(e.tool.settings,l.group)},...['sky','terrain','depth','light'].map(id=>({id,name:id==='sky'?'Background':id[0].toUpperCase()+id.slice(1),color:e.tool.settings[id]})),...e.tool.settings.customColors.map(c=>({...c}))];
  const key=JSON.stringify([colors,p.group]);if(this.colorKey!==key){this.colorKey=key;const holder=byId('floraPartColors');holder.replaceChildren();for(const color of colors){const b=document.createElement('button');b.type='button';b.className='color-dot layer-color-swatch';b.style.background=color.color;b.setAttribute('role','radio');b.setAttribute('aria-label',color.name);b.setAttribute('aria-checked',String(p.group===color.id));b.title=color.name;b.addEventListener('click',()=>this.patch({group:color.id},'Part color'));holder.append(b);}}
  document.querySelectorAll('.flora-child').forEach(button=>{const selected=button.dataset.plantId===e.selected&&button.dataset.partId===this.partId;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('is-selected',selected);});
 }
 appendRows(list,layer){if(!layer.flora)return;const row=list.lastElementChild,b=document.createElement('button');b.className='flora-expand ui-icon-button';b.type='button';b.textContent=this.expanded.has(layer.id)?'▾':'▸';b.setAttribute('aria-label','Parts of '+layer.name);b.setAttribute('aria-expanded',String(this.expanded.has(layer.id)));b.addEventListener('click',()=>{if(this.expanded.has(layer.id))this.expanded.delete(layer.id);else this.expanded.add(layer.id);this.e.listKey='';this.e.sync();});row.prepend(b);
  if(!this.expanded.has(layer.id))return;const children=document.createElement('div');children.className='flora-children';for(const part of floraParts(layer,this.e.tool.settings)){const child=document.createElement('button');child.type='button';child.className='flora-child ui-list-row ui-list-select';child.dataset.partId=part.id;child.dataset.plantId=layer.id;child.setAttribute('aria-label','Edit '+part.name+' of '+layer.name);child.disabled=layer.locked||!layer.visible||layer.mode==='drawn';child.textContent=part.name;const state=document.createElement('span');state.textContent=part.hidden?'Hidden':part.manual?'Edited':'Auto';child.append(state);child.addEventListener('click',()=>this.select(layer.id,part.id));children.append(child);}list.append(children);
 }
 drawCenter(){
  if(!this.centerEditable())return;const e=this.e,l=e.layer(),s=e.tool.settings,t=e.tool.target,r=e.container.getBoundingClientRect(),center=this.center(),tip=center.part?.path[center.node];if(!tip)return;
  const p=localToCanvas([tip.x,tip.y],l,s.width/s.height),x=t.panX+p[0]*s.width*t.zoom,y=t.panY+p[1]*s.height*t.zoom;
  this.svg.removeAttribute('hidden');this.svg.setAttribute('viewBox','0 0 '+r.width+' '+r.height);this.svg.replaceChildren();
  const handle=svg('circle',{cx:x,cy:y,r:7,class:'flower-center','data-flower-center':'true','aria-label':'Move flower center'}),title=svg('title',{});title.textContent='Drag flower center';handle.append(title);this.svg.append(handle,svg('path',{d:'M'+(x-3)+' '+y+'h6 M'+x+' '+(y-3)+'v6',class:'flower-center-cross'}));
 }
 draw(){if(!this.editing){this.drawCenter();return;}this.e.overlay.hidden=true;const e=this.e,l=e.layer(),p=this.part();if(!p)return;const t=e.tool.target,s=e.tool.settings,r=e.container.getBoundingClientRect();this.svg.setAttribute('viewBox','0 0 '+r.width+' '+r.height);this.svg.replaceChildren();
  const at=q=>{const v=localToCanvas(q,l,s.width/s.height);return [t.panX+v[0]*s.width*t.zoom,t.panY+v[1]*s.height*t.zoom];};
  for(let i=0;i<p.path.length;i++){const [a,b,c,d]=vectorSegment(p.path,i).map(at),path='M'+a.join(' ')+' C'+b.join(' ')+' '+c.join(' ')+' '+d.join(' ');this.svg.append(svg('path',{d:path,class:'flora-part-path'}),svg('path',{d:path,class:'flora-part-hit','data-flora-segment':i}));}
  p.path.forEach((n,i)=>{const a=at([n.x,n.y]);if(i===this.node)for(const side of ['in','out']){const h=at(n[side]);this.svg.append(svg('line',{x1:a[0],y1:a[1],x2:h[0],y2:h[1],class:'vector-handle-line'}),svg('circle',{cx:h[0],cy:h[1],r:4,class:'vector-handle','data-flora-node':i,'data-flora-side':side}));}this.svg.append(svg('rect',{x:a[0]-5,y:a[1]-5,width:10,height:10,rx:n.smooth?3:0,class:'vector-anchor'+(i===this.node?' is-selected':'')+(i===0&&p.parent&&!p.detached?' flora-attachment':''),'data-flora-node':i,'data-flora-side':'anchor','aria-label':p.name+' point '+(i+1)}));});
 }
}
