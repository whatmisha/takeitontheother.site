import { storyAt, storyLayout, rebaseStoryScroll } from './story-timeline.js';

export class Story {
  constructor(reducedMotion, onChange, scheduleFrame) {
    this.reducedMotion = reducedMotion;
    history.scrollRestoration = 'manual';
    this.onChange = onChange;
    this.scheduleFrame = scheduleFrame;
    this.renderedCopies = [];
    this.content = document.querySelector('.content');
    this.sections = [...document.querySelectorAll('.screen')];
    this.copies = this.sections.map(section => section.querySelector('.screen-copy'));
    this.links = [...document.querySelectorAll('.scene-nav a')];
    this.anchors = [...document.querySelectorAll('.scene-anchor')];
    this.resize();
    document.documentElement.classList.add('story-ready');
    this.observer = new ResizeObserver(() => this.queueResize());
    this.copies.forEach(copy => this.observer.observe(copy));
    addEventListener('resize', () => this.queueResize(), {passive:true});
    addEventListener('scroll', () => this.invalidate(), {passive:true});
    reducedMotion.addEventListener('change', () => this.invalidate());
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

  invalidate() { this.dirty = true; this.scheduleFrame(); }
  queueResize() { this.resizePending = true; this.invalidate(); }
  flush() {
    if (this.resizePending) this.resize();
    else if (this.dirty) this.update();
  }

  resize() {
    this.resizePending = false;
    const heights = this.copies.map(copy => copy.getBoundingClientRect().height);
    const previous = this.layout;
    this.layout = storyLayout(heights, innerHeight, matchMedia('(max-width: 767px)').matches);
    const changed = previous && (previous.height !== this.layout.height
      || previous.scenes.some((scene,index) => scene.anchor !== this.layout.scenes[index].anchor
        || scene.copyHeight !== this.layout.scenes[index].copyHeight));
    this.content.style.setProperty('--story-height', `${this.layout.total}px`);
    this.anchors.forEach((anchor,index) => { anchor.style.top = `${this.layout.scenes[index].start}px`; });
    if (changed) window.scrollTo({top:rebaseStoryScroll(this.position ?? scrollY,previous,this.layout),behavior:'instant'});
    this.update();
  }

  navigate(index, smooth = false) {
    window.scrollTo({ top: this.layout.scenes[index].start, behavior: smooth ? 'smooth' : 'instant' });
    this.update();
  }

  followHash() {
    const index = this.links.findIndex(link => link.hash === location.hash);
    if (index >= 0) this.navigate(index);
    else if (!location.hash) this.navigate(0);
  }

  update() {
    this.dirty = false;
    this.position = scrollY;
    const state = storyAt(scrollY, this.layout, this.reducedMotion.matches);
    this.sections.forEach((section, index) => {
      const copy = state.copies[index], previous = this.renderedCopies[index];
      if (!previous || previous.y !== copy.y) section.style.setProperty('--copy-y', `${copy.y}px`);
      if (!previous || previous.opacity !== copy.opacity) section.style.setProperty('--copy-opacity', copy.opacity);
      if (this.active !== state.active) {
        section.inert = index !== state.active;
        section.setAttribute('aria-hidden', String(index !== state.active));
        if (index === state.active) this.links[index].setAttribute('aria-current', 'location');
        else this.links[index].removeAttribute('aria-current');
      }
    });
    this.renderedCopies = state.copies;
    this.active = state.active;
    // Geometry is known from the timeline; scroll no longer reads transformed DOM.
    state.copyBounds = {top:state.copies[1].y,bottom:state.copies[1].y + this.layout.scenes[1].copyHeight};
    this.onChange(state);
  }
}
