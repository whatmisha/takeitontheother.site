/**
 * Characterization tests for the net geometry model.
 *
 * These lock the observable behavior of the surface model against
 * `fixtures/net-golden.json` so the migration to an N-plane document can be
 * verified step by step. A deliberate model change requires regenerating the
 * golden with `npm --prefix tools run golden`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { CanvasRendererController } from '../src/grid/CanvasRendererController.js';
import { Settings } from '../src/core/Settings.js';
import { PresetDocumentDeserializer } from '../src/preset/PresetDocumentDeserializer.js';
import { createBoxNet, PLANE_ROTATIONS } from '../src/surfaces/PlaneDefinition.js';
import {
    computeNetLayout,
    globalToPlaneLocal,
    resolveContentGeometry
} from '../src/surfaces/NetLayoutEngine.js';
import { SurfaceCoordinateMapper } from '../src/surfaces/SurfaceCoordinateMapper.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';

const boxNetLayout = ({ x, y, frontWidth, frontHeight, thickness }) => computeNetLayout(
    createBoxNet({ width: frontWidth, height: frontHeight, depth: thickness }),
    { origin: { x, y } }
);

const golden = JSON.parse(
    await readFile(new URL('./fixtures/net-golden.json', import.meta.url), 'utf8')
);

const round = value => (
    typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(10)) : value
);

const roundDeep = value => {
    if (Array.isArray(value)) return value.map(roundDeep);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, roundDeep(entry)])
        );
    }
    return round(value);
};

test('the default box net keeps its plane identity and rotation vocabulary', () => {
    assert.deepEqual(createBoxNet().planes.map(plane => plane.id), golden.surfaceIds);
    assert.deepEqual([...PLANE_ROTATIONS], golden.rotations);
});

test('editor layout scaling matches the golden master', () => {
    for (const entry of golden.layouts) {
        assert.deepEqual(
            roundDeep(CanvasRendererController.calculateLayout(entry.input)),
            entry.output,
            `${entry.case} @ ${entry.input.displaySize}`
        );
    }
});

test('export artboard dimensions match the golden master', () => {
    for (const entry of golden.artboards) {
        const { width, height } = CanvasRendererController.calculateArtboard({
            frontWidth: entry.frontWidth,
            frontHeight: entry.frontHeight,
            thickness: entry.thickness
        });
        assert.equal(`${width}mm`, entry.width, entry.case);
        assert.equal(`${height}mm`, entry.height, entry.case);
        assert.equal(`0 0 ${width} ${height}`, entry.viewBox, entry.case);
    }
});

test('surface rects, transforms and local mapping match the golden master', () => {
    for (const entry of golden.geometry) {
        const net = boxNetLayout(entry.layout);
        for (const expected of entry.surfaces) {
            const rect = net.planes[expected.surface].rect;
            assert.deepEqual(
                roundDeep(rect),
                expected.rect,
                `${entry.case}/${expected.surface} rect`
            );

            for (const rotationCase of expected.rotations) {
                const geometry = { rect, ...resolveContentGeometry(rect, rotationCase.rotation) };
                const label = `${entry.case}/${expected.surface}@${rotationCase.rotation}`;

                assert.equal(geometry.rotation, rotationCase.resolvedRotation, `${label} resolved`);
                assert.equal(geometry.transform, rotationCase.transform, `${label} transform`);
                assert.equal(round(geometry.localWidth), rotationCase.localWidth, `${label} width`);
                assert.equal(round(geometry.localHeight), rotationCase.localHeight, `${label} height`);

                for (const probe of rotationCase.localPoints) {
                    assert.deepEqual(
                        roundDeep(globalToPlaneLocal(probe.point, geometry)),
                        probe.local,
                        `${label} local ${probe.point.x},${probe.point.y}`
                    );
                }
            }
        }
    }
});

test('surface hit-testing matches the golden master across the whole artboard', () => {
    for (const entry of golden.hitTests) {
        const settings = new Settings({
            frontWidth: entry.layout.frontWidth,
            frontHeight: entry.layout.frontHeight,
            thickness: entry.layout.thickness,
            showSidePanels: true
        });
        const surfaceManager = new SurfaceManager(settings);
        surfaceManager.initialize('+ New');

        for (const probe of entry.probes) {
            assert.equal(
                surfaceManager.surfaceAtPoint(probe.point, entry.layout),
                probe.surface,
                `${entry.case} @ ${probe.point.x},${probe.point.y}`
            );
        }
    }
});

test('every checked-in preset resolves to the golden geometry and grid contexts', async () => {
    const deserializer = new PresetDocumentDeserializer();

    for (const expected of golden.presets) {
        const raw = JSON.parse(
            await readFile(new URL(`../presets/${expected.file}`, import.meta.url), 'utf8')
        );
        const document = deserializer.deserialize(raw);
        const settings = new Settings(document.settings);
        const surfaceManager = new SurfaceManager(settings);
        surfaceManager.initialize(document.presetName, document.settings.planeDocument);
        const mapper = new SurfaceCoordinateMapper({
            settings,
            surfaceManager,
            getLayout: () => null,
            clientToSvgPoint: () => null
        });
        const layout = {
            x: 0,
            y: 0,
            frontWidth: settings.get('frontWidth'),
            frontHeight: settings.get('frontHeight'),
            thickness: settings.get('thickness'),
            scale: 1
        };

        assert.equal(document.presetName, expected.presetName, expected.file);
        assert.deepEqual(
            roundDeep({
                frontWidth: settings.get('frontWidth'),
                frontHeight: settings.get('frontHeight'),
                thickness: settings.get('thickness')
            }),
            expected.dimensions,
            `${expected.file} dimensions`
        );
        assert.deepEqual(
            roundDeep(surfaceManager.getMasterGrid()),
            expected.masterGrid,
            `${expected.file} master grid`
        );

        for (const surface of expected.surfaces) {
            const plane = surfaceManager.getPlane(surface.surface);
            const geometry = surfaceManager.getGeometry(surface.surface, layout);
            const label = `${expected.file}/${surface.surface}`;

            assert.equal(surfaceManager.isVisible(surface.surface), surface.visible, `${label} visible`);
            assert.equal(plane.contentRotation, surface.rotation, `${label} rotation`);
            assert.equal(plane.grid.mode, surface.gridMode, `${label} grid mode`);
            assert.deepEqual(roundDeep(geometry.rect), surface.rect, `${label} rect`);
            assert.equal(geometry.transform, surface.transform, `${label} transform`);
            assert.equal(round(geometry.localWidth), surface.localWidth, `${label} local width`);
            assert.equal(round(geometry.localHeight), surface.localHeight, `${label} local height`);
            assert.deepEqual(
                roundDeep(mapper.getGridContext(surface.surface)),
                surface.gridContext,
                `${label} grid context`
            );
        }

        assert.deepEqual(
            (raw.texts || []).map(text => ({ id: text.id, surface: text.plane })),
            expected.objectSurfaces.texts,
            `${expected.file} text surfaces`
        );
        assert.deepEqual(
            [
                ...(raw.graphics?.blocks || []).map(block => ({
                    id: block.id,
                    surface: block.plane
                })),
                ...['icons', 'claim', 'claim2026']
                    .filter(id => raw.graphics?.[id])
                    .map(id => ({ id, surface: raw.graphics[id].plane }))
            ],
            expected.objectSurfaces.graphics,
            `${expected.file} graphics surfaces`
        );
    }
});
