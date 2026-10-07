import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { defaults, palettes, toneKeys, presetTones, migrateTonePresets, migratePresets, normalizeSettings, makeDocument, readDocument, exportDimensions } from '../document.js';
import { createScene, paletteLUT, materialColors, adjacentColors, hexRGB } from '../scene.js';

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
    assert.equal(s.width,8192); assert.equal(s.height,1); assert.equal(s.seed,4294967295);
    assert.equal(s.grain,defaults.grain); assert.equal(s.glow,0); assert.equal(s.grainSize,.5);
    assert.equal(s.sky,defaults.sky); assert.equal(s.mode,'landscape'); assert.equal(s.unsafe,undefined);
});
test('geometry survives palette, grain, glow and export resolution changes', () => {
    const a = createScene(defaults);
    const b = createScene({...defaults,...palettes.ember,glow:100,grain:80,edgeVariation:0,glowCoverage:100,exportScale:3,width:3840,height:2160});
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
        assert.equal(scene.foldFields.length,6);
        assert.ok(scene.foldFields.flat().every(Number.isFinite));
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

test('tone settings round-trip and legacy files gain bounded defaults', () => {
    const s=normalizeSettings({...defaults,toneCharacter:'pearlescent',toneAmount:89,toneSpread:76,toneScale:141,toneBleed:65});
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))),s);
    const legacy=readDocument({toolId:'grainy_land',schemaVersion:1,settings:{seed:17,sky:'#234567'}});
    assert.equal(legacy.seed,17);assert.equal(legacy.sky,'#234567');assert.equal(legacy.toneAmount,defaults.toneAmount);
    const unsafe=normalizeSettings({toneCharacter:'__proto__',toneAmount:900,toneScale:-50,toneSpread:NaN,toneBleed:Infinity});
    assert.equal(unsafe.toneCharacter,defaults.toneCharacter);assert.equal(unsafe.toneAmount,100);assert.equal(unsafe.toneScale,20);
    assert.equal(unsafe.toneSpread,defaults.toneSpread);assert.equal(unsafe.toneBleed,defaults.toneBleed);
});
test('all tone controls are independent of the seeded geometry', () => {
    const scene=createScene(defaults);
    assert.deepEqual(scene,createScene({...defaults,toneCharacter:'radiant',toneAmount:100,toneSpread:100,toneScale:20,toneBleed:100}));
});
test('adjacent colors remain finite, follow anchors, and keep neutral palettes neutral', () => {
    for(const toneCharacter of ['pigment','pearlescent','radiant']) for(const toneSpread of [0,50,100]) {
        for(const palette of [palettes.pigment,palettes.ember,{sky:'#FFFFFF',terrain:'#000000',depth:'#FFFFFF',light:'#000000'}]) {
            const colors=adjacentColors({...defaults,...palette,toneCharacter,toneSpread});
            assert.equal(colors.length,8);
            assert.ok(colors.flat().every(v => Number.isFinite(v) && v>=0 && v<=1));
        }
        const gray=adjacentColors({...defaults,sky:'#777777',terrain:'#AAAAAA',depth:'#222222',light:'#EEEEEE',toneCharacter,toneSpread});
        assert.ok(gray.every(rgb => Math.max(...rgb)-Math.min(...rgb)<=1/255));
    }
    assert.notDeepEqual(adjacentColors(defaults),adjacentColors({...defaults,terrain:'#128833',light:'#9988AA',sky:'#DEAD00'}));
    assert.notDeepEqual(adjacentColors({...defaults,toneSpread:0}),adjacentColors({...defaults,toneSpread:100}));
});
test('stored preset migration backfills new fields without changing user choices', () => {
    const old={seeded:true,seed:80423,terrain:'#123456',toneAmount:27};
    let all={Ember:structuredClone(old),Personal:{seed:18},Pigment:{seed:20,toneCharacter:'pearlescent'}};
    let writes=0;const store={loadAll:()=>all,saveAll:next=>{all=next;writes++;}};
    migrateTonePresets(store);
    assert.equal(all.Ember.toneCharacter,'radiant');assert.equal(all.Ember.toneAmount,27);
    assert.equal(all.Ember.terrain,'#123456');assert.equal(all.Ember.seed,80423);
    assert.deepEqual(all.Personal,{seed:18});assert.deepEqual(all.Pigment,{seed:20,toneCharacter:'pearlescent'});
    migrateTonePresets(store);assert.equal(writes,1);
});

test('default settings match the shipped Ember and cached built-ins update without touching saved presets', () => {
    const ember = JSON.parse(readFileSync(new URL('../presets/ember.json', import.meta.url), 'utf8'));
    assert.deepEqual(defaults, ember);
    assert.deepEqual(normalizeSettings(ember), ember);
    const pigment = { seeded: true, seed: 80423, depth: '#713004', toneCharacter:'pigment' };
    const drift = JSON.parse(readFileSync(new URL('../presets/drift.json', import.meta.url), 'utf8'));
    assert.deepEqual(drift, {...ember,mode:'abstract'});
    const manifest = JSON.parse(readFileSync(new URL('../presets/manifest.json', import.meta.url), 'utf8'));
    assert.deepEqual(manifest.presets.map(p=>p.name), ['Ember','Drift','Quiet dunes']);
    const personal = { seed: 9, glow: 33 };
    let all = { Ember: { seeded: true, createdAt: 123, seed: 80423, glow: 82, ...presetTones.Ember }, Pigment: pigment, Drift: {seeded:true,createdAt:456,seed:925731,scale:125,glow:34,...presetTones.Drift}, Personal: personal };
    let writes = 0;
    const store = { loadAll: () => all, saveAll: next => { all = next; writes++; } };
    migratePresets(store);
    assert.deepEqual(normalizeSettings(all.Ember), ember);
    assert.equal(all.Ember.createdAt, 123);
    assert.equal(Object.hasOwn(all,'Pigment'),false);
    assert.deepEqual(normalizeSettings(all.Drift), drift);
    assert.equal(all.Drift.createdAt,456);
    assert.deepEqual(all.Personal, personal);
    migratePresets(store);
    assert.equal(writes, 1);
    all.Ember = { ...personal };
    all.Drift = { ...personal,seeded:false };
    all.Pigment = { ...personal,seeded:false };
    migratePresets(store);
    assert.deepEqual(all.Ember, personal);
    assert.deepEqual(all.Drift, {...personal,seeded:false});
    assert.deepEqual(all.Pigment, {...personal,seeded:false});
    assert.equal(writes, 1);
});

test('fold and edge controls round-trip, and old documents receive safe defaults', () => {
    const custom=normalizeSettings({...defaults,folds:91,edgeVariation:17,glowCoverage:82});
    assert.deepEqual(readDocument(makeDocument(custom)),custom);
    const old={...defaults};
    for(const key of ['folds','edgeVariation','glowCoverage']) delete old[key];
    const upgraded=readDocument({toolId:'grainy_land',schemaVersion:1,settings:old});
    for(const key of ['folds','edgeVariation','glowCoverage']) assert.equal(upgraded[key],defaults[key]);
    const bounded=normalizeSettings({folds:-30,edgeVariation:700,glowCoverage:Infinity});
    assert.equal(bounded.folds,0);assert.equal(bounded.edgeVariation,100);assert.equal(bounded.glowCoverage,defaults.glowCoverage);
});


test('all shipped depths migrate once while personal colors and other settings survive', () => {
    const manifest=JSON.parse(readFileSync(new URL('../presets/manifest.json',import.meta.url),'utf8'));
    let all={Personal:{depth:'#713004'}};
    for(const {name,file} of manifest.presets) {
        const preset=JSON.parse(readFileSync(new URL('../presets/'+file,import.meta.url),'utf8'));
        assert.equal(preset.depth,'#FF5900');
        all[name]={...preset,seeded:true,depth:'#713004'};
    }
    const old=structuredClone(all);let writes=0;
    const store={loadAll:()=>all,saveAll:value=>{all=value;writes++;}};
    migratePresets(store);
    for(const {name} of manifest.presets) assert.deepEqual(all[name],{...old[name],depth:'#FF5900'});
    assert.deepEqual(all.Personal,old.Personal);
    migratePresets(store);assert.equal(writes,1);
    all['Quiet dunes']={...old['Quiet dunes'],seeded:false};migratePresets(store);
    assert.equal(all['Quiet dunes'].depth,'#713004');assert.equal(writes,1);
});


test('layout choices round-trip and Auto yields all four reproducible families', () => {
    const families=new Set();
    for(let seed=0;seed<64;seed++) families.add(createScene({...defaults,seed}).layoutFamily);
    assert.equal(families.size,4);
    for(const [family,layout] of ['basin','ridge','valley','fold'].entries()) {
        const settings={...defaults,layout};
        assert.equal(readDocument(makeDocument(settings)).layout,layout);
        assert.equal(createScene(settings).layoutFamily,family);
        assert.deepEqual(createScene(settings),createScene(settings));
        assert.ok(createScene(settings).secondCrest.every(Number.isFinite));
        assert.ok(createScene(settings).pocketStyle.every(Number.isFinite));
    }
    assert.equal(normalizeSettings({layout:'__proto__'}).layout,'auto');
    assert.equal(normalizeSettings({}).layout,'auto');
    assert.deepEqual(createScene({...defaults,mode:'abstract',layout:'fold'}),createScene({...defaults,mode:'abstract',layout:'ridge'}));
});


test('manual endpoints round-trip, sanitize independently, and legacy documents remain automatic', () => {
    const overrides = Object.fromEntries(toneKeys.map((key, i) => [key, ['#aabbcc','#234567','#ffffff','#000000','#123456','#fedcba','#14349b','#4c79ef'][i]]));
    const settings = normalizeSettings({...defaults, ...overrides});
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(settings)))), settings);
    toneKeys.forEach(key => assert.equal(settings[key], overrides[key].toUpperCase()));
    const legacy = {...defaults};
    toneKeys.forEach(key => delete legacy[key]);
    const restored = readDocument({toolId:'grainy_land',schemaVersion:1,settings:legacy});
    assert.deepEqual(adjacentColors(restored), adjacentColors(defaults));
    const invalid = normalizeSettings({terrainLow:'url(x)',depthLow:[],lightLow:123,terrainHigh:'#FFF',depthHigh:'#GGGGGG',lightHigh:null});
    toneKeys.forEach(key => assert.equal(invalid[key], null));
});

test('fixed tones survive palette and character changes while untouched endpoints keep following anchors', () => {
    const settings = {...defaults,terrainLow:'#128833',lightHigh:'#DEAD00'};
    const changed = {...settings,...palettes.pigment,toneCharacter:'pearlescent',toneSpread:100};
    const original = adjacentColors(settings), next = adjacentColors(changed);
    assert.deepEqual(next[0], hexRGB('#128833'));
    assert.deepEqual(next[5], hexRGB('#DEAD00'));
    assert.notDeepEqual(original[3], next[3]);
    assert.deepEqual(createScene(settings), createScene(defaults));
    const reset = adjacentColors({...changed,terrainLow:null,lightHigh:null});
    assert.deepEqual(reset, adjacentColors({...defaults,...palettes.pigment,toneCharacter:'pearlescent',toneSpread:100}));
    assert.deepEqual(adjacentColors({...settings,seed:123}), original);
});

test('transparent PNG is opt-in, survives documents, and does not change geometry',()=>{
    assert.equal(normalizeSettings({}).transparentBackground,false);
    for(const value of ['true',1,null])assert.equal(normalizeSettings({transparentBackground:value}).transparentBackground,false);
    const transparent=normalizeSettings({...defaults,transparentBackground:true});
    assert.deepEqual(readDocument(makeDocument(transparent)),transparent);
    assert.deepEqual(createScene(transparent),createScene(defaults));
});


test('background tones opt in independently, keep geometry and round-trip with custom endpoints',()=>{
    assert.equal(normalizeSettings({}).skyToneAmount,0);
    const s=normalizeSettings({...defaults,skyToneAmount:72,skyLow:'#113399',skyHigh:'#55aaff'});
    assert.equal(s.skyHigh,'#55AAFF');
    assert.deepEqual(readDocument(makeDocument(s)),s);
    assert.deepEqual(createScene(s),createScene(defaults));
    assert.deepEqual(adjacentColors(s).slice(0,6),adjacentColors(defaults).slice(0,6));
    assert.deepEqual(adjacentColors(s).slice(6),[hexRGB(s.skyLow),hexRGB(s.skyHigh)]);
    assert.deepEqual(adjacentColors({...s,sky:'#ff7700',toneSpread:10}).slice(6),adjacentColors(s).slice(6));
    assert.notDeepEqual(adjacentColors({...s,skyLow:null,skyHigh:null}).slice(6),adjacentColors(s).slice(6));
    assert.equal(normalizeSettings({skyToneAmount:120}).skyToneAmount,100);
    assert.equal(normalizeSettings({skyToneAmount:-1}).skyToneAmount,0);
});
