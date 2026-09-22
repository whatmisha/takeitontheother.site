import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createLegacy, source, svgLines, roundedGeometry } from './harness.mjs';
import { buildRaysScene } from '../../../../rays_pattern_generator/engine/scene.js';
import { paintRaysScene, raysSvgElement } from '../../../../rays_pattern_generator/engine/renderers.js';

const root = new URL('../../../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [html, script, css] = await Promise.all(['index.html','script.js','styles.css'].map(name => read(`rays_pattern_generator/${name}`)));
const fixtures = JSON.parse(await readFile(new URL('./geometry-fixtures.json', import.meta.url), 'utf8'));
const storageKey = 'upgrade:rays-pattern:settings:v1';
const migrated = options => createLegacy({ html, script: script.replace(/^import .*;\n/gmu, ''), storageKey,
    ...options, dependencies: { buildRaysScene, paintRaysScene, raysSvgElement, ...options?.dependencies } });

test('T.3b live preview and SVG consume the verified scene, not duplicate algorithms', () => {
    assert.match(script, /paintRaysScene\(ctx, scene\(\)/u);
    assert.match(script, /raysSvgElement\(scene\(\), document\)/u);
    assert.doesNotMatch(script, /function (?:drawRays|fillCanvasWithPattern|addRaysToSvg|calculateRayLengthAndLineWidth)/u);
    assert.equal((script.match(/upgrade:rays-pattern:settings:v1/gu) || []).length,3);
    assert.doesNotMatch(html + css, /https:\/\/takeitontheother\.site|@font-face|Arial|CoFo Sans/u);
    assert.match(css, /-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif/u);
    assert.match(html, /integration preview/u);
});

for (const fixture of fixtures.cases) {
    test(`frozen and isolated implementations match golden geometry: ${fixture.id}`, () => {
        for (const app of [createLegacy(), migrated()]) {
            for (const [id, value] of fixture.changes) app.change(id, value);
            const { svg, name } = app.export();
            const lines = roundedGeometry(svgLines(svg));
            assert.equal(createHash('sha256').update(JSON.stringify(lines)).digest('hex'), fixture.expected.geometrySha256);
            assert.deepEqual(lines, roundedGeometry(app.context.lines));
            assert.equal(name, fixture.expected.filename);
            assert.equal(svg.children.filter(node => node.tagName === 'G').length, fixture.expected.modules);
            assert.equal(svg.children.filter(node => node.tagName === 'LINE').length, fixture.expected.dividers);
            assert.equal(lines.length, fixture.expected.lines);
            assert.deepEqual(lines[0], fixture.expected.first); assert.deepEqual(lines.at(-1), fixture.expected.last);
        }
    });
}

test('isolated save/load/reset cannot read, overwrite or remove the original namespace', () => {
    const app = migrated(); app.change('rayCountSlider',8);
    assert.equal(JSON.parse(app.storage.get(storageKey)).rayCount,8);
    assert.equal(app.storage.get('rayPatternSettings'),'original sentinel');
    const reloaded = migrated({ saved: JSON.parse(app.storage.get(storageKey)) });
    assert.equal(+reloaded.nodes.get('rayCountSlider').value,8);
    reloaded.nodes.get('resetBtn').click();
    assert.equal(reloaded.nodes.get('imageUpload').intakeResetCount, 1);
    assert.equal(reloaded.storage.has(storageKey),false);
    assert.equal(reloaded.storage.get('rayPatternSettings'),'original sentinel');
});

test('restored outer radius is used on the very next gap edit', () => {
    const app = migrated({ saved: { rayLength: 100, gap: 30, scale: 1 } });
    app.change('gapSlider', 35);
    assert.equal(+app.nodes.get('rayLengthSlider').value, 95);
});

test('image tone survives settings/filename round trip; old names still work', () => {
    const app = migrated({ saved: { imageRasterMode: true, zeroRayLength: 70, hundredRayLength: 130, zeroLineWidth: 3, hundredLineWidth: 4 } });
    assert.equal(+app.nodes.get('zeroRayLengthSlider').value, 70);
    const name = app.export().name;
    assert.match(name, /_hl70_hw3\.0_sl130_sw4\.0_im1/);
    const restored = migrated(); restored.restore(name);
    assert.equal(+restored.nodes.get('hundredLineWidthSlider').value, 4);
    restored.restore('ray_pattern_lw2.0_ll56_lc5_co19_sc1.0_hg20_vg10_im1_ct1.0.svg');
    assert.equal(+restored.nodes.get('scaleSlider').value, 1);
});

test('tone modes are exclusive in both directions; image can be selected again', () => {
    const app = migrated();
    app.change('imageRasterModeCheckbox', true); app.change('rasterModeCheckbox', true);
    assert.equal(app.nodes.get('imageRasterModeCheckbox').checked, false);
    app.change('imageRasterModeCheckbox', true);
    assert.equal(app.nodes.get('rasterModeCheckbox').checked, false);
    app.upload({width:1,height:1,data:new Uint8ClampedArray([255,255,255,255])});
    assert.equal(app.nodes.get('imageUpload').value, '');
});

test('download URLs are revoked after dispatch, not leaked', () => {
    const app = migrated(); app.export();
    assert.equal(app.urls.size, 1); app.flushTimers();
    assert.equal(app.urls.size, 0); assert.equal(app.revoked.length, 1);
});

test('removing an image clears decoded source and returns to the no-source geometry', () => {
    const app = migrated(); app.change('imageRasterModeCheckbox', true);
    const before = roundedGeometry(svgLines(app.export().svg));
    app.upload({ width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) });
    assert.notDeepEqual(roundedGeometry(svgLines(app.export().svg)), before);
    app.nodes.get('imageUpload').removeImage();
    assert.deepEqual(roundedGeometry(svgLines(app.export().svg)), before);
    assert.equal(app.nodes.get('imagePreview').style.display, 'none');
});

for (const stage of ['read', 'decode', 'late-decode-after-return']) {
    test(`image ${stage} does not replace the model or preview`, async () => {
        let select, reader, image;
        const controller = { bound: true, operationId: 1 };
        const app = migrated({ dependencies: {
            connectFileInput({ onSelect }) { select = onSelect; },
            FileReader: class { constructor() { reader = this; } readAsDataURL() {} },
            Image: class { constructor() { image = this; } set src(value) {} }
        } });
        app.change('imageRasterModeCheckbox', true);
        const before = roundedGeometry(svgLines(app.export().svg));
        const pending = select({ type: 'image/png', name: 'fixture.png' }, { controller });
        const rejected = assert.rejects(pending, stage === 'read' ? /Could not read/ : stage === 'decode' ? /Could not decode/ : /Cancelled/);
        if (stage === 'read') reader.onerror();
        else {
            reader.onload({ target: { result: 'data:image/png;base64,fixture' } });
            if (stage === 'decode') image.onerror();
            else {
                // Same document after pagehide/pageshow: bound alone is not enough.
                controller.bound = false; controller.operationId++; controller.bound = true;
                image.onload();
            }
        }
        await rejected;
        assert.equal(app.imageDecodes, 0);
        assert.deepEqual(roundedGeometry(svgLines(app.export().svg)), before);
        assert.equal(app.nodes.get('imagePreview').getAttribute('src'), null);
    });
}

test('Rays enters runtime/audit while staying unpublished on the hub', async () => {
    const catalog = JSON.parse(await read('infra/TOOL_CATALOG.json'));
    assert.equal(catalog.tools.find(tool => tool.id === 'rays_pattern_generator').state,'migrating');
    assert.match(await read('infra/qa/ui-audit/index.html'), /value="rays_pattern_generator" data-tool-state="migrating">Rays Pattern — перенос/u);
    assert.doesNotMatch(await read('index.html'), /href="(?:tools\/)?rays_pattern_generator\//u);
});
