import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseAst } from '../../../../grid_generator/tools/node_modules/rollup/dist/es/parseAst.js';

const root = new URL('../../../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
function functions(source) {
    const found = new Map();
    function visit(value) {
        if (!value || typeof value !== 'object') return;
        if (value.type === 'FunctionDeclaration') found.set(value.id.name, source.slice(value.start, value.end));
        Object.values(value).forEach(item => Array.isArray(item) ? item.forEach(visit) : visit(item));
    }
    visit(parseAst(source));
    return found;
}
function seededMath() {
    let state = 42;
    return Object.assign(Object.create(Math), { random() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; } });
}
function exportHarness(values = {}) {
    let blob, clicks = 0;
    const element = tag => ({ tag, attributes: {}, children: [], style: {},
        setAttribute(key, value) { this.attributes[key] = String(value); },
        appendChild(child) { this.children.push(child); }, click() { clicks++; } });
    const serialize = node => `<${node.tag}${Object.entries(node.attributes).map(([key, value]) => ` ${key}="${value}"`).join('')}>${node.children.map(serialize).join('')}</${node.tag}>`;
    const context = vm.createContext({ ...values, Math: seededMath(), Blob, setTimeout() {},
        URL: { createObjectURL(value) { blob = value; return 'blob:fixture'; }, revokeObjectURL() {} },
        document: { createElement: element, createElementNS: (_, tag) => element(tag), body: { appendChild() {}, removeChild() {} } },
        XMLSerializer: class { serializeToString(node) { return serialize(node); } }
    });
    return { context, artifact: async () => { assert.equal(clicks, 1); assert.match(blob.type, /^image\/svg\+xml/); return blob.text(); } };
}

test('Random Lines distinguishes empty, stale, partial and ready results; export follows readiness', async () => {
    const refresh = functions(await read('random_lines_generator/script.js')).get('refreshGenerationStatus');
    const params = { patternGenerated: false, lineCount: 30 }, status = {}, exportSvgBtn = {};
    const context = vm.createContext({ params, lines: [], exportSvgBtn, document: { getElementById: () => status } });
    vm.runInContext(refresh + ';refreshGenerationStatus()', context);
    assert.equal(exportSvgBtn.disabled, true); assert.match(status.textContent, /create a pattern/);
    context.lines = [{}]; vm.runInContext('refreshGenerationStatus()', context);
    assert.equal(exportSvgBtn.disabled, true); assert.match(status.textContent, /Settings changed/);
    params.patternGenerated = true; vm.runInContext('refreshGenerationStatus()', context);
    assert.equal(exportSvgBtn.disabled, false); assert.match(status.textContent, /1 \/ 30 lines.*placement limit/);
    context.lines = Array(30).fill({}); vm.runInContext('refreshGenerationStatus()', context);
    assert.equal(exportSvgBtn.disabled, false); assert.equal(status.textContent, '30 / 30 lines');
});

test('Random Lines fixed RNG: generated geometry and SVG match T.2 in ordinary/gradient/image modes', async () => {
    const versions = await Promise.all(['infra/qa/migrations/batch7/frozen/random_lines_generator/script.js', 'random_lines_generator/script.js'].map(read));
    for (const mode of ['ordinary', 'gradient', 'image']) for (const [count, safeField] of [[20, 12], [1001, 0], [12, 4000]]) {
        const results = [];
        for (const source of versions) {
            const params = { patternGenerated: true, lineCount: count, safeField, lineLength: 24, lineWidth: 8, scale: 1.5, roundCap: true,
                rasterMode: mode === 'gradient', imageRasterMode: mode === 'image', zeroLineLength: 3, hundredLineLength: 80,
                zeroLineWidth: 1, hundredLineWidth: 12, brightnessContrast: 1.5, invertImage: true,
                imageData: { width: 2, height: 2, data: new Uint8ClampedArray([0,0,0,255, 85,85,85,255, 170,170,170,255, 255,255,255,255]) } };
            const harness = exportHarness({ params, canvas: { width: 3000, height: 1000 }, lines: [], strokeColor: '#FFFFFF', console: { warn() {} } });
            const names = ['generateRandomLine', 'generateLines', 'isPointInSafeField', 'doesLineIntersectWithSafeFields', 'applyRasterMode', 'getPixelBrightness', 'exportToSvg', 'generateFileNameWithParams'];
            const declarations = functions(source);
            vm.runInContext(names.map(name => declarations.get(name)).join('\n') + '\ngenerateLines(); applyRasterMode(); exportToSvg();', harness.context);
            const artifact = await harness.artifact();
            assert.doesNotMatch(artifact, /NaN|Infinity/);
            assert.match(artifact, /viewBox="0 0 3000 1000"/);
            assert.equal((artifact.match(/<line /g) || []).length, safeField === 4000 ? 1 : count);
            results.push(artifact);
        }
        assert.equal(results[1], results[0], `${mode}, count ${count}, safe field ${safeField}`);
    }
});

for (const [file, generator, exporter] of [
    ['fibonacci.js', 'generatePattern', 'exportAsSvg'],
    ['voronoi.js', 'generatePoints', 'exportAsSvg'],
    ['rectangle.js', 'generatePoints', 'exportSvg'],
    ['fibonacci-rectangle.js', 'generatePattern', 'exportSvg'],
    ['magnetic-rectangle.js', 'generateSegments', 'exportSvg']
]) {
    test(`Pattern 01 ${file}: fixed-input SVG artifact parity including actual generator`, async () => {
        const results = [];
        for (const prefix of ['infra/qa/migrations/batch7/frozen/', '']) {
            const declarations = functions(await read(`${prefix}pattern_generator/${file}`));
            const harness = exportHarness({ canvas: { width: 600, height: 400 }, canvasWidth: 600, canvasHeight: 400,
                width: 600, height: 400, points: [], segments: [], pointCount: 17, radius: 170, pointSize: 2, pointColor: '#ffffff',
                pointCountInput: { value: '17' }, radiusInput: { value: '170' }, pointSizeInput: { value: '2' },
                spiralFactorInput: { value: '1.2' }, iterationsInput: { value: '4' }, iterations: 4, spiralFactor: 1.2,
                lineLength: 15, lineWidth: 2, lineAngle: 45, cellSpacing: 25, roundedLineCaps: true,
                magneticPoints: [{ x: 80, y: 120, radius: 90, force: 75 }],
                drawPoints() {}, drawCanvas() {}, console: { log() {} }
            });
            assert.ok(declarations.has(generator), generator);
            assert.ok(declarations.has(exporter), exporter);
            vm.runInContext(declarations.get(generator) + '\n' + declarations.get(exporter) + `\n${generator}(); ${exporter}();`, harness.context);
            const artifact = await harness.artifact();
            assert.doesNotMatch(artifact, /NaN|Infinity/);
            assert.match(artifact, /viewBox="0 0 600 400"/);
            assert.match(artifact, /<(?:circle|line) /);
            results.push(artifact);
        }
        assert.equal(results[1], results[0]);
    });
}

test('Diagonal Grid resize changes display dimensions only, preserving logical buffer and model', async () => {
    const fit = functions(await read('pattern_generator/magnetic-rectangle.js')).get('fitCanvasToViewport');
    const canvas = { width: 1600, height: 800, style: {}, parentElement: { style: {} } };
    const context = vm.createContext({ canvas, canvasWidth: 800, canvasHeight: 400, window: { innerWidth: 1100, innerHeight: 700 } });
    vm.runInContext(fit + ';fitCanvasToViewport();', context);
    assert.deepEqual([canvas.width, canvas.height], [1600, 800]);
    assert.equal(canvas.style.width, '420px'); assert.equal(canvas.style.height, '210px');
    context.window.innerWidth = 1440; context.window.innerHeight = 900;
    vm.runInContext('fitCanvasToViewport()', context);
    assert.equal(canvas.style.width, '720px'); assert.equal(canvas.style.height, '360px');
});

test('Chladni recorded numeric FFT fixtures preserve mode/smoothing/threshold math', async () => {
    const versions = await Promise.all(['infra/qa/migrations/batch7/frozen/chladni-sound-pattern/sketch.js', 'chladni-sound-pattern/sketch.js'].map(read));
    for (const reactiveX of [false, true]) for (const reactiveY of [false, true]) {
        const results = [];
        for (const source of versions) {
            const trace = [], fixture = { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, volume: 0 };
            const context = vm.createContext({ console: { log() {} }, min: Math.min, max: Math.max, pow: Math.pow,
                map: (v,a,b,c,d) => c + (v-a)/(b-a)*(d-c), constrain: (v,a,b) => Math.max(a,Math.min(b,v)), lerp: (a,b,t) => a+(b-a)*t,
                testMic: { getLevel: () => fixture.volume }, testFft: { analyze() {}, getEnergy: key => fixture[key] },
                testSlider: { value() {} }, testDraw: (...args) => trace.push(args)
            });
            vm.runInContext(source, context);
            vm.runInContext(`mic=testMic;fft=testFft;modeXSlider=testSlider;modeYSlider=testSlider;drawChladniPattern=testDraw;isRunning=true;useAudioReactiveXMode=${reactiveX};useAudioReactiveYMode=${reactiveY};`, context);
            for (const frame of [{bass:0,mid:0,treble:0,volume:0}, {bass:45,mid:22,treble:4,volume:0.025}, {bass:120,mid:90,treble:80,volume:0.07}, {bass:255,mid:255,treble:255,volume:0.12}]) {
                Object.assign(fixture, frame); vm.runInContext('draw()', context);
            }
            assert.equal(trace.length, 4); assert.ok(trace.flat().every(Number.isFinite)); results.push(trace);
            vm.runInContext('isPaused=true;draw();isPaused=false;isRunning=false;draw()', context);
            assert.equal(trace.length, 4, 'paused/stopped do not read another audio frame');
        }
        assert.deepEqual(results[1], results[0]);
    }
});

test('Chladni PNG uses last rendered threshold and waits for encoding before disposal', async () => {
    let finish, removed = false, rendered;
    const surface = { canvas: {}, pixelDensity() {}, remove() { removed = true; } };
    const source = (await read('chladni-sound-pattern/sketch.js')).replaceAll("import('../infra/framework/src/ui/GeneratorHost.js?v=6')", 'Promise.resolve({downloadCanvas:testDownloadCanvas})');
    const context = vm.createContext({ width: 600, height: 600,
        createGraphics(w,h) { assert.equal(w,1200); assert.equal(h,1200); return surface; },
        testDownloadCanvas: () => new Promise(resolve => { finish = resolve; }),
        testDraw: (...args) => { rendered = args.slice(1); }
    });
    vm.runInContext(source, context);
    vm.runInContext('isRunning=true;lastFrameState={nX:2.5,nY:7.25,amplitude:1.6,threshold:0.073};drawExportChladniPattern=testDraw;', context);
    const pending = vm.runInContext('exportChladniPNG()', context);
    await Promise.resolve(); assert.equal(removed, false); assert.deepEqual(rendered, [2.5,7.25,1.6,0.073]);
    finish(); await pending; assert.equal(removed, true);
});
