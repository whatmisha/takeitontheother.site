import { normalizeSettings, formSettingsKey } from './document.js?v=custom-colors-1';
import { MAX_LAYERS, getLayers, layerSettingsKey, normalizeLayerStack, geometrySnapshot, sourceGroup, blueLayerPair } from './layer-data.js?v=custom-colors-1';
export { MAX_LAYERS, getLayers, layerSettingsKey } from './layer-data.js?v=custom-colors-1';

export function withLayers(settings,layers) {
    const s=normalizeSettings(settings);
    return {...s,[layerSettingsKey(s.mode)]:normalizeLayerStack(layers,s),[formSettingsKey(s.mode)]:null};
}
export function editLayer(settings,id,patch,{manual=false}={}) {
    const s=normalizeSettings(settings),stack=getLayers(s),layer=stack.find(l=>l.id===id);
    if(!layer)return s;
    if(layer.locked&&Object.keys(patch).some(key=>!['locked','visible'].includes(key)))return s;
    const next={...layer,...patch};
    if(manual&&layer.mode==='auto')next.mode='pinned';
    return withLayers(s,stack.map(l=>l.id===id?next:l));
}
const uniqueId=stack=>{let n=1;while(stack.some(l=>l.id==='layer-'+n))n++;return 'layer-'+n;};
export function addLayer(settings,mode='drawn') {
    const s=normalizeSettings(settings),stack=getLayers(s);
    if(stack.length>=MAX_LAYERS)throw new Error('Maximum '+MAX_LAYERS+' layers per composition.');
    const id=uniqueId(stack),salt=Number(id.slice(6))*2654435761>>>0,source=stack.length%6;
    const drawn=mode==='drawn';
    const layer={id,name:drawn?'Drawn layer':'Generated layer',source,mode:drawn?'drawn':'auto',seed:(s.seed+salt)>>>0,salt,
        layout:s.layout,group:drawn?'terrain':sourceGroup(source),geometry:drawn?geometrySnapshot(s):null,hasBase:!drawn};
    return {settings:withLayers(s,[...stack,layer]),id};
}
export function duplicateLayer(settings,id) {
    const s=normalizeSettings(settings),stack=getLayers(s),index=stack.findIndex(l=>l.id===id);
    if(index<0)throw new Error('Choose a layer first.');
    if(stack.length>=MAX_LAYERS)throw new Error('Maximum '+MAX_LAYERS+' layers per composition.');
    const copy={...structuredClone(stack[index]),id:uniqueId(stack),name:stack[index].name+' copy',locked:false};
    if(copy.mode==='auto')copy.mode='pinned';
    stack.splice(index+1,0,copy);
    return {settings:withLayers(s,stack),id:copy.id};
}
export function removeLayer(settings,id) {
    const stack=getLayers(normalizeSettings(settings));
    return stack.find(l=>l.id===id)?.locked?normalizeSettings(settings):withLayers(settings,stack.filter(l=>l.id!==id));
}
export function reorderLayer(settings,id,targetId,placement='before') {
    const stack=[...getLayers(normalizeSettings(settings))].reverse();
    const from=stack.findIndex(l=>l.id===id),target=stack.find(l=>l.id===targetId);
    if(from<0||!target||id===targetId||stack[from].locked)return normalizeSettings(settings);
    const [layer]=stack.splice(from,1),to=stack.findIndex(l=>l.id===targetId);
    stack.splice(to+(placement==='after'?1:0),0,layer);
    return withLayers(settings,stack.reverse());
}
export function convertLayer(settings,id) {
    const s=normalizeSettings(settings),layer=getLayers(s).find(l=>l.id===id);
    if(!layer||layer.locked||layer.mode==='drawn')return s;
    // Freeze the analytic silhouette instead of rasterizing it. It is now an
    // immutable base for paint/erase, independent of every generation control.
    return editLayer(s,id,{mode:'drawn',hasBase:true,geometry:geometrySnapshot(s)});
}

export function addBlueLayers(settings) {
    const s=normalizeSettings(settings),stack=getLayers(s);
    if(stack.length>MAX_LAYERS-2)throw new Error('Two free layer slots are needed to add blue forms.');
    let start=1;while(stack.some(layer=>layer.id==='blue-'+start||layer.id==='blue-'+(start+1)))start+=2;
    const pair=blueLayerPair(s,start);
    return {settings:withLayers(s,[...pair,...stack]),id:pair[1].id};
}
