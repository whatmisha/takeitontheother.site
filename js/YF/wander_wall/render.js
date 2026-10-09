export function drawArtwork(ctx, scene, assets, geometry, items = scene.items) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, scene.width, scene.height); ctx.clip();
    const gradient = ctx.createLinearGradient(0, scene.height, 0, 0);
    [[0, '#D0D2E4'], [.302885, '#9AA0DC'], [.649038, '#2348B4'], [1, '#0E257F']].forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, scene.width, scene.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const item of items) {
        const image = assets.get(item.asset);
        if (!image) continue;
        const [x, y, width, height] = geometry.metrics[item.asset].bounds;
        const size = geometry.dimensions(item, scene);
        ctx.save(); ctx.translate(item.x * scene.width, item.y * scene.height); ctx.rotate(item.rotation * Math.PI / 180);
        ctx.drawImage(image, x, y, width, height, -size.width / 2, -size.height / 2, size.width, size.height);
        ctx.restore();
    }
    ctx.restore();
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
