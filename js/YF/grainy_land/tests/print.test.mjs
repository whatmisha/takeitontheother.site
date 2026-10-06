import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { defaults,normalizeSettings,makeDocument,readDocument,exportDimensions,regenerate } from '../document.js';
import { editCanvas } from '../canvas-size.js';
import { createLayerScene } from '../scene.js';
import { withPngDpi } from '../png-export.js';
import { ShareCodec } from '../../infra/framework/src/preset/ShareCodec.js';

test('units preserve exported pixels, including existing 2x and 3x documents',()=>{
    for(const exportScale of [1,2,3]) {
        const screen=normalizeSettings({...defaults,exportScale}),print=normalizeSettings(editCanvas(screen,{canvasUnit:'mm'}));
        assert.deepEqual(exportDimensions(print),exportDimensions(screen));
        assert.equal(print.exportScale,1);assert.equal(print.dpi,300);
        assert.deepEqual(createLayerScene(print),createLayerScene(screen));
        const back=normalizeSettings(editCanvas(print,{canvasUnit:'px'}));
        assert.deepEqual(exportDimensions(back),exportDimensions(screen));
        assert.equal(back.printWidthMM,null);assert.equal(back.printHeightMM,null);
        for(let i=0,current=back;i<20;i++) {
            current=editCanvas(editCanvas(current,{canvasUnit:'mm'}),{canvasUnit:'px'});
            assert.deepEqual(exportDimensions(current),exportDimensions(screen));
        }
    }
});
test('millimetres drive resolution; changing DPI retains print size and layer geometry',()=>{
    const a4=normalizeSettings({...defaults,canvasUnit:'mm',printWidthMM:210,printHeightMM:297,dpi:300,exportScale:3});
    assert.deepEqual(exportDimensions(a4),{width:2480,height:3508});
    const half=normalizeSettings(editCanvas(a4,{dpi:150}));
    assert.equal(half.printWidthMM,210);assert.equal(half.printHeightMM,297);
    assert.deepEqual(exportDimensions(half),{width:1240,height:1754});
    assert.deepEqual(createLayerScene(half),createLayerScene(a4));
    assert.deepEqual(editCanvas(half,{dpi:300}),a4);
    const a3=normalizeSettings({...a4,printWidthMM:297,printHeightMM:420});
    assert.deepEqual(exportDimensions(a3),{width:3508,height:4961});
});
test('invalid or oversized print settings are rejected before changing the artwork',()=>{
    const s=editCanvas(defaults,{canvasUnit:'mm'}),before=structuredClone(s);
    assert.throws(()=>editCanvas(s,{printWidthMM:1000}),/too large/);
    assert.throws(()=>normalizeSettings({...s,printWidthMM:300,printHeightMM:300,dpi:600}),/too large/);
    assert.throws(()=>readDocument({toolId:'grainy_land',schemaVersion:1,settings:{...s,printWidthMM:6000,dpi:1200}}),/too large/);
    assert.deepEqual(s,before);
    const unsafe=normalizeSettings({...s,dpi:Infinity,printWidthMM:'bad',printHeightMM:null});
    assert.equal(unsafe.dpi,300);assert.ok(unsafe.width>0 && unsafe.height>0);
    assert.equal(normalizeSettings({dpi:-1}).dpi,36);
    assert.equal(normalizeSettings({dpi:5000}).dpi,1200);
});
test('print settings survive snapshots, Generate, JSON and share links; legacy documents stay in pixels',async()=>{
    const s=normalizeSettings({...defaults,canvasUnit:'mm',printWidthMM:297,printHeightMM:210,dpi:300});
    assert.deepEqual(normalizeSettings(s),s);
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))),s);
    const codec=new ShareCodec({pristineDefaults:defaults}),encoded=await codec.encode(s);
    assert.deepEqual(normalizeSettings((await codec.decode(encoded)).full),s);
    const next=regenerate(s,72);for(const key of ['width','height','canvasUnit','printWidthMM','printHeightMM','dpi'])assert.equal(next[key],s[key]);
    const old=readDocument({toolId:'grainy_land',schemaVersion:1,settings:{width:1920,height:1080,exportScale:2}});
    assert.equal(old.canvasUnit,'px');assert.deepEqual(exportDimensions(old),{width:3840,height:2160});
});
const original=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64')],{type:'image/png'});
async function chunks(blob){const bytes=Buffer.from(await blob.arrayBuffer()),out=[];for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at);out.push({type:bytes.toString('ascii',at+4,at+8),data:bytes.subarray(at+8,at+8+length),crc:bytes.readUInt32BE(at+8+length),raw:bytes.subarray(at,at+12+length)});at+=12+length;}return out;}
test('PNG physical density replaces browser metadata with a valid CRC and leaves image bytes untouched',async()=>{
    const stamped=await withPngDpi(original,300),first=await chunks(stamped),old=await chunks(original);
    assert.equal(stamped.type,'image/png');
    assert.deepEqual(first.filter(c=>c.type!=='pHYs').map(c=>c.raw),old.map(c=>c.raw));
    assert.equal(first[1].type,'pHYs');const physical=first[1];
    assert.equal(physical.data.readUInt32BE(0),11811);assert.equal(physical.data.readUInt32BE(4),11811);assert.equal(physical.data[8],1);
    assert.equal(physical.crc,crc32(Buffer.concat([Buffer.from('pHYs'),physical.data])));
    const second=await chunks(await withPngDpi(stamped,150));
    assert.equal(second.filter(c=>c.type==='pHYs').length,1);
    assert.equal(second[1].data.readUInt32BE(0),5906);
    assert.deepEqual(second.filter(c=>c.type!=='pHYs').map(c=>c.raw),old.map(c=>c.raw));
});
test('PNG metadata rejects invalid input and out-of-range density',async()=>{
    await assert.rejects(withPngDpi(new Blob(['no image']),300),/Invalid PNG/);
    await assert.rejects(withPngDpi(original.slice(0,20),300),/Truncated/);
    await assert.rejects(withPngDpi(original,0),/DPI/);
    await assert.rejects(withPngDpi(original,Infinity),/DPI/);
});
