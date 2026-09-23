const pendingScripts = new Map();

function resolveRuntimeUrl(filename) {
    return new URL(`../../vendor/${filename}`, import.meta.url).href;
}

function loadScript(filename, documentRef = globalThis.document) {
    if (!documentRef?.head) {
        return Promise.reject(new Error(`Document is unavailable while loading ${filename}`));
    }

    const url = resolveRuntimeUrl(filename);
    if (pendingScripts.has(url)) return pendingScripts.get(url);

    const existing = documentRef.querySelector(`script[data-runtime-src="${url}"]`);
    if (existing?.dataset.runtimeReady === 'true') return Promise.resolve();

    const load = new Promise((resolve, reject) => {
        const script = existing || documentRef.createElement('script');
        const handleLoad = () => {
            script.dataset.runtimeReady = 'true';
            resolve();
        };
        const handleError = () => {
            script.remove();
            pendingScripts.delete(url);
            reject(new Error(`Failed to load local runtime dependency: ${filename}`));
        };

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });
        if (!existing) {
            script.async = true;
            script.src = url;
            script.dataset.runtimeSrc = url;
            documentRef.head.append(script);
        }
    });
    pendingScripts.set(url, load);
    return load;
}

export async function loadOpentypeRuntime({
    globalRef = globalThis,
    documentRef = globalThis.document
} = {}) {
    if (!globalRef.opentype) await loadScript('opentype.min.js', documentRef);
    if (!globalRef.opentype) throw new Error('opentype.js did not expose its browser API');
    return globalRef.opentype;
}

export async function loadPdfRuntime({
    globalRef = globalThis,
    documentRef = globalThis.document
} = {}) {
    if (!globalRef.jspdf?.jsPDF) await loadScript('jspdf.umd.min.js', documentRef);
    if (!globalRef.svg2pdf) await loadScript('svg2pdf.umd.min.js', documentRef);

    const jsPDF = globalRef.jspdf?.jsPDF;
    const svg2pdf = globalRef.svg2pdf?.svg2pdf || globalRef.svg2pdf;
    if (!jsPDF || !svg2pdf) throw new Error('PDF runtime did not expose its browser API');
    return { jsPDF, svg2pdf };
}
