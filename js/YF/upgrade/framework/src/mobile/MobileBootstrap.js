/**
 * Opt-in responsive viewport coordinator. It owns only detection, a root class,
 * viewport CSS variables and listener disposal; app-specific mobile UI stays in
 * the tool via callbacks.
 */
export class MobileBootstrap {
    constructor(options = {}) {
        this.window = options.window || window;
        this.root = options.root || document.documentElement;
        this.query = options.query || '(max-width: 768px)';
        this.className = options.className || 'framework-mobile';
        this.onChange = options.onChange || (() => {});
        this.onViewport = options.onViewport || (() => {});
        this.syncViewportVariables = options.syncViewportVariables !== false;
        this.media = null;
        this.active = false;
        this.initialized = false;
        this._onMediaChange = () => this.update();
        this._onViewportChange = () => this.updateViewport();
    }

    init() {
        if (this.initialized) return this;
        this.media = this.window.matchMedia?.(this.query) || null;
        this.media?.addEventListener?.('change', this._onMediaChange);
        this.window.addEventListener('resize', this._onViewportChange);
        this.window.visualViewport?.addEventListener('resize', this._onViewportChange);
        this.window.visualViewport?.addEventListener('scroll', this._onViewportChange);
        this.initialized = true;
        this.update({ force: true });
        return this;
    }

    matches() {
        return this.media?.matches ?? this.window.innerWidth <= 768;
    }

    update({ force = false } = {}) {
        const next = !!this.matches();
        const changed = force || next !== this.active;
        this.active = next;
        if (this.className) this.root.classList.toggle(this.className, next);
        this.updateViewport();
        if (changed) this.onChange(next, this);
        return next;
    }

    updateViewport() {
        const viewport = this.window.visualViewport;
        const dimensions = {
            width: viewport?.width || this.window.innerWidth,
            height: viewport?.height || this.window.innerHeight,
            offsetLeft: viewport?.offsetLeft || 0,
            offsetTop: viewport?.offsetTop || 0
        };
        if (this.syncViewportVariables) {
            this.root.style.setProperty('--framework-viewport-width', `${dimensions.width}px`);
            this.root.style.setProperty('--framework-viewport-height', `${dimensions.height}px`);
            this.root.style.setProperty('--framework-viewport-offset-x', `${dimensions.offsetLeft}px`);
            this.root.style.setProperty('--framework-viewport-offset-y', `${dimensions.offsetTop}px`);
        }
        this.onViewport(dimensions, this);
        return dimensions;
    }

    destroy() {
        if (!this.initialized) return;
        this.media?.removeEventListener?.('change', this._onMediaChange);
        this.window.removeEventListener('resize', this._onViewportChange);
        this.window.visualViewport?.removeEventListener('resize', this._onViewportChange);
        this.window.visualViewport?.removeEventListener('scroll', this._onViewportChange);
        if (this.className) this.root.classList.remove(this.className);
        if (this.syncViewportVariables) {
            this.root.style.removeProperty('--framework-viewport-width');
            this.root.style.removeProperty('--framework-viewport-height');
            this.root.style.removeProperty('--framework-viewport-offset-x');
            this.root.style.removeProperty('--framework-viewport-offset-y');
        }
        this.initialized = false;
    }
}
