import { StrokeFactory } from "./StrokeFactory.js";
import {
  clamp,
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

export class PlantGenerator {
  generate({ width, height, color, settings }) {
    const seed = normalizeRange(settings.seed, 1207, 1, 999999);
    const rng = createRng(seed);
    const groupId = makeGroupId("flor", seed);
    const factory = new StrokeFactory({ source: "flor", groupId, color, seed, roughness: normalizePercent(settings.roughness, 100) });
    const strokes = [];
    const type = settings.type || "single";
    const scale = normalizePercent(settings.scale, 70);
    const complexity = normalizePercent(settings.complexity, 65);
    const recognition = normalizePercent(settings.recognition, 72);
    const abstraction = normalizePercent(settings.abstraction, 28);
    const density = normalizePercent(settings.density, 70);
    const jitter = normalizePercent(settings.jitter, 46);
    const mass = normalizePercent(settings.mass, 50);
    const bend = normalizePercent(settings.bend, 50);
    const dotSize = normalizeRange(settings.dotSize, 22, 4, 90);
    const sizeVariation = normalizePercent(settings.sizeVariation, 0);
    const openness = normalizePercent(settings.openness, 64);
    const maxPoints = Math.round(normalizeRange(settings.maxPoints, 1200, 10, 10000));

    const countByType = {
      single: 1,
      branch: 1,
      wild: Math.round(lerp(2, 5, complexity)),
      bouquet: Math.round(lerp(3, 7, complexity))
    };
    const stemCount = countByType[type] || 1;
    const centerX = width * randomBetween(rng, 0.44, 0.56);
    const baseY = height * randomBetween(rng, 0.76, 0.9);
    const plantHeight = Math.min(width, height) * lerp(0.42, 0.76, scale);

    for (let index = 0; index < stemCount; index += 1) {
      const spread = Math.min(width, height) * lerp(0.03, 0.18, openness) * (stemCount > 1 ? (index - (stemCount - 1) / 2) : 0);
      const stemStart = point(centerX + spread * 0.4 + randomBetween(rng, -18, 18), baseY + randomBetween(rng, -16, 18));
      const stemEnd = point(
        centerX + spread + randomBetween(rng, -width * 0.08, width * 0.08),
        baseY - plantHeight * randomBetween(rng, 0.76, 1.08)
      );
      const stem = this.createStem(stemStart, stemEnd, { rng, bend, jitter, abstraction, width, height });
      const stemMarks = factory.createDotSeries(stem, {
        brush: "dotted",
        size: varyDotSize(dotSize, rng, sizeVariation),
        sizeVariation,
        density: 1,
        seed: Math.floor(rng() * 4294967295),
        role: "stem"
      });
      strokes.push(...stemMarks);

      const leafTarget = type === "single" ? 4 : type === "branch" ? 9 : Math.round(lerp(4, 13, complexity));
      this.addLeaves(strokes, factory, stem, {
        rng,
        count: leafTarget,
        dotSize,
        density,
        jitter,
        abstraction,
        recognition,
        mass,
        sizeVariation,
        width,
        height
      });

      if (type === "branch") {
        this.addBranchBuds(strokes, factory, stem, { rng, dotSize, sizeVariation, density, jitter, abstraction, mass });
      } else {
        const flowerCount = type === "wild" ? Math.round(lerp(2, 7, complexity)) : type === "bouquet" ? 1 + Math.round(rng() * 2) : 1;
        for (let flowerIndex = 0; flowerIndex < flowerCount; flowerIndex += 1) {
          const anchor = flowerIndex === 0 ? stem[stem.length - 1] : stem[Math.floor(randomBetween(rng, stem.length * 0.45, stem.length * 0.95))];
          const flowerCenter = point(anchor.x + randomBetween(rng, -28, 28), anchor.y + randomBetween(rng, -24, 22));
          this.addFlower(strokes, factory, flowerCenter, {
            rng,
            radius: Math.min(width, height) * randomBetween(rng, 0.035, 0.088) * lerp(0.75, 1.22, scale),
            dotSize,
            density,
            jitter,
            abstraction,
            recognition,
            mass,
            sizeVariation,
            type
          });
        }
      }
    }

    this.addLooseMarks(strokes, factory, { rng, width, height, centerX, baseY, plantHeight, density, abstraction, dotSize, sizeVariation, jitter });
    return strokes.filter(Boolean).slice(0, maxPoints);
  }

  createStem(start, end, options) {
    const curveSide = randomSign(options.rng);
    const bendAmount = Math.min(options.width, options.height) * lerp(0.035, 0.2, options.bend) * curveSide;
    const p1 = point(
      lerp(start.x, end.x, 0.25) + bendAmount * randomBetween(options.rng, 0.2, 0.8),
      lerp(start.y, end.y, 0.25)
    );
    const p2 = point(
      lerp(start.x, end.x, 0.72) - bendAmount * randomBetween(options.rng, 0.35, 1.15),
      lerp(start.y, end.y, 0.72)
    );
    const samples = sampleCubicBezier(start, p1, p2, end, 18);
    return samples
      .filter(() => options.rng() > options.abstraction * 0.18)
      .map((sample) => jitterPoint(sample, options.rng, lerp(1, 10, options.jitter)));
  }

  addLeaves(strokes, factory, stem, options) {
    const usable = stem.slice(3, -2);
    if (!usable.length) return;
    const count = Math.round(options.count * lerp(1.15, 0.45, options.abstraction));
    for (let index = 0; index < count; index += 1) {
      const anchor = usable[Math.floor((index / Math.max(1, count - 1)) * (usable.length - 1))];
      if (!anchor || options.rng() < options.abstraction * 0.2) continue;
      const side = index % 2 === 0 ? -1 : 1;
      const length = randomBetween(options.rng, 28, 86) * lerp(0.75, 1.3, options.recognition);
      const width = length * randomBetween(options.rng, 0.22, 0.42);
      const tilt = randomBetween(options.rng, -0.9, 0.9);
      const tip = point(anchor.x + side * length * Math.cos(tilt), anchor.y - length * 0.42 + length * Math.sin(tilt) * 0.28);
      const upper = point(lerp(anchor.x, tip.x, 0.55), lerp(anchor.y, tip.y, 0.55) - width);
      const lower = point(lerp(anchor.x, tip.x, 0.55), lerp(anchor.y, tip.y, 0.55) + width * randomBetween(options.rng, 0.42, 0.9));
      const leaf = [
        ...sampleCubicBezier(anchor, upper, upper, tip, 6),
        ...sampleCubicBezier(tip, lower, lower, anchor, 6).slice(1)
      ].map((sample) => jitterPoint(sample, options.rng, lerp(1, 9, options.jitter)));

      const marks = factory.createDotSeries(leaf, {
        brush: "dotted",
        size: varyDotSize(options.dotSize, options.rng, options.sizeVariation),
        sizeVariation: options.sizeVariation,
        density: 1,
        seed: Math.floor(options.rng() * 4294967295),
        role: "leaf"
      });
      strokes.push(...marks);

      if (options.recognition > 0.5 && options.rng() > options.abstraction) {
        const vein = factory.createDotSeries([anchor, jitterPoint(tip, options.rng, 3)], {
          brush: "dotted",
          size: varyDotSize(options.dotSize, options.rng, options.sizeVariation),
          sizeVariation: options.sizeVariation,
          density: 1,
          seed: Math.floor(options.rng() * 4294967295),
          role: "leaf-vein"
        });
        strokes.push(...vein);
      }
    }
  }

  addFlower(strokes, factory, center, options) {
    const petalCount = Math.round(randomBetween(options.rng, 5, options.type === "wild" ? 11 : 9) * lerp(1, 0.58, options.abstraction));
    const radius = options.radius;
    for (let index = 0; index < petalCount; index += 1) {
      if (options.rng() < options.abstraction * 0.24) continue;
      const angle = (index / petalCount) * Math.PI * 2 + randomBetween(options.rng, -0.22, 0.22);
      const length = radius * randomBetween(options.rng, 0.9, 1.78);
      const width = radius * randomBetween(options.rng, 0.28, 0.62);
      const tip = point(center.x + Math.cos(angle) * length, center.y + Math.sin(angle) * length);
      const tangent = angle + Math.PI / 2;
      const left = point(center.x + Math.cos(angle) * radius * 0.35 + Math.cos(tangent) * width, center.y + Math.sin(angle) * radius * 0.35 + Math.sin(tangent) * width);
      const right = point(center.x + Math.cos(angle) * radius * 0.35 - Math.cos(tangent) * width, center.y + Math.sin(angle) * radius * 0.35 - Math.sin(tangent) * width);
      const petal = [
        ...sampleCubicBezier(center, left, left, tip, 5),
        ...sampleCubicBezier(tip, right, right, center, 5).slice(1)
      ].map((sample) => jitterPoint(sample, options.rng, lerp(1.5, 12, options.jitter)));
      const marks = factory.createDotSeries(petal, {
        brush: "dotted",
        size: varyDotSize(options.dotSize, options.rng, options.sizeVariation),
        sizeVariation: options.sizeVariation,
        density: 1,
        seed: Math.floor(options.rng() * 4294967295),
        role: "petal"
      });
      strokes.push(...marks);
    }

    const centerDots = Math.round(lerp(5, 34, options.density) * lerp(0.55, 1.4, options.mass));
    for (let index = 0; index < centerDots; index += 1) {
      const mark = jitterPoint(center, options.rng, radius * randomBetween(options.rng, 0.12, 0.48));
      const dot = factory.createDot(mark.x, mark.y, {
        brush: "dotted",
        size: varyDotSize(options.dotSize, options.rng, options.sizeVariation),
        sizeVariation: options.sizeVariation,
        density: 1,
        seed: Math.floor(options.rng() * 4294967295),
        role: "flower-center"
      });
      if (dot) strokes.push(dot);
    }
  }

  addBranchBuds(strokes, factory, stem, options) {
    const count = Math.round(lerp(5, 18, options.density) * lerp(1, 0.55, options.abstraction));
    for (let index = 0; index < count; index += 1) {
      const anchor = stem[Math.floor(randomBetween(options.rng, stem.length * 0.28, stem.length - 1))];
      if (!anchor) continue;
      const dot = factory.createDot(anchor.x + randomBetween(options.rng, -40, 40), anchor.y + randomBetween(options.rng, -34, 30), {
        brush: "dotted",
        size: varyDotSize(options.dotSize, options.rng, options.sizeVariation),
        sizeVariation: options.sizeVariation,
        density: 1,
        seed: Math.floor(options.rng() * 4294967295),
        role: "bud"
      });
      if (dot) strokes.push(dot);
    }
  }

  addLooseMarks(strokes, factory, options) {
    const count = Math.round(lerp(4, 45, options.abstraction) * lerp(0.55, 1.25, options.density));
    for (let index = 0; index < count; index += 1) {
      const x = clamp(options.centerX + randomBetween(options.rng, -options.width * 0.22, options.width * 0.22), options.width * 0.08, options.width * 0.92);
      const y = clamp(options.baseY - options.plantHeight * randomBetween(options.rng, 0.15, 1.05), options.height * 0.08, options.height * 0.92);
      const dot = factory.createDot(x + randomBetween(options.rng, -24, 24), y + randomBetween(options.rng, -24, 24), {
        brush: "dotted",
        size: varyDotSize(options.dotSize, options.rng, options.sizeVariation),
        sizeVariation: options.sizeVariation,
        density: 1,
        seed: Math.floor(options.rng() * 4294967295),
        role: "loose"
      });
      if (dot) strokes.push(dot);
    }
  }
}

function varyDotSize(size, rng, variation) {
  return size * (variation > 0 ? Math.max(0.08, lerp(1 - variation, 1 + variation, rng())) : 1);
}
