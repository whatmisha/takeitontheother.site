// Closed cubic paths in layer-local coordinates. Editing follows Sparky's
// anchor/paired-handle model, without its circular motion-path constraint.
export const MAX_VECTOR_NODES=48;
const clamp=n=>Math.max(-2,Math.min(3,n));
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)?p.map(n=>Math.round(clamp(n)*1e5)/1e5):null;
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function defaultVectorPath() {
    const k=.1380712;
    return [{x:.5,y:.25,in:[.5-k,.25],out:[.5+k,.25],smooth:true},
        {x:.75,y:.5,in:[.75,.5-k],out:[.75,.5+k],smooth:true},
        {x:.5,y:.75,in:[.5+k,.75],out:[.5-k,.75],smooth:true},
        {x:.25,y:.5,in:[.25,.5+k],out:[.25,.5-k],smooth:true}];
}
export function normalizeVectorPath(value) {
    if(!Array.isArray(value))return null;
    const nodes=value.slice(0,MAX_VECTOR_NODES).flatMap(n=>{
        if(!n||!Number.isFinite(n.x)||!Number.isFinite(n.y))return [];
        const p=point([n.x,n.y]);return [{x:p[0],y:p[1],in:point(n.in)??p.slice(),out:point(n.out)??p.slice(),smooth:n.smooth===true}];
    });
    return nodes.length>=3?nodes:null;
}
export function vectorSegment(path,i) {const a=path[i],b=path[(i+1)%path.length];return [[a.x,a.y],a.out,b.in,[b.x,b.y]];}
export function cubicPoint(segment,t) {const [a,b,c,d]=segment,u=1-t;return a.map((v,i)=>u*u*u*v+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]);}
export function moveVectorNode(path,index,p,side='anchor',independent=false) {
    const nodes=structuredClone(path),node=nodes[index];if(!node)return nodes;
    p=point(p);if(!p)return nodes;
    if(side==='anchor') {
        const delta=[p[0]-node.x,p[1]-node.y];node.in=node.in.map((v,i)=>v+delta[i]);node.out=node.out.map((v,i)=>v+delta[i]);[node.x,node.y]=p;
    } else if(side==='in'||side==='out') {
        const other=side==='in'?'out':'in',a=[node.x,node.y],v=p.map((x,i)=>x-a[i]),len=Math.hypot(...v),otherLen=Math.hypot(...node[other].map((x,i)=>x-a[i]));
        node[side]=p;
        if(independent)node.smooth=false;
        if(node.smooth&&len>1e-8)node[other]=a.map((x,i)=>x-v[i]*otherLen/len);
    }
    return normalizeVectorPath(nodes);
}
export function setVectorNodesSmooth(path,indices,smooth) {
    const nodes=structuredClone(path);
    for(const index of indices){
        const n=nodes[index];if(!n)continue;
        if(!smooth){n.smooth=false;n.in=[n.x,n.y];n.out=[n.x,n.y];continue;}
        if(n.smooth)continue;
        const prev=nodes[(index-1+nodes.length)%nodes.length],next=nodes[(index+1)%nodes.length];
        const inLength=Math.hypot(n.in[0]-n.x,n.in[1]-n.y),outLength=Math.hypot(n.out[0]-n.x,n.out[1]-n.y);
        // Re-align independent handles without collapsing or shortening them.
        const dx=outLength>1e-8?n.out[0]-n.x:inLength>1e-8?n.x-n.in[0]:next.x-prev.x;
        const dy=outLength>1e-8?n.out[1]-n.y:inLength>1e-8?n.y-n.in[1]:next.y-prev.y;
        const length=Math.hypot(dx,dy)||1,a=inLength||Math.hypot(n.x-prev.x,n.y-prev.y)/3,b=outLength||Math.hypot(next.x-n.x,next.y-n.y)/3;
        n.in=[n.x-dx/length*a,n.y-dy/length*a];n.out=[n.x+dx/length*b,n.y+dy/length*b];n.smooth=true;
    }
    return normalizeVectorPath(nodes);
}
export function toggleVectorNode(path,index) {return setVectorNodesSmooth(path,[index],!path[index]?.smooth);}
export function splitVectorSegment(path,index,t=.5) {
    if(path.length>=MAX_VECTOR_NODES)return path;
    t=Math.max(.02,Math.min(.98,t));const nodes=structuredClone(path),[a,b,c,d]=vectorSegment(nodes,index);
    const ab=mix(a,b,t),bc=mix(b,c,t),cd=mix(c,d,t),abc=mix(ab,bc,t),bcd=mix(bc,cd,t),p=mix(abc,bcd,t);
    nodes[index].out=ab;nodes[(index+1)%nodes.length].in=cd;
    nodes.splice(index+1,0,{x:p[0],y:p[1],in:abc,out:bcd,smooth:true});return normalizeVectorPath(nodes);
}
export function removeVectorNode(path,index) {return path.length>3?path.filter((_,i)=>i!==index):path;}
export function flattenVectorPath(path) {
    const result=[];
    function flatten(s,depth=0) {
        const [a,b,c,d]=s,dx=d[0]-a[0],dy=d[1]-a[1],den=dx*dx+dy*dy;
        // Distance to the finite chord also catches collinear handles that
        // overshoot their anchors, which a line-only flatness test misses.
        const distance=p=>{const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(den||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);};
        const flat=Math.max(distance(b),distance(c));
        if(flat<.0005||depth>=7){result.push(a);return;}
        const ab=mix(a,b,.5),bc=mix(b,c,.5),cd=mix(c,d,.5),abc=mix(ab,bc,.5),bcd=mix(bc,cd,.5),p=mix(abc,bcd,.5);
        flatten([a,ab,abc,p],depth+1);flatten([p,bcd,cd,d],depth+1);
    }
    path.forEach((_,i)=>flatten(vectorSegment(path,i)));return result;
}
export function vectorDistance(x,y,polygon) {
    let inside=false,min=Infinity;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
        const a=polygon[j],b=polygon[i],vx=b[0]-a[0],vy=b[1]-a[1],px=x-a[0],py=y-a[1],t=Math.max(0,Math.min(1,(px*vx+py*vy)/(vx*vx+vy*vy||1)));
        min=Math.min(min,(px-vx*t)**2+(py-vy*t)**2);
        if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return Math.sqrt(min)*(inside?1:-1);
}
