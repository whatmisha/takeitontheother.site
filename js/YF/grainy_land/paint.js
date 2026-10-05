// Strokes live in a form's local coordinates, independent of preview/export size.
export const MAX_STROKES = 64;
export const MAX_STROKE_POINTS = 192;
export const MAX_FORM_POINTS = 1024;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const finite = n => typeof n === 'number' && Number.isFinite(n);
const rounded = n => Math.round(n*100000)/100000;
export function normalizeStrokes(value) {
    if (!Array.isArray(value)) return [];
    let budget=MAX_FORM_POINTS;
    return value.slice(0,MAX_STROKES).flatMap(stroke=>{
        if (!stroke || !['paint','erase'].includes(stroke.kind) || !finite(stroke.rx) || !finite(stroke.ry)
            || stroke.rx<=0 || stroke.ry<=0 || !Array.isArray(stroke.points) || !budget) return [];
        const points=stroke.points.slice(0,Math.min(budget,MAX_STROKE_POINTS))
            .filter(p=>Array.isArray(p)&&p.length===2&&p.every(finite))
            .map(p=>p.map(n=>rounded(clamp(n,-8,9))));
        if(!points.length)return [];
        budget-=points.length;
        return [{kind:stroke.kind,rx:rounded(clamp(stroke.rx,.0001,2)),ry:rounded(clamp(stroke.ry,.0001,2)),points}];
    });
}
export function localPaintPoint(point,edit) {
    return [(point[0]-.5-edit.x)/edit.scaleX+.5,(point[1]-.5-edit.y)/edit.scaleY+.5];
}
export function brushStroke(settings,edit,point,size,kind) {
    const radius=Math.min(settings.width,settings.height)*size/200;
    return {kind,rx:radius/settings.width/edit.scaleX,ry:radius/settings.height/edit.scaleY,points:[localPaintPoint(point,edit)]};
}
export const strokePointCount = strokes => strokes.reduce((n,s)=>n+s.points.length,0);
export function capsuleDistance(point,a,b,rx,ry) {
    const vx=(b[0]-a[0])/rx,vy=(b[1]-a[1])/ry;
    const px=(point[0]-a[0])/rx,py=(point[1]-a[1])/ry;
    const t=clamp((px*vx+py*vy)/(vx*vx+vy*vy||1),0,1);
    return (1-Math.hypot(px-vx*t,py-vy*t))*ry;
}
// Ordered union/subtraction can be represented by two bounds on the original
// signed distance. This preserves procedural paint underneath eraser strokes.
export function paintDistance(original,point,strokes) {
    let d=original;
    for(const s of strokes) {
        let stamp=-Infinity;
        for(let i=0;i<s.points.length;i++) stamp=Math.max(stamp,capsuleDistance(point,s.points[Math.max(0,i-1)],s.points[i],s.rx,s.ry));
        d=s.kind==='paint'?Math.max(d,stamp):Math.min(d,-stamp);
    }
    return d;
}

const cache=new Map();
const DISTANCE=1;
export function bakePaint(strokes) {
    const key=JSON.stringify(strokes);
    if(cache.has(key)) {const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,minRx=Infinity,minRy=Infinity;
    const commands=[];
    for(const s of strokes) {
        minRx=Math.min(minRx,s.rx);minRy=Math.min(minRy,s.ry);
        const marginX=s.rx+DISTANCE*s.rx/s.ry,marginY=s.ry+DISTANCE;
        for(let i=0;i<s.points.length;i++) {
            const p=s.points[i];left=Math.min(left,p[0]-marginX);right=Math.max(right,p[0]+marginX);
            top=Math.min(top,p[1]-marginY);bottom=Math.max(bottom,p[1]+marginY);
            commands.push([s.kind,s.rx,s.ry,...s.points[Math.max(0,i-1)],...p]);
        }
    }
    // Stable bounds enable incremental baking while a stroke grows. The texture
    // contains 16-bit distances, not an enlarged low-resolution opacity bitmap.
    left=Math.floor(left*2)/2;top=Math.floor(top*2)/2;
    right=Math.ceil(right*2)/2;bottom=Math.ceil(bottom*2)/2;
    const width=clamp(Math.ceil((right-left)/Math.min(.004,minRx/6)),64,1024);
    const height=clamp(Math.ceil((bottom-top)/Math.min(.004,minRy/6)),64,1024);
    const bounds=[left,top,right-left,bottom-top],size=width*height;
    let lower=new Float32Array(size).fill(-DISTANCE),upper=new Float32Array(size).fill(DISTANCE),start=0;
    for(const previous of [...cache.values()].reverse()) {
        if(previous.width!==width || previous.height!==height || !previous.bounds.every((v,i)=>v===bounds[i])
            || previous.commands.length>=commands.length)continue;
        if(!previous.commands.every((c,i)=>c.every((v,j)=>v===commands[i][j])))continue;
        lower=previous.lower.slice();upper=previous.upper.slice();start=previous.commands.length;break;
    }
    const dx=bounds[2]/(width-1),dy=bounds[3]/(height-1);
    for(let i=start;i<commands.length;i++) {
        const [kind,rx,ry,ax,ay,bx,by]=commands[i];
        const vx=(bx-ax)/rx,vy=(by-ay)/ry,den=vx*vx+vy*vy||1;
        const mx=rx+DISTANCE*rx/ry,my=ry+DISTANCE;
        const x0=clamp(Math.floor((Math.min(ax,bx)-mx-left)/dx),0,width-1),x1=clamp(Math.ceil((Math.max(ax,bx)+mx-left)/dx),0,width-1);
        const y0=clamp(Math.floor((Math.min(ay,by)-my-top)/dy),0,height-1),y1=clamp(Math.ceil((Math.max(ay,by)+my-top)/dy),0,height-1);
        for(let y=y0;y<=y1;y++) {
            const py=(top+y*dy-ay)/ry;
            for(let x=x0;x<=x1;x++) {
                const px=(left+x*dx-ax)/rx,t=clamp((px*vx+py*vy)/den,0,1);
                const stamp=clamp((1-Math.sqrt((px-vx*t)**2+(py-vy*t)**2))*ry,-DISTANCE,DISTANCE),at=y*width+x;
                if(kind==='paint') {lower[at]=Math.max(lower[at],stamp);upper[at]=Math.max(upper[at],stamp);}
                else {lower[at]=Math.min(lower[at],-stamp);upper[at]=Math.min(upper[at],-stamp);}
            }
        }
    }
    const pixels=new Uint8Array(size*4);
    for(let i=0;i<size;i++) {
        const lo=Math.round((lower[i]/DISTANCE*.5+.5)*65535),hi=Math.round((upper[i]/DISTANCE*.5+.5)*65535);
        pixels.set([lo>>8,lo&255,hi>>8,hi&255],i*4);
    }
    const value={key,width,height,bounds,pixels,lower,upper,commands};cache.set(key,value);
    while(cache.size>8)cache.delete(cache.keys().next().value);
    return value;
}
