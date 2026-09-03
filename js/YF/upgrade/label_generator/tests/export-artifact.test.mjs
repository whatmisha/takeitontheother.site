import assert from 'node:assert/strict';
import test from 'node:test';

import { PDFExporter } from '../src/svg/PDFExporter.js';
import { SVGExporter } from '../src/svg/SVGExporter.js';

function fakeSvg({ width = '120', height = '60' } = {}) {
    const removed = [];
    const stripped = [];
    const interactive = { remove: () => removed.push('interactive') };
    const content = { removeAttribute: name => stripped.push(name) };
    const clone = {
        viewBox: { baseVal: { width: Number(width), height: Number(height) } },
        getAttribute: name => name === 'width' ? width : name === 'height' ? height : null,
        querySelectorAll(selector) {
            if (selector === '.resize-handle') return [interactive];
            if (selector === '*') return [content];
            return [];
        }
    };
    return {
        removed,
        stripped,
        source: { cloneNode: deep => (assert.equal(deep, true), clone) },
        clone
    };
}

test('Sticky vector PDF export keeps page geometry, cleanup and filename', async () => {
    const originalWindow = globalThis.window;
    const instances = [];
    class FakePDF {
        constructor(options) {
            this.options = options;
            this.svgCalls = [];
            this.saved = [];
            instances.push(this);
        }
        async svg(element, options) {
            this.svgCalls.push({ element, options });
        }
        save(filename) {
            this.saved.push(filename);
        }
    }
    globalThis.window = { jsPDF: FakePDF };

    try {
        const svg = fakeSvg();
        const outlineCalls = [];
        const exporter = new PDFExporter({}, {
            convertAllTextToPaths: async element => outlineCalls.push(element)
        });
        await exporter.exportToFile(svg.source, 'Sample_device_label_120×60mm.pdf', {
            removeInteractive: true,
            convertTextToOutlines: true,
            format: [120, 60]
        });

        assert.equal(instances.length, 2, 'feature probe + exported PDF');
        const pdf = instances[1];
        assert.deepEqual(pdf.options, {
            orientation: 'landscape',
            unit: 'mm',
            format: [120, 60]
        });
        assert.deepEqual(pdf.svgCalls[0].options, { x: 0, y: 0, width: 120, height: 60 });
        assert.deepEqual(pdf.saved, ['Sample_device_label_120×60mm.pdf']);
        assert.equal(svg.removed.length, 1);
        assert.deepEqual(svg.stripped, ['onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup']);
        assert.deepEqual(outlineCalls, [svg.clone]);
    } finally {
        globalThis.window = originalWindow;
    }
});

test('Sticky SVG export emits a vector MIME artifact after removing UI state', async () => {
    const originals = {
        document: globalThis.document,
        XMLSerializer: globalThis.XMLSerializer,
        URL: globalThis.URL,
        setTimeout: globalThis.setTimeout
    };
    const downloads = [];
    const svg = fakeSvg({ width: '90', height: '45' });

    globalThis.XMLSerializer = class {
        serializeToString(element) {
            assert.equal(element, svg.clone);
            return '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="45" viewBox="0 0 90 45"><path d="M0 0L90 45"/></svg>';
        }
    };
    globalThis.URL = {
        createObjectURL(blob) {
            downloads.push({ blob, filename: '', revoked: false });
            return 'blob:sticky-0';
        },
        revokeObjectURL() { downloads[0].revoked = true; }
    };
    globalThis.setTimeout = callback => (callback(), 0);
    globalThis.document = {
        body: {
            appendChild() {},
            removeChild() {}
        },
        createElement(tagName) {
            assert.equal(tagName, 'a');
            return {
                href: '', download: '',
                click() { downloads[0].filename = this.download; }
            };
        }
    };

    try {
        const exporter = new SVGExporter({}, null);
        await exporter.exportToFile(svg.source, 'Sample_device_label_90×45mm.svg', {
            removeInteractive: true,
            optimizeSize: true,
            convertTextToOutlines: false
        });
        assert.equal(downloads.length, 1);
        assert.equal(downloads[0].filename, 'Sample_device_label_90×45mm.svg');
        assert.equal(downloads[0].blob.type, 'image/svg+xml;charset=utf-8');
        assert.match(await downloads[0].blob.text(), /^<svg[^>]+viewBox="0 0 90 45"/u);
        assert.equal(svg.removed.length, 1);
        assert.equal(downloads[0].revoked, true);
    } finally {
        globalThis.document = originals.document;
        globalThis.XMLSerializer = originals.XMLSerializer;
        globalThis.URL = originals.URL;
        globalThis.setTimeout = originals.setTimeout;
    }
});
