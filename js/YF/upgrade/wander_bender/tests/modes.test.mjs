import assert from 'node:assert/strict';
import test from 'node:test';

import { BaseMode } from '../js/modes/BaseMode.js';
import { FlowFieldMode } from '../js/modes/FlowFieldMode.js';
import { RadialMode } from '../js/modes/RadialMode.js';
import { RandomMode } from '../js/modes/RandomMode.js';
import { getPointOnLine } from '../js/utils/ShapeGenerator.js';
import { SpatialHash } from '../js/utils/SpatialHash.js';

const generator = Object.freeze({
    group: {},
    centerX: 250,
    centerY: 250
});

function rounded(value) {
    return Number(value.toFixed(6));
}

test('Radial mode keeps its three default rays at 90/210/330 degrees', () => {
    const mode = new RadialMode(generator);
    mode.generateElements({
        rays: 3,
        rayRotation: 0,
        length: 62.5,
        width: 25,
        stroke: 22.5,
        cornerRadius: 12.5,
        arcAmount: 0
    });

    assert.deepEqual(mode.elements.map(element => rounded(element.angle)), [90, 210, 330]);
    assert.deepEqual(mode.elements.map(element => element.pivotDistance), [12.5, 12.5, 12.5]);
    assert.ok(mode.elements.every(element => element.centerX === 250 && element.centerY === 250));
});

test('Random mode is deterministic for the shipped seed and parameters', () => {
    const params = {
        count: 20,
        areaWidth: 400,
        areaHeight: 400,
        lengthVariation: 50,
        randomSeed: 12345,
        length: 100,
        width: 25,
        stroke: 22.5,
        cornerRadius: 12.5,
        arcAmount: 0
    };
    const first = new RandomMode(generator);
    const second = new RandomMode(generator);
    first.generateElements(params);
    second.generateElements(params);

    assert.deepEqual(first.elements, second.elements);
    assert.equal(first.elements.length, 20);
    assert.deepEqual(
        first.elements.slice(0, 3).map(element => ({
            x: rounded(element.x),
            y: rounded(element.y),
            angle: rounded(element.angle),
            length: rounded(element.line[1].x)
        })),
        [
            { x: 215.26406, y: 55.553841, angle: 126.722222, length: 72.073474 },
            { x: 156.052812, y: 131.733539, angle: 259.358025, length: 51.406464 },
            { x: 60.627572, y: 181.575789, angle: 243.845679, length: 73.537809 }
        ]
    );
    const last = first.elements.at(-1);
    assert.deepEqual(
        [last.x, last.y, last.angle, last.line[1].x].map(rounded),
        [423.583676, 436.30144, 246.802469, 112.733625]
    );
});

test('Flow Field keeps the deterministic 41-element default placement', () => {
    const params = {
        length: 62.5,
        width: 25,
        stroke: 22.5,
        cornerRadius: 12.5,
        arcAmount: 0,
        density: 50,
        areaWidth: 400,
        areaHeight: 400,
        flowScale: 100,
        flowInfluence: 50,
        flowSeed: 12345,
        spacing: -50
    };
    const first = new FlowFieldMode(generator);
    const second = new FlowFieldMode(generator);
    first.generateElements(params);
    second.generateElements(params);

    assert.deepEqual(first.elements, second.elements);
    assert.equal(first.elements.length, 41);
    assert.deepEqual(
        first.elements.slice(0, 3).map(element => [
            rounded(element.x),
            rounded(element.y),
            rounded(element.angle)
        ]),
        [
            [226.119041, 116.318266, 181.10114],
            [209.301698, 173.202053, 168.22227],
            [310.620713, 116.367777, 192.893165]
        ]
    );
    const last = first.elements.at(-1);
    assert.deepEqual(
        [last.x, last.y, last.angle].map(rounded),
        [113.216735, 236.967914, 174.99607]
    );
    assert.ok(first.elements.every(element => element.line[2] === 0));
});

test('mode cache and extraction lifecycle preserve app-owned state', () => {
    class TestMode extends BaseMode {
        render() {
            this.renderCount = (this.renderCount || 0) + 1;
        }
    }
    const mode = new TestMode(generator);

    assert.equal(mode.paramsChanged({ rays: 3 }), true);
    assert.equal(mode.paramsChanged({ rays: 3 }), false);
    assert.equal(mode.paramsChanged({ rays: 4 }), true);

    mode.extractElement(2);
    mode.extractElement(2);
    mode.extractElement(4);
    assert.deepEqual(mode.extractedIndices, [2, 4]);
    mode.returnElement(2);
    assert.deepEqual(mode.extractedIndices, [4]);
    mode.currentParams = { rays: 4 };
    mode.resetExtracted();
    assert.deepEqual(mode.extractedIndices, []);
    assert.equal(mode.renderCount, 5);
});

test('shape sampling and spatial hash retain their domain contracts', () => {
    assert.deepEqual(
        getPointOnLine([{ x: 0, y: 0 }, { x: 100, y: 0 }, 0], 25),
        { x: 25, y: 0 }
    );
    const arcPoint = getPointOnLine([{ x: 0, y: 0 }, { x: 100, y: 0 }, 20], 50);
    assert.deepEqual([rounded(arcPoint.x), rounded(arcPoint.y)], [50, -20]);

    const hash = new SpatialHash(50);
    const element = { bounds: { x: 45, y: 45, width: 20, height: 20 } };
    hash.insert(element, 7);
    assert.deepEqual(
        hash.query({ x: 50, y: 50, width: 1, height: 1 }),
        [{ element, index: 7 }]
    );
    assert.deepEqual(hash.query({ x: 200, y: 200, width: 1, height: 1 }), []);
});
