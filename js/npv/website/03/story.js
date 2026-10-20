import { storyAt, storyLayout, rebaseStoryScroll } from './story-timeline.js';

export class Story {
  constructor(reducedMotion, onChange) {
    this.reducedMotion = reducedMotion;
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
    reducedMotion.addEventListener('change', () => this.update());
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
    this.position = scrollY;
    const state = storyAt(scrollY, this.layout, this.reducedMotion.matches);
    this.sections.forEach((section, index) => {
      section.style.setProperty('--copy-y', `${state.copies[index].y}px`);
      section.style.setProperty('--copy-opacity', state.copies[index].opacity);
      section.inert = index !== state.active;
      section.setAttribute('aria-hidden', String(index !== state.active));
      if (index === state.active) this.links[index].setAttribute('aria-current', 'location');
      else this.links[index].removeAttribute('aria-current');
    });
    this.onChange(state);
  }
}
