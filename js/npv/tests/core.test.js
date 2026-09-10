import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { HistoryManager } from '../src/core/history.js';
import { DEFAULT_PRESET_NAME, SEEDED_PRESETS } from '../src/core/presets.js';
import { rotationControlValue, rotationPreviewOffsets } from '../src/GlobalApp.js';
import { buildGlobalScene, defaultSettings } from '../src/geometry/globalGeometry.js';
import { sceneToSvgString } from '../src/render/globalRenderer.js';
import { crc32, StoredZipBlobBuilder } from '../src/export/zipStore.js';
import { muxAvcToMp4 } from '../src/export/mp4Muxer.js';
import { rotationFrameCount, rotationFrameOptions } from '../src/animation/rotationAnimation.js';

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

test('Person Five is the initial preset for a fresh Global session', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.equal(DEFAULT_PRESET_NAME, 'Person Five');
    assert.match(html, /id="presetName">Person Five</);
    assert.match(app, /this\.presetManager\.get\(DEFAULT_PRESET_NAME\)/);
    assert.match(app, /DEFAULT_PRESET_VERSION = 3/);
    assert.match(app, /saved\.defaultPresetVersion !== DEFAULT_PRESET_VERSION/);
    assert.match(app, /if \(saved\.dirty\) this\.recoverSessionPreset\(saved\.settings\)/);
    assert.match(app, /SEEDED_PRESETS\[saved\.presetName\] && !saved\.dirty/);
    assert.match(app, /name = 'Recovered session'/);
    assert.equal(SEEDED_PRESETS['Person Five'].showMagnetField, false);
    assert.doesNotMatch(html, /←YF Tools/);
});

test('the temporary play control previews the saved eased rotation beside zoom', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    assert.ok(html.indexOf('id="zoomDisplay"') < html.indexOf('id="rotationPreviewButton"'));
    const start = rotationPreviewOffsets(0);
    const middle = rotationPreviewOffsets(0.25);
    const end = rotationPreviewOffsets(1);
    assert.deepEqual(start, { rotationX: 0, rotationY: 0, rotationZ: 0 });
    assert.equal(middle.rotationX, 0);
    assert.ok(middle.rotationY > 0);
    assert.equal(middle.rotationZ, 0);
    assert.deepEqual(end, { rotationX: 0, rotationY: 360, rotationZ: 0 });
    assert.deepEqual(rotationPreviewOffsets(1, 'z'), { rotationX: 0, rotationY: 0, rotationZ: 360 });
    assert.deepEqual(rotationPreviewOffsets(1, 'x', 180), { rotationX: 180, rotationY: 0, rotationZ: 0 });
    assert.doesNotMatch(app, /Math\.sin/);
    const samples = Array.from({ length: 101 }, (_, index) => rotationPreviewOffsets(index / 100));
    samples.slice(1).forEach((sample, index) => {
        assert.equal(sample.rotationX, 0);
        assert.ok(sample.rotationY >= samples[index].rotationY);
        assert.equal(sample.rotationZ, 0);
    });
    assert.equal(samples.at(-1).rotationY - samples[0].rotationY, 360);
    assert.ok(rotationPreviewOffsets(0.001).rotationY < 0.00001);
    assert.ok(360 - rotationPreviewOffsets(0.999).rotationY < 0.00001);
    assert.equal(rotationControlValue(140 + rotationPreviewOffsets(0.5).rotationY), -40);
    assert.match(app, /const durationMs = duration \* 1000/);
    assert.match(app, /rotationPreviewOffsets\(progress, axis, degrees, easing\);\s*this\.syncRotationControls\(\)/);
});

test('rotation animation exports MP4 and a transparent PNG sequence at 60 fps', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    const exporter = await readFile(new URL('../src/export/AnimationExporter.js', import.meta.url), 'utf8');
    const worker = await readFile(new URL('../src/export/animationExportWorker.js', import.meta.url), 'utf8');
    const settings = { ...defaultSettings(), ...SEEDED_PRESETS['Person Five'] };
    const frameCount = rotationFrameCount(settings);
    assert.equal(frameCount, 180);
    assert.deepEqual(rotationFrameOptions(settings, 0, frameCount), {
        rotationX: 0, rotationY: 0, rotationZ: 0
    });
    assert.deepEqual(rotationFrameOptions(settings, frameCount - 1, frameCount), {
        rotationX: 0, rotationY: 180, rotationZ: 0
    });
    assert.match(html, /id="exportPngSequence"[^>]*>Export PNG sequence/);
    assert.match(html, /id="exportVideo"[^>]*>Export MP4/);
    assert.match(app, /animationKind: 'rotation'/);
    assert.match(exporter, /settings\.rotationAnimation\.duration/);
    assert.match(worker, /rotationFrameOptions\(job\.settings, frameIndex, frameCount\)/);
    assert.match(worker, /animationMode: 'static'/);
    assert.match(worker, /transparent: true/);
});

test('rotation animation settings survive JSON and old states receive safe defaults', () => {
    const settings = defaultSettings();
    assert.deepEqual(JSON.parse(JSON.stringify(settings)).rotationAnimation, {
        axis: 'y',
        degrees: 360,
        duration: 3,
        easing: 'smootherstep',
        coordinateMode: 'screen'
    });
    const scene = buildGlobalScene({ ellipseCount: 9 });
    assert.deepEqual(scene.settings.rotationAnimation, settings.rotationAnimation);
    const migrated = buildGlobalScene({
        ...settings,
        rotationAnimation: { axis: 'x', degrees: 180, duration: 3, easing: 'smootherstep' }
    });
    assert.equal(migrated.settings.rotationAnimation.axis, 'y');
    assert.equal(migrated.settings.rotationAnimation.coordinateMode, 'screen');
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

test('ellipse density accepts up to 2048 marks', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="ellipseCount"[^>]*max="2048"/);
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
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        magnetRadius: 42,
        magnetX: 240,
        magnetY: 240,
        magnetFollow: true,
        showMagnetField: true,
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
            axis: 'y',
            degrees: 360,
            duration: 3,
            easing: 'smootherstep',
            coordinateMode: 'screen'
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
        rotationCoordinateMode: 'screen',
        magnetStrength: 66,
        magnetRadius: 5,
        magnetX: 240,
        magnetY: 480,
        magnetFollow: false,
        showMagnetField: false,
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
            axis: 'y',
            degrees: 180,
            duration: 3,
            easing: 'smootherstep',
            coordinateMode: 'screen'
        },
        overrides: {}
    });
});

test('Five presets keep their own rotation animation settings', () => {
    assert.deepEqual(SEEDED_PRESETS['Iconic Five'].rotationAnimation, {
        axis: 'y', degrees: 360, duration: 3, easing: 'smootherstep', coordinateMode: 'screen'
    });
    assert.deepEqual(SEEDED_PRESETS['Person Five'].rotationAnimation, {
        axis: 'y', degrees: 180, duration: 3, easing: 'smootherstep', coordinateMode: 'screen'
    });
    assert.equal(Object.keys(SEEDED_PRESETS).filter((name) => name.startsWith('Iconic Five')).length, 1);
});

test('Transform axes and canvas drag use the same screen-oriented coordinates', async () => {
    const app = await readFile(new URL('../src/GlobalApp.js', import.meta.url), 'utf8');
    const presets = await readFile(new URL('../src/core/presets.js', import.meta.url), 'utf8');
    assert.match(app, /rotationX = this\.rotationDrag\.rotationX \+ dx \* 0\.42/);
    assert.match(app, /rotationY = this\.rotationDrag\.rotationY - dy \* 0\.42/);
    assert.match(presets, /if \(!Object\.hasOwn\(source, 'rotationCoordinateMode'\)\) delete state\.rotationCoordinateMode/);
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
    assert.match(magnet, /id="showMagnetField"[^>]*data-setting="showMagnetField"/);
    assert.doesNotMatch(magnet, /id="showMagnetField"[^>]*checked/);
    assert.match(magnet, />Field<\/span>/);
    assert.match(app, /getElementById\('showMagnetField'\)\.disabled = !active/);
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
