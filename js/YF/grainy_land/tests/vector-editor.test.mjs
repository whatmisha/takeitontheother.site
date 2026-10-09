import test from 'node:test';
import assert from 'node:assert/strict';
import {VectorEditor} from '../vector-editor.js';
import {FormEditor} from '../form-editor.js';
import {PenDraft} from '../pen-draft.js';
import {defaults} from '../document.js';
import {addLayer,getLayers,editLayer,MAX_LAYERS} from '../layers.js';
import {defaultVectorPath,moveVectorNode,setVectorNodesSmooth} from '../vector-path.js';

// Use the real editor state transitions and keyboard handler with a small DOM adapter.
// The rendered editor is also exercised in the browser; these checks protect routing.
function fixture(){
    const elements=new Map(),element=id=>{
        if(!elements.has(id))elements.set(id,{id,hidden:false,disabled:false,textContent:'',attributes:{},
            setAttribute(k,v){this.attributes[k]=v;},toggleAttribute(k,v){this.attributes[k]=v;},replaceChildren(){},
            closest(selector){return this.input&&selector.includes('input')||this.modal&&selector.includes('dialog')?this:null;}});
        return elements.get(id);
    };
    const previousDocument=globalThis.document;
    globalThis.document={getElementById:element,querySelectorAll:()=>[],activeElement:null};
    const added=addLayer(defaults,'vector');let settings=added.settings;const e=Object.create(FormEditor.prototype),commits=[];
    Object.assign(e,{selected:added.id,selectedIds:new Set([added.id]),active:true,paintTool:'move',cursor:{},overlay:{},space:false,gesture:null,opacityEditing:false});
    e.container=element('canvasContainer');Object.assign(e.container,{focus(){},contains:target=>target===e.container,setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){}});
    e.tool={get settings(){return settings;},target:{zoom:1},getSnapshot:()=>settings,render(){},applySnapshot(s){settings=s;e.sync();},history:{flush(){},beginTransaction(){},endTransaction(){}}};
    e.point=event=>event.point;e.report=message=>{e.message=message||e.vector?.draftHint()||'';};
    e.change=(_,s,label)=>{settings=s;commits.push(label);e.sync();};
    e.commit=(patch,label)=>{settings=editLayer(settings,e.selected,patch);commits.push(label);e.sync();};
    e.vector=new VectorEditor(e);e.vector.svg=element('vectorOverlay');e.sync=()=>e.vector.sync();e.sync();
    const key=(name,target=e.container,modifiers={})=>({key:name,target,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false,...modifiers,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
    const point=(x,y)=>({point:[x,y],button:0,pointerId:1,timeStamp:1000,clientX:x*1920,clientY:y*1080,preventDefault(){},stopImmediatePropagation(){}});
    const addPoint=(x,y)=>{e.vector.penDown(point(x,y));e.vector.releasePenDrag();};
    return {e,v:e.vector,element,key,point,addPoint,commits,restore(){globalThis.document=previousDocument;}};
}
function usingFixture(run){const f=fixture();try{run(f);}finally{f.restore();}}

test('Pen undo/redo and Backspace edit draft points without touching document history',()=>usingFixture(({e,v,key,addPoint,commits})=>{
    const before=e.tool.getSnapshot();v.startPen();addPoint(.2,.2);addPoint(.4,.3);addPoint(.3,.5);
    const undo=key('z',e.container,{metaKey:true});v.handleKey(undo);assert.ok(undo.stopped);assert.equal(v.pen.length,2);
    v.handleKey(key('z',e.container,{metaKey:true,shiftKey:true}));assert.equal(v.pen.length,3);
    v.handleKey(key('Backspace'));assert.equal(v.pen.length,2);v.handleKey(key('z',e.container,{metaKey:true}));assert.equal(v.pen.length,3);
    assert.deepEqual(e.tool.getSnapshot(),before);assert.deepEqual(commits,[]);
    for(let i=0;i<8;i++){const event=key('z',e.container,{ctrlKey:true});v.handleKey(event);assert.ok(event.stopped);}
    assert.equal(v.pen.length,0);assert.deepEqual(e.tool.getSnapshot(),before);
}));
test('repeat P and Move/Brush/Erase preserve a resumable draft and its history',()=>usingFixture(({e,v,addPoint,key})=>{
    v.startPen();addPoint(.2,.2);addPoint(.4,.4);const expected=structuredClone(v.pen);v.startPen();assert.deepEqual(v.pen,expected);
    for(const tool of ['move','paint','erase']){e.setTool(tool);assert.equal(v.pen,null);assert.equal(v.editing,false);v.startPen();assert.deepEqual(v.pen,expected);}
    v.handleKey(key('z',e.container,{metaKey:true}));assert.equal(v.pen.length,1);
}));
test('selecting a layer and Edit path suspend Pen; resuming Pen exits path editing',()=>usingFixture(({e,v,addPoint})=>{
    const id=e.selected;v.startPen();addPoint(.2,.2);e.select(id);assert.equal(v.pen,null);v.setEditing(true);assert.equal(v.editing,true);
    v.startPen();assert.equal(v.editing,false);assert.equal(v.pen.length,1);assert.equal(e.selected,null);
}));
test('Landscape and Abstract keep independent drafts and refresh their status hints',()=>usingFixture(({e,v,addPoint})=>{
    v.startPen();addPoint(.2,.2);addPoint(.4,.4);const landscape=structuredClone(v.pen);
    e.tool.applySnapshot({...e.tool.settings,mode:'abstract'});assert.equal(v.pen,null);assert.equal(e.message,'');
    v.startPen();assert.equal(v.pen.length,0);addPoint(.6,.6);const abstract=structuredClone(v.pen);e.setTool('move');
    e.tool.applySnapshot({...e.tool.settings,mode:'landscape'});assert.match(e.message,/Press P to resume/);v.startPen();assert.deepEqual(v.pen,landscape);
    e.tool.applySnapshot({...e.tool.settings,mode:'abstract'});assert.match(e.message,/Press P to resume/);v.startPen();assert.deepEqual(v.pen,abstract);
}));
test('point Delete after a properties button cannot fall through to layer deletion',()=>usingFixture(({e,v,key,element})=>{
    v.setEditing(true);const count=getLayers(e.tool.settings).length,event=key('Delete',element('toggleVectorPoint'));
    v.handleKey(event);assert.ok(event.stopped);assert.equal(e.layer().vectorPath.length,3);assert.equal(getLayers(e.tool.settings).length,count);
    const minimum=key('Backspace',element('editVectorPath'));v.handleKey(minimum);assert.ok(minimum.stopped);assert.equal(e.layer().vectorPath.length,3);
}));
test('text editing and modal keyboard commands remain native',()=>usingFixture(({e,v,key,element,addPoint})=>{
    const input=element('formRotation');input.input=true;const modal=element('dialogButton');modal.modal=true;
    v.setEditing(true);for(const target of [input,modal]){const event=key('Delete',target);v.handleKey(event);assert.ok(!event.stopped);}
    v.startPen();addPoint(.2,.2);for(const target of [input,modal]){const event=key('z',target,{metaKey:true});v.handleKey(event);assert.ok(!event.stopped);}assert.equal(v.pen.length,1);
}));
test('Escape discards only the current draft; completing a path creates one document action',()=>usingFixture(({e,v,key,addPoint,commits})=>{
    const count=getLayers(e.tool.settings).length;v.startPen();addPoint(.2,.2);v.handleKey(key('Enter'));assert.equal(getLayers(e.tool.settings).length,count);
    v.handleKey(key('Escape'));assert.equal(v.pen,null);v.startPen();assert.equal(v.pen.length,0);
    addPoint(.2,.2);addPoint(.4,.3);addPoint(.3,.5);v.handleKey(key('Enter'));assert.equal(getLayers(e.tool.settings).length,count+1);assert.equal(v.editing,true);assert.equal(v.pen,null);assert.deepEqual(commits,['Draw vector path']);
}));
test('Pen checks the layer limit before entering and retains a suspended draft at capacity',()=>usingFixture(({e,v,addPoint,element})=>{
    v.startPen();addPoint(.2,.2);e.setTool('move');let s=e.tool.settings;while(getLayers(s).length<MAX_LAYERS)s=addLayer(s,'vector').settings;
    e.tool.applySnapshot(s);assert.equal(element('penTool').disabled,true);v.startPen();assert.equal(v.pen,null);assert.match(e.message,/Maximum 16 layers/);
    e.tool.applySnapshot({...s,landscapeLayers:s.landscapeLayers.slice(0,-1)});v.startPen();assert.equal(v.pen.length,1);
}));
test('Pen drag is one undoable point; pointer cancellation rolls it back without losing redo',()=>usingFixture(({e,v,point,key})=>{
    v.startPen();v.penDown(point(.2,.2));v.pen[0].out=[.4,.3];v.pen[0].in=[0,.1];v.pen[0].smooth=true;const expected=structuredClone(v.pen);
    v.handleKey(key('z',e.container,{metaKey:true}));assert.equal(v.pen.length,0);assert.equal(v.penDrag,null);v.handleKey(key('z',e.container,{metaKey:true,shiftKey:true}));assert.deepEqual(v.pen,expected);
    v.handleKey(key('z',e.container,{metaKey:true}));v.penDown(point(.5,.5));v.cancel();assert.equal(v.pen.length,0);v.handleKey(key('z',e.container,{metaKey:true,shiftKey:true}));assert.deepEqual(v.pen,expected);
}));
test('Make smooth/corner set one type across mixed selections and keep independent handle lengths',()=>{
    const p=defaultVectorPath(),mixed=setVectorNodesSmooth(p,[0],false),smooth=setVectorNodesSmooth(mixed,[0,1],true);
    assert.ok(smooth[0].smooth&&smooth[1].smooth);assert.deepEqual(smooth[1],mixed[1]);
    const corners=setVectorNodesSmooth(smooth,[0,1],false);assert.ok(!corners[0].smooth&&!corners[1].smooth);
    const independent=moveVectorNode(p,0,[.7,.18],'out',true),aligned=setVectorNodesSmooth(independent,[0],true)[0],before=independent[0];
    assert.equal(aligned.smooth,true);for(const side of ['in','out'])assert.ok(Math.abs(Math.hypot(aligned[side][0]-aligned.x,aligned[side][1]-aligned.y)-Math.hypot(before[side][0]-before.x,before[side][1]-before.y))<.00002);
    const cross=(aligned.in[0]-aligned.x)*(aligned.out[1]-aligned.y)-(aligned.in[1]-aligned.y)*(aligned.out[0]-aligned.x);assert.ok(Math.abs(cross)<.00001);
});
test('draft histories are bounded and a new point clears redo',()=>{
    const d=new PenDraft();for(let i=0;i<120;i++)d.replace([{x:i,y:0}]);assert.equal(d.past.length,96);d.undo();assert.equal(d.future.length,1);d.replace([]);assert.equal(d.future.length,0);
});
