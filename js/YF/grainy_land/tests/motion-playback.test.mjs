import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionPlayback} from '../motion-playback.js';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const jobs=[],queued=[],presented=[],errors=[],context={settings:{motionDuration:4}};let time=0;
 const playback=new MotionPlayback({getContext:()=>context,now:()=>time,schedule:fn=>(queued.push(fn),queued.length),cancel:()=>{},
  renderFrame:(c,phase,{signal})=>new Promise((resolve,reject)=>jobs.push({c,phase,signal,resolve,reject})),
  present:()=>presented.push(playback.frame),onError:e=>errors.push(e)});
 return {playback,jobs,queued,presented,errors,time:v=>{time=v;}};
}
test('playback waits for a displayed frame and samples wall time without queuing old poses',async()=>{
 const e=setup();e.playback.start();assert.equal(e.jobs.length,1);assert.equal(e.queued.length,0);
 e.time(1000);e.jobs[0].resolve('first');await turn();assert.deepEqual(e.presented,['first']);assert.equal(e.queued.length,1);
 e.queued.shift()();assert.equal(e.jobs[1].phase,.25);assert.equal(e.jobs.length,2);e.playback.stop();assert.ok(e.jobs[1].signal.aborted);
 e.jobs[1].resolve('late');await turn();assert.deepEqual(e.presented,['first']);assert.equal(e.playback.frame,null);
});
test('stale frames and failures cannot overwrite a restarted session',async()=>{
 const e=setup();e.playback.start();e.playback.stop();e.playback.start();e.jobs[0].resolve('stale');e.jobs[1].resolve('current');await turn();
 assert.deepEqual(e.presented,['current']);e.playback.stop();e.playback.start();e.jobs[2].reject(Error('failure'));await turn();
 assert.equal(e.errors[0].message,'failure');assert.equal(e.playback.controller,null);assert.equal(e.playback.frame,null);
});
