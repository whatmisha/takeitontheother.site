(function registerDitherPngExport(scope) {
    const MIME_TYPE = 'image/png';
    const FILENAME = 'dithered-image.png';

    function resolveScale(settings = {}) {
        if (settings.export8x) return 8;
        if (settings.export4x) return 4;
        if (settings.export2x) return 2;
        return 1;
    }

    function resolveDimensions(width, height, settings = {}) {
        const scale = resolveScale(settings);
        return {
            width: Math.max(1, Math.round(Number(width) * scale)),
            height: Math.max(1, Math.round(Number(height) * scale)),
            scale
        };
    }

    function downloadCanvas(canvas, {
        documentRef = scope.document,
        URLRef = scope.URL,
        filename = FILENAME,
        timeout = scope.setTimeout
    } = {}) {
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) {
                    resolve(null);
                    return;
                }
                const url = URLRef.createObjectURL(blob);
                const link = documentRef.createElement('a');
                link.download = filename;
                link.href = url;
                documentRef.body.appendChild(link);
                link.click();
                documentRef.body.removeChild(link);
                timeout(() => URLRef.revokeObjectURL(url), 100);
                resolve({ blob, filename, mimeType: MIME_TYPE });
            }, MIME_TYPE);
        });
    }

    scope.DitherPngExport = Object.freeze({
        FILENAME,
        MIME_TYPE,
        downloadCanvas,
        resolveDimensions,
        resolveScale
    });
}(globalThis));
