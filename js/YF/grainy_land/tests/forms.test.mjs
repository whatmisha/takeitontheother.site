import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults as currentDefaults, normalizeSettings, makeDocument, readDocument, editForm, formEdit, regenerate} from '../document.js';
import {createScene} from '../scene.js';
import {getLayers, addLayer} from '../layers.js';
import {visibleBounds, resizedForm, FormEditor} from '../form-editor.js';
const defaults={...currentDefaults,blueLayers:false};

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

// Exercise pointer gestures against real layer settings, without a WebGL context.
function pointerEditor() {
    const editor=Object.create(FormEditor.prototype),events=[];
    const added=addLayer(defaults,'drawn');let settings=added.settings;
    Object.assign(editor,{selected:added.id,active:true,paintTool:'paint',brushSize:18,gesture:null});
    editor.container={focus(){},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){events.push('release');}};
    editor.tool={get settings(){return settings;},target:{zoom:1},getSnapshot:()=>settings,
        applySnapshot:s=>{settings=s;},settingsStore:{set:(key,value)=>{settings={...settings,[key]:value};}},
        history:{flush(){},beginTransaction:label=>events.push(label),endTransaction:()=>events.push('end')}};
    editor.point=e=>e.point;editor.cursorAt=()=>{};editor.report=()=>{};
    editor.select=id=>{editor.cancel();editor.selected=id;editor.active=id!=null;};
    editor.refreshMap=()=>{};editor.map={width:2,height:2,ids:Uint8Array.from([0,0,1,1])};
    const pointer=point=>({point,pointerId:7,button:0,preventDefault(){}});
    return {editor,events,pointer};
}
test('an empty brush click deselects without paint or an undo entry',()=>{
    const {editor,events,pointer}=pointerEditor(),before=editor.tool.getSnapshot();
    editor.start(pointer([.2,.2]));editor.finish(pointer([.2,.2]));
    assert.equal(editor.selected,null);assert.equal(editor.active,false);
    assert.deepEqual(editor.tool.getSnapshot(),before);assert.deepEqual(events,['release']);
});
test('a brush drag from empty space draws in one transaction and remains selected',()=>{
    const {editor,events,pointer}=pointerEditor(),id=editor.selected;
    editor.start(pointer([.2,.2]));editor.move(pointer([.35,.2]));editor.finish(pointer([.4,.2]));
    assert.equal(editor.selected,id);assert.equal(editor.layer().strokes.length,1);
    assert.ok(editor.layer().strokes[0].points.length>=2);
    assert.deepEqual(events,['Brush stroke','end','release']);
});
test('deselected brush can select an object without marking it; outside click clears it',()=>{
    const {editor,pointer}=pointerEditor(),before=editor.tool.getSnapshot();editor.select(null);
    editor.start(pointer([.2,.7]));
    assert.equal(editor.selected,getLayers(before)[0].id);assert.equal(editor.active,true);
    assert.deepEqual(editor.tool.getSnapshot(),before);
    editor.start(pointer([1.2,.7]));assert.equal(editor.selected,null);
});
test('Move keeps no selection while Brush and Erase activate an editable layer',()=>{
    const {editor}=pointerEditor();editor.select(null);editor.setTool('move');
    assert.equal(editor.selected,null);assert.equal(editor.active,false);
    editor.setTool('paint');assert.ok(editor.layer());assert.equal(editor.active,true);
    const id=editor.selected;editor.setTool('erase');editor.setTool('move');
    assert.equal(editor.selected,id);assert.equal(editor.active,true);
});
test('cancelling a stroke that began on empty space restores its layer',()=>{
    const {editor,events,pointer}=pointerEditor(),before=editor.tool.getSnapshot();
    editor.start(pointer([.2,.2]));editor.move(pointer([.4,.2]));editor.cancel();
    assert.deepEqual(editor.tool.getSnapshot(),before);
    assert.deepEqual(events,['Brush stroke','end','release']);
});

test('layer commands cannot interrupt a paint stroke or a layer reorder',()=>{
    for(const state of ['gesture','reorderGesture']){
        const {editor}=pointerEditor(),snapshot=editor.tool.getSnapshot();
        editor[state]={pointerId:12};
        editor.change=()=>assert.fail('A running gesture must not change layer history');
        editor.duplicateSelected();editor.deleteSelected();editor.shiftLayer(-1);
        assert.equal(editor.tool.getSnapshot(),snapshot);assert.ok(editor[state]);
    }
});
test('layer commands keep editing locks but permit an independent unlocked duplicate',()=>{
    const {editor}=pointerEditor(),original=editor.selected;
    const s=editor.tool.settings,key=s.mode==='abstract'?'abstractLayers':'landscapeLayers';
    editor.tool.applySnapshot({...s,[key]:s[key].map(l=>l.id===original?{...l,locked:true}:l)});
    const snapshot=editor.tool.getSnapshot(),changes=[];
    editor.change=(_tool,next,label)=>{changes.push(label);editor.tool.applySnapshot(next);};
    editor.deleteSelected();editor.shiftLayer(-1);
    assert.equal(editor.tool.getSnapshot(),snapshot);assert.deepEqual(changes,[]);
    editor.duplicateSelected();
    assert.notEqual(editor.selected,original);assert.equal(editor.layer().locked,false);
    assert.equal(getLayers(editor.tool.settings).find(l=>l.id===original).locked,true);
    assert.deepEqual(changes,['Duplicate layer']);
});


test('Alt/Cmd movement duplicates every layer type once and keeps the original at the modifier position',()=>{
    for(const mode of ['auto','pinned','drawn','vector'])for(const modifier of ['altKey','metaKey']) {
        const {editor,events,pointer}=pointerEditor(),added=addLayer(defaults,mode==='pinned'?'auto':mode);
        if(mode==='pinned')added.settings.landscapeLayers.at(-1).mode='pinned';
        editor.tool.applySnapshot(added.settings);editor.selected=added.id;editor.paintTool='move';editor.hit=()=>editor.selected;
        const originalId=added.id,count=getLayers(editor.tool.settings).length;
        editor.start(pointer([.4,.4]));editor.move(pointer([.45,.4]));
        const frozen=structuredClone(editor.layer());
        editor.move({...pointer([.5,.4]),[modifier]:true});const copyId=editor.selected;
        assert.notEqual(copyId,originalId);assert.equal(getLayers(editor.tool.settings).length,count+1);
        editor.move({...pointer([.55,.45]),[modifier]:true});editor.move(pointer([.6,.5]));editor.finish(pointer([.6,.5]));
        assert.equal(getLayers(editor.tool.settings).length,count+1);assert.equal(editor.selected,copyId);
        assert.deepEqual(getLayers(editor.tool.settings).find(l=>l.id===originalId),frozen);
        assert.ok(Math.abs(editor.layer().x-.2)<1e-10);assert.ok(Math.abs(editor.layer().y-.1)<1e-10);
        assert.equal(editor.layer().mode,mode==='auto'?'pinned':mode);
        assert.deepEqual(editor.layer().vectorPath,frozen.vectorPath);
        assert.deepEqual(events,['Move layer','end','release']);
    }
});
test('Alt click makes no copy; cancelling an Alt drag restores both stack and selection',()=>{
    const {editor,pointer}=pointerEditor();editor.paintTool='move';editor.hit=()=>editor.selected;
    const before=editor.tool.getSnapshot(),id=editor.selected;
    editor.start({...pointer([.4,.4]),altKey:true});editor.finish(pointer([.4,.4]));
    assert.deepEqual(editor.tool.getSnapshot(),before);
    editor.start(pointer([.4,.4]));editor.move({...pointer([.5,.4]),altKey:true});
    assert.notEqual(editor.selected,id);editor.cancel();
    assert.deepEqual(editor.tool.getSnapshot(),before);assert.equal(editor.selected,id);
});
test('layer limit prevents drag copies without interrupting movement',()=>{
    const {editor,pointer}=pointerEditor();let s=editor.tool.settings;
    while(getLayers(s).length<16)s=addLayer(s).settings;
    editor.tool.applySnapshot(s);editor.paintTool='move';editor.hit=()=>editor.selected;
    const id=editor.selected,messages=[];editor.report=m=>messages.push(m);
    editor.start(pointer([.4,.4]));editor.move({...pointer([.5,.4]),altKey:true});editor.move({...pointer([.6,.4]),altKey:true});editor.finish(pointer([.6,.4]));
    assert.equal(editor.selected,id);assert.equal(getLayers(editor.tool.settings).length,16);
    assert.equal(messages.length,1);assert.match(messages[0],/Maximum 16/);assert.ok(editor.layer().x>.19);
});
