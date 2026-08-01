import { StrokeFactory } from "./StrokeFactory.js";
import {
  clamp,
  createRng,
  fitRect,
  lerp,
  makeGroupId,
  normalizePercent,
  normalizeRange,
  point,
  randomBetween,
  shuffleInPlace
} from "./GeneratorUtils.js";

export class PhotoGenerator {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  generate({ image, width, height, color, settings }) {
    if (!image) return [];

    const seed = normalizeRange(settings.seed, 2401, 1, 999999);
    const rng = createRng(seed);
    const groupId = makeGroupId("foto", seed);
    const factory = new StrokeFactory({
      source: "foto",
      groupId,
      color,
      seed,
      scatter: normalizePercent(settings.scatter, 100),
      roughness: normalizePercent(settings.roughness, 100)
    });
    const recognition = normalizePercent(settings.recognition, 70);
    const abstraction = normalizePercent(settings.abstraction, 34);
    const detail = normalizePercent(settings.detail, 52);
    const mass = normalizePercent(settings.mass, 56);
    const contour = normalizePercent(settings.contour, 48);
    const density = normalizePercent(settings.density, 56);
    const jitter = normalizePercent(settings.jitter, 44);
    const dotSize = normalizeRange(settings.dotSize, 14, 3, 90);
    const sizeVariation = normalizePercent(settings.sizeVariation, 0);
    const maxPoints = Math.round(normalizeRange(settings.maxPoints, 2500, 10, 20000));
    const fit = settings.fit || "fill";
    const analysis = this.createAnalysis(image, width, height, fit, detail);
    const luma = this.getLuma(analysis.imageData);
    const blurRadius = Math.round(lerp(0, 5, abstraction) * lerp(1, 0.35, detail));
    const softened = blurRadius > 0 ? boxBlur(luma, analysis.width, analysis.height, blurRadius) : luma;
    const edges = sobel(softened, analysis.width, analysis.height);
    const strokes = [];
    const targetMarks = Math.round(lerp(420, 4200, density) * lerp(0.65, 1.45, detail) * lerp(1.12, 0.72, abstraction));
    const step = Math.max(4, Math.sqrt((analysis.width * analysis.height) / targetMarks));
    const threshold = clamp(lerp(0.38, 0.16, recognition) + abstraction * 0.18 - detail * 0.08, 0.08, 0.62);
    const maxMarks = Math.min(maxPoints, Math.round(lerp(900, 5200, density) * lerp(0.75, 1.25, detail)));

    for (let y = step * 0.5; y < analysis.height; y += step) {
      for (let x = step * 0.5; x < analysis.width; x += step) {
        const sx = clamp(Math.round(x + randomBetween(rng, -step * 0.44, step * 0.44)), 1, analysis.width - 2);
        const sy = clamp(Math.round(y + randomBetween(rng, -step * 0.44, step * 0.44)), 1, analysis.height - 2);
        const index = sy * analysis.width + sx;
        const dark = 1 - softened[index];
        const edge = edges.magnitude[index];
        const massScore = Math.pow(dark, lerp(1.9, 0.7, mass)) * lerp(0.25, 1.85, mass);
        const contourScore = edge * lerp(0.2, 2.2, contour) * lerp(0.7, 1.35, recognition);
        const detailScore = edge * dark * lerp(0.12, 1.25, detail);
        const rawScore = massScore + contourScore + detailScore;
        const maxScore = lerp(0.4, 1.9, mass) + lerp(0.2, 2.2, contour) + lerp(0.12, 1.25, detail);
        const score = clamp(rawScore / maxScore, 0, 1);
        const dropout = abstraction * 0.26 + (1 - recognition) * 0.12;

        if (score < threshold || rng() > score * lerp(1.55, 0.82, dropout)) continue;

        const out = point(
          (sx / analysis.width) * width + randomBetween(rng, -step, step) * jitter * (width / analysis.width),
          (sy / analysis.height) * height + randomBetween(rng, -step, step) * jitter * (height / analysis.height),
          lerp(0.48, 0.92, score)
        );

        const edgeWins = contourScore > massScore * 0.72 && rng() < contour * lerp(0.35, 0.88, recognition);
        if (edgeWins) {
          const tangent = Math.atan2(edges.gy[index], edges.gx[index]) + Math.PI / 2;
          const length = dotSize * randomBetween(rng, 1.4, 4.8) * lerp(0.72, 1.35, recognition);
          const wobble = dotSize * randomBetween(rng, 0.12, 0.65) * jitter;
          const p0 = point(out.x - Math.cos(tangent) * length * 0.5, out.y - Math.sin(tangent) * length * 0.5, out.pressure);
          const p1 = point(out.x + Math.cos(tangent + randomBetween(rng, -0.4, 0.4)) * wobble, out.y + Math.sin(tangent + randomBetween(rng, -0.4, 0.4)) * wobble, out.pressure);
          const p2 = point(out.x + Math.cos(tangent) * length * 0.5, out.y + Math.sin(tangent) * length * 0.5, out.pressure);
          const marks = factory.createDotSeries([p0, p1, p2], {
            brush: "dotted",
            size: varyDotSize(dotSize, rng, sizeVariation),
            sizeVariation,
            density: 1,
            seed: Math.floor(rng() * 4294967295),
            role: "contour"
          });
          strokes.push(...marks);
        } else {
          const isMass = dark > lerp(0.44, 0.2, mass) && rng() < mass * 0.42;
          const stroke = factory.createDot(out.x, out.y, {
            brush: "dotted",
            size: varyDotSize(dotSize, rng, sizeVariation),
            sizeVariation,
            density: 1,
            seed: Math.floor(rng() * 4294967295),
            role: isMass ? "mass" : "dot"
          });
          if (stroke) strokes.push(stroke);
        }
      }
    }

    shuffleInPlace(strokes, rng);
    return strokes.slice(0, maxMarks);
  }

  createAnalysis(image, targetWidth, targetHeight, fitMode, detail) {
    const maxSide = Math.round(lerp(420, 720, detail));
    const ratio = targetWidth / targetHeight;
    const width = ratio >= 1 ? maxSide : Math.round(maxSide * ratio);
    const height = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide;
    this.canvas.width = Math.max(96, width);
    this.canvas.height = Math.max(96, height);
    this.ctx.save();
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const placement = fitRect(sourceWidth, sourceHeight, this.canvas.width, this.canvas.height, fitMode);
    this.ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);
    this.ctx.restore();
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      imageData: this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    };
  }

  getLuma(imageData) {
    const data = imageData.data;
    const luma = new Float32Array(imageData.width * imageData.height);
    for (let index = 0; index < luma.length; index += 1) {
      const offset = index * 4;
      const alpha = data[offset + 3] / 255;
      const red = lerp(255, data[offset], alpha);
      const green = lerp(255, data[offset + 1], alpha);
      const blue = lerp(255, data[offset + 2], alpha);
      luma[index] = clamp(((red * 0.299) + (green * 0.587) + (blue * 0.114)) / 255, 0, 1);
    }
    return luma;
  }
}

function varyDotSize(size, rng, variation) {
  return size * (variation > 0 ? Math.max(0.08, lerp(1 - variation, 1 + variation, rng())) : 1);
}

function boxBlur(input, width, height, radius) {
  let source = input;
  let target = new Float32Array(input.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const xx = clamp(x + dx, 0, width - 1);
        sum += source[y * width + xx];
        count += 1;
      }
      target[y * width + x] = sum / count;
    }
  }

  source = target;
  target = new Float32Array(input.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = clamp(y + dy, 0, height - 1);
        sum += source[yy * width + x];
        count += 1;
      }
      target[y * width + x] = sum / count;
    }
  }
  return target;
}

function sobel(luma, width, height) {
  const magnitude = new Float32Array(luma.length);
  const gx = new Float32Array(luma.length);
  const gy = new Float32Array(luma.length);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const tl = luma[(y - 1) * width + (x - 1)];
      const tc = luma[(y - 1) * width + x];
      const tr = luma[(y - 1) * width + (x + 1)];
      const ml = luma[y * width + (x - 1)];
      const mr = luma[y * width + (x + 1)];
      const bl = luma[(y + 1) * width + (x - 1)];
      const bc = luma[(y + 1) * width + x];
      const br = luma[(y + 1) * width + (x + 1)];
      const xValue = -tl - (2 * ml) - bl + tr + (2 * mr) + br;
      const yValue = -tl - (2 * tc) - tr + bl + (2 * bc) + br;
      gx[index] = xValue;
      gy[index] = yValue;
      magnitude[index] = clamp(Math.hypot(xValue, yValue) * 0.72, 0, 1);
    }
  }

  return { magnitude, gx, gy };
}
