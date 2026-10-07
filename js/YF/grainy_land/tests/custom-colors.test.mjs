import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalizeSettings,makeDocument,readDocument,regenerate} from '../document.js';
import {MAX_CUSTOM_COLORS,addCustomColor,removeCustomColor,colorIsUsed,groupColor} from '../custom-colors.js';
import {getLayers,editLayer,duplicateLayer} from '../layers.js';
import {createLayerScene,adjacentColors,customMaterialColors} from '../scene.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';

test('custom colors retain stable assignments in both modes, JSON, shares and Generate',async()=>{
    const {settings,id}=addCustomColor(defaults);
    let s=editLayer(settings,'form-0',{group:id});
    s=editLayer({...s,mode:'abstract'},'form-2',{group:id});
    const copy=duplicateLayer(s,'form-2');s=copy.settings;
    assert.equal(getLayers(s).find(l=>l.id===copy.id).group,id);
    assert.equal(colorIsUsed(s,id),true);
    assert.equal(groupColor(s,id),'#80C9A1');
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))),s);
    const codec=new ShareCodec({pristineDefaults:defaults});
    assert.deepEqual(normalizeSettings((await codec.decode(await codec.encode(s))).full),s);
    const generated=regenerate(s,56);
    assert.deepEqual(generated.customColors,s.customColors);
    for(const key of ['landscapeLayers','abstractLayers'])assert.deepEqual(generated[key].map(l=>l.group),s[key].map(l=>l.group));
    assert.throws(()=>removeCustomColor(s,id),/another color/);
});
test('unused palette edits preserve geometry and original tones, and deletion never renumbers IDs',()=>{
    const first=addCustomColor(defaults),second=addCustomColor(first.settings);
    const removed=removeCustomColor(second.settings,first.id);
    assert.equal(removed.customColors[0].id,second.id);
    assert.equal(removed.customColors[0].name,'Custom 2');
    assert.deepEqual(createLayerScene(defaults),createLayerScene(removed));
    assert.deepEqual(adjacentColors(defaults),adjacentColors(removed));
    assert.deepEqual(defaults.customColors,[]);
    assert.deepEqual(normalizeSettings({}).customColors,[]);
    const refs=normalizeSettings({...removed,landscapeLayers:[{id:'test',source:6,group:'custom-missing'}]});
    assert.equal(refs.landscapeLayers[0].group,'sky');
});
test('imported palettes are bounded, validate hex and IDs, and leave referenced colors intact',()=>{
    const s=normalizeSettings({...defaults,customColors:[
        {id:'custom-green',name:'  Green  ',color:'#abc123'},
        {id:'custom-green',color:'#FFFFFF'},
        {id:'sky',color:'url(x)'},null,
        {id:'sky',name:'x'.repeat(100),color:'#000000'}
    ],landscapeLayers:[{id:'one',source:0,group:'custom-green'}]});
    assert.equal(s.customColors.length,2);assert.deepEqual(s.customColors[0],{id:'custom-green',name:'Green',color:'#ABC123'});
    assert.equal(s.customColors[1].name.length,32);assert.notEqual(s.customColors[1].id,'sky');
    assert.equal(s.landscapeLayers[0].group,'custom-green');
    let full=defaults;for(let i=0;i<MAX_CUSTOM_COLORS;i++)full=addCustomColor(full).settings;
    assert.throws(()=>addCustomColor(full),/Maximum/);assert.equal(full.customColors.length,MAX_CUSTOM_COLORS);
    assert.equal(normalizeSettings({...full,customColors:[...full.customColors,{id:'custom-extra',color:'#FFFFFF'}]}).customColors.length,MAX_CUSTOM_COLORS);
});
test('custom neighboring tones follow their own anchor and global character without out-of-gamut values',()=>{
    const s=addCustomColor(defaults).settings;
    for(const toneCharacter of ['pigment','pearlescent','radiant'])for(const color of ['#00FF00','#FF0099','#777777','#000000','#FFFFFF']) {
        const palette=customMaterialColors({...s,toneCharacter,customColors:[{...s.customColors[0],color}]});
        assert.equal(palette.length,1);assert.equal(palette[0].length,3);
        assert.ok(palette.flat(2).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
        if(color==='#777777')assert.ok(palette[0].every(rgb=>Math.max(...rgb)-Math.min(...rgb)<=1/255));
    }
    assert.notDeepEqual(customMaterialColors(s),customMaterialColors({...s,toneSpread:0}));
    assert.notDeepEqual(customMaterialColors(s),customMaterialColors({...s,toneCharacter:'pigment'}));
});
