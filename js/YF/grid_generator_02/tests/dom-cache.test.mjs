import assert from 'node:assert/strict';
import test from 'node:test';

import { DOMCache } from '../src/core/DOMCache.js';

test('DOM cache indexes markup ids and keeps only intentional aliases', () => {
    const presetText = { id: '' };
    const elements = [
        { id: 'gridSvg' },
        { id: 'surfaceVisibleToggle' },
        { id: 'presetDropdownToggle', querySelector: selector => selector === '.preset-dropdown-text' ? presetText : null }
    ];
    const cache = new DOMCache({ querySelectorAll: selector => selector === '[id]' ? elements : [] }).init();

    assert.equal(cache.get('surfaceVisibleToggle'), elements[1]);
    assert.equal(cache.get('svg'), elements[0]);
    assert.equal(cache.get('presetDropdownText'), presetText);
    assert.equal(cache.has('missing'), false);
});
