import { LayoutClient } from './layout-client.js';
import { PLANET_REGIONS, REGION_IDS } from './planet-regions.js';
import { axisRotation, clamp, focusLift, orientationDistance, planetProgress, regionOrientation, slerp } from './planet-motion.js';

export class PlanetExperience {
  constructor(sphere, reducedMotion, surface = null) {
    this.sphere = sphere;
    this.surface = surface;
    if (surface) surface.onChange = () => this.schedule();
    this.reducedMotion = reducedMotion;
    this.panel = document.querySelector('.graphic-panel');
    this.heading = document.querySelector('#partners-title');
    this.copy = this.heading.closest('.screen-copy');
    this.buttons = [...document.querySelectorAll('[data-region]')];
    this.frame = 0;
    this.lastTime = 0;
    this.hovered = this.focused = null;
    this.selectedRegion = 'us';
    this.initialPosePending = true;
    this.current = { orientation: axisRotation(0, 0), land: 0, flat: 0,
      regions: Object.fromEntries(REGION_IDS.map(id => [id, 0])) };
    this.layouts = new LayoutClient((layout, version) => {
      if (!this.sphere.setLayout(layout, version)) return;
      if (this.surface) this.surface.points = null;
      this.sync();
    }, (masks, version) => {
      if (this.sphere.setGeography(masks, version)) this.sync();
    });
    this.bindRegions();
    // Also covers viewport-height changes which do not resize a mobile panel's width.
    addEventListener('resize', () => this.queueResize(), { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.queueResize());
    this.resizeObserver.observe(this.panel);
    reducedMotion.addEventListener('change', () => this.sync());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(this.frame);
        this.frame = this.lastTime = 0;
      } else this.sync();
    });
    this.resize();
  }

  queueResize() { this.resizePending = true; this.schedule(); }

  resize() {
    this.resizePending = false;
    this.sphere.resize();
    this.surface?.resize();
    this.metrics = { panel:this.panel.getBoundingClientRect(), canvas:this.sphere.canvas.getBoundingClientRect() };
    this.sphere.setViewport(this.metrics.panel, this.metrics.canvas);
    if (this.requestedVersion !== this.sphere.layoutVersion) {
      this.requestedVersion = this.sphere.layoutVersion;
      this.layouts.request({version:this.sphere.layoutVersion,cssSize:this.sphere.cssSize});
    }
    this.sync();
  }

  bindRegions() {
    for (const button of this.buttons) {
      const id = button.dataset.region;
      button.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch') return;
        this.hovered = id;
        this.sync();
      });
      button.addEventListener('pointerleave', () => {
        if (this.hovered === id) this.hovered = null;
        this.sync();
      });
      button.addEventListener('focus', () => {
        if (button.matches(':focus-visible')) {
          this.focused = id;
          this.hovered = null;
        }
        this.sync();
      });
      button.addEventListener('blur', () => {
        if (this.focused === id) this.focused = null;
        this.sync();
      });
      button.addEventListener('click', event => {
        if (event.detail === 0) this.focused = id;
        this.selectedRegion = id;
        this.sync();
      });
    }
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('[data-region]')) {
        this.focused = null;
        this.sync();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        this.hovered = this.focused = null;
        this.sync();
      }
    });
  }

  setStoryState(state) {
    // Every visit starts over the US, including a reverse scroll from Talent.
    if (state.active !== 1 || this.storyState?.active !== 1) this.selectedRegion = 'us';
    this.storyState = state;
    this.sync();
  }

  schedule() {
    if (!this.frame && !this.inFrame && !document.hidden) this.frame = requestAnimationFrame(now => this.animate(now));
  }

  sync() {
    const scrolled = scrollY > 1;
    if (this.scrolled !== scrolled) {
      document.body.classList.toggle('is-scrolled', scrolled);
      this.scrolled = scrolled;
    }
    const panel = this.metrics?.panel ?? this.panel.getBoundingClientRect();
    const canvas = this.metrics?.canvas ?? this.sphere.canvas.getBoundingClientRect();
    const visibleTop = panel.width >= innerWidth - 1 ? panel.bottom : 84;
    const copy = this.storyState?.copyBounds ?? this.copy.getBoundingClientRect();
    const headingTop = copy.top;
    if (copy.bottom <= visibleTop || copy.top >= innerHeight
      || (this.storyState && (this.storyState.active !== 1 || this.storyState.flat > .01))) {
      this.hovered = this.focused = null;
    }
    const preview = this.hovered || this.focused;
    const active = preview || this.selectedRegion;
    if (this.renderedRegion !== this.selectedRegion) {
      for (const button of this.buttons) {
        const selected = button.dataset.region === this.selectedRegion;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      }
      this.renderedRegion = this.selectedRegion;
    }
    const progress = preview ? 1 : (this.storyState?.land ?? planetProgress(headingTop, visibleTop, innerHeight));
    const land = this.sphere.geography ? progress : 0;
    const lift = focusLift(canvas.top + canvas.height / 2,
      this.sphere.radius * canvas.width / 480, panel.top, panel.height);
    const turn = this.reducedMotion.matches ? 0 : (this.storyState?.sphereTurn
      ?? Math.min(0, scrollY / Math.max(1, innerHeight) - .65) * 180);
    const home = PLANET_REGIONS.us;
    // Longitude is aligned from the first frame. Scroll only changes pitch;
    // geography can then appear without turning the globe sideways to the US.
    const entry = regionOrientation(home.longitude, home.latitude, lift + turn);
    const region = PLANET_REGIONS[active];
    const planet = regionOrientation(region.longitude, region.latitude, lift);
    this.target = {
      orientation: active === 'us' ? entry : slerp(entry, planet, land),
      land,
      flat: this.storyState?.flat || 0,
      regions: Object.fromEntries(REGION_IDS.map(id => [id, active === id ? land : 0]))
    };
    if (this.surface?.active) {
      this.target.orientation = this.surface.orientation;
      this.target.land = this.surface.entryFrame.land;
      this.target.regions = this.surface.entryFrame.regions;
    }
    if (this.initialPosePending) {
      this.current.orientation = [...this.target.orientation];
      this.sphere.drawFrame(this.current);
      // Story supplies the final layout synchronously during startup.
      this.initialPosePending = !this.storyState;
    }
    this.schedule();
  }

  animate(now) {
    this.frame = 0;
    this.inFrame = true;
    this.beforeFrame?.();
    if (this.resizePending) this.resize();
    if (!this.sphere.axes && this.layouts) { this.lastTime = 0; this.inFrame = false; return; }
    const delta = this.lastTime ? clamp(now - this.lastTime, 0, 64) : 16;
    this.lastTime = now;
    const amount = this.reducedMotion.matches ? 1 : 1 - Math.exp(-delta / 170);
    const approach = (value, target) => Math.abs(target - value) < .001 ? target : value + (target - value) * amount;
    this.current = {
      orientation: orientationDistance(this.current.orientation, this.target.orientation) < 1e-7
        ? this.target.orientation : slerp(this.current.orientation, this.target.orientation, amount),
      land: approach(this.current.land, this.target.land),
      flat: approach(this.current.flat || 0, this.target.flat || 0),
      regions: Object.fromEntries(REGION_IDS.map(id => [id, approach(this.current.regions[id], this.target.regions[id])]))
    };
    const wasSurface = this.surface?.active;
    if (wasSurface) {
      this.current.orientation = this.surface.orientation;
      this.current.land = this.surface.entryFrame.land;
      this.current.regions = {...this.surface.entryFrame.regions};
    }
    const surfaceMoving = this.surface?.draw(this.current, delta, this.reducedMotion.matches);
    if (this.surface?.active) {
      this.sphere.frame = this.current;
      this.target.orientation = this.surface.orientation;
      this.target.land = this.surface.entryFrame.land;
      this.target.regions = this.surface.entryFrame.regions;
    } else {
      this.sphere.drawFrame(this.current);
      if (wasSurface) this.sync();
    }
    const moving = orientationDistance(this.current.orientation, this.target.orientation) > 1e-12
      || surfaceMoving
      || this.current.flat !== (this.target.flat || 0)
      || this.current.land !== this.target.land
      || REGION_IDS.some(id => this.current.regions[id] !== this.target.regions[id]);
    this.inFrame = false;
    if (moving && !document.hidden && !this.frame) this.frame = requestAnimationFrame(time => this.animate(time));
    else this.lastTime = 0;
  }
}
