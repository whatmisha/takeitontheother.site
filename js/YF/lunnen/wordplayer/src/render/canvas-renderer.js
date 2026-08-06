const FONT_CACHE_LIMIT = 2048;
const fontCache = new Map();

function fontFor(glyph) {
    const key = `${glyph.weight}|${glyph.size.toFixed(3)}`;
    if (fontCache.has(key)) {
        const cached = fontCache.get(key);
        fontCache.delete(key);
        fontCache.set(key, cached);
        return cached;
    }
    if (fontCache.size >= FONT_CACHE_LIMIT) {
        fontCache.delete(fontCache.keys().next().value);
    }
    const font = `${glyph.weight} ${Math.max(1, glyph.size)}px "YSTextPattern"`;
    fontCache.set(key, font);
    return font;
}

export function drawScene(context, scene, { transparent = false } = {}) {
    if (!context || !scene) return;
    context.save();
    if (!transparent) {
        context.fillStyle = scene.bgColor;
        context.fillRect(0, 0, scene.width, scene.height);
    }
    context.textAlign = 'center';
    context.textRendering = 'geometricPrecision';
    for (const glyph of scene.glyphs) {
        context.save();
        context.translate(glyph.x, glyph.y);
        if (glyph.rotation) context.rotate(glyph.rotation * Math.PI / 180);
        context.font = fontFor(glyph);
        context.textBaseline = glyph.baseline === 'alphabetic' ? 'alphabetic' : 'middle';
        context.fillStyle = glyph.fill;
        context.fillText(glyph.char, 0, 0);
        context.restore();
    }
    context.restore();
}

export function renderSceneToCanvas(scene, { scale = 1, transparent = false } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(scene.width * scale));
    canvas.height = Math.max(1, Math.round(scene.height * scale));
    const context = canvas.getContext('2d');
    context.setTransform(scale, 0, 0, scale, 0, 0);
    drawScene(context, scene, { transparent });
    return canvas;
}
