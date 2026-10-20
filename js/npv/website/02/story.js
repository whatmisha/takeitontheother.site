import { storyAt, storyLayout, rebaseStoryScroll, advanceCopies } from './story-timeline.js';

export class Story {
  constructor(reducedMotion, onChange) {
    this.reducedMotion = reducedMotion;
    this.navigationFrame = this.copyFrame = this.lastCopyTime = 0;
    history.scrollRestoration = 'manual';
    this.onChange = onChange;
    this.content = document.querySelector('.content');
    this.sections = [...document.querySelectorAll('.screen')];
    this.copies = this.sections.map(section => section.querySelector('.screen-copy'));
    this.links = [...document.querySelectorAll('.scene-nav a')];
    this.anchors = [...document.querySelectorAll('.scene-anchor')];
    this.resize();
    document.documentElement.classList.add('story-ready');
    this.observer = new ResizeObserver(() => this.resize());
    this.copies.forEach(copy => this.observer.observe(copy));
    addEventListener('resize', () => this.resize(), {passive:true});
    addEventListener('scroll', () => this.update(), {passive:true});
    reducedMotion.addEventListener('change', () => { this.cancelNavigation(); this.update(true); });
    // Native scroll input always takes over immediately; no wheel interception.
    for (const event of ['wheel', 'touchstart', 'pointerdown']) {
      addEventListener(event, () => this.cancelNavigation(), {passive:true});
    }
    addEventListener('keydown', event => {
      if (!event.target.closest('input, textarea, select, [contenteditable="true"]')
        && ['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) this.cancelNavigation();
    });
    this.links.forEach((link, index) => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState(null, '', link.hash);
      this.navigate(index, !reducedMotion.matches);
    }));
    addEventListener('hashchange', () => this.followHash());
    addEventListener('popstate', () => this.followHash());
    addEventListener('pageshow', () => this.followHash());
    document.fonts.ready.then(() => { this.resize(); this.followHash(); });
  }

  resize() {
    const heights = this.copies.map(copy => copy.getBoundingClientRect().height);
    const previous = this.layout;
    this.layout = storyLayout(heights, innerHeight, matchMedia('(max-width: 767px)').matches);
    const changed = previous && (previous.height !== this.layout.height
      || previous.scenes.some((scene,index) => scene.anchor !== this.layout.scenes[index].anchor
        || scene.copyHeight !== this.layout.scenes[index].copyHeight));
    this.content.style.setProperty('--story-height', `${this.layout.total}px`);
    this.anchors.forEach((anchor,index) => { anchor.style.top = `${this.layout.scenes[index].start}px`; });
    if (changed) {
      this.cancelNavigation();
      window.scrollTo({top:rebaseStoryScroll(this.position ?? scrollY,previous,this.layout),behavior:'instant'});
    }
    this.update(true);
  }

  cancelNavigation() {
    cancelAnimationFrame(this.navigationFrame);
    this.navigationFrame = 0;
  }

  navigate(index, smooth = false) {
    this.cancelNavigation();
    const start = scrollY;
    const destination = Math.min(this.layout.scenes[index].start, this.layout.total - this.layout.height);
    if (!smooth || Math.abs(destination - start) < 1) {
      window.scrollTo({top:destination, behavior:'instant'});
      this.update(true);
      return;
    }
    const started = performance.now();
    const duration = 1000 + Math.min(400, Math.abs(destination - start) / this.layout.height * 200);
    const tick = now => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      window.scrollTo({top:start + (destination - start) * eased, behavior:'instant'});
      this.update();
      this.navigationFrame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.navigationFrame = requestAnimationFrame(tick);
  }

  followHash() {
    const index = this.links.findIndex(link => link.hash === location.hash);
    if (index >= 0) this.navigate(index);
    else if (!location.hash) this.navigate(0);
  }

  update(immediate = false) {
    this.position = scrollY;
    const state = storyAt(scrollY, this.layout, this.reducedMotion.matches);
    this.targetCopies = state.copies;
    if (!this.renderedCopies || immediate || this.reducedMotion.matches) {
      cancelAnimationFrame(this.copyFrame);
      this.copyFrame = this.lastCopyTime = 0;
      this.renderedCopies = state.copies.map(copy => ({...copy}));
      this.renderCopies();
    } else if (!this.copyFrame) this.copyFrame = requestAnimationFrame(now => this.animateCopies(now));
    this.sections.forEach((section, index) => {
      section.inert = index !== state.active;
      section.setAttribute('aria-hidden', String(index !== state.active));
      if (index === state.active) this.links[index].setAttribute('aria-current', 'location');
      else this.links[index].removeAttribute('aria-current');
    });
    this.onChange(state);
  }

  renderCopies() {
    this.sections.forEach((section, index) => {
      section.style.setProperty('--copy-y', `${this.renderedCopies[index].y}px`);
      section.style.setProperty('--copy-opacity', this.renderedCopies[index].opacity);
    });
  }

  animateCopies(now) {
    const delta = this.lastCopyTime ? now - this.lastCopyTime : 16;
    this.lastCopyTime = now;
    const next = advanceCopies(this.renderedCopies, this.targetCopies, delta, this.reducedMotion.matches);
    this.renderedCopies = next.copies;
    this.renderCopies();
    this.copyFrame = next.moving ? requestAnimationFrame(time => this.animateCopies(time)) : 0;
    if (!this.copyFrame) this.lastCopyTime = 0;
  }
}
