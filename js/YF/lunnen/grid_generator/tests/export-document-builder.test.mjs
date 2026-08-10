import test from 'node:test';
import assert from 'node:assert/strict';

import { ExportDocumentBuilder } from '../src/svg/ExportDocumentBuilder.js';

class SvgNode {
    constructor(type, attributes = {}) {
        this.type = type;
        this.attributes = { ...attributes };
        this.children = [];
        this.textContent = '';
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }
}

function createHost() {
    const values = {
        frontWidth: 500,
        frontHeight: 400,
        thickness: 50,
        gridModule: 5,
        headlineSize: 1.5,
        lineHeight: 2,
        textSize: 0.5,
        textLineHeight: 1,
        captionSize: 0.5,
        captionLineHeight: 1,
        lunnenDisplaySize: 3,
        lunnenDisplayLineHeight: 4,
        showColumns: false,
        showRows: false,
        showBaseline: false,
        showLabels: false
    };
    const calls = [];
    const host = {
        calls,
        settingsModule: {
            get: key => values[key],
            getAll: () => ({ ...values })
        },
        canvasRenderer: {
            createSvgElement(type, attributes, container) {
                const node = new SvgNode(type, attributes);
                container?.appendChild(node);
                return node;
            },
            drawBoxSurfaces: () => calls.push('box'),
            getContrastColor: () => '#fff'
        },
        surfaceRenderer: { drawSideLayers: () => calls.push('sides') },
        gridRenderer: {},
        objectDocument: { textBlocks: [], graphicsBlocks: [] },
        textRenderer: { draw: () => calls.push('text') },
        graphicsRenderer: { drawForExport: () => calls.push('graphics') },
        textStyleResolver: {
            calculateFontSize: (_style, size) => size * 10
        }
    };
    return host;
}

test('export document builder creates exact millimeter artboard without references', async () => {
    const host = createHost();
    const builder = new ExportDocumentBuilder(host);

    const svg = await builder.build(false);

    assert.equal(svg.type, 'svg');
    assert.equal(svg.attributes.width, '600mm');
    assert.equal(svg.attributes.height, '500mm');
    assert.equal(svg.attributes.viewBox, '0 0 600 500');
    assert.deepEqual(svg.children.map(child => child.attributes.id), ['box', 'grid']);
    assert.deepEqual(host.calls, ['box', 'sides']);
});

test('export text-style reference reuses the shared typography resolver', () => {
    const builder = new ExportDocumentBuilder(createHost());

    assert.deepEqual(builder.getTextStylesInfo(), [
        { name: 'Headline', fontSize: '42.5', lineHeight: '28.3' },
        { name: 'Text', fontSize: '14.2', lineHeight: '14.2' },
        { name: 'Caption', fontSize: '14.2', lineHeight: '14.2' },
        { name: 'Lunnen Display', fontSize: '85.0', lineHeight: '56.7' }
    ]);
});
