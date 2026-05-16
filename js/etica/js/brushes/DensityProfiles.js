import { clamp } from "./random.js";

export const DENSITY_PROFILE_DEFAULT = "flat";

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
