import { Settings, SVGExporter, svgDocumentString } from '../../src/index.js';

const expectedResources = [
    '../../css/framework.css',
    '../../fonts/CoFoSans-Regular.woff2',
    '../../fonts/CoFoSans-Medium.woff2',
    '../../vendor/jspdf/2.5.1/jspdf.umd.min.js',
    '../../vendor/svg2pdf/2.2.3/svg2pdf.umd.min.js',
    '../../vendor/opentype/1.3.4/opentype.module.js',
    '../../src/index.js'
];

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function startsWithBytes(bytes, expected) {
    return expected.every((byte, index) => bytes[index] === byte);
}

async function verifyLocalResources() {
    for (const relativePath of expectedResources) {
        const url = new URL(relativePath, import.meta.url);
        invariant(url.origin === location.origin, `${relativePath} is not same-origin`);
        const response = await fetch(url, { cache: 'no-store' });
        invariant(response.ok, `${relativePath} returned HTTP ${response.status}`);
        invariant((await response.arrayBuffer()).byteLength > 0, `${relativePath} is empty`);
    }

    await document.fonts.load('400 16px "CoFo Sans"');
    await document.fonts.load('500 16px "CoFo Sans"');
    invariant(document.fonts.check('400 16px "CoFo Sans"'), 'Regular framework font did not load');
    invariant(document.fonts.check('500 16px "CoFo Sans"'), 'Medium framework font did not load');
}

function verifySvgArtifact() {
    const svg = document.querySelector('#smokeSvg');
    const serialized = svgDocumentString(new XMLSerializer().serializeToString(svg));
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    invariant(blob.type.startsWith('image/svg+xml'), 'SVG MIME type is invalid');
    invariant(serialized.startsWith('<?xml'), 'SVG XML declaration is missing');
    invariant(serialized.includes('<svg'), 'SVG root is missing');
    invariant(blob.size > 100, 'SVG artifact is unexpectedly small');
    return blob.size;
}

async function verifyPngArtifact() {
    const canvas = document.querySelector('#smokeCanvas');
    const context = canvas.getContext('2d');
    context.fillStyle = '#ff5c35';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111';
    context.beginPath();
    context.arc(32, 24, 12, 0, Math.PI * 2);
    context.fill();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    invariant(blob?.type === 'image/png', 'PNG MIME type is invalid');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    invariant(startsWithBytes(bytes, [137, 80, 78, 71, 13, 10, 26, 10]), 'PNG signature is invalid');
    return blob.size;
}

async function verifyPdfArtifact(exporter) {
    await exporter.loadPDFLibraries();
    invariant(typeof window.jspdf?.jsPDF === 'function', 'jsPDF API is unavailable');
    const renderSvg = window.svg2pdf?.svg2pdf || window.svg2pdf;
    invariant(typeof renderSvg === 'function', 'svg2pdf API is unavailable');

    const pdf = new window.jspdf.jsPDF({ unit: 'px', format: [64, 48], putOnlyUsedFonts: true });
    await renderSvg(document.querySelector('#smokeSvg'), pdf, { xOffset: 0, yOffset: 0, width: 64, height: 48 });
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    invariant(startsWithBytes(bytes, [37, 80, 68, 70, 45]), 'PDF signature is invalid');
    invariant(bytes.byteLength > 500, 'PDF artifact is unexpectedly small');
    return bytes.byteLength;
}

function verifyJsonArtifact() {
    const source = new Settings({ width: 64, height: 48, palette: ['#ff5c35', '#111111'] });
    const serialized = source.toJSON();
    const parsed = JSON.parse(serialized);
    const restored = new Settings({ width: 1, height: 1, palette: [] });
    restored.fromJSON(serialized, true);
    invariant(parsed.width === 64 && parsed.palette.length === 2, 'JSON artifact content is invalid');
    invariant(JSON.stringify(restored.toObject()) === JSON.stringify(parsed), 'JSON round-trip changed settings');
    return new Blob([serialized], { type: 'application/json' }).size;
}

async function runBrowserSmoke() {
    const exporter = new SVGExporter();
    try {
        await verifyLocalResources();
        const artifacts = {
            svgBytes: verifySvgArtifact(),
            pngBytes: await verifyPngArtifact(),
            pdfBytes: await verifyPdfArtifact(exporter),
            jsonBytes: verifyJsonArtifact()
        };
        const remoteRequests = performance.getEntriesByType('resource')
            .map(entry => entry.name)
            .filter(name => new URL(name, location.href).origin !== location.origin);
        invariant(remoteRequests.length === 0, `Unexpected remote requests: ${remoteRequests.join(', ')}`);
        return { status: 'passed', resources: expectedResources.length, remoteRequests, artifacts };
    } finally {
        exporter.destroy();
    }
}

const status = document.querySelector('[data-smoke-status]');
const output = document.querySelector('#smokeResult');

window.__uiGarageSmoke = runBrowserSmoke()
    .then(result => {
        status.dataset.smokeStatus = 'passed';
        status.textContent = 'Browser smoke passed';
        output.textContent = JSON.stringify(result, null, 2);
        return result;
    })
    .catch(error => {
        const result = { status: 'failed', error: error?.stack || String(error) };
        status.dataset.smokeStatus = 'failed';
        status.textContent = 'Browser smoke failed';
        output.textContent = JSON.stringify(result, null, 2);
        console.error(error);
        return result;
    });
