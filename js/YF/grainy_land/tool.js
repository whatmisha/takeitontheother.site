import { PrintColor } from './print-color.js?v=studio-1';
import { motionFrame, renderVideo } from './motion.js?v=studio-1';
import { CustomColorEditor } from './custom-color-editor.js?v=studio-1';
import { editCanvas } from './canvas-size.js?v=studio-1';
import { renderPNG } from './png-export.js?v=studio-1';
import { renderLayersZIP } from './layers-export.js?v=studio-1';
import { downloadBlob } from '../infra/framework/src/ui/GeneratorHost.js?v=7';
import { defineTool, UnifiedColorPicker, ToolUiController, FileIntakeController, PresetMenuKeyboardController } from '../infra/framework/src/index.js?v=tool-ui-4';
import { defaults, ranges, regenerate, toneKeys, migratePresets, normalizeSettings, makeDocument, readDocument, exportDimensions } from './document.js?v=studio-1';
import { adjacentColors, hexRGB } from './scene.js?v=studio-1';
import { LandscapeRenderer } from './render.js?v=studio-1';

import { getLayers } from './layer-data.js?v=studio-1';
import { FormEditor } from './form-editor.js?v=studio-1';

const printColor=new PrintColor();
let motionStart=null,motionRAF=0;
let formEditor, customColorEditor;
let renderer, ui, intake, presetKeyboard, listeners, unsubscribe, resizeObserver, panelObserver, panelPositionObserver, tonePicker;
let renderFailed = false, lastSize = '';
const byId = id => document.getElementById(id);
const status = text => { byId('operationStatus').textContent = text; };
const toneHex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
function draw({ ctx2d, settings, width, height }, exporting = false) {
    try {
        renderer ||= new LandscapeRenderer();
        const transform = ctx2d.getTransform();
        const scale = exporting ? Math.abs(transform.a) : Math.min(1.5, Math.max(.5, Math.abs(transform.a)),4096/Math.max(width,height),Math.sqrt(8388608/(width*height)));
        const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        const animated=!exporting&&motionStart!=null?motionFrame(settings,(performance.now()-motionStart)/1000/settings.motionDuration):settings;
        const transparent=exporting?settings.transparentBackground:settings.previewTransparent&&!settings.softProof;
        let surface = renderer.render(animated, w, h, 0, transparent);
        if(!exporting&&settings.softProof&&printColor.profile)surface=printColor.proof(surface,settings.printIntent);
        if(!exporting&&transparent){const size=12/Math.max(.01,Math.abs(transform.a));ctx2d.fillStyle='#555';ctx2d.fillRect(0,0,width,height);ctx2d.fillStyle='#777';for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size)if((Math.floor(x/size)+Math.floor(y/size))%2===0)ctx2d.fillRect(x,y,size,size);}
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
    const next=normalizeSettings({...tool.getSnapshot(),...updates});
    if(JSON.stringify(next)===JSON.stringify(tool.getSnapshot())){sync(tool);return;}
    tool.history?.flush();
    tool.history?.beginTransaction(label);
    try {
        // Dimensions, units and DPI must arrive together: per-key notifications
        // would briefly expose a millimetre document without physical dimensions.
        tool.applySnapshot(next);
        tool.presets?.markDirty();
    } finally {tool.history?.endTransaction();}
}

function sync(tool) {
    const s = tool.settings;
    for (const radio of document.querySelectorAll('input[name="mode"]')) radio.checked = radio.value === s.mode;
    for (const key of ['horizon','relief']) {
        byId(key+'Slider').disabled = s.mode === 'abstract'; byId(key+'Value').disabled = s.mode === 'abstract';
        byId(key+'Slider').closest('.control-group').hidden=s.mode==='abstract';
    }
    byId('toneCharacterSelect').value = s.toneCharacter;
    const neighbors=adjacentColors(s), strength=s.toneAmount/100;
    ['sky','terrain','depth','light'].forEach(key => {
        const base=hexRGB(s[key]);
        const css=rgb => 'rgb('+rgb.map(v => Math.round(v*255)).join(' ')+')';
        const amount=strength*(key==='sky'?s.skyToneAmount/100:1);
        const blend=other => base.map((v,k) => v+(other[k]-v)*amount);
        byId(key+'TonePreview').style.background = 'linear-gradient(90deg,'+css(blend(neighbors[toneKeys.indexOf(key+'Low')]))+','+s[key]+','+css(blend(neighbors[toneKeys.indexOf(key+'High')]))+')';
    });
    tonePicker?.sync();
    customColorEditor?.sync();
    const customCount = toneKeys.filter(key => s[key] != null).length;
    byId('customToneCount').textContent = customCount ? customCount + ' custom' : '';
    for (const key of toneKeys) byId(key+'Auto').disabled = s[key] == null;
    byId('toneCharacterSelect').title = {
        pigment:'Uneven warm and cool pigment within each form.',
        pearlescent:'Soft color shifts that flow across the surface.',
        radiant:'Brighter neighboring tones along folds and edges.'
    }[s.toneCharacter];
    for(const key of ['glowCoverage','halo'])byId(key+'Slider').closest('.control-group').hidden=s.glow===0;
    byId('seedInput').value = s.seed;
    const print=s.canvasUnit==='mm';
    byId('canvasUnitSelect').value=s.canvasUnit;byId('printControls').hidden=!print;byId('exportScaleRow').hidden=print;
    byId('dpiInput').value=s.dpi;
    for(const axis of ['width','height']) {
        const input=byId(axis+'Input'),mmKey=axis==='width'?'printWidthMM':'printHeightMM';
        input.min=print?'.01':'1';input.max=print?'6000':'32768';input.step=print?'.01':'1';
        input.value=print?Number(s[mmKey].toFixed(3)):s[axis];
        byId(axis+'InputLabel').textContent=(axis==='width'?'Width, ':'Height, ')+s.canvasUnit;
    }
    byId('printSizeNote').textContent=print?s.width+' × '+s.height+' px · '+s.dpi+' DPI':'';
    try {exportDimensions(s);byId('canvasSizeError').textContent='';}catch(error){byId('canvasSizeError').textContent=error.message;}
    const size = s.width + 'x' + s.height;
    if (size !== lastSize) {
        lastSize = size;
        requestAnimationFrame(() => {
            if (!listeners?.signal.aborted) { tool.renderNow(); tool.target.fitToScreen(); }
        });
    }
    byId('exportScaleSelect').value = s.exportScale;
    for(const key of ['previewTransparent','softProof'])byId(key).checked=s[key];
    for(const key of ['printIntent','motionAmount','motionDuration'])byId(key).value=s[key];
    byId('exportLayers').checked=s.exportLayers;
    byId('transparentBackground').checked=s.transparentBackground;
    const exportAction=ui?.actions.find(action=>action.id==='png');
    if(exportAction)exportAction.label=s.exportLayers?'Export ZIP':'Export PNG';
    byId('mainCanvas').setAttribute('aria-label', s.mode === 'abstract' ? 'Generated grainy abstract artwork' : 'Generated grainy landscape');
    formEditor?.sync();
    ui?.refresh();
}
function bind(tool) {
    listeners = new AbortController();
    const lifecycleSignal = listeners.signal;
    const on = (element, type, callback, options={}) => element.addEventListener(type, callback, { ...options, signal: listeners.signal });
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
    const applyCanvas=patch=>{
        try {change(tool,editCanvas(tool.settings,patch),'Canvas');}
        catch(error){sync(tool);byId('canvasSizeError').textContent=error.message;}
    };
    on(byId('canvasUnitSelect'),'change',e=>applyCanvas({canvasUnit:e.target.value}));
    for(const key of ['width','height','dpi']) {
        const input=byId(key+'Input'),apply=()=>{
            const value=Number(input.value);
            if(!input.value.trim()||!Number.isFinite(value)||value<Number(input.min)||value>Number(input.max)){
                sync(tool);byId('canvasSizeError').textContent='Enter a value from '+input.min+' to '+input.max+'.';return;
            }
            const property=key==='dpi'?'dpi':tool.settings.canvasUnit==='mm'?(key==='width'?'printWidthMM':'printHeightMM'):key;
            // Keep the exact stored mm value when a rounded display is just focused and blurred.
            const displayed=property.startsWith('print')?Number(tool.settings[property].toFixed(3)):tool.settings[property];
            if(value!==displayed)applyCanvas({[property]:value});
        };
        on(input,'change',apply);on(input,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
    }
    on(byId('exportScaleSelect'),'change',e=>applyCanvas({exportScale:Number(e.target.value)}));
    on(byId('transparentBackground'),'change',e=>change(tool,{transparentBackground:e.target.checked},'Transparent PNG'));
    on(byId('exportLayers'),'change',e=>change(tool,{exportLayers:e.target.checked},'Export layers'));
    customColorEditor = new CustomColorEditor(tool,change,status).init();
    unsubscribe = tool.settingsStore.subscribe('*', () => sync(tool));
    intake = new FileIntakeController({
        input: 'jsonFileInput', trigger: 'jsonPickerTrigger', accept: '.json,application/json', maxBytes: 4*1024*1024,
        errorText: error => error.message || 'Could not read settings.',
        onSelect: async file => {
            const settings = readDocument(JSON.parse(await file.text()));
            if (lifecycleSignal.aborted) return;
            change(tool,settings,'Import JSON'); tool.applySnapshot(tool.getSnapshot()); fit(); status('Settings imported.');
        }, onError: error => status(error.message || 'Could not import settings.'),
        onReject: result => status(result.message)
    }).init();
    formEditor = new FormEditor(tool,change).init();
    for(const key of ['previewTransparent','softProof'])on(byId(key),'change',()=>change(tool,{[key]:byId(key).checked},'Preview'));
    for(const key of ['printIntent','motionAmount','motionDuration'])on(byId(key),'change',()=>change(tool,{[key]:Number(byId(key).value)},'Output settings'));
    on(byId('loadICC'),'click',()=>byId('iccFile').click());
    on(byId('iccFile'),'change',async()=>{const file=byId('iccFile').files[0];if(!file)return;try{if(file.size>4*1024*1024)throw Error('ICC profiles are limited to 4 MiB.');const profile=await printColor.load(new Uint8Array(await file.arrayBuffer()),file.name);byId('iccName').textContent=profile.name+' · '+profile.space;byId('softProof').disabled=false;byId('exportTIFF').disabled=false;tool.render();status('ICC profile loaded for this session.');}catch(error){status(error.message);}finally{byId('iccFile').value='';}});
    const stopMotion=()=>{if(motionStart==null)return;motionStart=null;cancelAnimationFrame(motionRAF);byId('playMotion').textContent='Play';tool.renderNow();};
    on(document,'pointerdown',event=>{if(!event.target.closest('#playMotion'))stopMotion();},{capture:true});
    on(document,'keydown',stopMotion,{capture:true});
    on(byId('playMotion'),'click',()=>{
        if(motionStart!=null){stopMotion();return;}
        formEditor.select(null);motionStart=performance.now();byId('playMotion').textContent='Stop';
        const frame=()=>{if(motionStart==null||listeners.signal.aborted)return;tool.render();motionRAF=requestAnimationFrame(frame);};frame();
    });

    presetKeyboard = new PresetMenuKeyboardController().init();
    ui = new ToolUiController({
        id: 'grainy_land', title: 'Grainy Land',
        summaries: {
            compositionPanel: () => tool.settings.mode,
            layersPanel: () => getLayers(tool.settings).length + ' layers'
        },
        actions: [
            { id:'tool-erase', label:'Erase', kind:'command', group:'keyboard', shortcut:'e', run: () => formEditor.setTool('erase') },
            { id:'tool-brush', label:'Brush', kind:'command', group:'keyboard', shortcut:'b', run: () => formEditor.setTool('paint') },
            { id:'tool-pen', label:'Pen', kind:'command', group:'keyboard', shortcut:'p', run:()=>formEditor.vector.startPen() },
            { id:'tool-move', label:'Move', kind:'command', group:'keyboard', shortcut:'v', run: () => formEditor.setTool('move') },
            ...[[-2,'[','Smaller brush'],[2,']','Larger brush']].map(([step,shortcut,label])=>({
                id:step<0?'brush-smaller':'brush-larger',label,kind:'command',group:'keyboard',shortcut,repeat:true,
                enabled:()=>formEditor.paintTool!=='move'&&!formEditor.gesture,
                run:()=>formEditor.setBrushSize(formEditor.brushSize+step)
            })),
            { id:'layer-duplicate',label:'Duplicate layer',kind:'command',group:'keyboard',shortcut:'shift+d',enabled:()=>formEditor.canChangeLayer(),run:()=>formEditor.duplicateSelected() },
            ...['delete','backspace'].map(shortcut=>({id:'layer-'+shortcut,label:'Delete layer',kind:'command',group:'keyboard',shortcut,run:()=>formEditor.deleteSelected()})),
            // Consume browser-history keys even without a selection; shiftLayer guards editing state.
            ...[[-1,'mod+[','Send layer backward'],[1,'mod+]','Bring layer forward']].map(([delta,shortcut,label])=>({id:delta<0?'layer-backward':'layer-forward',label,kind:'command',group:'keyboard',shortcut,repeat:true,run:()=>formEditor.shiftLayer(delta)})),
            { id:'generate', button:'generateBtn', label:'Generate', kind:'command', group:'utility', shortcut:'r',
                run: () => { change(tool,regenerate(tool.settings,crypto.getRandomValues(new Uint32Array(1))[0]),'Generate'); status(''); } },
            { id:'png', button:'exportPngBtn', label:'Export PNG', kind:'export', group:'primary', shortcut:'mod+e',
                run: async ({signal}) => {
                    exportDimensions(tool.settings); status('Preparing export…');
                    try {
                        const snapshot=tool.getSnapshot(),filename='grainy-land-'+snapshot.seed+'.png';
                        if(snapshot.exportLayers) {
                            // A dedicated renderer and snapshot let editing continue without restoring over new changes.
                            const exportRenderer=new LandscapeRenderer();
                            try {
                                const {blob,count}=await renderLayersZIP(exportRenderer,snapshot,{signal,
                                    onProgress:({current,total})=>status('Rendering layer '+current+' / '+total+'…')});
                                signal.throwIfAborted();
                                downloadBlob(blob,'grainy-land-'+snapshot.seed+'-layers.zip');
                                status(count+' layers exported as ZIP.');
                            } finally {exportRenderer.destroy();}
                            return;
                        }
                        const exportRenderer=new LandscapeRenderer();
                        try{const {blob}=await renderPNG(exportRenderer,snapshot,{signal,onProgress:({current,total})=>status('Rendering '+Math.round(current/total*100)+'%…')});signal.throwIfAborted();downloadBlob(blob,filename);}finally{exportRenderer.destroy();}
                        status(snapshot.transparentBackground?'Transparent PNG exported.':'PNG exported.');
                    }
                    finally { tool.render(); }
                } },
            { id:'print-tiff',button:'exportTIFF',label:'Export print TIFF',kind:'export',group:'panel',enabled:()=>!!printColor.profile,run:async({signal})=>{const r=new LandscapeRenderer();try{const snapshot=tool.getSnapshot();const {blob}=await printColor.export(r,snapshot,{signal,onProgress:({current,total})=>status('Preparing print '+Math.round(current/total*100)+'%…')});signal.throwIfAborted();downloadBlob(blob,'grainy-land-'+snapshot.seed+'.tif');status('Print TIFF exported with ICC profile.');}finally{r.destroy();}}},
            { id:'motion-video',button:'exportMotion',label:'Export video',kind:'export',group:'panel',run:async({signal})=>{const r=new LandscapeRenderer();try{const snapshot=tool.getSnapshot(),result=await renderVideo(r,snapshot,{signal,onProgress:({current,total})=>status('Recording '+Math.round(current/total*100)+'%…')});signal.throwIfAborted();downloadBlob(result.blob,'grainy-land-'+snapshot.seed+'.'+result.extension);status('Loop video exported.');}finally{r.destroy();}}},
            { id:'json-export', button:'exportJsonBtn', label:'Export JSON', kind:'export', group:'extra', shortcut:'mod+j',
                run: () => tool.exporter.exportJSON(makeDocument(tool.getSnapshot()),'grainy-land-'+tool.settings.seed+'.json') },
            { id:'json-import', button:'importJsonBtn', label:'Import JSON', kind:'import', group:'extra', shortcut:'mod+shift+j', run: () => intake.open() },
            { id:'undo', label:'Undo', kind:'command', group:'keyboard', shortcut:'mod+z', run: () => tool.undo() },
            { id:'redo', label:'Redo', kind:'command', group:'keyboard', shortcut:'mod+shift+z', run: () => tool.redo() }
        ], onError: error => status(error.message || 'Operation failed.')
    }).init();
    resizeObserver = new ResizeObserver(() => fit()); resizeObserver.observe(byId('canvasContainer'));
    // Dock properties beside Layers; a manually dragged properties panel keeps its own position.
    const updateLayerDock=()=>{
        const root=document.querySelector('.grainy-land'),rect=byId('layersPanel').getBoundingClientRect();
        root.style.setProperty('--layers-panel-left',rect.left+'px');
        root.style.setProperty('--layers-panel-top',rect.top+'px');
    };
    on(window,'resize',updateLayerDock);
    panelPositionObserver=new MutationObserver(updateLayerDock);
    panelPositionObserver.observe(byId('layersPanel'),{attributes:true,attributeFilter:['style','class']});
    panelObserver = new ResizeObserver(entries => {
        const root=document.querySelector('.grainy-land');
        const properties={canvasPanel:'--canvas-panel-height',layersPanel:'--layers-panel-height',layerPanel:'--layer-panel-height'};
        for(const entry of entries)root.style.setProperty(properties[entry.target.id],entry.target.getBoundingClientRect().height+'px');
        updateLayerDock();
        formEditor?.drawThumbs();
    });
    for(const id of ['canvasPanel','layersPanel','layerPanel'])panelObserver.observe(byId(id));
    updateLayerDock();
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
    panels: ['canvas','composition','material','layers','layer','tools'].map(name => ({id:name+'Panel',headerId:name+'PanelHeader',persistent:true})),
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
        motionStart=null;cancelAnimationFrame(motionRAF);printColor.clear();
        formEditor?.destroy(); formEditor=null;customColorEditor?.destroy();customColorEditor=null;
        listeners?.abort(); unsubscribe?.(); resizeObserver?.disconnect(); panelObserver?.disconnect(); panelPositionObserver?.disconnect(); intake?.destroy();
        presetKeyboard?.destroy(); ui?.destroy(); renderer?.destroy(); renderer=null; ui=null; tonePicker=null;
        delete document.documentElement.dataset.ready;
    }
});
await app.init();
export { app };
