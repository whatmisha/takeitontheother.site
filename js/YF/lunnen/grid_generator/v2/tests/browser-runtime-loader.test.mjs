import assert from 'node:assert/strict';
import test from 'node:test';

import {
    loadOpentypeRuntime,
    loadPdfRuntime
} from '../src/runtime/BrowserRuntimeLoader.js';

class FakeScript {
    constructor() {
        this.dataset = {};
        this.listeners = new Map();
        this.src = '';
        this.async = false;
        this.removed = false;
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    dispatch(type) { this.listeners.get(type)?.(); }
    remove() { this.removed = true; }
}

test('browser runtimes load lazily from checked-in same-origin files and are cached', async () => {
    const globalRef = {};
    const scripts = [];
    const documentRef = {
        querySelector: () => null,
        createElement: () => new FakeScript(),
        head: {
            append(script) {
                scripts.push(script);
                queueMicrotask(() => {
                    if (script.src.endsWith('/opentype.min.js')) globalRef.opentype = { load() {} };
                    if (script.src.endsWith('/jspdf.umd.min.js')) globalRef.jspdf = { jsPDF: class {} };
                    if (script.src.endsWith('/svg2pdf.umd.min.js')) globalRef.svg2pdf = { svg2pdf() {} };
                    script.dispatch('load');
                });
            }
        }
    };

    const opentype = await loadOpentypeRuntime({ globalRef, documentRef });
    const pdf = await loadPdfRuntime({ globalRef, documentRef });
    await loadOpentypeRuntime({ globalRef, documentRef });
    await loadPdfRuntime({ globalRef, documentRef });

    assert.equal(opentype, globalRef.opentype);
    assert.equal(pdf.jsPDF, globalRef.jspdf.jsPDF);
    assert.equal(pdf.svg2pdf, globalRef.svg2pdf.svg2pdf);
    assert.deepEqual(scripts.map(script => script.src.split('/').at(-1)), [
        'opentype.min.js', 'jspdf.umd.min.js', 'svg2pdf.umd.min.js'
    ]);
    assert.ok(scripts.every(script => script.async && script.dataset.runtimeSrc === script.src));
});
