const ARTBOARD_SIZE = 480;
import { axisRotation, rotationMatrix } from './planet-motion.js';

const TAU = Math.PI * 2;

function hull(points) {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list) => {
    const result = [];
    for (const point of list) {
      while (result.length > 1 && turn(result.at(-2), result.at(-1), point) <= 0) result.pop();
      result.push(point);
    }
    result.pop();
    return result;
  };
  return [...half(points), ...half([...points].reverse())];
}

/** A spherical cap under orthographic projection is an ellipse. */
export function projectCap(normal, radius, angularRadius) {
  const sine = Math.sin(angularRadius);
  return {
    x: ARTBOARD_SIZE / 2 + normal.x * radius * Math.cos(angularRadius),
    y: ARTBOARD_SIZE / 2 + normal.y * radius * Math.cos(angularRadius),
    major: radius * sine,
    minor: radius * sine * Math.abs(normal.z),
    angle: Math.atan2(normal.y, normal.x) + Math.PI / 2,
    visible: normal.z > -sine,
    whole: normal.z >= sine
  };
}

// Only the few caps grazing the horizon need a polygon instead of an ellipse.
function horizonCap(normal, angularRadius, radius) {
  const cosine = Math.cos(angularRadius);
  const sine = Math.sin(angularRadius);
  const radial = Math.hypot(normal.x, normal.y);
  const first = { x: -normal.y / radial, y: normal.x / radial, z: 0 };
  const second = {
    x: -normal.z * first.y,
    y: normal.z * first.x,
    z: normal.x * first.y - normal.y * first.x
  };
  const points = [];
  const add = (x, y) => points.push({ x: 240 + x * radius, y: 240 + y * radius });
  for (let i = 0; i < 64; i++) {
    const angle = i / 64 * TAU;
    const c = Math.cos(angle) * sine;
    const s = Math.sin(angle) * sine;
    if (normal.z * cosine + second.z * s >= 0) {
      add(normal.x * cosine + first.x * c + second.x * s,
        normal.y * cosine + first.y * c + second.y * s);
    }
  }
  const centerAngle = Math.atan2(normal.y, normal.x);
  const halfArc = Math.acos(Math.min(1, cosine / radial));
  for (let i = 0; i <= 12; i++) {
    const angle = centerAngle - halfArc + 2 * halfArc * i / 12;
    add(Math.cos(angle), Math.sin(angle));
  }
  return hull(points);
}

export class MainSphere {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.rotation = 0;
    this.cssSize = 0;
    this.layoutVersion = 0;
    this.frame = { orientation: axisRotation(0, 0), land: 0, regions: {} };
    this.resize();
  }

  resize() {
    const cssSize = this.canvas.getBoundingClientRect().width;
    if (cssSize <= 0) return;
    // Regenerate only when the displayed width changes, never while scrolling.
    // A height-only resize or DPR change preserves the existing arrangement.
    if (Math.abs(cssSize - this.cssSize) > .01) {
      this.layoutVersion++;
      this.geography = null;
      this.radius = 224;
      this.angularRadius = Math.asin(4 / (2 * this.radius * cssSize / ARTBOARD_SIZE));
      this.color = '#ffffff';
      this.cssSize = cssSize;
    }
    const size = Math.max(1, Math.round(cssSize * Math.min(globalThis.devicePixelRatio || 1, 2)));
    if (this.canvas.width !== size || this.canvas.height !== size) {
      this.canvas.width = size;
      this.canvas.height = size;
    }
    this.drawFrame(this.frame);
  }

  draw(degrees) {
    this.rotation = degrees;
    this.drawFrame({ orientation: axisRotation(0, degrees), land: 0, regions: {} });
  }

  setViewport(panel, canvas) {
    const scale = ARTBOARD_SIZE / canvas.width;
    this.viewport = {left:(panel.left-canvas.left)*scale, right:(panel.right-canvas.left)*scale,
      top:(panel.top-canvas.top)*scale, bottom:(panel.bottom-canvas.top)*scale};
  }

  setLayout(layout, version) {
    if (version !== this.layoutVersion) return false;
    this.axes = layout.axes;
    this.radius = layout.sphereRadius;
    this.angularRadius = layout.angularRadius;
    this.color = layout.color;
    this.geography = null;
    return true;
  }

  setGeography(masks, version) {
    if (!this.axes || version !== this.layoutVersion || masks.land.length !== this.axes.length * 2) return false;
    this.geography = masks;
    return true;
  }

  drawFrame(frame) {
    this.frame = frame;
    if (!this.axes) return;
    const context = this.context;
    const scale = this.canvas.width / ARTBOARD_SIZE;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, ARTBOARD_SIZE, ARTBOARD_SIZE);
    context.fillStyle = this.color;
    const matrix = rotationMatrix(frame.orientation);
    const geography = this.geography;
    const planetAmount = geography ? frame.land : 0;
    const activeRegions = geography ? Object.entries(frame.regions)
      .filter(([id, weight]) => weight > 0 && geography.regions[id]) : [];
    const sizes = new Map();
    const sizeFor = growth => {
      let size = sizes.get(growth);
      if (!size) {
        const angle = this.angularRadius * growth;
        const sine = Math.sin(angle);
        size = {angle,sine,center:this.radius*Math.cos(angle),major:this.radius*sine};
        sizes.set(growth,size);
      }
      return size;
    };
    const viewport = this.viewport;
    let pointIndex = 0;
    let batchSize = 0;
    context.beginPath();
    for (const axis of this.axes) {
      const x = matrix[0]*axis.x + matrix[1]*axis.y + matrix[2]*axis.z;
      const y = matrix[3]*axis.x + matrix[4]*axis.y + matrix[5]*axis.z;
      const z = matrix[6]*axis.x + matrix[7]*axis.y + matrix[8]*axis.z;
      for (const side of [1, -1]) {
        // Masks stay attached to the unrotated surface, including its back side.
        let country = 0;
        for (const [id, weight] of activeRegions) country += geography.regions[id][pointIndex] * weight;
        country = Math.min(1, country);
        const land = geography ? Math.max(geography.land[pointIndex], country) : 0;
        // From the same 4px base, Planet fades ocean to 3.2px and land to
        // 7px. Selected countries grow a further 80%, to about 12.6px.
        const growth = (1 + planetAmount * (.95 * land - .2)) * (1 + .8 * country);
        const size = sizeFor(growth);
        pointIndex++;
        const nz = z * side;
        if (nz < -size.sine) continue;
        const cx = 240 + x * side * size.center;
        const cy = 240 + y * side * size.center;
        if (viewport && (cx+size.major<viewport.left || cx-size.major>viewport.right
          || cy+size.major<viewport.top || cy-size.major>viewport.bottom)) continue;
        const cap = {x:cx,y:cy,major:size.major,minor:size.major*Math.abs(nz),
          angle:Math.atan2(y*side,x*side)+Math.PI/2,whole:nz>=size.sine};
        if (cap.whole) {
          context.moveTo(cap.x + Math.cos(cap.angle) * cap.major,
            cap.y + Math.sin(cap.angle) * cap.major);
          context.ellipse(cap.x, cap.y, cap.major, cap.minor, cap.angle, 0, TAU);
        } else {
          const points = horizonCap({x:x*side,y:y*side,z:nz}, size.angle, this.radius);
          if (points.length < 3) continue;
          context.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
        }
        context.closePath();
        // Bounded paths avoid expensive tessellation of thousands of ellipses
        // at once. All marks are opaque; panel opacity is applied in CSS.
        if (++batchSize === 256) {
          context.fill();
          context.beginPath();
          batchSize = 0;
        }
      }
    }
    if (batchSize) context.fill();
  }
}
