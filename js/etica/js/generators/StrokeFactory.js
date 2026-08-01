import { randomSeed } from "../brushes/random.js";
import { point } from "./GeneratorUtils.js";

let strokeCounter = 0;

export class StrokeFactory {
  constructor({ source, groupId, color, seed, scatter = 1, roughness = 1 }) {
    this.source = source;
    this.groupId = groupId;
    this.color = color || "#000000";
    this.seed = seed ?? randomSeed();
    this.scatter = scatter;
    this.roughness = roughness;
  }

  createStroke(points, options = {}) {
    const cleanPoints = points
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
      .map((item) => ({
        x: item.x,
        y: item.y,
        pressure: Number.isFinite(item.pressure) ? item.pressure : 0.72,
        pointerType: item.pointerType || "generated",
        time: Number.isFinite(item.time) ? item.time : 0
      }));

    if (!cleanPoints.length) return null;

    return {
      id: `${this.source}-${this.groupId}-${strokeCounter += 1}`,
      seed: options.seed ?? randomSeed(),
      tool: "brush",
      brush: options.brush || "dotted",
      settings: {
        size: options.size ?? 18,
        sizeVariation: options.sizeVariation ?? 0,
        scatter: options.scatter ?? this.scatter,
        roughness: options.roughness ?? this.roughness,
        density: options.density ?? 1,
        densityProfile: options.densityProfile || "flat",
        pressureEnabled: options.pressureEnabled ?? false,
        color: options.color || this.color
      },
      sizeScale: options.sizeScale ?? 1,
      densityScale: options.densityScale ?? 1,
      points: cleanPoints,
      meta: {
        generated: true,
        source: this.source,
        groupId: this.groupId,
        seed: this.seed,
        role: options.role || "mark"
      }
    };
  }

  createDot(x, y, options = {}) {
    const pressure = options.pressure ?? 0.72;
    return this.createStroke([point(x, y, pressure)], {
      ...options,
      densityProfile: options.densityProfile || "flat",
      role: options.role || "dot"
    });
  }

  createDotSeries(points, options = {}) {
    const baseSeed = options.seed ?? randomSeed();
    return points
      .map((item, index) => this.createDot(item.x, item.y, {
        ...options,
        seed: (baseSeed + index * 1013904223) >>> 0,
        pressure: Number.isFinite(item.pressure) ? item.pressure : options.pressure,
        role: options.role || "dot-series"
      }))
      .filter(Boolean);
  }

  createPolyline(points, options = {}) {
    return this.createStroke(points, {
      ...options,
      densityProfile: options.densityProfile || "flat",
      role: options.role || "line"
    });
  }
}
