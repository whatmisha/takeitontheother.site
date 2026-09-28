import { tubeParameters } from '../packaging/TubeModel.js';
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
        const matrix = this.svg.getScreenCTM(), unit = matrix ? 1 / Math.hypot(matrix.a, matrix.b) : 1;
        const settings = { ...this.surfaceManager.settings.getAll(), ...layout };
        if (settings.constructionType === 'telescopic-tube') {
            const { overlap } = tubeParameters(settings);
            const rect = this.surfaceManager.getPhysicalRect('front', layout);
            const color = ColorUtils.getContrastColor(settings.boxColor);
            if (overlap > 0) {
                const area = create('g', { 'data-tube-overlap-guide': '', 'pointer-events': 'none' }, group);
                create('rect', { x: rect.x, y: rect.y, width: rect.width, height: overlap, fill: color, opacity: 0.08 }, area);
                create('line', { x1: rect.x, x2: rect.x + rect.width, y1: rect.y + overlap, y2: rect.y + overlap,
                    stroke: color, 'stroke-opacity': 0.5, 'stroke-width': 1, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke' }, area);
                create('title', {}, area).textContent = 'This area is covered by the cap when closed';
                if (overlap > 22 * unit) create('text', { x: rect.x + 8 * unit, y: rect.y + 16 * unit, fill: color,
                    opacity: 0.65, 'font-size': 12 * unit, 'font-family': 'var(--ui-font-stack)' }, area).textContent = 'Under cap';
            }
        }
        const id = this.getSelected();
        if (id && this.surfaceManager.isVisible(id)) {
            create('rect', { ...this.surfaceManager.getPhysicalRect(id, layout), class: 'surface-net-selection',
                'data-selected-surface': id, fill: 'none', stroke: ColorUtils.getContrastColor(this.surfaceManager.settings.get('boxColor')), 'stroke-width': 2,
                'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }, group);
        }
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
