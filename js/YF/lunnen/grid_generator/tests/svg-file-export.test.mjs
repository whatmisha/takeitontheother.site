import assert from 'node:assert/strict';
import test from 'node:test';

import { SVGExporter } from '../src/svg/SVGExporter.js';

test('SVG file export serializes outlined, interaction-free Illustrator markup', async () => {
    const calls = [];
    const clone = {
        querySelectorAll(selector) {
            calls.push(['query', selector]);
            return [];
        }
    };
    const source = { cloneNode: deep => {
        calls.push(['clone', deep]);
        return clone;
    } };
    const previousSerializer = globalThis.XMLSerializer;
    globalThis.XMLSerializer = class {
        serializeToString(node) {
            assert.equal(node, clone);
            return '<svg xmlns="http://www.w3.org/2000/svg" width="600mm" height="500mm" viewBox="0 0 600 500"><text>\u041dоутбук</text><path d="M0 0"/></svg>';
        }
    };
    try {
        const exporter = new SVGExporter({}, {
            convertAllTextToPaths: async node => calls.push(['outline', node])
        }, {
            fileTransfer: {
                download: (...args) => calls.push(['download', ...args])
            },
            presetCodec: {
                adapter: {},
                organize: value => value,
                generateName: () => '',
                stringify: JSON.stringify,
                normalize: value => value
            },
            pdfExporter: {}
        });

        await exporter.exportToFile(source, 'packaging.svg', {
            removeInteractive: true,
            convertTextToOutlines: true
        });

        assert.deepEqual(calls[0], ['clone', true]);
        assert.ok(calls.some(call => call[0] === 'outline' && call[1] === clone));
        const download = calls.find(call => call[0] === 'download');
        assert.equal(download[2], 'packaging.svg');
        assert.equal(download[3], 'image/svg+xml;charset=utf-8');
        assert.ok(download[1].startsWith('\uFEFF<?xml version="1.0" encoding="UTF-8"?>\n'));
        assert.match(download[1], />Ноутбук<\/text>/);
        assert.match(download[1], /width="600mm" height="500mm" viewBox="0 0 600 500"/);
    } finally {
        globalThis.XMLSerializer = previousSerializer;
    }
});
