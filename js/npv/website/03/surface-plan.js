import { rotationMatrix } from './planet-motion.js';
import { projectCap } from './sphere-renderer.js';
import { smoothstep } from './story-timeline.js';
const mix = (a, b, t) => a + (b - a) * t;
export const SURFACE_ZOOM = 2.4;

export function surfaceParameters(progress) {
  return { zoom: mix(1, SURFACE_ZOOM, smoothstep(0, .8, progress)),
    pan: smoothstep(0, .8, progress), grid: smoothstep(.38, 1, progress),
    geography: smoothstep(0, .55, progress), discard: 1 - smoothstep(.3, .9, progress),
    person: smoothstep(.82, 1, progress) };
}

export function projectSurface(sphere, frame, metrics) {
  const matrix = rotationMatrix(frame.orientation);
  const factor = metrics.canvasWidth / 480;
  const regions = Object.entries(frame.regions);
  const points = [];
  let index = 0;
  for (const axis of sphere.axes) {
    const point = { x:matrix[0]*axis.x+matrix[1]*axis.y+matrix[2]*axis.z,
      y:matrix[3]*axis.x+matrix[4]*axis.y+matrix[5]*axis.z,
      z:matrix[6]*axis.x+matrix[7]*axis.y+matrix[8]*axis.z };
    for (const side of [1,-1]) {
      const normal = {x:point.x*side,y:point.y*side,z:point.z*side};
      const geography = sphere.geography;
      const country = geography ? Math.min(1, regions.reduce((sum,[id,weight]) =>
        sum + (geography.regions[id]?.[index] || 0) * weight, 0)) : 0;
      const land = geography ? Math.max(geography.land[index], country) : 0;
      const growth = (1 + (geography ? frame.land : 0) * (.95*land-.2)) * (1+.8*country);
      const cap = projectCap(normal, sphere.radius, sphere.angularRadius * growth);
      if (cap.visible) points.push({ id:index,
        x:metrics.canvasLeft + cap.x*factor, y:metrics.canvasTop + cap.y*factor,
        rx:cap.major*factor, ry:cap.minor*factor,
        angle:((cap.angle + Math.PI/2) % Math.PI + Math.PI) % Math.PI - Math.PI/2 });
      index++;
    }
  }
  return points;
}

// Assign each flat cell a unique nearby sphere mark after the camera approach.
// The extra marks shrink away; matching is cached for the whole reversible turn.
export function matchSurface(points, targets, width, height) {
  const cell = 48;
  const focus = {x:width/2,y:height*.62};
  const center = {x:width/2,y:height/2};
  const buckets = new Map();
  const projected = points.map(point => ({ x:center.x+(point.x-focus.x)*SURFACE_ZOOM,
    y:center.y+(point.y-focus.y)*SURFACE_ZOOM }));
  projected.forEach((point,index) => {
    const key = `${Math.floor(point.x/cell)}:${Math.floor(point.y/cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(index);
  });
  const assigned = new Set();
  const matches = new Map();
  const order = targets.map((target,index) => ({target,index})).sort((a,b) =>
    Math.hypot(a.target.cx-center.x,a.target.cy-center.y)-Math.hypot(b.target.cx-center.x,b.target.cy-center.y));
  for (const {target,index} of order) {
    const cx = Math.floor(target.cx/cell), cy = Math.floor(target.cy/cell);
    let best = -1, distance = Infinity;
    for (let ring = 0; ring <= 64; ring++) {
      for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
        if (ring && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        for (const candidate of buckets.get(`${cx+dx}:${cy+dy}`) || []) {
          if (assigned.has(candidate)) continue;
          const p = projected[candidate];
          const d = (p.x-target.cx)**2+(p.y-target.cy)**2;
          if (d < distance) { distance=d; best=candidate; }
        }
      }
      if (best >= 0 && distance < (Math.max(0,ring-1)*cell)**2) break;
    }
    if (best >= 0) { assigned.add(best); matches.set(best,index); }
  }
  return { matches, focus, center };
}

export function surfaceMark(source, target, parameters, plan) {
  const {zoom,pan,grid,geography,discard} = parameters;
  const x = mix(plan.focus.x,plan.center.x,pan)+(source.x-plan.focus.x)*zoom;
  const y = mix(plan.focus.y,plan.center.y,pan)+(source.y-plan.focus.y)*zoom;
  // Preserve the original foreshortening while geography fades, then flatten.
  const rx = mix(source.rx,2,geography)*zoom;
  const ry = mix(source.ry,source.rx ? 2*source.ry/source.rx : 0,geography)*zoom;
  return target ? {x:mix(x,target.cx,grid),y:mix(y,target.cy,grid),
    rx:mix(rx,target.rx,grid),ry:mix(ry,target.ry,grid),angle:source.angle*(1-grid)}
    : {x,y,rx:rx*discard,ry:ry*discard,angle:source.angle};
}
