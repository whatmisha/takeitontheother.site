import { clamp, createRng, lerp } from "../brushes/random.js";

export { clamp, createRng, lerp };

export function normalizePercent(value, fallback = 50) {
  const numeric = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return fallback / 100;
  return clamp(numeric, 0, 100) / 100;
}

export function normalizeRange(value, fallback, min, max) {
  const numeric = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric, min, max);
}

export function randomBetween(rng, min, max) {
  return lerp(min, max, rng());
}

export function randomSign(rng) {
  return rng() < 0.5 ? -1 : 1;
}

export function point(x, y, pressure = 0.72) {
  return {
    x,
    y,
    pressure,
    pointerType: "generated",
    time: 0
  };
}

export function jitterPoint(base, rng, amount) {
  const angle = rng() * Math.PI * 2;
  const distance = amount * Math.sqrt(rng());
  return point(
    base.x + Math.cos(angle) * distance,
    base.y + Math.sin(angle) * distance,
    base.pressure ?? 0.72
  );
}

export function sampleCubicBezier(p0, p1, p2, p3, steps) {
  const samples = [];
  const count = Math.max(2, Math.round(steps));
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    const inv = 1 - t;
    const x = (inv ** 3 * p0.x) + (3 * inv * inv * t * p1.x) + (3 * inv * t * t * p2.x) + (t ** 3 * p3.x);
    const y = (inv ** 3 * p0.y) + (3 * inv * inv * t * p1.y) + (3 * inv * t * t * p2.y) + (t ** 3 * p3.y);
    samples.push(point(x, y));
  }
  return samples;
}

export function fitRect(sourceWidth, sourceHeight, targetWidth, targetHeight, mode = "fit") {
  const scale = mode === "fill"
    ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
    scale
  };
}

export function makeGroupId(source, seed) {
  return `${source}-${seed.toString(36)}-${Date.now().toString(36)}`;
}

export function shuffleInPlace(items, rng) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}
