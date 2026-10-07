import { localPaintPoint } from './paint.js?v=vector-1';
import { getLayers, editLayer, layerSettingsKey } from './layers.js?v=vector-1';
import { moveVectorNode, toggleVectorNode, splitVectorSegment, removeVectorNode, vectorSegment, cubicPoint, MAX_VECTOR_NODES } from './vector-path.js?v=vector-1';
const byId=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const svgNode=(name,attrs)=>{const n=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
export class VectorEditor {
    constructor(editor){this.editor=editor;this.editing=false;this.selected=0;this.layerId=null;this.drag=null;}
    init() {
        const e=this.editor,on=(target,event,handler,capture=false)=>target.addEventListener(event,handler,{signal:e.abort.signal,capture});
        this.svg=byId('vectorOverlay');
        on(byId('editVectorPath'),'click',()=>this.setEditing(!this.editing));
        on(byId('toggleVectorPoint'),'click',()=>this.togglePoint());
        on(byId('deleteVectorPoint'),'click',()=>this.deletePoint());
        on(e.container,'pointerdown',event=>{
            const layer=e.layer();if(!this.editing||!layer||layer.locked||e.space||event.button!==0)return;
            const control=event.target.closest('[data-vector-node]'),segment=event.target.closest('[data-vector-segment]');
            if(!control&&!segment)return;
            event.preventDefault();event.stopImmediatePropagation();e.container.focus({preventScroll:true});
            if(!control)return;
            this.selected=Number(control.dataset.vectorNode);this.sync();
            this.svg.querySelectorAll('.vector-anchor').forEach(n=>n.classList.toggle('is-selected',Number(n.dataset.vectorNode)===this.selected));
            const key=control.dataset.vectorNode+':'+control.dataset.vectorSide,now=event.timeStamp;
            // Pointer capture retargets click/dblclick to the container, so detect
            // a second press on the same control as Sparky's editor does.
            if(this.lastPress?.key===key&&now-this.lastPress.time<350){this.lastPress=null;this.togglePoint();return;}
            this.lastPress={key,time:now};
            this.drag={pointerId:event.pointerId,index:this.selected,side:control.dataset.vectorSide,snapshot:e.tool.getSnapshot(),layer,origin:e.point(event),started:false};
            e.container.setPointerCapture(event.pointerId);
        },true);
        on(e.container,'pointermove',event=>{
            const g=this.drag;if(!g||g.pointerId!==event.pointerId)return;
            event.preventDefault();event.stopImmediatePropagation();
            if(!g.started&&!e.moved(e.point(event),{point:g.origin}))return;
            if(!g.started){this.lastPress=null;e.tool.history.flush();e.tool.history.beginTransaction('Edit vector point');g.started=true;}
            const p=localPaintPoint(e.point(event),g.layer),path=moveVectorNode(g.layer.vectorPath,g.index,p,g.side,event.altKey);
            const next=editLayer(g.snapshot,g.layer.id,{vectorPath:path}),key=layerSettingsKey(g.snapshot.mode);e.tool.settingsStore.set(key,next[key]);
        },true);
        on(e.container,'pointerup',event=>{if(this.drag?.pointerId===event.pointerId){event.preventDefault();event.stopImmediatePropagation();this.finish();}},true);
        on(e.container,'pointercancel',()=>this.cancel(),true);
        on(e.container,'lostpointercapture',()=>this.cancel(),true);
        on(window,'blur',()=>this.cancel());
        on(e.container,'dblclick',event=>{
            const node=event.target.closest('[data-vector-node]'),segment=event.target.closest('[data-vector-segment]');
            if(!node&&!segment){this.openAt(event);return;}
            if(!this.editing||e.layer()?.locked)return;
            event.preventDefault();event.stopImmediatePropagation();
            if(node)return;
            const layer=e.layer();if(layer.vectorPath.length>=MAX_VECTOR_NODES){e.report('Maximum '+MAX_VECTOR_NODES+' points per vector shape.');return;}
            const index=Number(segment.dataset.vectorSegment),curve=vectorSegment(layer.vectorPath,index),p=localPaintPoint(e.point(event),layer),s=e.tool.settings;
            let best=.5,d=Infinity;for(let i=1;i<100;i++){const t=i/100,q=cubicPoint(curve,t),distance=((q[0]-p[0])*s.width*layer.scaleX)**2+((q[1]-p[1])*s.height*layer.scaleY)**2;if(distance<d){d=distance;best=t;}}
            this.selected=index+1;e.commit({vectorPath:splitVectorSegment(layer.vectorPath,index,best)},'Add vector point');
        },true);
        on(document,'keydown',event=>{
            if(!this.editing||event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
            if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(this.drag)this.cancel();else this.setEditing(false);return;}
            if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&this.drag){event.preventDefault();event.stopImmediatePropagation();this.cancel();return;}
            if(this.drag){event.preventDefault();event.stopImmediatePropagation();return;}
            if(!e.container.contains(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;
            if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();this.deletePoint();return;}
            if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
                event.preventDefault();event.stopImmediatePropagation();const layer=e.layer();if(!layer||layer.locked||this.drag)return;
                const n=layer.vectorPath[this.selected],step=event.shiftKey?10:1,s=e.tool.settings;
                const dx=(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0)*step/s.width/layer.scaleX;
                const dy=(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0)*step/s.height/layer.scaleY;
                e.commit({vectorPath:moveVectorNode(layer.vectorPath,this.selected,[n.x+dx,n.y+dy])},'Move vector point');
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
        e.select(id);this.setEditing(true);
    }
    setEditing(value) {
        this.cancel();this.lastPress=null;const e=this.editor;e.cancel();this.editing=!!value&&e.layer()?.mode==='vector'&&!e.layer().locked&&e.layer().visible;
        if(this.editing){e.paintTool='move';this.layerId=e.selected;}
        e.sync();e.tool.render();e.container.focus({preventScroll:true});
    }
    togglePoint(){const e=this.editor,l=e.layer();if(!l||l.locked||!this.editing)return;e.commit({vectorPath:toggleVectorNode(l.vectorPath,this.selected)},'Toggle vector handles');}
    deletePoint(){const e=this.editor,l=e.layer();if(!l||l.locked||!this.editing||this.drag)return;if(l.vectorPath.length<=3){e.report('A closed shape needs at least three points.');return;}const path=removeVectorNode(l.vectorPath,this.selected);this.selected=Math.min(this.selected,path.length-1);e.commit({vectorPath:path},'Delete vector point');}
    finish(){const g=this.drag;if(!g)return;this.drag=null;if(g.started)this.editor.tool.history.endTransaction();if(this.editor.container.hasPointerCapture(g.pointerId))this.editor.container.releasePointerCapture(g.pointerId);}
    cancel(){const g=this.drag;if(!g)return;this.drag=null;if(g.started){this.editor.tool.applySnapshot(g.snapshot);this.editor.tool.history.endTransaction();}if(this.editor.container.hasPointerCapture(g.pointerId))this.editor.container.releasePointerCapture(g.pointerId);}
    sync(){
        const e=this.editor,l=e.layer(),vector=l?.mode==='vector';
        if(!vector||l.id!==this.layerId||l.locked||!l.visible)this.editing=false;
        this.layerId=l?.id??null;this.selected=Math.min(this.selected,(l?.vectorPath?.length??1)-1);
        byId('vectorControls').hidden=!vector;byId('vectorPointControls').hidden=!this.editing;
        byId('editVectorPath').textContent=this.editing?'Done editing':'Edit path';byId('editVectorPath').setAttribute('aria-pressed',String(this.editing));
        byId('editVectorPath').disabled=!vector||l.locked||!l.visible;
        byId('vectorPointLabel').textContent=this.editing?'Point '+(this.selected+1)+' / '+l.vectorPath.length:'';
        byId('toggleVectorPoint').textContent=l?.vectorPath?.[this.selected]?.smooth?'Make corner':'Make smooth';
        byId('deleteVectorPoint').disabled=!vector||l.vectorPath.length<=3;
        this.svg.toggleAttribute('hidden',!this.editing);e.overlay.hidden=!e.active||this.editing;
        if(!this.editing)this.svg.replaceChildren();
    }
    draw(){
        this.sync();if(!this.editing)return;byId('formVisibilityNote').hidden=true;
        const e=this.editor,l=e.layer(),t=e.tool.target,s=e.tool.settings,rect=e.container.getBoundingClientRect();
        this.svg.setAttribute('viewBox','0 0 '+rect.width+' '+rect.height);this.svg.replaceChildren();
        const screen=p=>[t.panX+(.5+l.x+(p[0]-.5)*l.scaleX)*s.width*t.zoom,t.panY+(.5+l.y+(p[1]-.5)*l.scaleY)*s.height*t.zoom];
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
        l.vectorPath.forEach((n,i)=>{const a=screen([n.x,n.y]);this.svg.append(svgNode('rect',{x:a[0]-5,y:a[1]-5,width:10,height:10,rx:n.smooth?3:0,class:'vector-anchor'+(i===this.selected?' is-selected':''),'data-vector-node':i,'data-vector-side':'anchor','aria-label':'Vector point '+(i+1)}));});
    }
}
