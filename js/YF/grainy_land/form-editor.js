import { formSettingsKey, formEdit, editForm } from './document.js?v=form-edit-2';
import { createScene } from './scene.js?v=form-edit-2';
import { LandscapeRenderer } from './render.js?v=form-edit-2';

export function visibleBounds(map, selected) {
    let left=map.width, top=map.height, right=-1, bottom=-1;
    for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++) {
        if (map.ids[y*map.width+x] !== selected+1) continue;
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    return right<0 ? null : {left:left/map.width, top:top/map.height, right:(right+1)/map.width, bottom:(bottom+1)/map.height};
}
const names = ['Terrain','Bank 1','Basin','Bank 2','Fold','Foreground'];
const fields = {x:'formX',y:'formY',scaleX:'formWidth',scaleY:'formHeight'};
const clamp = (n, lo, hi) => Math.max(lo,Math.min(hi,n));

export function resizedForm(edit, width, height, center) {
    const scaleX=clamp(width,.25,3),scaleY=clamp(height,.25,3);
    return {scaleX,scaleY,
        x:center[0]-.5-(center[0]-.5-edit.x)*scaleX/edit.scaleX,
        y:center[1]-.5-(center[1]-.5-edit.y)*scaleY/edit.scaleY,locked:true};
}

export class FormEditor {
    constructor(tool, change) {
        this.tool=tool;this.change=change;this.active=false;this.selected=-1;
        this.gesture=null;this.space=false;this.map=null;this.mapKey='';
        this.abort=new AbortController();
        this.container=document.getElementById('canvasContainer');
        this.overlay=document.getElementById('formOverlay');
        this.controls=document.getElementById('formControls');
        this.mask=document.createElement('canvas');
        this.mode=tool.settings.mode;
    }
    init() {
        const on=(target,event,handler,opts={})=>target.addEventListener(event,handler,{...opts,signal:this.abort.signal});
        document.querySelectorAll('[data-form-index]').forEach(button=>on(button,'click',()=>this.select(Number(button.dataset.formIndex))));
        for (const [field,id] of Object.entries(fields)) {
            const input=document.getElementById(id);
            const apply=event=>{
                const value=Number(event.target.value)/100;
                if (this.selected<0 || !Number.isFinite(value) || event.target.value.trim()==='') { this.sync();return; }
                if(value===formEdit(this.tool.settings,this.selected)[field]) {this.sync();return;}
                let patch={[field]:value,locked:true};
                if(field==='scaleX'||field==='scaleY') {
                    this.refreshMap();
                    const edit=formEdit(this.tool.settings,this.selected),bounds=visibleBounds(this.map,this.selected);
                    const center=bounds?[(bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2]:[.5+edit.x,.5+edit.y];
                    patch=resizedForm(edit,field==='scaleX'?value:edit.scaleX,field==='scaleY'?value:edit.scaleY,center);
                }
                this.change(this.tool,editForm(this.tool.settings,this.selected,patch),'Transform form');
            };
            on(input,'change',apply);
            on(input,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply(event);}});
        }
        on(document.getElementById('formLock'),'click',()=>{
            if (this.selected<0) return;
            const edit=formEdit(this.tool.settings,this.selected);
            this.change(this.tool,editForm(this.tool.settings,this.selected,{locked:!edit.locked}),'Lock form');
        });
        on(document.getElementById('formReset'),'click',()=>{
            if (this.selected>=0) this.change(this.tool,editForm(this.tool.settings,this.selected,null),'Reset form');
        });
        on(this.container,'pointerdown',event=>this.start(event));
        on(this.container,'pointermove',event=>this.move(event));
        on(this.container,'pointerup',event=>this.finish(event));
        on(this.container,'pointercancel',()=>this.cancel());
        on(this.container,'lostpointercapture',()=>{ if(this.gesture)this.cancel(); });
        on(document,'keydown',event=>{
            const input=event.target.closest('input,select,textarea,[contenteditable="true"]');
            if(event.code==='Space'&&!input) this.space=true;
            if(event.key==='Escape'&&this.active) {
                event.preventDefault();
                if(this.gesture)this.cancel();else this.toggle(false);
            }
        });
        on(document,'keyup',event=>{if(event.code==='Space')this.space=false;});
        on(window,'blur',()=>{this.space=false;this.cancel();});
        on(this.container,'keydown',event=>{
            if(!this.active || this.selected<0 || event.metaKey || event.ctrlKey || event.altKey) return;
            const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
            if(!delta)return;
            event.preventDefault();
            const edit=formEdit(this.tool.settings,this.selected), step=event.shiftKey ? .01 : .001;
            this.change(this.tool,editForm(this.tool.settings,this.selected,{x:edit.x+delta[0]*step,y:edit.y+delta[1]*step,locked:true}),'Move form');
        });
        this.sync();return this;
    }
    toggle(value=!this.active) {
        this.cancel();this.active=value;
        this.container.classList.toggle('is-editing-forms',value);
        this.overlay.hidden=!value;this.controls.hidden=!value;
        document.getElementById('editFormsBtn').setAttribute('aria-pressed',String(value));
        document.getElementById('editFormsBtn').textContent=value?'Done editing':'Edit forms';
        if(value) this.container.focus({preventScroll:true});
        this.sync();this.tool.render();
    }
    select(index) {
        this.selected=index;this.sync();this.tool.render();
        this.container.focus({preventScroll:true});
    }
    sync() {
        const s=this.tool.settings;
        if(s.mode!==this.mode) {this.cancel();this.mode=s.mode;this.selected=-1;}
        const edits=s[formSettingsKey(s.mode)];
        document.querySelectorAll('[data-form-index]').forEach((button,i)=>{
            const label=s.mode==='abstract'?'Field '+(i+1):names[i];
            button.textContent=label+(edits?.[i]?.locked?' •':'');
            button.setAttribute('aria-pressed',String(i===this.selected));
            button.setAttribute('aria-label',label+(edits?.[i]?.locked?', locked':''));
        });
        document.getElementById('selectedFormControls').hidden=this.selected<0;
        if(this.selected<0)return;
        const edit=formEdit(s,this.selected);
        for(const [field,id] of Object.entries(fields)) document.getElementById(id).value=Number((edit[field]*100).toFixed(1));
        const lock=document.getElementById('formLock');
        lock.textContent=edit.locked?'Unlock':'Lock';lock.setAttribute('aria-pressed',String(edit.locked));
        document.getElementById('formReset').disabled=!edits?.[this.selected];
        document.getElementById('formSelectionNote').textContent=edit.locked
            ? 'Kept by Generate. Global controls still apply.' : 'Generate replaces unlocked forms. Moving or resizing locks this form.';
    }
    point(event) {
        const rect=this.container.getBoundingClientRect(), t=this.tool.target, s=this.tool.settings;
        return [(event.clientX-rect.left-t.panX)/(t.zoom*s.width),(event.clientY-rect.top-t.panY)/(t.zoom*s.height)];
    }
    refreshMap() {
        const s=this.tool.settings, key=JSON.stringify([createScene(s),s.width,s.height,s.softness,s.edgeVariation]);
        if(key===this.mapKey)return;
        this.picker ||= new LandscapeRenderer();
        const width=Math.max(64,Math.round(400*Math.min(1,s.width/s.height)));
        const height=Math.max(64,Math.round(400*Math.min(1,s.height/s.width)));
        this.map=this.picker.formMap(s,width,height);this.mapKey=key;
    }
    start(event) {
        if(!this.active || event.button!==0 || this.space || this.gesture)return;
        this.refreshMap();
        const point=this.point(event), t=this.tool.target, s=this.tool.settings;
        const nearHandle=this.handle && Math.hypot((point[0]-this.handle[0])*s.width*t.zoom,(point[1]-this.handle[1])*s.height*t.zoom)<14;
        if(!nearHandle) {
            const [x,y]=point;
            if(x<0||y<0||x>=1||y>=1)return;
            this.select(this.map.ids[Math.floor(y*this.map.height)*this.map.width+Math.floor(x*this.map.width)]-1);
        }
        if(this.selected<0)return;
        event.preventDefault();this.container.focus({preventScroll:true});
        const bounds=visibleBounds(this.map,this.selected);
        this.gesture={pointerId:event.pointerId,point,index:this.selected,snapshot:this.tool.getSnapshot(),
            edit:formEdit(s,this.selected),resize:!!nearHandle,
            center:bounds?[(bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2]:[.5,.5],started:false};
        this.container.setPointerCapture(event.pointerId);
    }
    move(event) {
        const g=this.gesture;
        if(!g||event.pointerId!==g.pointerId)return;
        const point=this.point(event), dx=point[0]-g.point[0],dy=point[1]-g.point[1];
        if(!g.started && Math.hypot(dx*this.tool.settings.width*this.tool.target.zoom,dy*this.tool.settings.height*this.tool.target.zoom)<3)return;
        event.preventDefault();
        if(!g.started) {this.tool.history.flush();this.tool.history.beginTransaction(g.resize?'Resize form':'Move form');g.started=true;}
        let patch={x:g.edit.x+dx,y:g.edit.y+dy,locked:true};
        if(g.resize) {
            const sx=g.edit.scaleX*(1+dx/Math.max(.02,g.point[0]-g.center[0]));
            const sy=g.edit.scaleY*(1+dy/Math.max(.02,g.point[1]-g.center[1]));
            patch=resizedForm(g.edit,sx,sy,g.center);
        }
        const next=editForm(g.snapshot,g.index,patch),key=formSettingsKey(this.tool.settings.mode);
        this.tool.settingsStore.set(key,next[key]);
    }
    finish(event) {
        const g=this.gesture;if(!g||event.pointerId!==g.pointerId)return;
        this.gesture=null;
        if(g.started)this.tool.history.endTransaction();
        if(this.container.hasPointerCapture(g.pointerId))this.container.releasePointerCapture(g.pointerId);
    }
    cancel() {
        const g=this.gesture;if(!g)return;
        this.gesture=null;
        if(g.started) {this.tool.applySnapshot(g.snapshot);this.tool.history.endTransaction();}
        if(this.container.hasPointerCapture(g.pointerId))this.container.releasePointerCapture(g.pointerId);
    }
    draw() {
        if(!this.active)return;
        this.refreshMap();
        const t=this.tool.target,s=this.tool.settings,dpr=t.dpr,rect=this.container.getBoundingClientRect();
        this.overlay.width=Math.round(rect.width*dpr);this.overlay.height=Math.round(rect.height*dpr);
        const ctx=this.overlay.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);this.handle=null;
        if(this.selected<0)return;
        const map=this.map,bounds=visibleBounds(map,this.selected);
        document.getElementById('formVisibilityNote').hidden=!!bounds;
        if(!bounds)return;
        this.mask.width=map.width;this.mask.height=map.height;
        const maskCtx=this.mask.getContext('2d'),data=maskCtx.createImageData(map.width,map.height),id=this.selected+1;
        for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
            const at=y*map.width+x;if(map.ids[at]!==id)continue;
            const edge=x===0||y===0||x===map.width-1||y===map.height-1||map.ids[at-1]!==id||map.ids[at+1]!==id||map.ids[at-map.width]!==id||map.ids[at+map.width]!==id;
            data.data.set([255,255,255,edge?220:24],at*4);
        }
        maskCtx.putImageData(data,0,0);
        const w=s.width*t.zoom,h=s.height*t.zoom;
        ctx.drawImage(this.mask,t.panX,t.panY,w,h);
        const x=t.panX+bounds.left*w,y=t.panY+bounds.top*h,bw=(bounds.right-bounds.left)*w,bh=(bounds.bottom-bounds.top)*h;
        ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(x,y,bw,bh);ctx.setLineDash([]);
        // Keep the resize handle inside the artboard and viewport for edge-touching forms.
        const hx=clamp(x+bw-7,7,rect.width-7),hy=clamp(y+bh-7,7,rect.height-7);
        ctx.fillStyle='#FFF';ctx.fillRect(hx-5,hy-5,10,10);ctx.strokeStyle='#111';ctx.strokeRect(hx-5,hy-5,10,10);
        this.handle=[(hx-t.panX)/w,(hy-t.panY)/h];
    }
    destroy() {this.cancel();this.abort.abort();this.picker?.destroy();}
}
