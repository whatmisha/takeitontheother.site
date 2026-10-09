import { defineTool, ToolUiController, FileIntakeController, PresetMenuKeyboardController } from '../infra/framework/src/index.js';
import { AssetStore, alternatives, FORMS } from './assets.js';
import { defaults, normalize, cleanText, lettersOf, makeDocument, readDocument } from './document.js';
import { Silhouettes, generate, changeFormat } from './layout.js';
import { drawArtwork, renderPNG, download } from './render.js';
import { Editor } from './editor.js';
import { mountIcons } from './icons.js';

const byId = id => document.getElementById(id), assets = new AssetStore();
let geometry, app, editor, ui, intake, presetKeyboard, resizeObserver, unsubscribe;
let busy = false, revision = 0, lastFormat = '', loadSignature = '', pendingLoad = Promise.resolve();
const lifecycle = new AbortController();
const status = message => { byId('operationStatus').textContent = message; };
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const on = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal: lifecycle.signal });

function change(next, label = 'Edit composition') {
    const normalized = normalize(next);
    if (JSON.stringify(normalized) === JSON.stringify(app.getSnapshot())) { sync(app); return; }
    app.history.flush(); app.history.beginTransaction(label);
    try { app.applySnapshot(normalized); app.presets.markDirty(); }
    finally { app.history.endTransaction(); }
    sync(app);
}

function setBusy(value) {
    busy = value;
    byId('compositionFieldset').disabled = value;
    byId('canvasContainer').setAttribute('aria-busy', String(value));
    byId('undoBtn').disabled = value || !app?.presets.canUndo(); byId('redoBtn').disabled = value || !app?.presets.canRedo();
    byId('presetDropdownToggle').disabled = value;
    editor?.sync(); ui?.refresh();
}

async function generated(patch = {}, { reroll = true, label = 'Generate', format = false } = {}) {
    if (busy) return;
    editor?.cancel();
    const token = ++revision, original = JSON.stringify(app.getSnapshot());
    setBusy(true); status('Composing...');
    try {
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const source = { ...app.getSnapshot(), ...patch };
        const next = format ? changeFormat(source, source.format, geometry) : generate(source, geometry, { reroll });
        await assets.prepare(next.items);
        if (token !== revision || original !== JSON.stringify(app.getSnapshot()) || lifecycle.signal.aborted) return;
        change(next, label); status('');
    } catch (error) { status(error.message); }
    finally { if (token === revision) { setBusy(false); sync(app); } }
}

async function nextVariant(id) {
    const item = app.settings.items.find(entry => entry.id === id);
    if (!item || busy) return;
    const choices = item.kind === 'letter' ? alternatives(item.letter) : FORMS.map(form => form.id);
    const asset = choices[(choices.indexOf(item.asset) + 1) % choices.length];
    const original = JSON.stringify(app.getSnapshot());
    setBusy(true);
    try {
        await assets.load(asset);
        if (lifecycle.signal.aborted || original !== JSON.stringify(app.getSnapshot())) return;
        const next = geometry.constrain({ ...item, asset, pinned: true }, app.settings);
        change({ ...app.getSnapshot(), items: app.settings.items.map(entry => entry.id === id ? next : entry) }, 'Change variant');
        status('');
    } catch (error) { status(error.message); }
    finally { setBusy(false); }
}

function ensureArtwork(tool) {
    assets.retain(tool.settings.items);
    const ids = tool.settings.items.map(item => item.asset).join('|');
    if (ids === loadSignature) return;
    loadSignature = ids;
    if (tool.settings.items.every(item => assets.get(item.asset))) { tool.render(); return; }
    status('Loading artwork...');
    pendingLoad = assets.prepare(tool.settings.items).then(() => {
        if (lifecycle.signal.aborted || loadSignature !== ids) return;
        tool.render(); status('');
    }).catch(error => {
        loadSignature = ''; status(error.message); byId('retryBtn').hidden = false;
    });
}

function sync(tool) {
    const s = tool.settings;
    if (document.activeElement !== byId('textInput')) byId('textInput').value = s.text;
    byId('letterCount').textContent = lettersOf(byId('textInput').value).length + ' / 32';
    for (const radio of document.querySelectorAll('input[name="format"]')) radio.checked = radio.value === s.format;
    document.querySelector('.wander-wall').dataset.format = s.format;
    byId('canvasDimensions').textContent = s.width + ' \u00d7 ' + s.height;
    for (const key of ['fill', 'formCount']) { byId(key + 'Slider').value = s[key]; byId(key + 'Value').textContent = s[key] + (key === 'fill' ? '%' : ''); }
    byId('shuffleToggle').checked = s.shuffle; byId('formsToggle').checked = s.formsEnabled;
    byId('formsCountGroup').hidden = !s.formsEnabled; byId('seedInput').value = s.seed;
    byId('mainCanvas').setAttribute('aria-label', s.text ? s.text + ' letter wallpaper' : 'Abstract shape wallpaper');
    if (lastFormat !== s.format) {
        lastFormat = s.format;
        requestAnimationFrame(() => { tool.renderNow(); tool.target.fitToScreen(); });
    }
    editor?.sync(); ui?.refresh(); ensureArtwork(tool);
    byId('undoBtn').disabled = busy || !tool.presets?.canUndo(); byId('redoBtn').disabled = busy || !tool.presets?.canRedo();
}

function applyText() {
    const input = byId('textInput'), cleaned = cleanText(input.value);
    input.value = cleaned;
    byId('textError').textContent = '';
    return generated({ text: cleaned }, { reroll: false, label: 'Text' });
}

function bind(tool) {
    editor = new Editor(tool, geometry, { change, nextVariant, isBusy: () => busy, signal: lifecycle.signal });
    on(byId('textInput'), 'input', event => {
        const raw = event.target.value, cleaned = cleanText(raw);
        const length = raw.replace(/[^A-Za-z]/g, '').length;
        byId('letterCount').textContent = Math.min(length, 32) + ' / 32';
        byId('textError').textContent = /[^A-Za-z\s]/.test(raw) ? 'Use Latin letters A-Z.' : length > 32 ? 'Maximum 32 letters.' : '';
        if (length > 32) event.target.value = cleaned;
    });
    on(byId('textInput'), 'keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); applyText(); } });
    on(byId('applyTextBtn'), 'click', applyText);
    for (const radio of document.querySelectorAll('input[name="format"]')) on(radio, 'change', () => generated({ format: radio.value }, { reroll: false, format: true, label: 'Canvas format' }));
    for (const key of ['fill', 'formCount']) {
        on(byId(key + 'Slider'), 'input', event => { byId(key + 'Value').textContent = event.target.value + (key === 'fill' ? '%' : ''); });
        on(byId(key + 'Slider'), 'change', event => generated({ [key]: Number(event.target.value) }, { reroll: false, label: key === 'fill' ? 'Fill' : 'Form count' }));
    }
    on(byId('shuffleToggle'), 'change', event => generated({ shuffle: event.target.checked }, { reroll: false, label: 'Letter order' }));
    on(byId('formsToggle'), 'change', event => generated({ formsEnabled: event.target.checked }, { reroll: false, label: 'Extra forms' }));
    on(byId('seedInput'), 'change', event => {
        const seed = Number(event.target.value);
        if (!event.target.value.trim() || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) { sync(tool); return; }
        generated({ seed }, { label: 'Seed' });
    });
    on(byId('undoBtn'), 'click', () => { if (!busy) { editor.cancel(); tool.undo(); } });
    on(byId('redoBtn'), 'click', () => { if (!busy) { editor.cancel(); tool.redo(); } });
    on(byId('zoomOutBtn'), 'click', () => tool.target.zoomOut());
    on(byId('zoomInBtn'), 'click', () => tool.target.zoomIn());
    on(byId('retryBtn'), 'click', () => { byId('retryBtn').hidden = true; loadSignature = ''; ensureArtwork(tool); });
    intake = new FileIntakeController({ input: 'jsonFileInput', trigger: 'jsonPickerTrigger', accept: '.json,application/json', maxBytes: 256 * 1024,
        onSelect: async file => {
            if (busy) return;
            const next = readDocument(JSON.parse(await file.text()));
            setBusy(true);
            try { await assets.prepare(next.items); if (!lifecycle.signal.aborted) { editor.select(null); change(next, 'Import JSON'); status(''); } }
            finally { setBusy(false); }
        }, onError: error => status(error.message), onReject: result => status(result.message) }).init();
    presetKeyboard = new PresetMenuKeyboardController().init();
    ui = new ToolUiController({ id: 'wander_wall', title: 'Wander Wall',
        summaries: { compositionPanel: () => tool.settings.text || 'Shapes', elementsPanel: () => tool.settings.items.length + ' elements' },
        actions: [
            { id: 'generate', button: 'generateBtn', label: 'Generate', kind: 'command', group: 'utility', shortcut: 'r', enabled: () => !busy,
                run: () => generated({ text: cleanText(byId('textInput').value), seed: newSeed() }) },
            { id: 'png', button: 'exportPngBtn', label: 'Export PNG', kind: 'export', group: 'primary', shortcut: 'mod+e', enabled: () => !busy,
                run: async () => { const snapshot = tool.getSnapshot(); const blob = await renderPNG(snapshot, assets, geometry); download(blob, 'wander-wall-' + snapshot.seed + '.png'); } },
            { id: 'json-export', button: 'exportJsonBtn', label: 'Export JSON', kind: 'export', group: 'extra', shortcut: 'mod+j', enabled: () => !busy,
                run: () => download(new Blob([JSON.stringify(makeDocument(tool.getSnapshot()), null, 2)], { type: 'application/json' }), 'wander-wall-' + tool.settings.seed + '.json') },
            { id: 'json-import', button: 'importJsonBtn', label: 'Import JSON', kind: 'import', group: 'extra', shortcut: 'mod+shift+j', enabled: () => !busy, run: () => intake.open() },
            { id: 'undo', label: 'Undo', kind: 'command', group: 'keyboard', shortcut: 'mod+z', enabled: () => !busy, run: () => { editor.cancel(); tool.undo(); } },
            { id: 'redo', label: 'Redo', kind: 'command', group: 'keyboard', shortcut: 'mod+shift+z', enabled: () => !busy, run: () => { editor.cancel(); tool.redo(); } },
            { id: 'pin', label: 'Pin element', kind: 'command', group: 'keyboard', shortcut: 'p', enabled: () => !busy && !!editor.item(), run: () => editor.pin() },
            { id: 'variant', label: 'Next variant', kind: 'command', group: 'keyboard', shortcut: 'v', enabled: () => !busy && !!editor.item(), run: () => nextVariant(editor.selected) },
            ...[['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]].flatMap(([key, x, y]) => [false, true].map(shift => ({
                id: 'nudge-' + key + (shift ? '-fast' : ''), label: shift ? 'Move element 10 px' : 'Move element 1 px', kind: 'command', group: 'keyboard',
                shortcut: (shift ? 'shift+' : '') + 'arrow' + key, repeat: true, enabled: () => !busy && !!editor.item() && !editor.gesture,
                run: () => editor.nudge(x * (shift ? 10 : 1), y * (shift ? 10 : 1))
            }))),
            ...[[-1, 'mod+[', 'Send backward'], [1, 'mod+]', 'Bring forward']].map(([delta, shortcut, label]) => ({ id: 'order-' + delta, label, kind: 'command', group: 'keyboard', shortcut, enabled: () => !busy && !!editor.item(), run: () => editor.reorder(delta) }))
        ], onError: error => status(error.message || 'Operation failed.')
    }).init();
    unsubscribe = tool.settingsStore.subscribe('*', () => sync(tool));
    resizeObserver = new ResizeObserver(() => { tool.renderNow(); tool.target.fitToScreen(); });
    resizeObserver.observe(byId('canvasContainer'));
    sync(tool); setBusy(false); status(''); document.documentElement.dataset.ready = 'true';
}

async function start() {
    mountIcons();
    const response = await fetch('./asset-metrics.json');
    if (!response.ok) throw new Error('Could not load the artwork catalog.');
    geometry = new Silhouettes(await response.json());
    const initial = generate(defaults, geometry);
    await assets.prepare(initial.items);
    app = defineTool({ renderer: 'canvas',
        dom: { canvas: 'canvasContainer', surface: 'mainCanvas', zoomIndicator: 'zoomIndicator', presetDropdown: 'presetDropdown',
            presetToggle: 'presetDropdownToggle', presetMenu: 'presetDropdownMenu', saveBtn: 'savePresetBtn', shareBtn: 'presetToolbarShareBtn' },
        settings: initial, controls: { sliders: [], toggles: false },
        panels: ['composition', 'elements'].map(name => ({ id: name + 'Panel', headerId: name + 'PanelHeader', persistent: true })),
        presets: { seed: false, storageKey: 'upgrade:wander_wall:presets:v1', suggestSaveName: tool => tool.settings.text || 'Shapes' },
        history: { maxSize: 60, debounceMs: 200 }, share: { quantizableFloatKeys: [] }, shortcuts: false, dialog: {},
        export: { filename: 'wander-wall.svg' }, zoom: { fitPadding: { top: 16, right: 12, bottom: 16, left: 12 } },
        restore: (tool, snapshot) => tool.settingsStore.fromJSON(normalize(snapshot), true),
        applyPreset: (tool, snapshot) => tool.settingsStore.fromJSON(normalize(snapshot), true),
        syncControls: sync,
        render: ({ ctx2d, settings }) => { drawArtwork(ctx2d, settings, assets, geometry, editor?.items()); editor?.draw(ctx2d); },
        renderTo: ({ ctx2d, settings }) => drawArtwork(ctx2d, settings, assets, geometry),
        onReady: bind,
        onDestroy: () => { lifecycle.abort(); editor?.cancel(); unsubscribe?.(); resizeObserver?.disconnect(); intake?.destroy(); presetKeyboard?.destroy(); ui?.destroy(); delete document.documentElement.dataset.ready; }
    });
    await app.init();
}

start().catch(error => {
    status(error.message); byId('retryBtn').hidden = false;
    byId('retryBtn').onclick = () => location.reload();
    console.error(error);
});

export { app, assets, geometry, editor, renderPNG, pendingLoad };
