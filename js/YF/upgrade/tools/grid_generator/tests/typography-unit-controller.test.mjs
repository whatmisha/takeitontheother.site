import test from 'node:test';
import assert from 'node:assert/strict';

import { TypographyUnitController } from '../src/ui/TypographyUnitController.js';

const makeClassList = () => {
    const values = new Set();
    return {
        toggle: (name, enabled) => enabled ? values.add(name) : values.delete(name),
        contains: name => values.has(name)
    };
};
const makeButton = () => ({ classList: makeClassList(), addEventListener: () => {} });
const dom = {};
for (const style of ['headline', 'text', 'caption', 'lunnenDisplay']) {
    const prefix = style === 'lunnenDisplay' ? 'lunnenDisplay' : style;
    dom[`${prefix}SizeUnitMod`] = makeButton();
    dom[`${prefix}SizeUnitPt`] = makeButton();
    dom[`${prefix}LineHeightUnitMod`] = makeButton();
    dom[`${prefix}LineHeightUnitPt`] = makeButton();
}
dom.headlineFontSize = { textContent: '' };
dom.textFontSize = { textContent: '' };
dom.captionFontSize = { textContent: '' };
dom.lunnenDisplayFontSize = { textContent: '' };

const values = {
    gridModule: 5,
    fontSizeUnit: 'mod',
    lineHeightUnit: 'mod',
    headlineSize: 1.5,
    lineHeight: 2,
    textSize: 0.5,
    textLineHeight: 1,
    captionSize: 0.4,
    captionLineHeight: 0.8,
    lunnenDisplaySize: 3,
    lunnenDisplayLineHeight: 4
};
const settings = {
    get: key => values[key],
    set: (key, value) => { values[key] = value; }
};
const sliderCalls = [];
const sliderController = {
    updateLimits: (...args) => sliderCalls.push(['limits', ...args]),
    resetLimits: (...args) => sliderCalls.push(['reset', ...args]),
    setValue: (...args) => sliderCalls.push(['value', ...args])
};
const styleResolver = {
    calculateFontSize: style => ({ headline: 10, text: 5, caption: 4, lunnenDisplay: 20 })[style]
};
let commits = 0;
const controller = new TypographyUnitController({
    settings,
    dom,
    sliderController,
    styleResolver,
    commitAction: () => { commits += 1; }
});

test('size unit switch synchronizes every style without changing module values', () => {
    const headlineSize = values.headlineSize;
    assert.equal(controller.switchUnit('headline', 'size', 'pt'), true);
    assert.equal(values.fontSizeUnit, 'pt');
    assert.equal(values.headlineSize, headlineSize);
    assert.equal(commits, 1);
    assert.equal(dom.headlineSizeUnitPt.classList.contains('active'), true);
    assert.equal(dom.textSizeUnitPt.classList.contains('active'), true);
    assert.equal(dom.captionSizeUnitPt.classList.contains('active'), true);
    assert.equal(dom.lunnenDisplaySizeUnitPt.classList.contains('active'), true);
    assert.equal(sliderCalls.filter(call => call[0] === 'limits').length, 4);
});

test('returning to modules restores slider limits', () => {
    sliderCalls.length = 0;
    controller.switchUnit('text', 'size', 'mod');
    assert.equal(values.fontSizeUnit, 'mod');
    assert.equal(sliderCalls.filter(call => call[0] === 'reset').length, 4);
});

test('line-height units remain independent from font-size units', () => {
    sliderCalls.length = 0;
    controller.switchUnit('caption', 'lineHeight', 'pt');
    assert.equal(values.fontSizeUnit, 'mod');
    assert.equal(values.lineHeightUnit, 'pt');
    assert.equal(dom.captionLineHeightUnitPt.classList.contains('active'), true);
    assert.equal(dom.headlineLineHeightUnitPt.classList.contains('active'), true);
    assert.equal(dom.captionSizeUnitMod.classList.contains('active'), true);
    assert.equal(sliderCalls.filter(call => call[0] === 'limits').length, 4);
});

test('typography display combines resolved size and modular line height', () => {
    controller.updateDisplays();
    assert.equal(dom.headlineFontSize.textContent, '28.3/28.3 pt');
    assert.equal(dom.textFontSize.textContent, '14.2/14.2 pt');
});
