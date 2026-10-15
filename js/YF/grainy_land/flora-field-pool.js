import {bakeFlora} from './flora-field.js?v=layers-polish-1';
import {FLOWER_MOTION} from './flower-motion.js?v=petal-motion-1';

// A bounded pool, one batch in flight. Playback requests the next pose only after
// the previous one is displayed; exports await every pose without dropping frames.
export class FloraFieldPool {
 constructor({createWorker=()=>new Worker(new URL('./flora-field-worker.js?v=layers-polish-1',import.meta.url),{type:'module'}),
  concurrency=Math.max(1,Math.min(4,(globalThis.navigator?.hardwareConcurrency??4)-1)),
  enabled=typeof Worker!=='undefined',timeoutMs=30_000}={}){
  Object.assign(this,{createWorker,concurrency,enabled,timeoutMs});this.workers=[];this.serial=0;this.active=null;this.destroyed=false;
 }
 reset(){for(const worker of this.workers)worker.terminate();this.workers=[];}
 destroy(){this.destroyed=true;this.active?.cancel(new DOMException('Renderer closed.','AbortError'));this.reset();}
 async prepare(scene,settings,{signal,editorPass=0}={}){
  signal?.throwIfAborted();
  if(this.destroyed)throw new Error('Renderer closed.');
  if(this.active)throw new Error('A Flora frame is already being prepared.');
  const isolated=editorPass>1.5?editorPass-2:null;
  const entries=scene.flatMap((layer,index)=>layer.flora&&(isolated!=null?index===isolated:layer.info[2]>0)
   ?[{index,layer,motion:layer[FLOWER_MOTION]}]:[]);
  const fields=Array(scene.length).fill(null);
  if(!entries.length)return fields;
  if(!this.enabled){for(const {index,layer} of entries)fields[index]=bakeFlora(layer,settings);return fields;}
  const count=Math.min(entries.length,this.concurrency),id=++this.serial;
  try{while(this.workers.length<count)this.workers.push(this.createWorker());}
  catch{this.enabled=false;this.reset();return this.prepare(scene,settings,{signal,editorPass});}
  let infrastructureFailure=false;
  try{
   return await new Promise((resolve,reject)=>{
    let remaining=count,settled=false;const cleanup=[];
    const finish=(error)=>{
     if(settled)return;settled=true;for(const off of cleanup)off();this.active=null;
     if(error){this.reset();reject(error);}else resolve(fields);
    };
    this.active={cancel:finish};
    const timer=setTimeout(()=>finish(new Error('Flora frame preparation timed out. Please retry.')),this.timeoutMs);cleanup.push(()=>clearTimeout(timer));
    const abort=()=>finish(signal.reason??new DOMException('Cancelled.','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});cleanup.push(()=>signal?.removeEventListener('abort',abort));
    for(let slot=0;slot<count&&!settled;slot++){
     const worker=this.workers[slot];
     const message=({data})=>{
      if(data.id!==id||settled)return;
      if(data.error){finish(new Error(data.error));return;}
      for(const field of data.fields)fields[field.index]=field;
      if(--remaining===0)finish();
     };
     const failure=event=>{event.preventDefault?.();infrastructureFailure=true;finish(new Error('Could not start the Flora worker.'));};
     worker.addEventListener('message',message);worker.addEventListener('error',failure);worker.addEventListener('messageerror',failure);
     cleanup.push(()=>{worker.removeEventListener('message',message);worker.removeEventListener('error',failure);worker.removeEventListener('messageerror',failure);});
     try{worker.postMessage({id,settings,cacheBudget:96*1024*1024/this.concurrency,entries:entries.filter((_,index)=>index%count===slot)});}
     catch(error){infrastructureFailure=true;finish(error);}
    }
   });
  }catch(error){
   // Browsers that cannot load module workers retain the synchronous renderer.
   // Calculation errors and user cancellation must never be silently retried.
   if(!infrastructureFailure||signal?.aborted||this.destroyed)throw error;
   this.enabled=false;return this.prepare(scene,settings,{signal,editorPass});
  }
 }
}
