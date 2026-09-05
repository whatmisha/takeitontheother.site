const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class ZoomPanManager {
    constructor(container, surface, display, { width = 480, height = 480 } = {}) {
        this.container = container;
        this.surface = surface;
        this.display = display;
        this.surfaceWidth = width;
        this.surfaceHeight = height;
        this.zoom = 1;
        this.fitZoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.spaceDown = false;
        this.drag = null;
        this.bind();
        this.fit();
    }

    bind() {
        this.container.addEventListener('wheel', (event) => {
            event.preventDefault();
            const factor = Math.exp(-event.deltaY * 0.002);
            this.setZoom(this.zoom * factor, { clientX: event.clientX, clientY: event.clientY });
        }, { passive: false });

        window.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !this.isInput(event.target)) this.spaceDown = true;
        });
        window.addEventListener('keyup', (event) => {
            if (event.code === 'Space') this.spaceDown = false;
        });
        this.container.addEventListener('pointerdown', (event) => {
            if (!(event.button === 1 || this.spaceDown)) return;
            event.preventDefault();
            this.drag = {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                panX: this.panX,
                panY: this.panY
            };
            this.container.setPointerCapture(event.pointerId);
        });
        this.container.addEventListener('pointermove', (event) => {
            if (!this.drag || this.drag.id !== event.pointerId) return;
            this.panX = this.drag.panX + event.clientX - this.drag.startX;
            this.panY = this.drag.panY + event.clientY - this.drag.startY;
            this.apply();
        });
        const finish = (event) => {
            if (!this.drag || this.drag.id !== event.pointerId) return;
            this.drag = null;
            this.container.releasePointerCapture?.(event.pointerId);
        };
        this.container.addEventListener('pointerup', finish);
        this.container.addEventListener('pointercancel', finish);
        this.display?.addEventListener('click', () => this.fit());
        window.addEventListener('resize', () => this.fit());
    }

    isInput(target) {
        return target instanceof Element && Boolean(target.closest('input, textarea, select, button, [contenteditable="true"]'));
    }

    fit() {
        const panelReserve = window.innerWidth > 900 ? 680 : 80;
        const width = Math.max(220, window.innerWidth - panelReserve);
        const height = Math.max(220, window.innerHeight - 150);
        this.fitZoom = Math.min(1, width / this.surfaceWidth, height / this.surfaceHeight);
        this.zoom = this.fitZoom;
        this.panX = 0;
        this.panY = 0;
        this.apply();
    }

    setSurfaceSize(width, height, { fit = true } = {}) {
        if (width === this.surfaceWidth && height === this.surfaceHeight) return;
        this.surfaceWidth = width;
        this.surfaceHeight = height;
        if (fit) this.fit();
        else this.apply();
    }

    setZoom(next, origin) {
        const oldZoom = this.zoom;
        this.zoom = clamp(next, this.fitZoom * 0.35, 8);
        if (origin && oldZoom > 0) {
            const rect = this.container.getBoundingClientRect();
            const x = origin.clientX - rect.left - rect.width / 2 - this.panX;
            const y = origin.clientY - rect.top - rect.height / 2 - this.panY;
            const ratio = this.zoom / oldZoom;
            this.panX -= x * (ratio - 1);
            this.panY -= y * (ratio - 1);
        }
        this.apply();
    }

    apply() {
        this.surface.style.width = `${this.surfaceWidth}px`;
        this.surface.style.height = `${this.surfaceHeight}px`;
        this.surface.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        if (this.display) this.display.textContent = `${Math.round(this.zoom / this.fitZoom * 100)}%`;
    }
}
