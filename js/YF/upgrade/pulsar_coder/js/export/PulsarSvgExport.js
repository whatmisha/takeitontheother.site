export function createPulsarSvgArtifact(svg, {
    timestamp = Date.now(),
    BlobClass = globalThis.Blob
} = {}) {
    const content = String(svg || '');
    if (!/<svg\b/iu.test(content)) throw new Error('Pulsar SVG is required');
    return {
        blob: new BlobClass([content], { type: 'image/svg+xml' }),
        content,
        filename: `pulsar-code-${timestamp}.svg`,
        mimeType: 'image/svg+xml'
    };
}

export function downloadPulsarSvg(svg, {
    timestamp = Date.now(),
    documentRef = globalThis.document,
    URLRef = globalThis.URL,
    BlobClass = globalThis.Blob
} = {}) {
    const artifact = createPulsarSvgArtifact(svg, { timestamp, BlobClass });
    const url = URLRef.createObjectURL(artifact.blob);
    const link = documentRef.createElement('a');
    link.href = url;
    link.download = artifact.filename;
    link.click();
    URLRef.revokeObjectURL(url);
    return artifact;
}
