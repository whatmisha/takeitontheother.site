import { normalizeStrokes } from './paint.js?v=custom-colors-1';

export const MAX_LAYERS=16;
export const layerSettingsKey=mode=>mode==='abstract'?'abstractLayers':'landscapeLayers';
export const layerNames=['Terrain','Bank 1','Basin','Bank 2','Fold','Foreground'];
export const layerGroups=['terrain','depth','light','sky'];
export const sourceGroup=i=>i>=6?'sky':i===0?'terrain':(i===2||i===5?'light':'depth');
const number=(v,f,a,b)=>typeof v==='number'&&Number.isFinite(v)?Math.round(Math.max(a,Math.min(b,v))*10000)/10000:f;
const shapeRanges={scale:[100,40,220],complexity:[2,1,6],flow:[48,0,100],folds:[65,0,100],horizon:[53,15,80],relief:[62,0,100]};
export const geometrySnapshot=s=>Object.fromEntries(Object.entries(shapeRanges).map(([key,[fallback,min,max]])=>[key,number(s?.[key],fallback,min,max)]));
export function normalizeLayerStack(value,settings) {
    if(!Array.isArray(value))return null;
    const ids=new Set();
    return value.slice(0,MAX_LAYERS).flatMap((item,i)=>{
        if(!item||typeof item!=='object'||Array.isArray(item))return [];
        let id=typeof item.id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(item.id)?item.id:'layer-'+i;
        const base=id;let suffix=1;while(ids.has(id))id=base.slice(0,52)+'-copy-'+suffix++;ids.add(id);
        const source=Math.round(number(item.source,0,0,7));
        const mode=['auto','pinned','drawn'].includes(item.mode)?item.mode:'auto';
        return [{id,name:typeof item.name==='string'&&item.name.trim()?item.name.trim().slice(0,64):'Layer '+(i+1),
            source,mode,seed:number(item.seed,settings.seed,0,4294967295)>>>0,salt:number(item.salt,0,0,4294967295)>>>0,
            layout:['auto','basin','ridge','valley','fold'].includes(item.layout)?item.layout:'auto',
            x:number(item.x,0,-1,1),y:number(item.y,0,-1,1),scaleX:number(item.scaleX,1,.25,3),scaleY:number(item.scaleY,1,.25,3),
            group:layerGroups.includes(item.group)||settings.customColors?.some(color=>color.id===item.group)?item.group:sourceGroup(source),opacity:number(item.opacity,100,0,100),
            visible:item.visible!==false,locked:item.locked===true,strokes:normalizeStrokes(item.strokes),
            geometry:mode==='drawn'?geometrySnapshot(item.geometry??settings):null,
            hasBase:mode!=='drawn'||item.hasBase===true}];
    });
}
// Missing stacks preserve old documents exactly. An empty array is deliberately
// empty and must never regenerate the six original forms.
export function getLayers(settings) {
    const explicit=settings[layerSettingsKey(settings.mode)];
    if(Array.isArray(explicit))return explicit;
    const legacy=settings[settings.mode==='abstract'?'abstractForms':'landscapeForms'];
    const original=Array.from({length:6},(_,i)=>{
        const edit=legacy?.[i];
        return {id:'form-'+i,name:settings.mode==='abstract'?'Field '+(i+1):layerNames[i],source:i,
            mode:edit?.locked?'pinned':'auto',seed:edit?.seed??settings.seed,salt:0,layout:edit?.layout??settings.layout,
            x:edit?.x??0,y:edit?.y??0,scaleX:edit?.scaleX??1,scaleY:edit?.scaleY??1,
            group:sourceGroup(i),opacity:100,visible:true,locked:false,strokes:edit?.strokes??[],geometry:null,hasBase:true};
    });
    return settings.blueLayers?[...blueLayerPair(settings),...original]:original;
}

export function blueLayerPair(settings,start=1) {
    return normalizeLayerStack([0,1].map(i=>({id:'blue-'+(start+i),name:'Blue '+(start+i),source:6+i,
        mode:'auto',group:'sky',seed:(settings.seed+(start===1?0:start*2654435761>>>0))>>>0,
        salt:start===1?0:start*2654435761>>>0,layout:settings.layout})),settings);
}
