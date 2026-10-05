import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults, normalizeSettings, makeDocument, readDocument, editForm, formEdit, regenerate} from '../document.js';
import {createScene} from '../scene.js';
import {visibleBounds, resizedForm, FormEditor} from '../form-editor.js';

const geometry = (scene,i) => Object.fromEntries(['layers','layerStyles','foldFields','fields','formPhases','formTransforms','formSeeds'].map(key=>[key,scene[key][i]]));
test('editing one form leaves every other generated surface untouched',()=>{
    const original=createScene(defaults), edited=createScene(editForm(defaults,2,{x:.15,y:-.1,scaleX:1.5,scaleY:.8,locked:true}));
    for(let i=0;i<6;i++) if(i!==2)assert.deepEqual(geometry(edited,i),geometry(original,i));
    assert.deepEqual(edited.formTransforms[2],[.15,-.1,1.5,.8]);
    assert.deepEqual(edited.layers[2],original.layers[2]);
    assert.deepEqual(createScene(editForm(defaults,2,null)),original);
});
test('Generate keeps locked source geometry, transforms and random material fields',()=>{
    let settings=editForm(defaults,0,{x:.1,locked:true});
    settings=editForm(settings,4,{scaleY:1.4,locked:true});
    settings=editForm(settings,2,{y:.2,locked:false});
    const next=regenerate(settings,7),before=createScene(settings),after=createScene(next);
    for(const i of [0,4])assert.deepEqual(geometry(after,i),geometry(before,i));
    assert.deepEqual(after.secondCrest,before.secondCrest);
    assert.deepEqual(after.pocketStyle,before.pocketStyle);
    assert.equal(next.landscapeForms[2],null);
    assert.notDeepEqual(after.layers[1],before.layers[1]);
    assert.deepEqual(after.layers[2],createScene({...defaults,seed:7}).layers[2]);
});
test('landscape and abstract edits are independent and survive document round trips',()=>{
    let s=editForm(defaults,1,{x:.1,locked:true});
    s=editForm({...s,mode:'abstract'},5,{y:-.12,scaleX:2,locked:true});
    assert.equal(s.landscapeForms[1].x,.1);assert.equal(s.abstractForms[5].y,-.12);
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))),s);
    const next=regenerate(s,44);
    assert.deepEqual(next.landscapeForms,s.landscapeForms);assert.deepEqual(next.abstractForms,s.abstractForms);
    assert.deepEqual(createScene({...s,landscapeForms:null}),createScene(s));
});
test('old documents remain unedited and malformed transforms are bounded',()=>{
    const legacy=readDocument({toolId:'grainy_land',schemaVersion:1,settings:{seed:17}});
    assert.equal(legacy.landscapeForms,null);assert.equal(legacy.abstractForms,null);
    const malformed=normalizeSettings({landscapeForms:[{seed:-1,x:1e9,y:-1e9,scaleX:0,scaleY:Infinity,locked:'true',layout:'__proto__'},[],{seed:'4'},null,{seed:NaN}],abstractForms:{}});
    assert.deepEqual(malformed.landscapeForms[0],{seed:4294967295,x:1,y:-1,scaleX:.25,scaleY:1,locked:false,layout:'auto'});
    assert.ok(malformed.landscapeForms.slice(1).every(x=>x===null));assert.equal(malformed.abstractForms,null);
    assert.throws(()=>editForm(defaults,6,{}),RangeError);
    const saved=editForm(defaults,0,{locked:true});
    const reset=editForm(saved,0,null);
    assert.equal(reset.landscapeForms,null);assert.equal(saved.landscapeForms[0].locked,true);
});
test('unlock keeps the current form until the next Generate',()=>{
    let s=regenerate(editForm(defaults,0,{x:.2,locked:true}),55);
    const locked=createScene(s);
    s=editForm(s,0,{locked:false});
    assert.deepEqual(createScene(s),locked);
    assert.equal(formEdit(s,0).seed,defaults.seed);
    const next=regenerate(s,66);
    assert.equal(next.landscapeForms,null);
    assert.deepEqual(createScene(next),createScene({...defaults,seed:66}));
});
test('bounds follow visible pixels and distinguish background from covered forms',()=>{
    const map={width:4,height:3,ids:Uint8Array.from([0,1,1,0,0,2,1,0,3,3,3,3])};
    assert.deepEqual(visibleBounds(map,0),{left:.25,top:0,right:.75,bottom:2/3});
    assert.deepEqual(visibleBounds(map,2),{left:0,top:2/3,right:1,bottom:1});
    assert.equal(visibleBounds(map,5),null);
});

test('resizing preserves the chosen center while bounding scale',()=>{
    const edit={x:.12,y:-.08,scaleX:1.4,scaleY:.8},center=[.7,.6];
    const next=resizedForm(edit,.5,50,center);
    assert.equal(next.scaleX,.5);assert.equal(next.scaleY,3);
    for(const [axis,scale,i] of [['x','scaleX',0],['y','scaleY',1]]) {
        const original=(center[i]-.5-edit[axis])/edit[scale];
        const resized=(center[i]-.5-next[axis])/next[scale];
        assert.ok(Math.abs(original-resized)<1e-12);
    }
});
test('cancelling a drag restores its starting snapshot and releases capture',()=>{
    const editor=Object.create(FormEditor.prototype),calls=[],snapshot={seed:42};
    editor.gesture={started:true,pointerId:7,snapshot};
    editor.container={hasPointerCapture:id=>id===7,releasePointerCapture:id=>calls.push(['release',id])};
    editor.tool={applySnapshot:value=>calls.push(['restore',value]),history:{endTransaction:()=>calls.push(['end'])}};
    editor.cancel();editor.cancel();
    assert.equal(editor.gesture,null);
    assert.deepEqual(calls,[['restore',snapshot],['end'],['release',7]]);
});
