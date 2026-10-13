import test from 'node:test';
import assert from 'node:assert/strict';
import {renderVideo,motionFrame} from '../motion.js';
import {defaults} from '../document.js';

function environment(t,options={}){
 const saved=new Map(),frames=[],renders=[],encoders=[],fills=[],progress=[];
 const replace=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});};
 t.after(()=>{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const canvas={width:0,height:0,getContext:(type,opts)=>{assert.equal(opts.alpha,false);return {set fillStyle(v){assert.equal(v,'#000');},fillRect(...args){fills.push(args);},drawImage(){}};}};
 class Frame{constructor(source,init){this.source=source;Object.assign(this,init);frames.push(this);}close(){this.closed=true;}}
 class Encoder extends EventTarget{
  static async isConfigSupported(config){return {supported:!options.unsupported,config};}
  constructor(callbacks){super();this.callbacks=callbacks;this.state='unconfigured';this.encodeQueueSize=0;this.timers=[];encoders.push(this);}
  configure(config){this.config=config;if(options.configureError)throw Error('Configure failed');this.state='configured';}
  encode(frame,{keyFrame}){
   if(options.encodeError)throw Error('Encode failed');
   this.encodeQueueSize++;this.peak=Math.max(this.peak??0,this.encodeQueueSize);
   if(options.stall)return;
   this.timers.push(setTimeout(()=>{
    if(options.asyncError){this.callbacks.error(Error('Codec failed'));return;}
    this.encodeQueueSize--;
    if(!(options.drop&&frame.timestamp===33333))this.callbacks.output({timestamp:options.duplicate?0:frame.timestamp,type:keyFrame?'key':'delta',byteLength:1,copyTo:data=>{data[0]=1;}},{decoderConfig:{description:new Uint8Array([1,100,0,40,255])}});
    this.dispatchEvent(new Event('dequeue'));
   },options.delay??0));
  }
  async flush(){this.flushing=true;if(options.flushStall)return new Promise(()=>{});while(this.encodeQueueSize)await new Promise(r=>setTimeout(r,1));}
  close(){this.state='closed';this.timers.forEach(clearTimeout);}
 }
 replace('VideoEncoder',options.noWebCodecs?undefined:Encoder);replace('VideoFrame',Frame);replace('document',{createElement:()=>canvas});
 let wallTime=0;replace('performance',{now:()=>wallTime});
 const renderer={render(s,w,h){wallTime+=options.renderMs??100;renders.push({s,w,h});return canvas;},gl:{isContextLost:()=>!!options.contextLost}};
 return {frames,renders,encoders,canvas,fills,renderer,progress,onProgress:p=>progress.push(p)};
}
const settings={...defaults,width:321,height:181,motionDuration:2};
const u32=(bytes,at)=>new DataView(bytes.buffer,bytes.byteOffset+at,4).getUint32(0);
function atom(bytes,type){const text=new TextDecoder('latin1').decode(bytes);const at=text.indexOf(type);assert.ok(at>=0,type);return at;}

test('Slow renders still yield every exact 30 fps frame, full duration and a complete MP4',async t=>{
 const e=environment(t,{renderMs:240});
 const result=await renderVideo(e.renderer,settings,{onProgress:e.onProgress});
 assert.equal(result.frameCount,60);assert.equal(result.duration,2);assert.equal(result.fps,30);assert.equal(result.blob.type,'video/mp4');
 assert.equal(e.renders.length,60);assert.equal(e.frames.length,60);
 for(let i=0;i<60;i++){
  assert.deepEqual(e.renders[i].s,motionFrame(settings,i/60));
  assert.equal(e.frames[i].timestamp,Math.round(i*1e6/30));
  assert.equal(e.frames[i].duration,Math.round((i+1)*1e6/30)-Math.round(i*1e6/30));
  assert.equal(e.frames[i].closed,true);
 }
 assert.equal(e.renders[0].w,322);assert.equal(e.renders[0].h,182);assert.equal(e.fills.length,60);
 assert.equal(e.encoders[0].state,'closed');assert.equal(e.canvas.width,1);
 assert.equal(e.progress.at(-1).message,'MP4 · Finishing');
 const bytes=new Uint8Array(await result.blob.arrayBuffer()),stts=atom(bytes,'stts'),mdhd=atom(bytes,'mdhd'),stsz=atom(bytes,'stsz');
 assert.equal(u32(bytes,stts+8),1);assert.equal(u32(bytes,stts+12),60);assert.equal(u32(bytes,stts+16),3000);
 assert.equal(u32(bytes,mdhd+16),90000);assert.equal(u32(bytes,mdhd+20),180000);assert.equal(u32(bytes,stsz+12),60);
});
test('Encoder backpressure bounds queued frames without dropping or reordering submissions',async t=>{
 const e=environment(t,{delay:20});await renderVideo(e.renderer,settings);
 assert.equal(e.frames.length,60);assert.ok(e.encoders[0].peak<=4);assert.equal(e.encoders[0].peak,4);
});
test('Abort during an encoder capacity wait closes resources and a new export can start',async t=>{
 const options={stall:true},e=environment(t,options),controller=new AbortController();
 await assert.rejects(renderVideo(e.renderer,settings,{signal:controller.signal,onProgress:p=>{if(p.current===4)setTimeout(()=>controller.abort(),10);}}),{name:'AbortError'});
 assert.equal(e.encoders[0].state,'closed');assert.ok(e.frames.every(f=>f.closed));assert.equal(e.canvas.width,1);
 options.stall=false;const result=await renderVideo(e.renderer,settings);assert.equal(result.frameCount,60);
});
test('Abort also interrupts final flush',async t=>{
 const e=environment(t,{flushStall:true}),controller=new AbortController();
 await assert.rejects(renderVideo(e.renderer,settings,{signal:controller.signal,onProgress:p=>{if(p.message==='MP4 · Finishing')setTimeout(()=>controller.abort(),10);}}),{name:'AbortError'});
 assert.equal(e.encoders[0].flushing,true);assert.equal(e.encoders[0].state,'closed');
});
for(const [option,pattern] of [['configureError',/Configure/],['encodeError',/Encode/],['asyncError',/Codec/],['contextLost',/graphics context/],['drop',/incomplete/],['duplicate',/incomplete/]]){
 test(option+' fails rather than saving a frozen or incomplete MP4',async t=>{
  const e=environment(t,{[option]:true});await assert.rejects(renderVideo(e.renderer,settings),pattern);
  assert.equal(e.encoders[0].state,'closed');assert.ok(e.frames.every(f=>f.closed));assert.equal(e.canvas.width,1);
 });
}
test('Unsupported encoders and pre-cancelled exports fail before rendering',async t=>{
 const options={unsupported:true},e=environment(t,options);await assert.rejects(renderVideo(e.renderer,settings),/unavailable/);assert.equal(e.renders.length,0);
 options.unsupported=false;globalThis.VideoEncoder=undefined;await assert.rejects(renderVideo(e.renderer,settings),/WebCodecs/);
 const controller=new AbortController();controller.abort();await assert.rejects(renderVideo(e.renderer,settings,{signal:controller.signal}),{name:'AbortError'});
});
test('Video export scales portrait and landscape sizes to an even 1920 px maximum',async t=>{
 const e=environment(t);
 for(const [width,height,expected] of [[4000,2250,[1920,1080]],[2250,4000,[1080,1920]],[1920,1920,[1920,1920]]]){
  const result=await renderVideo(e.renderer,{...settings,width,height});assert.deepEqual([result.width,result.height],expected);
 }
});
