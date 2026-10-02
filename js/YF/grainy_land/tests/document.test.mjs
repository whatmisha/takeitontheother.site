import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, palettes, normalizeSettings, makeDocument, readDocument, exportDimensions } from '../document.js';
import { createScene, paletteLUT, materialColors } from '../scene.js';

test('reference palettes start with the required editable blue', () => {
    assert.equal(defaults.sky, '#2353DB');
    for (const palette of Object.values(palettes)) assert.equal(palette.sky, '#2353DB');
    assert.equal(normalizeSettings({sky:'#abcdef'}).sky, '#ABCDEF');
});
test('JSON preserves seed, palette, dimensions and all appearance settings', () => {
    const s = normalizeSettings({...defaults,mode:'abstract',seed:4294967295,width:1400,height:900,glow:81,grainSize:2.3,sky:'#AABBCC'});
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))),s);
    assert.throws(() => readDocument({toolId:'other',schemaVersion:1,settings:{}}),/Grainy Land/);
    assert.throws(() => normalizeSettings({schemaVersion:2}),/version/);
    assert.throws(() => readDocument({toolId:'grainy_land',schemaVersion:1}),/Grainy Land/);
});
test('imported values cannot allocate unbounded surfaces or inject extra state', () => {
    const s = normalizeSettings({width:1e9,height:-1,seed:-1,grain:Infinity,glow:-100,grainSize:.23,mode:'bad',sky:'url(x)',unsafe:'x'});
    assert.equal(s.width,4096); assert.equal(s.height,256); assert.equal(s.seed,4294967295);
    assert.equal(s.grain,defaults.grain); assert.equal(s.glow,0); assert.equal(s.grainSize,.5);
    assert.equal(s.sky,defaults.sky); assert.equal(s.mode,'landscape'); assert.equal(s.unsafe,undefined);
});
test('geometry survives palette, grain, glow and export resolution changes', () => {
    const a = createScene(defaults);
    const b = createScene({...defaults,...palettes.ember,glow:100,grain:80,exportScale:3,width:3840,height:2160});
    assert.deepEqual(a,b);
    assert.deepEqual(createScene(defaults),a);
    assert.notDeepEqual(createScene({...defaults,seed:80424}),a);
    assert.equal(createScene({...defaults,mode:'abstract'}).mode,1);
});
test('generated fields and automatic half-tones remain finite across seeds', () => {
    for (let seed=0;seed<32;seed++) {
        const scene = createScene({...defaults,seed});
        assert.equal(scene.fields.length,6);
        assert.equal(scene.layers.length,6);
        assert.equal(scene.layerStyles.length,6);
        assert.ok(scene.layers.flat().every(Number.isFinite));
        assert.ok(scene.layerStyles.flat().every(Number.isFinite));
        assert.ok(scene.fields.flat().every(Number.isFinite));
        assert.ok(scene.phases.every(Number.isFinite));
    }
    for (const palette of Object.values(palettes)) {
        const lut = paletteLUT({...defaults,...palette});
        assert.equal(lut.length,1024);
        assert.ok(lut.filter((v,i) => i%4===3).every(v => v===255));
        assert.notDeepEqual([...lut.slice(0,3)],[...lut.slice(1020,1023)]);
    }
});
test('PNG dimensions are independent of viewport and oversized exports are rejected', () => {
    assert.deepEqual(exportDimensions({...defaults,exportScale:2}),{width:3840,height:2160});
    assert.deepEqual(exportDimensions({...defaults,exportScale:3}),{width:5760,height:3240});
    assert.throws(() => exportDimensions({...defaults,width:4096,height:4096,exportScale:3}),/too large/);
    assert.throws(() => exportDimensions({...defaults,width:4096,height:4096,exportScale:2}),/too large/);
});

test('derived material colors follow custom anchors and remain displayable', () => {
    const original = materialColors(defaults);
    assert.equal(original.length,6);
    for (const anchors of [palettes.pigment,palettes.ember,{terrain:'#000000',depth:'#FFFFFF',sky:'#FFFFFF',light:'#000000'}]) {
        const colors=materialColors({...defaults,...anchors});
        assert.ok(colors.flat().every(v => Number.isFinite(v) && v>=0 && v<=1));
    }
    assert.notDeepEqual(original,materialColors({...defaults,terrain:'#14A966',light:'#E8EEAA'}));
    assert.deepEqual(original,materialColors({...defaults,seed:1,glow:90,grain:0}));
});
