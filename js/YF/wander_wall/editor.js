import { ASSETS, alternatives, FORMS } from './assets.js';
import { clamp } from './document.js';
import { icon } from './icons.js';

export class Editor {
    constructor(app, geometry, { change, nextVariant, isBusy, signal }) {
        this.app = app; this.geometry = geometry; this.change = change; this.nextVariant = nextVariant; this.isBusy = isBusy;
        this.selected = null; this.gesture = null; this.space = false;
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
        on(document.getElementById('elementList'), 'click', event => {
            const button = event.target.closest('[data-item]');
            if (button && !this.isBusy()) this.select(button.dataset.item);
        });
        on(document.getElementById('pinBtn'), 'click', () => this.pin());
        on(document.getElementById('variantBtn'), 'click', () => this.nextVariant(this.selected));
        on(document.getElementById('backBtn'), 'click', () => this.reorder(-1));
        on(document.getElementById('frontBtn'), 'click', () => this.reorder(1));
        for (const key of ['scale', 'rotation']) on(document.getElementById(key + 'Slider'), 'input', event => this.transform({ [key]: Number(event.target.value) / (key === 'scale' ? 100 : 1) }, true));
        for (const key of ['x', 'y']) on(document.getElementById(key + 'Input'), 'change', event => {
            if (event.target.value.trim() && Number.isFinite(Number(event.target.value))) this.transform({ [key]: Number(event.target.value) / 100 });
            else this.sync();
        });
    }

    item() { return this.app.settings.items.find(item => item.id === this.selected); }
    items() { return this.gesture?.items || this.app.settings.items; }
    select(id) { this.selected = id; this.sync(); this.app.render(); }

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
        let changed = { ...item, pinned: true };
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
        else if (gesture.mode === 'move') this.nextVariant(gesture.item.id);
        this.app.render();
    }

    cancel() { if (this.gesture) { this.gesture = null; this.app.render(); } }

    transform(patch, continuous = false) {
        const item = this.item(); if (!item || this.isBusy()) return;
        const next = this.geometry.constrain({ ...item, ...patch, pinned: true }, this.app.settings);
        const items = this.app.settings.items.map(old => old.id === item.id ? next : old);
        if (continuous) { this.app.settingsStore.set('items', items); this.sync(); }
        else this.change({ ...this.app.getSnapshot(), items }, 'Transform element');
    }

    pin() {
        const item = this.item(); if (!item || this.isBusy()) return;
        this.change({ ...this.app.getSnapshot(), items: this.app.settings.items.map(old => old.id === item.id ? { ...old, pinned: !old.pinned } : old) }, 'Pin element');
    }

    reorder(delta) {
        const items = [...this.app.settings.items], index = items.findIndex(item => item.id === this.selected);
        if (index < 0 || this.isBusy()) return;
        const target = clamp(index + delta, 0, items.length - 1);
        [items[index], items[target]] = [items[target], items[index]];
        this.change({ ...this.app.getSnapshot(), items }, 'Layer order');
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
            list.replaceChildren(...scene.items.filter(entry => entry.kind === 'letter').sort((a, b) => a.index - b.index).concat(scene.items.filter(entry => entry.kind === 'form')).map(entry => {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'element-thumb'; button.dataset.item = entry.id;
                const label = entry.kind === 'letter' ? entry.letter + ' ' + (entry.index + 1) : ASSETS[entry.asset].name;
                button.setAttribute('aria-label', 'Select ' + label); button.title = label;
                const image = document.createElement('img'); image.src = ASSETS[entry.asset].src; image.alt = ''; image.draggable = false;
                button.append(image);
                if (entry.pinned) button.append(icon('pin', 10));
                return button;
            }));
        }
        for (const button of list.children) { button.setAttribute('aria-pressed', String(button.dataset.item === this.selected)); button.disabled = this.isBusy(); }
        document.getElementById('elementCount').textContent = scene.items.length;
        document.getElementById('selectionControls').hidden = !item;
        if (!item) return;
        document.getElementById('selectionName').textContent = item.kind === 'letter' ? 'Letter ' + item.letter : ASSETS[item.asset].name;
        const variants = item.kind === 'letter' ? alternatives(item.letter) : FORMS.map(form => form.id);
        document.getElementById('variantNumber').textContent = `${variants.indexOf(item.asset) + 1} / ${variants.length}`;
        document.getElementById('pinBtn').setAttribute('aria-pressed', String(item.pinned));
        document.getElementById('pinBtn').title = item.pinned ? 'Unpin element' : 'Pin element';
        document.getElementById('pinBtn').setAttribute('aria-label', document.getElementById('pinBtn').title);
        for (const key of ['scale', 'rotation']) {
            const value = Math.round(item[key] * (key === 'scale' ? 100 : 1));
            document.getElementById(key + 'Slider').value = value;
            document.getElementById(key + 'Value').textContent = value + (key === 'scale' ? '%' : '\u00b0');
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
