import { effectDefaults, gradientLine } from './effects.js';

const buffers = new WeakMap();
function shadowBuffers(ctx) {
    let pair = buffers.get(ctx);
    if (!pair) {
        pair = ['stack', 'shadow', 'surfaces'].map(() => document.createElement('canvas').getContext('2d'));
        buffers.set(ctx, pair);
    }
    for (const buffer of pair) {
        if (buffer.canvas.width !== ctx.canvas.width || buffer.canvas.height !== ctx.canvas.height) {
            buffer.canvas.width = ctx.canvas.width; buffer.canvas.height = ctx.canvas.height;
        }
        buffer.resetTransform(); buffer.globalCompositeOperation = 'source-over'; buffer.shadowColor = 'transparent';
        buffer.clearRect(0, 0, buffer.canvas.width, buffer.canvas.height);
    }
    return pair;
}

function paintItem(ctx, item, scene, image, geometry) {
    const bounds = geometry.metrics[item.asset].bounds, size = geometry.dimensions(item, scene);
    ctx.save(); ctx.translate(item.x * scene.width, item.y * scene.height); ctx.rotate(item.rotation * Math.PI / 180);
    ctx.drawImage(image, ...bounds, -size.width / 2, -size.height / 2, size.width, size.height);
    ctx.restore();
}

export function drawArtwork(ctx, scene, assets, geometry, items = scene.items) {
    const effects = { ...effectDefaults, ...scene };
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, scene.width, scene.height); ctx.clip();
    if (effects.backgroundMode === 'solid') ctx.fillStyle = effects.backgroundStart;
    else {
        const gradient = ctx.createLinearGradient(...gradientLine(scene.width, scene.height, effects.backgroundAngle));
        effects.backgroundStops.forEach(({ offset, color }) => gradient.addColorStop(offset, color));
        ctx.fillStyle = gradient;
    }
    ctx.fillRect(0, 0, scene.width, scene.height);
    drawItems(ctx, scene, assets, geometry, items, effects);
    ctx.restore();
}

function drawItems(ctx, scene, assets, geometry, items, effects) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const shadows = effects.shadowEnabled && effects.shadowOpacity > 0;
    const [stack, shadow, surfaces] = shadows ? shadowBuffers(ctx) : [ctx];
    const transform = ctx.getTransform(), zoom = Math.hypot(transform.a, transform.b);
    const angle = effects.shadowAngle * Math.PI / 180;
    stack.imageSmoothingEnabled = true; stack.imageSmoothingQuality = 'high';
    for (const item of items) {
        if (item.visible === false) continue;
        const image = assets.get(item.asset);
        if (!image) continue;
        if (shadows) {
            const size = geometry.dimensions(item, scene);
            const centerX = transform.a * item.x * scene.width + transform.c * item.y * scene.height + transform.e;
            const shift = Math.max(0, centerX) + Math.hypot(size.width, size.height) * zoom + ctx.canvas.width + 1;
            shadow.resetTransform(); shadow.clearRect(0, 0, shadow.canvas.width, shadow.canvas.height);
            shadow.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e - shift, transform.f);
            // Put the caster offscreen and shift only its shadow back into the viewport.
            shadow.shadowColor = effects.shadowColor + Math.round(effects.shadowOpacity * 2.55).toString(16).padStart(2, '0');
            shadow.shadowBlur = effects.shadowBlur * zoom;
            shadow.shadowOffsetX = shift + Math.cos(angle) * effects.shadowDistance * zoom;
            shadow.shadowOffsetY = Math.sin(angle) * effects.shadowDistance * zoom;
            paintItem(shadow, item, scene, image, geometry);
            // Only ordinary objects receive shadows. Surface pixels live in a separate stack.
            stack.resetTransform(); stack.globalCompositeOperation = 'source-atop';
            stack.drawImage(shadow.canvas, 0, 0);
            stack.globalCompositeOperation = 'source-over'; stack.setTransform(transform);
            surfaces.setTransform(transform);
            const covered = item.kind === 'ground' ? stack : surfaces;
            covered.globalCompositeOperation = 'destination-out';
            paintItem(covered, item, scene, image, geometry);
            covered.globalCompositeOperation = 'source-over';
        }
        paintItem(shadows && item.kind === 'ground' ? surfaces : stack, item, scene, image, geometry);
    }
    if (shadows) {
        // The stacks partition the original alpha; add them before compositing onto the background.
        shadow.resetTransform(); shadow.shadowColor = 'transparent'; shadow.clearRect(0, 0, shadow.canvas.width, shadow.canvas.height);
        shadow.drawImage(surfaces.canvas, 0, 0);
        shadow.globalCompositeOperation = 'lighter'; shadow.drawImage(stack.canvas, 0, 0);
        shadow.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.resetTransform(); ctx.drawImage(shadow.canvas, 0, 0); ctx.restore();
    }
}

export function drawWorkspace(ctx, scene, assets, geometry, items = scene.items, selectedId = null) {
    // Only the selected layer has an editing-only, dimmed overflow preview.
    ctx.save(); ctx.globalAlpha = .3;
    drawItems(ctx, scene, assets, geometry, items.filter(item => item.id === selectedId), { ...effectDefaults, ...scene, shadowEnabled: false });
    ctx.restore();
    drawArtwork(ctx, scene, assets, geometry, items);
}

export async function renderPNG(scene, assets, geometry) {
    await assets.prepare(scene.items);
    const canvas = document.createElement('canvas');
    canvas.width = scene.width; canvas.height = scene.height;
    drawArtwork(canvas.getContext('2d'), scene, assets, geometry);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'));
    canvas.width = canvas.height = 1;
    return blob;
}

export function download(blob, filename) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
