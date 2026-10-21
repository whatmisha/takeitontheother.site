import test from 'node:test';
import assert from 'node:assert/strict';
import { TalentSearch, SEARCH_HOLD_PROGRESS } from '../talent-search.js';
import { TalentSurface, talentSettings } from '../talent-surface.js';
import { buildFlatLayout } from '../runtime/geometry/flatGeometry.js';
import { createPersonSearchPlan, buildPersonSearchScene } from '../runtime/animation/personSearch.js';

for (const [width, height] of [[714,768], [390,422]]) {
  test(`Search ${width}×${height} starts without a delay, then holds the selected person with step 2`, () => {
    const layout = buildFlatLayout(talentSettings(width,height));
    const before = structuredClone(layout);
    const search = new TalentSearch(layout);
    assert.equal(layout.settings.searchStep, 2);
    assert.equal(layout.settings.fieldFollow, false);
    assert.ok(layout.elements.every(point => point.rx === 2 && point.ry === 2));
    assert.equal(search.sample(false, 10000).running, false);
    assert.equal(search.plan, null, 'no route calculation on the sphere screens');
    const frame = search.sample(true, 1700);
    assert.equal(frame.search.progress, .17);
    assert.ok(frame.search.count > 1);
    assert.deepEqual(frame.elements, buildPersonSearchScene(layout.settings, search.plan, .17).elements);
    const regular = createPersonSearchPlan({...layout.settings,searchStep:1});
    search.plan.candidates.forEach((candidate, index) => {
      const path = regular.candidates[index].path;
      assert.deepEqual(candidate.path.map(node => node.id),
        path.filter((_,i) => i % 2 === 0 || i === path.length-1).map(node => node.id));
    });
    const selected = search.sample(true, 6300);
    assert.equal(selected.search.phase, 'Selected');
    assert.equal(selected.search.count, 1);
    assert.equal(selected.running, true);
    const held = search.sample(true, 200);
    assert.equal(held.search.progress, SEARCH_HOLD_PROGRESS);
    assert.equal(held.search.phase, 'Selected');
    assert.equal(held.search.count, 1);
    assert.equal(held.running, false);
    assert.equal(held.search.actors[0].strength, 1);
    assert.deepEqual(held.elements, buildPersonSearchScene(layout.settings, search.plan, SEARCH_HOLD_PROGRESS).elements);
    assert.deepEqual(search.sample(true, 60000), held, 'the winner never fades or restarts');
    assert.deepEqual(layout,before,'animation never mutates the base grid');
  });
}

test('leaving the third screen resets playback while retaining the cached plan', () => {
  const search = new TalentSearch(buildFlatLayout(talentSettings(714,768)));
  search.sample(true, 4500);
  const plan = search.plan;
  const exit = search.sample(false,16);
  assert.equal(exit.running,false);
  assert.equal(exit.elements,search.layout.elements);
  assert.equal(search.elapsed,0);
  assert.equal(search.plan,plan);
  assert.equal(search.sample(true,1700).search.progress,.17);
});

test('reduced motion shows a stationary selected candidate and requests no continuous frames', () => {
  const search = new TalentSearch(buildFlatLayout(talentSettings(390,422)));
  const still = search.sample(true,16,true);
  assert.equal(still.search.count,1);
  assert.equal(still.search.phase,'Selected');
  assert.equal(still.running,false);
  assert.deepEqual(search.sample(true,5000,true),still);
  assert.equal(search.elapsed,0);
  assert.equal(search.sample(true,16,false).search.progress,.0016);
});

test('the surface draws Search poses without pointer listeners and settles when scrolling back', () => {
  const oldDPR=globalThis.devicePixelRatio, oldListener=globalThis.addEventListener;
  globalThis.devicePixelRatio=1;
  globalThis.addEventListener=() => assert.fail('Talent must not subscribe to pointer input');
  try {
    const ellipses=[];
    const context=new Proxy({ellipse:(...args)=>ellipses.push(args)}, {get:(target,key)=>target[key] ?? (()=>{})});
    const canvas={style:{},getContext:()=>context,parentElement:{getBoundingClientRect:()=>({width:390,height:422})}};
    const sphere={canvas:{style:{}},color:'#fff'};
    const surface=new TalentSurface(sphere,canvas);
    // The existing surface mapping is tested separately; use a 1:1 mapping here.
    surface.points=surface.layout.elements.map(p=>({x:p.cx,y:p.cy,rx:2,ry:2,angle:0}));
    surface.plan={matches:new Map(surface.points.map((_,i)=>[i,i])),
      survivors:surface.points.map((p,i)=>({...p,sourceIndex:i})),focus:{x:195,y:211},center:{x:195,y:211}};
    surface.draw({flat:.89},1000,false);
    assert.equal(surface.search.elapsed,0,'Search stays idle before the last part of flattening');
    for(let i=0;i<30;i++)surface.draw({flat:.95},16,false);
    assert.ok(surface.search.sample(true,0).search.count>0,'people appear while the grid is still flattening');
    assert.ok(surface.person.some((point,i)=>point.rx>surface.layout.elements[i].rx));
    surface.draw({flat:1},16,false);
    assert.equal(surface.search.elapsed,496,'finishing the transition does not restart Search');
    surface.search.reset();
    ellipses.length=0;
    assert.equal(surface.draw({flat:1},8000,false),true);
    const expected=surface.search.sample(true,0).elements.filter(p=>p.rx>=.015 && p.ry>=.015);
    assert.equal(ellipses.length,expected.length);
    ellipses.forEach((ellipse,i)=>expected[i] && ['cx','cy','rx','ry'].forEach((key,j)=>
      assert.ok(Math.abs(ellipse[j]-expected[i][key])<1e-9)));
    surface.draw({flat:1},200,false);
    assert.equal(surface.draw({flat:1},16,false),false,'the final figure releases the animation loop');
    const held=structuredClone(surface.person);
    assert.equal(surface.draw({flat:1},60000,false),false);
    assert.deepEqual(surface.person,held);
    for(let i=0;i<100;i++)surface.draw({flat:.8},16,false);
    assert.equal(surface.draw({flat:.8},16,false),false,'no perpetual animation during a paused transition');
    assert.equal(surface.draw({flat:0},16,false),false);
    assert.equal(surface.search.elapsed,0);
    assert.equal(canvas.hidden,true);
    assert.equal(sphere.canvas.style.opacity,'');
  } finally {
    if(oldDPR===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=oldDPR;
    if(oldListener===undefined)delete globalThis.addEventListener;else globalThis.addEventListener=oldListener;
  }
});
