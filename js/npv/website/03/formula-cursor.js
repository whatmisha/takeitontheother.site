// A decorative pointer, kept outside the transformed/clipped story column.
export class FormulaCursor {
  constructor() {
    this.target = document.querySelector('.services-note');
    this.media = matchMedia('(any-hover: hover) and (any-pointer: fine)');
    this.element = document.createElement('div');
    this.element.className = 'formula-cursor';
    this.element.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 6; index++) {
      const layer = document.createElement('div');
      layer.className = 'formula-blur';
      this.element.append(layer);
    }
    const artwork = document.createElement('div');
    artwork.className = 'formula-art';
    this.element.append(artwork);
    document.body.append(this.element);
    this.measure();
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this.element);
    this.target.addEventListener('pointerenter', event => this.move(event));
    this.target.addEventListener('pointermove', event => this.move(event));
    this.target.addEventListener('pointerleave', () => this.hide());
    this.target.addEventListener('pointercancel', () => this.hide());
    addEventListener('scroll', () => this.hide(), {passive: true});
    addEventListener('resize', () => { this.hide(); this.measure(); }, {passive: true});
    addEventListener('blur', () => this.hide());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.hide(); });
    document.addEventListener('focusin', event => {
      if (event.target.closest('dialog')) this.hide();
    });
    this.media.addEventListener('change', () => this.hide());
  }

  measure() {
    const rect = this.element.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
  }

  move(event) {
    if (event.pointerType === 'touch' || !this.media.matches
      || this.target.closest('[inert]') || document.querySelector('dialog[open]')) {
      this.hide();
      return;
    }
    this.point = {x: event.clientX, y: event.clientY};
    if (!this.frame) this.frame = requestAnimationFrame(() => this.render());
  }

  render() {
    this.frame = 0;
    if (!this.point) return;
    // Keep the formula legible at the bottom/right edge, where the phrase sits.
    // The blur halo may extend beyond the viewport; it has no visible boundary.
    const margin = 12;
    const x = Math.max(this.width/2 + margin, Math.min(innerWidth - this.width/2 - margin, this.point.x));
    const y = Math.max(this.height/2 + margin, Math.min(innerHeight - this.height/2 - margin, this.point.y));
    this.element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    this.element.classList.add('is-visible');
    this.target.classList.add('is-formula-active');
  }

  hide() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.point = null;
    this.element.classList.remove('is-visible');
    this.target.classList.remove('is-formula-active');
  }
}
