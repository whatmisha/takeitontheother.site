import test from 'node:test';
import assert from 'node:assert/strict';

import { SurfaceRenderer } from '../src/surfaces/SurfaceRenderer.js';

test('side object rendering forwards one resolved context and never rewrites global settings', () => {
    const context = {
        gridModule: 5,
        margins: 2.5,
        columnCount: 12,
        rowCount: 1,
        rowHeight: 7,
        planeWidth: 500,
        planeHeight: 50
    };
    const calls = [];
    const renderer = new SurfaceRenderer({
        settings: {
            get: key => key === 'showObjects',
            set: () => assert.fail('side rendering must not mutate global settings')
        },
        surfaceManager: { getRootId: () => 'front', has: id => id === 'left' },
        getGridContext: surface => {
            assert.equal(surface, 'left');
            return context;
        },
        createSvgElement: () => {},
        getContrastColor: () => '#fff',
        getGridOpacity: value => value,
        getTextBlocks: () => [{ id: 'side-text', planeId: 'left' }],
        getGraphicsBlocks: () => [{
            id: 'side-graphic',
            planeId: 'left',
            svgContent: '<path/>'
        }],
        drawTextBlock: (...args) => calls.push(['text', ...args]),
        drawGraphicsBlock: (...args) => calls.push(['graphic', ...args]),
        drawGraphicsBlockForExport: () => assert.fail('editor render must not use export draw')
    });
    const container = {};

    renderer.drawObjects(container, 'left', { localWidth: 500, localHeight: 50 }, 2);

    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], 'text');
    assert.equal(calls[1][0], 'graphic');
    assert.equal(calls[0].at(-1), context);
    assert.equal(calls[1].at(-1), context);
    assert.deepEqual(calls[0].slice(3, 9), [0, 0, 500, 50, 2, context]);
});
