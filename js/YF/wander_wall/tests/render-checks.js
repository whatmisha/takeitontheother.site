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
    document.getElementById('results').textContent = `PASS: ${checks.length} checks\n` + checks.join('\n');
    document.documentElement.dataset.result = 'passed';
} catch (error) {
    document.getElementById('results').textContent = `FAIL: ${error.message}\n` + checks.join('\n');
    document.documentElement.dataset.result = 'failed';
}
