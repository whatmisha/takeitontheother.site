import { normalizeSettings as normalizeLegacy, defaults as legacyDefaults } from './legacy-document.js?v=unified-document-1';
import { normalizeLayerStack, getLayers } from './layer-data.js?v=unified-document-1';
import { kindModes, modeKinds, normalizeParameters, objectCount } from './object-model.js?v=unified-document-1';
import { composeFlowers } from './flower-composition.js';
import { assertExportSize } from './canvas-size.js';
export { palettes, layouts, toneCharacters, toneKeys, automaticTones, ranges, floraSurfaceDefaults, normalizeForms, formSettingsKey, formEdit, editForm } from './legacy-document.js?v=unified-document-1';
export const TOOL_ID = 'grainy_land';
export const VERSION = 2;
const globalKeys = ['width','height','seed','softness','edgeVariation','glowCoverage','glow','halo','contrast','grain','grainSize','toneCharacter','skyToneAmount','toneAmount','toneSpread','toneScale','toneBleed','backgroundVisible','previewTransparent','softProof','printIntent','motionAmount','motionDuration','customColors','exportScale','transparentBackground','exportLayers','canvasUnit','dpi','printWidthMM','printHeightMM','sky','terrain','depth','light','terrainLow','depthLow','lightLow','terrainHigh','depthHigh','lightHigh','skyLow','skyHigh'];

// Import exactly the active v1 scene; never merge the four old compositions.
export function migrateDocument(value) {
    const old=normalizeLegacy(value),kind=modeKinds[old.mode];
    return {
        ...Object.fromEntries(globalKeys.map(key=>[key,old[key]])),schemaVersion:VERSION,
        toneProfile:['flora','f'].includes(old.mode)?'botanical':'standard',
        objectDefaults:Object.fromEntries(Object.keys(kindModes).map(k=>[k,normalizeParameters(k,k===kind?old:old.objectDefaults[k])])),
        layers:getLayers(old)
    };
}
export function normalizeSettings(value={}) {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid settings.');
    if(value.schemaVersion!=null&&![1,VERSION].includes(value.schemaVersion))throw Error('Unsupported document version.');
    if(value.schemaVersion!==VERSION)return normalizeSettings(migrateDocument(value));
    // Reuse numeric/color validation at the import boundary; no mode enters the result.
    const validated=normalizeLegacy({...value,schemaVersion:1,sceneMemory:null,surfaceMemory:null});
    const out={...Object.fromEntries(globalKeys.map(key=>[key,validated[key]])),schemaVersion:VERSION,
        toneProfile:value.toneProfile==='botanical'?'botanical':'standard',
        objectDefaults:Object.fromEntries(Object.keys(kindModes).map(k=>[k,normalizeParameters(k,value.objectDefaults?.[k])]))};
    out.layers=normalizeLayerStack(value.layers,out)??[];
    out.objectDefaults.plant.floraCount=objectCount(out,out.layers,'plant');
    out.objectDefaults.flower.fCount=objectCount(out,out.layers,'flower');
    return out;
}
export const defaults=normalizeSettings(legacyDefaults);
export function makeDocument(settings){return {toolId:TOOL_ID,schemaVersion:VERSION,settings:normalizeSettings(settings)};}
export function readDocument(value){
    if(value?.toolId!==TOOL_ID||![1,VERSION].includes(value?.schemaVersion)||!value.settings||typeof value.settings!=='object'||Array.isArray(value.settings))throw Error('Choose a Grainy Land JSON file.');
    return normalizeSettings({...value.settings,schemaVersion:value.schemaVersion});
}
export function exportDimensions(settings){const s=normalizeSettings(settings);return assertExportSize(s.width*s.exportScale,s.height*s.exportScale);}
export function regenerate(settings,seed){
    const s=normalizeSettings(settings),next={...s,seed:seed>>>0};
    const layers=s.layers.map(layer=>layer.mode==='auto'&&!layer.locked?{...layer,seed:(seed+(layer.kind==='flower'?0:layer.salt))>>>0}:layer);
    return normalizeSettings({...next,layers:composeFlowers(next,layers)});
}
// Initial inspector choice is derived from the document; tab clicks are UI-only.
export function preferredKind(settings){
    const stack=getLayers(settings),kinds=['flower','plant','spot','land'];
    return kinds.reduce((best,k)=>objectCount(settings,stack,k)>objectCount(settings,stack,best)?k:best,kinds[0]);
}

// Backfill only the new fields of shipped presets already in local storage.
// User presets and every explicitly saved value remain intact; this is idempotent.
export const presetTones = {
    Ember: {toneCharacter:'radiant',toneAmount:100,toneSpread:65,toneScale:110,toneBleed:50},
    Drift: {toneCharacter:'radiant',toneAmount:100,toneSpread:65,toneScale:110,toneBleed:50}
};
export function migrateTonePresets(store) {
    const all=store.loadAll();
    if(!all || typeof all!=='object' || Array.isArray(all)) return;
    let changed=false;
    for(const [name,tones] of Object.entries(presetTones)) {
        const blob=all[name];
        if(!blob || blob.seeded!==true) continue;
        for(const [key,value] of Object.entries(tones)) {
            if(Object.hasOwn(blob,key)) continue;
            blob[key]=value;changed=true;
        }
    }
    if(changed) store.saveAll(all);
}

// Refresh shipped presets cached by returning users. Saving a personal preset
// removes the seeded marker, so personal colors and imported JSON stay intact.
export function migratePresets(store, shipped = {}) {
    migrateTonePresets(store);
    const all=store.loadAll();
    if(!all || typeof all!=='object' || Array.isArray(all)) return;
    let changed=false;
    // Rename the shipped entry in existing libraries without overwriting personal presets.
    if(all['Six cup']?.seeded===true){
        if(!Object.hasOwn(all,'Six Cup'))all['Six Cup']=all['Six cup'];
        delete all['Six cup'];changed=true;
    }
    for(const name of ['Pigment','Quiet dunes'])if(all[name]?.seeded===true){delete all[name];changed=true;}
    for(const name of new Set([...Object.keys(presetTones),...Object.keys(shipped)])) {
        const preset=all[name];
        if(!preset || preset.seeded!==true) continue;
        const updates=shipped[name] ?? (name==='Ember' ? defaults : {depth:'#FF5900',blueLayers:true,blueLayersVisible:true});
        if(Object.entries(updates).every(([key,value])=>JSON.stringify(preset[key])===JSON.stringify(value))) continue;
        all[name]={...preset,...updates};changed=true;
    }
    if(changed) store.saveAll(all);
}
