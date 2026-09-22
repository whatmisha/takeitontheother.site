// Node-only characterization harness. Executes the frozen, unmodified legacy
// script with explicit DOM/Canvas/file/storage doubles; no browser or filesystem writes.
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

export const source = JSON.parse(await readFile(new URL('./legacy-source.json', import.meta.url), 'utf8'));
export const attrsOf = text => Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value]));
export const controls = [...source['index.html'].matchAll(/<input\b([^>]*)>/gu)].map(match => attrsOf(match[1]));
const classes = () => { const values = new Set(); return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) }; };
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

export function createLegacy({ script = source['script.js'], html = source['index.html'], saved = null, storageKey = 'rayPatternSettings', dpr = 1, dependencies = {} } = {}) {
    const listeners = new Map(), nodes = new Map(), downloads = [], urls = new Map(), revoked = [], log = [], timers = [];
    const storage = new Map([['rayPatternSettings', 'original sentinel']]);
    if (storageKey === 'rayPatternSettings') storage.delete(storageKey);
    if (saved) storage.set(storageKey, JSON.stringify(saved));
    let pendingImage = null, imageDecodes = 0;
    const context = { lines: [], clears: 0, state: { sx: 1, sy: 1, tx: 0, ty: 0, width: 1, cap: 'butt', color: '#000' }, stack: [],
        get strokeStyle() { return this.state.color; }, set strokeStyle(value) { this.state.color = value; },
        get lineWidth() { return this.state.width; }, set lineWidth(value) { this.state.width = value; },
        get lineCap() { return this.state.cap; }, set lineCap(value) { this.state.cap = value; },
        clearRect() { this.lines = []; this.clears++; },
        save() { this.stack.push({ ...this.state }); }, restore() { this.state = this.stack.pop(); },
        translate(x, y) { this.state.tx += x * this.state.sx; this.state.ty += y * this.state.sy; },
        scale(x, y) { this.state.sx *= x; this.state.sy *= y; }, beginPath() {},
        moveTo(x, y) { this.start = [this.state.tx + x * this.state.sx, this.state.ty + y * this.state.sy]; },
        lineTo(x, y) { this.end = [this.state.tx + x * this.state.sx, this.state.ty + y * this.state.sy]; },
        stroke() { this.lines.push({ points: [...this.start, ...this.end], width: this.state.width * this.state.sx, cap: this.state.cap, color: this.state.color }); }
    };
    function element(tagName, attrs = {}) {
        let value = attrs.value || '';
        const handlers = new Map();
        const node = { tagName: tagName.toUpperCase(), attrs: { ...attrs }, children: [], style: {}, dataset: {}, classList: classes(),
            textContent: '', checked: false, disabled: false, files: [], parentElement: null,
            get value() { return value; }, set value(next) {
                value = String(next);
                if (attrs.type === 'range') value = String(Math.max(Number(attrs.min ?? 0), Math.min(Number(attrs.max ?? 100), Number(next))));
            },
            setAttribute(key, next) { this.attrs[key] = String(next); }, getAttribute(key) { return this.attrs[key] ?? null; },
            removeAttribute(key) { delete this.attrs[key]; },
            addEventListener(type, callback) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(callback); },
            dispatch(type, extra = {}) { for (const fn of handlers.get(type) || []) fn.call(this, { target: this, preventDefault() {}, ...extra }); },
            appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
            removeChild(child) { this.children = this.children.filter(item => item !== child); },
            closest() { return this.group ||= { classList: classes() }; },
            click() { if (this.tagName === 'A') downloads.push({ name: this.download, blob: urls.get(this.href) }); else this.dispatch('click'); }
        };
        if (tagName === 'canvas') {
            node.width = Number(attrs.width || 300); node.height = Number(attrs.height || 150);
            node.getContext = () => attrs.id === 'patternCanvas' ? context : {
                drawImage() { imageDecodes++; },
                // Deliberately supplied post-decode pixels, not a claim to emulate
                // browser interpolation/image decoding. Brightness sampling is real legacy code.
                getImageData() { return pendingImage; }
            };
        }
        return node;
    }
    for (const [, tag, raw] of html.matchAll(/<(\w+)\b([^>]*\bid="[^"]+"[^>]*)>/gu)) {
        const attrs = attrsOf(raw); nodes.set(attrs.id, element(tag, attrs));
    }
    const queries = new Map(['.raster-controls-row', '.raster-sliders'].map(selector => [selector, element('div')]));
    const document = { body: element('body'), getElementById: id => nodes.get(id) || null, querySelector: selector => queries.get(selector) || null,
        addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
        createElement: tag => element(tag), createElementNS: (_, tag) => element(tag)
    };
    function serialize(node) { return `<${node.tagName.toLowerCase()}${Object.entries(node.attrs).map(([key, val]) => ` ${key}="${escape(val)}"`).join('')}>${node.children.map(serialize).join('')}</${node.tagName.toLowerCase()}>`; }
    let svg = null;
    const sandbox = { document, window: { devicePixelRatio: dpr }, navigator: { platform: 'MacIntel' }, Blob,
        // UI-free renderer harness: bind the actual action callback. Framework
        // command behavior is tested separately against ToolUiController itself.
        mountGenerator: ({ actions }) => actions.forEach(action => nodes.get(action.button).addEventListener('click', action.run)),
        connectFileInput: ({ input, onSelect, onRemove }) => {
            input.removeImage = onRemove;
            input.addEventListener('change', event => {
                const file = event.target.files[0]; event.target.value = '';
                void onSelect(file, { controller: { bound: true } });
            });
        },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, val) => storage.set(key, val), removeItem: key => storage.delete(key) },
        URL: { createObjectURL(blob) { const id = `blob:test-${urls.size}`; urls.set(id, blob); return id; }, revokeObjectURL: id => { revoked.push(id); urls.delete(id); } },
        XMLSerializer: class { serializeToString(node) { svg = node; return serialize(node); } },
        FileReader: class { readAsDataURL(file) { pendingImage = file.pixels; this.onload?.({ target: { result: 'data:image/png;base64,TEST' } }); } },
        Image: class { set src(value) { this.onload?.(); } },
        setTimeout: fn => { timers.push(fn); return timers.length; },
        alert: message => log.push(['alert', message]),
        console: { log: (...args) => log.push(args), error: (...args) => log.push(args) }
    };
    runInNewContext(script, { ...sandbox, ...dependencies }, { filename: 'rays/script.js', timeout: 5000 });
    for (const fn of listeners.get('DOMContentLoaded') || []) fn();
    return {
        nodes, context, storage, downloads, urls, revoked, log, get imageDecodes() { return imageDecodes; },
        change(id, value) { const node = nodes.get(id); if (node.attrs.type === 'checkbox') { node.checked = Boolean(value); node.dispatch('change'); }
            else { node.value = value; node.dispatch('input'); node.dispatch('change'); } },
        upload(pixels, type = 'image/png') { const input = nodes.get('imageUpload'); input.files = [{ type, pixels }]; input.value = 'same-image.png'; input.dispatch('change'); },
        restore(name) { nodes.get('settingsInput').value = name; nodes.get('restoreSettingsBtn').click(); },
        key(event) { for (const fn of listeners.get('keydown') || []) fn({ target: document.body, preventDefault() {}, ...event }); },
        flushTimers() { while (timers.length) timers.shift()(); },
        export() { nodes.get('exportSvgBtn').click(); return { svg, ...downloads.at(-1) }; }
    };
}

export function svgLines(svg) {
    const result = [];
    function visit(node, dx = 0, dy = 0) {
        if (node.attrs.transform) { const [, x, y] = node.attrs.transform.match(/translate\(([-\d.e+]+), ([-\d.e+]+)\)/u); dx += Number(x); dy += Number(y); }
        if (node.tagName === 'LINE') result.push({ points: [Number(node.attrs.x1) + dx, Number(node.attrs.y1) + dy, Number(node.attrs.x2) + dx, Number(node.attrs.y2) + dy], width: Number(node.attrs['stroke-width']), cap: node.attrs['stroke-linecap'] || 'butt', color: node.attrs.stroke });
        node.children.forEach(child => visit(child, dx, dy));
    }
    visit(svg);
    return result;
}

export const roundedGeometry = lines => lines.map(({ points, width, cap }) => [...points, width].map(value => Number(value.toFixed(8))).concat(cap));
