import { ASSETS, alternatives, FORMS } from './assets.js';
import { clamp } from './document.js';
import { icon } from './icons.js';
import { SliderController } from '../infra/framework/src/index.js';

export class Editor {
    constructor(app, geometry, { change, nextVariant, isBusy, onSelection, signal }) {
        this.app = app; this.geometry = geometry; this.change = change; this.nextVariant = nextVariant; this.isBusy = isBusy;
        this.selected = null; this.gesture = null; this.space = false; this.mode = 'variant'; this.onSelection = onSelection;
        this.surface = app.target.canvas; this.container = app.target.container;
        const on = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal });
        on(this.surface, 'pointerdown', event => this.down(event));
        on(this.surface, 'pointermove', event => this.move(event));
        on(this.surface, 'pointerup', event => this.up(event));
        on(this.surface, 'pointercancel', () => this.cancel());
        on(this.surface, 'lostpointercapture', () => this.cancel());
        on(window, 'blur', () => { this.space = false; this.cancel(); });
        on(document, 'keydown', event => {
            if (event.target.closest('input,textarea,select,[contenteditable],dialog') || event.isComposing) return;
            if (event.code === 'Space') this.space = true;
            if (event.key === 'Escape') { this.cancel(); this.select(null); }
        });
        on(document, 'keyup', event => { if (event.code === 'Space') this.space = false; });
        const list = document.getElementById('elementList');
        on(list, 'click', event => {
            if (this.suppressLayerClick || this.isBusy()) return;
            const button = event.target.closest('button'), row = button?.closest('[data-item]');
            if (!row) return;
            if (button.dataset.action === 'pin') this.pin(row.dataset.item);
            else if (button.dataset.action === 'select') this.select(row.dataset.item);
        });
        on(list, 'pointerdown', event => this.startReorder(event));
        on(list, 'pointermove', event => this.moveReorder(event));
        on(list, 'pointerup', () => this.finishReorder(true));
        on(list, 'pointercancel', () => this.finishReorder(false));
        on(list, 'lostpointercapture', () => this.finishReorder(false));
        on(document.getElementById('variantModeBtn'), 'click', () => this.setMode('variant'));
        on(document.getElementById('moveModeBtn'), 'click', () => this.setMode('move'));
        on(document.getElementById('pinBtn'), 'click', () => this.pin());
        on(document.getElementById('unpinAllBtn'), 'click', () => this.unpinAll());
        on(document.getElementById('variantBtn'), 'click', () => this.nextVariant(this.selected));
        on(document.getElementById('backBtn'), 'click', () => this.reorder(-1));
        on(document.getElementById('frontBtn'), 'click', () => this.reorder(1));
        this.sliders = new SliderController(app.settingsStore);
        for (const key of ['scale', 'rotation']) this.sliders.initSlider(key + 'Slider', {
            valueId: key + 'Value', min: key === 'scale' ? 2.5 : -180, max: key === 'scale' ? 300 : 180, baseStep: .1, decimals: 1,
            onUpdate: value => this.transform({ [key]: value / (key === 'scale' ? 100 : 1) }, true)
        });
        for (const key of ['x', 'y']) on(document.getElementById(key + 'Input'), 'change', event => {
            if (event.target.value.trim() && Number.isFinite(Number(event.target.value))) this.transform({ [key]: Number(event.target.value) / 100 });
            else this.sync();
        });
    }

    item() { return this.app.settings.items.find(item => item.id === this.selected); }
    items() { return this.gesture?.items || this.app.settings.items; }
    select(id) { this.selected = id; this.sync(); this.onSelection?.(this.selected); this.app.render(); }

    setMode(mode) {
        this.cancel(); this.mode = mode;
        document.querySelector('.wander-wall').dataset.mode = mode;
        for (const name of ['variant', 'move']) document.getElementById(name + 'ModeBtn').setAttribute('aria-pressed', String(mode === name));
    }

    coordinates(event) {
        const rect = this.surface.getBoundingClientRect(), target = this.app.target;
        return { x: (event.clientX - rect.left - target.panX) / target.zoom, y: (event.clientY - rect.top - target.panY) / target.zoom };
    }

    handles(item) {
        const scene = this.app.settings, size = this.geometry.dimensions(item, scene), angle = item.rotation * Math.PI / 180;
        const transform = (x, y) => ({ x: item.x * scene.width + x * Math.cos(angle) - y * Math.sin(angle), y: item.y * scene.height + x * Math.sin(angle) + y * Math.cos(angle) });
        return { resize: transform(size.width / 2, size.height / 2), rotate: transform(0, -size.height / 2 - 26 / this.app.target.zoom) };
    }

    down(event) {
        if (event.button !== 0 || this.space || this.isBusy() || this.gesture) return;
        const point = this.coordinates(event), scene = this.app.settings, selected = this.item();
        let mode = 'move', hit;
        if (selected) {
            const handles = this.handles(selected), radius = (event.pointerType === 'touch' ? 20 : 12) / this.app.target.zoom;
            for (const [name, handle] of Object.entries(handles)) if (Math.hypot(point.x - handle.x, point.y - handle.y) < radius) { mode = name; hit = selected; }
        }
        if (!hit) hit = [...scene.items].reverse().find(item => this.geometry.contains(item, scene, point.x, point.y));
        if (!hit) { this.select(null); return; }
        event.preventDefault(); this.container.focus({ preventScroll: true });
        this.select(hit.id);
        const snapshot = this.app.getSnapshot();
        this.gesture = { id: event.pointerId, mode, start: point, item: { ...hit }, snapshot,
            items: snapshot.items, moved: false, clientX: event.clientX, clientY: event.clientY };
        this.surface.setPointerCapture(event.pointerId);
    }

    move(event) {
        const gesture = this.gesture;
        if (!gesture || event.pointerId !== gesture.id) return;
        if (Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) < 4 && !gesture.moved) return;
        gesture.moved = true;
        const point = this.coordinates(event), scene = gesture.snapshot, item = gesture.item;
        let changed = { ...item };
        if (gesture.mode === 'move') {
            changed.x += (point.x - gesture.start.x) / scene.width; changed.y += (point.y - gesture.start.y) / scene.height;
        } else {
            const cx = item.x * scene.width, cy = item.y * scene.height;
            if (gesture.mode === 'resize') changed.scale *= Math.hypot(point.x - cx, point.y - cy) / Math.max(1, Math.hypot(gesture.start.x - cx, gesture.start.y - cy));
            else changed.rotation += (Math.atan2(point.y - cy, point.x - cx) - Math.atan2(gesture.start.y - cy, gesture.start.x - cx)) * 180 / Math.PI;
        }
        changed.scale = clamp(changed.scale, .025, 3); changed.rotation = ((changed.rotation + 540) % 360) - 180;
        changed = this.geometry.constrain(changed, scene);
        gesture.items = scene.items.map(old => old.id === item.id ? changed : old);
        this.app.render();
    }

    up(event) {
        const gesture = this.gesture;
        if (!gesture || event.pointerId !== gesture.id) return;
        this.gesture = null;
        if (this.surface.hasPointerCapture(event.pointerId)) this.surface.releasePointerCapture(event.pointerId);
        if (gesture.moved) this.change({ ...gesture.snapshot, items: gesture.items }, 'Transform element');
        else if (gesture.mode === 'move' && this.mode === 'variant') this.nextVariant(gesture.item.id);
        this.app.render();
    }

    cancel() { this.finishReorder(false); if (this.gesture) { this.gesture = null; this.app.render(); } }

    transform(patch, continuous = false) {
        const item = this.item(); if (!item || this.isBusy()) return;
        const next = this.geometry.constrain({ ...item, ...patch }, this.app.settings);
        const items = this.app.settings.items.map(old => old.id === item.id ? next : old);
        if (continuous) { this.app.settingsStore.set('items', items); this.sync(); }
        else this.change({ ...this.app.getSnapshot(), items }, 'Transform element');
    }

    pin(id = this.selected) {
        const item = this.app.settings.items.find(entry => entry.id === id); if (!item || this.isBusy()) return;
        this.change({ ...this.app.getSnapshot(), items: this.app.settings.items.map(old => old.id === item.id ? { ...old, pinned: !old.pinned } : old) }, 'Pin element');
    }

    unpinAll() {
        if (this.isBusy()) return;
        this.change({ ...this.app.getSnapshot(), items: this.app.settings.items.map(item => ({ ...item, pinned: false })) }, 'Unpin all layers');
    }

    reorder(delta) {
        const items = [...this.app.settings.items], index = items.findIndex(item => item.id === this.selected);
        if (index < 0 || this.isBusy()) return;
        const target = clamp(index + delta, 0, items.length - 1);
        [items[index], items[target]] = [items[target], items[index]];
        this.change({ ...this.app.getSnapshot(), items }, 'Layer order');
    }

    startReorder(event) {
        const grip = event.target.closest('.layer-grip');
        if (!grip || event.button !== 0 || this.isBusy()) return;
        event.preventDefault();
        this.reorderGesture = { pointerId: event.pointerId, id: grip.closest('[data-item]').dataset.item, x: event.clientX, y: event.clientY, startY: event.clientY, moved: false };
        document.getElementById('elementList').setPointerCapture(event.pointerId);
    }

    moveReorder(event) {
        const g = this.reorderGesture;
        if (!g || g.pointerId !== event.pointerId) return;
        g.x = event.clientX; g.y = event.clientY;
        if (!g.moved && Math.abs(g.y - g.startY) < 5) return;
        event.preventDefault();
        if (!g.moved) { g.moved = true; this.scrollReorder(); }
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
        if (list.hasPointerCapture(g.pointerId)) list.releasePointerCapture(g.pointerId);
        this.reorderTarget();
        if (!g.moved) return;
        this.suppressLayerClick = true; setTimeout(() => { this.suppressLayerClick = false; }, 0);
        if (!commit || !g.target || this.isBusy()) return;
        const frontToBack = [...this.app.settings.items].reverse(), from = frontToBack.findIndex(item => item.id === g.id);
        const [item] = frontToBack.splice(from, 1), to = frontToBack.findIndex(item => item.id === g.target);
        frontToBack.splice(to + (g.placement === 'after' ? 1 : 0), 0, item);
        this.selected = item.id;
        this.change({ ...this.app.getSnapshot(), items: frontToBack.reverse() }, 'Reorder layers');
    }

    nudge(x, y) {
        const item = this.item(); if (item) this.transform({ x: item.x + x / this.app.settings.width, y: item.y + y / this.app.settings.height });
    }

    sync() {
        const scene = this.app.settings, item = this.item();
        if (!item) this.selected = null;
        const list = document.getElementById('elementList');
        const signature = scene.items.map(entry => `${entry.id}:${entry.asset}:${entry.pinned}`).join('|');
        if (signature !== this.listSignature) {
            this.listSignature = signature;
            const scroll = list.scrollTop, focused = document.activeElement, focusId = focused?.closest('[data-item]')?.dataset.item, focusAction = focused?.dataset.action;
            list.replaceChildren(...[...scene.items].reverse().map(entry => {
                const row = document.createElement('div'); row.className = 'layer-row ui-list-row'; row.dataset.item = entry.id; row.setAttribute('role', 'listitem');
                const action = (name, title, glyph) => {
                    const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-icon-button'; button.dataset.action = name;
                    button.setAttribute('aria-label', title); button.title = title; button.append(icon(glyph, 16)); return button;
                };
                const label = entry.kind === 'letter' ? 'Letter ' + entry.letter + ' ' + (entry.index + 1) : ASSETS[entry.asset].name + ' ' + (entry.index + 1);
                const grip = action('reorder', 'Reorder ' + label, 'grip'); grip.classList.add('layer-grip');
                const button = document.createElement('button'); button.type = 'button'; button.className = 'layer-select ui-list-select'; button.dataset.action = 'select';
                button.setAttribute('aria-label', 'Select ' + label);
                const image = document.createElement('img'); image.src = ASSETS[entry.asset].src; image.alt = ''; image.draggable = false;
                const text = document.createElement('span'); text.className = 'layer-label';
                const title = document.createElement('span'); title.className = 'ui-list-title'; title.textContent = label;
                const state = document.createElement('span'); state.className = 'ui-meta'; state.textContent = entry.pinned ? 'Pinned' : 'Auto';
                text.append(title, state); button.append(image, text);
                const pin = action('pin', (entry.pinned ? 'Unpin ' : 'Pin ') + label, 'pin'); pin.setAttribute('aria-pressed', String(entry.pinned));
                row.append(grip, button, pin); return row;
            }));
            list.scrollTop = scroll;
            if (focusId && focusAction) [...list.children].find(row => row.dataset.item === focusId)?.querySelector(`[data-action="${focusAction}"]`)?.focus({ preventScroll: true });
        }
        for (const row of list.children) {
            row.classList.toggle('is-selected', row.dataset.item === this.selected);
            row.querySelector('.layer-select').setAttribute('aria-pressed', String(row.dataset.item === this.selected));
            for (const button of row.querySelectorAll('button')) button.disabled = this.isBusy();
        }
        document.getElementById('elementCount').textContent = scene.items.length;
        const pins = scene.items.filter(item => item.pinned).length;
        document.getElementById('pinCount').textContent = pins + ' pinned';
        document.getElementById('unpinAllBtn').disabled = !pins || this.isBusy();
        document.getElementById('selectionPanel').hidden = !item;
        document.getElementById('selectionTab').disabled = !item;
        document.querySelector('.wander-wall').dataset.selection = String(!!item);
        if (!item) this.onSelection?.(null);
        if (!item) return;
        document.getElementById('selectionName').textContent = item.kind === 'letter' ? 'Letter ' + item.letter : ASSETS[item.asset].name;
        const variants = item.kind === 'letter' ? alternatives(item.letter) : FORMS.map(form => form.id);
        document.getElementById('variantNumber').textContent = `Variant ${variants.indexOf(item.asset) + 1} / ${variants.length}`;
        document.getElementById('pinBtn').setAttribute('aria-pressed', String(item.pinned));
        document.getElementById('pinBtn').title = item.pinned ? 'Unpin element' : 'Pin element';
        document.getElementById('pinBtn').setAttribute('aria-label', document.getElementById('pinBtn').title);
        document.getElementById('pinBtn').disabled = this.isBusy();
        const index = scene.items.indexOf(item);
        document.getElementById('backBtn').disabled = index === 0;
        document.getElementById('frontBtn').disabled = index === scene.items.length - 1;
        for (const key of ['scale', 'rotation']) {
            this.sliders.setDisplayValue(key + 'Slider', item[key] * (key === 'scale' ? 100 : 1));
        }
        for (const key of ['x', 'y']) document.getElementById(key + 'Input').value = (item[key] * 100).toFixed(1);
        document.getElementById('selectionFieldset').disabled = this.isBusy();
    }

    draw(ctx) {
        const scene = this.app.settings, item = this.items().find(entry => entry.id === this.selected);
        if (!item) return;
        const size = this.geometry.dimensions(item, scene), zoom = this.app.target.zoom, angle = item.rotation * Math.PI / 180;
        ctx.save(); ctx.translate(item.x * scene.width, item.y * scene.height); ctx.rotate(angle);
        ctx.lineWidth = 1 / zoom; ctx.strokeStyle = '#fff'; ctx.shadowColor = '#0009'; ctx.shadowBlur = 2 / zoom;
        ctx.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height);
        ctx.beginPath(); ctx.moveTo(0, -size.height / 2); ctx.lineTo(0, -size.height / 2 - 26 / zoom); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -size.height / 2 - 26 / zoom, 5 / zoom, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(size.width / 2 - 5 / zoom, size.height / 2 - 5 / zoom, 10 / zoom, 10 / zoom);
        ctx.restore();
    }
}
