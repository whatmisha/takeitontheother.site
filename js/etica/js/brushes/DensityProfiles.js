import { clamp } from "./random.js";

export const DENSITY_PROFILE_DEFAULT = "fade-out";

export function getDensityProfileMultiplier(profile, t) {
  const x = clamp(t, 0, 1);
  const eased = smoothstep(x);

  switch (profile) {
    case "fade-in":
      return lerp(0.32, 1.65, eased);
    case "fade-out":
      return lerp(1.65, 0.32, eased);
    case "in-out":
      return lerp(0.34, 1.78, Math.sin(Math.PI * x));
    case "soft-peak":
      return lerp(0.72, 1.42, Math.sin(Math.PI * x));
    case "hard-peak":
      return lerp(0.28, 2.05, Math.pow(Math.sin(Math.PI * x), 2.4));
    case "soft-dip":
      return lerp(1.28, 0.58, Math.sin(Math.PI * x));
    case "hard-dip":
      return lerp(1.78, 0.22, Math.pow(Math.sin(Math.PI * x), 1.8));
    case "flat":
    default:
      return 1;
  }
}

function smoothstep(t) {
  return t * t * (3 - (2 * t));
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}
