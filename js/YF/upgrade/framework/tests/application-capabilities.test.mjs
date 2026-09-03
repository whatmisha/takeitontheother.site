import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveApplicationCapabilities } from '../src/core/ApplicationCapabilities.js';

test('ApplicationShell capabilities are derived from explicit config and live semantic hosts', () => {
    const selectors = new Set(['[data-tooltip]', '#dialog', 'input[type="checkbox"][data-setting]']);
    const documentRef = { querySelector: selector => selectors.has(selector) ? {} : null };
    const capabilities = resolveApplicationCapabilities({
        dom: { zoomIndicator: 'zoomIndicator' },
        controls: { sliders: [{ id: 'size' }] },
        panels: [{ id: 'panel' }],
        presets: { storageKey: 'upgrade:test:v1' },
        share: {},
        export: { filename: 'test.svg' },
        mobile: {}
    }, documentRef);

    assert.deepEqual(capabilities, {
        sliders: true,
        ranges: false,
        toggles: true,
        panels: true,
        colors: false,
        dice: false,
        tooltips: true,
        dialog: true,
        export: true,
        history: true,
        presets: true,
        share: true,
        shortcuts: true,
        mobile: true,
        zoom: true
    });
});

test('an empty tool config does not construct optional controllers', () => {
    const capabilities = resolveApplicationCapabilities({}, { querySelector: () => null });
    assert.equal(Object.values(capabilities).some(Boolean), false);
});
