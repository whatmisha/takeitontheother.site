import test from 'node:test';
import assert from 'node:assert/strict';

import { TextStyleResolver } from '../src/elements/TextStyleResolver.js';

const values = {
    gridModule: 5,
    headlineSize: 1.5,
    lineHeight: 2,
    tracking: -0.015,
    useXHeight: false,
    headlineFontWeight: 500,
    textSize: 0.5,
    textLineHeight: 1,
    textTracking: 0,
    useXHeight2: true,
    textFontWeight: 400,
    captionSize: 0.4,
    captionLineHeight: 0.8,
    captionTracking: 0.01,
    useXHeightCaption: false,
    captionFontWeight: 500,
    lunnenDisplaySize: 3,
    lunnenDisplayLineHeight: 4,
    lunnenDisplayTracking: 0,
    useXHeightLunnenDisplay: false
};
const resolver = new TextStyleResolver({ get: key => values[key] });
const closeTo = (actual, expected) => {
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

test('font sizing uses the configured cap-height or x-height', () => {
    closeTo(resolver.calculateFontSize('headline'), 7.5 * 1000 / 630);
    closeTo(resolver.calculateFontSize('text'), 2.5 * 1000 / 447);
});

test('font size conversion round-trips through modules', () => {
    for (const style of ['headline', 'text', 'caption', 'lunnenDisplay']) {
        closeTo(
            resolver.fontSizeMmToModules(resolver.calculateFontSize(style), style),
            values[resolver.getConfig(style).size]
        );
    }
});

test('style settings normalize fallback and Lunnen Display behavior', () => {
    assert.deepEqual(resolver.getStyleSettings('unknown'), {
        fontSize: resolver.calculateFontSize('text'),
        lineHeight: 1,
        tracking: 0,
        useXHeight: true,
        fontWeight: 400,
        fontFamily: 'TT Commons Classic'
    });
    assert.deepEqual(resolver.getStyleSettings('lunnenDisplay'), {
        fontSize: resolver.calculateFontSize('lunnenDisplay'),
        lineHeight: 4,
        tracking: 0,
        useXHeight: false,
        fontWeight: 400,
        fontFamily: 'Lunnen Display'
    });
});
