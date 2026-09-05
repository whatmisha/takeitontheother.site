import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { HistoryManager } from '../src/core/history.js';
import { SEEDED_PRESETS } from '../src/core/presets.js';
import { rotationControlValue, rotationPreviewOffsets } from '../src/GlobalApp.js';
import { buildGlobalScene, defaultSettings } from '../src/geometry/globalGeometry.js';
import { sceneToSvgString } from '../src/render/globalRenderer.js';
import { crc32, StoredZipBlobBuilder } from '../src/export/zipStore.js';
import { muxAvcToMp4 } from '../src/export/mp4Muxer.js';

test('history groups a changing value into one undoable snapshot', () => {
    const history = new HistoryManager({ value: 1 });
    history.schedule({ value: 2 });
    history.schedule({ value: 3 });
    history.flush();
    assert.deepEqual(history.undo(), { value: 1 });
    assert.deepEqual(history.redo(), { value: 3 });
});

test('vector export contains only clean spherical mark paths', () => {
    const scene = buildGlobalScene({ ...defaultSettings(), showGuides: true });
    const svg = sceneToSvgString(scene);
    assert.match(svg, /^<\?xml/);
    assert.equal((svg.match(/<path /g) || []).length, scene.elements.filter((mark) => mark.frontPath).length);
    assert.doesNotMatch(svg, /<ellipse /);
    assert.doesNotMatch(svg, /guide|data-selected|ellipse-mark/);
    assert.doesNotMatch(svg, /opacity="0\.[0-9]+"/);

    const backsideSvg = sceneToSvgString(buildGlobalScene({ ...defaultSettings(), showBackside: true }));
    assert.match(backsideSvg, /opacity="0\.2"/);
});

test('CRC32 and incremental ZIP output use standard signatures', async () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
    const zip = new StoredZipBlobBuilder()
        .add('frame.png', new Uint8Array([1, 2, 3]))
        .toBlob();
    const bytes = new Uint8Array(await zip.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
    assert.deepEqual([...bytes.slice(-22, -18)], [0x50, 0x4b, 0x05, 0x06]);
});

test('MP4 muxer writes a playable ISO BMFF skeleton', () => {
    const mp4 = muxAvcToMp4({
        chunks: [{ data: new Uint8Array([0, 0, 0, 1, 9]), timestamp: 0, type: 'key' }],
        decoderConfig: new Uint8Array([1, 100, 0, 40, 255]),
        width: 1080,
        height: 1080,
        fps: 60
    });
    const text = new TextDecoder('latin1').decode(mp4);
    assert.match(text, /ftyp/);
    assert.match(text, /moov/);
    assert.match(text, /mdat/);
});

test('the Global interface loads only CoFo Sans and never aliases TT Commons', async () => {
    const css = await readFile(new URL('../styles/global.css', import.meta.url), 'utf8');
    assert.match(css, /CoFoSans-Regular/);
    assert.match(css, /font-family: 'CoFo Sans'/);
    assert.doesNotMatch(css, /TT[_ ]Commons/i);
});

test('geometry controls expose topology modes, backside, and editable slider values', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="showBackside"[^>]*data-setting="showBackside"/);
    assert.doesNotMatch(html, /id="overlapGapGroup"[^>]*hidden/);
    assert.ok(html.indexOf('id="overlapGapGroup"') < html.indexOf('id="preventOverlap"'));
    assert.match(html, /name="topologyMode" value="packed" checked/);
    assert.match(html, /name="topologyMode" value="tessellated"/);
    assert.match(html, /name="topologyMode" value="progressive"/);
    assert.match(html, /name="topologyMode" value="rings"/);
    assert.doesNotMatch(html, /<output/);
    assert.match(html, /class="value-display" id="diameterValue"/);
    assert.match(html, /class="value-display" id="packingCoverageValue"/);
});

test('the staged Selection panel stays hidden and outside panel shortcuts', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.match(html, /id="selectionPanel"[^>]*hidden[^>]*aria-hidden="true"/);
    const panelList = app.match(/new PanelManager\(\[([\s\S]*?)\]\)/)?.[1] || '';
    assert.doesNotMatch(panelList, /selectionPanel/);
    assert.doesNotMatch(app, /this\.bindSelectionControls\(\)/);
    assert.doesNotMatch(app, /selectEllipse\(drag\.hitId/);
});

test('the temporary play control previews the saved eased rotation beside zoom', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.ok(html.indexOf('id="zoomDisplay"') < html.indexOf('id="rotationPreviewButton"'));
    const start = rotationPreviewOffsets(0);
    const middle = rotationPreviewOffsets(0.25);
    const end = rotationPreviewOffsets(1);
    assert.deepEqual(start, { rotationX: 0, rotationY: 0, rotationZ: 0 });
    assert.ok(middle.rotationX > 0);
    assert.equal(middle.rotationY, 0);
    assert.equal(middle.rotationZ, 0);
    assert.deepEqual(end, { rotationX: 360, rotationY: 0, rotationZ: 0 });
    assert.deepEqual(rotationPreviewOffsets(1, 'z'), { rotationX: 0, rotationY: 0, rotationZ: 360 });
    assert.deepEqual(rotationPreviewOffsets(1, 'x', 180), { rotationX: 180, rotationY: 0, rotationZ: 0 });
    assert.doesNotMatch(app, /Math\.sin/);
    const samples = Array.from({ length: 101 }, (_, index) => rotationPreviewOffsets(index / 100));
    samples.slice(1).forEach((sample, index) => {
        assert.ok(sample.rotationX >= samples[index].rotationX);
        assert.equal(sample.rotationY, 0);
        assert.equal(sample.rotationZ, 0);
    });
    assert.equal(samples.at(-1).rotationX - samples[0].rotationX, 360);
    assert.ok(rotationPreviewOffsets(0.001).rotationX < 0.00001);
    assert.ok(360 - rotationPreviewOffsets(0.999).rotationX < 0.00001);
    assert.equal(rotationControlValue(140 + rotationPreviewOffsets(0.5).rotationX), -40);
    assert.match(app, /const durationMs = duration \* 1000/);
    assert.match(app, /rotationPreviewOffsets\(progress, axis, degrees, easing\);\s*this\.syncRotationControls\(\)/);
});

test('rotation animation settings survive JSON and old states receive safe defaults', () => {
    const settings = defaultSettings();
    assert.deepEqual(JSON.parse(JSON.stringify(settings)).rotationAnimation, {
        axis: 'x',
        degrees: 360,
        duration: 3,
        easing: 'smootherstep'
    });
    const scene = buildGlobalScene({ ellipseCount: 9 });
    assert.deepEqual(scene.settings.rotationAnimation, settings.rotationAnimation);
});

test('Transform ends with one reset button that clears all rotation axes', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../styles/global.css', import.meta.url), 'utf8');
    const transform = html.match(/<aside[^>]*id="transformPanel"[\s\S]*?<\/aside>/)?.[0] || '';
    assert.ok(transform.indexOf('id="rotationZ"') < transform.indexOf('id="resetTransform"'));
    assert.match(transform, /id="resetTransform"[^>]*>[\s\S]*?Reset position/);
    assert.match(app, /resetTransform[\s\S]*?rotationX: 0, rotationY: 0, rotationZ: 0/);
    assert.match(css, /\.panel-reset-button\s*\{[\s\S]*?width: 100%/);
});

test('manual magnet coordinates stay visible and are disabled only while the field follows the cursor', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.doesNotMatch(html, /id="magnetManualControls"[^>]*hidden/);
    assert.match(html, /id="magnetX"[^>]*disabled/);
    assert.match(html, /id="magnetRadius"[^>]*disabled/);
    assert.match(html, /id="magnetFollow"[^>]*disabled/);
    assert.match(html, /Field follows cursor/);
    assert.match(app, /magnetFollow: false, magnetX: 240, magnetY: 240/);
    assert.match(app, /syncMagnetUI/);
    assert.match(app, /this\.settings\.magnetStrength > 0/);
    assert.match(app, /this\.syncMagnetPositionControls\(point\)/);
    assert.match(app, /event\.type === 'pointerup'[\s\S]*?magnetFollow: false/);
    assert.match(app, /magnetX: Math\.round\(point\.x\)/);
    assert.match(app, /magnetY: Math\.round\(point\.y\)/);
});

test('dependent geometry values move without changing fixed slider ranges', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.match(app, /geometryControlLimits\(this\.settings\)/);
    assert.doesNotMatch(app, /diameter\.max\s*=/);
    assert.doesNotMatch(app, /coverage\.max\s*=/);
    assert.doesNotMatch(app, /gap\.max\s*=/);
    assert.match(html, /id="diameter"[^>]*max="480"/);
    assert.match(html, /id="packingCoverage"[^>]*max="200"/);
    assert.match(html, /id="overlapGap"[^>]*max="100"/);
    assert.match(app, /move Diameter to the nearest usable value without changing its range/);
});

test('Iconic Five preserves the supplied settings as a built-in preset', () => {
    assert.deepEqual(SEEDED_PRESETS['Iconic Five'], {
        width: 480,
        height: 480,
        ellipseCount: 28,
        diameter: 48,
        packingCoverage: 100,
        sphereRadius: 152,
        perspective: 85,
        topologyMode: 'rings',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        magnetStrength: 0,
        magnetRadius: 42,
        magnetX: 240,
        magnetY: 240,
        magnetFollow: true,
        preventOverlap: true,
        overlapGap: 0,
        showGuides: false,
        showBackside: false,
        ellipseColor: '#ffffff',
        backgroundColor: '#000000',
        animationMode: 'static',
        animationFrom: 1,
        duration: 5,
        rotationAnimation: {
            axis: 'x',
            degrees: 360,
            duration: 3,
            easing: 'smootherstep'
        },
        overrides: {}
    });
});

test('Person Five preserves the supplied settings as a built-in preset', () => {
    assert.deepEqual(SEEDED_PRESETS['Person Five'], {
        width: 480,
        height: 480,
        ellipseCount: 28,
        diameter: 45,
        packingCoverage: 100,
        sphereRadius: 152,
        perspective: 86,
        topologyMode: 'rings',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        magnetStrength: 66,
        magnetRadius: 5,
        magnetX: 240,
        magnetY: 480,
        magnetFollow: false,
        preventOverlap: true,
        overlapGap: 0,
        showGuides: false,
        showBackside: false,
        ellipseColor: '#ffffff',
        backgroundColor: '#000000',
        animationMode: 'static',
        animationFrom: 1,
        duration: 5,
        rotationAnimation: {
            axis: 'x',
            degrees: 180,
            duration: 3,
            easing: 'smootherstep'
        },
        overrides: {}
    });
});

test('Five presets keep their own rotation animation settings', () => {
    assert.deepEqual(SEEDED_PRESETS['Iconic Five'].rotationAnimation, {
        axis: 'x', degrees: 360, duration: 3, easing: 'smootherstep'
    });
    assert.deepEqual(SEEDED_PRESETS['Person Five'].rotationAnimation, {
        axis: 'x', degrees: 180, duration: 3, easing: 'smootherstep'
    });
    assert.equal(Object.keys(SEEDED_PRESETS).filter((name) => name.startsWith('Iconic Five')).length, 1);
});

test('preset dropdown and share icon retain the framework chrome', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const css = await readFile(new URL('../styles/global.css', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.match(html, /class="preset-dropdown-arrow"/);
    assert.match(html, /M1 1L6 6L11 1/);
    assert.match(html, /M5\.7410987,3\.4304742/);
    assert.match(html, /x1="7\.5184826" y1="4\.4815174"/);
    assert.match(css, /\.preset-entry:hover\s*\{[\s\S]*?background: rgba\(255, 255, 255, 0\.08\)/);
    assert.match(css, /\.preset-list\s*\{[\s\S]*?left: 0;[\s\S]*?width: max-content/);
    assert.match(app, /builtIn \? '' : ' has-actions'/);
    assert.doesNotMatch(app, /button\.textContent = '✓'/);
});

test('Magnet occupies its own managed bottom-right panel without explanatory copy', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    const transform = html.match(/<aside[^>]*id="transformPanel"[\s\S]*?<\/aside>/)?.[0] || '';
    const magnet = html.match(/<aside[^>]*id="magnetPanel"[\s\S]*?<\/aside>/)?.[0] || '';
    assert.doesNotMatch(transform, /magnetStrength|Field radius|magnetFollow/);
    assert.match(magnet, /controls-panel--right-bottom/);
    assert.match(magnet, /id="magnetStrength"/);
    assert.doesNotMatch(magnet, /panel-hint|<p/);
    const panelList = app.match(/new PanelManager\(\[([\s\S]*?)\]\)/)?.[1] || '';
    assert.match(panelList, /magnetPanel/);
});

test('canvas selection is blocked while text inputs remain selectable', async () => {
    const css = await readFile(new URL('../styles/global.css', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.match(css, /#mainSvg[\s\S]*?-webkit-user-select: none/);
    assert.match(css, /input\[type="text"\][\s\S]*?user-select: text/);
    const bodyRule = css.match(/body\s*\{([^}]*)\}/)?.[1] || '';
    assert.doesNotMatch(bodyRule, /user-select:\s*none/);
    assert.match(app, /addEventListener\('selectstart', preventSelection\)/);
});
