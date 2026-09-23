import test from 'node:test';
import assert from 'node:assert/strict';

import { TextBlockRenderer } from '../src/elements/TextBlockRenderer.js';

const values = {
    gridModule: 5,
    margins: 2,
    headlineSize: 3,
    textSize: 1,
    captionSize: 0.5,
    lunnenDisplaySize: 4
};
const renderer = new TextBlockRenderer({
    settings: { get: key => values[key] },
    createSvgElement: () => {},
    getContrastColor: () => '#fff',
    getStyleSettings: () => ({}),
    getFontMetrics: () => ({ capHeight: 630, xHeight: 447 }),
    layout: {
        calculateBlockWidth: () => 0,
        calculateBlockPosition: () => ({ x: 0, y: 0 }),
        wrapText: () => [],
        snapToBaseline: value => value
    }
});

test('text glyph metrics support cap-height and x-height sizing', () => {
    const capSized = renderer.calculateGlyphMetrics('headline', false, 2);
    assert.equal(capSized.capHeight, 30);
    assert.ok(Math.abs(capSized.xHeight - 21.285714285714285) < 1e-9);

    const xSized = renderer.calculateGlyphMetrics('headline', true, 2);
    assert.equal(xSized.xHeight, 30);
    assert.ok(Math.abs(xSized.capHeight - 42.28187919463087) < 1e-9);
});

test('first line origin follows each vertical alignment mode', () => {
    const base = {
        frontY: 20,
        positionY: 30,
        topMargin: 10,
        capHeight: 12,
        xHeight: 8,
        scale: 2
    };

    assert.equal(renderer.calculateFirstLineY({ ...base, alignmentMode: 'baseline' }), 70);
    assert.equal(renderer.calculateFirstLineY({ ...base, alignmentMode: 'x-height' }), 68);
    assert.equal(renderer.calculateFirstLineY({ ...base, alignmentMode: 'cap-height' }), 72);
});

test('horizontal placement keeps paragraph alignment inside the block', () => {
    assert.deepEqual(renderer.getHorizontalPlacement('left', 10, 80), { anchor: 'start', x: 10 });
    assert.deepEqual(renderer.getHorizontalPlacement('center', 10, 80), { anchor: 'middle', x: 50 });
    assert.deepEqual(renderer.getHorizontalPlacement('right', 10, 80), { anchor: 'end', x: 90 });
});

test('Lunnen Display attributes keep variable-font features', () => {
    const attributes = renderer.createTextAttributes({
        styleRef: 'lunnenDisplay',
        fontWeight: 650,
        fontFeatures: { salt: true, ss01: false, tnum: true }
    }, {
        fontFamily: 'Lunnen Display',
        fontWeight: 500,
        fontSize: 12,
        tracking: -0.02
    }, 'start', '#fff', 2);

    assert.equal(attributes['font-size'], '24');
    assert.equal(attributes['font-variation-settings'], "'wght' 650");
    assert.equal(attributes['font-feature-settings'], "'salt' 1, 'tnum' 1");
});

test('scale-one rendering creates export text without editor controls', () => {
    const createNode = (type, attributes = {}) => ({
        type,
        attributes,
        children: [],
        textContent: '',
        appendChild(child) {
            this.children.push(child);
        }
    });
    const exportRenderer = new TextBlockRenderer({
        settings: { get: key => values[key] },
        createSvgElement: (type, attributes, container) => {
            const node = createNode(type, attributes);
            container.appendChild(node);
            return node;
        },
        getContrastColor: () => '#fff',
        getStyleSettings: () => ({
            fontSize: 5,
            lineHeight: 2,
            tracking: 0,
            useXHeight: false,
            fontWeight: 500,
            fontFamily: 'TT Commons Classic'
        }),
        getFontMetrics: () => ({ capHeight: 630, xHeight: 447 }),
        layout: {
            calculateBlockWidth: () => 40,
            calculateBlockPosition: () => ({ x: 20, y: 30 }),
            wrapText: line => [line],
            snapToBaseline: value => value
        }
    });
    const container = createNode('g');

    const group = exportRenderer.draw(container, {
        id: 'export-text',
        content: 'First\nSecond',
        styleRef: 'text',
        alignment: 'left',
        textAlign: 'left'
    }, 5, 10, 100, 100, 1);

    assert.equal(container.children.length, 1);
    assert.equal(group.children.length, 2);
    assert.deepEqual(group.children.map(line => line.textContent), ['First', 'Second']);
    assert.deepEqual(group.children.map(line => line.attributes.y), [55, 65]);
    assert.equal(group.children[0].attributes.x, 25);
});
