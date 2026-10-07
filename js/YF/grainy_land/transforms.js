// Layer coordinates rotate in canvas pixels, so wide canvases do not shear shapes.
export function localToCanvas(p,l,aspect=1){
 const a=(l.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=(p[0]-.5)*l.scaleX*(l.flipX?-1:1)*aspect,y=(p[1]-.5)*l.scaleY*(l.flipY?-1:1);
 return [.5+l.x+(x*c-y*s)/aspect,.5+l.y+x*s+y*c];
}
export function canvasToLocal(p,l,aspect=1){
 const a=(l.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=(p[0]-.5-l.x)*aspect,y=p[1]-.5-l.y;
 return [.5+(x*c+y*s)/aspect/l.scaleX*(l.flipX?-1:1),.5+(-x*s+y*c)/l.scaleY*(l.flipY?-1:1)];
}
export const materialRanges={grain:[0,100],grainSize:[.5,4],softness:[0,100],edgeVariation:[0,100],glow:[0,100],halo:[0,100],glowCoverage:[0,100],contrast:[50,180]};
export function normalizeMaterial(v){const out={};for(const [k,[a,b]] of Object.entries(materialRanges))if(typeof v?.[k]==='number'&&Number.isFinite(v[k]))out[k]=Math.max(a,Math.min(b,v[k]));return out;}
