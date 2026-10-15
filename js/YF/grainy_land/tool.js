import {MotionPlayback} from './motion-playback.js?v=gpu-perf-1';
import {jsonExportName} from './export-naming.js?v=preset-export-1';
import {MAX_DOCUMENT_BYTES} from './layer-limits.js?v=petal-motion-1';
import { ExportProgress } from './export-progress.js?v=petal-motion-1';
import { ObjectUI } from './object-ui.js?v=petal-motion-1';
import { modeLabels } from './object-model.js?v=petal-motion-1';
import { PrintColor } from './print-color.js?v=petal-motion-1';
import { motionFrame, renderVideo } from './motion.js?v=gpu-perf-1';
import { CustomColorEditor } from './custom-color-editor.js?v=petal-motion-1';
import { editCanvas } from './canvas-size.js?v=petal-motion-1';
import { renderPNG } from './png-export.js?v=petal-motion-1';
import { renderLayersZIP } from './layers-export.js?v=petal-motion-1';
import { downloadBlob } from '../infra/framework/src/ui/GeneratorHost.js?v=petal-motion-1';
import { defineTool, UnifiedColorPicker, ToolUiController, FileIntakeController, PresetMenuKeyboardController } from '../infra/framework/src/index.js?v=petal-motion-1';
import { defaults, ranges, switchMode, regenerate, toneKeys, migratePresets, normalizeSettings, makeDocument, readDocument, exportDimensions } from './document.js?v=flower-flow-1';
import { adjacentColors, hexRGB } from './scene.js?v=petal-motion-1';
import { LandscapeRenderer } from './render.js?v=layers-polish-1';

import { getLayers } from './layer-data.js?v=petal-motion-1';
import { FormEditor } from './form-editor.js?v=layers-polish-1';
import { editableTarget, visibleDialog } from '../infra/framework/src/ui/CommandPolicy.js?v=2';

const printColor=new PrintColor();
let motionStart=null,motionView=null,playback=null,motionRenderer=null;
let formEditor, customColorEditor, objectUi;
let renderer, ui, exportProgress, intake, presetKeyboard, listeners, unsubscribe, resizeObserver, panelObserver, panelPositionObserver, tonePicker;
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
        const ready=!exporting&&motionStart!=null?playback?.frame:null;
        const animated=ready?.settings??settings;
        const transparent=!settings.backgroundVisible||(exporting?settings.transparentBackground:settings.previewTransparent&&!settings.softProof);
        if(!exporting)motionView={settings,w,h,transparent};
        let surface = ready?.surface??renderer.render(animated, w, h, 0, transparent);
        if(!exporting&&settings.softProof&&printColor.profile)surface=printColor.proof(surface,settings.printIntent);
        if(!exporting&&transparent&&!settings.softProof){const size=12/Math.max(.01,Math.abs(transform.a));ctx2d.fillStyle='#555';ctx2d.fillRect(0,0,width,height);ctx2d.fillStyle='#777';for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size)if((Math.floor(x/size)+Math.floor(y/size))%2===0)ctx2d.fillRect(x,y,size,size);}
        ctx2d.drawImage(surface, 0, 0, width, height);
        if (renderFailed) status('');
        renderFailed = false;
        if (!exporting) formEditor?.draw(animated,{animated:motionStart!=null,prepared:ready?.prepared});
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
        byId(key+'Slider').disabled = s.mode !== 'landscape'; byId(key+'Value').disabled = s.mode !== 'landscape';
        byId(key+'Slider').closest('.control-group').hidden=s.mode!=='landscape';
    }
    byId('flowerComposition').hidden=s.mode!=='f';byId('fType').value=s.fType;
    byId('floraComposition').hidden=s.mode!=='flora';byId('floraLayout').value=s.floraLayout;
    for(const key of ['scale','complexity','flow','folds'])byId(key+'Slider').closest('.control-group').hidden=['flora','f'].includes(s.mode);
    byId('newBlueLayers').hidden=s.mode!=='abstract';
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
    if(exportAction)exportAction.label=s.exportLayers?'ZIP':'PNG';
    byId('mainCanvas').setAttribute('aria-label', s.mode === 'f' ? 'Generated grainy Flora artwork' : s.mode === 'flora' ? 'Generated grainy Plant artwork' : s.mode === 'abstract' ? 'Generated grainy Spot artwork' : 'Generated grainy landscape');
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
    for (const radio of document.querySelectorAll('input[name="mode"]')) on(radio, 'change', () => change(tool,switchMode(tool.settings,radio.value),'Mode'));
    on(byId('fType'),'change',()=>change(tool,{fType:byId('fType').value},'Flower type'));
    on(byId('floraLayout'),'change',()=>change(tool,{floraLayout:byId('floraLayout').value},'Plant arrangement'));
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
    on(byId('transparentBackground'),'change',e=>change(tool,{transparentBackground:e.target.checked},'No background'));
    on(byId('exportLayers'),'change',e=>change(tool,{exportLayers:e.target.checked},'Export layers'));
    customColorEditor = new CustomColorEditor(tool,change,status).init();
    unsubscribe = tool.settingsStore.subscribe('*', () => sync(tool));
    intake = new FileIntakeController({
        input: 'jsonFileInput', trigger: 'jsonPickerTrigger', accept: '.json,application/json', maxBytes: MAX_DOCUMENT_BYTES,
        errorText: error => error.message || 'Could not read settings.',
        onSelect: async file => {
            const settings = readDocument(JSON.parse(await file.text()));
            if (lifecycleSignal.aborted) return;
            change(tool,settings,'Import JSON'); tool.applySnapshot(tool.getSnapshot()); fit(); status('Settings imported.');
        }, onError: error => status(error.message || 'Could not import settings.'),
        onReject: result => status(result.message)
    }).init();
    formEditor = new FormEditor(tool,change).init();
    objectUi = new ObjectUI(tool,change,formEditor).init();formEditor.objectUI=objectUi;
    for(const key of ['previewTransparent','softProof'])on(byId(key),'change',()=>change(tool,{[key]:byId(key).checked},'Preview'));
    for(const key of ['printIntent','motionAmount','motionDuration'])on(byId(key),'change',()=>change(tool,{[key]:Number(byId(key).value)},'Output settings'));
    on(byId('loadICC'),'click',()=>byId('iccFile').click());
    on(byId('iccFile'),'change',async()=>{const file=byId('iccFile').files[0];if(!file)return;try{if(file.size>4*1024*1024)throw Error('ICC profiles are limited to 4 MiB.');const profile=await printColor.load(new Uint8Array(await file.arrayBuffer()),file.name);byId('iccName').textContent=profile.name+' · '+profile.space;byId('softProof').disabled=false;byId('exportTIFF').disabled=false;tool.render();status('ICC profile loaded for this session.');}catch(error){status(error.message);}finally{byId('iccFile').value='';}});
    const stopMotion=()=>{
        if(motionStart==null)return;
        motionStart=null;playback?.stop();motionRenderer?.destroy();motionRenderer=null;
        byId('playMotion').textContent='Play';byId('playMotion').setAttribute('aria-pressed','false');tool.renderNow();
    };
    playback=new MotionPlayback({
        getContext:()=>motionView,
        renderFrame:async({settings,w,h,transparent},phase,{signal})=>{
            const activeRenderer=motionRenderer ||= new LandscapeRenderer();
            const animated=motionFrame(settings,phase);
            const surface=await activeRenderer.renderAsync(animated,w,h,0,transparent,-1,null,{signal});
            return {surface,settings:animated,prepared:activeRenderer.preparedFrame};
        },
        present:()=>tool.renderNow(),
        onError:error=>{stopMotion();status(error.message);}
    });
    const toggleMotion=()=>{
        if(motionStart!=null){stopMotion();return;}
        formEditor.select(null);motionStart=performance.now();byId('playMotion').textContent='Stop';byId('playMotion').setAttribute('aria-pressed','true');
        tool.renderNow();playback.start();
    };
    // Defer a Space tap until release so Space + drag keeps panning without starting playback.
    let motionTap=false;
    const canToggleMotion=event=>!event.isComposing&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.shiftKey
        &&!editableTarget(event.target)&&!visibleDialog(document)&&!exportProgress?.busy
        &&(!event.target.closest?.('button,a[href],summary,[role="button"]')||event.target.closest?.('#playMotion'))
        &&!formEditor.gesture&&!formEditor.reorderGesture&&!formEditor.vector?.drag&&!formEditor.vector?.penDrag&&!formEditor.flora?.drag;
    on(document,'pointerdown',event=>{motionTap=false;if(!event.target.closest('#playMotion'))stopMotion();},{capture:true});
    on(document,'keydown',event=>{
        if(event.code==='Space'&&canToggleMotion(event)&&!event.defaultPrevented){
            event.preventDefault();if(!event.repeat)motionTap=true;return;
        }
        motionTap=false;stopMotion();
    },{capture:true});
    on(document,'keyup',event=>{
        if(event.code!=='Space')return;
        const toggle=motionTap;motionTap=false;
        if(toggle&&canToggleMotion(event)){event.preventDefault();toggleMotion();}
    },{capture:true});
    on(window,'blur',()=>{motionTap=false;});
    on(byId('playMotion'),'click',toggleMotion);

    exportProgress=new ExportProgress({container:byId('exportActions'),status:byId('exportStatus'),progress:byId('exportProgress'),message:byId('exportMessage'),cancelButton:byId('cancelExport'),onChange:()=>ui?.refresh()});
    const output=(signal,label,operation)=>{
        status('');const snapshot=tool.getSnapshot();
        return exportProgress.run({signal,label},async context=>{
            const exportRenderer=new LandscapeRenderer();
            try{return await operation(exportRenderer,snapshot,context);}finally{exportRenderer.destroy();tool.render();}
        });
    };
    presetKeyboard = new PresetMenuKeyboardController().init();
    ui = new ToolUiController({
        id: 'grainy_land', title: 'Grainy Land',
        summaries: {
            compositionPanel: () => modeLabels[tool.settings.mode],
            layersPanel: () => {const count=getLayers(tool.settings).length;return count+' '+(count===1?'layer':'layers');}
        },
        actions: [
            { id:'tool-erase', label:'Erase', kind:'command', group:'keyboard', shortcut:'e', run: () => formEditor.setTool('erase') },
            { id:'tool-brush', label:'Brush', kind:'command', group:'keyboard', shortcut:'b', run: () => formEditor.setTool('paint') },
            { id:'tool-pen', label:'Pen', kind:'command', group:'keyboard', shortcut:'p', run:()=>formEditor.vector.startPen() },
            { id:'tool-move', label:'Move', kind:'command', group:'keyboard', shortcut:'v', run: () => formEditor.setTool('move') },
            ...[[-2,'[','Send to back / Smaller brush'],[2,']','Bring to front / Larger brush']].map(([step,shortcut,label])=>({
                id:step<0?'layer-to-back':'layer-to-front',label,kind:'command',group:'keyboard',shortcut,repeat:true,
                enabled:()=>!formEditor.gesture&&!formEditor.vector?.drag&&!formEditor.vector?.penDrag&&!formEditor.flora?.drag&&!formEditor.reorderGesture,
                run:()=>['paint','erase'].includes(formEditor.paintTool)&&!formEditor.vector.pen&&!formEditor.vector.editing&&!formEditor.flora.editing?formEditor.setBrushSize(formEditor.brushSize+step):formEditor.edgeLayer(step)
            })),
            { id:'layer-duplicate',label:'Duplicate layer',kind:'command',group:'keyboard',shortcut:'shift+d',enabled:()=>formEditor.canChangeLayer(),run:()=>formEditor.duplicateSelected() },
            ...['delete','backspace'].map(shortcut=>({id:'layer-'+shortcut,label:'Delete layer',kind:'command',group:'keyboard',shortcut,run:()=>formEditor.deleteSelected()})),
            // Consume browser-history keys even without a selection; shiftLayer guards editing state.
            ...[[-1,'mod+[','Send layer backward'],[1,'mod+]','Bring layer forward']].map(([delta,shortcut,label])=>({id:delta<0?'layer-backward':'layer-forward',label,kind:'command',group:'keyboard',shortcut,repeat:true,run:()=>formEditor.shiftLayer(delta)})),
            { id:'generate', button:'generateBtn', label:'Regenerate', kind:'command', group:'utility', shortcut:'r',
                run: () => { change(tool,regenerate(tool.settings,crypto.getRandomValues(new Uint32Array(1))[0]),'Regenerate'); status(''); } },
            { id:'png', button:'exportPngBtn', label:'PNG', kind:'export', group:'primary', shortcut:'mod+e', enabled:()=>!exportProgress.busy,
                run: ({signal}) => output(signal,tool.settings.exportLayers?'ZIP':'PNG',async(r,s,{signal,onProgress})=>{
                    exportDimensions(s);
                    if(s.exportLayers){
                        const {blob}=await renderLayersZIP(r,s,{signal,onProgress:({current,total})=>onProgress({current,total,message:'Layers · '+current+' / '+total})});
                        signal.throwIfAborted();downloadBlob(blob,'grainy-land-'+s.seed+'-layers.zip');
                    }else{
                        const {blob}=await renderPNG(r,s,{signal,onProgress});
                        signal.throwIfAborted();downloadBlob(blob,'grainy-land-'+s.seed+'.png');
                    }
                }) },
            { id:'print-tiff',button:'exportTIFF',label:'Export print TIFF',kind:'export',group:'panel',enabled:()=>!!printColor.profile&&!exportProgress.busy,
                run:({signal})=>output(signal,'TIFF',async(r,s,{signal,onProgress})=>{
                    const {blob}=await printColor.export(r,s,{signal,onProgress});signal.throwIfAborted();downloadBlob(blob,'grainy-land-'+s.seed+'.tif');
                }) },
            { id:'motion-video',button:'exportMotion',label:'MP4',kind:'export',group:'primary',enabled:()=>!exportProgress.busy,
                run:({signal})=>output(signal,'MP4',async(r,s,{signal,onProgress})=>{
                    const result=await renderVideo(r,s,{signal,onProgress});
                    signal.throwIfAborted();downloadBlob(result.blob,'grainy-land-'+s.seed+'.'+result.extension);
                }) },
            { id:'json-export', button:'exportJsonBtn', label:'Export JSON', kind:'export', group:'extra', shortcut:'mod+j',
                run: () => tool.exporter.exportJSON(makeDocument(tool.getSnapshot()),jsonExportName(tool.settings,tool.presets)) },
            { id:'json-import', button:'importJsonBtn', label:'Import JSON', kind:'import', group:'extra', shortcut:'mod+shift+j', run: () => intake.open() },
            { id:'undo', label:'Undo', kind:'command', group:'keyboard', shortcut:'mod+z', run: () => tool.undo() },
            { id:'redo', label:'Redo', kind:'command', group:'keyboard', shortcut:'mod+shift+z', run: () => tool.redo() }
        ], onError: (error,action) => {if(!['png','motion-video','print-tiff'].includes(action?.id))status(error.message || 'Operation failed.');}
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
        const properties={canvasPanel:'--canvas-panel-height',layersPanel:'--layers-panel-height',layerPanel:'--layer-panel-height',animationPanel:'--animation-panel-height'};
        for(const entry of entries)root.style.setProperty(properties[entry.target.id],entry.target.getBoundingClientRect().height+'px');
        updateLayerDock();
        formEditor?.drawThumbs();
    });
    for(const id of ['canvasPanel','layersPanel','layerPanel','animationPanel'])panelObserver.observe(byId(id));
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
    controls: { sliders: Object.entries(ranges).filter(([key])=>!['floraCount','fCount','fDensity'].includes(key)).map(([setting,[min,max,step]]) => ({
        id:setting+'Slider', valueId:setting+'Value',setting,min,max,decimals:step<1?1:0,baseStep:step,shiftStep:step*10
    })), toggles:false },
    panels: ['canvas','composition','material','layers','layer','tools','animation'].map(name => ({id:name+'Panel',headerId:name+'PanelHeader',persistent:true})),
    colorPickers: { containerId:'unifiedColorPickerContainer',swatches:['sky','terrain','depth','light'].map(setting => ({
        type:setting,setting,itemId:setting+'ColorItem',dotId:setting+'ColorPreview',hexId:setting+'ColorHex',hsbSlotId:setting+'ColorHsbSlot'
    })) },
    presets: { migrate:async store => {
        // Refresh named built-ins from their shipped files; personal copies stay intact.
        const shipped={};
        for(const [name,file] of [['Ember','ember.json'],['Drift','drift.json'],['Field','field.json'],['Six Cup','six-cup.json'],['Flower Flow','flower-flow.json']]){
        if(store.loadAll()?.[name]?.seeded!==true && !(name==='Six Cup' && store.loadAll()?.['Six cup']?.seeded===true))continue;
        try{
            const response=await fetch('./presets/'+file,{cache:'no-cache',signal:AbortSignal.timeout(5000)});
            if(!response.ok)throw new Error('HTTP '+response.status);
            shipped[name]=normalizeSettings(await response.json());
        }catch(error){console.warn('Could not refresh built-in '+name+':',error);}
        }
        migratePresets(store,shipped);
    }, storageKey:'upgrade:grainy_land:presets:v1',basePath:'./presets',forceSeed:true,defaultName:'Flower Flow',
        colorDots: s => [s.sky,s.terrain,s.depth,s.light].map(value => ({kind:'solid',value})),
        suggestSaveName: tool => modeLabels[tool.settings.mode]+' '+tool.settings.seed },
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
        motionStart=null;playback?.stop();playback=null;motionView=null;motionRenderer?.destroy();motionRenderer=null;printColor.clear();
        objectUi?.destroy();objectUi=null;formEditor?.destroy(); formEditor=null;customColorEditor?.destroy();customColorEditor=null;
        listeners?.abort(); unsubscribe?.(); resizeObserver?.disconnect(); panelObserver?.disconnect(); panelPositionObserver?.disconnect(); intake?.destroy();
        exportProgress?.destroy();exportProgress=null;presetKeyboard?.destroy(); ui?.destroy(); renderer?.destroy(); renderer=null; ui=null; tonePicker=null;
        delete document.documentElement.dataset.ready;
    }
});
await app.init();
export { app };
