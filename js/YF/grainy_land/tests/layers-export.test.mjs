import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { StoredZipWriter } from '../../infra/framework/src/export/StoredZipWriter.js';
import { layerExportPlan, renderLayersZIP } from '../layers-export.js';
import { defaults,normalizeSettings,makeDocument,readDocument } from '../document.js';
import { getLayers,withLayers } from '../layers.js';
import { createLayerScene } from '../scene.js';
import { readStoredZip } from './zip-reader.js';

test('layer ZIP preference is opt-in, round-trips, and leaves artwork unchanged',()=>{
    for(const value of [undefined,null,'true',1])assert.equal(normalizeSettings({exportLayers:value}).exportLayers,false);
    const s=normalizeSettings({...defaults,exportLayers:true,transparentBackground:false});
    assert.deepEqual(readDocument(makeDocument(s)),s);
    assert.deepEqual(createLayerScene(s),createLayerScene(defaults));
});
test('export plan keeps all layers, full size, ordering and safe unique Unicode filenames',()=>{
    const stack=getLayers(defaults).map((l,i)=>({...l,name:i<2?'../Имя:слой?':'CON',visible:i!==1,locked:i===2}));
    const s=withLayers({...defaults,exportScale:2,transparentBackground:true},stack),before=structuredClone(s),plan=layerExportPlan(s);
    assert.deepEqual(s,before);assert.equal(plan.entries.length,6);
    assert.deepEqual(plan.entries.map(e=>e.index),[5,4,3,2,1,0]);
    assert.equal(new Set(plan.entries.map(e=>e.name)).size,6);
    assert.ok(plan.entries[4].name.endsWith('-hidden.png'));
    for(const entry of plan.entries)assert.doesNotMatch(entry.name,/[<>:"/\\|?*\x00-\x1f]/);
    assert.equal(plan.settings.width,1920);assert.equal(plan.settings.exportScale,2);
    assert.throws(()=>layerExportPlan(withLayers({...defaults,transparentBackground:true},[])),/no layers/);
    assert.throws(()=>layerExportPlan({...defaults,width:8192,height:8192,exportScale:3}),/too large/);
});
test('Transparent PNG alone controls the separate Background entry, including an empty stack',()=>{
    const opaque=layerExportPlan({...defaults,exportLayers:true,transparentBackground:false});
    const transparent=layerExportPlan({...defaults,exportLayers:true,transparentBackground:true});
    assert.deepEqual(opaque.entries.slice(0,-1),transparent.entries);
    assert.deepEqual(opaque.entries.at(-1),{index:-1,name:'07-Background.png'});
    assert.deepEqual(layerExportPlan(withLayers(defaults,[])).entries,[{index:-1,name:'01-Background.png'}]);
    for(const exportLayers of [false,true])for(const transparentBackground of [false,true]) {
        const settings=normalizeSettings({...defaults,exportLayers,transparentBackground});
        assert.equal(settings.transparentBackground,transparentBackground);
        assert.equal(layerExportPlan(settings).entries.length,transparentBackground?6:7);
    }
});
test('ZIP is readable, keeps original bytes, CRCs and UTF-8 names across entries',async()=>{
    const zip=new StoredZipWriter();
    const entries=[{name:'01-Пятно.png',bytes:Uint8Array.from([0,1,2,255,128])},{name:'02-empty.png',bytes:new Uint8Array()}];
    for(const entry of entries)await zip.add(entry.name,new Blob([entry.bytes]));
    const blob=zip.toBlob();assert.equal(blob.type,'application/zip');
    const decoded=readStoredZip(new Uint8Array(await blob.arrayBuffer()));
    assert.equal(decoded.length,entries.length);
    decoded.forEach((file,i)=>{assert.equal(file.name,entries[i].name);assert.deepEqual(file.bytes,entries[i].bytes);assert.equal(file.checksum,crc32(file.bytes));});
});
test('failed ZIP entries cannot leave a partial corrupt directory',async()=>{
    const zip=new StoredZipWriter({maxBytes:200});await zip.add('a.png',new Blob(['abc']));
    await assert.rejects(zip.add('a.png',new Blob()),/Duplicate/);
    await assert.rejects(zip.add('../a.png',new Blob()),/plain filename/);
    await assert.rejects(zip.add('huge.png',new Blob([new Uint8Array(200)])),/too large/);
    await assert.rejects(zip.add('cancelled.png',new Blob(),{signal:AbortSignal.abort()}),{name:'AbortError'});
    const entries=readStoredZip(new Uint8Array(await zip.toBlob().arrayBuffer()));assert.deepEqual(entries.map(e=>e.name),['a.png']);
});
test('cancelled layer exports stop before rendering',async()=>{
    await assert.rejects(renderLayersZIP({render(){throw new Error('must not render');}},defaults,{signal:AbortSignal.abort()}),{name:'AbortError'});
});
