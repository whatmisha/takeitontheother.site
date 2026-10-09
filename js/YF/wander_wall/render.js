import { effectDefaults, gradientLine } from './effects.js';

const outlines = new Map();
let outlinePixels = 0;
function outlinedImage(image, bounds, size, width, color) {
    const resolution = Math.min(1, 1024 / Math.max(size.width, size.height));
    const w = Math.max(1, Math.round(size.width * resolution)), h = Math.max(1, Math.round(size.height * resolution));
    const radius = width * resolution, padding = Math.ceil(radius) + 2;
    const key = [image.src, w, h, radius.toFixed(2), color].join('|');
    if (outlines.has(key)) {
        const cached = outlines.get(key); outlines.delete(key); outlines.set(key, cached); return cached;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w + padding * 2; canvas.height = h + padding * 2;
    const ctx = canvas.getContext('2d');
    // Faint alpha residue in PNGs must not turn into rings after repeated stamps.
    const stamp = document.createElement('canvas'); stamp.width = w; stamp.height = h;
    const mask = stamp.getContext('2d'); mask.drawImage(image, ...bounds, 0, 0, w, h);
    const pixels = mask.getImageData(0, 0, w, h);
    for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] >= 32 ? 255 : 0;
    mask.putImageData(pixels, 0, 0);
    const steps = Math.max(32, Math.ceil(radius * Math.PI * 2));
    for (let i = 0; i < steps; i++) {
        const angle = i * Math.PI * 2 / steps;
        ctx.drawImage(stamp, padding + Math.cos(angle) * radius, padding + Math.sin(angle) * radius);
    }
    ctx.drawImage(stamp, padding, padding);
    stamp.width = stamp.height = 1;
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const result = { canvas, padding: padding / resolution, width: canvas.width / resolution, height: canvas.height / resolution };
    outlines.set(key, result);
    outlinePixels += canvas.width * canvas.height;
    while (outlinePixels > 16 * 1024 * 1024 && outlines.size > 1) {
        const first = outlines.keys().next().value, old = outlines.get(first);
        outlinePixels -= old.canvas.width * old.canvas.height;
        old.canvas.width = old.canvas.height = 1; outlines.delete(first);
    }
    return result;
}

export function drawArtwork(ctx, scene, assets, geometry, items = scene.items) {
    const effects = { ...effectDefaults, ...scene };
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, scene.width, scene.height); ctx.clip();
    if (effects.backgroundMode === 'solid') ctx.fillStyle = effects.backgroundStart;
    else {
        const gradient = ctx.createLinearGradient(...gradientLine(scene.width, scene.height, effects.backgroundAngle));
        [[0, effects.backgroundStart], [.302885, effects.backgroundMidLow], [.649038, effects.backgroundMidHigh], [1, effects.backgroundEnd]].forEach(([offset, color]) => gradient.addColorStop(offset, color));
        ctx.fillStyle = gradient;
    }
    ctx.fillRect(0, 0, scene.width, scene.height);
    drawItems(ctx, scene, assets, geometry, items, effects);
    ctx.restore();
}

function drawItems(ctx, scene, assets, geometry, items, effects) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const item of items) {
        if (item.visible === false) continue;
        const image = assets.get(item.asset);
        if (!image) continue;
        const [x, y, width, height] = geometry.metrics[item.asset].bounds;
        const size = geometry.dimensions(item, scene);
        ctx.save(); ctx.translate(item.x * scene.width, item.y * scene.height); ctx.rotate(item.rotation * Math.PI / 180);
        if (item.kind !== 'ground' && effects.shadowEnabled && effects.shadowOpacity > 0) {
            const transform = ctx.getTransform(), zoom = Math.hypot(transform.a, transform.b);
            const angle = effects.shadowAngle * Math.PI / 180;
            ctx.shadowColor = effects.shadowColor + Math.round(effects.shadowOpacity * 2.55).toString(16).padStart(2, '0');
            ctx.shadowBlur = effects.shadowBlur * zoom;
            ctx.shadowOffsetX = Math.cos(angle) * effects.shadowDistance * zoom;
            ctx.shadowOffsetY = Math.sin(angle) * effects.shadowDistance * zoom;
        }
        if (item.kind !== 'ground' && effects.outlineEnabled && effects.outlineWidth > 0) {
            const outline = outlinedImage(image, [x, y, width, height], size, effects.outlineWidth, effects.outlineColor);
            ctx.drawImage(outline.canvas, -size.width / 2 - outline.padding, -size.height / 2 - outline.padding, outline.width, outline.height);
            ctx.shadowColor = 'transparent';
        }
        ctx.drawImage(image, x, y, width, height, -size.width / 2, -size.height / 2, size.width, size.height);
        ctx.restore();
    }
}

export function drawWorkspace(ctx, scene, assets, geometry, items = scene.items) {
    // The opaque artboard covers the editing-only, dimmed overflow preview.
    ctx.save(); ctx.globalAlpha = .3;
    drawItems(ctx, scene, assets, geometry, items.filter(item => item.kind !== 'ground'), { ...effectDefaults, ...scene });
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
