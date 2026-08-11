import assert from 'node:assert/strict';
import test from 'node:test';

import { PDFExporter } from '../src/svg/PDFExporter.js';

class FakeSvg {
    constructor(width = '600mm', height = '500mm') {
        this.attributes = { width, height };
        this.viewBox = { baseVal: { width: 600, height: 500 } };
    }

    cloneNode() {
        return new FakeSvg(this.attributes.width, this.attributes.height);
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }
}

test('PDF export preserves the millimeter artboard and outlines text', async () => {
    const calls = [];
    class FakePdf {
        constructor(options) {
            calls.push(['create', options]);
            this.internal = {
                pageSize: {
                    setWidth: value => calls.push(['width', value]),
                    setHeight: value => calls.push(['height', value])
                }
            };
        }
        save(filename) { calls.push(['save', filename]); }
    }
    const windowRef = {
        jspdf: { jsPDF: FakePdf },
        svg2pdf: async (_svg, _pdf, options) => calls.push(['convert', options])
    };
    const exporter = new PDFExporter({
        textToPath: { convertAllTextToPaths: async () => calls.push(['outline']) },
        cleanSvg: () => calls.push(['clean']),
        documentRef: {},
        windowRef
    });

    await exporter.export(new FakeSvg(), 'packaging.pdf', {
        removeInteractive: true,
        unit: 'mm'
    });

    assert.deepEqual(calls, [
        ['clean'],
        ['outline'],
        ['create', { orientation: 'landscape', unit: 'mm', format: undefined }],
        ['width', 600],
        ['height', 500],
        ['convert', { xOffset: 0, yOffset: 0, width: 600, height: 500 }],
        ['save', 'packaging.pdf']
    ]);
});

test('PDF export fails explicitly when mandatory font outlining is unavailable', async () => {
    const exporter = new PDFExporter({
        textToPath: null,
        cleanSvg: () => {},
        documentRef: {},
        windowRef: { jspdf: {} }
    });

    await assert.rejects(
        () => exporter.export(new FakeSvg(), 'packaging.pdf'),
        /TextToPath/
    );
});

test('PDF dependency loading restores only the missing library', async () => {
    class FakePdf {}
    const loadedScripts = [];
    const windowRef = { jspdf: { jsPDF: FakePdf } };
    const exporter = new PDFExporter({
        textToPath: {},
        cleanSvg: () => {},
        documentRef: {},
        windowRef
    });
    exporter.loadScript = async src => {
        loadedScripts.push(src);
        windowRef.svg2pdf = () => {};
    };

    await exporter.loadLibraries();

    assert.equal(loadedScripts.length, 1);
    assert.match(loadedScripts[0], /svg2pdf/);
    assert.equal(exporter.libsLoaded, true);
});
