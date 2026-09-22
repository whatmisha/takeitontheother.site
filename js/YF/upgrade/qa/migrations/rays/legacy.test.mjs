import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { source, controls, createLegacy, svgLines, roundedGeometry } from './harness.mjs';

const baseline = JSON.parse(await readFile(new URL('../SOURCE_BASELINE.json', import.meta.url), 'utf8')).tools.find(tool => tool.id === 'rays_pattern_generator');
const counts = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24];
const geometry = app => roundedGeometry(svgLines(app.export().svg));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const pixels = { width: 3, height: 2, data: Uint8ClampedArray.from([
    0,0,0,255, 128,128,128,255, 255,255,255,255,
    255,0,0,255, 0,255,0,0, 0,0,255,255
]) };

test('frozen source is byte-identical to the approved per-file baseline, without reading the original', () => {
    for (const file of baseline.files) {
        assert.equal(Buffer.byteLength(source[file.path]), file.bytes);
        assert.equal(createHash('sha256').update(source[file.path]).digest('hex'), file.sha256);
    }
});

test('all twelve ranges retain explicit defaults, bounds and steps', () => {
    assert.deepEqual(controls.filter(item => item.type === 'range').map(item => [item.id, +item.min, +item.max, +item.value, +(item.step || 1)]), [
        ['rayLengthSlider',10,200,56,1], ['lineWidthSlider',1,24,2,0.5], ['gapSlider',0,50,19,1], ['rayCountSlider',3,24,5,1],
        ['scaleSlider',0.1,3,1,0.1], ['horizontalGapSlider',0,100,20,1], ['verticalGapSlider',0,100,10,1],
        ['zeroRayLengthSlider',0,200,30,1], ['zeroLineWidthSlider',1,24,1,0.5], ['hundredRayLengthSlider',0,200,100,1], ['hundredLineWidthSlider',1,24,2,0.5], ['brightnessContrastSlider',0.1,3,1,0.1]
    ]);
});

test('default SVG has 216 modules/210 dividers, transparent background and legacy filename', async () => {
    const app = createLegacy(), { svg, blob, name } = app.export();
    assert.equal(svg.attrs.width, '3000'); assert.equal(svg.attrs.height, '1000');
    assert.equal(svg.children.filter(node => node.tagName === 'G').length, 216);
    assert.equal(svg.children.filter(node => node.tagName === 'LINE').length, 210);
    assert.equal(svgLines(svg).length, 1290);
    assert.equal(name, 'ray_pattern_lw2.0_ll56_lc5_co19_sc1.0_hg20_vg10.svg');
    assert.equal(blob.type, 'image/svg+xml');
    assert.doesNotMatch(await blob.text(), /<(?:rect|image|text)|viewBox|clipPath/u);
    assert.ok(svgLines(svg).every(line => line.color === '#000000'));
    assert.ok(app.context.lines.every(line => line.color === '#FFFFFF'));
    const first = svgLines(svg)[0];
    first.points.forEach((value, index) => close(value, [-6.5,70,-62.5,70][index]));
    assert.equal(first.width, 2); assert.equal(first.cap, 'butt');
});

test('Canvas and SVG agree across every supported count, caps, dividers and row polarity', () => {
    for (const count of counts) for (const classic of [false, true]) {
        const app = createLegacy(); app.change('rayCountSlider', count); app.change('offsetRowsCheckbox', classic);
        app.change('roundCapCheckbox', true); app.change('hideConnectingLinesCheckbox', true);
        const { svg } = app.export();
        assert.equal(svg.children.length, 216);
        assert.ok(svg.children.every(group => group.children.length === count));
        assert.deepEqual(roundedGeometry(app.context.lines), roundedGeometry(svgLines(svg)));
        assert.ok(svgLines(svg).every(line => line.cap === 'round'));
        assert.equal(svg.children[18].attrs.transform, classic ? 'translate(-20, 80)' : 'translate(22.5, 80)');
    }
});

test('count snapping uses the lower neighbour on ties; even counts preserve their legacy duplicate vertical ray', () => {
    const app = createLegacy();
    for (const [input, output] of [[7,6],[9,8],[11,10],[13,12],[15,14],[17,16],[19,18],[21,20],[22,20],[23,24]]) {
        app.change('rayCountSlider', input); assert.equal(+app.nodes.get('rayCountSlider').value, output);
    }
    app.change('rayCountSlider', 4);
    const lines = roundedGeometry(svgLines(app.export().svg)).slice(0,4);
    assert.deepEqual(lines[2], lines[3]); // Known legacy geometry; no unapproved deduplication.
});

test('scale changes model geometry while DPR does not; edge lines are retained beyond the page', () => {
    for (const scale of [0.1, 1, 3]) {
        const app = createLegacy(); app.change('scaleSlider', scale);
        assert.deepEqual(roundedGeometry(app.context.lines), geometry(app));
        assert.ok(app.context.lines.every(line => line.points.every(Number.isFinite)));
        const retina = createLegacy({ dpr: 2 }); retina.change('scaleSlider', scale);
        assert.deepEqual(geometry(retina), geometry(app));
    }
    assert.ok(createLegacy().context.lines.some(line => line.points.some(value => value < 0)));
    assert.doesNotMatch(source['script.js'], /devicePixelRatio|addEventListener\(['"]resize/u);
});

test('gap input keeps the old outer radius; changing length updates that radius', () => {
    const app = createLegacy(); app.change('gapSlider', 30);
    assert.equal(app.nodes.get('rayLengthValue').textContent, 45);
    app.change('rayLengthSlider', 100); app.change('gapSlider', 40);
    assert.equal(app.nodes.get('rayLengthValue').textContent, 90);
});

test('gradient interpolates length/width at module origin, including the 56px scale factor', () => {
    const app = createLegacy(); app.change('rasterModeCheckbox', true);
    assert.equal(app.nodes.get('rayLengthSlider').disabled, true);
    let lines = svgLines(app.export().svg);
    close(Math.hypot(lines[0].points[2]-lines[0].points[0], lines[0].points[3]-lines[0].points[1]),30);
    close(lines[0].width,1);
    close(lines[6].width,1 + 107.5/3000);
    assert.deepEqual(roundedGeometry(app.context.lines), roundedGeometry(lines));
    app.restore('ray_pattern_ll112_rm1_hl30_hw1_sl100_sw2.svg');
    lines = svgLines(app.export().svg);
    close(Math.abs(lines[0].points[2]-lines[0].points[0]),60);
});

test('image mode uses supplied RGB pixels, contrast/invert and falls back to ordinary without pixels', () => {
    const app = createLegacy(), normal = geometry(app);
    app.change('imageRasterModeCheckbox', true);
    assert.deepEqual(geometry(app), normal);
    app.upload(pixels);
    let lines = svgLines(app.export().svg);
    close(Math.abs(lines[0].points[2]-lines[0].points[0]),100); close(lines[0].width,2);
    app.change('imageInvertCheckbox', true);
    lines = svgLines(app.export().svg);
    close(Math.abs(lines[0].points[2]-lines[0].points[0]),30); close(lines[0].width,1);
    app.change('brightnessContrastSlider',0.1);
    lines = svgLines(app.export().svg); close(lines[0].width,1.45);
    assert.deepEqual(roundedGeometry(app.context.lines), roundedGeometry(lines));
    const before = geometry(app); app.upload(pixels, 'text/plain'); assert.deepEqual(geometry(app),before);
});

test('legacy gradient filename restores geometry and reset returns the default result', () => {
    const app = createLegacy(), defaultGeometry = geometry(app);
    app.change('rasterModeCheckbox',true); app.change('zeroRayLengthSlider',12); app.change('hundredRayLengthSlider',150);
    app.change('roundCapCheckbox',true); app.change('offsetRowsCheckbox',true); app.change('scaleSlider',1.5);
    const artifact = app.export(), other = createLegacy(); other.restore(artifact.name);
    assert.deepEqual(geometry(other), geometry(app));
    app.nodes.get('resetBtn').click(); assert.deepEqual(geometry(app),defaultGeometry);
    assert.equal(app.storage.has('rayPatternSettings'),false);
});

test('known defects: restored outer radius is stale; image filename and saved image settings lose tone values', () => {
    const restored = createLegacy(); restored.restore('ray_pattern_ll100_co20.svg'); restored.change('gapSlider',30);
    assert.equal(restored.nodes.get('rayLengthValue').textContent,45); // Not the correct 90 for the restored 120px radius.
    const image = createLegacy(); image.change('imageRasterModeCheckbox',true); image.change('zeroRayLengthSlider',70);
    assert.doesNotMatch(image.export().name, /_hl70/u);
    const saved = JSON.parse(image.storage.get('rayPatternSettings')), reloaded = createLegacy({saved});
    assert.equal(+reloaded.nodes.get('zeroRayLengthSlider').value,30); // Stored 70 is ignored when rasterMode=false.
});

test('known defects: object URL is not revoked; editable/repeat export shortcuts are not guarded', () => {
    const app = createLegacy(); app.export(); app.flushTimers(); assert.equal(app.revoked.length,0);
    app.key({key:'e',metaKey:true,repeat:true,target:{tagName:'INPUT'}});
    assert.equal(app.downloads.length,2);
    assert.doesNotMatch(source['script.js'], /imageUpload\.value\s*=\s*['"]['"]|reader\.onerror|sourceImage\.onerror/u);
});
