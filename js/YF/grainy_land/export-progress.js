// One progress surface replaces the export buttons, following Sparky's dock.
export class ExportProgress {
    constructor({container, status, progress, message, cancelButton, onChange=()=>{}, clock=globalThis}) {
        Object.assign(this,{container,status,progress,message,cancelButton,onChange,clock});
        this.busy=false;this.destroyed=false;this.timer=null;this.controller=null;
        this.cancel=()=>this.controller?.abort(new DOMException('Export cancelled.','AbortError'));
        cancelButton.addEventListener('click',this.cancel);
    }
    update(current,total,message) {
        const max=Math.max(1,Number(total)||1),value=Math.max(0,Math.min(max,Number(current)||0));
        this.progress.max=max;this.progress.value=value;
        this.status.style.setProperty('--export-progress',value/max*100+'%');
        this.message.textContent=message;
    }
    show(state,message) {
        if(this.destroyed)return;
        this.busy=state!=='idle';this.container.classList.toggle('is-exporting',this.busy);
        this.status.hidden=!this.busy;this.status.dataset.state=state;
        this.status.setAttribute('aria-busy',String(state==='working'));
        this.cancelButton.hidden=state!=='working';this.message.textContent=message;
        this.onChange();
    }
    finish(state,message) {
        if(this.destroyed)return;
        if(state==='complete')this.update(1,1,message);
        this.show(state,message);
        this.timer=this.clock.setTimeout(()=>{this.timer=null;this.show('idle','');},state==='error'?2600:800);
    }
    async run({signal,label},operation) {
        if(this.busy||this.destroyed)return;
        const controller=new AbortController();this.controller=controller;
        const abort=()=>controller.abort(signal.reason);
        signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
        this.status.title='';this.update(0,1,'Preparing '+label);this.show('working','Preparing '+label);
        try {
            controller.signal.throwIfAborted();
            // Let the browser paint Preparing before synchronous GPU work begins.
            await new Promise(resolve=>this.clock.setTimeout(resolve,0));
            controller.signal.throwIfAborted();
            const result=await operation({signal:controller.signal,onProgress:({current,total,message})=>{
                if(!this.destroyed&&!controller.signal.aborted)this.update(current,total,message||label+' · '+Math.round(current/total*100)+'%');
            }});
            controller.signal.throwIfAborted();this.finish('complete','Done');return result;
        } catch(error) {
            if(controller.signal.aborted){this.finish('cancelled','Cancelled');return;}
            this.status.title=error.message||'Export failed.';
            this.finish('error','Export failed');throw error;
        } finally {
            signal?.removeEventListener('abort',abort);if(this.controller===controller)this.controller=null;
        }
    }
    destroy() {
        this.cancel();this.clock.clearTimeout(this.timer);this.show('idle','');this.destroyed=true;
        this.cancelButton.removeEventListener('click',this.cancel);
    }
}
