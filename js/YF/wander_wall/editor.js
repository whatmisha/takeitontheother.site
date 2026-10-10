import { ASSETS } from './assets.js';
import { clamp } from './document.js';
import { icon } from './icons.js';
import { VariantPicker, layerName } from './variant-picker.js';
import { transformHandles, hitTransformControl, resizeFromHandle, resizeCursor } from './transform-controls.js';

const transformed = (before, after) => ['x', 'y', 'scale', 'rotation'].some(key => before[key] !== after[key]);

let rotationCursor;
function getRotationCursor() {
    if (!rotationCursor) {
        const arrow = icon('rotate', 24);
        arrow.setAttribute('stroke', '#000'); arrow.setAttribute('stroke-width', '2');
        const outline = [...arrow.children].map(node => { const copy = node.cloneNode(true); copy.setAttribute('stroke', '#fff'); copy.setAttribute('stroke-width', '4'); return copy; });
        arrow.prepend(...outline);
        rotationCursor = `url("data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(arrow))}") 12 12, crosshair`;
    }
    return rotationCursor;
}

export class Editor {
    constructor(app, geometry, { change, nextVariant, isBusy, signal }) {
        this.app = app; this.geometry = geometry; this.change = change; this.nextVariant = nextVariant; this.isBusy = isBusy;
        this.selected = null; this.gesture = null; this.space = false;
        this.variants = new VariantPicker(nextVariant, signal, () => this.app.settings.items);
        this.surface = app.target.canvas; this.container = app.target.container;
        const on = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal });
        on(this.surface, 'pointerdown', event => this.down(event));
        on(this.surface, 'pointermove', event => this.move(event));
        on(this.surface, 'pointerleave', () => { if (!this.gesture) this.surface.style.cursor = ''; });
        on(this.surface, 'pointerup', event => this.up(event));
        on(this.surface, 'dblclick', event => {
            if (this.isBusy() || this.space || performance.now() - (this.lastDrag || -Infinity) < 400) return;
            const item = this.hit(this.coordinates(event));
            if (item) { event.preventDefault(); this.select(item.id); this.nextVariant(item.id); }
        });
        on(this.surface, 'pointercancel', () => this.cancel());
        on(this.surface, 'lostpointercapture', () => { if (this.gesture) this.cancel(); });
        on(window, 'blur', () => { this.space = false; this.cancel(); });
        on(document, 'keydown', event => {
            if (event.target.closest('input,textarea,select,[contenteditable],dialog') || event.isComposing) return;
            if (event.code === 'Space') { this.space = true; this.surface.style.cursor = ''; }
            if (event.key === 'Escape') { this.cancel(); this.select(null); }
        });
        on(document, 'keyup', event => { if (event.code === 'Space') this.space = false; });
        const list = document.getElementById('elementList');
        on(list, 'click', event => {
            if (this.suppressLayerClick || this.isBusy()) return;
            const button = event.target.closest('button'), row = event.target.closest('[data-item]');
            if (!row) return;
            if (button?.dataset.action === 'pin') this.pin(row.dataset.item);
            else if (button?.dataset.action === 'visibility') this.visibility(row.dataset.item);
            else if (button?.dataset.action === 'edit' || (event.detail === 0 && button?.dataset.action === 'select')) this.edit(row.dataset.item);
            else this.select(row.dataset.item);
        });
        on(list, 'dblclick', event => {
            if (this.suppressLayerClick || this.isBusy()) return;
            const row = event.target.closest('[data-item]');
            if (!row || event.target.closest('.layer-action')) return;
            event.preventDefault(); this.edit(row.dataset.item);
        });
        on(list, 'pointerdown', event => this.startReorder(event));
        on(window, 'pointermove', event => this.moveReorder(event));
        on(window, 'pointerup', event => { if (event.pointerId === this.reorderGesture?.pointerId) this.finishReorder(true); });
        on(window, 'pointercancel', event => { if (event.pointerId === this.reorderGesture?.pointerId) this.finishReorder(false); });
        on(list, 'lostpointercapture', event => { if (event.target === list) this.finishReorder(false); });
    }

    item() { return this.app.settings.items.find(item => item.id === this.selected); }
    items() { return this.gesture?.items || this.app.settings.items; }
    select(id) { this.selected = id; this.surface.style.cursor = ''; this.sync(); this.app.render(); }
    edit(id) {
        if (this.isBusy()) return;
        this.select(id); this.variants.open(this.item());
    }

    hit(point) {
        const scene = this.app.settings;
        const selected = this.item();
        if (selected && selected.visible !== false) {
            const size = this.geometry.dimensions(selected, scene), angle = selected.rotation * Math.PI / 180;
            const dx = point.x - selected.x * scene.width, dy = point.y - selected.y * scene.height;
            const x = dx * Math.cos(angle) + dy * Math.sin(angle), y = -dx * Math.sin(angle) + dy * Math.cos(angle);
            if (Math.abs(x) <= size.width / 2 && Math.abs(y) <= size.height / 2) return selected;
        }
        const inside = point.x >= 0 && point.x <= scene.width && point.y >= 0 && point.y <= scene.height;
        return [...scene.items].reverse().find(item => (inside || item.id === this.selected) && this.geometry.contains(item, scene, point.x, point.y));
    }

    locate() {
        const item = this.item(); if (!item) return;
        const target = this.app.target, rect = this.container.getBoundingClientRect();
        target.panX = rect.width / 2 - item.x * this.app.settings.width * target.zoom;
        target.panY = rect.height / 2 - item.y * this.app.settings.height * target.zoom;
        this.app.render();
    }

    coordinates(event) {
        const rect = this.surface.getBoundingClientRect(), target = this.app.target;
        return { x: (event.clientX - rect.left - target.panX) / target.zoom, y: (event.clientY - rect.top - target.panY) / target.zoom };
    }

    handles(item) {
        const scene = this.app.settings;
        return transformHandles(item, scene, this.geometry.dimensions(item, scene));
    }

    controlAt(point, pointerType) {
        const item = this.item(), scene = this.app.settings;
        return item ? hitTransformControl(point, item, scene, this.geometry.dimensions(item, scene), this.app.target.zoom, pointerType) : null;
    }

    updateCursor(event) {
        if (this.space || this.isBusy() || (event.buttons & 4)) { this.surface.style.cursor = ''; return; }
        const point = this.coordinates(event), control = this.gesture || this.controlAt(point, event.pointerType);
        this.surface.style.cursor = control?.mode === 'rotate' ? getRotationCursor() : control?.mode === 'resize'
            ? resizeCursor(control.handle, this.item().rotation) : this.gesture || this.hit(point) ? 'move' : '';
    }

    down(event) {
        if (event.button !== 0 || this.space) { this.surface.style.cursor = ''; return; }
        if (this.isBusy() || this.gesture) return;
        const point = this.coordinates(event), control = this.controlAt(point, event.pointerType);
        const mode = control?.mode || 'move', hit = control ? this.item() : this.hit(point);
        if (!hit) { this.select(null); return; }
        event.preventDefault(); this.container.focus({ preventScroll: true });
        this.select(hit.id);
        const snapshot = this.app.getSnapshot();
        this.gesture = { id: event.pointerId, mode, handle: control?.handle, start: point, item: { ...hit }, snapshot,
            items: snapshot.items, moved: false, clientX: event.clientX, clientY: event.clientY };
        this.surface.setPointerCapture(event.pointerId);
        this.updateCursor(event);
    }

    move(event) {
        const gesture = this.gesture;
        if (!gesture) { this.updateCursor(event); return; }
        if (event.pointerId !== gesture.id) return;
        if (Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) < 4 && !gesture.moved) return;
        gesture.moved = true;
        const point = this.coordinates(event), scene = gesture.snapshot, item = gesture.item;
        let changed = { ...item };
        if (gesture.mode === 'move') {
            changed.x += (point.x - gesture.start.x) / scene.width; changed.y += (point.y - gesture.start.y) / scene.height;
        } else {
            const cx = item.x * scene.width, cy = item.y * scene.height;
            if (gesture.mode === 'resize') changed = resizeFromHandle(item, scene, this.geometry.dimensions(item, scene), gesture.handle, { x: point.x - gesture.start.x, y: point.y - gesture.start.y });
            else changed.rotation += (Math.atan2(point.y - cy, point.x - cx) - Math.atan2(gesture.start.y - cy, gesture.start.x - cx)) * 180 / Math.PI;
        }
        changed.scale = clamp(changed.scale, .025, 3); changed.rotation = ((changed.rotation + 540) % 360) - 180;
        if (transformed(item, changed)) changed.pinned = true;
        gesture.items = scene.items.map(old => old.id === item.id ? changed : old);
        this.app.render();
    }

    up(event) {
        const gesture = this.gesture;
        if (!gesture || event.pointerId !== gesture.id) return;
        this.gesture = null;
        if (this.surface.hasPointerCapture(event.pointerId)) this.surface.releasePointerCapture(event.pointerId);
        if (gesture.moved) {
            this.lastDrag = performance.now();
            if (transformed(gesture.item, gesture.items.find(item => item.id === gesture.item.id))) this.change({ ...gesture.snapshot, items: gesture.items }, 'Transform element');
        }
        this.updateCursor(event);
        this.app.render();
    }

    cancel() {
        this.finishReorder(false);
        this.surface.style.cursor = '';
        if (this.gesture) {
            const id = this.gesture.id; this.gesture = null;
            if (this.surface.hasPointerCapture(id)) this.surface.releasePointerCapture(id);
            this.app.render();
        }
    }

    transform(patch, continuous = false) {
        const item = this.item(); if (!item || this.isBusy()) return;
        const next = { ...item, ...patch };
        if (!transformed(item, next)) return;
        next.pinned = true;
        const items = this.app.settings.items.map(old => old.id === item.id ? next : old);
        if (continuous) { this.app.settingsStore.set('items', items); this.sync(); }
        else this.change({ ...this.app.getSnapshot(), items }, 'Transform element');
    }

    pin(id = this.selected) {
        const item = this.app.settings.items.find(entry => entry.id === id); if (!item || this.isBusy()) return;
        this.change({ ...this.app.getSnapshot(), items: this.app.settings.items.map(old => old.id === item.id ? { ...old, pinned: !old.pinned } : old) }, 'Pin element');
    }

    visibility(id = this.selected, visible) {
        const item = this.app.settings.items.find(entry => entry.id === id);
        if (!item || this.isBusy()) return;
        this.cancel();
        const next = { ...item, visible: visible ?? item.visible === false };
        this.change({ ...this.app.getSnapshot(), items: this.app.settings.items.map(old => old.id === id ? next : old) }, next.visible ? 'Show layer' : 'Hide layer');
    }

    showAll() {
        if (this.isBusy()) return;
        this.cancel();
        const items = this.app.settings.items.map(item => item.visible === false ? { ...item, visible: true } : item);
        this.change({ ...this.app.getSnapshot(), items }, 'Show all layers');
    }

    reorder(delta) {
        const items = [...this.app.settings.items], index = items.findIndex(item => item.id === this.selected);
        if (index < 0 || this.isBusy()) return;
        const target = clamp(index + delta, 0, items.length - 1);
        if (target === index) return;
        const [item] = items.splice(index, 1); items.splice(target, 0, { ...item, pinned: true });
        this.change({ ...this.app.getSnapshot(), items }, 'Layer order');
    }

    startReorder(event) {
        const row = event.target.closest('[data-item]');
        if (!row || event.target.closest('button:disabled') || event.button !== 0 || this.isBusy() || this.reorderGesture) return;
        this.reorderGesture = { pointerId: event.pointerId, id: row.dataset.item, x: event.clientX, y: event.clientY,
            startX: event.clientX, startY: event.clientY, moved: false };
    }

    moveReorder(event) {
        const g = this.reorderGesture;
        if (!g || g.pointerId !== event.pointerId) return;
        g.x = event.clientX; g.y = event.clientY;
        if (!g.moved && Math.hypot(g.x - g.startX, g.y - g.startY) < 5) return;
        event.preventDefault();
        if (!g.moved) {
            // Capture only after dragging starts so ordinary row/button clicks keep their target.
            const list = document.getElementById('elementList');
            g.moved = true; list.setPointerCapture(event.pointerId); list.classList.add('is-reordering');
            this.scrollReorder();
        }
        this.reorderTarget();
    }

    reorderTarget() {
        const g = this.reorderGesture, list = document.getElementById('elementList'), rect = list.getBoundingClientRect();
        for (const row of list.children) row.classList.remove('drop-before', 'drop-after', 'is-dragging');
        if (!g?.moved) return;
        g.target = null;
        [...list.children].find(row => row.dataset.item === g.id)?.classList.add('is-dragging');
        if (g.x < rect.left || g.x > rect.right || g.y < rect.top || g.y > rect.bottom) return;
        const row = [...list.children].find(row => { const r = row.getBoundingClientRect(); return g.y >= r.top && g.y < r.bottom; });
        if (!row || row.dataset.item === g.id) return;
        g.target = row.dataset.item;
        g.placement = g.y < row.getBoundingClientRect().top + row.offsetHeight / 2 ? 'before' : 'after';
        row.classList.add('drop-' + g.placement);
    }

    scrollReorder() {
        if (!this.reorderGesture?.moved) return;
        const list = document.getElementById('elementList'), rect = list.getBoundingClientRect(), g = this.reorderGesture;
        if (g.x >= rect.left && g.x <= rect.right && g.y >= rect.top && g.y <= rect.bottom) {
            list.scrollTop += g.y < rect.top + 24 ? -6 : g.y > rect.bottom - 24 ? 6 : 0;
            this.reorderTarget();
        }
        this.reorderFrame = requestAnimationFrame(() => this.scrollReorder());
    }

    finishReorder(commit) {
        const g = this.reorderGesture; if (!g) return;
        this.reorderGesture = null; cancelAnimationFrame(this.reorderFrame);
        const list = document.getElementById('elementList');
        list.classList.remove('is-reordering');
        if (list.hasPointerCapture(g.pointerId)) list.releasePointerCapture(g.pointerId);
        this.reorderTarget();
        if (!g.moved) return;
        this.suppressLayerClick = true; setTimeout(() => { this.suppressLayerClick = false; }, 0);
        if (!commit || !g.target || this.isBusy()) return;
        const frontToBack = [...this.app.settings.items].reverse(), from = frontToBack.findIndex(item => item.id === g.id);
        if (from < 0 || !frontToBack.some(item => item.id === g.target)) return;
        const [item] = frontToBack.splice(from, 1), to = frontToBack.findIndex(item => item.id === g.target);
        const target = to + (g.placement === 'after' ? 1 : 0);
        if (target === from) return;
        frontToBack.splice(target, 0, { ...item, pinned: true });
        this.selected = item.id;
        this.change({ ...this.app.getSnapshot(), items: frontToBack.reverse() }, 'Reorder layers');
    }

    nudge(x, y) {
        const item = this.item(); if (item) this.transform({ x: item.x + x / this.app.settings.width, y: item.y + y / this.app.settings.height });
    }

    sync() {
        const scene = this.app.settings;
        if (!this.item()) this.selected = null;
        const list = document.getElementById('elementList');
        const signature = scene.items.map(entry => `${entry.id}:${entry.asset}:${entry.pinned}:${entry.visible}`).join('|');
        if (signature !== this.listSignature) {
            this.listSignature = signature;
            const scroll = list.scrollTop, focused = document.activeElement, focusId = focused?.closest('[data-item]')?.dataset.item, focusAction = focused?.dataset.action;
            list.replaceChildren(...[...scene.items].reverse().map(entry => {
                const row = document.createElement('div'); row.className = 'layer-row ui-list-row'; row.dataset.item = entry.id; row.dataset.kind = entry.kind; row.setAttribute('role', 'listitem');
                const action = (name, title, glyph) => {
                    const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-icon-button layer-action'; button.dataset.action = name;
                    button.setAttribute('aria-label', title); button.title = title; button.append(icon(glyph, 16)); return button;
                };
                const label = layerName(entry);
                const button = document.createElement('button'); button.type = 'button'; button.className = 'layer-select ui-list-select'; button.dataset.action = 'select';
                button.setAttribute('aria-label', 'Select ' + label);
                button.title = 'Double-click to choose variant';
                button.setAttribute('aria-haspopup', 'dialog');
                const image = document.createElement('img'); image.src = ASSETS[entry.asset].preview || ASSETS[entry.asset].src; image.alt = ''; image.draggable = false;
                const text = document.createElement('span'); text.className = 'layer-label';
                const title = document.createElement('span'); title.className = 'ui-list-title'; title.textContent = label;
                text.append(title); button.append(image, text);
                const pin = action('pin', (entry.pinned ? 'Unpin ' : 'Pin ') + label, 'pin'); pin.setAttribute('aria-pressed', String(entry.pinned));
                const eye = action('visibility', (entry.visible === false ? 'Show ' : 'Hide ') + label, entry.visible === false ? 'hidden' : 'eye');
                eye.setAttribute('aria-pressed', String(entry.visible !== false));
                const edit = action('edit', 'Edit ' + label, 'edit'); edit.setAttribute('aria-haspopup', 'dialog');
                row.classList.toggle('is-hidden', entry.visible === false);
                row.append(button, edit, eye, pin); return row;
            }));
            list.scrollTop = scroll;
            if (focusId && focusAction) [...list.children].find(row => row.dataset.item === focusId)?.querySelector(`[data-action="${focusAction}"]`)?.focus({ preventScroll: true });
        }
        for (const row of list.children) {
            row.classList.toggle('is-selected', row.dataset.item === this.selected);
            row.querySelector('.layer-select').setAttribute('aria-pressed', String(row.dataset.item === this.selected));
            for (const button of row.querySelectorAll('button')) button.disabled = this.isBusy();
        }
        if (list.contains(document.activeElement)) document.activeElement.closest('[data-item]')?.scrollIntoView({ block: 'nearest' });
    }

    draw(ctx) {
        const scene = this.app.settings, item = this.items().find(entry => entry.id === this.selected);
        if (!item || item.visible === false) return;
        const size = this.geometry.dimensions(item, scene), zoom = this.app.target.zoom, angle = item.rotation * Math.PI / 180;
        ctx.save(); ctx.translate(item.x * scene.width, item.y * scene.height); ctx.rotate(angle);
        ctx.lineWidth = 1 / zoom; ctx.strokeStyle = '#fff'; ctx.shadowColor = '#0009'; ctx.shadowBlur = 2 / zoom;
        ctx.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height);
        ctx.fillStyle = '#fff';
        for (const { axisX, axisY } of Object.values(this.handles(item))) ctx.fillRect(axisX * size.width / 2 - 5 / zoom, axisY * size.height / 2 - 5 / zoom, 10 / zoom, 10 / zoom);
        ctx.restore();
    }
}
