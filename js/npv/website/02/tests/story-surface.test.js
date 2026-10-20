import test from 'node:test';
import assert from 'node:assert/strict';
import { storyLayout, storyAt, rebaseStoryScroll, advanceCopies } from '../story-timeline.js';
import { projectSurface, matchSurface, surfaceMark, surfaceParameters } from '../surface-plan.js';
import { createWebsiteSphereLayout } from '../sphere-layout.js';
import { regionOrientation } from '../planet-motion.js';
import { buildFlatLayout, buildFlatScene } from '../../../src/geometry/flatGeometry.js';
import { talentSettings } from '../talent-surface.js';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} vs ${b}`);

test('three viewport scenes hold their copy and hand over at the anchor positions', () => {
  const layout=storyLayout([417.4,232.6,194.6],768);
  assert.equal(layout.total,2304);
  for (let i=0;i<3;i++) {
    assert.equal(layout.scenes[i].start,i*768);
    const state=storyAt(i*768,layout);
    assert.equal(state.active,i);
    assert.equal(state.copies[i].y,292);
    assert.equal(state.copies[i].opacity,1);
  }
  for (const y of [0,200,450]) assert.equal(storyAt(y,layout).copies[0].y,292);
  const mid=storyAt(768*.825,layout);
  assert.ok(mid.copies[1].y > mid.copies[0].y+417.4, 'transition blocks never overlap');
  assert.ok(mid.copies[0].opacity>0 && mid.copies[1].opacity>0, 'no empty handover');
  assert.ok(storyAt(768*1.825,layout).flat>.4);
  assert.equal(storyAt(1536,layout).flat,1);
  assert.equal(storyAt(768,layout).copies[1].y,storyAt(1000,layout).copies[1].y);
  assert.ok(storyAt(1000,layout).planetTurn>storyAt(768,layout).planetTurn, 'the globe keeps turning while copy is held');
});

test('long mobile copy gets native reading distance before its held transition', () => {
  const layout=storyLayout([402,232,335],844,true);
  assert.equal(layout.scenes[0].overflow,104);
  assert.equal(storyAt(0,layout).copies[0].y,450);
  assert.equal(storyAt(104,layout).copies[0].y+402,844-96);
  assert.equal(storyAt(300,layout).copies[0].y,346);
  const end=storyAt(layout.total-844,layout);
  assert.equal(end.active,2);
  near(end.copies[2].y+335,844-96);
});

test('reduced motion switches scenes without translating between intermediate poses', () => {
  const layout=storyLayout([417,232,194],768);
  for (const scroll of [530,600,650,720]) {
    const state=storyAt(scroll,layout,true);
    assert.ok(state.land===0 || state.land===1);
    assert.equal(state.copies[state.active].y,292);
    assert.equal(state.copies[state.active].opacity,1);
  }
});

for (const [width,height,canvasWidth,canvasTop] of [[714,768,1108,109],[390,422,561.6,141.2]]) {
  test(`surface ${width}×${height} maps every Talent cell to one sphere mark and preserves both endpoints`, () => {
    const sphere=createWebsiteSphereLayout(canvasWidth);
    sphere.radius=sphere.sphereRadius;
    const points=projectSurface(sphere,{orientation:regionOrientation(-25,20,20),land:1,regions:{}},
      {canvasWidth,canvasLeft:width/2-canvasWidth/2,canvasTop});
    const settings=talentSettings(width,height);
    const flat=buildFlatLayout(settings);
    for (const point of flat.elements) {
      near(point.rx*2,4); near(point.ry*2,4);
    }
    const person=buildFlatScene(settings,{transientField:{x:0,y:0}});
    const plan=matchSurface(points,flat.elements,width,height);
    assert.equal(plan.matches.size,flat.elements.length, 'no missing destination dots');
    assert.equal(new Set(plan.matches.values()).size,flat.elements.length);
    assert.ok(points.length>flat.elements.length);
    for (const [sourceIndex,targetIndex] of plan.matches) {
      const source=points[sourceIndex],target=person.elements[targetIndex];
      const first=surfaceMark(source,target,surfaceParameters(0),plan);
      near(first.x,source.x);near(first.y,source.y);near(first.rx,source.rx);near(first.ry,source.ry);
      const last=surfaceMark(source,target,surfaceParameters(1),plan);
      near(last.x,target.cx);near(last.y,target.cy);near(last.rx,target.rx);near(last.ry,target.ry);near(last.angle,0);
      const middle=surfaceMark(source,target,surfaceParameters(.5),plan);
      assert.ok(Object.values(middle).every(Number.isFinite));
      assert.ok(middle.rx>=0 && middle.ry>=0);
    }
    const spare=points.find((_,index)=>!plan.matches.has(index));
    assert.equal(surfaceMark(spare,null,surfaceParameters(1),plan).rx,0);
  });
}


test('resizing preserves the active scene and progress instead of restoring an obsolete pixel offset', () => {
  const desktop=storyLayout([417,232,194],768);
  const mobile=storyLayout([402,197,335],844,true);
  assert.equal(rebaseStoryScroll(768,desktop,mobile),mobile.scenes[1].start);
  assert.equal(rebaseStoryScroll(1536,desktop,mobile),mobile.scenes[2].start);
  const scroll=rebaseStoryScroll(768*1.8,desktop,mobile);
  near(storyAt(scroll,mobile).flat,storyAt(768*1.8,desktop).flat);
});


test('copy motion approaches scroll targets continuously, settles, and respects reduced motion', () => {
  const layout=storyLayout([417,232,194],768);
  let current=storyAt(0,layout).copies;
  const target=storyAt(768,layout).copies;
  const first=advanceCopies(current,target,16);
  assert.ok(first.copies[0].opacity>0 && first.copies[0].opacity<1);
  assert.ok(first.copies[1].opacity>0 && first.copies[1].opacity<1);
  assert.ok(first.moving);
  let result=first, frames=0;
  while(result.moving && frames++<200) result=advanceCopies(result.copies,target,16);
  assert.equal(result.moving,false,'animation releases its frame loop after settling');
  assert.deepEqual(result.copies,target);
  assert.deepEqual(advanceCopies(first.copies,target,16,true),{copies:target,moving:false});
  const reverse=advanceCopies(first.copies,storyAt(0,layout).copies,16);
  assert.ok(reverse.copies[0].opacity>first.copies[0].opacity,'reversing starts from the visible pose');
});

test('Talent doubles the complete Person silhouette while keeping the underlying dots at 4 px', () => {
  const settings=talentSettings(714,768);
  const before=buildFlatScene({...settings,personIconScale:150},{transientField:{x:0,y:0}});
  const after=buildFlatScene(settings,{transientField:{x:0,y:0}});
  const shapes=scene=>scene.elements.filter(point=>['head','shoulders'].includes(point.role));
  const old=shapes(before), next=shapes(after);
  assert.equal(next.length,2);
  next.forEach((shape,index)=>{near(shape.rx,old[index].rx*2);near(shape.ry,old[index].ry*2);});
  const height=items=>Math.max(...items.map(p=>p.cy+p.ry))-Math.min(...items.map(p=>p.cy-p.ry));
  near(height(next),height(old)*2);
  const grid=buildFlatLayout(settings);
  assert.ok(grid.elements.every(point=>point.rx===2 && point.ry===2));
});
