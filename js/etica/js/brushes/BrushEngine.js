import { clamp, createRng, lerp } from "./random.js";
import { DENSITY_PROFILE_DEFAULT, getDensityProfileMultiplier } from "./DensityProfiles.js";
import { getStampSet } from "./stamps.js";

export function renderStroke(ctx, stroke, options = {}) {
  if (!stroke.points.length) return;

  const rng = createRng(stroke.seed);
  const kind = stroke.tool === "eraser" ? "eraser" : stroke.brush;
  const color = stroke.tool === "eraser" ? "#000000" : normalizeColor(stroke.settings?.color, options.fallbackColor);
  const stamps = getStampSet(kind, color);
  const points = stroke.points;
  const density = getStrokeDensity(stroke);
  const renderAlpha = options.alpha ?? 1;
  const pathMetrics = getPathMetrics(points);

  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  drawPoint(ctx, stamps, points[0], stroke, getProfiledDensity(stroke, density, 0), rng, kind, renderAlpha);

  for (let index = 1; index < points.length; index += 1) {
    drawSegment(
      ctx,
      stamps,
      points[index - 1],
      points[index],
      stroke,
      density,
      rng,
      kind,
      renderAlpha,
      pathMetrics.cumulative[index - 1],
      pathMetrics.total
    );
  }

  ctx.restore();
}

function normalizeColor(color, fallback = "#000000") {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color.toLowerCase() : fallback;
}

function drawSegment(ctx, stamps, from, to, stroke, baseDensity, rng, kind, renderAlpha, segmentStartLength, totalLength) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 0.01) {
    const pathT = totalLength > 0 ? segmentStartLength / totalLength : 0;
    drawPoint(ctx, stamps, to, stroke, getProfiledDensity(stroke, baseDensity, pathT), rng, kind, renderAlpha);
    return;
  }

  const size = getStrokeSize(stroke);
  const baseSpacing = kind === "dotted" ? size * 0.72 : size * 0.28;
  let traveled = 0;

  while (traveled <= distance) {
    const t = traveled / distance;
    const pathT = totalLength > 0 ? (segmentStartLength + traveled) / totalLength : t;
    const densityMultiplier = getProfiledDensity(stroke, baseDensity, pathT);
    const spacing = clamp(baseSpacing / densityMultiplier, 1.25, Math.max(2, baseSpacing * 2.4));
    const pressure = lerp(from.pressure, to.pressure, t);
    const point = {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      pressure,
      pointerType: to.pointerType,
      time: lerp(from.time, to.time, t)
    };
    drawPoint(ctx, stamps, point, stroke, densityMultiplier, rng, kind, renderAlpha);
    traveled += spacing * lerp(0.62, 1.32, rng());
  }
}

function drawPoint(ctx, stamps, point, stroke, densityMultiplier, rng, kind, renderAlpha) {
  const size = getStrokeSize(stroke);
  const sizeVariation = getStrokeSizeVariation(stroke);
  const pressureScale = stroke.settings.pressureEnabled ? lerp(0.72, 1.38, point.pressure) : 1;
  const clusterCount = kind === "ink" ? 3 : kind === "eraser" ? 2 : 1;
  const jitterBase = kind === "dotted" ? size * 0.62 : size * 0.32;
  const densityBonus = Math.max(0, densityMultiplier - 1);
  const extraDots = kind === "dotted" ? Math.floor(densityBonus * 1.35 + rng() * densityBonus) : 0;
  const total = clusterCount + extraDots;

  for (let i = 0; i < total; i += 1) {
    const stamp = stamps[Math.floor(rng() * stamps.length)];
    const angle = rng() * Math.PI * 2;
    const spread = jitterBase * (kind === "eraser" ? 0.5 : 1) * rng();
    const radiusJitter = sizeVariation > 0
      ? Math.max(0.08, lerp(1 - sizeVariation, 1 + sizeVariation, rng()))
      : 1;
    const drawSize = size * pressureScale * radiusJitter * (kind === "eraser" ? 1.1 : 1);
    const x = point.x + Math.cos(angle) * spread;
    const y = point.y + Math.sin(angle) * spread;
    const alpha = (kind === "dotted" ? lerp(0.86, 1, rng()) : 1) * renderAlpha;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI * 2);
    ctx.drawImage(stamp, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
  }
}

export function getStrokeSize(stroke) {
  return Math.max(1, Number(stroke.settings?.size ?? 18) * Number(stroke.sizeScale ?? 1));
}

export function getStrokeSizeVariation(stroke) {
  return clamp(Number(stroke.settings?.sizeVariation ?? 0), 0, 1);
}

export function getStrokeDensity(stroke) {
  return Math.max(0.2, Number(stroke.settings?.density ?? 1) * Number(stroke.densityScale ?? 1));
}

export function getStrokeDensityProfile(stroke) {
  return stroke.settings?.densityProfile || DENSITY_PROFILE_DEFAULT;
}

function getProfiledDensity(stroke, baseDensity, t) {
  return Math.max(0.08, baseDensity * getDensityProfileMultiplier(getStrokeDensityProfile(stroke), t));
}

function getPathMetrics(points) {
  const cumulative = [0];
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    cumulative[index] = total;
  }

  return { cumulative, total };
}
