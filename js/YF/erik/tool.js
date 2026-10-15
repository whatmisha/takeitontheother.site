import { defineTool, ToolUiController } from '../infra/framework/src/index.js';
import { DEFAULTS, RANGES, FPS, WIDTH, HEIGHT, normalize, framePlan, timecode, migrateDraft, hasContent, sceneAt, crawlStart, LUNNEN_BLUE } from './model.js';
import { CrawlRenderer, loadFont } from './renderer.js';
import { Exporter, probeVideo, download } from './exporter.js';
const $ = id => document.getElementById(id);
const DRAFT_KEY = 'upgrade:erik:draft:v1';
let renderer, ui, plan, raf = 0, frame = 0, playing = false, clockStart = 0, frameStart = 0;
let videoSupported = false, ready = false, renderError = false, saveTimer, observer, unsubscribe;
const events = new AbortController();
const status = message => { $('operationStatus').textContent = message; };
const exporter = new Exporter(({ completed, total }) => {
    $('exportProgress').max = total; $('exportProgress').value = completed;
    $('exportMessage').textContent = `${completed} / ${total} frames · ${Math.round(completed / total * 100)}%`;
});
function readDraft() {
    try { const saved = JSON.parse(localStorage.getItem(DRAFT_KEY)); return migrateDraft(saved); }
    catch { return normalize(DEFAULTS); }
}
function persistDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 4, settings: tool.getSnapshot() })); }
    catch { status('Draft could not be saved in this browser. Keep this tab open while working.'); }
}
function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 250);
}
function sync(tool) {
    for (const key of ['title', 'body']) if ($(key + 'Input').value !== tool.settings[key]) $(key + 'Input').value = tool.settings[key];
    $('alignmentInput').value = tool.settings.alignment;
    $('characterCount').textContent = `${tool.settings.body.length} / 5000`;
    for (const key of Object.keys(RANGES)) tool.sliders?.setValue(key + 'Slider', tool.settings[key], false);
    const gapEnabled = Boolean(tool.settings.title.trim() && tool.settings.body.trim());
    for (const id of ['logoGapSlider', 'logoGapValue']) $(id).disabled = !gapEnabled;
    tool.unifiedColorPicker?.sync();
}
function refreshTransport() {
    if (!plan) return;
    $('timeline').max = plan.frames - 1; $('timeline').value = frame;
    $('timeline').setAttribute('aria-valuetext', timecode(frame));
    $('currentTime').textContent = timecode(frame); $('totalTime').textContent = timecode(plan.frames);
    $('frameCount').textContent = `${plan.frames.toLocaleString()} frames`;
    $('durationNote').textContent = `${plan.duration.toFixed(1)} seconds · ${tool.settings.title.trim() ? 'intro + ' : ''}crawl at the selected speed.`;
    $('scenePhase').textContent = sceneAt(tool.settings, frame / FPS, renderer?.layout?.logoFade).phase;
    $('gapNote').textContent = !tool.settings.title.trim() ? 'Add a logo to set the gap.' : !tool.settings.body.trim() ? 'Add text to set the gap.' : `Text enters at ${timecode(Math.ceil(crawlStart(tool.settings) * FPS))} at this speed.`;
    $('playButton').textContent = playing ? 'Pause' : 'Play';
    $('playButton').setAttribute('aria-label', playing ? 'Pause' : 'Play');
}
function stop() { playing = false; cancelAnimationFrame(raf); raf = 0; refreshTransport(); }
function seek(value) {
    stop(); frame = Math.min(plan.frames - 1, Math.max(0, Math.round(value)));
    tool.renderNow(); refreshTransport();
}
function tick(now) {
    if (!playing) return;
    const next = Math.min(plan.frames - 1, frameStart + Math.floor((now - clockStart) * FPS / 1000));
    if (frame !== next) { frame = next; tool.renderNow(); }
    if (frame >= plan.frames - 1) stop();
    else raf = requestAnimationFrame(tick);
}
function play() {
    if (playing) { stop(); return; }
    if (!plan || !hasContent(tool.settings)) return;
    if (frame >= plan.frames - 1) frame = 0;
    playing = true; frameStart = frame; clockStart = performance.now(); refreshTransport();
    raf = requestAnimationFrame(tick);
}
function draw({ ctx2d, settings }) {
    if (!renderer) return;
    try {
        const layout = renderer.prepare(settings);
        plan = framePlan(settings, layout); frame = Math.min(frame, plan.frames - 1);
        const surface = renderer.render(settings, frame / FPS, { width: 1280, height: 720 });
        ctx2d.drawImage(surface, 0, 0, WIDTH, HEIGHT);
        if (renderError) status('');
        renderError = false;
        $('emptyState').hidden = hasContent(settings);
        refreshTransport(); ui?.refresh();
    } catch (error) { renderError = true; stop(); status(error.message); ui?.refresh(); }
}
async function exportFile(type) {
    stop();
    const snapshot = tool.getSnapshot(), savedFrame = frame;
    status(''); $('exportStatus').hidden = false;
    $('exportProgress').max = 1; $('exportProgress').value = 0;
    $('exportMessage').textContent = 'Preparing…';
    try {
        const pending = exporter.run(type, snapshot, savedFrame / FPS); ui.refresh();
        const result = await pending;
        download(result.blob, result.filename);
        status(`Saved ${result.filename}`);
        return result;
    } catch (error) {
        if (error.name === 'AbortError') status('Export cancelled.');
        throw error;
    } finally { $('exportStatus').hidden = true; ui.refresh(); }
}
const tool = defineTool({
    renderer: 'canvas', dom: { canvas: 'canvasContainer', surface: 'mainCanvas' },
    settings: readDraft(), history: { debounceMs: 350 }, export: false, zoom: false,
    controls: { sliders: Object.entries(RANGES).map(([key, [min, max, step]]) => ({
        id: key + 'Slider', valueId: key + 'Value', setting: key, min, max,
        decimals: step < .1 ? 2 : step < 1 ? 1 : 0, baseStep: step, shiftStep: step * 10
    })) },
    panels: [{ id: 'erikPanel', headerId: 'erikPanelHeader', persistent: true }],
    colorPickers: { containerId: 'colorPicker', swatches: ['textColor', 'backgroundColor'].map(key => ({
        type: key, setting: key, itemId: key + 'Item', dotId: key + 'Dot', hexId: key + 'Hex', hsbSlotId: key + 'Slot'
    })) },
    snapshot: app => normalize(app.settingsStore.toObject()),
    restore(app, snapshot) { stop(); app.settingsStore.fromJSON(normalize(snapshot), true); saveDraft(); },
    syncControls: sync, render: draw,
    onReady(app) {
        app.history.commit('Initial state');
        const on = (id, event, fn) => $(id).addEventListener(event, fn, { signal: events.signal });
        for (const key of ['title', 'body']) on(key + 'Input', 'input', () => { stop(); app.settings[key] = $(key + 'Input').value; });
        on('lunnenBlue', 'click', () => { app.settings.textColor = LUNNEN_BLUE; });
        on('alignmentInput', 'change', () => { app.settings.alignment = $('alignmentInput').value; });
        on('timeline', 'input', () => seek(Number($('timeline').value)));
        on('restartButton', 'click', () => seek(0));
        on('previousButton', 'click', () => seek(frame - 1));
        on('nextButton', 'click', () => seek(frame + 1));
        on('playButton', 'click', play);
        on('zoomIndicator', 'click', () => app.target.fitToScreen());
        on('cancelExport', 'click', () => exporter.cancel());
        unsubscribe = app.settingsStore.subscribe('*', () => { stop(); sync(app); saveDraft(); });
        const available = () => ready && !renderError && !exporter.busy && hasContent(app.settings);
        ui = new ToolUiController({ id: 'erik', title: 'Erik', onError: (error, action) => {
            status(error.message);
            if (error.name === 'AbortError') {
                const button = $(action.button);
                button.dataset.exportFeedbackState = 'cancelled';
                button.dataset.exportFeedbackMessage = 'Cancelled';
            }
        }, actions: [
            { id: 'reset', button: 'resetButton', label: 'Reset', kind: 'command', group: 'utility', run: () => {
                stop(); app.history.flush(); app.history.beginTransaction('Reset'); app.applySnapshot(DEFAULTS); app.history.endTransaction(); frame = 0; app.renderNow(); saveDraft(); status('Reset. Use ⌘Z to undo.');
            } },
            { id: 'mp4', button: 'exportMp4', label: 'MP4', kind: 'export', group: 'primary', shortcut: 'mod+e', enabled: () => available() && videoSupported, run: () => exportFile('mp4') },
            { id: 'sequence', button: 'exportSequence', label: 'PNG sequence', kind: 'export', group: 'primary', enabled: available, run: () => exportFile('sequence') },
            { id: 'frame', button: 'exportFrame', label: 'Current frame', kind: 'export', group: 'primary', enabled: available, run: () => exportFile('frame') },
            { id: 'play', label: 'Play / pause', kind: 'command', group: 'keyboard', shortcut: 'space', run: play },
            { id: 'previous', label: 'Previous frame', kind: 'command', group: 'keyboard', shortcut: 'arrowleft', run: () => seek(frame - 1), repeat: true },
            { id: 'next', label: 'Next frame', kind: 'command', group: 'keyboard', shortcut: 'arrowright', run: () => seek(frame + 1), repeat: true }
        ] }).init();
        observer = new ResizeObserver(() => app.target.fitToScreen()); observer.observe($('canvasContainer'));
        sync(app); app.target.fitToScreen(); ready = true; ui.refresh(); status('');
        probeVideo().then(result => { videoSupported = result.supported; $('exportMp4').title = result.message; if (!result.supported) status(result.message); ui.refresh(); });
    }
});
try { await loadFont(); renderer = new CrawlRenderer(); await tool.init(); }
catch (error) { status(error.message); }
window.addEventListener('pagehide', event => {
    stop(); exporter.cancel(); clearTimeout(saveTimer); if (ready) persistDraft();
    if (event.persisted) return;
    unsubscribe?.(); observer?.disconnect(); events.abort(); ui?.destroy(); renderer?.destroy(); tool.destroy();
});
export default tool;
