import { defineTool, UnifiedColorPicker, ToolUiController, FileIntakeController, PresetMenuKeyboardController } from '../infra/framework/src/index.js?v=tool-ui-3';
import { defaults, ranges, regenerate, toneKeys, toneCharacters, migratePresets, normalizeSettings, makeDocument, readDocument, exportDimensions } from './document.js?v=form-edit-2';
import { adjacentColors, hexRGB } from './scene.js?v=form-edit-2';
import { LandscapeRenderer } from './render.js?v=form-edit-2';

import { FormEditor } from './form-editor.js?v=form-edit-2';

let formEditor;
let renderer, ui, intake, presetKeyboard, listeners, unsubscribe, resizeObserver, panelObserver, tonePicker;
let renderFailed = false, lastSize = '';
const byId = id => document.getElementById(id);
const status = text => { byId('operationStatus').textContent = text; };
const toneHex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
function draw({ ctx2d, settings, width, height }, exporting = false) {
    try {
        renderer ||= new LandscapeRenderer();
        const transform = ctx2d.getTransform();
        const scale = exporting ? Math.abs(transform.a) : Math.min(1.5, Math.max(.5, Math.abs(transform.a)));
        const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        const surface = renderer.render(settings, w, h);
        ctx2d.drawImage(surface, 0, 0, width, height);
        if (renderFailed) status('');
        renderFailed = false;
        if (!exporting) formEditor?.draw();
    } catch (error) {
        renderFailed = true; status(error.message);
        if (exporting) throw error;
    }
}
function change(tool, updates, label = 'Edit') {
    tool.history?.flush();
    tool.history?.beginTransaction(label);
    tool.settingsStore.setMultiple(normalizeSettings({ ...tool.getSnapshot(), ...updates }));
    tool.history?.endTransaction();
    tool.unifiedColorPicker?.sync();
    sync(tool);
}
function sync(tool) {
    const s = tool.settings;
    for (const radio of document.querySelectorAll('input[name="mode"]')) radio.checked = radio.value === s.mode;
    for (const key of ['horizon','relief']) {
        byId(key+'Slider').disabled = s.mode === 'abstract'; byId(key+'Value').disabled = s.mode === 'abstract';
    }
    byId('toneCharacterSelect').value = s.toneCharacter;
    const neighbors=adjacentColors(s), strength=s.toneAmount/100;
    ['terrain','depth','light'].forEach((key,i) => {
        const base=hexRGB(s[key]);
        const css=rgb => 'rgb('+rgb.map(v => Math.round(v*255)).join(' ')+')';
        const blend=other => base.map((v,k) => v+(other[k]-v)*strength);
        byId(key+'TonePreview').style.background = 'linear-gradient(90deg,'+css(blend(neighbors[i]))+','+s[key]+','+css(blend(neighbors[i+3]))+')';
    });
    tonePicker?.sync();
    const customCount = toneKeys.filter(key => s[key] != null).length;
    byId('customToneCount').textContent = customCount ? customCount + ' custom' : '';
    for (const key of toneKeys) byId(key+'Auto').disabled = s[key] == null;
    byId('toneCharacterNote').textContent = {
        pigment:'Uneven warm and cool pigment within each form.',
        pearlescent:'Soft color shifts that flow across the surface.',
        radiant:'Brighter neighboring tones along folds and edges.'
    }[s.toneCharacter];
    byId('seedInput').value = s.seed;
    byId('widthInput').value = s.width; byId('heightInput').value = s.height;
    const size = s.width + 'x' + s.height;
    if (size !== lastSize) {
        lastSize = size;
        requestAnimationFrame(() => {
            if (!listeners?.signal.aborted) { tool.renderNow(); tool.target.fitToScreen(); }
        });
    }
    byId('exportScaleSelect').value = s.exportScale;
    byId('mainCanvas').setAttribute('aria-label', s.mode === 'abstract' ? 'Generated grainy abstract artwork' : 'Generated grainy landscape');
    formEditor?.sync();
    ui?.refresh();
}
function bind(tool) {
    listeners = new AbortController();
    const lifecycleSignal = listeners.signal;
    const on = (element, type, callback) => element.addEventListener(type, callback, { signal: listeners.signal });
    // The shared picker sees resolved colors; the document stores only explicit edits.
    tonePicker = new UnifiedColorPicker({
        containerId: 'toneColorPickerContainer',
        settings: {
            get: key => toneHex(adjacentColors(tool.settings)[toneKeys.indexOf(key)]),
            set: (key, hex) => {
                const value = hex.toUpperCase();
                const current = toneHex(adjacentColors(tool.settings)[toneKeys.indexOf(key)]);
                if (value !== current) tool.settingsStore.set(key, value);
            }
        },
        swatches: toneKeys.map(setting => ({
            type:setting, setting, itemId:setting+'ColorItem', dotId:setting+'ColorPreview',
            hexId:setting+'ColorHex', hsbSlotId:setting+'ColorHsbSlot'
        }))
    });
    tonePicker.init();
    for (const key of toneKeys) on(byId(key+'Auto'), 'click', () => change(tool, {[key]:null}, 'Automatic tone'));
    for (const radio of document.querySelectorAll('input[name="mode"]')) on(radio, 'change', () => change(tool,{ mode: radio.value },'Mode'));
    on(byId('seedInput'),'change',e => change(tool,regenerate(tool.settings,Number(e.target.value)),'Seed'));
    on(byId('toneCharacterSelect'),'change',e => change(tool,{toneCharacter:e.target.value},'Tone character'));
    const fit = () => { tool.renderNow(); tool.target.fitToScreen(); };
    byId('canvasContainer').addEventListener('wheel', event => {
        if (matchMedia('(max-width: 1000px)').matches && !event.ctrlKey && !event.metaKey) event.stopImmediatePropagation();
    }, { capture: true, passive: true, signal: listeners.signal });
    for (const key of ['width','height']) on(byId(key+'Input'),'change',e => { change(tool,{ [key]: Number(e.target.value) },'Canvas'); fit(); });
    on(byId('exportScaleSelect'),'change',e => change(tool,{exportScale: Number(e.target.value)},'Resolution'));
    unsubscribe = tool.settingsStore.subscribe('*', () => sync(tool));
    intake = new FileIntakeController({
        input: 'jsonFileInput', trigger: 'jsonPickerTrigger', accept: '.json,application/json', maxBytes: 1024*1024,
        errorText: error => error.message || 'Could not read settings.',
        onSelect: async file => {
            const settings = readDocument(JSON.parse(await file.text()));
            if (lifecycleSignal.aborted) return;
            change(tool,settings,'Import JSON'); tool.applySnapshot(tool.getSnapshot()); fit(); status('Settings imported.');
        }, onError: error => status(error.message || 'Could not import settings.'),
        onReject: result => status(result.message)
    }).init();
    formEditor = new FormEditor(tool,change).init();
    on(byId('editFormsBtn'),'click',() => formEditor.toggle());
    presetKeyboard = new PresetMenuKeyboardController().init();
    ui = new ToolUiController({
        id: 'grainy_land', title: 'Grainy Land',
        summaries: {
            compositionPanel: () => tool.settings.mode + ' · ' + tool.settings.seed,
            materialPanel: () => toneCharacters[tool.settings.toneCharacter] + ' · Tones ' + tool.settings.toneAmount
        },
        actions: [
            { id:'edit-forms', label:'Edit forms', kind:'command', group:'keyboard', shortcut:'e', run: () => formEditor.toggle() },
            { id:'generate', button:'generateBtn', label:'Generate', kind:'command', group:'utility', shortcut:'r',
                run: () => { change(tool,regenerate(tool.settings,crypto.getRandomValues(new Uint32Array(1))[0]),'Generate'); status(''); } },
            { id:'png', button:'exportPngBtn', label:'Export PNG', kind:'export', group:'primary', shortcut:'mod+e',
                run: async () => {
                    exportDimensions(tool.settings); status('Rendering PNG…');
                    try { await tool.exportPNG('grainy-land-'+tool.settings.seed+'.png',tool.settings.exportScale); status('PNG exported.'); }
                    finally { tool.render(); }
                } },
            { id:'json-export', button:'exportJsonBtn', label:'Export JSON', kind:'export', group:'extra', shortcut:'mod+j',
                run: () => tool.exporter.exportJSON(makeDocument(tool.getSnapshot()),'grainy-land-'+tool.settings.seed+'.json') },
            { id:'json-import', button:'importJsonBtn', label:'Import JSON', kind:'import', group:'extra', shortcut:'mod+shift+j', run: () => intake.open() },
            { id:'undo', label:'Undo', kind:'command', group:'keyboard', shortcut:'mod+z', run: () => tool.undo() },
            { id:'redo', label:'Redo', kind:'command', group:'keyboard', shortcut:'mod+shift+z', run: () => tool.redo() }
        ], onError: error => status(error.message || 'Operation failed.')
    }).init();
    resizeObserver = new ResizeObserver(() => fit()); resizeObserver.observe(byId('canvasContainer'));
    // CSS owns the default stack; inline positions from dragging take precedence.
    panelObserver = new ResizeObserver(([entry]) => {
        const height = entry.target.getBoundingClientRect().height;
        document.querySelector('.grainy-land').style.setProperty('--canvas-panel-height', height + 'px');
    });
    panelObserver.observe(byId('canvasPanel'));
    sync(tool);
    document.documentElement.dataset.ready = 'true';
}
const app = defineTool({
    renderer: 'canvas',
    dom: { canvas:'canvasContainer',surface:'mainCanvas',zoomIndicator:'zoomIndicator',
        presetDropdown:'presetDropdown',presetToggle:'presetDropdownToggle',presetMenu:'presetDropdownMenu',
        saveBtn:'savePresetBtn',shareBtn:'presetToolbarShareBtn' },
    settings: defaults,
    controls: { sliders: Object.entries(ranges).map(([setting,[min,max,step]]) => ({
        id:setting+'Slider', valueId:setting+'Value',setting,min,max,decimals:step<1?1:0,baseStep:step,shiftStep:step*10
    })), toggles:false },
    panels: ['canvas','composition','material'].map(name => ({id:name+'Panel',headerId:name+'PanelHeader',persistent:true})),
    colorPickers: { containerId:'unifiedColorPickerContainer',swatches:['sky','terrain','depth','light'].map(setting => ({
        type:setting,setting,itemId:setting+'ColorItem',dotId:setting+'ColorPreview',hexId:setting+'ColorHex',hsbSlotId:setting+'ColorHsbSlot'
    })) },
    presets: { migrate:migratePresets, storageKey:'upgrade:grainy_land:presets:v1',basePath:'./presets',defaultName:'Ember',
        colorDots: s => [s.sky,s.terrain,s.depth,s.light].map(value => ({kind:'solid',value})),
        suggestSaveName: tool => 'Landscape '+tool.settings.seed },
    history: { maxSize:60,debounceMs:150 },
    share: {}, shortcuts: false, dialog: {},
    export: { filename:'grainy-land.svg' },
    zoom: { fitPadding:{top:16,right:16,bottom:16,left:16} },
    restore: (tool,snap) => tool.settingsStore.fromJSON(normalizeSettings(snap),true),
    applyPreset: (tool,blob) => tool.settingsStore.fromJSON(normalizeSettings(blob),true),
    syncControls: sync,
    render: context => draw(context),
    renderTo: context => draw(context,true),
    onReady: bind,
    onDestroy: () => {
        formEditor?.destroy(); formEditor=null;
        listeners?.abort(); unsubscribe?.(); resizeObserver?.disconnect(); panelObserver?.disconnect(); intake?.destroy();
        presetKeyboard?.destroy(); ui?.destroy(); renderer?.destroy(); renderer=null; ui=null; tonePicker=null;
        delete document.documentElement.dataset.ready;
    }
});
await app.init();
export { app };
