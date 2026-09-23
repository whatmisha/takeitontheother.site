import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseAst } from '../../../../grid_generator/tools/node_modules/rollup/dist/es/parseAst.js';
import { CaptureSession } from '../../../../chladni-sound-pattern/capture-session.js';

const root = new URL('../../../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
function declarations(source) {
    const functions = new Map();
    function walk(value) {
        if (!value || typeof value !== 'object') return;
        if (value.type === 'FunctionDeclaration') functions.set(value.id.name, source.slice(value.start, value.end));
        for (const item of Object.values(value)) {
            if (Array.isArray(item)) item.forEach(walk);
            else if (item && typeof item === 'object') walk(item);
        }
    }
    walk(parseAst(source)); return functions;
}

// Explicit changed-function inventory. All other private model/renderer functions
// must stay byte-identical to the independently hashed T.2 snapshot.
const allowed = {
    'hyperspace/sketch.js': ['setup', 'mousePressed', 'mouseDragged', 'setupSliderEvents', 'windowResized', 'exportCanvas'],
    'pattern_generator/script.js': [],
    'pattern_generator/fibonacci.js': ['init'],
    'pattern_generator/voronoi.js': ['init'],
    'pattern_generator/rectangle.js': ['init'],
    'pattern_generator/fibonacci-rectangle.js': ['init'],
    'pattern_generator/magnetic-rectangle.js': ['setupMouseEvents', 'setCanvasSize', 'setupControls'],
    'pattern_generator_02/script.js': ['setup', 'setupHTMLControls', 'setupSliderWithHistory'],
    'random_lines_generator/script.js': ['updateAndSave', 'exportToSvg', 'restoreSettingsFromFileName'],
    'asterisk_pattern_generator/script.js': ['init', 'exportToSVG'],
    'chladni-sound-pattern/sketch.js': ['keyPressed', 'draw', 'toggleSliderInteractivity', 'setupInterface']
};
for (const [file, expectedChanges] of Object.entries(allowed)) {
    test(`${file}: unchanged geometry/random generation; reviewed UI/defect changes only`, async () => {
        const before = declarations(await read(`infra/qa/migrations/batch7/frozen/${file}`));
        const source = await read(file);
        // Only the pause overlay is translated; keep the rest of draw byte-identical.
        const after = declarations(file === 'hyperspace/sketch.js' ? source.replace('text("PAUSED",', 'text("ПАУЗА",') : source);
        assert.deepEqual([...before].filter(([name, body]) => after.get(name) !== body).map(([name]) => name), expectedChanges);
    });
}

test('all eight entry points load shared control styling after base, not legacy skins', async () => {
    for (const id of ['rays_pattern_generator', 'random_lines_generator', 'pattern_generator_02', 'pattern_generator', 'asterisk_pattern_generator', 'hyperspace', 'calendar-randomizer', 'chladni-sound-pattern']) {
        const html = await read(`${id}/index.html`);
        assert.match(html, /generator-host\.css/);
        assert.ok(html.indexOf('ui-contract.css') > html.indexOf('othersite-styles.css'));
        assert.doesNotMatch(html, /<link[^>]+href="(?:styles?\.css|[^"\n]*migration-preview\.css)/);
        assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/);
    }
});

test('Random Lines filename parses safe-field before the shorter scale prefix', async () => {
    const source = await read('random_lines_generator/script.js');
    let settings;
    const restore = declarations(source).get('restoreSettingsFromFileName');
    const context = vm.createContext({ console: { log() {}, error(...args) { throw new Error(args.join(' ')); } }, applySettingsToUI: value => { settings = value; }, params: {}, generateBtn: {}, generateLines() {}, applyRasterMode() {}, drawPattern() {}, refreshGenerationStatus() {} });
    vm.runInContext(restore + ';restoreSettingsFromFileName("random_lines_w8_l24_c30_s1.5_sf12.svg")', context);
    assert.equal(settings.safeField, 12); assert.equal(settings.scale, 1.5);
});

test('Pattern 02 SVG artifacts are identical across all toggle combinations and extreme settings', async () => {
    const versions = await Promise.all(['infra/qa/migrations/batch7/frozen/pattern_generator_02/script.js', 'pattern_generator_02/script.js'].map(read));
    for (const toggles of [0,1,2,3,4,5,6,7]) for (const edge of [false, true]) {
        const artifacts = versions.map(source => {
            let blob, downloads = 0;
            const context = vm.createContext({ windowWidth: 640, windowHeight: 360, width: 640, height: 360, PI: Math.PI, HALF_PI: Math.PI/2,
                min: Math.min, max: Math.max, floor: Math.floor, sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt, abs: Math.abs,
                Blob, URL: { createObjectURL: value => { blob = value; return 'blob:test'; }, revokeObjectURL() {} },
                document: { createElement: () => ({ click() { downloads++; } }) }
            });
            vm.runInContext(source, context);
            vm.runInContext(`roundCaps=${Boolean(toggles & 1)};checkerboardMode=${Boolean(toggles & 2)};bothSquaresBMode=${Boolean(toggles & 4)};
                ${edge ? 'squareSize=10;cornerRadiusPercent=100;lineLengthPercent=0;lineBLengthPercent=0;spacingPercent=0;' : ''}exportSVG();`, context);
            assert.equal(downloads, 1); assert.equal(blob.type, 'image/svg+xml');
            return blob.text();
        });
        const [before, after] = await Promise.all(artifacts);
        assert.equal(after, before); assert.match(after, /viewBox="0 0 640 360"/);
        assert.doesNotMatch(after, /NaN|Infinity/);
    }
});

test('Hyperspace PNG rendering keeps particle origins/geometry; encoding finishes before disposal', async () => {
    const versions = await Promise.all(['infra/qa/migrations/batch7/frozen/hyperspace/sketch.js', 'hyperspace/sketch.js'].map(read));
    const traces = [];
    for (const [index, source] of versions.entries()) {
        let finish, removed = false;
        const trace = [];
        const graphics = { canvas: {}, background(...args) { trace.push(['background', ...args]); },
            strokeWeight(value) { trace.push(['width', value]); }, stroke(value) { trace.push(['color', ...value.values]); },
            line(...args) { trace.push(['line', ...args]); }, save() {}, remove() { removed = true; } };
        const color = (...values) => ({ values, setAlpha(alpha) { this.values[3] = alpha; } });
        const context = vm.createContext({ width: 640, height: 360, createGraphics: () => graphics, min: Math.min, max: Math.max, cos: Math.cos, sin: Math.sin, color,
            document: { getElementById: () => ({textContent:'PNG',style:{}}) }, setTimeout() {},
            testDownloadCanvas: canvas => { assert.equal(canvas, graphics.canvas); return new Promise(resolve => { finish = resolve; }); }
        });
        const prepared = source.replaceAll("import('../infra/framework/src/ui/GeneratorHost.js?v=6')", 'Promise.resolve({downloadCanvas:testDownloadCanvas})');
        vm.runInContext(prepared, context);
        vm.runInContext('stars=[{active:true,origin:{x:71,y:92},angle:0.4,currentLength:120,resetLength:250}];opacity=80;fadeLength=30;segmentsCount=10;lineWidth=2;widthGrowth=25;reverseWedge=false;useColorGradient=false;', context);
        const operation = vm.runInContext('exportCanvas()', context);
        if (index === 1) { await Promise.resolve(); assert.equal(removed, false); finish(); await operation; }
        assert.equal(removed, true); assert.ok(trace.some(item => item[0] === 'line')); traces.push(trace);
    }
    assert.deepEqual(traces[1], traces[0]);
});

test('Chladni microphone waits for permission, deduplicates Start, rejects and retries', async () => {
    let grant, reject, starts = 0, stops = 0, ready = 0;
    const mic = { start(ok, fail) { starts++; grant = ok; reject = fail; }, stop() { stops++; }, amp() {} };
    const session = new CaptureSession({ mic, unlock: async () => {}, onReady: () => ready++, onStop() {} });
    const first = session.start(); assert.equal(session.start(), first); await Promise.resolve();
    assert.equal(session.running, false); assert.equal(ready, 0);
    reject(new Error('denied')); await assert.rejects(first, /denied/);
    assert.equal(session.running, false); assert.equal(stops, 1);
    const second = session.start(); await Promise.resolve(); grant(); await second;
    assert.equal(session.running, true); assert.equal(starts, 2); assert.equal(ready, 1);
    session.stop(); assert.equal(session.running, false); assert.equal(stops, 2);
});

test('Chladni Stop during pending permission releases a late stream', async () => {
    let grant, stops = 0, ready = 0;
    const session = new CaptureSession({ mic: { start(ok) { grant = ok; }, stop() { stops++; }, amp() {} }, unlock: async () => {}, onReady: () => ready++, onStop() {} });
    const pending = session.start(); await Promise.resolve(); session.stop(); grant(); await pending;
    assert.equal(session.running, false); assert.equal(ready, 0); assert.equal(stops, 2);
});

test('Chladni manual axes stay independently editable across all four reactive modes', async () => {
    const body = declarations(await read('chladni-sound-pattern/sketch.js')).get('toggleSliderInteractivity');
    for (const running of [false, true]) for (const x of [false, true]) for (const y of [false, true]) {
        const slider = () => ({ disabled: false, removeAttribute() { this.disabled = false; }, attribute() { this.disabled = true; }, style() {} });
        const modeXSlider = slider(), modeYSlider = slider();
        vm.runInNewContext(body + ';toggleSliderInteractivity(false)', { isRunning: running, useAudioReactiveXMode: x, useAudioReactiveYMode: y, modeXSlider, modeYSlider });
        assert.equal(modeXSlider.disabled, running && x); assert.equal(modeYSlider.disabled, running && y);
    }
});

test('Asterisk preview/export match across layers 0/1/2/7, axes/tessellation, scales 1:1–1:128 and caps', async () => {
    const source = await read('asterisk_pattern_generator/script.js');
    let curves = 0, artifact;
    const ctx = new Proxy({}, { get: (_, name) => name === 'quadraticCurveTo' ? () => curves++ : () => {}, set: () => true });
    const nodes = new Map();
    const element = tag => ({ tag, attributes: {}, children: [], setAttribute(key, value) { this.attributes[key] = String(value); }, appendChild(child) { this.children.push(child); }, click() {}, style: {}, addEventListener() {} });
    const canvas = { width: 1920, height: 1080, getContext: () => ctx };
    const context = vm.createContext({ document: { getElementById: id => id === 'patternCanvas' ? canvas : (nodes.get(id) || (nodes.set(id, element('input')), nodes.get(id))),
        createElementNS: (_, tag) => element(tag), createElement: element, body: { appendChild() {}, removeChild() {} } },
        window: { addEventListener() {} }, Blob, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
        XMLSerializer: class { serializeToString(svg) { artifact = svg; return '<svg/>'; } }
    });
    vm.runInContext(source, context);
    const paths = svg => (svg.tag === 'path' ? 1 : 0) + svg.children.reduce((sum, child) => sum + paths(child), 0);
    for (const tessellation of [true, false]) for (const layers of [0, 1, 2, 7]) for (const scaleDown of [0,1,2,3,4,5,6,7]) for (const caps of [false,true]) {
        curves = 0;
        vm.runInContext(`params.showGrid=false; params.tessellationMode=${tessellation}; params.duplicateLayers=${layers};params.scaleDown=${scaleDown};params.roundedCaps=${caps};drawPattern();exportToSVG();`, context);
        assert.equal(paths(artifact), curves, `${tessellation ? 'tessellation' : 'axes'} ${layers}`);
        assert.equal(artifact.attributes.viewBox, '0 0 1920 1080');
        assert.match(artifact.children.find(child => child.tag === 'style').textContent, new RegExp(`stroke-linecap: ${caps ? 'round' : 'butt'}`));
        assert.ok(artifact.children.some(child => child.attributes.transform?.includes(`scale(${1 / 2 ** scaleDown})`)));
    }
});
