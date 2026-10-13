import {getLayers} from './layer-data.js?v=petal-motion-1';

export function hoverPixels({width,height,ids},background=false) {
    const pixels=new Uint8ClampedArray(width*height*4),inside=at=>background?ids[at]===0:ids[at]!==0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const at=y*width+x;if(!inside(at))continue;
        const edge=x===0||y===0||x===width-1||y===height-1||!inside(at-1)||!inside(at+1)||!inside(at-width)||!inside(at+width);
        pixels.set([255,255,255,edge?210:24],at*4);
    }
    return pixels;
}

// Transient canvas feedback is separate from selection, geometry editing and exports.
export class LayerHover {
    constructor(editor) {
        this.editor=editor;this.id=null;this.mode=editor.tool.settings.mode;this.key='';
        this.canvas=document.getElementById('layerHoverOverlay');this.mask=document.createElement('canvas');
        this.abort=new AbortController();const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:this.abort.signal});
        const list=document.getElementById('layerList'),background=document.getElementById('backgroundLayer').closest('.background-row');
        on(list,'pointermove',event=>{
            if(event.pointerType==='touch'||event.buttons)return;
            this.pointer=[event.clientX,event.clientY];this.set(event.target.closest('[data-layer-id]')?.dataset.layerId??null);
        });
        on(list,'pointerleave',()=>{this.pointer=null;this.set(null);});
        on(list,'pointerdown',()=>this.set(null));
        on(list,'scroll',()=>{
            if(!this.pointer)return;const element=document.elementFromPoint(...this.pointer);
            this.set(list.contains(element)?element.closest('[data-layer-id]')?.dataset.layerId??null:null);
        });
        on(background,'pointerenter',event=>{if(event.pointerType!=='touch')this.set('background');});
        on(background,'pointerleave',()=>this.set(null));
        on(window,'blur',()=>this.set(null));
    }
    set(id) {
        if(this.id===id)return;this.id=id;this.key='';this.draw();
    }
    draw(settings=this.editor.tool.settings) {
        const e=this.editor,s=settings;
        if(this.mode!==s.mode){this.mode=s.mode;this.id=null;this.key='';}
        const stack=getLayers(s),index=stack.findIndex(l=>l.id===this.id),background=this.id==='background';
        const shown=this.id!=null&&(background?s.backgroundVisible:index>=0&&stack[index].visible)&&!e.gesture&&!e.reorderGesture;
        this.canvas.hidden=!shown;this.canvas.dataset.layerId=shown?this.id:'';if(!shown)return;
        const t=e.tool.target,rect=e.container.getBoundingClientRect(),width=Math.max(64,Math.round(640*Math.min(1,s.width/s.height))),height=Math.max(64,Math.round(640*Math.min(1,s.height/s.width)));
        const key=JSON.stringify([this.id,s]);
        if(key!==this.key){
            const map=e.hoverMap(s,width,height,background?null:index);
            this.mask.width=width;this.mask.height=height;
            const ctx=this.mask.getContext('2d'),image=ctx.createImageData(width,height);image.data.set(hoverPixels(map,background));ctx.putImageData(image,0,0);this.key=key;
        }
        this.canvas.width=Math.round(rect.width*t.dpr);this.canvas.height=Math.round(rect.height*t.dpr);
        const ctx=this.canvas.getContext('2d');ctx.setTransform(t.dpr,0,0,t.dpr,0,0);
        ctx.drawImage(this.mask,t.panX,t.panY,s.width*t.zoom,s.height*t.zoom);
    }
    destroy(){this.abort.abort();this.canvas.hidden=true;this.id=null;this.key='';}
}
