import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    CASCADE_DEFAULTS,
    buildCascadeScene,
    buildStageBands,
    cascadeLevelCount,
    cascadeStageCount,
    foregroundIntervals,
    normalizeCascadeSettings,
    phaseForLevel
} from '../cascade/src/cascadeGeometry.js';
import {
    animationExportDimensions,
    cascadeGenerationAtPhase,
    motionFrameCount,
    motionLoopDuration
} from '../cascade/src/motion.js';
import { renderCascadeSvgString } from '../cascade/src/renderer.js';

test('reference cascade resolves 32 candidates into one result plus a terminal empty stage', () => {
    assert.equal(cascadeLevelCount(CASCADE_DEFAULTS), 6);
    assert.equal(cascadeStageCount(CASCADE_DEFAULTS), 7);
    const bands = buildStageBands(CASCADE_DEFAULTS);
    assert.equal(bands.length, 7);
    bands.forEach((band) => assert.ok(Math.abs(band.height - 1000 / 7) < 1e-9));
    const intervalCounts = bands.map((band) => (
        band.empty ? 0 : foregroundIntervals(CASCADE_DEFAULTS, band.level).length
    ));
    assert.deepEqual(intervalCounts, [32, 16, 8, 4, 2, 1, 0]);
    assert.equal(bands.at(-1).empty, true);
});

test('reference phase accumulates half of every previous period', () => {
    const phases = Array.from({ length: 6 }, (_, level) => phaseForLevel(CASCADE_DEFAULTS, level));
    assert.deepEqual(phases, [0, 12, 36, 84, 180, 372]);
});

test('candidate and finalist values normalize to compatible powers of two', () => {
    const settings = normalizeCascadeSettings({ candidateCount: 70, finalistCount: 200 });
    assert.equal(settings.candidateCount, 64);
    assert.equal(settings.finalistCount, 64);
    assert.equal(cascadeLevelCount(settings), 1);
    assert.equal(cascadeStageCount(settings), 1);
});

test('Sierpinski pattern recursively keeps three downward corner triangles', () => {
    const settings = { ...CASCADE_DEFAULTS, patternType: 'sierpinski', candidateCount: 8 };
    const detailed = buildCascadeScene(settings);
    const coarse = buildCascadeScene(settings, { generation: 2 });
    const finalist = buildCascadeScene(settings, { generation: 3 });
    const empty = buildCascadeScene(settings, { generation: 4 });
    assert.equal(detailed.settings.patternType, 'sierpinski');
    assert.equal(detailed.polygons.length, 27);
    assert.equal(coarse.polygons.length, 3);
    assert.equal(finalist.polygons.length, 1);
    assert.equal(empty.polygons.length, 0);
    detailed.polygons.forEach((polygon) => {
        assert.equal(polygon.points.length, 3);
        const [left, right, apex] = polygon.points;
        assert.equal(left.y, right.y);
        assert.ok(apex.y > left.y);
        assert.equal(apex.x, (left.x + right.x) / 2);
    });
    assert.equal(normalizeCascadeSettings({ patternType: 'triangles' }).patternType, 'sierpinski');
    assert.equal(normalizeCascadeSettings({ patternType: 'invalid' }).patternType, 'stripes');
});

test('Sierpinski finalists remain separate roots while recursion preserves the input edge count', () => {
    const settings = { ...CASCADE_DEFAULTS, patternType: 'sierpinski', candidateCount: 8, finalistCount: 2 };
    assert.equal(buildCascadeScene(settings).polygons.length, 18);
    assert.equal(buildCascadeScene(settings, { generation: 2 }).polygons.length, 2);
});

test('all pattern and layout mappings remain finite and stay in the artboard', () => {
    for (const patternType of ['stripes', 'sierpinski']) {
        for (const layoutMode of ['linear', 'radial', 'fan']) {
            const scene = buildCascadeScene({ ...CASCADE_DEFAULTS, width: 960, height: 960, patternType, layoutMode });
            assert.ok(scene.polygons.length > 0);
            scene.polygons.flatMap((polygon) => polygon.points).forEach((point) => {
                assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
                assert.ok(point.x >= -1e-6 && point.x <= 960 + 1e-6);
                assert.ok(point.y >= -1e-6 && point.y <= 960 + 1e-6);
            });
        }
    }
});

test('animation changes the complete remaining field one discrete generation at a time', () => {
    const start = buildCascadeScene(CASCADE_DEFAULTS, { generation: 0 });
    const second = buildCascadeScene(CASCADE_DEFAULTS, { generation: 1 });
    const oneFinalist = buildCascadeScene(CASCADE_DEFAULTS, { generation: 5 });
    const complete = buildCascadeScene(CASCADE_DEFAULTS, { generation: 6 });
    assert.ok(start.polygons.every((polygon) => polygon.level === 0));
    assert.deepEqual(start.segments, [{ y0: 0, y1: 1000, level: 0 }]);
    assert.equal(second.segments.length, 2);
    assert.deepEqual([...new Set(second.polygons.map((polygon) => polygon.level))], [0, 1]);
    assert.ok(oneFinalist.polygons.some((polygon) => polygon.level === 5));
    assert.equal(oneFinalist.segments.at(-1).level, 5);
    assert.equal(complete.segments.at(-1).level, null);
    assert.ok(complete.polygons.every((polygon) => (
        polygon.points.every((point) => point.y <= 6 * 1000 / 7 + 1e-6)
    )));
});

test('generation timing plays 32→0→32 and holds both endpoints for an extra beat', () => {
    const generationAtStep = (step) => cascadeGenerationAtPhase((step + 0.1) / 14, CASCADE_DEFAULTS);
    assert.deepEqual(
        Array.from({ length: 14 }, (_, step) => generationAtStep(step)),
        [0, 1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1, 0]
    );
    assert.equal(cascadeGenerationAtPhase(0.01, CASCADE_DEFAULTS), 0);
    assert.equal(cascadeGenerationAtPhase(0.99, CASCADE_DEFAULTS), 0);
});

test('animation exports one seamless 60 fps loop with an even 1080-edge frame', () => {
    assert.equal(motionLoopDuration(CASCADE_DEFAULTS), 7);
    assert.equal(motionFrameCount(CASCADE_DEFAULTS), 420);
    assert.deepEqual(animationExportDimensions(CASCADE_DEFAULTS), { width: 830, height: 1080 });
});

test('SVG output keeps the black reference background and supports transparency', () => {
    const opaque = renderCascadeSvgString(768, 1000, CASCADE_DEFAULTS);
    assert.match(opaque, /<rect[^>]+fill="#000000"/);
    assert.match(opaque, /<path[^>]+fill="#ffffff"/);
    const transparent = renderCascadeSvgString(768, 1000, { ...CASCADE_DEFAULTS, transparentExport: true });
    assert.doesNotMatch(transparent, /<rect/);
});

test('Cascade is a standalone framework v3 tool with static and motion export controls', () => {
    const html = readFileSync(new URL('../cascade/index.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../cascade/tool.js', import.meta.url), 'utf8');
    const worker = readFileSync(new URL('../cascade/src/animationExportWorker.js', import.meta.url), 'utf8');
    assert.match(html, /\.\.\/framework\/css\/othersite-styles\.css/);
    assert.doesNotMatch(html, /YF Tools|href="\.\.\/"/);
    assert.match(html, /value="linear"/);
    assert.match(html, /value="radial"/);
    assert.match(html, /value="fan"/);
    assert.match(html, /name="patternType" value="stripes"/);
    assert.match(html, /name="patternType" value="sierpinski"/);
    assert.match(html, /id="exportPngSequenceBtn"/);
    assert.match(html, /id="exportMp4Btn"/);
    assert.match(source, /defineTool/);
    assert.match(html, /id="stepDurationSlider"/);
    assert.match(source, /storageKey: 'othersiteCascadeV2'/);
    assert.match(worker, /VideoEncoder\.isConfigSupported/);
    assert.match(worker, /muxAvcToMp4/);
    assert.match(worker, /StoredZipBlobBuilder/);
});

test('every registered Cascade slider has matching range and value controls', () => {
    const html = readFileSync(new URL('../cascade/index.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../cascade/tool.js', import.meta.url), 'utf8');
    const definitions = [...source.matchAll(/\{ id: '([^']+)', valueId: '([^']+)'/g)];
    assert.ok(definitions.length >= 10);
    definitions.forEach(([, sliderId, valueId]) => {
        assert.match(html, new RegExp(`id="${sliderId}"`));
        assert.match(html, new RegExp(`id="${valueId}"`));
    });
});
