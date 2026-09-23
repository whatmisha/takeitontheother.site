import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseAst } from '../../../../grid_generator/tools/node_modules/rollup/dist/es/parseAst.js';
import { recolorDeclarations, solidPaint } from '../../../../calendar-randomizer/scene.js';

const root = new URL('../../../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
function nodes(source, predicate) {
    const found = [];
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (predicate(node)) found.push(source.slice(node.start, node.end));
        Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(visit) : visit(value));
    }
    visit(parseAst(source)); return found;
}
const functions = (source, names) => nodes(source, node => node.type === 'FunctionDeclaration' && names.includes(node.id.name)).join('\n');
function target() {
    const listeners = new Map();
    return { style: {}, value: '', checked: false,
        addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
        emit(type, event = {}) { listeners.get(type)?.forEach(callback => callback(event)); }
    };
}

test('Calendar recolors solid paint without erasing none, references, alpha or unrelated properties', () => {
    for (const paint of ['none', 'NONE', 'url(#gradient)', 'url("#gradient") red', 'var(--paint)', 'currentColor', 'inherit', 'transparent']) assert.equal(solidPaint(paint), false);
    for (const paint of ['#123', '#1234', '#123456', '#12345678', 'red', 'rgb(1, 2, 3)', 'rgba(1,2,3,.5)']) assert.equal(solidPaint(paint), true);
    const css = '.a { fill: #12345678; stroke: none; fill-opacity: .4; } .b{fill:url(#g);stroke: rgb(1,2,3) !important}';
    assert.equal(recolorDeclarations(css, '#abcdef'), '.a { fill: #abcdef78; stroke: none; fill-opacity: .4; } .b{fill:url(#g);stroke: #abcdef !important}');
    assert.equal(recolorDeclarations('fill:#1238;stroke:rgba(1,2,3,.5)', '#abcdef'), 'fill: #abcdef88;stroke: rgba(171, 205, 239, .5)');
    assert.equal(recolorDeclarations('fill:rgb(1 2 3 / 50%)', '#abcdef'), 'fill: rgba(171, 205, 239, 50%)');
    assert.equal(recolorDeclarations('opacity:.7; fill: none; stroke:url(#g); filter:url(#f)', '#abcdef'), 'opacity:.7; fill: none; stroke:url(#g); filter:url(#f)');
});

test('Hyperspace Center, paused inertia, canvas/UI drag and centered/off-center resize', async () => {
    let regenerations = 0;
    const context = vm.createContext({ width: 800, height: 600, windowWidth: 1200, windowHeight: 700,
        vanishingPoint: { x: 400, y: 300 }, actualVanishingPoint: { x: 400, y: 300 }, targetVanishingPoint: { x: 400, y: 300 },
        isPaused: true, inertiaFactor: .05, isMouseDragging: false, lineCount: 120, mouseX: 150, mouseY: 250,
        createStarsWithDistribution() { regenerations++; }, dist: (a,b,c,d) => Math.hypot(c-a,d-b), setTimeout() {},
        document: { querySelector: () => ({ getBoundingClientRect: () => ({ left: 900, right: 1200, top: 0, bottom: 700 }) }), getElementById: () => ({ style: {} }) }
    });
    context.resizeCanvas = (w,h) => { context.width = w; context.height = h; };
    vm.runInContext(functions(await read('hyperspace/sketch.js'), ['windowResized', 'centerVanishingPoint', 'updateVanishingPoint', 'mousePressed', 'mouseDragged', 'mouseReleased']), context);
    context.windowResized(); assert.deepEqual(context.targetVanishingPoint, { x: 600, y: 350 });
    context.mousePressed({ target: { closest: () => true } }); assert.equal(context.isMouseDragging, false);
    context.mousePressed({ target: { closest: () => null } }); assert.deepEqual(context.targetVanishingPoint, { x: 150, y: 250 });
    context.updateVanishingPoint(); assert.deepEqual(context.actualVanishingPoint, { x: 600, y: 350 });
    context.mouseX = 220; context.mouseDragged({ target: { closest: () => null } }); assert.equal(context.targetVanishingPoint.x, 220);
    context.mouseX = 400; context.mouseDragged({ target: { closest: () => true } }); assert.equal(context.targetVanishingPoint.x, 220);
    context.mouseReleased(); assert.equal(context.isMouseDragging, false);
    context.isPaused = false; context.updateVanishingPoint(); assert.equal(context.actualVanishingPoint.x, 581);
    context.windowWidth = 900; context.windowHeight = 650; context.windowResized(); assert.equal(context.targetVanishingPoint.x, 220);
    context.centerVanishingPoint(); assert.deepEqual(context.targetVanishingPoint, { x: 450, y: 325 }); assert.equal(regenerations, 3);
});

for (const end of ['mouseup', 'touchend', 'touchcancel']) {
    test(`Pattern 02 ${end} outside slider closes exactly one history transaction`, async () => {
        const elements = new Map(), document = target();
        document.getElementById = id => { if (!elements.has(id)) elements.set(id, target()); return elements.get(id); };
        const context = vm.createContext({ document, redraw() {} });
        vm.runInContext(await read('pattern_generator_02/script.js'), context);
        context.setupHTMLControls();
        const slider = elements.get('radius-slider');
        const start = end === 'mouseup' ? 'mousedown' : 'touchstart';
        slider.emit(start); slider.value = '61'; slider.emit('input'); slider.value = '62'; slider.emit('input');
        document.emit(end);
        slider.emit(start); slider.value = '73'; slider.emit('input'); document.emit(end);
        assert.equal(vm.runInContext('stateHistory.length', context), 2);
        context.undoLastChange(); assert.equal(slider.value, 62);
        context.undoLastChange(); assert.equal(slider.value, 50);
        context.redoLastChange(); assert.equal(slider.value, 62);
        context.redoLastChange(); assert.equal(slider.value, 73);
    });
}

test('Pattern 02 held keyboard and blur produce separate undo steps without mouse listeners', async () => {
    const elements = new Map(), document = target();
    document.getElementById = id => { if (!elements.has(id)) elements.set(id, target()); return elements.get(id); };
    const context = vm.createContext({ document, redraw() {} });
    vm.runInContext(await read('pattern_generator_02/script.js'), context); context.setupHTMLControls();
    const slider = elements.get('radius-slider');
    for (const value of ['51', '52', '53']) { slider.emit('keydown', { key: 'ArrowRight' }); slider.value = value; slider.emit('input'); }
    slider.emit('blur'); slider.emit('keydown', { key: 'End' }); slider.value = '100'; slider.emit('input'); slider.emit('keyup');
    assert.equal(vm.runInContext('stateHistory.length', context), 2);
    context.undoLastChange(); assert.equal(slider.value, 53); context.undoLastChange(); assert.equal(slider.value, 50);
});

test('Pattern 01 magnetic keys ignore inactive modes, editable fields, repeats and composition', async () => {
    const document = target(), canvas = target(); let active = true, redraws = 0, prevented = 0;
    document.getElementById = () => ({ classList: { contains: () => active } });
    const context = vm.createContext({ document, canvas, window: target(), fitCanvasToViewport() {}, magneticPoints: [{ x: 1 }], pointsHistory: [[{ x: 2 }]], magneticRadius: 50, magneticForce: 75, drawCanvas() { redraws++; } });
    vm.runInContext(functions(await read('pattern_generator/magnetic-rectangle.js'), ['setupMouseEvents']), context); context.setupMouseEvents();
    const event = patch => ({ key: 'z', metaKey: true, target: { closest: () => null }, preventDefault() { prevented++; }, ...patch });
    for (const patch of [{ repeat: true }, { isComposing: true }, { defaultPrevented: true }, { target: { closest: () => ({}) } }]) document.emit('keydown', event(patch));
    active = false; document.emit('keydown', event({})); document.emit('keydown', event({ key: 'Escape' }));
    assert.equal(redraws, 0); assert.equal(prevented, 0); assert.equal(context.magneticPoints[0].x, 1);
    active = true; document.emit('keydown', event({})); assert.equal(context.magneticPoints[0].x, 2); assert.equal(prevented, 1);
    document.emit('keydown', event({ key: 'Escape' })); assert.equal(context.magneticPoints.length, 0);
});

test('Random Lines rejects read/decode/late results and restores the previous source on processing errors', async () => {
    const source = await read('random_lines_generator/script.js');
    const property = nodes(source, node => node.type === 'Property' && node.key.name === 'onSelect')[0];
    let reader, image, draws = 0, broken = false;
    const oldSource = {}, oldData = {}, params = { sourceImage: oldSource, imageData: oldData, patternGenerated: false };
    const context = vm.createContext({ params, lines: [], imagePreview: { src: 'old', style: {} },
        FileReader: class { constructor() { reader = this; } readAsDataURL() {} },
        Image: class { constructor() { image = this; } },
        processUploadedImage() { params.imageData = 'new'; if (broken) throw new Error('processing'); },
        drawPattern() { draws++; }, applyRasterMode() {}
    });
    const onSelect = vm.runInContext(`({${property}}).onSelect`, context);
    const controller = { bound: true, operationId: 1 };
    let pending = onSelect({}, { controller }); reader.onerror(); await assert.rejects(pending, /read/);
    pending = onSelect({}, { controller }); reader.onload({ target: { result: 'new' } }); image.onerror(); await assert.rejects(pending, /decode/);
    for (const kind of ['unbound', 'replaced']) {
        controller.bound = true;
        pending = onSelect({}, { controller }); reader.onload({ target: { result: 'new' } });
        if (kind === 'unbound') controller.bound = false; else controller.operationId++;
        image.onload(); await assert.rejects(pending, /Cancelled/);
        assert.equal(params.sourceImage, oldSource); assert.equal(context.imagePreview.src, 'old');
    }
    controller.bound = true; broken = true;
    pending = onSelect({}, { controller }); reader.onload({ target: { result: 'new' } }); image.onload(); await assert.rejects(pending, /processing/);
    assert.equal(params.sourceImage, oldSource); assert.equal(params.imageData, oldData); assert.equal(draws, 0);
    broken = false; pending = onSelect({}, { controller }); reader.onload({ target: { result: 'new' } }); image.onload(); await pending;
    assert.equal(context.imagePreview.src, 'new'); assert.equal(draws, 1);
});

test('Random Lines preserves image priority and gradient fallback without source data', async () => {
    const source = await read('random_lines_generator/script.js');
    const context = vm.createContext({ canvas: { width: 1000, height: 500 }, lines: [{ x: 250, y: 50 }],
        params: { rasterMode: true, imageRasterMode: true, imageData: {}, zeroLineLength: 10, hundredLineLength: 110, zeroLineWidth: 1, hundredLineWidth: 11, invertImage: false, brightnessContrast: 1 },
        getPixelBrightness: () => .8
    });
    vm.runInContext(functions(source, ['applyRasterMode']), context); context.applyRasterMode();
    assert.equal(context.lines[0].length, 90);
    context.params.imageData = null; context.applyRasterMode(); assert.equal(context.lines[0].length, 35);
});

test('Calendar cancels stale template loads, rebinds once and retains original scene bases on BFCache', async () => {
    let lifecycle, start, mounted, currentSvg = null, scenes = 0, recolors = 0;
    const elements = new Map(), requests = [];
    const element = id => {
        if (!elements.has(id)) elements.set(id, Object.assign(new EventTarget(), { style: {}, value: '30', selectedOptions: [{ textContent: 'fixture' }], appendChild() {} }));
        return elements.get(id);
    };
    const context = vm.createContext({ console: { log() {}, error() {} }, AbortController,
        bindPageLifecycle: value => { lifecycle = value; },
        createCalendarScene() { scenes++; return { recolor() { recolors++; }, randomize() {}, reset() {} }; },
        requestAnimationFrame: callback => callback(), setTimeout() {},
        getSvgFiles: async () => ({ success: true, files: [{ name: 'fixture', path: 'source/calend_01.svg' }] }),
        testMount: config => { mounted = config; },
        document: { addEventListener: (_,callback) => { start = callback; }, getElementById: element, createElement: () => ({}), querySelector: () => currentSvg, querySelectorAll: () => [] },
        XMLHttpRequest: class {
            constructor() { requests.push(this); }
            open(_,path) { this.path = path; } send() {}
            abort() { this.aborted = true; this.readyState = 4; this.onreadystatechange?.(); }
            finish() { this.readyState = 4; this.status = 200; this.responseText = '<svg/>'; this.onreadystatechange(); }
        }
    });
    const source = (await read('calendar-randomizer/script.js')).replace(/^import .*;\n/gm, '')
        .replace("import('../infra/framework/src/ui/GeneratorHost.js?v=7')", 'Promise.resolve({mountGenerator:testMount})');
    vm.runInContext(source, context); start(); await Promise.resolve();
    for (let i=0;i<20;i++) {
        element('svgSelector').value = `source/calend_0${i%4+1}.svg`;
        element('svgSelector').dispatchEvent(new Event('change'));
        currentSvg = { style: {}, getBoundingClientRect() {} }; requests.at(-1).finish(); await Promise.resolve();
    }
    const before = recolors; element('colorPicker').dispatchEvent(new Event('input')); assert.equal(recolors, before+1);
    assert.equal(scenes,20); assert.equal(mounted.actions.length,3);
    lifecycle.suspend(); element('randomRange').value = '53'; lifecycle.resume(); await Promise.resolve();
    assert.equal(scenes,20, 'Never recapture a mid-animation transform as base'); assert.equal(element('rangeValue').textContent,'53px');
    const resumedColors = recolors; element('colorPicker').dispatchEvent(new Event('input')); assert.equal(recolors,resumedColors+1);
    element('svgSelector').dispatchEvent(new Event('change')); const stale = requests.at(-1);
    lifecycle.suspend(); assert.equal(stale.aborted,true); stale.finish(); assert.equal(scenes,20);
    lifecycle.resume(); const fresh = requests.at(-1); assert.notEqual(fresh,stale);
    currentSvg = { style: {}, getBoundingClientRect() {} }; fresh.finish(); await Promise.resolve(); assert.equal(scenes,21);
});
