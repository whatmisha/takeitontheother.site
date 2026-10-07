import { normalizeSettings, exportDimensions } from './document.js?v=vector-1';
import { getLayers, layerSettingsKey } from './layer-data.js?v=vector-1';
import { renderPNG } from './png-export.js?v=vector-1';
import { StoredZipWriter } from '../infra/framework/src/export/StoredZipWriter.js?v=1';

export function layerExportPlan(raw) {
    const settings=normalizeSettings(raw);
    exportDimensions(settings);
    const stack=getLayers(settings);
    if(!stack.length&&settings.transparentBackground)throw new Error('There are no layers to export. Add a layer first.');
    const entries=[...stack].reverse().map((layer,order)=>{
        const title=Array.from(layer.name.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_')).slice(0,48).join('').replace(/[. ]+$/g,'').trim()||'Layer';
        return {index:stack.length-1-order,name:String(order+1).padStart(2,'0')+'-'+title+(layer.visible?'':'-hidden')+'.png'};
    });
    if(!settings.transparentBackground)entries.push({index:-1,name:String(entries.length+1).padStart(2,'0')+'-Background.png'});
    return {settings,entries};
}

export async function renderLayersZIP(renderer,raw,{signal,onProgress=()=>{}}={}) {
    const {settings,entries}=layerExportPlan(raw),stack=getLayers(settings),key=layerSettingsKey(settings.mode);
    const zip=new StoredZipWriter();
    for(let i=0;i<entries.length;i++) {
        signal?.throwIfAborted();
        const entry=entries[i];onProgress({current:i+1,total:entries.length,name:entry.name});
        // Yield between full-size PNGs so progress and other editor controls stay responsive.
        await new Promise(resolve=>setTimeout(resolve,0));
        signal?.throwIfAborted();
        const background=entry.index===-1;
        const isolated={...settings,transparentBackground:!background,exportLayers:false,
            [key]:background?[]:stack.map((layer,index)=>index===entry.index?{...layer,visible:true}:layer)};
        const {blob}=await renderPNG(renderer,isolated,{layerIndex:entry.index});
        signal?.throwIfAborted();
        await zip.add(entry.name,blob,{signal});
    }
    signal?.throwIfAborted();
    return {blob:zip.toBlob(),count:entries.length};
}
