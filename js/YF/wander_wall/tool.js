import { defineTool, ToolUiController, FileIntakeController, PresetMenuKeyboardController, SliderController } from '../infra/framework/src/index.js';
import { AssetStore, alternatives, FORMS, installCatalog } from './assets.js';
import { effectDefaults } from './effects.js';
import { mountEffects, syncEffects, effectSliders, effectSwatches } from './effects-ui.js';
import { defaults, shareDefaults, normalize, cleanText, lettersOf, makeDocument, readDocument } from './document.js';
import { Silhouettes, generate, changeFormat } from './layout.js';
import { drawArtwork, renderPNG, download } from './render.js';
import { Editor } from './editor.js';
import { mountIcons } from './icons.js';

const byId = id => document.getElementById(id), assets = new AssetStore();
let geometry, app, editor, ui, intake, presetKeyboard, resizeObserver, unsubscribe, sliders;
let busy = false, revision = 0, lastFormat = '', loadSignature = '', pendingLoad = Promise.resolve();
let draftText = null, draftVersion = 0, textTimer, layoutTimer, pendingControls = {}, mobilePanel = 'composition';
const lifecycle = new AbortController();
const status = message => { byId('operationStatus').textContent = message; };
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const on = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal: lifecycle.signal });
const hasPending = () => draftText !== null || Object.keys(pendingControls).length > 0;
const layoutControls = {
    fill: { min: 70, max: 125, label: 'Fill' }, formCount: { min: 0, max: 16, label: 'Form count' },
    rotationRange: { min: 0, max: 180, label: 'Rotation range' }, overflow: { min: 0, max: 50, label: 'Edge overflow' }
};

function refreshAvailability() {
    ui?.refresh();
    for (const id of ['presetDropdownToggle', 'presetToolbarShareBtn', 'savePresetBtn']) byId(id).disabled = busy || hasPending();
}

function showPanel(name, expand = true) {
    if (name === 'selection' && !editor?.item()) name = 'elements';
    mobilePanel = name;
    const root = document.querySelector('.wander-wall');
    root.dataset.mobilePanel = name;
    if (expand) { root.dataset.sheetCollapsed = 'false'; byId('sheetToggleBtn').setAttribute('aria-expanded', 'true'); byId('sheetToggleBtn').setAttribute('aria-label', 'Collapse panels'); }
    for (const tab of document.querySelectorAll('[data-panel]')) {
        tab.setAttribute('aria-selected', String(tab.dataset.panel === name)); tab.tabIndex = tab.dataset.panel === name ? 0 : -1;
    }
}

function selectionChanged(id) {
    if (id && matchMedia('(max-width: 1100px)').matches) showPanel('selection', false);
    else if (!id && mobilePanel === 'selection') showPanel('elements', false);
}

function syncViewport() {
    const viewport = window.visualViewport, root = document.querySelector('.wander-wall');
    const unzoomed = viewport && Math.abs(viewport.scale - 1) < .01;
    const height = unzoomed ? viewport.height : innerHeight, top = unzoomed ? viewport.offsetTop : 0;
    const bottom = Math.max(0, innerHeight - height - top);
    root.style.setProperty('--view-height', height + 'px');
    root.style.setProperty('--visual-top', top + 'px');
    root.style.setProperty('--keyboard-inset', bottom + 'px');
    root.dataset.keyboard = String(bottom > 100);
}

function cancelPending() {
    clearTimeout(textTimer); clearTimeout(layoutTimer); draftText = null; pendingControls = {}; draftVersion++;
}

function undoRedo(redo = false) {
    if (busy) return;
    cancelPending(); editor.cancel();
    if (redo) app.redo(); else app.undo();
    sync(app);
}

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
    byId('effectsControls').inert = value;
    byId('canvasContainer').setAttribute('aria-busy', String(value));
    byId('undoBtn').disabled = value || !app?.presets.canUndo(); byId('redoBtn').disabled = value || !app?.presets.canRedo();
    editor?.sync(); refreshAvailability();
}

async function generated(patch = {}, { reroll = true, label = 'Generate', format = false } = {}) {
    if (busy) return;
    editor?.cancel();
    clearTimeout(textTimer); clearTimeout(layoutTimer);
    // Loading assets must not overwrite text typed after this generation began.
    const inputVersion = draftVersion, text = draftText ?? patch.text ?? app.settings.text;
    patch = { ...pendingControls, ...patch, text }; pendingControls = {};
    const token = ++revision, original = JSON.stringify(app.getSnapshot());
    let completed = false;
    setBusy(true); status('Composing...');
    try {
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const source = { ...app.getSnapshot(), ...patch };
        const next = format ? changeFormat(source, source.format, geometry) : generate(source, geometry, { reroll });
        await assets.prepare(next.items);
        if (token !== revision || original !== JSON.stringify(app.getSnapshot()) || lifecycle.signal.aborted) return;
        if (draftVersion === inputVersion) draftText = null;
        change(next, label); status(''); completed = true;
    } catch (error) { status(error.message); }
    finally {
        if (token === revision) {
            setBusy(false); sync(app);
            if (draftText !== null && (completed || draftVersion !== inputVersion)) textTimer = setTimeout(applyText, 250);
        }
    }
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
        const next = geometry.constrain({ ...item, asset }, app.settings);
        change({ ...app.getSnapshot(), items: app.settings.items.map(entry => entry.id === id ? next : entry) }, 'Change variant');
        status('');
    } catch (error) { status(error.message); }
    finally {
        setBusy(false);
        if (Object.keys(pendingControls).length) {
            clearTimeout(layoutTimer);
            layoutTimer = setTimeout(() => generated({}, { reroll: false, label: 'Layout' }), 180);
        } else if (draftText !== null) textTimer = setTimeout(applyText, 250);
    }
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
    syncEffects(tool);
    if (draftText === null && document.activeElement !== byId('textInput')) byId('textInput').value = s.text;
    byId('letterCount').textContent = lettersOf(byId('textInput').value).length + ' / 32';
    for (const radio of document.querySelectorAll('input[name="format"]')) radio.checked = radio.value === s.format;
    document.querySelector('.wander-wall').dataset.format = s.format;
    byId('canvasDimensions').textContent = s.width + ' \u00d7 ' + s.height;
    for (const key of Object.keys(layoutControls)) {
        if (!(key in pendingControls) && document.activeElement !== byId(key + 'Value')) sliders?.setDisplayValue(key + 'Slider', s[key]);
    }
    byId('shuffleToggle').checked = s.shuffle; byId('formsToggle').checked = s.formsEnabled;
    byId('formsCountGroup').hidden = !s.formsEnabled; byId('seedInput').value = s.seed;
    byId('mainCanvas').setAttribute('aria-label', s.text ? s.text + ' letter wallpaper' : 'Abstract shape wallpaper');
    if (lastFormat !== s.format) {
        lastFormat = s.format;
        requestAnimationFrame(() => { tool.renderNow(); tool.target.fitToScreen(); });
    }
    editor?.sync(); refreshAvailability(); ensureArtwork(tool);
    byId('undoBtn').disabled = busy || !tool.presets?.canUndo(); byId('redoBtn').disabled = busy || !tool.presets?.canRedo();
}

function applyText() {
    if (busy || draftText === null) return;
    if (draftText === app.settings.text && !Object.keys(pendingControls).length) { draftText = null; sync(app); return; }
    return generated({}, { reroll: false, label: 'Text' });
}

function bind(tool) {
    editor = new Editor(tool, geometry, { change, nextVariant, isBusy: () => busy, onSelection: selectionChanged, signal: lifecycle.signal });
    for (const radio of document.querySelectorAll('input[name="backgroundMode"]')) on(radio, 'change', () => change({ ...tool.getSnapshot(), backgroundMode: radio.value }, 'Background'));
    for (const key of ['shadowEnabled', 'outlineEnabled']) on(byId(key + 'Toggle'), 'change', event => change({ ...tool.getSnapshot(), [key]: event.target.checked }, 'Effects'));
    on(byId('resetEffectsBtn'), 'click', () => change({ ...tool.getSnapshot(), ...effectDefaults }, 'Reset effects'));
    on(byId('textInput'), 'input', event => {
        const raw = event.target.value, cleaned = cleanText(raw);
        const length = raw.replace(/[^A-Za-z]/g, '').length;
        byId('letterCount').textContent = Math.min(length, 32) + ' / 32';
        byId('textError').textContent = /[^A-Za-z\s]/.test(raw) ? 'Use Latin letters A-Z.' : length > 32 ? 'Maximum 32 letters.' : '';
        if (length > 32) event.target.value = cleaned;
        draftText = cleaned; draftVersion++; clearTimeout(textTimer);
        if (!event.isComposing) textTimer = setTimeout(applyText, 300);
        refreshAvailability();
    });
    on(byId('textInput'), 'compositionend', () => { clearTimeout(textTimer); textTimer = setTimeout(applyText, 300); });
    on(byId('textInput'), 'blur', () => { if (draftText === null) byId('textInput').value = tool.settings.text; });
    on(byId('textInput'), 'keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); applyText(); } });
    for (const radio of document.querySelectorAll('input[name="format"]')) on(radio, 'change', () => generated({ format: radio.value }, { reroll: false, format: true, label: 'Canvas format' }));
    sliders = new SliderController(tool.settingsStore);
    for (const [key, config] of Object.entries(layoutControls)) {
        sliders.initSlider(key + 'Slider', { valueId: key + 'Value', min: config.min, max: config.max, baseStep: 1, decimals: 0,
            onUpdate: value => {
                if (busy) return;
                if (Math.round(value) === tool.settings[key]) delete pendingControls[key];
                else pendingControls[key] = Math.round(value);
                clearTimeout(layoutTimer); refreshAvailability();
                if (Object.keys(pendingControls).length) layoutTimer = setTimeout(() => generated({}, { reroll: false, label: config.label }), 180);
            }
        });
    }
    on(byId('shuffleToggle'), 'change', event => generated({ shuffle: event.target.checked }, { reroll: false, label: 'Letter order' }));
    on(byId('formsToggle'), 'change', event => generated({ formsEnabled: event.target.checked }, { reroll: false, label: 'Extra forms' }));
    on(byId('seedInput'), 'change', event => {
        const seed = Number(event.target.value);
        if (!event.target.value.trim() || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) { sync(tool); return; }
        generated({ seed }, { label: 'Seed' });
    });
    on(byId('undoBtn'), 'click', () => undoRedo());
    on(byId('redoBtn'), 'click', () => undoRedo(true));
    on(byId('zoomOutBtn'), 'click', () => tool.target.zoomOut());
    on(byId('zoomInBtn'), 'click', () => tool.target.zoomIn());
    for (const tab of document.querySelectorAll('[data-panel]')) {
        on(tab, 'click', () => showPanel(tab.dataset.panel));
        on(tab, 'keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const tabs = [...document.querySelectorAll('[data-panel]')].filter(tab => !tab.disabled), index = tabs.indexOf(tab);
            const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
            showPanel(next.dataset.panel); next.focus();
        });
    }
    on(byId('sheetToggleBtn'), 'click', () => {
        const root = document.querySelector('.wander-wall'), collapsed = root.dataset.sheetCollapsed !== 'true';
        root.dataset.sheetCollapsed = String(collapsed); byId('sheetToggleBtn').setAttribute('aria-expanded', String(!collapsed));
        byId('sheetToggleBtn').setAttribute('aria-label', collapsed ? 'Expand panels' : 'Collapse panels');
    });
    showPanel('composition');
    on(window, 'resize', syncViewport);
    if (window.visualViewport) {
        on(window.visualViewport, 'resize', syncViewport);
        on(window.visualViewport, 'scroll', syncViewport);
    }
    syncViewport();
    on(byId('retryBtn'), 'click', () => { byId('retryBtn').hidden = true; loadSignature = ''; ensureArtwork(tool); });
    intake = new FileIntakeController({ input: 'jsonFileInput', trigger: 'jsonPickerTrigger', accept: '.json,application/json', maxBytes: 256 * 1024,
        onSelect: async file => {
            if (busy) return;
            const next = readDocument(JSON.parse(await file.text()));
            setBusy(true);
            try { await assets.prepare(next.items); if (!lifecycle.signal.aborted) { cancelPending(); editor.select(null); change(next, 'Import JSON'); status(''); } }
            finally { setBusy(false); }
        }, onError: error => status(error.message), onReject: result => status(result.message) }).init();
    presetKeyboard = new PresetMenuKeyboardController().init();
    ui = new ToolUiController({ id: 'wander_wall', title: 'Wander Wall',
        summaries: { compositionPanel: () => tool.settings.text || 'Shapes', elementsPanel: () => tool.settings.items.length + ' layers', selectionPanel: () => editor.item()?.letter || 'Form' },
        actions: [
            { id: 'generate', button: 'generateBtn', label: 'Generate', kind: 'command', group: 'utility', shortcut: 'r', enabled: () => !busy,
                run: () => generated({ text: cleanText(byId('textInput').value), seed: newSeed() }) },
            { id: 'png', button: 'exportPngBtn', label: 'Export PNG', kind: 'export', group: 'primary', shortcut: 'mod+e', enabled: () => !busy && !hasPending(),
                run: async () => { const snapshot = tool.getSnapshot(); const blob = await renderPNG(snapshot, assets, geometry); download(blob, 'wander-wall-' + snapshot.seed + '.png'); } },
            { id: 'json-export', button: 'exportJsonBtn', label: 'Export JSON', kind: 'export', group: 'extra', shortcut: 'mod+j', enabled: () => !busy && !hasPending(),
                run: () => download(new Blob([JSON.stringify(makeDocument(tool.getSnapshot()), null, 2)], { type: 'application/json' }), 'wander-wall-' + tool.settings.seed + '.json') },
            { id: 'json-import', button: 'importJsonBtn', label: 'Import JSON', kind: 'import', group: 'extra', shortcut: 'mod+shift+j', enabled: () => !busy, run: () => intake.open() },
            { id: 'undo', label: 'Undo', kind: 'command', group: 'keyboard', shortcut: 'mod+z', enabled: () => !busy, run: () => undoRedo() },
            { id: 'redo', label: 'Redo', kind: 'command', group: 'keyboard', shortcut: 'mod+shift+z', enabled: () => !busy, run: () => undoRedo(true) },
            { id: 'pin', label: 'Pin element', kind: 'command', group: 'keyboard', shortcut: 'p', enabled: () => !busy && !!editor.item(), run: () => editor.pin() },
            ...['delete', 'backspace'].map(shortcut => ({ id: 'hide-' + shortcut, label: 'Hide selected layer', kind: 'command', group: 'keyboard', shortcut,
                enabled: () => !busy && !!editor.item() && editor.item().visible !== false, run: () => editor.visibility(editor.selected, false) })),
            { id: 'move-mode', label: 'Select and move', kind: 'command', group: 'keyboard', shortcut: 'v', run: () => editor.setMode('move') },
            { id: 'variant-mode', label: 'Change variant mode', kind: 'command', group: 'keyboard', shortcut: 'c', run: () => editor.setMode('variant') },
            { id: 'variant', label: 'Next variant', kind: 'command', group: 'keyboard', shortcut: 'shift+v', enabled: () => !busy && !!editor.item(), run: () => nextVariant(editor.selected) },
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
    mountEffects();
    mountIcons();
    const response = await fetch('./asset-catalog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the artwork catalog.');
    geometry = new Silhouettes(installCatalog(await response.json()));
    const initial = generate(defaults, geometry);
    await assets.prepare(initial.items);
    app = defineTool({ renderer: 'canvas',
        dom: { canvas: 'canvasContainer', surface: 'mainCanvas', zoomIndicator: 'zoomIndicator', presetDropdown: 'presetDropdown',
            presetToggle: 'presetDropdownToggle', presetMenu: 'presetDropdownMenu', saveBtn: 'savePresetBtn', shareBtn: 'presetToolbarShareBtn' },
        settings: initial, controls: { sliders: effectSliders, toggles: false },
        colorPickers: { containerId: 'effectsColorPicker', swatches: effectSwatches },
        panels: ['composition', 'elements', 'selection'].map(name => ({ id: name + 'Panel', headerId: name + 'PanelHeader', persistent: true })),
        presets: { seed: false, storageKey: 'upgrade:wander_wall:presets:v1', suggestSaveName: tool => tool.settings.text || 'Shapes' },
        history: { maxSize: 60, debounceMs: 200 }, share: { pristineDefaults: shareDefaults, quantizableFloatKeys: [] }, shortcuts: false, dialog: {},
        export: { filename: 'wander-wall.svg' }, zoom: { fitPadding: { top: 16, right: 12, bottom: 16, left: 12 } },
        restore: (tool, snapshot) => tool.settingsStore.fromJSON(normalize(snapshot), true),
        applyPreset: (tool, snapshot) => tool.settingsStore.fromJSON(snapshot.items == null ? generate(snapshot, geometry) : normalize(snapshot), true),
        syncControls: sync,
        render: ({ ctx2d, settings }) => { drawArtwork(ctx2d, settings, assets, geometry, editor?.items()); editor?.draw(ctx2d); },
        renderTo: ({ ctx2d, settings }) => drawArtwork(ctx2d, settings, assets, geometry),
        onReady: bind,
        onDestroy: () => { lifecycle.abort(); cancelPending(); editor?.cancel(); unsubscribe?.(); resizeObserver?.disconnect(); intake?.destroy(); presetKeyboard?.destroy(); ui?.destroy(); delete document.documentElement.dataset.ready; }
    });
    await app.init();
}

start().catch(error => {
    status(error.message); byId('retryBtn').hidden = false;
    byId('retryBtn').onclick = () => location.reload();
    console.error(error);
});

export { app, assets, geometry, editor, renderPNG, pendingLoad };
