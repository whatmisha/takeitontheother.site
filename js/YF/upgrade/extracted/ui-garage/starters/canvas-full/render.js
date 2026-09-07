import { SeededRandom } from '../../src/index.js';

export function buildMarks(settings) {
    const random = new SeededRandom(settings.seed || 1);
    const marks = [];
    for (let index = 0; index < settings.density; index += 1) {
        const radius = settings.radius * random.float(0.35, 1.15);
        const grid = Math.max(radius * 0.5, 1);
        const rawX = random.float(0, settings.width);
        const rawY = random.float(0, settings.height);
        const snap = 1 - settings.jitter;
        marks.push({
            x: rawX * settings.jitter + Math.round(rawX / grid) * grid * snap,
            y: rawY * settings.jitter + Math.round(rawY / grid) * grid * snap,
            radius,
            rotation: random.float(-Math.PI, Math.PI)
        });
    }
    return marks;
}

function drawCover(ctx, image, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function drawRaster({ ctx2d, width, height, settings }, assetImage = null) {
    ctx2d.save();
    ctx2d.fillStyle = settings.background;
    ctx2d.fillRect(0, 0, width, height);

    if (assetImage?.complete && assetImage.naturalWidth > 0) {
        ctx2d.save();
        ctx2d.globalAlpha = settings.assetOpacity;
        drawCover(ctx2d, assetImage, width, height);
        ctx2d.restore();
    }

    ctx2d.fillStyle = settings.color;
    ctx2d.globalAlpha = settings.opacity;
    ctx2d.globalCompositeOperation = settings.invert ? 'difference' : 'source-over';
    for (const mark of buildMarks(settings)) {
        if (settings.square) {
            ctx2d.save();
            ctx2d.translate(mark.x, mark.y);
            ctx2d.rotate(mark.rotation);
            ctx2d.fillRect(-mark.radius, -mark.radius, mark.radius * 2, mark.radius * 2);
            ctx2d.restore();
        } else {
            ctx2d.beginPath();
            ctx2d.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2);
            ctx2d.fill();
        }
    }
    ctx2d.restore();
}

function escapeAttribute(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

export function renderVectorHook({ width, height, settings }, assetDataUrl = '') {
    const image = assetDataUrl
        ? `<image href="${escapeAttribute(assetDataUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="${settings.assetOpacity}"/>`
        : '';
    const blend = settings.invert ? ' style="mix-blend-mode:difference"' : '';
    const marks = buildMarks(settings).map(mark => settings.square
        ? `<rect x="${-mark.radius}" y="${-mark.radius}" width="${mark.radius * 2}" height="${mark.radius * 2}" transform="translate(${mark.x} ${mark.y}) rotate(${mark.rotation * 180 / Math.PI})"/>`
        : `<circle cx="${mark.x}" cy="${mark.y}" r="${mark.radius}"/>`
    ).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${settings.background}"/>${image}<g fill="${settings.color}" opacity="${settings.opacity}"${blend}>${marks}</g></svg>`;
}
