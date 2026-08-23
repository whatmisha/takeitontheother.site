import test from 'node:test';
import assert from 'node:assert/strict';

import { GraphicsAssetController } from '../src/elements/GraphicsAssetController.js';

test('SVG paint normalization preserves none and maps visible paint to currentColor', () => {
    const source = [
        '<path fill="#000" stroke="white"/>',
        '<path fill="none" stroke="none"/>',
        '<path style="fill: red; stroke: #123456"/>',
        '<style>.st0 { fill: blue; stroke: none; }</style>'
    ].join('');

    const result = GraphicsAssetController.normalizePaint(source);

    assert.match(result, /fill="currentColor" stroke="currentColor"/);
    assert.match(result, /fill="none" stroke="none"/);
    assert.match(result, /style="fill: currentColor; stroke: currentColor"/);
    assert.match(result, /\.st0 \{ fill: currentColor; stroke: none; \}/);
});

test('SVG color class rule is inserted once and prefers existing defs', () => {
    const source = '<defs><clipPath id="clip"/></defs><path class="claim-fill"/>';
    const first = GraphicsAssetController.ensureCurrentColorClass(source, 'claim-fill');
    const second = GraphicsAssetController.ensureCurrentColorClass(first, 'claim-fill');

    assert.match(first, /^<defs><style>\.claim-fill \{ fill: currentColor; \}<\/style>/);
    assert.equal(second, first);
    assert.equal((second.match(/\.claim-fill/g) || []).length, 1);
});
