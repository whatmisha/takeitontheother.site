import { editSelection, duplicateSelection, reorderSelection, resizeSelection } from './selection.js?v=studio-1';
import { localToCanvas, canvasToLocal, materialRanges } from './transforms.js?v=studio-1';
import { VectorEditor } from './vector-editor.js?v=studio-1';
import { groupColor } from './custom-colors.js?v=studio-1';
import { brushStroke, localPaintPoint, strokePointCount, MAX_STROKES, MAX_STROKE_POINTS, MAX_FORM_POINTS } from './paint.js?v=studio-1';
import { getLayers, withLayers, layerSettingsKey, MAX_LAYERS, editLayer, addLayer, addBlueLayers, duplicateLayer, removeLayer, reorderLayer, convertLayer } from './layers.js?v=studio-1';
import { createLayerScene } from './scene.js?v=studio-1';
import { LandscapeRenderer } from './render.js?v=studio-1';

export function visibleBounds(map, selected) {
    let left=map.width,top=map.height,right=-1,bottom=-1;
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
        if(map.ids[y*map.width+x]!==selected+1)continue;
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    return right<0?null:{left:left/map.width,top:top/map.height,right:(right+1)/map.width,bottom:(bottom+1)/map.height};
}
const fields={x:'formX',y:'formY',scaleX:'formWidth',scaleY:'formHeight'};
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const byId=id=>document.getElementById(id);
const icons={
    eye:'<path d="M1 8s2-5 7-5 7 5 7 5-2 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2"/>',
    pin:'<path d="m5 2 6 0-1 4 3 3H9v5L7 12V9H3l3-3-1-4Z"/>',
    lock:'<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>'
};
const icon=key=>'<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">'+icons[key]+'</svg>';
export function resizedForm(edit,width,height,center,aspect=1) {
    const scaleX=clamp(width,.25,3),scaleY=clamp(height,.25,3),point=canvasToLocal(center,edit,aspect);
    const moved=localToCanvas(point,{...edit,scaleX,scaleY},aspect);
    return {scaleX,scaleY,x:edit.x+center[0]-moved[0],y:edit.y+center[1]-moved[1]};
}
export class FormEditor {
    constructor(tool,change) {
        this.tool=tool;this.change=change;this.active=false;this.selected=null;this.gesture=null;this.space=false;
        this.map=null;this.mapKey='';this.listKey='';this.thumbs=new Map();this.paintTool='move';this.brushSize=18;
        this.abort=new AbortController();this.container=byId('canvasContainer');this.overlay=byId('formOverlay');
        this.cursor=byId('brushCursor');this.mask=document.createElement('canvas');this.mode=tool.settings.mode;
    }
    layer(){return getLayers(this.tool.settings).find(l=>l.id===this.selected);}
    index(){return getLayers(this.tool.settings).findIndex(l=>l.id===this.selected);}
    selection(){return this.selectedIds?.size?[...this.selectedIds]:this.selected?[this.selected]:[];}
    commit(patch,label,manual=false){this.change(this.tool,editSelection(this.tool.settings,this.selection(),patch,this.selected),label);}
    report(message=''){byId('paintStatus').textContent=message;}
    init() {
        this.selectedIds=new Set();this.vector=new VectorEditor(this).init();
        const on=(target,event,handler,opts={})=>target.addEventListener(event,handler,{...opts,signal:this.abort.signal});
        for(const mode of ['drawn','auto'])on(byId(mode==='drawn'?'newDrawnLayer':'newAutoLayer'),'click',()=>{
            try {const result=addLayer(this.tool.settings,mode);this.change(this.tool,result.settings,'Add layer');this.select(result.id);this.setTool(mode==='drawn'?'paint':'move');}
            catch(error){this.report(error.message);}
        });
        on(byId('newBlueLayers'),'click',()=>{
            try {const result=addBlueLayers(this.tool.settings);this.change(this.tool,result.settings,'Add blue layers');this.select(result.id);this.setTool('move');}
            catch(error){this.report(error.message);}
        });
        on(byId('newVectorLayer'),'click',()=>{try{const result=addLayer(this.tool.settings,'vector');this.change(this.tool,result.settings,'Add vector layer');this.select(result.id);this.vector.setEditing(true);}catch(error){this.report(error.message);}});
        on(byId('layerDuplicate'),'click',()=>this.duplicateSelected());
        on(byId('layerDelete'),'click',()=>this.deleteSelected());
        on(byId('layerConvert'),'click',()=>{this.change(this.tool,this.selection().reduce((s,id)=>getLayers(s).find(l=>l.id===id)?.locked?s:convertLayer(s,id),this.tool.settings),'Convert to drawn');this.report('Silhouette preserved. Generation controls no longer change its shape.');});
        on(byId('backgroundLayer'),'click',()=>{
            this.select(null);
            byId('materialPanel').querySelector('.panel-content').scrollTop=0;
            if(byId('materialPanel').classList.contains('panel-collapsed'))byId('materialPanelHeader').querySelector('.collapse-icon').click();
            byId('skyColorPreview').click();byId('skyColorPreview').scrollIntoView({block:'nearest'});
        });
        const colorSwatches=byId('layerColorSwatches');
        on(colorSwatches,'click',e=>{
            const button=e.target.closest('[data-color-group]'),layer=this.layer();
            if(button&&layer&&!layer.locked&&layer.group!==button.dataset.colorGroup)this.commit({group:button.dataset.colorGroup},'Layer color group');
        });
        on(colorSwatches,'keydown',e=>{
            // Keep Space on a swatch from activating canvas panning.
            if(e.key===' '||e.key==='Enter'){e.stopPropagation();return;}
            if(e.altKey||e.ctrlKey||e.metaKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
            const buttons=[...colorSwatches.querySelectorAll('[data-color-group]')],index=buttons.indexOf(e.target);
            if(index<0||this.layer()?.locked)return;
            e.preventDefault();e.stopPropagation();
            const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+buttons.length)%buttons.length;
            buttons[next].click();buttons[next].focus();
        });
        on(byId('layerOpacity'),'input',e=>{
            if(!this.layer()||this.layer().locked)return;
            if(!this.opacityEditing){this.tool.history.flush();this.tool.history.beginTransaction('Layer opacity');this.opacityEditing=true;}
            const next=editSelection(this.tool.settings,this.selection(),{opacity:Number(e.target.value)},this.selected);
            this.tool.settingsStore.set(layerSettingsKey(this.tool.settings.mode),next[layerSettingsKey(this.tool.settings.mode)]);
        });
        on(byId('layerOpacity'),'change',()=>this.endOpacity());on(byId('layerOpacity'),'blur',()=>this.endOpacity());
        document.querySelectorAll('[data-form-tool]').forEach(button=>on(button,'click',()=>this.setTool(button.dataset.formTool)));
        on(byId('brushSize'),'input',e=>this.setBrushSize(Number(e.target.value)));
        on(byId('clearPaint'),'click',()=>{this.commit({strokes:[]},'Clear strokes',true);this.report();});
        for(const [field,id] of Object.entries(fields)) {
            const input=byId(id),apply=()=>{
                const edit=this.layer(),value=Number(input.value)/100;
                if(!edit||edit.locked||!Number.isFinite(value)||!input.value.trim()){this.sync();return;}
                if(value===edit[field])return;
                let patch={[field]:value};
                if(field==='scaleX'||field==='scaleY') {
                    this.refreshMap();const bounds=this.selectionBounds();
                    const center=bounds?[(bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2]:[.5+edit.x,.5+edit.y];
                    this.change(this.tool,resizeSelection(this.tool.settings,this.selection(),field==='scaleX'?value/edit.scaleX:1,field==='scaleY'?value/edit.scaleY:1,center),'Resize layers');return;
                }
                this.commit(patch,'Transform layer',true);
            };
            on(input,'change',apply);on(input,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
        }
        const list=byId('layerList');
        on(list,'pointerdown',e=>{
            const row=e.target.closest('.layer-row');
            if(e.button!==0||!row||row.dataset.locked==='true'||e.target.closest('.layer-icon'))return;
            this.reorderGesture={id:row.dataset.layerId,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,moved:false};
        });
        on(document,'pointermove',e=>this.moveReorder(e));
        on(document,'pointerup',e=>{if(e.pointerId===this.reorderGesture?.pointerId)this.finishReorder(true);});
        on(document,'pointercancel',()=>this.finishReorder(false));
        on(list,'lostpointercapture',()=>this.finishReorder(false));
        on(list,'click',e=>{if(this.suppressLayerClick){this.suppressLayerClick=false;e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
        on(document,'keydown',e=>{if(e.key==='Escape'&&this.reorderGesture){e.preventDefault();this.finishReorder(false);}});
        on(this.container,'pointerdown',e=>this.start(e));on(this.container,'pointermove',e=>this.move(e));
        on(this.container,'pointerup',e=>this.finish(e));on(this.container,'pointercancel',()=>this.cancel());
        on(this.container,'lostpointercapture',()=>{if(this.gesture)this.cancel();});
        on(this.container,'pointerleave',()=>{this.cursor.hidden=true;this.lastPointer=null;});
        on(document,'pointerdown',e=>{
            if(e.button!==0||this.space||this.gesture||this.reorderGesture||this.container.contains(e.target))return;
            if(e.target.closest('.controls-panel, .top-links, .action-dock, dialog, [role="dialog"], .modal-overlay'))return;
            if(this.selected!=null)this.select(null);
        });
        on(document,'keydown',e=>{if(this.gesture&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();this.cancel();}},{capture:true});
        on(document,'keydown',e=>{
            if(e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
            if(e.code==='Space'){this.space=true;this.cursor.hidden=true;}
            if(e.key==='Escape'&&this.active){e.preventDefault();if(this.gesture)this.cancel();else this.select(null);}
        });
        on(document,'keyup',e=>{if(e.code==='Space')this.space=false;});
        on(window,'blur',()=>{this.space=false;this.cancel();this.finishReorder(false);this.endOpacity();});
        on(this.container,'keydown',e=>{
            const edit=this.layer();if(!this.active||!edit||edit.locked||e.metaKey||e.ctrlKey||e.altKey||this.gesture)return;
            const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
            if(!delta)return;e.preventDefault();const step=e.shiftKey ? .01 : .001;
            this.commit({x:edit.x+delta[0]*step,y:edit.y+delta[1]*step},'Move layer',true);
        });
        const rotate=()=>{const input=byId('formRotation'),value=Number(input.value);if(input.value.trim()&&Number.isFinite(value))this.commit({rotation:value},'Rotate layers',true);else this.sync();};on(byId('formRotation'),'change',rotate);on(byId('formRotation'),'keydown',event=>{if(event.key==='Enter'){event.preventDefault();rotate();}});
        for(const [id,key] of [['flipLayerX','flipX'],['flipLayerY','flipY']])on(byId(id),'click',()=>{if(this.layer())this.commit({[key]:!this.layer()[key]},'Reflect layers',true);});
        on(byId('groupLayers'),'click',()=>this.groupSelection());on(byId('ungroupLayers'),'click',()=>this.commit({collection:''},'Ungroup layers'));
        const material=byId('layerMaterialFields');
        for(const [key,[min,max]] of Object.entries(materialRanges)){
            const row=document.createElement('div');row.className='local-material-row';
            const label=document.createElement('label');label.textContent=key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());label.htmlFor='local-'+key;
            const input=document.createElement('input');Object.assign(input,{id:'local-'+key,type:'number',min,max,step:key==='grainSize'?.1:1});
            const reset=document.createElement('button');reset.type='button';reset.className='btn-add-object';reset.textContent='Auto';reset.title='Inherit the global setting';
            const apply=()=>{if(input.value.trim()&&Number.isFinite(Number(input.value)))this.commit({material:{[key]:Number(input.value)}},'Layer material');else this.sync();};on(input,'change',apply);on(input,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}});
            on(reset,'click',()=>{const ids=this.selection();this.change(this.tool,withLayers(this.tool.settings,getLayers(this.tool.settings).map(l=>{if(!ids.includes(l.id)||l.locked)return l;const m={...l.material};delete m[key];return {...l,material:m};})),'Inherit material');});
            row.append(label,input,reset);material.append(row);
        }
        this.sync();return this;
    }
    endOpacity(){if(this.opacityEditing){this.opacityEditing=false;this.tool.history.endTransaction();}}
    canChangeLayer(){return !!this.layer()&&!this.gesture&&!this.vector?.drag&&!this.reorderGesture;}
    duplicateSelected(){
        if(!this.canChangeLayer())return;this.endOpacity();
        try {const result=duplicateSelection(this.tool.settings,this.selection());this.change(this.tool,result.settings,'Duplicate layer');this.select(result.id);this.selectedIds=new Set(result.ids);this.sync();this.tool.render();this.container.focus({preventScroll:true});}
        catch(error){this.report(error.message);}
    }
    deleteSelected(){const layer=this.layer();if(!this.canChangeLayer()||layer.locked)return;this.endOpacity();this.change(this.tool,withLayers(this.tool.settings,getLayers(this.tool.settings).filter(l=>!this.selection().includes(l.id)||l.locked)),'Delete layers');this.report();this.container.focus({preventScroll:true});}
    shiftLayer(delta){
        if(!this.canChangeLayer()||this.layer().locked)return;const stack=getLayers(this.tool.settings),ids=this.selection(),indices=ids.map(id=>stack.findIndex(l=>l.id===id));
        const edge=delta>0?Math.max(...indices):Math.min(...indices),target=stack[edge+delta];if(!target)return;
        this.endOpacity();this.change(this.tool,reorderSelection(this.tool.settings,ids,target.id,delta>0?'before':'after'),'Reorder layers');
        byId('layerList').querySelector('.is-selected')?.scrollIntoView({block:'nearest'});
    }
    async renameLayer(id){
        const layer=getLayers(this.tool.settings).find(l=>l.id===id),mode=this.tool.settings.mode;
        if(!layer||layer.locked||this.renaming)return;
        this.select(id);this.renaming=true;
        try {
            const value=await this.tool.dialog.prompt({title:'Rename layer',value:layer.name,placeholder:'Layer name',confirmText:'Rename'});
            if(this.abort.signal.aborted||this.tool.settings.mode!==mode||!value?.trim()||value===layer.name)return;
            this.change(this.tool,editLayer(this.tool.settings,id,{name:value.trim().slice(0,64)}),'Rename layer');
        } finally {this.renaming=false;}
    }
    pin(id){const layer=getLayers(this.tool.settings).find(l=>l.id===id);if(!layer||layer.locked||['drawn','vector'].includes(layer.mode))return;this.change(this.tool,editLayer(this.tool.settings,id,{mode:layer.mode==='auto'?'pinned':'auto'}),'Pin layer');}
    lock(id){this.cancel();const layer=getLayers(this.tool.settings).find(l=>l.id===id);if(layer)this.change(this.tool,editLayer(this.tool.settings,id,{locked:!layer.locked}),'Lock layer');}
    setBrushSize(size){
        this.brushSize=clamp(Math.round(size),3,60);
        byId('brushSize').value=this.brushSize;byId('brushSizeValue').textContent=this.brushSize+'%';
        if(this.lastPointer)this.cursorAt(this.lastPointer);
    }
    setTool(name){
        if(this.vector?.pen)this.vector.stopPen();this.vector?.cancel();if(this.vector)this.vector.editing=false;this.cancel();this.paintTool=name;
        const fallback=name==='move'?null:getLayers(this.tool.settings).findLast(l=>l.visible&&!l.locked)?.id??null;
        this.select(this.layer()?.id??fallback);this.container.focus({preventScroll:true});
    }
    select(id,{toggle=false,range=false,individual=false}={}){
        this.vector?.cancel();this.cancel();this.endOpacity();const stack=getLayers(this.tool.settings);let ids=new Set(this.selection());
        if(range&&id&&this.selected){const a=stack.findIndex(l=>l.id===this.selected),b=stack.findIndex(l=>l.id===id);ids=new Set(stack.slice(Math.min(a,b),Math.max(a,b)+1).map(l=>l.id));}
        else if(toggle&&id){if(ids.has(id))ids.delete(id);else ids.add(id);}
        else {const l=stack.find(l=>l.id===id);ids=new Set(!id?[]:!individual&&l?.collection?stack.filter(x=>x.collection===l.collection).map(x=>x.id):[id]);}
        this.selectedIds=ids;this.selected=ids.has(id)?id:[...ids].at(-1)??null;this.cursor.hidden=true;this.report();this.sync();this.tool.render();
    }
    async groupSelection(){
        if(this.selection().length<2)return;const name=await this.tool.dialog.prompt({title:'Group layers',label:'Group name',value:'Group'});if(!name?.trim())return;
        const ids=this.selection(),used=new Set(getLayers(this.tool.settings).filter(l=>!ids.includes(l.id)).map(l=>l.collection));let unique=name.trim().slice(0,40),suffix=2;while(used.has(unique))unique=name.trim().slice(0,40)+' '+suffix++;this.commit({collection:unique},'Group layers');
    }
    renderList(stack) {
        const key=JSON.stringify(stack.map(l=>[l.id,l.name,l.mode,l.visible,l.locked,l.group,l.collection]));
        if(key===this.listKey)return;this.listKey=key;const list=byId('layerList'),scroll=list.scrollTop;list.replaceChildren();
        for(const layer of [...stack].reverse()) {
            const row=document.createElement('div');row.className='layer-row ui-list-row';row.dataset.layerId=layer.id;row.setAttribute('role','listitem');row.dataset.locked=String(layer.locked);
            row.classList.toggle('is-selected',layer.id===this.selected);row.classList.toggle('is-hidden',!layer.visible);
            const action=(key,title,pressed,run)=>{
                const b=document.createElement('button');b.type='button';b.className='layer-icon ui-icon-button';b.innerHTML=icon(key);b.title=title;b.setAttribute('aria-label',title+' '+layer.name);b.setAttribute('aria-pressed',String(pressed));b.addEventListener('click',run);return b;
            };
            const eye=action('eye',layer.visible?'Hide':'Show',layer.visible,()=>this.change(this.tool,editLayer(this.tool.settings,layer.id,{visible:!layer.visible}),'Layer visibility'));
            const select=document.createElement('button');select.type='button';select.className='layer-select ui-list-select';select.title='Cmd/Ctrl-click: select multiple; Shift-click: range; double-click: rename; drag: reorder';select.setAttribute('aria-pressed',String(this.selection().includes(layer.id)));select.setAttribute('aria-label','Select '+layer.name);
            const thumb=document.createElement('canvas');thumb.className='layer-thumb';thumb.width=48;thumb.height=30;thumb.setAttribute('aria-hidden','true');thumb.dataset.thumbId=layer.id;
            const text=document.createElement('span');text.className='layer-label';const title=document.createElement('span');title.className='ui-list-title';title.textContent=layer.name;
            const state=document.createElement('span');state.className='layer-state ui-meta';state.textContent=layer.mode==='auto'?'Auto':layer.mode==='pinned'?'Pinned':layer.mode==='vector'?'Vector':'Drawn';state.title=this.modeDescription(layer);if(layer.collection){const group=document.createElement('span');group.className='ui-meta';group.textContent=layer.collection;group.title='Click to select this group; Cmd/Ctrl-click selects individual layers';text.append(group);}text.append(title,state);select.append(thumb,text);
            select.addEventListener('click',event=>this.select(layer.id,{range:event.shiftKey,toggle:event.metaKey||event.ctrlKey}));select.addEventListener('dblclick',()=>this.renameLayer(layer.id));
            const pin=action('pin',layer.mode==='pinned'?'Unpin':'Pin',layer.mode==='pinned',()=>this.pin(layer.id));pin.disabled=['drawn','vector'].includes(layer.mode)||layer.locked;
            if(['drawn','vector'].includes(layer.mode))pin.title='Drawn and vector layers are always kept by Generate';
            const lock=action('lock',layer.locked?'Unlock':'Lock',layer.locked,()=>this.lock(layer.id));row.append(eye,select,pin,lock);
            list.append(row);
        }
        list.scrollTop=scroll;
    }
    moveReorder(event) {
        const g=this.reorderGesture;if(!g||event.pointerId!==g.pointerId)return;
        g.x=event.clientX;g.y=event.clientY;
        if(!g.moved&&Math.hypot(g.x-g.startX,g.y-g.startY)<6)return;
        event.preventDefault();
        if(!g.moved){g.moved=true;byId('layerList').setPointerCapture(g.pointerId);this.scrollReorder();}
        this.reorderTarget();
    }
    reorderTarget() {
        const g=this.reorderGesture;if(!g?.moved)return;
        const list=byId('layerList'),rect=list.getBoundingClientRect();this.clearDrops();g.target=null;
        list.querySelector('[data-layer-id="'+g.id+'"]')?.classList.add('is-dragging');
        if(g.x<rect.left||g.x>rect.right||g.y<rect.top||g.y>rect.bottom)return;
        const row=[...list.children].find(el=>{const r=el.getBoundingClientRect();return g.y>=r.top&&g.y<r.bottom;});
        if(!row||row.dataset.layerId===g.id)return;
        g.target=row.dataset.layerId;g.placement=g.y<row.getBoundingClientRect().top+row.offsetHeight/2?'before':'after';
        row.classList.add('drop-'+g.placement);
    }
    scrollReorder() {
        const g=this.reorderGesture;if(!g?.moved)return;
        const list=byId('layerList'),r=list.getBoundingClientRect();
        if(g.x>=r.left&&g.x<=r.right&&g.y>=r.top&&g.y<=r.bottom){
            const delta=g.y<r.top+24?-6:g.y>r.bottom-24?6:0;
            if(delta){list.scrollTop+=delta;this.reorderTarget();}
        }
        this.reorderFrame=requestAnimationFrame(()=>this.scrollReorder());
    }
    finishReorder(commit) {
        const g=this.reorderGesture;if(!g)return;this.reorderGesture=null;
        cancelAnimationFrame(this.reorderFrame);this.clearDrops();
        const list=byId('layerList');if(list.hasPointerCapture(g.pointerId))list.releasePointerCapture(g.pointerId);
        if(g.moved){
            this.suppressLayerClick=true;setTimeout(()=>{this.suppressLayerClick=false;},0);
            if(commit&&g.target){this.change(this.tool,reorderSelection(this.tool.settings,this.selection().includes(g.id)?this.selection():[g.id],g.target,g.placement),'Reorder layers');this.select(g.id);}
        }
    }
    clearDrops(){byId('layerList').querySelectorAll('.drop-before,.drop-after,.is-dragging').forEach(row=>row.classList.remove('drop-before','drop-after','is-dragging'));}
    modeDescription(layer){return {auto:'Generate replaces this shape. Moving or painting pins it.',pinned:'Generate keeps this shape. Composition controls still apply.',drawn:'Shape follows your drawing. Generate and composition controls keep it.',vector:'Editable Bezier shape. Generate and composition controls keep its contour.'}[layer.mode]+(layer.locked?' Locked against manual edits.':'');}
    syncColorSwatches(layer) {
        const s=this.tool.settings,container=byId('layerColorSwatches');
        const colors=[...Object.entries({sky:'Background',terrain:'Terrain',depth:'Depth',light:'Light'}).map(([id,name])=>({id,name,color:s[id]})),...(s.customColors??[])];
        const key=colors.map(color=>color.id).join('|');
        if(key!==this.colorSwatchesKey) {
            this.colorSwatchesKey=key;
            container.replaceChildren(...colors.map(color=>{
                const button=document.createElement('button');button.type='button';button.className='color-dot layer-color-swatch';
                button.dataset.colorGroup=color.id;button.setAttribute('role','radio');return button;
            }));
        }
        [...container.children].forEach((button,i)=>{
            const color=colors[i],selected=color.id===layer.group;
            button.style.backgroundColor=color.color;
            button.title=color.name+' · '+color.color.toUpperCase();button.setAttribute('aria-label',button.title);
            button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;button.disabled=layer.locked;
        });
        byId('layerColorName').textContent=colors.find(color=>color.id===layer.group)?.name??'';
    }
    sync() {
        const s=this.tool.settings,stack=getLayers(s);
        if(s.mode!==this.mode){this.cancel();this.mode=s.mode;this.selectedIds?.clear();this.selected=null;this.thumbs.clear();}
        if(this.selectedIds)this.selectedIds=new Set([...this.selectedIds].filter(id=>stack.some(l=>l.id===id)));
        if(!stack.some(l=>l.id===this.selected))this.selected=[...(this.selectedIds??[])].at(-1)??null;
        this.active=this.selected!=null;
        this.container.classList.toggle('is-editing-forms',this.active);this.overlay.hidden=!this.active;
        this.handle=null;
        if(!this.active)this.cursor.hidden=true;
        document.querySelectorAll('[data-form-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.formTool===this.paintTool)));
        this.renderList(stack);const layer=this.layer();
        byId('layerList').querySelectorAll('.layer-row').forEach(row=>{
            const selected=this.selection().includes(row.dataset.layerId);row.classList.toggle('is-selected',selected);
            row.querySelector('.layer-select').setAttribute('aria-pressed',String(selected));
        });
        for(const id of ['newDrawnLayer','newAutoLayer','newVectorLayer']){
            byId(id).disabled=stack.length>=MAX_LAYERS;
            byId(id).title=(id==='newVectorLayer'?'New vector shape':id==='newDrawnLayer'?'New drawn layer':'New generated layer')+' · '+stack.length+' / '+MAX_LAYERS+' layers';
        }
        byId('newBlueLayers').disabled=stack.length>MAX_LAYERS-2;
        byId('newBlueLayers').title='Add two blue layers behind the artwork · '+stack.length+' / '+MAX_LAYERS+' layers';
        byId('layerDuplicate').disabled=!layer||stack.length+this.selection().length>MAX_LAYERS;byId('layerDelete').disabled=!layer||layer.locked;
        byId('backgroundThumb').style.background=s.sky;
        byId('layerPanel').hidden=!layer;byId('brushControls').hidden=this.paintTool==='move';
        this.vector?.sync();
        if(!layer)return;
        byId('selectedLayerName').textContent=this.selection().length>1?this.selection().length+' selected':layer.name;
        byId('groupLayers').disabled=this.selection().length<2;byId('ungroupLayers').disabled=!getLayers(s).some(l=>this.selection().includes(l.id)&&l.collection);
        byId('formRotation').value=layer.rotation||0;
        for(const key of Object.keys(materialRanges)){const input=byId('local-'+key);input.value=layer.material?.[key]??s[key];input.classList.toggle('is-inherited',layer.material?.[key]==null);input.nextElementSibling.disabled=layer.material?.[key]==null;}byId('selectedLayerName').title=layer.name;
        const mode=byId('layerModeLabel');mode.textContent=(layer.mode==='auto'?'Auto':layer.mode==='pinned'?'Pinned':layer.mode==='vector'?'Vector':'Drawn')+(layer.locked?' · Locked':'');mode.title=this.modeDescription(layer);mode.setAttribute('aria-label',mode.textContent+'. '+mode.title);
        byId('layerEditable').disabled=layer.locked;this.syncColorSwatches(layer);byId('layerOpacity').value=layer.opacity;byId('layerOpacityValue').textContent=layer.opacity+'%';
        byId('layerConvert').hidden=layer.mode==='drawn';byId('layerConvert').title='Keep this silhouette and edit it only by drawing.';
        byId('clearPaint').hidden=!layer.strokes.length;byId('clearPaint').title='Clear '+layer.strokes.length+' strokes';
        for(const [field,id]of Object.entries(fields))byId(id).value=Number((layer[field]*100).toFixed(1));
        if(layer.locked||!layer.visible)this.cursor.hidden=true;
    }
    point(event){const rect=this.container.getBoundingClientRect(),t=this.tool.target,s=this.tool.settings;return [(event.clientX-rect.left-t.panX)/(t.zoom*s.width),(event.clientY-rect.top-t.panY)/(t.zoom*s.height)];}
    refreshMap(){const s=this.tool.settings,key=JSON.stringify([createLayerScene(s),s.width,s.height,s.softness,s.edgeVariation]);if(key===this.mapKey)return;this.picker ||=new LandscapeRenderer();const width=Math.max(64,Math.round(400*Math.min(1,s.width/s.height))),height=Math.max(64,Math.round(400*Math.min(1,s.height/s.width)));this.map=this.picker.formMap(s,width,height);this.mapKey=key;}
    hit(point) {
        const [x,y]=point;if(x<0||y<0||x>=1||y>=1)return null;
        this.refreshMap();const index=this.map.ids[Math.floor(y*this.map.height)*this.map.width+Math.floor(x*this.map.width)]-1;
        return getLayers(this.tool.settings)[index]?.id??null;
    }
    start(event) {
        if(event.button!==0||this.space||this.gesture)return;
        const point=this.point(event),t=this.tool.target,s=this.tool.settings;
        const near=this.paintTool==='move'&&this.active&&this.handle&&Math.hypot((point[0]-this.handle[0])*s.width*t.zoom,(point[1]-this.handle[1])*s.height*t.zoom)<14;
        const hit=this.hit(point);
        if(!near&&point.some(v=>v<0||v>=1)){this.select(null);return;}
        if(this.paintTool!=='move'){
            if(!this.active){this.select(hit);return;}
            this.startPaint(event,point,hit==null);return;
        }
        if(!near){if(event.shiftKey){this.select(hit,{toggle:true});return;}if(!this.selection().includes(hit))this.select(hit);}
        const edit=this.layer();if(!edit||edit.locked||!edit.visible)return;
        event.preventDefault();this.container.focus({preventScroll:true});const bounds=this.selectionBounds();
        this.gesture={pointerId:event.pointerId,point,id:edit.id,snapshot:this.tool.getSnapshot(),edit,ids:this.selection(),resize:!!near,center:bounds?[(bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2]:[.5,.5],started:false};this.container.setPointerCapture(event.pointerId);
    }
    cursorAt(event){this.lastPointer={clientX:event.clientX,clientY:event.clientY};const rect=this.container.getBoundingClientRect(),s=this.tool.settings,p=this.point(event),l=this.layer();this.cursor.hidden=!this.active||this.paintTool==='move'||!l||l.locked||!l.visible||this.space||p.some(v=>v<0||v>1);const d=Math.min(s.width,s.height)*this.brushSize/100*this.tool.target.zoom;this.cursor.style.width=this.cursor.style.height=d+'px';this.cursor.style.left=(event.clientX-rect.left)+'px';this.cursor.style.top=(event.clientY-rect.top)+'px';this.cursor.classList.toggle('is-eraser',this.paintTool==='erase');}
    startPaint(event,point,empty=false){const edit=this.layer();if(!edit||edit.locked||!edit.visible||point.some(v=>v<0||v>=1)){if(empty)this.select(null);return;}const strokes=edit.strokes;
        if(strokes.length>=MAX_STROKES||strokePointCount(strokes)>=MAX_FORM_POINTS){if(empty)this.select(null);else this.report('This layer is full. Undo or clear strokes to keep painting.');return;}
        event.preventDefault();this.container.focus({preventScroll:true});
        this.gesture={pointerId:event.pointerId,point,id:edit.id,snapshot:this.tool.getSnapshot(),edit,stroke:brushStroke(this.tool.settings,edit,point,this.brushSize,this.paintTool),started:false};
        this.report();this.container.setPointerCapture(event.pointerId);
        // Empty-space clicks deselect; defer paint and history until a drag begins.
        if(!empty)this.beginStroke();this.cursorAt(event);
    }
    beginStroke(){this.tool.history.flush();this.tool.history.beginTransaction(this.paintTool==='paint'?'Brush stroke':'Erase stroke');this.gesture.started=true;this.writeStroke();}
    moved(point,g=this.gesture){return Math.hypot((point[0]-g.point[0])*this.tool.settings.width*this.tool.target.zoom,(point[1]-g.point[1])*this.tool.settings.height*this.tool.target.zoom)>=3;}
    writeStroke(){const g=this.gesture,key=layerSettingsKey(g.snapshot.mode),next=editLayer(g.snapshot,g.id,{strokes:[...g.edit.strokes,g.stroke]},{manual:true});this.tool.settingsStore.set(key,next[key]);}
    paintMove(event,force=false){const g=this.gesture,p=localPaintPoint(this.point(event).map(v=>clamp(v,0,1)),g.edit,this.tool.settings.width/this.tool.settings.height),points=g.stroke.points,last=points.at(-1);
        if(Math.hypot((p[0]-last[0])/g.stroke.rx,(p[1]-last[1])/g.stroke.ry)<(force ? .002 : .15))return;
        if(points.length>=MAX_STROKE_POINTS||strokePointCount(g.edit.strokes)+points.length>=MAX_FORM_POINTS){this.report('Stroke limit reached. Lift the pointer; undo or clear strokes if the layer is full.');return;}points.push(p);this.writeStroke();
    }
    move(event){this.cursorAt(event);const g=this.gesture;if(!g||event.pointerId!==g.pointerId)return;if(g.stroke){event.preventDefault();if(!g.started){if(!this.moved(this.point(event)))return;this.beginStroke();}this.paintMove(event);return;}
        const point=this.point(event),dx=point[0]-g.point[0],dy=point[1]-g.point[1];if(!g.started&&Math.hypot(dx*this.tool.settings.width*this.tool.target.zoom,dy*this.tool.settings.height*this.tool.target.zoom)<3)return;
        event.preventDefault();if(!g.started){this.tool.history.flush();this.tool.history.beginTransaction(g.resize?'Resize layer':'Move layer');g.started=true;}
        if(!g.resize&&!g.duplicated&&!g.duplicateBlocked&&(event.altKey||event.metaKey)) {
            try {
                // Freeze the original where it was when the modifier was pressed;
                // keep the copy attached to the same pointer offset, as in Pizza Boxer.
                const copy=duplicateSelection(this.tool.settings,g.ids??[g.id]);
                g.originalId=g.id;g.originalIds=g.ids;g.ids=copy.ids;g.id=copy.mapping[g.originalId];g.workingSnapshot=copy.settings;g.duplicated=true;
                this.selected=g.id;this.selectedIds=new Set(copy.ids);
            } catch(error){g.duplicateBlocked=true;this.report(error.message);}
        }
        const base=g.workingSnapshot??g.snapshot,ids=g.ids??[g.id];
        const next=g.resize?resizeSelection(base,ids,1+dx/Math.max(.02,g.point[0]-g.center[0]),1+dy/Math.max(.02,g.point[1]-g.center[1]),g.center):editSelection(base,ids,{x:g.edit.x+dx,y:g.edit.y+dy},g.id),key=layerSettingsKey(g.snapshot.mode);this.tool.settingsStore.set(key,next[key]);
    }
    finish(event){
        const g=this.gesture;if(!g||event.pointerId!==g.pointerId)return;
        if(g.stroke){
            if(!g.started&&this.moved(this.point(event)))this.beginStroke();
            if(!g.started){this.select(null);return;}
            this.paintMove(event,true);
        }
        this.gesture=null;if(g.started)this.tool.history.endTransaction();
        if(this.container.hasPointerCapture(g.pointerId))this.container.releasePointerCapture(g.pointerId);
    }
    cancel(){const g=this.gesture;if(!g)return;this.gesture=null;if(g.duplicated){this.selected=g.originalId;this.selectedIds=new Set(g.originalIds??[g.originalId]);}if(g.started){this.tool.applySnapshot(g.snapshot);this.tool.history.endTransaction();}if(this.container.hasPointerCapture(g.pointerId))this.container.releasePointerCapture(g.pointerId);}
    drawThumbs(){
        if(byId('layersPanel').classList.contains('panel-collapsed'))return;
        const s=this.tool.settings,scene=createLayerScene(s);this.picker ||=new LandscapeRenderer();
        scene.forEach((l,i)=>{const canvas=byId('layerList').querySelector('[data-thumb-id="'+l.id+'"]');if(!canvas)return;
            const key=JSON.stringify([l.phases,l.transform,l.field,l.shape,l.style,l.foldField,l.crest,l.pocket,l.geometryA,l.geometryB,l.strokes,l.vectorPath,l.affine,l.materialA,l.materialB,groupColor(s,l.group),s.width/s.height]);
            let cached=this.thumbs.get(l.id);
            if(cached?.key!==key){const map=this.picker.formMap(s,48,30,i),ctx=canvas.getContext('2d'),data=ctx.createImageData(48,30),rgb=groupColor(s,l.group).slice(1).match(/../g).map(v=>parseInt(v,16));for(let n=0;n<map.ids.length;n++)if(map.ids[n])data.data.set([...rgb,230],n*4);cached={key,data};this.thumbs.set(l.id,cached);}
            canvas.getContext('2d').putImageData(cached.data,0,0);
        });
        for(const id of this.thumbs.keys())if(!scene.some(l=>l.id===id))this.thumbs.delete(id);
    }
    selectionBounds(){const stack=getLayers(this.tool.settings),boxes=this.selection().map(id=>visibleBounds(this.map,stack.findIndex(l=>l.id===id))).filter(Boolean);return boxes.length?{left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))}:null;}
    draw(){
        this.drawThumbs();this.vector?.draw();if(this.vector?.editing||!this.active)return;this.refreshMap();const t=this.tool.target,s=this.tool.settings,dpr=t.dpr,rect=this.container.getBoundingClientRect();
        this.overlay.width=Math.round(rect.width*dpr);this.overlay.height=Math.round(rect.height*dpr);const ctx=this.overlay.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);this.handle=null;
        const layer=this.layer();if(!layer)return;const selected=this.index(),map=this.map,indices=this.selection().map(id=>getLayers(s).findIndex(l=>l.id===id));
        const bounds=this.selectionBounds();
        byId('formVisibilityNote').hidden=!!bounds;byId('formVisibilityNote').textContent=!layer.visible?'This layer is hidden. Show it to edit on the canvas.':layer.mode==='drawn'&&!layer.hasBase&&!layer.strokes.length?'Empty layer. Use Brush to add a shape.':'This layer is covered or outside the canvas. Move it forward or adjust its position.';
        if(!bounds)return;this.mask.width=map.width;this.mask.height=map.height;const mc=this.mask.getContext('2d'),data=mc.createImageData(map.width,map.height),id=selected+1;
        for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const at=y*map.width+x;if(!indices.includes(map.ids[at]-1))continue;const id=map.ids[at],edge=x===0||y===0||x===map.width-1||y===map.height-1||map.ids[at-1]!==id||map.ids[at+1]!==id||map.ids[at-map.width]!==id||map.ids[at+map.width]!==id;data.data.set([255,255,255,edge?180:0],at*4);}
        mc.putImageData(data,0,0);const w=s.width*t.zoom,h=s.height*t.zoom;ctx.drawImage(this.mask,t.panX,t.panY,w,h);if(this.paintTool!=='move'||layer.locked)return;
        const x=t.panX+bounds.left*w,y=t.panY+bounds.top*h,bw=(bounds.right-bounds.left)*w,bh=(bounds.bottom-bounds.top)*h;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(x,y,bw,bh);ctx.setLineDash([]);
        const hx=clamp(x+bw-7,7,rect.width-7),hy=clamp(y+bh-7,7,rect.height-7);ctx.fillStyle='#FFF';ctx.fillRect(hx-5,hy-5,10,10);ctx.strokeStyle='#111';ctx.strokeRect(hx-5,hy-5,10,10);this.handle=[(hx-t.panX)/w,(hy-t.panY)/h];
    }
    destroy(){this.vector?.cancel();this.cancel();this.finishReorder(false);this.endOpacity();this.abort.abort();this.picker?.destroy();}
}
