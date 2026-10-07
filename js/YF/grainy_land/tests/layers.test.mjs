import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults as currentDefaults,normalizeSettings,editForm,regenerate,makeDocument,readDocument} from '../document.js';
import {getLayers,MAX_LAYERS,editLayer,withLayers,addLayer,addBlueLayers,duplicateLayer,removeLayer,reorderLayer,convertLayer} from '../layers.js';
import {createLayerScene} from '../scene.js';
import {ShareCodec} from '../../infra/framework/src/preset/ShareCodec.js';
const defaults={...currentDefaults,blueLayers:false};
const stroke={kind:'paint',rx:.1,ry:.15,points:[[.3,.2],[.6,.3]]};
const shape=l=>Object.fromEntries(['seed','source','strokes','phases','transform','field','shape','style','foldField','crest','pocket','geometryA','geometryB'].map(k=>[k,l[k]]));
test('legacy forms become six layers with old Lock meaning Pinned, never editing Lock',()=>{
    const legacy=editForm(defaults,2,{x:.12,locked:true,strokes:[stroke]});
    const stack=getLayers(legacy);
    assert.equal(stack.length,6);assert.equal(stack[2].mode,'pinned');assert.equal(stack[2].locked,false);
    assert.equal(stack[2].x,.12);assert.deepEqual(stack[2].strokes,[stroke]);
    const migrated=withLayers(legacy,stack);
    assert.equal(migrated.landscapeForms,null);
    assert.deepEqual(createLayerScene(migrated),createLayerScene(legacy));
});
test('new drawn layers start empty and stay independent of generation controls',()=>{
    const {settings,id}=addLayer(defaults),blank=getLayers(settings).at(-1);
    assert.equal(blank.id,id);assert.equal(blank.mode,'drawn');assert.equal(blank.hasBase,false);assert.deepEqual(blank.strokes,[]);
    const painted=editLayer(settings,id,{strokes:[stroke]},{manual:true});
    const before=shape(createLayerScene(painted).at(-1));
    const after=regenerate({...painted,scale:210,flow:0,horizon:15,folds:0,complexity:6,relief:0},42);
    assert.deepEqual(shape(createLayerScene(after).at(-1)),before);
});
test('manual geometry edits pin automatically; appearance and names stay Auto',()=>{
    let s=editLayer(defaults,'form-0',{name:'Peak',opacity:60,group:'light'});
    assert.equal(getLayers(s)[0].mode,'auto');
    s=editLayer(s,'form-0',{x:.15,strokes:[stroke]},{manual:true});
    const pinned=getLayers(s)[0];assert.equal(pinned.mode,'pinned');
    assert.deepEqual(getLayers(regenerate(s,9))[0],pinned);
    const released=editLayer(s,'form-0',{mode:'auto'});
    assert.equal(getLayers(released)[0].x,.15);
    const rerolled=getLayers(regenerate(released,9))[0];
    assert.equal(rerolled.seed,9);assert.equal(rerolled.x,0);assert.deepEqual(rerolled.strokes,[]);
    assert.equal(rerolled.name,'Peak');assert.equal(rerolled.opacity,60);assert.equal(rerolled.group,'light');
});
test('Lock blocks manual changes and deletion while generation still follows mode',()=>{
    const s=editLayer(defaults,'form-0',{locked:true});
    assert.deepEqual(editLayer(s,'form-0',{x:.3},{manual:true}),s);
    assert.deepEqual(editLayer(s,'form-0',{opacity:0}),s);
    assert.deepEqual(removeLayer(s,'form-0'),s);
    assert.deepEqual(reorderLayer(s,'form-0','form-5'),s);
    assert.deepEqual(convertLayer(s,'form-0'),s);
    assert.equal(getLayers(regenerate(s,123))[0].seed,123);
    assert.equal(getLayers(editLayer(s,'form-0',{visible:false}))[0].visible,false);
    assert.equal(getLayers(editLayer(s,'form-0',{locked:false}))[0].locked,false);
});
test('conversion preserves a transformed, painted silhouette and freezes all geometry controls',()=>{
    const s=editLayer(defaults,'form-4',{x:.12,scaleX:1.3,strokes:[stroke]},{manual:true});
    const before=shape(createLayerScene(s)[4]),converted=convertLayer(s,'form-4');
    assert.equal(getLayers(converted)[4].mode,'drawn');assert.equal(getLayers(converted)[4].hasBase,true);
    assert.deepEqual(shape(createLayerScene(converted)[4]),before);
    assert.deepEqual(shape(createLayerScene(regenerate({...converted,scale:40,complexity:6,flow:0,folds:0,horizon:15,relief:0},88))[4]),before);
});
test('reordering changes only compositing order; duplication creates an independent pinned copy',()=>{
    const s=editLayer(defaults,'form-2',{strokes:[stroke]},{manual:true});
    const reordered=reorderLayer(s,'form-0','form-5','before');
    assert.equal(getLayers(reordered).at(-1).id,'form-0');
    for(const layer of createLayerScene(s))assert.deepEqual(shape(createLayerScene(reordered).find(l=>l.id===layer.id)),shape(layer));
    const copy=duplicateLayer(reordered,'form-0');
    assert.equal(getLayers(copy.settings).at(-1).id,copy.id);assert.equal(getLayers(copy.settings).at(-1).mode,'pinned');
    const changed=editLayer(copy.settings,copy.id,{x:.3},{manual:true});
    assert.equal(getLayers(changed).find(l=>l.id==='form-0').x,0);
});
test('deleted layers and empty stacks stay deleted after Generate, normalize, JSON and mode changes',()=>{
    let s=defaults;for(const l of getLayers(s))s=removeLayer(s,l.id);
    assert.deepEqual(getLayers(s),[]);assert.deepEqual(getLayers(regenerate(s,17)),[]);
    assert.deepEqual(getLayers(readDocument(makeDocument(s))),[]);
    const other=addLayer({...s,mode:'abstract'}).settings;
    assert.equal(getLayers(other).length,7);assert.deepEqual(getLayers({...other,mode:'landscape'}),[]);
});
test('layer stacks round-trip through JSON and share links with every mode and property',async()=>{
    let s=editLayer(defaults,'form-0',{x:.1,visible:false,opacity:45,name:'Distant peak'},{manual:true});
    s=convertLayer(s,'form-1');s=editLayer(s,'form-1',{locked:true});s=addLayer(s).settings;
    s=addLayer({...s,mode:'abstract'},'auto').settings;
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))),s);
    const codec=new ShareCodec({pristineDefaults:defaults}),encoded=await codec.encode(s);
    assert.deepEqual(normalizeSettings((await codec.decode(encoded)).full),s);
});
test('untrusted stacks have bounded counts, transforms, geometry and stable unique IDs',()=>{
    const bad=normalizeSettings({landscapeLayers:Array.from({length:40},()=>({id:'a'.repeat(64),name:'b'.repeat(500),source:90,opacity:-2,scaleX:Infinity,mode:'drawn',geometry:{scale:Infinity,flow:-9},strokes:[stroke]}))});
    const stack=getLayers(bad);assert.equal(stack.length,MAX_LAYERS);assert.equal(new Set(stack.map(l=>l.id)).size,MAX_LAYERS);
    assert.ok(stack.every(l=>l.id.length<=64&&l.name.length<=64&&l.source===7&&l.opacity===0&&l.scaleX===1));
    assert.deepEqual(normalizeSettings(bad),bad);assert.throws(()=>addLayer(bad),/Maximum/);
    const points=Array.from({length:16},()=>[-7.12345,-7.12345]);
    const strokes=Array.from({length:64},()=>({...stroke,rx:1.23456,ry:1.23456,points}));
    const max={...bad,abstractLayers:stack.map(l=>({...l,strokes})),landscapeLayers:stack.map(l=>({...l,strokes}))};
    assert.ok(Buffer.byteLength(JSON.stringify(makeDocument(max),null,2))<4*1024*1024);
});


test('new templates include two independent blue coats below the six original layers; old documents stay unchanged',()=>{
    for(const mode of ['landscape','abstract']) {
        const s={...currentDefaults,mode},stack=getLayers(s),scene=createLayerScene(s);
        assert.equal(stack.length,8);
        assert.deepEqual(stack.slice(0,2).map(l=>[l.id,l.source,l.group]),[['blue-1',6,'sky'],['blue-2',7,'sky']]);
        assert.ok(scene.slice(0,2).every(l=>l.info[1]===3&&l.field.every(Number.isFinite)));
        assert.deepEqual(scene.slice(2),createLayerScene({...s,blueLayers:false}));
        assert.deepEqual(readDocument(makeDocument(s)),normalizeSettings(s));
    }
    const legacy={...currentDefaults};delete legacy.blueLayers;
    assert.equal(getLayers(readDocument(makeDocument(legacy))).length,6);
    assert.deepEqual(getLayers(withLayers(currentDefaults,[])),[]);
});
test('blue coats support Pin, Lock, Drawn conversion, paint, reorder, delete and share links',async()=>{
    let s=editLayer(currentDefaults,'blue-1',{x:.12,strokes:[stroke]},{manual:true});
    const pinned=getLayers(s)[0];assert.equal(pinned.mode,'pinned');
    assert.deepEqual(getLayers(regenerate(s,99))[0],pinned);
    const converted=convertLayer(s,'blue-1'),frozen=shape(createLayerScene(converted)[0]);
    assert.deepEqual(shape(createLayerScene(regenerate({...converted,scale:210,flow:0,horizon:15,folds:0},100))[0]),frozen);
    assert.deepEqual(shape(createLayerScene(reorderLayer(s,'blue-1','form-5')).at(-1)),shape(createLayerScene(s)[0]));
    s=editLayer(s,'blue-1',{locked:true});assert.deepEqual(removeLayer(s,'blue-1'),s);
    const codec=new ShareCodec({pristineDefaults:currentDefaults});
    assert.deepEqual(normalizeSettings((await codec.decode(await codec.encode(s))).full),s);
    s=editLayer(s,'blue-1',{locked:false});s=removeLayer(removeLayer(s,'blue-1'),'blue-2');
    assert.equal(getLayers(regenerate(s,777)).length,6);
});
test('adding blue pairs is atomic, preserves existing layers and uses independent source seeds',()=>{
    const before=structuredClone(defaults),added=addBlueLayers(defaults),stack=getLayers(added.settings);
    assert.deepEqual(defaults,before);assert.deepEqual(stack.slice(2),getLayers(defaults));
    assert.equal(stack.length,8);assert.equal(added.id,'blue-2');
    const again=addBlueLayers(added.settings),next=getLayers(again.settings);
    assert.equal(next.length,10);assert.equal(new Set(next.map(l=>l.id)).size,10);
    assert.notEqual(next[0].seed,next[2].seed);
    let full=again.settings;while(getLayers(full).length<MAX_LAYERS-1)full=addLayer(full).settings;
    const snapshot=structuredClone(full);assert.throws(()=>addBlueLayers(full),/Two free/);assert.deepEqual(full,snapshot);
});
