import test from 'node:test';
import assert from 'node:assert/strict';
import { TalentSearch, SEARCH_DELAY_MS } from '../talent-search.js';
import { TalentSurface, talentSettings } from '../talent-surface.js';
import { buildFlatLayout } from '../runtime/geometry/flatGeometry.js';
import { createPersonSearchPlan, buildPersonSearchScene } from '../runtime/animation/personSearch.js';

for (const [width, height] of [[714,768], [390,422]]) {
  test(`Search ${width}×${height} waits for the flat scene, then loops through selection with step 2`, () => {
    const layout = buildFlatLayout(talentSettings(width,height));
    const before = structuredClone(layout);
    const search = new TalentSearch(layout);
    assert.equal(layout.settings.searchStep, 2);
    assert.equal(layout.settings.fieldFollow, false);
    assert.ok(layout.elements.every(point => point.rx === 2 && point.ry === 2));
    assert.equal(search.sample(false, 10000).running, false);
    assert.equal(search.plan, null, 'no route calculation on the sphere screens');
    assert.equal(search.sample(true, SEARCH_DELAY_MS - 1).elements, layout.elements);
    assert.equal(search.plan, null);
    const frame = search.sample(true, 1701);
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
    const loop = search.sample(true, 3700);
    assert.equal(loop.search.progress, .17);
    assert.deepEqual(loop.elements, frame.elements);
    assert.deepEqual(layout,before,'animation never mutates the base grid');
  });
}

test('leaving the third screen resets its delay while retaining the cached plan', () => {
  const search = new TalentSearch(buildFlatLayout(talentSettings(714,768)));
  search.sample(true, SEARCH_DELAY_MS + 4500);
  const plan = search.plan;
  const exit = search.sample(false,16);
  assert.equal(exit.running,false);
  assert.equal(exit.elements,search.layout.elements);
  assert.equal(search.elapsed,0);
  assert.equal(search.sample(true,SEARCH_DELAY_MS).elements,search.layout.elements);
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
  assert.equal(search.sample(true,16,false).elements,search.layout.elements);
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
    assert.equal(surface.draw({flat:1},SEARCH_DELAY_MS+8000,false),true);
    const expected=surface.search.sample(true,0).elements.filter(p=>p.rx>=.015 && p.ry>=.015);
    assert.equal(ellipses.length,expected.length);
    ellipses.forEach((ellipse,i)=>expected[i] && ['cx','cy','rx','ry'].forEach((key,j)=>
      assert.ok(Math.abs(ellipse[j]-expected[i][key])<1e-9)));
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
