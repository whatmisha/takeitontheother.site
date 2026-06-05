import { StrokeFactory } from "./StrokeFactory.js";
import {
  createRng,
  jitterPoint,
  lerp,
  makeGroupId,
  normalizePercent,
  normalizeRange,
  point,
  randomBetween,
  randomSign,
  sampleCubicBezier
} from "./GeneratorUtils.js";

export class DoodleFlorGenerator {
  generate({ width, height, color, settings }) {
    const seed = normalizeRange(settings.seed, 2207, 1, 999999);
    const rng = createRng(seed);
    const groupId = makeGroupId("doodle-flor", seed);
    const factory = new StrokeFactory({ source: "doodle-flor", groupId, color, seed, roughness: normalizePercent(settings.roughness, 100) });
    const strokes = [];

    const shape = settings.shape === "mixed" ? pickShape(rng) : (settings.shape || "daisy");
    const scale = normalizePercent(settings.scale, 64);
    const petals = Math.round(normalizeRange(settings.petals, 6, 3, 12));
    const openness = normalizePercent(settings.openness, 72);
    const wobble = normalizePercent(settings.wobble, 46);
    const scribble = normalizePercent(settings.scribble, 28);
    const stemAmount = normalizePercent(settings.stem, 84);
    const leavesAmount = normalizePercent(settings.leaves, 42);
    const density = normalizePercent(settings.density, 78);
    const dotSize = normalizeRange(settings.dotSize, 20, 4, 90);
    const sizeVariation = normalizePercent(settings.sizeVariation, 0);
    const jitter = normalizePercent(settings.jitter, 16);
    const maxStrokes = Math.round(normalizeRange(settings.maxStrokes, 60, 8, 180));

    const minSide = Math.min(width, height);
    const radius = minSide * lerp(0.13, 0.27, scale);
    const center = point(
      width * randomBetween(rng, 0.46, 0.54),
      height * randomBetween(rng, 0.29, 0.39)
    );
    const line = {
      density: lerp(0.72, 2.35, density),
      dotSize,
      sizeVariation,
      jitter: lerp(0, dotSize * 0.26, jitter),
      wobble: lerp(0, radius * 0.14, wobble)
    };

    const stemTop = point(center.x + randomBetween(rng, -radius * 0.08, radius * 0.08), center.y + radius * lerp(0.15, 0.42, openness));
    const stemBottom = point(
      center.x + randomBetween(rng, -radius * 0.28, radius * 0.28),
      height * randomBetween(rng, 0.78, 0.9)
    );

    if (stemAmount > 0.05) {
      this.addStem(strokes, factory, stemTop, stemBottom, { rng, radius, line, stemAmount });
      this.addLeaves(strokes, factory, stemTop, stemBottom, { rng, radius, line, leavesAmount, openness });
    }

    if (shape === "blob") {
      this.addBlobFlower(strokes, factory, center, { rng, radius, petals, openness, line });
    } else if (shape === "star") {
      this.addStarFlower(strokes, factory, center, { rng, radius, petals, openness, line });
    } else if (shape === "tulip") {
      this.addTulipFlower(strokes, factory, center, { rng, radius, openness, line });
    } else {
      this.addDaisyFlower(strokes, factory, center, { rng, radius, petals, openness, line });
    }

    this.addCenter(strokes, factory, center, { rng, radius, line, scribble });
    this.addInnerScribbles(strokes, factory, center, { rng, radius, petals, openness, line, scribble, shape });

    return strokes.filter(Boolean).slice(0, maxStrokes);
  }

  addStem(strokes, factory, top, bottom, options) {
    const bend = options.radius * randomBetween(options.rng, 0.12, 0.42) * randomSign(options.rng) * options.stemAmount;
    const p1 = point(lerp(bottom.x, top.x, 0.28) + bend, lerp(bottom.y, top.y, 0.28));
    const p2 = point(lerp(bottom.x, top.x, 0.72) - bend * randomBetween(options.rng, 0.45, 0.9), lerp(bottom.y, top.y, 0.72));
    const stem = roughenPath(sampleCubicBezier(bottom, p1, p2, top, 15), options.rng, options.line.jitter * 0.7);
    strokes.push(this.createLine(factory, stem, options, "stem", { sizeScale: 0.82, densityScale: 1.12 }));
  }

  addLeaves(strokes, factory, top, bottom, options) {
    const count = Math.round(lerp(0, 4, options.leavesAmount));
    if (count <= 0) return;

    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 0.58 : lerp(0.34, 0.72, index / Math.max(1, count - 1));
      const anchor = point(lerp(bottom.x, top.x, t), lerp(bottom.y, top.y, t));
      const side = index % 2 === 0 ? -1 : 1;
      const length = options.radius * randomBetween(options.rng, 0.38, 0.74) * lerp(0.72, 1.18, options.openness);
      const width = length * randomBetween(options.rng, 0.22, 0.42);
      const tip = point(anchor.x + side * length, anchor.y - length * randomBetween(options.rng, 0.14, 0.34));
      const upper = point(lerp(anchor.x, tip.x, 0.48), lerp(anchor.y, tip.y, 0.48) - width);
      const lower = point(lerp(anchor.x, tip.x, 0.52), lerp(anchor.y, tip.y, 0.52) + width * randomBetween(options.rng, 0.34, 0.72));
      const leaf = closePath([
        ...sampleCubicBezier(anchor, upper, upper, tip, 6),
        ...sampleCubicBezier(tip, lower, lower, anchor, 6).slice(1)
      ]);
      strokes.push(this.createLine(factory, roughenPath(leaf, options.rng, options.line.jitter), options, "leaf", { sizeScale: 0.76 }));

      if (options.rng() > 0.38) {
        strokes.push(this.createLine(factory, roughenPath([anchor, tip], options.rng, options.line.jitter * 0.4), options, "leaf-vein", { sizeScale: 0.58, densityScale: 0.78 }));
      }
    }
  }

  addDaisyFlower(strokes, factory, center, options) {
    const angleOffset = randomBetween(options.rng, -0.2, 0.2);
    for (let index = 0; index < options.petals; index += 1) {
      const angle = angleOffset + (index / options.petals) * Math.PI * 2 + randomBetween(options.rng, -0.15, 0.15);
      const length = options.radius * randomBetween(options.rng, 0.78, 1.28) * lerp(0.76, 1.18, options.openness);
      const width = options.radius * randomBetween(options.rng, 0.22, 0.42);
      const petal = makePetalLoop(center, angle, length, width, options);
      strokes.push(this.createLine(factory, petal, options, "petal"));
    }
  }

  addBlobFlower(strokes, factory, center, options) {
    const steps = Math.max(36, options.petals * 8);
    const points = [];
    const baseRadius = options.radius * lerp(0.7, 1.08, options.openness);
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const angle = t * Math.PI * 2;
      const lobe = 0.18 + (Math.sin(angle * options.petals + randomBetween(options.rng, -0.18, 0.18)) * 0.14);
      const radius = baseRadius * (1 + lobe + randomBetween(options.rng, -0.07, 0.09));
      points.push(point(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius));
    }
    strokes.push(this.createLine(factory, roughenPath(closePath(points), options.rng, options.line.jitter + options.line.wobble * 0.18), options, "flower-outline"));
  }

  addStarFlower(strokes, factory, center, options) {
    const points = [];
    const innerRadius = options.radius * randomBetween(options.rng, 0.22, 0.36);
    const outerRadius = options.radius * lerp(0.76, 1.32, options.openness);
    const count = options.petals * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + randomBetween(options.rng, -0.08, 0.08);
      const radius = (index % 2 === 0 ? outerRadius : innerRadius) * randomBetween(options.rng, 0.86, 1.16);
      points.push(point(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius));
    }
    strokes.push(this.createLine(factory, roughenPath(closePath(points), options.rng, options.line.jitter + options.line.wobble * 0.22), options, "flower-outline"));
  }

  addTulipFlower(strokes, factory, center, options) {
    const cupBottom = point(center.x, center.y + options.radius * 0.5);
    const leftTip = point(center.x - options.radius * lerp(0.48, 0.82, options.openness), center.y - options.radius * 0.15);
    const midTip = point(center.x + randomBetween(options.rng, -options.radius * 0.08, options.radius * 0.08), center.y - options.radius * 0.88);
    const rightTip = point(center.x + options.radius * lerp(0.48, 0.82, options.openness), center.y - options.radius * 0.16);
    const cup = closePath([
      ...sampleCubicBezier(cupBottom, point(center.x - options.radius * 0.6, center.y + options.radius * 0.34), leftTip, leftTip, 5),
      ...sampleCubicBezier(leftTip, point(center.x - options.radius * 0.2, center.y - options.radius * 0.68), midTip, midTip, 5).slice(1),
      ...sampleCubicBezier(midTip, point(center.x + options.radius * 0.24, center.y - options.radius * 0.65), rightTip, rightTip, 5).slice(1),
      ...sampleCubicBezier(rightTip, point(center.x + options.radius * 0.62, center.y + options.radius * 0.36), cupBottom, cupBottom, 5).slice(1)
    ]);
    strokes.push(this.createLine(factory, roughenPath(cup, options.rng, options.line.jitter + options.line.wobble * 0.16), options, "tulip-outline"));

    const innerLeft = sampleCubicBezier(cupBottom, point(center.x - options.radius * 0.25, center.y - options.radius * 0.14), leftTip, midTip, 7);
    const innerRight = sampleCubicBezier(cupBottom, point(center.x + options.radius * 0.23, center.y - options.radius * 0.12), rightTip, midTip, 7);
    strokes.push(this.createLine(factory, roughenPath(innerLeft, options.rng, options.line.jitter * 0.6), options, "tulip-detail", { sizeScale: 0.62, densityScale: 0.82 }));
    strokes.push(this.createLine(factory, roughenPath(innerRight, options.rng, options.line.jitter * 0.6), options, "tulip-detail", { sizeScale: 0.62, densityScale: 0.82 }));
  }

  addCenter(strokes, factory, center, options) {
    const centerRadius = options.radius * randomBetween(options.rng, 0.1, 0.19);
    strokes.push(this.createLine(factory, roughenPath(makeCircle(center, centerRadius, 18), options.rng, options.line.jitter * 0.45), options, "center", { sizeScale: 0.86, densityScale: 1.2 }));

    const dotCount = Math.round(lerp(1, 8, options.scribble));
    for (let index = 0; index < dotCount; index += 1) {
      const mark = jitterPoint(center, options.rng, centerRadius * 0.56);
      strokes.push(factory.createDot(mark.x, mark.y, {
        brush: "dotted",
        size: varyDotSize(options.line.dotSize * lerp(0.78, 1.28, options.scribble), options.rng, options.line.sizeVariation),
        sizeVariation: options.line.sizeVariation,
        density: options.line.density,
        seed: randomStrokeSeed(options.rng),
        role: "center-fill"
      }));
    }
  }

  addInnerScribbles(strokes, factory, center, options) {
    const count = Math.round(lerp(0, options.shape === "tulip" ? 5 : 9, options.scribble));
    for (let index = 0; index < count; index += 1) {
      const angle = randomBetween(options.rng, 0, Math.PI * 2);
      const start = point(
        center.x + Math.cos(angle) * options.radius * randomBetween(options.rng, 0.12, 0.32),
        center.y + Math.sin(angle) * options.radius * randomBetween(options.rng, 0.12, 0.32)
      );
      const end = point(
        center.x + Math.cos(angle) * options.radius * randomBetween(options.rng, 0.48, 0.92) * lerp(0.7, 1.08, options.openness),
        center.y + Math.sin(angle) * options.radius * randomBetween(options.rng, 0.48, 0.9)
      );
      const middle = point(
        lerp(start.x, end.x, 0.5) + randomBetween(options.rng, -options.radius * 0.18, options.radius * 0.18),
        lerp(start.y, end.y, 0.5) + randomBetween(options.rng, -options.radius * 0.18, options.radius * 0.18)
      );
      const path = roughenPath([start, middle, end], options.rng, options.line.jitter * 0.85);
      strokes.push(this.createLine(factory, path, options, "inner-scribble", {
        sizeScale: lerp(0.5, 0.78, options.scribble),
        densityScale: lerp(0.72, 1.16, options.scribble)
      }));
    }
  }

  createLine(factory, path, options, role, overrides = {}) {
    return factory.createPolyline(path, {
      brush: "dotted",
      size: varyDotSize(options.line.dotSize * (overrides.sizeScale ?? 1), options.rng, options.line.sizeVariation),
      sizeVariation: options.line.sizeVariation,
      density: options.line.density * (overrides.densityScale ?? 1),
      seed: randomStrokeSeed(options.rng),
      role
    });
  }
}

function makePetalLoop(center, angle, length, width, options) {
  const radialX = Math.cos(angle);
  const radialY = Math.sin(angle);
  const tangentX = Math.cos(angle + Math.PI / 2);
  const tangentY = Math.sin(angle + Math.PI / 2);
  const baseRadius = options.radius * randomBetween(options.rng, 0.08, 0.2);
  const base = point(center.x + radialX * baseRadius, center.y + radialY * baseRadius);
  const tip = point(
    center.x + radialX * (length + randomBetween(options.rng, -options.line.wobble, options.line.wobble)),
    center.y + radialY * (length + randomBetween(options.rng, -options.line.wobble, options.line.wobble))
  );
  const left = point(
    center.x + radialX * length * randomBetween(options.rng, 0.34, 0.58) + tangentX * width,
    center.y + radialY * length * randomBetween(options.rng, 0.34, 0.58) + tangentY * width
  );
  const right = point(
    center.x + radialX * length * randomBetween(options.rng, 0.34, 0.58) - tangentX * width,
    center.y + radialY * length * randomBetween(options.rng, 0.34, 0.58) - tangentY * width
  );
  const points = [
    ...sampleCubicBezier(base, left, left, tip, 6),
    ...sampleCubicBezier(tip, right, right, base, 6).slice(1)
  ];
  return roughenPath(closePath(points), options.rng, options.line.jitter + options.line.wobble * 0.14);
}

function makeCircle(center, radius, steps) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    points.push(point(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius));
  }
  return points;
}

function closePath(path) {
  if (!path.length) return path;
  return [...path, point(path[0].x, path[0].y, path[0].pressure ?? 0.72)];
}

function roughenPath(path, rng, amount) {
  if (!amount) return path;
  const closed = path.length > 2 && Math.hypot(path[0].x - path[path.length - 1].x, path[0].y - path[path.length - 1].y) < 0.01;
  const rough = path.map((item, index) => {
    if (closed && (index === 0 || index === path.length - 1)) return point(item.x, item.y, item.pressure ?? 0.72);
    return jitterPoint(item, rng, amount);
  });
  if (closed) rough[rough.length - 1] = point(rough[0].x, rough[0].y, rough[0].pressure ?? 0.72);
  return rough;
}

function varyDotSize(size, rng, variation) {
  return size * (variation > 0 ? Math.max(0.08, lerp(1 - variation, 1 + variation, rng())) : 1);
}

function randomStrokeSeed(rng) {
  return Math.floor(rng() * 4294967295) >>> 0;
}

function pickShape(rng) {
  const shapes = ["daisy", "blob", "star", "tulip"];
  return shapes[Math.floor(rng() * shapes.length)] || "daisy";
}
