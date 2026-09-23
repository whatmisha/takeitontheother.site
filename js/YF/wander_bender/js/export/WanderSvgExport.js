export function createWanderSvgArtifact(svgElement, {
    rays,
    Serializer = globalThis.XMLSerializer,
    BlobClass = globalThis.Blob
} = {}) {
    if (!svgElement) throw new Error('Wander SVG is required');
    const clone = svgElement.cloneNode(true);
    clone.querySelector('.area-boundary')?.remove();
    const content = new Serializer().serializeToString(clone);
    return {
        blob: new BlobClass([content], { type: 'image/svg+xml' }),
        content,
        filename: `wander-bender-${rays}-rays.svg`,
        mimeType: 'image/svg+xml'
    };
}

export function downloadWanderSvg(svgElement, {
    rays,
    documentRef = globalThis.document,
    URLRef = globalThis.URL,
    Serializer = globalThis.XMLSerializer,
    BlobClass = globalThis.Blob
} = {}) {
    const artifact = createWanderSvgArtifact(svgElement, { rays, Serializer, BlobClass });
    const url = URLRef.createObjectURL(artifact.blob);
    const link = documentRef.createElement('a');
    link.href = url;
    link.download = artifact.filename;
    link.click();
    URLRef.revokeObjectURL(url);
    return artifact;
}
