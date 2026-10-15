// UI-only preferences: never part of a tool document, preset or undo history.
const owners = new WeakMap();
const BOTTOM = {
    wordplayer: ['ditherPanel', 'formsPanel'], keyboarder: ['typePanel', 'legendPanel', 'colorsPanel'],
    grainy_land: ['layersPanel', 'animationPanel'], wander_wall: ['backgroundPanel']
};
// Only explicitly linked columns share a height budget. Freely dragged windows
// leave these groups; unrelated windows are never repositioned by this controller.
const COLUMNS = {
    wordplayer: [['textPanel', 'ditherPanel', 'formsPanel']],
    grainy_land: [['canvasPanel', 'compositionPanel', 'animationPanel'], ['materialPanel', 'layersPanel']],
    wander_wall: [['generalPanel', 'compositionPanel'], ['elementsPanel', 'backgroundPanel']],
    random_lines_generator: [['random_lines_generator-panel-2', 'random_lines_generator-panel-1']],
    rays_pattern_generator: [['rays_pattern_generator-panel-2', 'rays_pattern_generator-panel-1']]
};

export function panelPreferenceKey(pathname) {
    const parts = String(pathname).split('/').filter(Boolean);
    if (parts.at(-1) === 'index.html') parts.pop();
    return `yf:panel-heights:v1:${parts.at(-1) || 'tools'}`;
}

export function readPanelHeights(storage, key) {
    try {
        const data = JSON.parse(storage?.getItem(key) || '{}');
        return new Map(Object.entries(data || {}).filter(([id, height]) =>
            !['__proto__', 'constructor', 'prototype'].includes(id) &&
            typeof height === 'number' && Number.isFinite(height) && height >= 48 && height <= 100000));
    } catch { return new Map(); }
}

export function readPanelPriority(storage, key) {
    try {
        const id = JSON.parse(storage?.getItem(key) || '{}')?.$active;
        return typeof id === 'string' ? id : undefined;
    } catch { return undefined; }
}

export function clampPanelHeight(height, min, max) {
    return Math.round(Math.min(Math.max(height, Math.min(min, max)), Math.max(0, max)));
}

// Prioritize the actively resized panel, then preserve other requested sizes as
// far as the viewport allows. Callers reserve the full automatic height of
// compact neighbors; only genuinely scrollable members can give up content area.
export function fitPanelColumn(items, available, active = -1) {
    const space = Math.max(0, available);
    let minima = items.map(item => item.min);
    const minSum = minima.reduce((a, b) => a + b, 0);
    if (minSum > space) {
        const fixedSum = items.reduce((sum, item) => sum + (item.fixed ? item.min : 0), 0);
        // A native stack can leave less than 80 px for the scrollable member.
        // Its preferred minimum must not steal space from a fitting neighbor.
        minima = fixedSum <= space && minSum > fixedSum
            ? minima.map((min, i) => items[i].fixed ? min : min * (space - fixedSum) / (minSum - fixedSum))
            : minima.map(min => min * space / minSum);
    }
    const sizes = items.map((item, i) => Math.max(minima[i], item.height));
    if (active >= 0) sizes[active] = Math.min(sizes[active], space - minima.reduce((sum, min, i) => sum + (i === active ? 0 : min), 0));
    let excess = sizes.reduce((a, b) => a + b, 0) - space;
    for (const includeActive of [false, true]) {
        if (excess <= 0) break;
        const flexible = sizes.map((size, i) => i !== active || includeActive ? Math.max(0, size - minima[i]) : 0);
        const total = flexible.reduce((a, b) => a + b, 0);
        if (!total) continue;
        const take = Math.min(excess, total);
        sizes.forEach((size, i) => { sizes[i] = size - take * flexible[i] / total; });
        excess -= take;
    }
    return sizes;
}

const setData = (node, key, value) => {
    if (value == null) { if (key in node.dataset) delete node.dataset[key]; }
    else if (node.dataset[key] !== String(value)) node.dataset[key] = String(value);
};
const setPx = (node, name, value) => {
    const text = `${Math.round(value * 100) / 100}px`;
    if (node.style.getPropertyValue(name) !== text) node.style.setProperty(name, text);
};
const visible = node => node.getClientRects().length > 0 && node.getBoundingClientRect().height > 0;

export class PanelResizeController {
    constructor({ ownerDocument = globalThis.document, ownerWindow = globalThis.window } = {}) {
        this.document = ownerDocument;
        this.window = ownerWindow;
        this.panels = new Map();
        this.requested = new Map();
        this.frame = null;
        this.drag = null;
        this.bound = false;
        this.schedule = this.schedule.bind(this);
    }

    init() {
        const d = this.document, w = this.window;
        // Also makes non-browser consumers and minimal framework test doubles safe.
        if (this.bound || !d?.createElement || !w?.ResizeObserver || !w?.requestAnimationFrame) return this;
        owners.get(d)?.destroy();
        owners.set(d, this);
        this.key = panelPreferenceKey(w.location.pathname);
        this.tool = this.key.split(':').at(-1);
        try { this.storage = w.localStorage; } catch { this.storage = null; }
        this.requested = readPanelHeights(this.storage, this.key);
        this.priorityId = readPanelPriority(this.storage, this.key);
        this.cleanups = [];
        this.listen = (target, type, handler, capture = false) => {
            target.addEventListener(type, handler, capture);
            this.cleanups.push(() => target.removeEventListener(type, handler, capture));
        };
        this.resizeObserver = new w.ResizeObserver(this.schedule);
        this.mutationObserver = new w.MutationObserver(records => {
            if (records.some(record => record.target.namespaceURI !== 'http://www.w3.org/2000/svg' && (
                record.target.matches?.('.controls-panel, .controls-panel-stack') ||
                record.target.closest?.('.controls-panel') || (record.type === 'childList' &&
                    [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && node.namespaceURI !== 'http://www.w3.org/2000/svg' &&
                        (node.matches?.('.controls-panel') || node.querySelector?.('.controls-panel'))))))) this.schedule();
        });
        this.mutationObserver.observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        this.listen(d, 'pointerdown', event => this.start(event), true);
        this.listen(d, 'pointermove', event => this.move(event), true);
        this.listen(d, 'pointerup', event => this.finish(event), true);
        this.listen(d, 'pointercancel', event => this.finish(event, true), true);
        this.listen(d, 'lostpointercapture', event => this.finish(event, true), true);
        this.listen(d, 'dblclick', event => this.resetEvent(event), true);
        this.listen(d, 'keydown', event => this.keydown(event), true);
        this.listen(d, 'click', event => { if (event.target.closest?.('.ui-panel-resize-handle')) this.consume(event); }, true);
        this.listen(w, 'resize', this.schedule);
        this.listen(w, 'blur', () => this.finish(null, true));
        this.pointerMedia = w.matchMedia('(hover: hover) and (pointer: fine)');
        this.listen(this.pointerMedia, 'change', this.schedule);
        this.bound = true;
        this.sync();
        return this;
    }

    desktop() {
        return this.pointerMedia.matches && this.window.innerWidth >= (this.tool === 'grainy_land' ? 1200 : 769) &&
            !(this.tool === 'wander_wall' && this.window.innerWidth <= 1000 && this.window.innerHeight <= 600);
    }

    schedule() {
        if (!this.bound || this.frame != null) return;
        this.frame = this.window.requestAnimationFrame(() => { this.frame = null; this.sync(); });
    }

    scan() {
        for (const panel of this.document.querySelectorAll('.controls-panel')) {
            const body = panel.querySelector(':scope > .panel-content');
            const header = panel.querySelector(':scope > .panel-header');
            if (!panel.id || !body || !header || this.panels.has(panel)) continue;
            const handle = this.document.createElement('div');
            handle.className = 'ui-panel-resize-handle';
            handle.hidden = true;
            handle.tabIndex = 0;
            handle.setAttribute('role', 'separator');
            handle.setAttribute('aria-orientation', 'horizontal');
            handle.setAttribute('aria-label', `Resize ${header.querySelector('span')?.firstChild?.textContent?.trim() || 'panel'} height`);
            handle.setAttribute('aria-controls', panel.id);
            panel.append(handle);
            const scroller = body.querySelector('.layer-list, .layers-list');
            const state = { panel, body, header, handle, scroller, eligible: false, observed: new Set() };
            this.panels.set(panel, state);
        }
        for (const [panel, state] of this.panels) {
            if (!panel.isConnected) {
                if (this.drag?.state === state) this.finish(null, true);
                this.release(state); this.panels.delete(panel); continue;
            }
            const observed = new Set([panel, state.body, ...state.body.children, ...(state.scroller ? [state.scroller] : [])]);
            for (const node of state.observed) if (!observed.has(node)) this.resizeObserver.unobserve(node);
            for (const node of observed) if (!state.observed.has(node)) this.resizeObserver.observe(node);
            state.observed = observed;
        }
    }

    detached(state) {
        return state.panel.dataset.panelPosition === 'manual' ||
            (state.panel.style.top && state.panel.style.top !== 'auto' && state.panel.style.bottom === 'auto');
    }

    bottom(state) {
        if (state.panel.closest('.controls-panel-stack') || this.detached(state) || state.panel.matches('.ui-simple #legendPanel')) return false;
        return BOTTOM[this.tool]?.includes(state.panel.id) ||
            state.panel.matches('.controls-panel-text, .controls-panel-effects, .controls-panel-presets, .controls-panel-random, .elements-navigator');
    }

    intrinsic(state) {
        if (state.naturalHeight != null) return state.naturalHeight;
        const rect = state.panel.getBoundingClientRect();
        const overflow = Math.max(0, state.body.scrollHeight - state.body.clientHeight,
            state.scroller ? state.scroller.scrollHeight - state.scroller.clientHeight : 0);
        return Math.max(state.header.getBoundingClientRect().height, rect.height + overflow);
    }

    minimum(state) {
        // Keep non-scrolling Layers actions visible; only the list gives up space.
        const fixed = state.scroller ? Math.max(0, state.body.clientHeight - state.scroller.clientHeight) : 0;
        return state.header.getBoundingClientRect().height + fixed + 80;
    }

    measureAutomatic(state) {
        // Called only after ALL controller sizing/position attributes are removed.
        // Never learn eligibility from overflow caused by our own column layout.
        const overflow = Math.max(0, state.body.scrollHeight - state.body.clientHeight,
            state.scroller ? state.scroller.scrollHeight - state.scroller.clientHeight : 0);
        state.autoOverflow = overflow > 1;
        state.naturalHeight = state.panel.getBoundingClientRect().height + overflow;
        state.eligible ||= state.autoOverflow || this.requested.has(state.panel.id);
        state.min = this.minimum(state);
    }

    columnItem(state) {
        if (state.panel.classList.contains('panel-collapsed')) return { height: 47, min: 47, fixed: true };
        const preferred = this.requested.get(state.panel.id);
        const natural = this.intrinsic(state);
        // A previous visit to a short viewport may have made a compact panel
        // eligible. That alone does not permit its neighbor to squash it now.
        const flexible = state.autoOverflow || preferred != null;
        return { height: preferred ?? natural, min: flexible ? Math.min(state.min, natural) : natural, fixed: !flexible };
    }

    sync() {
        if (!this.bound) return;
        this.scan();
        const enabled = this.desktop();
        if (!enabled && this.drag) this.finish(null, true);
        // Measure the native layout in one synchronous, unpainted batch. This
        // also handles content changes, reloads with saved heights and reset;
        // cached heights from a previously squeezed layout would be unreliable.
        const scrollPositions = [];
        for (const state of this.panels.values()) {
            for (const node of [state.body, state.scroller].filter(Boolean)) scrollPositions.push([node, node.scrollTop]);
            for (const key of ['uiPanelHeight', 'uiGroupHeight', 'uiGroupAnchor']) setData(state.panel, key, null);
        }
        for (const state of this.panels.values()) {
            const { panel, handle } = state;
            state.group = null;
            state.open = enabled && visible(panel) && !panel.classList.contains('panel-collapsed');
            setData(panel, 'uiResizeManaged', enabled ? '' : null);
            setData(panel, 'uiResizeUnbounded', enabled && (this.tool === 'wander_bender' || this.tool === 'label_generator' || (this.tool === 'wordplayer' && panel.id === 'formsPanel')) ? '' : null);
            setData(panel, 'uiResizeList', enabled && state.scroller ? '' : null);
            if (!state.open) {
                if (this.drag?.state === state) this.finish(null, true);
                handle.hidden = true; continue;
            }
            state.anchor = this.bottom(state) ? 'bottom' : 'top';
            const rect = panel.getBoundingClientRect();
            state.max = Math.max(47, state.anchor === 'bottom' ? rect.bottom - 20 : this.window.innerHeight - rect.top - 20);
            setPx(panel, '--ui-panel-limit', state.max);
            this.measureAutomatic(state);
            setData(handle, 'edge', state.anchor === 'bottom' ? 'top' : 'bottom');
        }
        const grouped = enabled ? this.layoutGroups() : new Set();
        for (const state of this.panels.values()) {
            const { panel, handle } = state;
            if (!grouped.has(state)) {
                setData(panel, 'uiGroupHeight', null);
                setData(panel, 'uiGroupAnchor', null);
            }
            const preferred = this.requested.get(panel.id);
            setData(panel, 'uiPanelHeight', enabled && preferred != null ? '' : null);
            if (state.open && preferred != null && !grouped.has(state)) {
                const maximum = Math.min(state.max, this.intrinsic(state));
                setPx(panel, '--ui-panel-height', clampPanelHeight(preferred, state.min, maximum));
            }
            handle.hidden = !state.open || !state.eligible;
            if (!handle.hidden) {
                handle.setAttribute('aria-valuemin', String(Math.round(Math.min(state.min, state.max))));
                handle.setAttribute('aria-valuemax', String(Math.round(state.max)));
                handle.setAttribute('aria-valuenow', String(Math.round(panel.getBoundingClientRect().height)));
            }
        }
        // Measuring an expanded automatic body can clamp its scroll position.
        // Restore it after reapplying the requested layout, not during measurement.
        for (const [node, top] of scrollPositions) if (node.scrollTop !== top) node.scrollTop = top;
    }

    layoutGroups() {
        const groups = [], grouped = new Set();
        for (const stack of this.document.querySelectorAll('.controls-panel-stack')) {
            const states = [...stack.children].map(panel => this.panels.get(panel)).filter(state => state && visible(state.panel));
            const style = this.window.getComputedStyle(stack), top = stack.getBoundingClientRect().top;
            groups.push({ states, top, bottom: Math.min(this.window.innerHeight - 20, top + (parseFloat(style.maxHeight) || Infinity)), gap: parseFloat(style.rowGap) || 4, dom: true });
        }
        for (const ids of COLUMNS[this.tool] || []) {
            const states = ids.map(id => this.panels.get(this.document.getElementById(id))).filter(state => state && visible(state.panel) && !this.detached(state));
            if (states.length < 2) continue;
            const top = this.tool.includes('_lines_') || this.tool === 'rays_pattern_generator' ? 76 : 20;
            const bottom = this.window.innerHeight - (this.tool === 'wordplayer' ? 74 : this.tool.includes('_lines_') || this.tool === 'rays_pattern_generator' ? 88 : 20);
            const gaps = states.slice(0, -1).map(state => this.tool === 'grainy_land' ? (state.panel.id === 'canvasPanel' ? 4 : 20) : this.tool === 'wander_wall' ? 20 : 12);
            groups.push({ states, top, bottom, gaps, dom: false });
        }
        for (const group of groups) {
            const { states, top, bottom } = group;
            const gaps = group.gaps || states.slice(0, -1).map(() => group.gap);
            const available = Math.max(0, bottom - top - gaps.reduce((sum, gap) => sum + gap, 0));
            const items = states.map(state => this.columnItem(state));
            states.forEach((state, i) => {
                // Compute limits before the first drag/key press, not one frame
                // after it has already overfilled the column.
                state.group = group;
                state.max = Math.max(47, available - items.reduce((sum, item, j) => sum + (i === j ? 0 : item.min), 0));
            });
            if (!states.some(state => this.requested.has(state.panel.id))) continue;
            const recent = [...this.requested.keys()].reverse().map(id => states.find(state => state.panel.id === id)).find(Boolean);
            const preferred = (states.includes(this.drag?.state) && this.drag.state) || states.find(state => state.panel.id === this.priorityId) || recent;
            const active = states.indexOf(preferred);
            const sizes = fitPanelColumn(items, available, active);
            let y = top;
            states.forEach((state, i) => {
                grouped.add(state);
                setPx(state.panel, '--ui-group-height', sizes[i]);
                setData(state.panel, 'uiGroupHeight', '');
                if (!group.dom) {
                    const anchored = i === states.length - 1 && this.bottom(state);
                    setData(state.panel, 'uiGroupAnchor', anchored ? 'bottom' : 'top');
                    setPx(state.panel, '--ui-group-edge', anchored ? this.window.innerHeight - bottom : y);
                }
                y += sizes[i] + (gaps[i] || 0);
            });
        }
        return grouped;
    }

    stateFor(event) {
        const handle = event.target.closest?.('.ui-panel-resize-handle');
        return handle && !handle.hidden ? this.panels.get(handle.parentElement) : null;
    }

    consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }

    start(event) {
        const state = this.stateFor(event);
        if (!state || this.drag || !this.desktop() || event.button !== 0 || event.pointerType === 'touch') return;
        this.consume(event);
        this.drag = { state, id: event.pointerId, y: event.clientY, height: state.panel.getBoundingClientRect().height,
            previous: new Map(this.requested), previousPriority: this.priorityId, changed: false, edge: state.handle.dataset.edge };
        this.priorityId = state.panel.id;
        state.handle.setPointerCapture?.(event.pointerId);
        setData(this.document.documentElement, 'uiPanelResizing', '');
        setData(state.panel, 'uiPanelResizing', '');
    }

    move(event) {
        const drag = this.drag;
        if (!drag || event.pointerId !== drag.id) return;
        this.consume(event);
        const delta = (event.clientY - drag.y) * (drag.edge === 'top' ? -1 : 1);
        if (!drag.changed && Math.abs(delta) < 2) return;
        drag.changed = true;
        this.remember(drag.state.panel.id, clampPanelHeight(drag.height + delta, drag.state.min, drag.state.group ? drag.state.max : Math.min(drag.state.max, this.intrinsic(drag.state))));
        this.sync();
    }

    finish(event, cancel = false) {
        const drag = this.drag;
        if (!drag || (event && event.pointerId !== drag.id)) return;
        if (event) this.consume(event);
        if (cancel) {
            this.requested = drag.previous;
        } else if (drag.changed) this.save();
        if (cancel || !drag.changed) this.priorityId = drag.previousPriority;
        this.drag = null;
        if (drag.state.handle.hasPointerCapture?.(drag.id)) drag.state.handle.releasePointerCapture(drag.id);
        setData(this.document.documentElement, 'uiPanelResizing', null);
        setData(drag.state.panel, 'uiPanelResizing', null);
        this.schedule();
    }

    save() {
        try { this.storage?.setItem(this.key, JSON.stringify({ ...Object.fromEntries(this.requested), $active: this.priorityId })); } catch { /* Storage is optional. */ }
    }

    remember(id, height) {
        // Insertion order also preserves the most recent priority of *each*
        // independent stack when another stack is subsequently resized.
        this.requested.delete(id);
        this.requested.set(id, height);
    }

    reset(state) {
        this.requested.delete(state.panel.id);
        if (this.priorityId === state.panel.id) this.priorityId = undefined;
        this.save();
        this.sync();
    }

    resetEvent(event) {
        const state = this.stateFor(event);
        if (!state) return;
        this.consume(event); this.reset(state);
    }

    keydown(event) {
        if (event.key === 'Escape' && this.drag) { this.consume(event); this.finish(null, true); return; }
        const state = this.stateFor(event);
        if (!state || !['ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        this.consume(event);
        if (event.key === 'Home') { this.reset(state); return; }
        const delta = (event.key === 'ArrowDown' ? 1 : -1) * (state.handle.dataset.edge === 'top' ? -1 : 1) * (event.shiftKey ? 50 : 10);
        this.priorityId = state.panel.id;
        this.remember(state.panel.id, clampPanelHeight(state.panel.getBoundingClientRect().height + delta, state.min, state.max));
        this.save(); this.sync();
    }

    release(state) {
        state.handle.remove();
        for (const node of state.observed) this.resizeObserver.unobserve(node);
        for (const key of ['uiResizeManaged', 'uiResizeUnbounded', 'uiResizeList', 'uiPanelHeight', 'uiGroupHeight', 'uiGroupAnchor', 'uiPanelResizing']) setData(state.panel, key, null);
        for (const key of ['--ui-panel-limit', '--ui-panel-height', '--ui-group-height', '--ui-group-edge']) state.panel.style.removeProperty(key);
    }

    destroy() {
        if (!this.bound) return;
        this.finish(null, true);
        this.bound = false;
        this.window.cancelAnimationFrame(this.frame); this.frame = null;
        this.mutationObserver.disconnect(); this.resizeObserver.disconnect();
        for (const remove of this.cleanups) remove();
        for (const state of this.panels.values()) this.release(state);
        this.panels.clear();
        if (owners.get(this.document) === this) owners.delete(this.document);
    }
}
