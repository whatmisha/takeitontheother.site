import { createWebsiteSphereLayout } from './sphere-layout.js';
import { buildPlanetMasks } from './planet-masks.js';

// Bounded per-worker cache: resize back to a recent width without recalculation.
export class LayoutCache {
  constructor(limit = 3) { this.limit = limit; this.entries = new Map(); }
  get(cssSize) {
    let entry = this.entries.get(cssSize);
    if (entry) this.entries.delete(cssSize);
    else entry = { layout: createWebsiteSphereLayout(cssSize), masks: null };
    this.entries.set(cssSize, entry);
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
    return entry;
  }
  masks(entry) { return entry.masks ||= buildPlanetMasks(entry.layout.axes); }
}
