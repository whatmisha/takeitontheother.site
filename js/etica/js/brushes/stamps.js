import { clamp, createRng, lerp } from "./random.js";

const STAMP_SIZE = 96;
const cache = new Map();

export function getStampSet(kind, color, roughness = 1) {
  const normalizedRoughness = clamp(Number(roughness), 0, 1);
  const roughnessKey = Math.round(normalizedRoughness * 100);
  const key = `${kind}:${color}:${roughnessKey}`;
  if (!cache.has(key)) {
    const stamps = [];
    for (let index = 0; index < 18; index += 1) {
      stamps.push(createStamp(kind, color, 1009 + index * 7919, normalizedRoughness));
    }
    cache.set(key, stamps);
  }
  return cache.get(key);
}

function createStamp(kind, color, seed, roughness) {
  const rng = createRng(seed);
  const canvas = document.createElement("canvas");
  canvas.width = STAMP_SIZE;
  canvas.height = STAMP_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const center = STAMP_SIZE / 2;
  const irregularMainRadius = kind === "ink" || kind === "eraser" ? 19 + rng() * 8 : 14 + rng() * 5;
  const smoothMainRadius = kind === "ink" || kind === "eraser" ? 23 : 18;
  const mainRadius = lerp(smoothMainRadius, irregularMainRadius, roughness);
  const lobeCount = Math.round((kind === "dotted" ? 13 : 24) * roughness);

  ctx.clearRect(0, 0, STAMP_SIZE, STAMP_SIZE);
  ctx.fillStyle = color;
  ctx.globalAlpha = kind === "dotted" ? 0.95 : 1;
  ctx.beginPath();
  ctx.arc(center, center, mainRadius, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < lobeCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    const distance = lerp(mainRadius * 0.28, mainRadius * 0.92, rng());
    const radius = lerp(mainRadius * 0.22, mainRadius * 0.58, rng());
    const x = center + Math.cos(angle) * distance;
    const y = center + Math.sin(angle) * distance;
    ctx.globalAlpha = lerp(0.58, 1, rng());
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  roughenAlpha(ctx, kind, roughness);
  return canvas;
}

function roughenAlpha(ctx, kind, roughness) {
  if (roughness <= 0) return;

  const image = ctx.getImageData(0, 0, STAMP_SIZE, STAMP_SIZE);
  const data = image.data;
  const center = STAMP_SIZE / 2;
  const maxDistance = STAMP_SIZE * 0.44;

  for (let y = 0; y < STAMP_SIZE; y += 1) {
    for (let x = 0; x < STAMP_SIZE; x += 1) {
      const index = (y * STAMP_SIZE + x) * 4;
      const alpha = data[index + 3];
      if (alpha === 0) continue;

      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const edge = Math.max(0, (distance - maxDistance * 0.55) / (maxDistance * 0.45));
      const grain = pseudoNoise(x, y, alpha + (kind === "ink" ? 71 : 19));
      const grainStrength = (kind === "dotted" ? 0.22 : 0.16) * roughness;
      const edgeLoss = edge * edge * (kind === "dotted" ? 130 : 95) * roughness;
      const grainLoss = grain * 255 * grainStrength;

      data[index + 3] = Math.max(0, Math.min(255, alpha - edgeLoss - grainLoss));
    }
  }

  ctx.putImageData(image, 0, 0);
}

function pseudoNoise(x, y, salt) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 0.017) * 43758.5453;
  return n - Math.floor(n);
}
