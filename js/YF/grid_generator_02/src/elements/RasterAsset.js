export const RASTER_MAX_EDGE = 1024;
export const RASTER_MAX_FILE_BYTES = 20 * 1024 * 1024;
export function previewSize(width, height) {
    if (!(width > 0 && height > 0) || width * height > 40000000) throw new Error('Choose an image smaller than 40 megapixels.');
    const scale = Math.min(1, RASTER_MAX_EDGE / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Decode locally, keep only a bounded preview; original files never enter the document. */
export async function loadRasterPreview(file) {
    if (!/^(image\/(png|jpeg|webp))$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('Choose PNG, JPEG or WebP.');
    if (file.size > RASTER_MAX_FILE_BYTES) throw new Error('Choose an image smaller than 20 MB.');
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('This image could not be decoded. Choose PNG, JPEG or WebP.'); }
    try {
        const size = previewSize(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        Object.assign(canvas, size);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, size.width, size.height);
        const dataUrl = canvas.toDataURL('image/webp', .82);
        if (dataUrl.length > 2000000) throw new Error('This preview is too large. Choose a smaller image.');
        return { dataUrl, ...size, fit: 'cover' };
    } finally { bitmap.close(); }
}

export const hasGraphicArtwork = block => Boolean(block.svgContent || block.raster || block.missingAsset);
