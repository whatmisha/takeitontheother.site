import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    CLASSIC_LORENZ,
    integrateLorenz,
    lorenzDerivative,
    protoLorenzDerivative,
    rk4Step
} from '../lorenz/src/lorenz.js';
import { projectTrajectory } from '../lorenz/src/projection.js';
import { prepareAnimatedPixelPositions, preparePixelPositions, renderLorenzSvg } from '../lorenz/src/renderer.js';
import {
    MOTION_EXPORT_FPS,
    MOTION_EXPORT_SIZE,
    advanceMotionPhase,
    motionExportFrameCount,
    motionPhaseAtTime
} from '../lorenz/src/motion.js';

const defaults = {
    ...CLASSIC_LORENZ,
    systemType: 'lorenz63',
    wingCount: 3,
    dt: 0.005,
    pointCount: 4000,
    warmupSteps: 1000,
    sampleStride: 1,
    rotationX: 12,
    rotationY: 120,
    rotationZ: 0,
    perspective: 100,
    viewScale: 1,
    pixelWidth: 2,
    pixelHeight: 2,
    gridStep: 2,
    pixelColor: '#ffffff',
    backgroundColor: '#000000',
    transparentExport: false,
    depthStretch: 1,
    animateParticles: false,
    motionSpeed: 0.01,
    motionDuration: 10,
    particleCount: 600,
    trailLength: 8,
    showAxes: false
};

test('Lorenz derivative matches the canonical equations', () => {
    assert.deepEqual(lorenzDerivative(1, 2, 3, 10, 28, 8 / 3), [10, 23, -6]);
});

test('the two-fold proto-Lorenz cover reproduces the Lorenz equations', () => {
    const classic = lorenzDerivative(1, 2, 3, 10, 28, 8 / 3);
    const covered = protoLorenzDerivative(1, 2, 3, 10, 28, 8 / 3, 2);
    covered.forEach((value, index) => assert.ok(Math.abs(value - classic[index]) < 1e-12));
});

test('the non-zero equilibria have zero derivative', () => {
    const x = Math.sqrt((8 / 3) * (28 - 1));
    const derivative = lorenzDerivative(x, x, 27, 10, 28, 8 / 3);
    derivative.forEach((value) => assert.ok(Math.abs(value) < 1e-12));
});

test('RK4 converges when a step is split in two', () => {
    const one = rk4Step(0, 1, 1.05, 0.01, 10, 28, 8 / 3);
    const half = rk4Step(0, 1, 1.05, 0.005, 10, 28, 8 / 3);
    const two = rk4Step(...half, 0.005, 10, 28, 8 / 3);
    one.forEach((value, index) => assert.ok(Math.abs(value - two[index]) < 2e-6));
});

test('classic integration is deterministic, bounded, and fills both lobes', () => {
    const first = integrateLorenz(defaults);
    const second = integrateLorenz(defaults);
    assert.equal(first.diverged, false);
    assert.equal(first.pointCount, defaults.pointCount);
    assert.deepEqual(first.points, second.points);
    assert.ok(first.bounds.minX < -10);
    assert.ok(first.bounds.maxX > 10);
    assert.ok(first.bounds.maxZ > 35);
});

test('projection fits the requested artboard', () => {
    const trajectory = integrateLorenz(defaults);
    const projected = projectTrajectory(trajectory, defaults, 960, 960);
    for (let offset = 0; offset < projected.points.length; offset += 3) {
        assert.ok(projected.points[offset] >= 0 && projected.points[offset] <= 960);
        assert.ok(projected.points[offset + 1] >= 0 && projected.points[offset + 1] <= 960);
    }
});

test('Proto-Lorenz generates one bounded trajectory through every requested wing', () => {
    for (let wingCount = 3; wingCount <= 8; wingCount++) {
        const trajectory = integrateLorenz({
            ...defaults,
            systemType: 'protoLorenz',
            wingCount,
            pointCount: 6000
        });
        assert.equal(trajectory.diverged, false);
        assert.equal(trajectory.systemType, 'protoLorenz');
        assert.equal(trajectory.wingCount, wingCount);

        const visited = new Set();
        for (let index = 0; index < trajectory.pointCount; index++) {
            let angle = Math.atan2(trajectory.points[index * 3 + 1], trajectory.points[index * 3]);
            if (angle < 0) angle += Math.PI * 2;
            visited.add(Math.floor(angle / (Math.PI * 2 / wingCount)));
        }
        assert.equal(visited.size, wingCount);
    }
});

test('raster snapping keeps only the foremost sample in each cell', () => {
    const projected = {
        points: new Float32Array([1.1, 1.1, -1, 1.4, 1.4, 2, 5, 5, 0])
    };
    const pixels = preparePixelPositions(projected, { gridStep: 2 });
    assert.equal(pixels.pixelCount, 2);
    assert.deepEqual([...pixels.points], [6, 6, 0, 2, 2, 2]);
});

test('particle motion samples deterministic moving trails along the trajectory', () => {
    const projectionSettings = { ...defaults, depthStretch: 1.5 };
    const trajectory = integrateLorenz({ ...projectionSettings, pointCount: 1000 });
    const projected = projectTrajectory(trajectory, projectionSettings, 960, 960);
    const motionSettings = { ...defaults, gridStep: 0, particleCount: 90, trailLength: 4 };
    const first = prepareAnimatedPixelPositions(projected, motionSettings, 0.1);
    const repeat = prepareAnimatedPixelPositions(projected, motionSettings, 0.1);
    const moved = prepareAnimatedPixelPositions(projected, motionSettings, 0.2);
    assert.equal(first.pixelCount, 90 * 5);
    assert.deepEqual(first.points, repeat.points);
    assert.notDeepEqual(first.points, moved.points);
});

test('animation export matches preview timing at 1080 square and 60 fps', () => {
    assert.equal(MOTION_EXPORT_SIZE, 1080);
    assert.equal(MOTION_EXPORT_FPS, 60);
    assert.equal(motionExportFrameCount(defaults), 600);
    assert.ok(Math.abs(motionPhaseAtTime(10, 0.01) - 0.0025) < 1e-12);
    assert.equal(advanceMotionPhase(0, 1000, 0.01), motionPhaseAtTime(1, 0.01));
});

test('SVG export uses one compact path for all vector pixels', () => {
    const trajectory = integrateLorenz({ ...defaults, pointCount: 500 });
    const svg = renderLorenzSvg(960, 960, defaults, trajectory);
    assert.match(svg, /<rect[^>]+fill="#000000"/);
    assert.match(svg, /<path d="M/);
    assert.equal((svg.match(/<circle/g) || []).length, 0);
    assert.equal((svg.match(/<path /g) || []).length, 1);
});

test('transparent SVG export omits the background and keeps pixels fully opaque', () => {
    const settings = { ...defaults, transparentExport: true };
    const trajectory = integrateLorenz({ ...settings, pointCount: 500 });
    const svg = renderLorenzSvg(960, 960, settings, trajectory);
    assert.doesNotMatch(svg, /<rect/);
    assert.doesNotMatch(svg, /opacity=/);
    assert.match(svg, /<path d="M[^>]+fill="#ffffff"\/>/);
});

test('animated SVG export captures the current particle frame as vector pixels', () => {
    const settings = {
        ...defaults,
        animateParticles: true,
        gridStep: 0,
        particleCount: 100,
        trailLength: 0
    };
    const trajectory = integrateLorenz({ ...settings, pointCount: 500 });
    const svg = renderLorenzSvg(960, 960, settings, trajectory, { motionPhase: 0.25 });
    const pixelPath = svg.match(/<path d="([^"]+)" fill="#ffffff"\/>/)[1];
    assert.equal((pixelPath.match(/M/g) || []).length, 100);
});

test('Lorenz is a standalone tool with no YF Tools navigation button', () => {
    const html = readFileSync(new URL('../lorenz/index.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../lorenz/tool.js', import.meta.url), 'utf8');
    assert.doesNotMatch(html, /YF Tools|Othersite UI|href="\.\.\/"/);
    assert.doesNotMatch(html, /artboardFormat|>Format</);
    assert.doesNotMatch(source, /FORMAT_DIMENSIONS|format: 'square'/);
    assert.match(html, /id="gridStepSlider"/);
    assert.match(html, /id="unifiedColorPickerContainer"/);
    assert.doesNotMatch(html, /opacitySlider|Opacity/);
    assert.match(html, /id="exportSvgBtn"[\s\S]+id="transparentExport"/);
    assert.match(html, /class="toggle-label"[\s\S]+class="toggle-switch"[\s\S]+class="toggle-slider"/);
    assert.doesNotMatch(html, /export-transparency-toggle/);
    assert.match(html, /name="attractorSystem" value="lorenz63"/);
    assert.match(html, /name="attractorSystem" value="protoLorenz"/);
    assert.match(html, /segmented-control segmented-control-compact/);
    assert.match(html, /id="wingCountSlider"[^>]+min="3"[^>]+max="8"/);
    assert.doesNotMatch(html, /Copies|Plane spread|Layer offset|copyCount|planeSpread|layerOffset/);
    assert.match(html, /id="depthStretchSlider"/);
    assert.match(html, /id="motionPlayBtn"[^>]+aria-pressed="false"/);
    assert.match(html, /id="particleCountSlider"/);
    assert.match(html, /id="motionSpeedSlider"[^>]+min="0\.01"[^>]+step="0\.01"/);
    assert.match(html, /id="motionDurationSlider"[^>]+min="1"[^>]+max="30"/);
    assert.match(html, /id="exportPngSequenceBtn"[^>]*>Export PNG sequence/);
    assert.match(html, /id="exportMp4Btn"[^>]*>Export MP4/);
    assert.match(html, /id="animationExportStatus"[^>]+aria-live="polite"/);
    assert.match(source, /setting: 'motionSpeed', min: 0\.01, max: 4, decimals: 2/);
    assert.match(source, /setting: 'motionDuration', min: 1, max: 30/);
    assert.match(source, /motionSpeed: 0\.01/);
    assert.match(source, /storageKey: 'othersiteLorenzAttractorV6'/);
});

test('animation export supports H.264 MP4 and transparent PNG frames', () => {
    const exporter = readFileSync(new URL('../lorenz/src/animationExporter.js', import.meta.url), 'utf8');
    const worker = readFileSync(new URL('../lorenz/src/animationExportWorker.js', import.meta.url), 'utf8');
    assert.match(exporter, /new Worker\(new URL\('\.\/animationExportWorker\.js'/);
    assert.match(worker, /VideoEncoder\.isConfigSupported/);
    assert.match(worker, /muxAvcToMp4/);
    assert.match(worker, /StoredZipBlobBuilder/);
    assert.match(worker, /transparent = Boolean\(job\.settings\.transparentExport\)/);
    assert.match(worker, /animateParticles: true/);
});

test('the requested view is the default in code and built-in presets', () => {
    const source = readFileSync(new URL('../lorenz/tool.js', import.meta.url), 'utf8');
    assert.match(source, /rotationX: 12, rotationY: 120, rotationZ: 0, perspective: 100/);
    ['classic', 'fine', 'blocks', 'proto3'].forEach((name) => {
        const preset = JSON.parse(readFileSync(new URL(`../lorenz/presets/${name}.json`, import.meta.url), 'utf8'));
        assert.equal(preset.rotationX, 12);
        assert.equal(preset.rotationY, 120);
        assert.equal(preset.rotationZ, 0);
        assert.equal(preset.perspective, 100);
        assert.equal(preset.transparentExport, false);
        assert.equal(typeof preset.depthStretch, 'number');
        assert.equal(preset.animateParticles, false);
        assert.equal(preset.motionDuration, 10);
        assert.equal('opacity' in preset, false);
        assert.equal('format' in preset, false);
        assert.equal('copyCount' in preset, false);
        assert.equal('planeSpread' in preset, false);
        assert.equal('layerOffset' in preset, false);
    });
    const proto = JSON.parse(readFileSync(new URL('../lorenz/presets/proto3.json', import.meta.url), 'utf8'));
    assert.equal(proto.systemType, 'protoLorenz');
    assert.equal(proto.wingCount, 3);
});

test('all registered Lorenz controls exist in the standalone document', () => {
    const html = readFileSync(new URL('../lorenz/index.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../lorenz/tool.js', import.meta.url), 'utf8');
    const ids = [...source.matchAll(/(?:id|valueId|containerId|itemId|dotId|hexId|hsbSlotId|headerId): '([^']+)'/g)]
        .map((match) => match[1]);
    ids.forEach((id) => assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`));
});
