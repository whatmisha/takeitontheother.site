import { ShareCodec } from '../../infra/framework/src/preset/ShareCodec.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,editForm,formEdit,makeDocument,readDocument,regenerate,normalizeSettings} from '../document.js';
import {normalizeStrokes,brushStroke,localPaintPoint,paintDistance,bakePaint,MAX_STROKES,MAX_STROKE_POINTS,MAX_FORM_POINTS,strokePointCount} from '../paint.js';
const brush={kind:'paint',rx:.08,ry:.12,points:[[.3,.2],[.55,.3]]};
const erase={kind:'erase',rx:.03,ry:.045,points:[[.4,.24]]};
const decoded = (field,x,y) => {
    const px=Math.round((x-field.bounds[0])/field.bounds[2]*(field.width-1));
    const py=Math.round((y-field.bounds[1])/field.bounds[3]*(field.height-1));
    const i=(py*field.width+px)*4,p=field.pixels;
    return [((p[i]*256+p[i+1])/65535)*2-1,((p[i+2]*256+p[i+3])/65535)*2-1];
};
test('strokes add connected masses, erase procedural paint, and respect operation order',()=>{
    assert.ok(paintDistance(-.5,[.4,.24],[brush])>0);
    assert.ok(paintDistance(.5,[.4,.24],[erase])<0);
    assert.ok(paintDistance(-.5,[.4,.24],[brush,erase])<0);
    assert.ok(paintDistance(-.5,[.4,.24],[erase,brush])>0);
    assert.equal(paintDistance(.25,[.9,.9],[brush]),.25);
});
test('brush diameter is circular in canvas pixels even on a transformed form',()=>{
    const edit={x:.1,y:-.2,scaleX:2,scaleY:.5};
    const s=brushStroke(defaults,edit,[.6,.4],20,'paint');
    assert.equal(s.rx*defaults.width*edit.scaleX,s.ry*defaults.height*edit.scaleY);
    assert.equal(s.ry*defaults.height*edit.scaleY,108);
    assert.deepEqual(s.points,[localPaintPoint([.6,.4],edit)]);
    assert.ok(Math.abs((s.points[0][0]-.5)*edit.scaleX+.5+edit.x-.6)<1e-12);
});
test('paint survives document/preset snapshots and locked generation, with independent modes',()=>{
    let s=editForm(defaults,5,{strokes:[brush,erase],locked:true});
    s=editForm({...s,mode:'abstract'},1,{strokes:[erase],locked:true});
    const roundtrip=readDocument(JSON.parse(JSON.stringify(makeDocument(s))));
    assert.deepEqual(roundtrip,s);assert.deepEqual(normalizeSettings(s),s);
    assert.deepEqual(regenerate(s,17).landscapeForms,s.landscapeForms);
    assert.deepEqual(regenerate(s,17).abstractForms,s.abstractForms);
    const unlocked=editForm(s,1,{locked:false});
    assert.equal(regenerate(unlocked,18).abstractForms,null);
    const cleared=editForm(s,1,{strokes:[]});
    assert.equal(formEdit(cleared,1).strokes,undefined);
    assert.equal(formEdit(cleared,1).locked,true);
    assert.equal(editForm(s,1,null).abstractForms,null);
});
test('invalid and excessive strokes cannot grow unbounded documents or textures',()=>{
    const points=Array.from({length:500},()=>[.123456789,.876543219]);
    const strokes=normalizeStrokes(Array.from({length:100},()=>({...brush,points})));
    assert.ok(strokes.length<=MAX_STROKES);
    assert.ok(strokes.every(s=>s.points.length<=MAX_STROKE_POINTS));
    assert.ok(strokePointCount(strokes)<=MAX_FORM_POINTS);
    assert.deepEqual(strokes[0].points[0],[.12346,.87654]);
    assert.deepEqual(normalizeStrokes([null,{}, {...brush,rx:0}, {...brush,points:[[Infinity,0]]},{...brush,kind:'script'}]),[]);
    const bounded=normalizeStrokes([{...brush,rx:500,points:[[-1e20,1e20]]}]);
    assert.deepEqual(bounded[0].points,[[-8,9]]);assert.equal(bounded[0].rx,2);
    const fullStrokes=Array.from({length:MAX_STROKES},()=>({...brush,rx:1.23456,ry:1.23456,
        points:Array.from({length:MAX_FORM_POINTS/MAX_STROKES},()=>[-7.12345,-7.12345])}));
    let maximal={...defaults};
    for(const mode of ['landscape','abstract'])for(let i=0;i<6;i++)maximal=editForm({...maximal,mode},i,{strokes:fullStrokes,locked:true});
    assert.ok(Buffer.byteLength(JSON.stringify(makeDocument(maximal),null,2))<2*1024*1024,'largest normalized JSON fits importer');
});
test('baked 16-bit bounds reproduce brush/eraser order and leave outside paint intact',()=>{
    for(const strokes of [[brush],[brush,erase],[erase,brush]]) {
        const field=bakePaint(strokes);
        for(const [x,y] of [[.4,.24],[.55,.3],[.75,.65]])for(const original of [-.5,.2]) {
            const [lo,hi]=decoded(field,x,y),actual=Math.max(lo,Math.min(hi,original));
            assert.ok(Math.abs(actual-paintDistance(original,[x,y],strokes))<.012);
        }
        assert.equal(bakePaint(strokes),field);
    }
});
test('incremental baking matches a fresh evaluation of the entire stroke',()=>{
    const extended={...brush,ry:.13,points:[[.31,.21],[.56,.31]]};
    const first={...extended,points:[extended.points[0]]};bakePaint([first]);
    const field=bakePaint([extended]);
    for(const point of [[.31,.21],[.4,.24],[.51,.28]]) {
        const [lo,hi]=decoded(field,...point);
        assert.ok(Math.abs(Math.max(lo,Math.min(hi,-.5))-paintDistance(-.5,point,[extended]))<.012);
    }
});

test('share codec preserves ordered strokes without dropping their payload',async()=>{
    const settings=editForm(defaults,5,{strokes:[brush,erase],locked:true});
    const codec=new ShareCodec({pristineDefaults:defaults});
    const encoded=await codec.encodeWithBudget(settings);
    const decoded=await codec.decode(encoded.encoded);
    assert.deepEqual(normalizeSettings(decoded.full),settings);
});
