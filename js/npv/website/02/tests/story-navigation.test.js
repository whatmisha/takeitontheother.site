import test from 'node:test';
import assert from 'node:assert/strict';
import { Story } from '../story.js';
import { storyLayout } from '../story-timeline.js';

test('menu navigation takes a measured smooth path, settles exactly, and yields to manual input', () => {
  const names=['window','scrollY','requestAnimationFrame','cancelAnimationFrame'];
  const previous=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
  let id=0;
  const callbacks=new Map(), positions=[];
  globalThis.scrollY=0;
  globalThis.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
  globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
  globalThis.window={scrollTo({top,behavior}){
    assert.equal(behavior,'instant');
    globalThis.scrollY=top; positions.push(top);
  }};
  const story={layout:storyLayout([417,232,194],768), navigationFrame:0,
    cancelNavigation:Story.prototype.cancelNavigation, navigate:Story.prototype.navigate, update(){}};
  const step=now=>{
    const pending=[...callbacks]; callbacks.clear();
    pending.forEach(([,callback])=>callback(now));
  };
  try {
    const start=performance.now();
    story.navigate(1,true);
    step(start+600);
    assert.ok(scrollY>200 && scrollY<600,'the midpoint is still in transit rather than an instant jump');
    for(let ms=616;ms<1600;ms+=16) step(start+ms);
    assert.equal(scrollY,768);
    assert.equal(callbacks.size,0);
    assert.ok(positions.every((value,index)=>index===0 || value>=positions[index-1]));
    story.navigate(2,true);
    step(performance.now()+250);
    const interrupted=scrollY;
    story.cancelNavigation();
    step(performance.now()+2000);
    assert.equal(scrollY,interrupted);
    assert.equal(callbacks.size,0,'manual input cancels every pending navigation frame');
    story.navigate(0,false);
    assert.equal(scrollY,0,'reduced motion and hash restoration bypass the animation');
  } finally {
    for(const name of names) {
      if(previous[name]===undefined) delete globalThis[name]; else globalThis[name]=previous[name];
    }
  }
});
