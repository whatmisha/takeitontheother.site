import { localToCanvas } from './transforms.js?v=studio-1';
import { localPaintPoint } from './paint.js?v=studio-1';
import { getLayers, addLayer, editLayer, layerSettingsKey } from './layers.js?v=studio-1';
import { moveVectorNode, toggleVectorNode, splitVectorSegment, removeVectorNode, vectorSegment, cubicPoint, MAX_VECTOR_NODES } from './vector-path.js?v=studio-1';
const byId=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const svgNode=(name,attrs)=>{const n=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
export class VectorEditor {
    constructor(editor){this.editor=editor;this.editing=false;this.selected=0;this.layerId=null;this.drag=null;this.nodes=new Set([0]);this.pen=null;}
    init() {
        const e=this.editor,on=(target,event,handler,capture=false)=>target.addEventListener(event,handler,{signal:e.abort.signal,capture});
        this.svg=byId('vectorOverlay');
        on(byId('penTool'),'click',()=>this.startPen());
        on(byId('editVectorPath'),'click',()=>this.setEditing(!this.editing));
        on(byId('toggleVectorPoint'),'click',()=>this.togglePoint());
        on(byId('deleteVectorPoint'),'click',()=>this.deletePoint());
        on(e.container,'pointerdown',event=>{
            if(this.pen){this.penDown(event);return;}
            const layer=e.layer();if(!this.editing||!layer||layer.locked||e.space||event.button!==0)return;
            const control=event.target.closest('[data-vector-node]'),segment=event.target.closest('[data-vector-segment]');
            if(!control&&!segment)return;
            event.preventDefault();event.stopImmediatePropagation();e.container.focus({preventScroll:true});
            if(!control)return;
            this.selected=Number(control.dataset.vectorNode);
            if(event.shiftKey){if(this.nodes.has(this.selected))this.nodes.delete(this.selected);else this.nodes.add(this.selected);if(!this.nodes.size)this.nodes.add(this.selected);}
            else if(!this.nodes.has(this.selected))this.nodes=new Set([this.selected]);
            this.sync();
            this.svg.querySelectorAll('.vector-anchor').forEach(n=>n.classList.toggle('is-selected',this.nodes.has(Number(n.dataset.vectorNode))));
            const key=control.dataset.vectorNode+':'+control.dataset.vectorSide,now=event.timeStamp;
            // Pointer capture retargets click/dblclick to the container, so detect
            // a second press on the same control as Sparky's editor does.
            if(this.lastPress?.key===key&&now-this.lastPress.time<350){this.lastPress=null;this.togglePoint();return;}
            this.lastPress={key,time:now};
            this.drag={pointerId:event.pointerId,index:this.selected,side:control.dataset.vectorSide,snapshot:e.tool.getSnapshot(),layer,origin:e.point(event),started:false};
            e.container.setPointerCapture(event.pointerId);
        },true);
        on(e.container,'pointermove',event=>{
            if(this.penDrag){const p=e.point(event),n=this.pen[this.penDrag.index];n.out=p;n.in=[2*n.x-p[0],2*n.y-p[1]];n.smooth=true;e.tool.render();event.preventDefault();event.stopImmediatePropagation();return;}
            const g=this.drag;if(!g||g.pointerId!==event.pointerId)return;
            event.preventDefault();event.stopImmediatePropagation();
            if(!g.started&&!e.moved(e.point(event),{point:g.origin}))return;
            if(!g.started){this.lastPress=null;e.tool.history.flush();e.tool.history.beginTransaction('Edit vector point');g.started=true;}
            const p=localPaintPoint(e.point(event),g.layer,e.tool.settings.width/e.tool.settings.height);let path=g.layer.vectorPath;
            const indices=g.side==='anchor'?[...this.nodes]:[g.index],base=path[g.index];
            for(const index of indices){const n=g.layer.vectorPath[index];path=moveVectorNode(path,index,g.side==='anchor'?[n.x+p[0]-base.x,n.y+p[1]-base.y]:p,g.side,event.altKey);}
            const next=editLayer(g.snapshot,g.layer.id,{vectorPath:path}),key=layerSettingsKey(g.snapshot.mode);e.tool.settingsStore.set(key,next[key]);
        },true);
        on(e.container,'pointerup',event=>{if(this.penDrag){this.penDrag=null;if(e.container.hasPointerCapture(event.pointerId))e.container.releasePointerCapture(event.pointerId);event.preventDefault();event.stopImmediatePropagation();return;}if(this.drag?.pointerId===event.pointerId){event.preventDefault();event.stopImmediatePropagation();this.finish();}},true);
        on(e.container,'pointercancel',()=>this.cancel(),true);
        on(e.container,'lostpointercapture',()=>this.cancel(),true);
        on(window,'blur',()=>this.cancel());
        on(e.container,'dblclick',event=>{
            if(this.pen){event.preventDefault();event.stopImmediatePropagation();this.finishPen();return;}
            const node=event.target.closest('[data-vector-node]'),segment=event.target.closest('[data-vector-segment]');
            if(!node&&!segment){this.openAt(event);return;}
            if(!this.editing||e.layer()?.locked)return;
            event.preventDefault();event.stopImmediatePropagation();
            if(node)return;
            const layer=e.layer();if(layer.vectorPath.length>=MAX_VECTOR_NODES){e.report('Maximum '+MAX_VECTOR_NODES+' points per vector shape.');return;}
            const index=Number(segment.dataset.vectorSegment),curve=vectorSegment(layer.vectorPath,index),p=localPaintPoint(e.point(event),layer,e.tool.settings.width/e.tool.settings.height),s=e.tool.settings;
            let best=.5,d=Infinity;for(let i=1;i<100;i++){const t=i/100,q=cubicPoint(curve,t),distance=((q[0]-p[0])*s.width*layer.scaleX)**2+((q[1]-p[1])*s.height*layer.scaleY)**2;if(distance<d){d=distance;best=t;}}
            this.selected=index+1;this.nodes=new Set([this.selected]);e.commit({vectorPath:splitVectorSegment(layer.vectorPath,index,best)},'Add vector point');
        },true);
        on(document,'keydown',event=>{
            if((!this.editing&&!this.pen)||event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
            if(this.pen){if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();this.finishPen();}if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.stopPen();}return;}
            if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(this.drag)this.cancel();else this.setEditing(false);return;}
            if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&this.drag){event.preventDefault();event.stopImmediatePropagation();this.cancel();return;}
            if(this.drag){event.preventDefault();event.stopImmediatePropagation();return;}
            if(!e.container.contains(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;
            if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();this.deletePoint();return;}
            if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
                event.preventDefault();event.stopImmediatePropagation();const layer=e.layer();if(!layer||layer.locked||this.drag)return;
                const n=layer.vectorPath[this.selected],step=event.shiftKey?10:1,s=e.tool.settings;
                const world=localToCanvas([n.x,n.y],layer,s.width/s.height),local=localPaintPoint([world[0]+(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0)*step/s.width,world[1]+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0)*step/s.height],layer,s.width/s.height),dx=local[0]-n.x,dy=local[1]-n.y;
                let path=layer.vectorPath;for(const i of this.nodes){const node=layer.vectorPath[i];path=moveVectorNode(path,i,[node.x+dx,node.y+dy]);}e.commit({vectorPath:path},'Move vector points');
            }
        },true);
        return this;
    }
    openAt(event) {
        const e=this.editor;if(event.button!==0||e.space||this.drag)return;
        const id=e.hit(e.point(event)),layer=getLayers(e.tool.settings).find(l=>l.id===id);
        if(layer?.mode!=='vector'||layer.locked||!layer.visible)return;
        event.preventDefault();event.stopImmediatePropagation();
        if(this.editing&&e.selected===id)return;
        e.select(id,{individual:true});this.setEditing(true);
    }
    setEditing(value) {
        this.cancel();this.lastPress=null;const e=this.editor;e.cancel();if(value&&e.selection().length>1)e.select(e.selected,{individual:true});this.editing=!!value&&e.layer()?.mode==='vector'&&!e.layer().locked&&e.layer().visible;
        if(this.editing){e.paintTool='move';this.layerId=e.selected;}
        e.sync();e.tool.render();e.container.focus({preventScroll:true});
    }
    togglePoint(){const e=this.editor,l=e.layer();if(!l||l.locked||!this.editing)return;let path=l.vectorPath;for(const i of this.nodes)path=toggleVectorNode(path,i);e.commit({vectorPath:path},'Toggle vector handles');}
    deletePoint(){const e=this.editor,l=e.layer();if(!l||l.locked||!this.editing||this.drag)return;if(l.vectorPath.length-this.nodes.size<3){e.report('A closed shape needs at least three points.');return;}const path=l.vectorPath.filter((_,i)=>!this.nodes.has(i));this.selected=Math.min(this.selected,path.length-1);this.nodes=new Set([this.selected]);e.commit({vectorPath:path},'Delete vector points');}
    startPen(){const e=this.editor;this.stopPen();this.setEditing(false);e.select(null);e.paintTool='move';this.pen=[];this.penPress=null;byId('penTool').setAttribute('aria-pressed','true');document.querySelectorAll('[data-form-tool]').forEach(b=>b.setAttribute('aria-pressed','false'));e.report('Pen: click for a corner, drag for a smooth point. Click the first point or Enter to close. Esc cancels.');e.tool.render();e.container.focus({preventScroll:true});}
    stopPen(){this.cancelPenDrag();this.pen=null;this.penPress=null;byId('penTool').setAttribute('aria-pressed','false');this.editor.report();this.editor.tool.render();}
    penDown(event){
        const e=this.editor;if(event.button!==0||e.space)return;event.preventDefault();event.stopImmediatePropagation();e.container.focus({preventScroll:true});const p=e.point(event);
        if(p.some(v=>v<0||v>1))return;
        const first=this.pen[0],close=first&&Math.hypot((p[0]-first.x)*e.tool.settings.width*e.tool.target.zoom,(p[1]-first.y)*e.tool.settings.height*e.tool.target.zoom)<12;
        if((close&&this.pen.length>=3)||(this.penPress&&event.timeStamp-this.penPress.time<350&&Math.hypot(event.clientX-this.penPress.x,event.clientY-this.penPress.y)<6)){this.finishPen();return;}
        if(this.pen.length>=MAX_VECTOR_NODES){e.report('Maximum '+MAX_VECTOR_NODES+' points. Press Enter to close.');return;}
        this.penPress={time:event.timeStamp,x:event.clientX,y:event.clientY};this.pen.push({x:p[0],y:p[1],in:p.slice(),out:p.slice(),smooth:false});this.penDrag={index:this.pen.length-1,pointerId:event.pointerId};e.container.setPointerCapture(event.pointerId);e.tool.render();
    }
    finishPen(){const e=this.editor;if(!this.pen||this.pen.length<3){e.report('Add at least three points.');return;}try{const added=addLayer(e.tool.settings,'vector'),settings=editLayer(added.settings,added.id,{vectorPath:this.pen});this.cancelPenDrag();this.pen=null;e.change(e.tool,settings,'Draw vector path');e.select(added.id,{individual:true});this.nodes=new Set([0]);this.selected=0;this.setEditing(true);e.report();}catch(error){e.report(error.message);}}
    drawPen(){const e=this.editor,t=e.tool.target,s=e.tool.settings,r=e.container.getBoundingClientRect();this.svg.toggleAttribute('hidden',false);e.overlay.hidden=true;this.svg.setAttribute('viewBox','0 0 '+r.width+' '+r.height);this.svg.replaceChildren();const at=p=>[t.panX+p[0]*s.width*t.zoom,t.panY+p[1]*s.height*t.zoom];
        this.pen.forEach((n,i)=>{const a=at([n.x,n.y]);if(i){const prev=this.pen[i-1],b=at([prev.x,prev.y]),c=at(prev.out),d=at(n.in);this.svg.append(svgNode('path',{class:'vector-contour',d:'M'+b.join(' ')+' C'+c.join(' ')+' '+d.join(' ')+' '+a.join(' ')}));}this.svg.append(svgNode('rect',{x:a[0]-4,y:a[1]-4,width:8,height:8,class:'vector-anchor','data-pen-node':i}));});
    }
    finish(){const g=this.drag;if(!g)return;this.drag=null;if(g.started)this.editor.tool.history.endTransaction();if(this.editor.container.hasPointerCapture(g.pointerId))this.editor.container.releasePointerCapture(g.pointerId);}
    cancelPenDrag(){const g=this.penDrag;this.penDrag=null;if(g&&this.editor.container.hasPointerCapture(g.pointerId))this.editor.container.releasePointerCapture(g.pointerId);}
    cancel(){this.cancelPenDrag();const g=this.drag;if(!g)return;this.drag=null;if(g.started){this.editor.tool.applySnapshot(g.snapshot);this.editor.tool.history.endTransaction();}if(this.editor.container.hasPointerCapture(g.pointerId))this.editor.container.releasePointerCapture(g.pointerId);}
    sync(){
        const e=this.editor,l=e.layer(),vector=l?.mode==='vector';
        if(!vector||l.id!==this.layerId||l.locked||!l.visible)this.editing=false;
        if(l?.id!==this.layerId)this.nodes=new Set([0]);
        this.layerId=l?.id??null;this.selected=Math.min(this.selected,(l?.vectorPath?.length??1)-1);
        this.nodes=new Set([...this.nodes].filter(i=>i<(l?.vectorPath?.length??0)));if(!this.nodes.size)this.nodes.add(0);
        byId('penTool').setAttribute('aria-pressed',String(!!this.pen));
        byId('vectorControls').hidden=!vector;byId('vectorPointControls').hidden=!this.editing;
        byId('editVectorPath').textContent=this.editing?'Done editing':'Edit path';byId('editVectorPath').setAttribute('aria-pressed',String(this.editing));
        byId('editVectorPath').disabled=!vector||l.locked||!l.visible;
        byId('vectorPointLabel').textContent=this.editing?(this.nodes.size>1?this.nodes.size+' points selected':'Point '+(this.selected+1)+' / '+l.vectorPath.length):'';
        byId('toggleVectorPoint').textContent=l?.vectorPath?.[this.selected]?.smooth?'Make corner':'Make smooth';
        byId('deleteVectorPoint').disabled=!vector||l.vectorPath.length-this.nodes.size<3;
        this.svg.toggleAttribute('hidden',!this.editing);e.overlay.hidden=!e.active||this.editing;
        if(!this.editing)this.svg.replaceChildren();
    }
    draw(){
        if(this.pen){this.drawPen();return;}this.sync();if(!this.editing)return;byId('formVisibilityNote').hidden=true;
        const e=this.editor,l=e.layer(),t=e.tool.target,s=e.tool.settings,rect=e.container.getBoundingClientRect();
        this.svg.setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);this.svg.replaceChildren();
        const screen=p=>{const q=localToCanvas(p,l,s.width/s.height);return [t.panX+q[0]*s.width*t.zoom,t.panY+q[1]*s.height*t.zoom];};
        l.vectorPath.forEach((n,i)=>{
            const [a,b,c,d]=vectorSegment(l.vectorPath,i).map(screen),data='M'+a.join(' ')+' C'+b.join(' ')+' '+c.join(' ')+' '+d.join(' ');
            this.svg.append(svgNode('path',{d:data,class:'vector-contour'}),svgNode('path',{d:data,class:'vector-segment-hit','data-vector-segment':i}));
        });
        l.vectorPath.forEach((n,i)=>{
            const a=screen([n.x,n.y]);
            for(const side of ['in','out'])if(Math.hypot(n[side][0]-n.x,n[side][1]-n.y)>1e-7){
                const h=screen(n[side]);this.svg.append(svgNode('line',{x1:a[0],y1:a[1],x2:h[0],y2:h[1],class:'vector-handle-line'}));
                this.svg.append(svgNode('circle',{cx:h[0],cy:h[1],r:4,class:'vector-handle','data-vector-node':i,'data-vector-side':side,'aria-label':'Point '+(i+1)+' '+side+' handle'}));
            }
        });
        l.vectorPath.forEach((n,i)=>{const a=screen([n.x,n.y]);this.svg.append(svgNode('rect',{x:a[0]-5,y:a[1]-5,width:10,height:10,rx:n.smooth?3:0,class:'vector-anchor'+(this.nodes.has(i)?' is-selected':''),'data-vector-node':i,'data-vector-side':'anchor','aria-label':'Vector point '+(i+1)}));});
    }
}
