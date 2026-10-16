import { EndingAssetStorage } from './asset-storage.js';
import { hasEnding, ASSET_MAX_BYTES } from './ending-model.js';
import { readEndingFile, loadLottie, svgBitmap } from './ending-assets.js';
import { defineTool, ToolUiController, DialogHost, FileIntakeController } from '../infra/framework/src/index.js';
import { DEFAULTS, RANGES, FPS, WIDTH, HEIGHT, normalize, timecode, migrateDraft, hasContent, sceneAt, crawlStart, hasText, parseBody, parseTimecode, TEXT_LIMIT } from './model.js';
import { animationType } from './animations.js';
import { PresetLibrary, PRESET_KEY, migrateLibrary, seedDraftPreset } from './library.js';
import { presetDocument } from './document.js';
const animation = animationType('crawl');
import { Exporter, probeVideo, download } from './exporter.js';
const $ = id => document.getElementById(id);
const DRAFT_KEY = 'upgrade:erik:draft:v1';
let renderer, ui, plan, raf = 0, frame = 0, playing = false, clockStart = 0, frameStart = 0;
let videoSupported = false, ready = false, renderError = false, saveTimer, observer, unsubscribe;
let endingIntake, endingLoading = false, endingError = false, endingLoadKey, endingLoadVersion = 0;
let library, textEditor, draftPresetName = null, hadDraft = false, startupNotice = '';
const events = new AbortController();
const status = message => { $('operationStatus').textContent = message; };
const exporter = new Exporter(({ completed, total }) => {
    $('exportProgress').max = total; $('exportProgress').value = completed;
    $('exportStatus').style.setProperty('--export-progress', `${completed / total * 100}%`);
    $('exportMessage').textContent = `${completed} / ${total} frames · ${Math.round(completed / total * 100)}%`;
});
function readDraft() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY)); }
    catch { return normalize(DEFAULTS); }
    // Missing asset references must not turn a recoverable draft into empty defaults.
    try { saved = assetStorage.unpack(saved); }
    catch (error) { status(error.message); throw error; }
    hadDraft = Boolean(saved?.settings); draftPresetName = saved?.presetName || saved?.projectName || null;
    return migrateDraft(saved);
}
function persistDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(assetStorage.pack({ version: 9, presetName: library?.currentName || null, settings: tool.getSnapshot() }))); }
    catch { status('Draft could not be saved in this browser. Keep this tab open while working.'); }
}
function saveDraft() {
    if (!ready) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 250);
}
function sync(tool) {
    for (const key of ['title', 'body']) if ($(key + 'Input').value !== tool.settings[key]) $(key + 'Input').value = tool.settings[key];
    const rows = parseBody(tool.settings.body);
    $('creditGapControl').hidden = !rows.some(row => row.kind === 'pair');
    $('endingTypeInput').value = tool.settings.endingType;
    if ($('endingTextInput').value !== tool.settings.endingText) $('endingTextInput').value = tool.settings.endingText;
    for (const key of ['endingFadeIn', 'endingFadeOut']) $(key + 'Input').checked = tool.settings[key];
    $('endingTextControl').hidden = tool.settings.endingType !== 'text';
    $('endingFileControl').hidden = !['svg', 'lottie'].includes(tool.settings.endingType);
    $('endingOptions').hidden = tool.settings.endingType === 'none';
    const asset = tool.settings.endingAsset, matches = tool.settings.endingType === 'svg' ? asset?.kind === 'svg' : tool.settings.endingType === 'lottie' && asset?.kind !== 'svg';
    $('endingFileName').textContent = matches ? asset?.name || '' : '';
    $('removeEndingFile').hidden = !matches || !asset;
    $('chooseEndingFile').textContent = `${matches && asset ? 'Replace' : 'Choose'} ${tool.settings.endingType === 'svg' ? 'SVG' : 'Lottie'}`;
    if (endingIntake) { endingIntake.accept = tool.settings.endingType === 'svg' ? '.svg,image/svg+xml' : '.json,.lottie,application/json'; $('endingFileInput').accept = endingIntake.accept; }
    library?.sync();
    if (ready) void ensureEnding();
    $('characterCount').textContent = `${tool.settings.body.length} / ${TEXT_LIMIT}`;
    for (const key of Object.keys(RANGES)) tool.sliders?.setValue(key + 'Slider', tool.settings[key], false);
    const gapEnabled = Boolean(tool.settings.title.trim() && hasText(tool.settings));
    for (const id of ['logoGapSlider', 'logoGapValue']) $(id).disabled = !gapEnabled;
    for (const id of ['endingGapSlider', 'endingGapValue']) $(id).disabled = tool.settings.endingType === 'none' || !Boolean(tool.settings.title.trim() || hasText(tool.settings));
    tool.unifiedColorPicker?.sync();
}
function refreshTransport() {
    if (!plan) return;
    $('timeline').max = plan.frames - 1; $('timeline').value = frame;
    $('timeline').setAttribute('aria-valuetext', timecode(frame));
    if (document.activeElement !== $('currentTime')) $('currentTime').value = timecode(frame); $('totalTime').textContent = timecode(plan.frames);
    const scene = sceneAt(tool.settings, frame / FPS, renderer?.layout?.logoFade, plan.textFade);
    const endingVisible = plan.ending && frame >= plan.ending.startFrame && frame < plan.ending.startFrame + plan.ending.frames;
    $('scenePhase').textContent = endingVisible
        ? hasText(tool.settings) && scene.crawlVisible && scene.textAlpha > 0 ? 'Crawl → Ending' : scene.logoAlpha > 0 ? 'Logo → Ending' : 'Ending'
        : plan.ending && frame >= plan.crawlFrames && frame < plan.ending.startFrame ? 'Gap → Ending' : scene.phase;
    const textFrame = Math.ceil(crawlStart(tool.settings) * FPS), logoFrame = Math.ceil((renderer?.layout?.logoFade.end || 0) / tool.settings.speed * FPS);
    for (const [id, at, shown] of [['text', textFrame, hasText(tool.settings)], ['logo', logoFrame, Boolean(tool.settings.title.trim())], ['fade', Math.ceil((plan.textFade?.start || 0) * FPS), Boolean(plan.textFade)], ['ending', plan.ending?.startFrame || 0, Boolean(plan.ending)]]) {
        $(id + 'Marker').hidden = !shown; $(id + 'Marker').style.left = `${Math.max(0, Math.min(100, at / Math.max(1, plan.frames - 1) * 100))}%`;
    }
    $('playButton').disabled = !hasContent(tool.settings) || endingLoading || endingError;
    $('playButton').setAttribute('aria-pressed', String(playing));
    $('playIcon').toggleAttribute('hidden', playing);
    $('pauseIcon').toggleAttribute('hidden', !playing);
    $('playButton').title = playing ? 'Pause (Space)' : 'Play (Space)';
    $('playButton').setAttribute('aria-label', playing ? 'Pause' : 'Play');
}
async function ensureEnding() {
    const settings = tool.getSnapshot(), asset = settings.endingAsset;
    const key = hasEnding(settings) && settings.endingType !== 'text' ? asset.kind + ':' + asset.data : '';
    if (key === endingLoadKey) return;
    endingLoadKey = key; const version = ++endingLoadVersion;
    endingLoading = Boolean(key); endingError = false;
    $('endingAssetStatus').textContent = key ? 'Loading…' : '';
    ui?.refresh();
    try {
        await assetStorage.prepare(asset);
        await renderer.loadEnding(settings);
        if (version !== endingLoadVersion) return;
        $('endingAssetStatus').textContent = ''; saveDraft();
    } catch (error) {
        if (version !== endingLoadVersion) return;
        endingError = true; $('endingAssetStatus').textContent = error.message;
    } finally {
        if (version === endingLoadVersion) { endingLoading = false; tool.renderNow(); ui?.refresh(); }
    }
}
function previewEnding() {
    tool.renderNow();
    if (plan.ending) seek(plan.ending.startFrame + (tool.settings.endingFadeIn ? Math.min(15, plan.ending.frames - 1) : 0));
}
function pausePlayback() { playing = false; cancelAnimationFrame(raf); raf = 0; refreshTransport(); }
function seek(value) {
    pausePlayback(); frame = Math.min(plan.frames - 1, Math.max(0, Math.round(value)));
    tool.renderNow(); refreshTransport();
}
function tick(now) {
    if (!playing) return;
    const next = Math.min(plan.frames - 1, frameStart + Math.floor((now - clockStart) * FPS / 1000));
    if (frame !== next) { frame = next; tool.renderNow(); }
    if (frame >= plan.frames - 1) pausePlayback();
    else raf = requestAnimationFrame(tick);
}
function play() {
    if (playing) { pausePlayback(); return; }
    if (!plan || !hasContent(tool.settings) || endingLoading || endingError) return;
    if (frame >= plan.frames - 1) frame = 0;
    playing = true; frameStart = frame; clockStart = performance.now(); refreshTransport();
    raf = requestAnimationFrame(tick);
}
function draw({ ctx2d, settings, target }) {
    if (!renderer) return;
    try {
        const layout = renderer.prepare(settings);
        plan = animation.plan(settings, layout); frame = Math.min(frame, plan.frames - 1);
        const surface = renderer.render(settings, frame / FPS, { width: 1280, height: 720 });
        ctx2d.drawImage(surface, 0, 0, WIDTH, HEIGHT);
        Object.assign($('artboardEdge').style, { left: `${target.panX}px`, top: `${target.panY}px`, width: `${WIDTH * target.zoom}px`, height: `${HEIGHT * target.zoom}px` });
        if (renderError) status('');
        renderError = false;
        $('emptyState').hidden = hasContent(settings);
        refreshTransport(); ui?.refresh();
    } catch (error) { renderError = true; pausePlayback(); status(error.message); ui?.refresh(); }
}
async function exportFile(type) {
    pausePlayback();
    const snapshot = tool.getSnapshot(), savedFrame = frame;
    status(''); $('exportStatus').hidden = false; $('exportActions').classList.add('is-exporting');
    $('exportStatus').style.setProperty('--export-progress', '0%');
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
    } finally { $('exportStatus').hidden = true; $('exportActions').classList.remove('is-exporting'); ui.refresh(); }
}
const assetStorage = await EndingAssetStorage.open().catch(error => { status(error.message); throw error; });
const initialSettings = readDraft();
await assetStorage.prepare(initialSettings.endingAsset);
const tool = defineTool({
    renderer: 'canvas', dom: { canvas: 'canvasContainer', surface: 'mainCanvas' },
    settings: DEFAULTS,
    presets: { storageKey: PRESET_KEY, basePath: './presets', defaultName: draftPresetName || 'Lunnen Airis',
        migrate: async store => {
            await assetStorage.attach(store);
            try { migrateLibrary(store, initialSettings); await seedDraftPreset(store, assetStorage); } catch (error) { startupNotice = error.message; }
        },
        colorDots: blob => [blob.settings?.textColor, blob.settings?.backgroundColor].filter(Boolean).map(value => ({ kind: 'solid', value })),
        suggestSaveName: () => library?.suggestedName || 'Lunnen Airis'
    },
    collectPreset: app => presetDocument(app.getSnapshot(), app.presets.isEphemeral ? 'Untitled' : app.presets.currentName),
    applyPreset(app, blob) { pausePlayback(); frame = 0; app.settingsStore.fromJSON(normalize(blob.settings || blob), true); saveDraft(); },
    onChromeRefresh(app) { library?.sync(); if (ready) saveDraft(); },
    history: { debounceMs: 350 }, export: false, zoom: false, dialog: {},
    share: { shortSeeded: false, extraKeys: ['toolId', 'schemaVersion', 'animation', 'name', 'settings'] },
    controls: { sliders: Object.entries(RANGES).map(([key, [min, max, step]]) => ({
        id: key + 'Slider', valueId: key + 'Value', setting: key, min, max,
        decimals: step < .1 ? 2 : step < 1 ? 1 : 0, baseStep: step, shiftStep: step * 10
    })) },
    panels: ['contentPanel', 'textStylePanel', 'motionPanel', 'timelinePanel'].map(id => ({ id, headerId: id + 'Header', persistent: true })),
    colorPickers: { containerId: 'colorPicker', swatches: ['textColor', 'backgroundColor'].map(key => ({
        type: key, setting: key, itemId: key + 'Item', dotId: key + 'Dot', hexId: key + 'Hex', hsbSlotId: key + 'Slot'
    })) },
    snapshot: app => normalize(app.settingsStore.toObject()),
    restore(app, snapshot) { pausePlayback(); app.settingsStore.fromJSON(normalize(snapshot), true); saveDraft(); },
    syncControls: sync, render: draw,
    onReady(app) {
        if (hadDraft && !app.presets.isShared && !new URLSearchParams(location.search).has('preset')) {
            if (!draftPresetName || !app.presetStore.has(draftPresetName)) app.presets.openNew(DEFAULTS);
            app.applySnapshot(initialSettings);
        }
        app.history.commit('Initial state');
        const on = (id, event, fn) => $(id).addEventListener(event, fn, { signal: events.signal });
        for (const key of ['title', 'body']) on(key + 'Input', 'input', () => { pausePlayback(); app.settings[key] = $(key + 'Input').value; });
        textEditor = new DialogHost({ dialog: 'textEditorDialog', title: 'textEditorTitle', text: 'textEditorNote', input: 'expandedBodyInput', buttons: 'textEditorButtons' });
        on('expandText', 'click', async () => {
            pausePlayback(); app.history.flush();
            const body = $('bodyInput'), expanded = $('expandedBodyInput');
            const pending = textEditor.show({ title: 'Edit text', showInput: true, inputValue: app.settings.body,
                buttons: [{ id: 'apply', text: 'Apply', type: 'primary' }, { id: 'cancel', text: 'Cancel', type: 'ghost' }] });
            expanded.setSelectionRange(body.selectionStart, body.selectionEnd);
            expanded.scrollTop = body.scrollTop / Math.max(1, body.scrollHeight - body.clientHeight) * Math.max(0, expanded.scrollHeight - expanded.clientHeight);
            expanded.scrollLeft = 0;
            const { action } = await pending;
            // DialogHost trims prompt values; text editing must preserve every line break.
            if (action === 'apply' && expanded.value !== app.settings.body) {
                app.history.beginTransaction('Edit text');
                app.settings.body = expanded.value;
                app.history.endTransaction();
            }
        });
        const selectContent = section => {
            $('contentPanel').classList.toggle('ending-open', section === 'ending');
            for (const key of ['crawl', 'ending']) {
                const selected = key === section;
                $(key + 'Content').hidden = !selected; $(key + 'Tab').setAttribute('aria-selected', String(selected)); $(key + 'Tab').tabIndex = selected ? 0 : -1;
            }
            $('contentPanel').querySelector('.panel-content').scrollTop = 0;
            if (section === 'ending') previewEnding();
        };
        for (const section of ['crawl', 'ending']) {
            on(section + 'Tab', 'click', () => selectContent(section));
            on(section + 'Tab', 'keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault(); const next = event.key === 'Home' ? 'crawl' : event.key === 'End' ? 'ending' : section === 'crawl' ? 'ending' : 'crawl';
                selectContent(next); $(next + 'Tab').focus();
            });
        }
        on('endingTypeInput', 'change', () => { pausePlayback(); app.settings.endingType = $('endingTypeInput').value; previewEnding(); });
        on('endingTextInput', 'input', () => { pausePlayback(); app.settings.endingText = $('endingTextInput').value; previewEnding(); });
        for (const key of ['endingFadeIn', 'endingFadeOut']) on(key + 'Input', 'change', () => { pausePlayback(); app.settings[key] = $(key + 'Input').checked; previewEnding(); });
        endingIntake = new FileIntakeController({ input: 'endingFileInput', trigger: 'chooseEndingFile', maxBytes: ASSET_MAX_BYTES,
            sizeErrorText: 'Use an SVG or Lottie file up to 5 MB.',
            onSelect: async file => {
                pausePlayback(); const type = app.settings.endingType, before = JSON.stringify(app.getSnapshot());
                const asset = await readEndingFile(file, type);
                // Check the actual decoder before replacing the current, recoverable asset.
                const resource = type === 'svg' ? await svgBitmap(asset) : await loadLottie(asset);
                if (type === 'svg') resource.close(); else resource.destroy();
                if (JSON.stringify(app.getSnapshot()) !== before) { status('The composition changed during import. Choose the file again to add it here.'); return; }
                await assetStorage.prepare(asset);
                if (JSON.stringify(app.getSnapshot()) !== before) { status('The composition changed during import. Choose the file again to add it here.'); return; }
                endingLoadKey = undefined;
                app.history.flush(); app.history.beginTransaction('Import ending'); app.settings.endingAsset = asset; app.history.endTransaction();
                previewEnding(); status('');
            }, onRemove: async () => { app.history.flush(); app.history.beginTransaction('Remove ending'); app.settings.endingAsset = null; app.history.endTransaction(); status(''); },
            onReject: result => status(result.message), onError: error => status(error.message)
        }).init();
        on('removeEndingFile', 'click', () => void endingIntake.remove());
        library = new PresetLibrary({ app, status, changed: saveDraft, assetStorage }).init();
        const commitTime = () => {
            const target = parseTimecode($('currentTime').value);
            if (target === null) { $('currentTime').value = timecode(frame); status('Use minutes:seconds:frames, for example 00:05:15.'); }
            else { seek(target); $('currentTime').value = timecode(frame); }
        };
        on('currentTime', 'change', commitTime);
        on('currentTime', 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commitTime(); $('currentTime').blur(); } if (event.key === 'Escape') { $('currentTime').value = timecode(frame); $('currentTime').blur(); } });
        on('timeline', 'input', () => seek(Number($('timeline').value)));
        on('playButton', 'click', play);
        on('stopButton', 'click', () => seek(0));
        on('cancelExport', 'click', () => exporter.cancel());
        unsubscribe = app.settingsStore.subscribe('*', () => { pausePlayback(); sync(app); saveDraft(); });
        const available = () => ready && !renderError && !endingLoading && !endingError && !exporter.busy && hasContent(app.settings);
        ui = new ToolUiController({ id: 'erik', title: 'Erik', onError: (error, action) => {
            status(error.message);
            if (error.name === 'AbortError') {
                const button = $(action.button);
                button.dataset.exportFeedbackState = 'cancelled';
                button.dataset.exportFeedbackMessage = 'Cancelled';
            }
        }, actions: [
            { id: 'reset', button: 'resetButton', label: 'Reset', kind: 'command', group: 'utility', run: () => {
                pausePlayback(); app.history.flush(); app.history.beginTransaction('Reset'); app.applySnapshot(DEFAULTS); app.history.endTransaction(); frame = 0; app.renderNow(); saveDraft(); status('Reset. Use ⌘Z to undo.');
            } },
            { id: 'mp4', button: 'exportMp4', label: 'MP4', kind: 'export', group: 'primary', shortcut: 'mod+e', enabled: () => available() && videoSupported, run: () => exportFile('mp4') },
            { id: 'sequence', button: 'exportSequence', label: 'PNG sequence', kind: 'export', group: 'primary', enabled: available, run: () => exportFile('sequence') },
            { id: 'frame', button: 'exportFrame', label: 'Current frame', kind: 'export', group: 'primary', enabled: available, run: () => exportFile('frame') },
            { id: 'copy-preset', button: 'copyPreset', label: 'Save as', kind: 'command', group: 'extra', shortcut: 'mod+shift+s', run: () => library.saveCopy() },
            { id: 'json-export', button: 'downloadPreset', label: 'Export JSON', kind: 'export', group: 'extra', shortcut: 'mod+j', run: () => library.download() },
            { id: 'json-import', button: 'importPreset', label: 'Import JSON', kind: 'import', group: 'extra', shortcut: 'mod+shift+j', run: () => library.intake.open() },
            { id: 'save-preset', label: 'Save preset', kind: 'command', group: 'keyboard', shortcut: 'mod+s', run: () => app.savePreset() },
            { id: 'play', label: 'Play / pause', kind: 'command', group: 'keyboard', shortcut: 'space', run: play },
            { id: 'previous', label: 'Previous frame', kind: 'command', group: 'keyboard', shortcut: 'arrowleft', run: () => seek(frame - 1), repeat: true },
            { id: 'next', label: 'Next frame', kind: 'command', group: 'keyboard', shortcut: 'arrowright', run: () => seek(frame + 1), repeat: true }
        ] }).init();
        document.querySelector('[data-shortcut-help-popup]').append($('textHelpTemplate').content.cloneNode(true));
        const contentPanel = $('contentPanel'), contentBody = contentPanel.querySelector('.panel-content');
        observer = new ResizeObserver(() => {
            const panelRect = contentPanel.getBoundingClientRect();
            document.querySelector('.erik').style.setProperty('--content-height', `${panelRect.height}px`);
            if (!contentPanel.classList.contains('panel-collapsed') && !$('crawlContent').hidden) {
                // Measure fixed space above/below Text, independent of its current resized height.
                const offset = $('bodyInput').getBoundingClientRect().top - panelRect.top + contentBody.scrollTop
                    + parseFloat(getComputedStyle(contentBody).paddingBottom) + parseFloat(getComputedStyle(contentPanel).paddingBottom);
                contentPanel.style.setProperty('--text-editor-offset', `${Math.ceil(offset)}px`);
            }
            app.target.fitToScreen();
        });
        observer.observe($('canvasContainer')); observer.observe(contentPanel);
        observer.observe(contentBody.querySelector('details')); observer.observe($('crawlContent')); observer.observe($('endingContent'));
        sync(app); app.target.fitToScreen(); ready = true; void ensureEnding(); ui.refresh(); refreshTransport(); saveDraft(); status(startupNotice);
        probeVideo().then(result => { videoSupported = result.supported; $('exportMp4').title = result.message; if (!result.supported) status(result.message); ui.refresh(); });
    }
});
try { await animation.load(); renderer = animation.createRenderer(); await tool.init(); }
catch (error) { status(error.message); }
window.addEventListener('pagehide', event => {
    pausePlayback(); exporter.cancel(); clearTimeout(saveTimer); if (ready) persistDraft();
    if (event.persisted) return;
    endingLoadVersion++; unsubscribe?.(); endingIntake?.destroy(); library?.destroy(); textEditor?.destroy(); observer?.disconnect(); events.abort(); ui?.destroy(); renderer?.destroy(); tool.destroy(); assetStorage.close();
});
export default tool;
