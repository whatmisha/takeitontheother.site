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
            getContrastColor: () => '#fff',
            rootPlane: () => ({
                rect: { x: values.thickness, y: values.thickness },
                localWidth: values.frontWidth,
                localHeight: values.frontHeight
            })
        },
        surfaceManager: { getRootId: () => 'front' },
        resolveBlockPlane: block => block.planeId || 'front',
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
    const clock = [10, 17];
    const builder = new ExportDocumentBuilder(host, { now: () => clock.shift() });

    const svg = await builder.build(false);

    assert.equal(svg.type, 'svg');
    assert.equal(svg.attributes.width, '600mm');
    assert.equal(svg.attributes.height, '500mm');
    assert.equal(svg.attributes.viewBox, '0 0 600 500');
    assert.deepEqual(svg.children.map(child => child.attributes.id), ['box', 'grid']);
    assert.deepEqual(host.calls, ['box', 'sides']);
    assert.deepEqual(builder.getPerformanceMetrics(), {
        count: 1,
        totalMs: 7,
        lastMs: 7,
        maxMs: 7,
        averageMs: 7,
        assets: { entries: 0, requests: 0, hits: 0 }
    });
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

test('export paints text and graphics in their shared layer order', async () => {
    const host = createHost();
    const graphic = { id: 'graphic', planeId: 'front', svgContent: '<path/>' };
    const text = { id: 'text', planeId: 'front' };
    host.objectDocument = {
        textBlocks: [text],
        graphicsBlocks: [graphic],
        getLayerEntries: () => [
            { type: 'graphics', block: graphic },
            { type: 'text', block: text }
        ]
    };

    await new ExportDocumentBuilder(host).build(false);

    assert.deepEqual(host.calls.slice(-2), ['graphics', 'text']);
});

test('export document builder caches parsed immutable SVG assets', async () => {
    let fetches = 0;
    const svg = {
        getAttribute: name => name === 'viewBox' ? '0 0 120 40' : null
    };
    const builder = new ExportDocumentBuilder(createHost(), {
        fetchImpl: async (_url, options) => {
            fetches += 1;
            assert.deepEqual(options, { cache: 'force-cache' });
            return { ok: true, text: async () => '<svg viewBox="0 0 120 40" />' };
        },
        parseSvg: () => ({ querySelector: () => svg })
    });

    assert.deepEqual(await builder.loadSvgAsset('logo.svg'), {
        element: svg,
        width: 120,
        height: 40
    });
    assert.equal((await builder.loadSvgAsset('logo.svg')).element, svg);
    assert.equal(fetches, 1);
    assert.deepEqual(builder.getPerformanceMetrics().assets, {
        entries: 1,
        requests: 1,
        hits: 1
    });
});
