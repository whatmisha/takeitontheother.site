import { createPersonSearchPlan, buildPersonSearchScene } from './runtime/animation/personSearch.js';

export const SEARCH_START_FLAT = .9;
// The selection pulse has settled; the generator fades the winner after .92.
export const SEARCH_HOLD_PROGRESS = .82;

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
      return this.hold();
    }
    const duration = this.layout.settings.searchDuration * 1000;
    this.elapsed = Math.min(duration * SEARCH_HOLD_PROGRESS,
      this.elapsed + Math.max(0, delta));
    this.plan ??= createPersonSearchPlan(this.layout.settings);
    const progress = this.elapsed / duration;
    if (progress >= SEARCH_HOLD_PROGRESS) return this.hold();
    return {...buildPersonSearchScene(this.layout.settings, this.plan, progress), running: true};
  }
  hold() {
    this.plan ??= createPersonSearchPlan(this.layout.settings);
    this.still ??= buildPersonSearchScene(this.layout.settings, this.plan, SEARCH_HOLD_PROGRESS);
    return {...this.still, running: false};
  }
}
