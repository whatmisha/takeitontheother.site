import { clamp, createRng, lerp } from "./random.js";
import { DENSITY_PROFILE_DEFAULT, getDensityProfileMultiplier } from "./DensityProfiles.js";
import { getStampSet } from "./stamps.js?v=roughness-1";
import { LINE_DENSITY_MIN } from "../utils/LineSettings.js?v=roughness-1";

export function renderStroke(ctx, stroke, options = {}) {
  if (!stroke.points.length) return;

  const rng = createRng(stroke.seed);
  const kind = stroke.tool === "eraser" ? "eraser" : stroke.brush;
  const color = stroke.tool === "eraser" ? "#000000" : normalizeColor(stroke.settings?.color, options.fallbackColor);
  const stamps = getStampSet(kind, color, getStrokeRoughness(stroke));
  const points = stroke.points;
  const density = getStrokeDensity(stroke);
  const renderAlpha = options.alpha ?? 1;
  const pathMetrics = getPathMetrics(points);
  const wind = createWindEffect(options);
  const boil = createBoilEffect(options);

  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  const initialDensity = getProfiledDensity(stroke, density, 0);
  const placement = createPlacementState(stroke, initialDensity, rng, kind);
  drawPoint(ctx, stamps, points[0], stroke, initialDensity, rng, kind, renderAlpha, wind, boil);

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
      wind,
      boil,
      pathMetrics.cumulative[index - 1],
      pathMetrics.total,
      placement
    );
  }

  ctx.restore();
}

function normalizeColor(color, fallback = "#000000") {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color.toLowerCase() : fallback;
}

function createPlacementState(stroke, initialDensity, rng, kind) {
  return {
    nextDistance: nextSpacing(stroke, initialDensity, rng, kind)
  };
}

function nextSpacing(stroke, densityMultiplier, rng, kind) {
  const baseSpacing = getBaseSpacing(stroke, kind);
  const spacing = clamp(baseSpacing / densityMultiplier, 1.25, Math.max(2, baseSpacing * 120));
  return spacing * lerp(0.62, 1.32, rng());
}

function getBaseSpacing(stroke, kind) {
  const size = getStrokeSize(stroke);
  return kind === "dotted" ? size * 0.72 : size * 0.28;
}

function drawSegment(ctx, stamps, from, to, stroke, baseDensity, rng, kind, renderAlpha, wind, boil, segmentStartLength, totalLength, placement) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 0.01) return;

  const segmentEndLength = segmentStartLength + distance;

  while (placement.nextDistance <= segmentEndLength) {
    const traveled = placement.nextDistance - segmentStartLength;
    const t = traveled / distance;
    const pathT = totalLength > 0 ? placement.nextDistance / totalLength : t;
    const densityMultiplier = getProfiledDensity(stroke, baseDensity, pathT);
    const pressure = lerp(from.pressure, to.pressure, t);
    const point = {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      pressure,
      pointerType: to.pointerType,
      time: lerp(from.time, to.time, t)
    };
    drawPoint(ctx, stamps, point, stroke, densityMultiplier, rng, kind, renderAlpha, wind, boil);
    placement.nextDistance += nextSpacing(stroke, densityMultiplier, rng, kind);
  }
}

function drawPoint(ctx, stamps, point, stroke, densityMultiplier, rng, kind, renderAlpha, wind, boil) {
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
    const boilSample = applyBoilEffect(kind === "eraser" ? null : boil, x, y, drawSize, i);
    const windSample = applyWindEffect(kind === "eraser" ? null : wind, boilSample.x, boilSample.y, rng);
    if (windSample.skip) continue;
    const alpha = (kind === "dotted" ? lerp(0.86, 1, rng()) : 1) * renderAlpha * windSample.alpha * boilSample.alpha;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(windSample.x, windSample.y);
    ctx.rotate(rng() * Math.PI * 2 + boilSample.rotation);
    ctx.drawImage(stamp, -boilSample.size / 2, -boilSample.size / 2, boilSample.size, boilSample.size);
    ctx.restore();
  }
}

function createBoilEffect(options) {
  const amount = clamp(Number(options.boilAmount ?? options.boil?.amount ?? 0) / 100, 0, 1);
  if (amount <= 0) return null;
  return {
    amount,
    frameIndex: Math.max(0, Math.round(Number(options.frameIndex ?? options.boil?.frameIndex ?? 0)))
  };
}

function applyBoilEffect(boil, x, y, size, dotIndex) {
  if (!boil) return { x, y, size, rotation: 0, alpha: 1 };

  const salt = boil.frameIndex * 101.37 + dotIndex * 17.19;
  const angle = hashNoise(x * 0.013, y * 0.013, salt) * Math.PI * 2;
  const maxShift = boil.amount * Math.max(1.25, Math.min(14, size * 0.22));
  const shift = maxShift * lerp(0.35, 1, hashNoise(x * 0.021, y * 0.021, salt + 33.3));
  const sizeScale = lerp(1 - boil.amount * 0.11, 1 + boil.amount * 0.12, hashNoise(x * 0.017, y * 0.017, salt + 71.7));
  const alpha = lerp(1 - boil.amount * 0.08, 1, hashNoise(x * 0.019, y * 0.019, salt + 121.1));

  return {
    x: x + Math.cos(angle) * shift,
    y: y + Math.sin(angle) * shift,
    size: Math.max(0.5, size * sizeScale),
    rotation: (hashNoise(x * 0.023, y * 0.023, salt + 197.5) - 0.5) * boil.amount * 0.45,
    alpha
  };
}

function hashNoise(x, y, salt) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function createWindEffect(options) {
  const wind = options.effects?.wind;
  if (!wind?.enabled) return null;
  const strength = clamp(Number(wind.strength ?? 0) / 100, 0, 1);
  const force = strength * 10;
  const trailLength = clamp(Number(wind.trailLength ?? 0), 0, 420);
  if (strength <= 0 || trailLength <= 0) return null;

  const radians = (Number(wind.direction ?? 0) * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const width = Math.max(1, Number(options.canvasWidth ?? 1));
  const height = Math.max(1, Number(options.canvasHeight ?? 1));
  const projections = [
    0,
    width * dx,
    height * dy,
    (width * dx) + (height * dy)
  ];
  const minProjection = Math.min(...projections);
  const maxProjection = Math.max(...projections);

  return {
    dx,
    dy,
    crossX: -dy,
    crossY: dx,
    minProjection,
    projectionRange: Math.max(1, maxProjection - minProjection),
    strength,
    force,
    trailLength,
    destruction: clamp(Number(wind.destruction ?? 0) / 100, 0, 1),
    uniformity: clamp(Number(wind.uniformity ?? 0) / 100, 0, 1)
  };
}

function applyWindEffect(wind, x, y, rng) {
  if (!wind) return { x, y, alpha: 1, skip: false };

  const projection = ((x * wind.dx) + (y * wind.dy) - wind.minProjection) / wind.projectionRange;
  const downwindT = clamp(projection, 0, 1);
  const flagInfluence = downwindT;
  const sandInfluence = lerp(1, 0.65, downwindT);
  const influence = clamp(lerp(flagInfluence, sandInfluence, wind.uniformity), 0, 1);
  const destructiveForce = wind.destruction * influence;
  const skipChance = destructiveForce * Math.min(1, wind.force) * 0.5;
  const skipRoll = rng();
  if (skipRoll < skipChance) return { x, y, alpha: 0, skip: true };

  const gust = lerp(0.18, 1.15, rng());
  const drift = wind.trailLength * wind.force * influence * lerp(0.25, 1, wind.destruction) * gust;
  const cross = wind.trailLength * wind.force * influence * 0.22 * (rng() - 0.5);
  const alpha = clamp(lerp(1, lerp(0.32, 0.82, rng()), destructiveForce), 0.08, 1);

  return {
    x: x + (wind.dx * drift) + (wind.crossX * cross),
    y: y + (wind.dy * drift) + (wind.crossY * cross),
    alpha,
    skip: false
  };
}

export function getStrokeSize(stroke) {
  return Math.max(1, Number(stroke.settings?.size ?? 18) * Number(stroke.sizeScale ?? 1));
}

export function getStrokeSizeVariation(stroke) {
  return clamp(Number(stroke.settings?.sizeVariation ?? 0), 0, 1);
}

export function getStrokeRoughness(stroke) {
  return clamp(Number(stroke.settings?.roughness ?? 1), 0, 1);
}

export function getStrokeDensity(stroke) {
  return Math.max(LINE_DENSITY_MIN, Number(stroke.settings?.density ?? 1) * Number(stroke.densityScale ?? 1));
}

export function getStrokeDensityProfile(stroke) {
  return stroke.settings?.densityProfile || DENSITY_PROFILE_DEFAULT;
}

function getProfiledDensity(stroke, baseDensity, t) {
  return Math.max(LINE_DENSITY_MIN, baseDensity * getDensityProfileMultiplier(getStrokeDensityProfile(stroke), t));
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
