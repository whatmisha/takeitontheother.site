const PNG_MIME_TYPE = 'image/png';

function readViewBox(svg) {
    const match = String(svg || '').match(/\bviewBox\s*=\s*(["'])\s*([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s*\1/iu);
    if (!match) throw new Error('Pulsar SVG has no valid viewBox');
    const width = Number(match[4]);
    const height = Number(match[5]);
    if (!(width > 0) || !(height > 0)) throw new Error('Pulsar SVG has an invalid viewBox');
    return { width, height };
}

export async function rasterizePulsarSvg(svg, {
    maxDimension = 2400,
    documentRef = globalThis.document,
    URLRef = globalThis.URL,
    BlobClass = globalThis.Blob,
    ImageClass = globalThis.Image
} = {}) {
    if (!documentRef || !URLRef || typeof ImageClass !== 'function') {
        throw new Error('PNG export is not available in this browser');
    }
    const content = String(svg || '');
    const viewBox = readViewBox(content);
    const limit = Math.max(256, Math.round(Number(maxDimension) || 2400));
    const scale = limit / Math.max(viewBox.width, viewBox.height);
    const width = Math.max(1, Math.round(viewBox.width * scale));
    const height = Math.max(1, Math.round(viewBox.height * scale));
    const sourceBlob = new BlobClass([content], { type: 'image/svg+xml' });
    const sourceUrl = URLRef.createObjectURL(sourceBlob);

    try {
        const image = new ImageClass();
        image.decoding = 'async';
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('Could not rasterize the Pulsar SVG'));
            image.src = sourceUrl;
        });
        const canvas = documentRef.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is not available for PNG export');
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, PNG_MIME_TYPE));
        if (!blob) throw new Error('PNG encoder returned no image');
        return { blob, width, height };
    } finally {
        URLRef.revokeObjectURL(sourceUrl);
    }
}

export async function createPulsarPngArtifact(svg, {
    timestamp = Date.now(),
    rasterize = rasterizePulsarSvg,
    ...rasterOptions
} = {}) {
    const content = String(svg || '');
    if (!/<svg\b/iu.test(content)) throw new Error('Pulsar SVG is required');
    const rendered = await rasterize(content, rasterOptions);
    if (!rendered?.blob) throw new Error('PNG rasterizer returned no image');
    return {
        ...rendered,
        filename: `pulsar-code-${timestamp}.png`,
        mimeType: PNG_MIME_TYPE
    };
}

export async function downloadPulsarPng(svg, {
    timestamp = Date.now(),
    documentRef = globalThis.document,
    URLRef = globalThis.URL,
    ...options
} = {}) {
    const artifact = await createPulsarPngArtifact(svg, {
        timestamp,
        documentRef,
        URLRef,
        ...options
    });
    const url = URLRef.createObjectURL(artifact.blob);
    try {
        const link = documentRef.createElement('a');
        link.href = url;
        link.download = artifact.filename;
        link.click();
    } finally {
        URLRef.revokeObjectURL(url);
    }
    return artifact;
}
