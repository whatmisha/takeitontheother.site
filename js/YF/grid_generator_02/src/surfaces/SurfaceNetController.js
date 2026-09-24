import { ColorUtils } from '../framework/FrameworkAdapter.js?layout=root-infra-1';
import { surfaceAdditions } from '../packaging/SurfaceAddition.js';
import { DOMUtils } from '../utils/DOMUtils.js';

/** Editor-only overlays. Export and preview artwork use their own clean builders. */
export class SurfaceNetController {
    constructor({ svg, surfaceManager, getLayout, getSelected, onSelect, onAdd, isPanning }) {
        Object.assign(this, { svg, surfaceManager, getLayout, getSelected, onSelect, onAdd, isPanning });
        this.abort = new AbortController();
        const canvas = svg.parentElement;
        const listen = (type, handler) => canvas.addEventListener(type, handler, { signal: this.abort.signal });
        listen('mousedown', event => { if (event.target.closest('[data-net-add]')) event.stopPropagation(); });
        listen('pointerdown', event => {
            this.start = event.button === 0 && !isPanning() && !event.target.closest('[data-block-id], [id^="text-group-"]')
                ? { x: event.clientX, y: event.clientY } : null;
        });
        listen('click', event => {
            const start = this.start;
            this.start = null;
            const add = event.target.closest('[data-net-add]');
            if (add) { event.stopPropagation(); onAdd(add.dataset.netAdd); return; }
            if (!start || isPanning() || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
            const matrix = svg.getScreenCTM();
            if (!matrix) return;
            const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
            const id = surfaceManager.surfaceAtPoint(point, getLayout());
            onSelect(id);
        });
        listen('keydown', event => {
            const add = event.target.closest('[data-net-add]');
            if (add && ['Enter', ' '].includes(event.key)) {
                event.preventDefault(); event.stopPropagation(); onAdd(add.dataset.netAdd);
            }
        });
        // SVG viewBox changes on pan/zoom. Keep handles a stable size on screen.
        this.observer = new MutationObserver(() => this.draw());
        this.observer.observe(svg, { attributes: true, attributeFilter: ['viewBox', 'style', 'width', 'height'] });
    }
    draw() {
        this.svg.querySelector('[data-surface-overlay]')?.remove();
        const layout = this.getLayout();
        if (!layout) return;
        const create = (type, attrs, parent) => DOMUtils.createSVGElement(type, attrs, parent);
        const group = create('g', { 'data-surface-overlay': '', class: 'surface-net-overlay' }, this.svg);
        const id = this.getSelected();
        if (id && this.surfaceManager.isVisible(id)) {
            create('rect', { ...this.surfaceManager.getPhysicalRect(id, layout), class: 'surface-net-selection',
                'data-selected-surface': id, fill: 'none', stroke: ColorUtils.getContrastColor(this.surfaceManager.settings.get('boxColor')), 'stroke-width': 2,
                'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }, group);
        }
        const matrix = this.svg.getScreenCTM(), unit = matrix ? 1 / Math.hypot(matrix.a, matrix.b) : 1;
        const candidates = surfaceAdditions({ ...this.surfaceManager.settings.getAll(), ...layout }, id => this.surfaceManager.isVisible(id));
        for (const item of candidates) {
            if (item.restore) create('rect', { ...item.rect, class: 'surface-net-placeholder', 'fill-opacity': 0.035,
                'stroke-width': 1, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }, group);
            const label = `+ ${item.name}`, width = Math.max(90, label.length * 8 + 30);
            const button = create('g', { 'data-net-add': item.id, role: 'button', tabindex: 0, class: 'surface-net-add',
                'aria-label': `${item.restore ? 'Restore' : 'Add'} ${item.name}`,
                transform: `translate(${item.anchor.x},${item.anchor.y + (item.outside || 0) * 26 * unit}) scale(${unit})` }, group);
            create('rect', { x: -width / 2, y: -18, width, height: 36, rx: 18 }, button);
            create('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, button).textContent = label;
        }
    }
    dispose() { this.abort.abort(); this.observer.disconnect(); this.svg.querySelector('[data-surface-overlay]')?.remove(); }
}
