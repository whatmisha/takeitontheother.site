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
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                try {
                    if (!blob) {
                        resolve(null);
                        return;
                    }
                    const url = URLRef.createObjectURL(blob);
                    try {
                        const link = documentRef.createElement('a');
                        link.download = filename;
                        link.href = url;
                        documentRef.body.appendChild(link);
                        try { link.click(); }
                        finally { documentRef.body.removeChild(link); }
                    } finally {
                        timeout(() => URLRef.revokeObjectURL(url), 100);
                    }
                    resolve({ blob, filename, mimeType: MIME_TYPE });
                } catch (error) {
                    // Exceptions inside an asynchronous encoder callback must reject
                    // the export promise instead of leaving the UI busy forever.
                    reject(error);
                }
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
