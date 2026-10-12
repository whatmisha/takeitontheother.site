import { drawArtwork, drawWorkspace, renderPNG } from '../render.js';
import { effectDefaults } from '../effects.js';

const checks = [];
const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
const stamp = color => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 20, 20); return canvas;
};
const images = { receiver: stamp('#00ff00'), caster: stamp('#ff0000'), surface: stamp('#0000ff'), translucent: stamp('#0000ff80') };
const assets = { get: id => images[id], async prepare() {} };
const geometry = { metrics: Object.fromEntries(Object.keys(images).map(id => [id, { bounds: [0, 0, 20, 20] }])), dimensions: item => ({ width: item.w, height: item.h }) };
const receiver = { id: 'receiver', asset: 'receiver', kind: 'form', x: 50 / 128, y: 60 / 96, rotation: 0, w: 60, h: 40 };
const caster = { id: 'caster', asset: 'caster', kind: 'letter', x: 70 / 128, y: 35 / 96, rotation: 0, w: 40, h: 40 };
const scene = { ...effectDefaults, width: 128, height: 96, backgroundMode: 'solid', backgroundStart: '#ffffff', shadowEnabled: true,
    shadowColor: '#000000', shadowOpacity: 50, shadowBlur: 0, shadowDistance: 15, shadowAngle: 90, items: [receiver, caster] };
function render(settings, scale = 1, pan = 0) {
    const canvas = document.createElement('canvas'); canvas.width = 128 * scale + pan * 2; canvas.height = 96 * scale + pan * 2;
    const ctx = canvas.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, pan, pan); drawArtwork(ctx, settings, assets, geometry);
    return { canvas, pixel: (x, y) => [...ctx.getImageData(Math.floor(x * scale + pan), Math.floor(y * scale + pan), 1, 1).data] };
}
try {
    for (const scale of [.5, 1, 2]) {
        const { canvas, pixel } = render(scene, scale, 6);
        assert(pixel(60, 62)[1] > 115 && pixel(60, 62)[1] < 140, `Shadow reaches an ordinary object at ${scale}x`);
        assert(pixel(85, 62).join() === '255,255,255,255', `Background receives no shadow at ${scale}x`);
        assert(pixel(60, 30).join() === '255,0,0,255', `Caster is not shaded by itself at ${scale}x`);
        assert(pixel(30, 60).join() === '0,255,0,255', `Uncovered receiver stays unchanged at ${scale}x`);
        document.getElementById('samples').append(canvas);
        const surface = render({ ...scene, items: [{ ...receiver, kind: 'ground' }, caster] }, scale, 6);
        assert(surface.pixel(60, 62).join() === '0,255,0,255', `Surface receives no shadow at ${scale}x`);
    }
    const hidden = render({ ...scene, items: [receiver, { ...caster, visible: false }] });
    assert(hidden.pixel(60, 62).join() === '0,255,0,255', 'Hidden layers do not cast shadows');
    const single = render({ ...scene, items: [caster] });
    assert(single.pixel(70, 62).join() === '255,255,255,255', 'An isolated object never shadows the background');
    const reversed = render({ ...scene, items: [caster, receiver] });
    assert(reversed.pixel(60, 62).join() === '0,255,0,255', 'Shadows respect layer order');
    const outside = render({ ...scene, items: [{ ...receiver, y: 10 / 96, h: 20 }, { ...caster, y: -10 / 96, h: 12 }] });
    assert(outside.pixel(60, 7)[1] < 140, 'Off-canvas objects can cast shadows onto in-frame objects');
    const blurred = render({ ...scene, shadowBlur: 12 });
    assert(blurred.pixel(85, 65).join() === '255,255,255,255', 'Blur cannot leak onto the background');
    const surface = { ...receiver, id: 'surface', asset: 'surface', kind: 'ground', x: 70 / 128, y: 65 / 96, w: 20, h: 30 };
    const interleaved = render({ ...scene, items: [receiver, surface, caster] });
    assert(interleaved.pixel(55, 62)[1] < 140, 'Objects below a Surface still receive shadows in exposed areas');
    assert(interleaved.pixel(70, 62).join() === '0,0,255,255', 'A Surface above an object masks its shadows');
    const above = render({ ...scene, items: [receiver, surface, { ...receiver, x: 70 / 128, w: 10 }, caster] });
    assert(above.pixel(70, 62)[1] < 140, 'Objects above a Surface still receive shadows');
    const surfaceCaster = render({ ...scene, items: [receiver, { ...caster, kind: 'ground' }] });
    assert(surfaceCaster.pixel(60, 62)[1] < 140, 'Surface can still cast shadows onto ordinary objects');
    const transparent = { ...scene, shadowDistance: 300, items: [receiver, { ...surface, asset: 'translucent' }, caster] };
    const split = render(transparent).canvas.getContext('2d').getImageData(0, 0, 128, 96).data;
    const unsplit = render({ ...transparent, shadowEnabled: false }).canvas.getContext('2d').getImageData(0, 0, 128, 96).data;
    assert(split.every((value, i) => Math.abs(value - unsplit[i]) <= 1), 'Separating Surface preserves translucent edges and layer colors');
    const workspace = document.createElement('canvas'); workspace.width = 208; workspace.height = 176;
    const workspaceCtx = workspace.getContext('2d'), outsideItems = [{ ...receiver, x: -5 / 128 }, { ...caster, x: 130 / 128 }];
    const workspacePixel = (x, y) => [...workspaceCtx.getImageData(x + 40, y + 40, 1, 1).data];
    const preview = (selectedId, items = outsideItems) => {
        workspaceCtx.resetTransform(); workspaceCtx.clearRect(0, 0, 208, 176); workspaceCtx.translate(40, 40);
        drawWorkspace(workspaceCtx, scene, assets, geometry, items, selectedId);
    };
    preview(null);
    assert(workspacePixel(-10, 60)[3] === 0 && workspacePixel(130, 35)[3] === 0, 'Unselected overflow is invisible');
    preview('receiver');
    assert(workspacePixel(-10, 60)[3] > 70 && workspacePixel(-10, 60)[3] < 80, 'Selected overflow remains dimmed');
    assert(workspacePixel(130, 35)[3] === 0, 'Other objects stay clipped while a layer is selected');
    assert(workspacePixel(5, 60).join() === '0,255,0,255', 'Selection does not dim the in-frame artwork');
    preview('receiver', [{ ...outsideItems[0], visible: false }]);
    assert(workspacePixel(-10, 60)[3] === 0, 'Hidden selection has no overflow preview');
    preview('receiver', [{ ...outsideItems[0], kind: 'ground' }]);
    assert(workspacePixel(-10, 60)[3] > 70, 'Selected Surface has the same overflow preview');
    const blob = await renderPNG(scene, assets, geometry), bitmap = await createImageBitmap(blob);
    assert(bitmap.width === 128 && bitmap.height === 96, 'PNG keeps exact output dimensions');
    const exported = document.createElement('canvas'); exported.width = 128; exported.height = 96;
    const output = exported.getContext('2d'); output.drawImage(bitmap, 0, 0); bitmap.close();
    const expected = render(scene).canvas.getContext('2d').getImageData(0, 0, 128, 96).data;
    const actual = output.getImageData(0, 0, 128, 96).data;
    assert(expected.every((value, i) => value === actual[i]), 'PNG pixels match the artwork preview');
    const surfaceBlob = await renderPNG({ ...scene, items: [surface, caster] }, assets, geometry), surfaceBitmap = await createImageBitmap(surfaceBlob);
    output.clearRect(0, 0, 128, 96); output.drawImage(surfaceBitmap, 0, 0); surfaceBitmap.close();
    assert([...output.getImageData(70, 62, 1, 1).data].join() === '0,0,255,255', 'Exported Surface never receives shadows');
    for (const count of [2, 8]) {
        const colors = ['#ff0000', '#ff6600', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#7700ff', '#ff00ff'].slice(0, count);
        const gradientScene = { ...scene, items: [], backgroundMode: 'gradient', backgroundAngle: 90,
            backgroundStops: colors.map((color, i) => ({ color, offset: i / (count - 1) })) };
        const preview = render(gradientScene);
        assert(preview.pixel(1, 48)[0] > 240 && preview.pixel(1, 48)[2] < 30, `${count}-color gradient uses its first color`);
        const image = await createImageBitmap(await renderPNG(gradientScene, assets, geometry));
        output.clearRect(0, 0, 128, 96); output.drawImage(image, 0, 0); image.close();
        const expectedGradient = preview.canvas.getContext('2d').getImageData(0, 0, 128, 96).data;
        const actualGradient = output.getImageData(0, 0, 128, 96).data;
        assert(expectedGradient.every((value, i) => value === actualGradient[i]), `${count}-color gradient survives PNG export exactly`);
    }
    const bytes = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    images.neutral = stamp('#303030'); geometry.metrics.neutral = { bounds: [0, 0, 20, 20] };
    const rimObject = { ...caster, asset: 'neutral', x: .5, y: .5, w: 40, h: 40 };
    const rimScene = { ...scene, shadowEnabled: false, backgroundStart: '#102030', items: [rimObject], rimLightEnabled: true };
    const rim = render(rimScene), noRim = render({ ...rimScene, rimLightEnabled: false });
    const rimPixels = bytes(rim.canvas), noRimPixels = bytes(noRim.canvas);
    assert(bytes(render({ ...rimScene, rimLightIntensity: 0 }).canvas).every((v, i) => v === rimPixels[i]), 'Legacy intensity cannot change the fixed Rim light');
    const facing = rim.pixel(45, 48), shaded = rim.pixel(82, 48);
    assert(facing[0] > facing[1] && facing[1] > facing[2] && facing[0] > shaded[0], 'Rim light is warm and directional, not a uniform outline');
    assert(rim.pixel(42, 48)[0] > noRim.pixel(42, 48)[0], 'Rim has a soft outward glow');
    assert(rim.pixel(64, 48).join() === noRim.pixel(64, 48).join(), 'Rim does not recolor object interiors');
    assert(rim.pixel(2, 2).join() === noRim.pixel(2, 2).join(), 'Rim does not tint distant background pixels');
    const hiddenRim = render({ ...rimScene, items: [{ ...rimObject, visible: false }] });
    const emptyRimPixels = bytes(render({ ...rimScene, items: [] }).canvas);
    assert(bytes(hiddenRim.canvas).every((v, i) => v === emptyRimPixels[i]), 'Hidden layers emit no rim light');
    for (const kind of ['form', 'ground']) {
        const cover = { ...rimObject, id: 'cover', kind, x: 50 / 128, w: 20 };
        const occluded = render({ ...rimScene, items: [rimObject, cover] });
        const coverOnly = render({ ...rimScene, items: [cover] });
        assert(occluded.pixel(45, 48).join() === coverOnly.pixel(45, 48).join(), `${kind} layers occlude rim light behind them`);
    }
    const rotatedRim = render({ ...rimScene, items: [{ ...rimObject, rotation: 180 }] });
    assert(rotatedRim.pixel(45, 48)[0] > rotatedRim.pixel(82, 48)[0], 'Light direction remains fixed when an object rotates');
    for (const scale of [.5, 2]) {
        const zoomed = render(rimScene, scale, 12);
        assert(zoomed.pixel(45, 48)[0] > zoomed.pixel(82, 48)[0], `Rim survives zoom and pan at ${scale}x`);
        assert(zoomed.canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 0, 'Rim stays clipped to the artwork frame');
    }
    drawArtwork(rim.canvas.getContext('2d'), rimScene, assets, geometry);
    assert(bytes(rim.canvas).every((v, i) => v === rimPixels[i]), 'Cached Rim light does not accumulate on redraw');
    drawArtwork(rim.canvas.getContext('2d'), { ...rimScene, rimLightEnabled: false }, assets, geometry);
    assert(bytes(rim.canvas).every((v, i) => v === noRimPixels[i]), 'Turning Rim light off restores the original pixels');
    for (const shadowEnabled of [false, true]) {
        const settings = { ...rimScene, shadowEnabled };
        const expected = bytes(render(settings).canvas);
        const image = await createImageBitmap(await renderPNG(settings, assets, geometry));
        output.clearRect(0, 0, 128, 96); output.drawImage(image, 0, 0); image.close();
        assert(bytes(exported).every((v, i) => v === expected[i]), `Rim preview and PNG match with shadows ${shadowEnabled ? 'on' : 'off'}`);
    }
    document.getElementById('results').textContent = `PASS: ${checks.length} checks\n` + checks.join('\n');
    document.documentElement.dataset.result = 'passed';
} catch (error) {
    document.getElementById('results').textContent = `FAIL: ${error.message}\n` + checks.join('\n');
    document.documentElement.dataset.result = 'failed';
}
