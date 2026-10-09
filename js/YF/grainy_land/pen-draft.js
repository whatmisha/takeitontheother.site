// A Pen draft is independent of document history until its path is closed.
export class PenDraft {
    constructor(){this.points=[];this.past=[];this.future=[];}
    replace(points){
        this.past.push(structuredClone(this.points));
        if(this.past.length>96)this.past.shift();
        this.points=structuredClone(points);this.future=[];
    }
    undo(){
        if(!this.past.length)return false;
        this.future.push(structuredClone(this.points));this.points=this.past.pop();return true;
    }
    redo(){
        if(!this.future.length)return false;
        this.past.push(structuredClone(this.points));this.points=this.future.pop();return true;
    }
    removeLast(){if(this.points.length)this.replace(this.points.slice(0,-1));}
}
