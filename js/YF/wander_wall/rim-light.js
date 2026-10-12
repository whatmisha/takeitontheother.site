const masks = new WeakMap(), layers = new WeakMap();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function soften(mask, width, height, radius) {
    radius = Math.max(1, Math.round(radius));
    let source = mask.slice(), target = new Float32Array(mask.length);
    const scratch = new Float32Array(mask.length);
    const divisor = 2 * radius + 1;
    // Three separable box passes approximate a Gaussian without a per-pixel kernel loop.
    for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < height; y++) {
            let sum = 0;
            const row = y * width;
            for (let k = -radius; k <= radius; k++) sum += source[row + clamp(k, 0, width - 1)];
            for (let x = 0; x < width; x++) {
                scratch[row + x] = sum / divisor;
                sum += source[row + clamp(x + radius + 1, 0, width - 1)] - source[row + clamp(x - radius, 0, width - 1)];
            }
        }
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let k = -radius; k <= radius; k++) sum += scratch[clamp(k, 0, height - 1) * width + x];
            for (let y = 0; y < height; y++) {
                target[y * width + x] = sum / divisor;
                sum += scratch[clamp(y + radius + 1, 0, height - 1) * width + x] - scratch[clamp(y - radius, 0, height - 1) * width + x];
            }
        }
        [source, target] = [target, source];
    }
    return source;
}

function sample(mask, width, height, x, y) {
    x = clamp(x, 0, width - 1); y = clamp(y, 0, height - 1);
    const left = Math.floor(x), top = Math.floor(y), right = Math.min(left + 1, width - 1), bottom = Math.min(top + 1, height - 1);
    const fx = x - left, fy = y - top;
    return (mask[top * width + left] * (1 - fx) + mask[top * width + right] * fx) * (1 - fy)
        + (mask[bottom * width + left] * (1 - fx) + mask[bottom * width + right] * fx) * fy;
}

export function directionalRim(alpha, width, height, rotation, thickness) {
    const radians = rotation * Math.PI / 180;
    // Inverse rotation keeps the light fixed above-left in scene space as objects rotate.
    const dx = (-.6 * Math.cos(radians) - .8 * Math.sin(radians)) * thickness;
    const dy = (.6 * Math.sin(radians) - .8 * Math.cos(radians)) * thickness;
    const edge = new Float32Array(alpha.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        edge[i] = Math.max(0, alpha[i] - sample(alpha, width, height, x + dx, y + dy));
    }
    return edge;
}

export function softRim(alpha, width, height, rotation, size) {
    const edge = directionalRim(alpha, width, height, rotation, Math.max(1, size * .022));
    const core = soften(edge, width, height, size * .004), glow = soften(edge, width, height, size * .014);
    return core.map((value, i) => clamp(value * .85 + glow[i] * .35, 0, 1));
}

function rimMask(image, bounds, rotation) {
    let entry = masks.get(image);
    const signature = bounds.join(',');
    if (!entry || entry.signature !== signature) {
        const scale = Math.min(1, 640 / Math.max(bounds[2], bounds[3]));
        const w = Math.max(1, Math.round(bounds[2] * scale)), h = Math.max(1, Math.round(bounds[3] * scale));
        const size = Math.min(w, h), padding = Math.max(8, Math.ceil(size * .07));
        const canvas = document.createElement('canvas'); canvas.width = w + padding * 2; canvas.height = h + padding * 2;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, ...bounds, padding, padding, w, h);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const alpha = Float32Array.from({ length: canvas.width * canvas.height }, (_, i) => pixels[i * 4 + 3] / 255);
        entry = { signature, w, h, padding, size, alpha, width: canvas.width, height: canvas.height, rotations: new Map() };
        masks.set(image, entry);
    }
    const angle = ((rotation % 360) + 360) % 360;
    if (!entry.rotations.has(angle)) {
        const light = softRim(entry.alpha, entry.width, entry.height, angle, entry.size);
        const canvas = document.createElement('canvas'); canvas.width = entry.width; canvas.height = entry.height;
        const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < light.length; i++) {
            pixels.data[i * 4] = 255; pixels.data[i * 4 + 1] = 183; pixels.data[i * 4 + 2] = 145;
            pixels.data[i * 4 + 3] = Math.round(light[i] * 255);
        }
        ctx.putImageData(pixels, 0, 0);
        if (entry.rotations.size >= 2) entry.rotations.delete(entry.rotations.keys().next().value);
        entry.rotations.set(angle, canvas);
    }
    return { ...entry, canvas: entry.rotations.get(angle) };
}

export function drawRimLights(ctx, scene, assets, geometry, items, paintItem) {
    if (!scene.rimLightEnabled) return;
    let layer = layers.get(ctx);
    if (!layer) { layer = document.createElement('canvas').getContext('2d'); layers.set(ctx, layer); }
    const width = ctx.canvas.width, height = ctx.canvas.height;
    if (layer.canvas.width !== width || layer.canvas.height !== height) { layer.canvas.width = width; layer.canvas.height = height; }
    layer.resetTransform(); layer.clearRect(0, 0, width, height); layer.setTransform(ctx.getTransform());
    for (const item of items) {
        if (item.visible === false) continue;
        const image = assets.get(item.asset);
        if (!image) continue;
        // Foreground silhouettes occlude lights beneath them, including Surface and translucent edges.
        layer.globalCompositeOperation = 'destination-out'; paintItem(layer, item, scene, image, geometry);
        layer.globalCompositeOperation = 'source-over';
        const rim = rimMask(image, geometry.metrics[item.asset].bounds, item.rotation);
        const size = geometry.dimensions(item, scene), sx = size.width / rim.w, sy = size.height / rim.h;
        layer.save(); layer.translate(item.x * scene.width, item.y * scene.height); layer.rotate(item.rotation * Math.PI / 180);
        layer.drawImage(rim.canvas, -size.width / 2 - rim.padding * sx, -size.height / 2 - rim.padding * sy, rim.width * sx, rim.height * sy);
        layer.restore();
    }
    ctx.save(); ctx.resetTransform(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= .5;
    ctx.drawImage(layer.canvas, 0, 0); ctx.restore();
}
