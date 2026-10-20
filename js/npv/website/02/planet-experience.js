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
    this.current = { orientation: axisRotation(0, 0), land: 0, flat: 0,
      regions: Object.fromEntries(REGION_IDS.map(id => [id, 0])) };
    this.worker = new Worker(new URL('./planet-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      this.workerBusy = false;
      if (this.sphere.setGeography(data.masks, data.version)) this.sync();
      if (this.pendingLayout) this.sendLayout();
    };
    this.worker.onerror = error => {
      console.error('Unable to prepare Planet geography:', error.message);
      this.worker.terminate();
      this.workerFailed = true;
    };
    this.bindRegions();
    addEventListener('scroll', () => this.sync(), { passive: true });
    // Also covers viewport-height changes which do not resize a mobile panel's width.
    addEventListener('resize', () => this.resize(), { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.resize());
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

  resize() {
    this.sphere.resize();
    this.surface?.resize();
    if (this.requestedVersion !== this.sphere.layoutVersion) {
      this.requestedVersion = this.sphere.layoutVersion;
      this.current.land = 0;
      // At most one calculation in flight; resizing replaces the queued request.
      this.pendingLayout = { version: this.sphere.layoutVersion, axes: this.sphere.axes };
      if (!this.workerBusy && !this.workerFailed) this.sendLayout();
    }
    this.sync();
  }

  sendLayout() {
    const { version, axes } = this.pendingLayout;
    this.pendingLayout = null;
    const coordinates = new Float64Array(axes.length * 3);
    axes.forEach((axis, index) => coordinates.set([axis.x, axis.y, axis.z], index * 3));
    this.workerBusy = true;
    this.worker.postMessage({ version, coordinates }, [coordinates.buffer]);
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
    if (!this.frame && !document.hidden) this.frame = requestAnimationFrame(now => this.animate(now));
  }

  sync() {
    document.body.classList.toggle('is-scrolled', scrollY > 1);
    const panel = this.panel.getBoundingClientRect();
    const canvas = this.sphere.canvas.getBoundingClientRect();
    const visibleTop = panel.width >= innerWidth - 1 ? panel.bottom : 84;
    const headingTop = this.heading.getBoundingClientRect().top;
    const copy = this.copy.getBoundingClientRect();
    if (copy.bottom <= visibleTop || copy.top >= innerHeight
      || (this.storyState && (this.storyState.active !== 1 || this.storyState.flat > .01))) {
      this.hovered = this.focused = null;
    }
    const preview = this.hovered || this.focused;
    const active = preview || this.selectedRegion;
    for (const button of this.buttons) {
      const selected = button.dataset.region === this.selectedRegion;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    const progress = preview ? 1 : (this.storyState?.land ?? planetProgress(headingTop, visibleTop, innerHeight));
    const land = this.sphere.geography ? progress : 0;
    const lift = focusLift(canvas.top + canvas.height / 2,
      this.sphere.radius * canvas.width / 480, panel.top, panel.height);
    const scrollTurn = this.reducedMotion.matches ? 0 : scrollY / Math.max(1, innerHeight) * 180;
    const plain = axisRotation(0, scrollTurn);
    // Bring the default region into view gradually with the land, preserving
    // plain sphere rotation on the first screen and hover previews on the second.
    const region = PLANET_REGIONS[active];
    const planet = regionOrientation(region.longitude, region.latitude, lift);
    this.target = {
      orientation: slerp(plain, planet, land),
      land,
      flat: this.storyState?.flat || 0,
      regions: Object.fromEntries(REGION_IDS.map(id => [id, active === id ? land : 0]))
    };
    if (this.surface?.active) {
      this.target.orientation = this.surface.orientation;
      this.target.land = this.surface.entryFrame.land;
      this.target.regions = this.surface.entryFrame.regions;
    }
    this.schedule();
  }

  animate(now) {
    this.frame = 0;
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
    if (moving && !document.hidden && !this.frame) this.frame = requestAnimationFrame(time => this.animate(time));
    else this.lastTime = 0;
  }
}
