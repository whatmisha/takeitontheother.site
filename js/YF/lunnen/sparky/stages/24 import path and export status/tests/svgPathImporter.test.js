import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IMPORT_MAX_POINTS,
    importSvgMotionPath,
    importSvgPathData,
    parseSvgPathData,
    svgPointsToPathData
} from '../src/animation/svgPathImporter.js';
import { pathIsInsideRegion, serializeFocusPath, rebuildFocusPath } from '../src/animation/focusPath.js';
import {
    importedClosureEditorControls,
    moveImportedClosureAnchor,
    moveImportedClosureHandle
} from '../src/animation/focusPathEditor.js';

const options = {
    center: { x: 240, y: 240 },
    radius: 195.233,
    startFocus: { x: 240, y: 240 },
    fileName: 'motion.svg'
};

test('SVG path parser preserves straight and curved segment kinds', () => {
    const parsed = parseSvgPathData('M0 0 L100 0 C120 20 120 80 100 100 L0 100 Z');
    assert.equal(parsed.closed, true);
    assert.deepEqual(parsed.segments.map((segment) => segment.kind), [
        'line', 'curve', 'line', 'line'
    ]);
});

test('SVG path parser rejects a second subpath', () => {
    assert.throws(
        () => parseSvgPathData('M0 0 L10 0 M20 20 L30 20'),
        /one continuous path/i
    );
});

test('Illustrator polylines convert to an open path of exact straight segments', () => {
    const pathData = svgPointsToPathData(
        '521.7191918 255.1942894 267.2320092 .7071067 .7071068 267.231948'
    );
    const parsed = parseSvgPathData(pathData);
    assert.equal(parsed.closed, false);
    assert.equal(parsed.segments.length, 2);
    assert.deepEqual(parsed.segments.map((segment) => segment.kind), ['line', 'line']);
    assert.deepEqual(parsed.segments[0].start, { x: 521.7191918, y: 255.1942894 });
    assert.deepEqual(parsed.segments[1].end, { x: 0.7071068, y: 267.231948 });
});

test('polygons convert to a closed straight path', () => {
    const parsed = parseSvgPathData(svgPointsToPathData('0 0 100 0 100 100 0 100', {
        closed: true
    }));
    assert.equal(parsed.closed, true);
    assert.equal(parsed.segments.length, 4);
    assert.ok(parsed.segments.every((segment) => segment.kind === 'line'));
});

test('a single SVG polyline passes object validation and receives a smooth closure', () => {
    const originalDOMParser = globalThis.DOMParser;
    const points = '521.7191918 255.1942894 267.2320092 .7071067 .7071068 267.231948 267.2320092 533.7568504 395.5080101 405.4807884 649.9951928 659.967971 916.5200341 393.4431297 649.9951928 126.9182273';
    const root = {
        localName: 'svg',
        parentNode: null,
        getAttribute: () => null
    };
    const polyline = {
        localName: 'polyline',
        parentNode: root,
        getAttribute: (name) => name === 'points' ? points : null
    };
    globalThis.DOMParser = class {
        parseFromString() {
            return {
                documentElement: root,
                querySelector: () => null,
                querySelectorAll: () => [polyline]
            };
        }
    };
    try {
        const path = importSvgMotionPath('<svg><polyline/></svg>', options);
        assert.equal(path.importMeta.wasOpen, true);
        assert.equal(path.segments.filter((segment) => segment.role === 'closure').length, 2);
        assert.equal(pathIsInsideRegion(path, 1e-4), true);
    } finally {
        if (originalDOMParser) globalThis.DOMParser = originalDOMParser;
        else delete globalThis.DOMParser;
    }
});

test('closed imports fit the focus circle and expose no closure editor', () => {
    const path = importSvgPathData('M0 0 L100 0 L100 100 L0 100 Z', options);
    assert.equal(path.importMeta.imported, true);
    assert.equal(path.importMeta.wasOpen, false);
    assert.equal(path.importMeta.fileName, 'motion.svg');
    assert.equal(pathIsInsideRegion(path, 1e-4), true);
    assert.deepEqual(importedClosureEditorControls(path), { anchors: [], handles: [] });
});

test('the imported loop starts at the source point nearest the current Focus', () => {
    const startFocus = { x: options.center.x + options.radius, y: options.center.y };
    const path = importSvgPathData('M0 0 L100 0 L100 100 L0 100 Z', {
        ...options,
        startFocus
    });
    const startDistance = Math.hypot(
        path.anchors[0].x - startFocus.x,
        path.anchors[0].y - startFocus.y
    );
    const otherDistances = path.anchors.slice(1).map((anchor) => Math.hypot(
        anchor.x - startFocus.x,
        anchor.y - startFocus.y
    ));
    assert.ok(startDistance <= Math.min(...otherDistances) + 1e-4);
});

test('open imports gain exactly two editable closure curves', () => {
    const path = importSvgPathData(
        'M0 0 L100 0 C130 20 130 80 100 100 L0 100',
        options
    );
    const closureSegments = path.segments.filter((segment) => segment.role === 'closure');
    const controls = importedClosureEditorControls(path);
    assert.equal(path.importMeta.wasOpen, true);
    assert.equal(closureSegments.length, 2);
    assert.equal(controls.anchors.length, 1);
    assert.equal(controls.handles.length, 4);
    assert.equal(pathIsInsideRegion(path, 1e-4), true);
});

test('closure editing never changes imported source segments', () => {
    const path = importSvgPathData(
        'M0 0 L100 0 C130 20 130 80 100 100 L0 100',
        options
    );
    const controls = importedClosureEditorControls(path);
    const sourceBefore = path.segments
        .filter((segment) => segment.role === 'source')
        .map((segment) => JSON.stringify(segment));
    const movedAnchor = moveImportedClosureAnchor(
        path,
        controls.anchors[0].anchorIndex,
        { x: 410, y: 340 }
    );
    const movedHandle = moveImportedClosureHandle(
        movedAnchor,
        controls.handles[0].segmentIndex,
        controls.handles[0].control,
        { x: 320, y: 180 }
    );
    const sourceAfter = movedHandle.segments
        .filter((segment) => segment.role === 'source')
        .map((segment) => JSON.stringify(segment));
    assert.deepEqual(sourceAfter, sourceBefore);
    assert.equal(pathIsInsideRegion(movedHandle, 1e-4), true);
});

test('dense collinear imports simplify below the agreed hard limit', () => {
    const commands = ['M0 0'];
    for (let index = 1; index <= 140; index += 1) commands.push(`L${index} 0`);
    const path = importSvgPathData(commands.join(' '), options);
    assert.ok(path.anchors.length <= IMPORT_MAX_POINTS);
    assert.ok(path.anchors.length <= 48);
    assert.equal(pathIsInsideRegion(path, 1e-4), true);
});

test('serialized imports retain source and closure roles for animation export', () => {
    const path = importSvgPathData('M0 0 L100 0 L100 100', options);
    const rebuilt = rebuildFocusPath(serializeFocusPath(path));
    assert.deepEqual(rebuilt.importMeta, path.importMeta);
    assert.deepEqual(
        rebuilt.segments.map((segment) => segment.role),
        path.segments.map((segment) => segment.role)
    );
});
