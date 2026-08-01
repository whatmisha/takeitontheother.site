import { StrokeFactory } from "./StrokeFactory.js";
import {
  clamp,
  createRng,
  fitRect,
  lerp,
  makeGroupId,
  normalizePercent,
  normalizeRange,
  randomBetween
} from "./GeneratorUtils.js";

export class NuevoGenerator {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  generate({ image, width, height, color, settings }) {
    if (!image) return [];

    const seed = normalizeRange(settings.seed, 3101, 1, 999999);
    const rng = createRng(seed);
    const groupId = makeGroupId("nuevo", seed);
    const factory = new StrokeFactory({
      source: "nuevo",
      groupId,
      color,
      seed,
      scatter: normalizePercent(settings.scatter, 100),
      roughness: normalizePercent(settings.roughness, 100)
    });
    const lineStrength = normalizePercent(settings.lineStrength, 50);
    const massOutline = normalizePercent(settings.massOutline, 50);
    const interiorDetail = normalizePercent(settings.interiorDetail, 50);
    const fill = normalizePercent(settings.fill, 50);
    const simplify = normalizePercent(settings.simplify, 50);
    const spacing = normalizeRange(settings.spacing, 15, 4, 80);
    const dotSize = normalizeRange(settings.dotSize, 75, 3, 120);
    const sizeVariation = normalizePercent(settings.sizeVariation, 0);
    const jitter = normalizePercent(settings.jitter, 10);
    const maxPoints = Math.round(normalizeRange(settings.maxPoints, 320, 10, 25000));
    const fit = settings.fit || "fill";
    const analysis = this.createAnalysis(image, width, height, fit, simplify, interiorDetail);
    const fields = this.getFields(analysis.imageData);
    const smoothRadius = Math.round(lerp(1, 4, simplify) * lerp(1.15, 0.55, interiorDetail));
    const luma = smoothRadius > 0 ? boxBlur(fields.luma, analysis.width, analysis.height, smoothRadius) : fields.luma;
    const localRadius = Math.round(lerp(24, 42, simplify) * lerp(1.05, 0.72, interiorDetail));
    const localMean = boxBlur(luma, analysis.width, analysis.height, localRadius);
    const localDeviation = makeLocalDeviation(luma, localMean, analysis.width, analysis.height, localRadius);
    const adaptiveLuma = makeAdaptiveLuma(luma, localMean, localDeviation, lineStrength, interiorDetail);
    const darkness = makeDarkness(luma, localMean, localDeviation);
    const edges = sobelHybrid(adaptiveLuma, fields.rg, fields.by, analysis.width, analysis.height);
    const mask = makeMask(darkness, normalizeMassThreshold(massOutline, lineStrength));
    const candidates = collectLineCandidates({
      width: analysis.width,
      height: analysis.height,
      canvasWidth: width,
      canvasHeight: height,
      darkness,
      edges,
      mask,
      lineStrength,
      massOutline,
      interiorDetail,
      simplify
    });
    const fillCandidates = collectFillCandidates({
      width: analysis.width,
      height: analysis.height,
      canvasWidth: width,
      canvasHeight: height,
      darkness,
      edges,
      mask,
      fill,
      simplify
    });
    const spacingPx = spacing * lerp(0.78, 1.72, simplify) * lerp(1.16, 0.82, lineStrength);
    const fillBudget = Math.round(maxPoints * fill * lerp(0.04, 0.16, massOutline));
    const lineBudget = Math.max(0, maxPoints - fillBudget);
    const lineMarks = selectLineComponents({
      candidates,
      budget: lineBudget,
      rng,
      minDistance: spacingPx,
      sourceWidth: analysis.width,
      sourceHeight: analysis.height,
      canvasWidth: width,
      canvasHeight: height
    });
    if (lineMarks.length < Math.min(lineBudget, Math.round(maxPoints * 0.34))) {
      lineMarks.push(...selectCandidates(candidates, lineBudget - lineMarks.length, rng, spacingPx, lineMarks));
    }
    const fillMarks = selectCandidates(fillCandidates, maxPoints - lineMarks.length, rng, spacingPx * lerp(1.1, 1.75, 1 - fill), lineMarks);
    const marks = [...lineMarks, ...fillMarks].slice(0, maxPoints);
    const jitterAmount = dotSize * lerp(0, 0.85, jitter);

    return marks
      .map((mark, index) => {
        const lineLike = mark.role !== "mass-fill";
        const markJitter = jitterAmount * (lineLike ? 0.36 : 0.72);
        const markSize = dotSize * (mark.role === "mass-outline" ? 1.06 : mark.role === "mass-fill" ? 0.82 : 0.94);
        return factory.createDot(
          clamp(mark.x + randomBetween(rng, -markJitter, markJitter), 0, width),
          clamp(mark.y + randomBetween(rng, -markJitter, markJitter), 0, height),
          {
            brush: "dotted",
            size: varyDotSize(markSize, rng, sizeVariation),
            sizeVariation,
            density: 1,
            seed: (seed + index * 2654435761) >>> 0,
            role: mark.role
          }
        );
      })
      .filter(Boolean);
  }

  createAnalysis(image, targetWidth, targetHeight, fitMode, simplify, detail) {
    const maxSide = Math.round(lerp(780, 520, simplify) * lerp(0.86, 1.2, detail));
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

  getFields(imageData) {
    const data = imageData.data;
    const luma = new Float32Array(imageData.width * imageData.height);
    const rg = new Float32Array(luma.length);
    const by = new Float32Array(luma.length);

    for (let index = 0; index < luma.length; index += 1) {
      const offset = index * 4;
      const alpha = data[offset + 3] / 255;
      const red = lerp(255, data[offset], alpha) / 255;
      const green = lerp(255, data[offset + 1], alpha) / 255;
      const blue = lerp(255, data[offset + 2], alpha) / 255;
      luma[index] = clamp((red * 0.299) + (green * 0.587) + (blue * 0.114), 0, 1);
      rg[index] = red - green;
      by[index] = ((red + green) * 0.5) - blue;
    }

    return { luma, rg, by };
  }
}

function makeLocalDeviation(luma, localMean, width, height, radius) {
  const squared = new Float32Array(luma.length);
  for (let index = 0; index < luma.length; index += 1) {
    squared[index] = luma[index] * luma[index];
  }

  const meanSquared = boxBlur(squared, width, height, radius);
  const deviation = new Float32Array(luma.length);
  for (let index = 0; index < luma.length; index += 1) {
    deviation[index] = Math.sqrt(Math.max(0, meanSquared[index] - localMean[index] * localMean[index]));
  }
  return deviation;
}

function makeAdaptiveLuma(luma, localMean, localDeviation, lineStrength, detail) {
  const adaptive = new Float32Array(luma.length);
  const blend = lerp(0.46, 0.84, lineStrength) * lerp(0.82, 1.08, detail);
  const gain = lerp(0.18, 0.34, lineStrength) * lerp(0.86, 1.22, detail);

  for (let index = 0; index < luma.length; index += 1) {
    const normalized = clamp(0.5 + ((luma[index] - localMean[index]) / (localDeviation[index] + 0.08)) * gain, 0, 1);
    adaptive[index] = clamp(lerp(luma[index], normalized, blend), 0, 1);
  }

  return adaptive;
}

function makeDarkness(luma, localMean, localDeviation) {
  const darkness = new Float32Array(luma.length);
  for (let index = 0; index < luma.length; index += 1) {
    const globalDark = clamp((0.62 - luma[index]) * 1.55, 0, 1);
    const localDark = clamp(((localMean[index] - luma[index]) / (localDeviation[index] + 0.08)) * 0.72 + 0.05, 0, 1);
    darkness[index] = clamp((globalDark * 0.24) + (localDark * 0.92), 0, 1);
  }
  return darkness;
}

function normalizeMassThreshold(massOutline, lineStrength) {
  return lerp(0.68, 0.3, massOutline) * lerp(1.12, 0.88, lineStrength);
}

function makeMask(darkness, threshold) {
  const mask = new Uint8Array(darkness.length);
  for (let index = 0; index < darkness.length; index += 1) {
    mask[index] = darkness[index] >= threshold ? 1 : 0;
  }
  return mask;
}

function collectLineCandidates(options) {
  const candidates = [];
  const edgeThreshold = lerp(0.18, 0.046, options.lineStrength)
    * lerp(1.28, 0.72, options.interiorDetail)
    * lerp(0.88, 1.22, options.simplify);
  const scaleX = options.canvasWidth / options.width;
  const scaleY = options.canvasHeight / options.height;

  for (let y = 1; y < options.height - 1; y += 1) {
    for (let x = 1; x < options.width - 1; x += 1) {
      const index = y * options.width + x;
      const boundary = options.massOutline > 0.01 && isBoundary(options.mask, options.width, index);
      const edge = options.edges.magnitude[index];
      const edgeLine = edge > edgeThreshold && isLocalMaximum(options.edges, options.width, x, y);

      if (!boundary && !edgeLine) continue;

      const boundaryScore = boundary
        ? (0.58 + options.darkness[index] * 0.52 + edge * 0.25) * lerp(0.2, 1.1, options.massOutline)
        : 0;
      const edgeScore = edgeLine
        ? edge * lerp(0.54, 1.32, options.interiorDetail) * lerp(0.65, 1.18, options.lineStrength)
        : 0;
      const score = Math.max(boundaryScore, edgeScore);
      if (score <= 0) continue;

      candidates.push({
        x: (x + 0.5) * scaleX,
        y: (y + 0.5) * scaleY,
        sourceX: x,
        sourceY: y,
        score,
        role: boundaryScore >= edgeScore ? "mass-outline" : "edge-line"
      });
    }
  }

  return candidates;
}

function collectFillCandidates(options) {
  if (options.fill <= 0.01) return [];
  const candidates = [];
  const scaleX = options.canvasWidth / options.width;
  const scaleY = options.canvasHeight / options.height;
  const stride = Math.round(lerp(12, 5, options.fill) * lerp(0.92, 1.7, options.simplify));

  for (let y = 1; y < options.height - 1; y += stride) {
    for (let x = 1; x < options.width - 1; x += stride) {
      const index = y * options.width + x;
      if (!options.mask[index] || isBoundary(options.mask, options.width, index)) continue;
      const dark = options.darkness[index];
      if (dark < lerp(0.84, 0.48, options.fill)) continue;
      candidates.push({
        x: (x + 0.5) * scaleX,
        y: (y + 0.5) * scaleY,
        sourceX: x,
        sourceY: y,
        score: (dark * 0.78 + options.edges.magnitude[index] * 0.18) * options.fill,
        role: "mass-fill"
      });
    }
  }

  return candidates;
}

function selectLineComponents(options) {
  const { candidates, budget, rng, minDistance, sourceWidth, sourceHeight, canvasWidth, canvasHeight } = options;
  if (budget <= 0 || !candidates.length) return [];

  const scores = new Float32Array(sourceWidth * sourceHeight);
  const roles = new Uint8Array(scores.length);

  for (const candidate of candidates) {
    const x = candidate.sourceX;
    const y = candidate.sourceY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const index = y * sourceWidth + x;
    if (candidate.score <= scores[index]) continue;
    scores[index] = candidate.score;
    roles[index] = candidate.role === "mass-outline" ? 2 : 1;
  }

  const components = collectComponents(scores, roles, sourceWidth, sourceHeight, canvasWidth, canvasHeight);
  if (!components.length) return [];

  const totalSize = components.reduce((sum, component) => sum + component.points.length, 0);
  const grid = new Map();
  const selected = [];
  const cellSize = Math.max(1, minDistance);
  const minDistanceSq = minDistance * minDistance;

  components
    .map((component) => ({
      ...component,
      rank: component.averageScore * lerp(0.88, 1.28, clamp(Math.sqrt(component.points.length) / 36, 0, 1)) + rng() * 0.08
    }))
    .sort((a, b) => b.rank - a.rank)
    .forEach((component) => {
      if (selected.length >= budget) return;
      const share = component.points.length / Math.max(1, totalSize);
      const maxForComponent = Math.max(1, Math.ceil(budget * share * lerp(0.8, 1.65, component.averageScore)));
      const points = sampleComponent(component, rng, minDistance, maxForComponent);

      for (const mark of points) {
        if (selected.length >= budget) break;
        if (isTooClose(grid, mark, cellSize, minDistanceSq)) continue;
        selected.push(mark);
        addToGrid(grid, mark, cellSize);
      }
    });

  return selected;
}

function collectComponents(scores, roles, width, height, canvasWidth, canvasHeight) {
  const visited = new Uint8Array(scores.length);
  const components = [];
  const scaleX = canvasWidth / width;
  const scaleY = canvasHeight / height;

  for (let index = 0; index < scores.length; index += 1) {
    if (!scores[index] || visited[index]) continue;
    const stack = [index];
    const points = [];
    let totalScore = 0;
    visited[index] = 1;

    while (stack.length) {
      const current = stack.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      const score = scores[current];
      totalScore += score;
      points.push({
        sourceX: x,
        sourceY: y,
        x: (x + 0.5) * scaleX,
        y: (y + 0.5) * scaleY,
        score,
        role: roles[current] === 2 ? "mass-outline" : "edge-line"
      });

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (!scores[next] || visited[next]) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
    }

    if (points.length < 3 && totalScore / Math.max(1, points.length) < 0.42) continue;
    components.push({
      points,
      averageScore: totalScore / Math.max(1, points.length)
    });
  }

  return components;
}

function sampleComponent(component, rng, minDistance, maxCount) {
  const ordered = orderComponentPoints(component.points);
  if (!ordered.length) return [];
  if (ordered.length <= 3) return [highestScorePoint(ordered)];

  const selected = [];
  let previous = ordered[0];
  let traveled = rng() * minDistance;
  let nextSpacing = minDistance * lerp(0.72, 1.22, rng());

  for (const point of ordered) {
    if (selected.length >= maxCount) break;
    traveled += Math.hypot(point.x - previous.x, point.y - previous.y);
    if (traveled >= nextSpacing || point.score > 0.74 && rng() > 0.72) {
      selected.push(point);
      traveled = 0;
      nextSpacing = minDistance * lerp(0.74, 1.28, rng());
    }
    previous = point;
  }

  if (!selected.length) selected.push(highestScorePoint(ordered));
  return selected;
}

function orderComponentPoints(points) {
  const center = points.reduce((sum, point) => {
    sum.x += point.sourceX;
    sum.y += point.sourceY;
    return sum;
  }, { x: 0, y: 0 });
  center.x /= points.length;
  center.y /= points.length;

  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of points) {
    const dx = point.sourceX - center.x;
    const dy = point.sourceY - center.y;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }

  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const axisX = Math.cos(angle);
  const axisY = Math.sin(angle);

  return [...points].sort((a, b) => {
    const aProjection = (a.sourceX - center.x) * axisX + (a.sourceY - center.y) * axisY;
    const bProjection = (b.sourceX - center.x) * axisX + (b.sourceY - center.y) * axisY;
    return aProjection - bProjection;
  });
}

function highestScorePoint(points) {
  return points.reduce((best, point) => point.score > best.score ? point : best, points[0]);
}

function isBoundary(mask, width, index) {
  if (!mask[index]) return Boolean(mask[index - 1] || mask[index + 1] || mask[index - width] || mask[index + width]);
  return !mask[index - 1] || !mask[index + 1] || !mask[index - width] || !mask[index + width];
}

function isLocalMaximum(edges, width, x, y) {
  const index = y * width + x;
  const gx = edges.gx[index];
  const gy = edges.gy[index];
  const mag = edges.magnitude[index];
  const ax = Math.abs(gx);
  const ay = Math.abs(gy);

  if (ax > ay * 1.65) return mag >= edges.magnitude[index - 1] && mag >= edges.magnitude[index + 1];
  if (ay > ax * 1.65) return mag >= edges.magnitude[index - width] && mag >= edges.magnitude[index + width];

  const direction = gx * gy >= 0 ? 1 : -1;
  return mag >= edges.magnitude[index - width - direction] && mag >= edges.magnitude[index + width + direction];
}

function selectCandidates(candidates, budget, rng, minDistance, existing = []) {
  if (budget <= 0 || !candidates.length) return [];
  const selected = [];
  const cellSize = Math.max(1, minDistance);
  const minDistanceSq = minDistance * minDistance;
  const grid = new Map();

  for (const mark of existing) addToGrid(grid, mark, cellSize);

  const ranked = candidates
    .map((candidate) => ({ ...candidate, rank: candidate.score + rng() * 0.12 }))
    .sort((a, b) => b.rank - a.rank);

  for (const candidate of ranked) {
    if (selected.length >= budget) break;
    if (isTooClose(grid, candidate, cellSize, minDistanceSq)) continue;
    selected.push(candidate);
    addToGrid(grid, candidate, cellSize);
  }

  return selected;
}

function addToGrid(grid, mark, cellSize) {
  const cx = Math.floor(mark.x / cellSize);
  const cy = Math.floor(mark.y / cellSize);
  const key = `${cx},${cy}`;
  const cell = grid.get(key);
  if (cell) {
    cell.push(mark);
  } else {
    grid.set(key, [mark]);
  }
}

function isTooClose(grid, mark, cellSize, minDistanceSq) {
  const cx = Math.floor(mark.x / cellSize);
  const cy = Math.floor(mark.y / cellSize);
  for (let y = cy - 1; y <= cy + 1; y += 1) {
    for (let x = cx - 1; x <= cx + 1; x += 1) {
      const cell = grid.get(`${x},${y}`);
      if (!cell) continue;
      for (const other of cell) {
        const dx = mark.x - other.x;
        const dy = mark.y - other.y;
        if ((dx * dx + dy * dy) < minDistanceSq) return true;
      }
    }
  }
  return false;
}

function sobelHybrid(luma, rg, by, width, height) {
  const magnitude = new Float32Array(luma.length);
  const gx = new Float32Array(luma.length);
  const gy = new Float32Array(luma.length);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const l = sobelAt(luma, width, x, y);
      const r = sobelAt(rg, width, x, y);
      const b = sobelAt(by, width, x, y);
      const xValue = l.x + r.x * 0.32 + b.x * 0.24;
      const yValue = l.y + r.y * 0.32 + b.y * 0.24;
      const lumaMag = Math.hypot(l.x, l.y) * 0.22;
      const colorMag = (Math.hypot(r.x, r.y) + Math.hypot(b.x, b.y)) * 0.095;
      gx[index] = xValue;
      gy[index] = yValue;
      magnitude[index] = clamp(lumaMag + colorMag, 0, 1);
    }
  }

  return { magnitude, gx, gy };
}

function sobelAt(channel, width, x, y) {
  const index = y * width + x;
  const tl = channel[index - width - 1];
  const tc = channel[index - width];
  const tr = channel[index - width + 1];
  const ml = channel[index - 1];
  const mr = channel[index + 1];
  const bl = channel[index + width - 1];
  const bc = channel[index + width];
  const br = channel[index + width + 1];
  return {
    x: -tl - (2 * ml) - bl + tr + (2 * mr) + br,
    y: -tl - (2 * tc) - tr + bl + (2 * bc) + br
  };
}

function boxBlur(input, width, height, radius) {
  if (radius <= 0) return input;
  const windowSize = radius * 2 + 1;
  const horizontal = new Float32Array(input.length);
  const output = new Float32Array(input.length);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let dx = -radius; dx <= radius; dx += 1) {
      sum += input[y * width + clamp(dx, 0, width - 1)];
    }

    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = sum / windowSize;
      const removeX = clamp(x - radius, 0, width - 1);
      const addX = clamp(x + radius + 1, 0, width - 1);
      sum += input[y * width + addX] - input[y * width + removeX];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      sum += horizontal[clamp(dy, 0, height - 1) * width + x];
    }

    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / windowSize;
      const removeY = clamp(y - radius, 0, height - 1);
      const addY = clamp(y + radius + 1, 0, height - 1);
      sum += horizontal[addY * width + x] - horizontal[removeY * width + x];
    }
  }

  return output;
}

function varyDotSize(size, rng, variation) {
  return size * (variation > 0 ? Math.max(0.08, lerp(1 - variation, 1 + variation, rng())) : 1);
}
