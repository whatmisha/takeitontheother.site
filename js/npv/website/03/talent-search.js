import { createPersonSearchPlan, buildPersonSearchScene } from './runtime/animation/personSearch.js';

export const SEARCH_DELAY_MS = 600;

// Advance on rendered time, so a hidden tab never skips ahead in the search.
export class TalentSearch {
  constructor(layout) {
    this.layout = layout;
    this.elapsed = 0;
    this.plan = null;
  }

  reset() { this.elapsed = 0; }

  sample(ready, delta, reducedMotion = false) {
    if (!ready) {
      this.reset();
      return {elements: this.layout.elements, running: false};
    }
    if (reducedMotion) {
      this.reset();
      this.plan ??= createPersonSearchPlan(this.layout.settings);
      this.still ??= buildPersonSearchScene(this.layout.settings, this.plan, .8);
      return {...this.still, running: false};
    }
    this.elapsed += Math.max(0, delta);
    if (this.elapsed <= SEARCH_DELAY_MS) return {elements: this.layout.elements, running: true};
    this.plan ??= createPersonSearchPlan(this.layout.settings);
    const duration = this.layout.settings.searchDuration * 1000;
    const progress = ((this.elapsed - SEARCH_DELAY_MS) % duration) / duration;
    return {...buildPersonSearchScene(this.layout.settings, this.plan, progress), running: true};
  }
}
