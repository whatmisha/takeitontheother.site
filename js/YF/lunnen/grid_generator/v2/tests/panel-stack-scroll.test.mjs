import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPanelVisibility, getPanelHeaderLabel, getScrollTopForTarget, clampScrollTop } from '../src/ui/PanelStackScroll.js';

test('classifyPanelVisibility treats partial overlap as visible', () => {
    const viewport = { top: 100, bottom: 400 };

    assert.equal(
        classifyPanelVisibility({ top: 50, bottom: 150 }, viewport),
        'visible'
    );
    assert.equal(
        classifyPanelVisibility({ top: 350, bottom: 450 }, viewport),
        'visible'
    );
});

test('classifyPanelVisibility marks fully hidden panels above or below the viewport', () => {
    const viewport = { top: 100, bottom: 400 };

    assert.equal(
        classifyPanelVisibility({ top: 10, bottom: 100 }, viewport),
        'above'
    );
    assert.equal(
        classifyPanelVisibility({ top: 400, bottom: 520 }, viewport),
        'below'
    );
});

test('getPanelHeaderLabel copies the panel title markup without the collapse control', () => {
    const header = {
        querySelector: selector => (
            selector === 'span:first-child'
                ? { innerHTML: 'Grid <span class="panel-params">Mod 5.00</span>' }
                : null
        )
    };

    assert.equal(
        getPanelHeaderLabel(header),
        'Grid <span class="panel-params">Mod 5.00</span>'
    );
});

test('getScrollTopForTarget aligns the target with the scroll viewport top', () => {
    const scrollBody = {
        scrollTop: 120,
        getBoundingClientRect: () => ({ top: 100 })
    };
    const header = {
        getBoundingClientRect: () => ({ top: 250 })
    };

    assert.equal(getScrollTopForTarget(scrollBody, header), 270);
});

test('clampScrollTop keeps the target within scroll bounds', () => {
    const scrollBody = {
        scrollHeight: 1000,
        clientHeight: 400
    };

    assert.equal(clampScrollTop(scrollBody, -20), 0);
    assert.equal(clampScrollTop(scrollBody, 450), 450);
    assert.equal(clampScrollTop(scrollBody, 900), 600);
});
