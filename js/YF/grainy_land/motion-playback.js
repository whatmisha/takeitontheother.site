// Keep at most one frame in flight. A stopped/restarted session can never present
// a late frame, even when a renderer ignores cancellation until its work ends.
export class MotionPlayback {
 constructor({renderFrame,getContext,present,onError,now=()=>performance.now(),schedule=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id)}){
  Object.assign(this,{renderFrame,getContext,present,onError,now,schedule,cancel});this.frame=null;this.request=0;this.controller=null;
 }
 start(){this.stop();this.controller=new AbortController();this.started=this.now();this.tick(this.controller);}
 stop(){this.controller?.abort();this.controller=null;this.cancel(this.request);this.request=0;this.frame=null;}
 async tick(session){
  if(this.controller!==session)return;
  try{
   const context=this.getContext();
   if(context){
    const phase=(this.now()-this.started)/1000/context.settings.motionDuration;
    const frame=await this.renderFrame(context,phase,{signal:session.signal});
    if(this.controller!==session)return;
    this.frame=frame;this.present();
   }
   if(this.controller===session)this.request=this.schedule(()=>this.tick(session));
  }catch(error){if(this.controller===session){this.stop();this.onError(error);}}
 }
}
