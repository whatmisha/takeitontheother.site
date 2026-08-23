/**
 * Generates the net geometry golden master used by tests/net-golden.test.mjs.
 *
 * The golden file freezes the observable geometry of the current surface model
 * so the migration to an N-plane document can be verified against it. Run with
 * `--check` to fail when the committed golden no longer matches the sources.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** The plane ids of the default box net, in document order. */
const BOX_PLANE_IDS = Object.freeze(createBoxNet().planes.map(plane => plane.id));

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDirectory, '..');
const goldenPath = path.join(projectRoot, 'tests', 'fixtures', 'net-golden.json');

/** Layout inputs that cover square, landscape, portrait and thin-wall nets. */
const LAYOUT_CASES = Object.freeze([
    { name: 'square', frontWidth: 500, frontHeight: 500, thickness: 50 },
    { name: 'landscape', frontWidth: 500, frontHeight: 400, thickness: 50 },
    { name: 'portrait', frontWidth: 300, frontHeight: 620, thickness: 35 },
    { name: 'thin-wall', frontWidth: 148.5, frontHeight: 203, thickness: 5 },
    { name: 'offset-origin', frontWidth: 500, frontHeight: 400, thickness: 50, x: 10, y: 20 }
]);

const DISPLAY_CASES = Object.freeze([
    { displaySize: 1000, padding: 60 },
    { displaySize: 720, padding: 60 },
    { displaySize: 1440, padding: 60 }
]);

const round = value => (
    typeof value === 'number' && Number.isFinite(value)
        ? Number(value.toFixed(10))
        : value
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

function layoutFromCase({ frontWidth, frontHeight, thickness, x = 0, y = 0 }) {
    return { x, y, frontWidth, frontHeight, thickness, scale: 1 };
}

/** Nine probe points per surface rect: corners, edge midpoints and centre. */
function probePoints(rect) {
    const xs = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
    const ys = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
    return xs.flatMap(x => ys.map(y => ({ x, y })));
}

/** Resolves the default box net for one pre-scaled layout. */
function boxNetLayout({ x, y, frontWidth, frontHeight, thickness }) {
    return computeNetLayout(
        createBoxNet({ width: frontWidth, height: frontHeight, depth: thickness }),
        { origin: { x, y } }
    );
}

function buildGeometryEntries() {
    return LAYOUT_CASES.map(layoutCase => {
        const layout = layoutFromCase(layoutCase);
        const net = boxNetLayout(layout);
        return {
            case: layoutCase.name,
            layout,
            surfaces: BOX_PLANE_IDS.map(planeId => ({
                surface: planeId,
                rect: net.planes[planeId].rect,
                rotations: PLANE_ROTATIONS.map(rotation => {
                    const rect = net.planes[planeId].rect;
                    const geometry = { rect, ...resolveContentGeometry(rect, rotation) };
                    return {
                        rotation,
                        resolvedRotation: geometry.rotation,
                        transform: geometry.transform,
                        localWidth: geometry.localWidth,
                        localHeight: geometry.localHeight,
                        localPoints: probePoints(geometry.rect).map(point => ({
                            point,
                            local: globalToPlaneLocal(point, geometry)
                        }))
                    };
                })
            }))
        };
    });
}

function buildLayoutEntries() {
    return LAYOUT_CASES.flatMap(layoutCase => DISPLAY_CASES.map(display => ({
        case: layoutCase.name,
        input: {
            frontWidth: layoutCase.frontWidth,
            frontHeight: layoutCase.frontHeight,
            thickness: layoutCase.thickness,
            ...display
        },
        output: CanvasRendererController.calculateLayout({
            frontWidth: layoutCase.frontWidth,
            frontHeight: layoutCase.frontHeight,
            thickness: layoutCase.thickness,
            ...display
        })
    })));
}

function buildArtboardEntries() {
    return LAYOUT_CASES.map(({ name, frontWidth, frontHeight, thickness }) => {
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;
        return {
            case: name,
            frontWidth,
            frontHeight,
            thickness,
            width: `${totalWidth}mm`,
            height: `${totalHeight}mm`,
            viewBox: `0 0 ${totalWidth} ${totalHeight}`
        };
    });
}

/** Hit-test probes across the whole artboard plus points outside every rect. */
function buildHitTestEntries() {
    return LAYOUT_CASES.map(layoutCase => {
        const layout = layoutFromCase(layoutCase);
        const settings = new Settings({
            frontWidth: layoutCase.frontWidth,
            frontHeight: layoutCase.frontHeight,
            thickness: layoutCase.thickness,
            showSidePanels: true
        });
        const surfaceManager = new SurfaceManager(settings);
        surfaceManager.initialize('+ New');

        const { x, y, frontWidth, frontHeight, thickness } = layout;
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;
        const steps = 9;
        const probes = [];
        for (let column = 0; column <= steps; column += 1) {
            for (let row = 0; row <= steps; row += 1) {
                probes.push({
                    x: x + (totalWidth * column) / steps,
                    y: y + (totalHeight * row) / steps
                });
            }
        }
        probes.push({ x: x - 1, y: y - 1 });
        probes.push({ x: x + totalWidth + 1, y: y + totalHeight + 1 });

        return {
            case: layoutCase.name,
            layout,
            probes: probes.map(point => ({
                point,
                surface: surfaceManager.surfaceAtPoint(point, layout)
            }))
        };
    });
}

async function buildPresetEntries() {
    const manifest = JSON.parse(
        await readFile(path.join(projectRoot, 'presets', 'manifest.json'), 'utf8')
    );
    const deserializer = new PresetDocumentDeserializer();
    const entries = [];

    for (const preset of manifest.presets.filter(item => item.file)) {
        const raw = JSON.parse(
            await readFile(path.join(projectRoot, 'presets', preset.file), 'utf8')
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
        const layout = layoutFromCase({
            frontWidth: settings.get('frontWidth'),
            frontHeight: settings.get('frontHeight'),
            thickness: settings.get('thickness')
        });

        entries.push({
            file: preset.file,
            presetName: document.presetName,
            dimensions: {
                frontWidth: settings.get('frontWidth'),
                frontHeight: settings.get('frontHeight'),
                thickness: settings.get('thickness')
            },
            masterGrid: surfaceManager.getMasterGrid(),
            surfaces: surfaceManager.getPlaneIds().map(surface => {
                const plane = surfaceManager.getPlane(surface);
                const geometry = surfaceManager.getGeometry(surface, layout);
                return {
                    surface,
                    visible: surfaceManager.isVisible(surface),
                    rotation: plane.contentRotation,
                    gridMode: plane.grid.mode,
                    rect: geometry.rect,
                    transform: geometry.transform,
                    localWidth: geometry.localWidth,
                    localHeight: geometry.localHeight,
                    gridContext: mapper.getGridContext(surface)
                };
            }),
            objectSurfaces: {
                texts: (raw.texts || []).map(text => ({ id: text.id, surface: text.plane })),
                graphics: [
                    ...(raw.graphics?.blocks || []).map(block => ({
                        id: block.id,
                        surface: block.plane
                    })),
                    ...['icons', 'claim', 'claim2026']
                        .filter(id => raw.graphics?.[id])
                        .map(id => ({ id, surface: raw.graphics[id].plane }))
                ]
            }
        });
    }

    return entries;
}

async function buildGolden() {
    return roundDeep({
        description:
            'Golden master of the default box net: a root panel with one panel on ' +
            'each edge. Regenerate deliberately with `npm --prefix tools run golden` ' +
            'when the net model changes on purpose.',
        surfaceIds: [...BOX_PLANE_IDS],
        rotations: [...PLANE_ROTATIONS],
        layouts: buildLayoutEntries(),
        artboards: buildArtboardEntries(),
        geometry: buildGeometryEntries(),
        hitTests: buildHitTestEntries(),
        presets: await buildPresetEntries()
    });
}

async function main() {
    const golden = await buildGolden();
    const serialized = `${JSON.stringify(golden, null, 2)}\n`;

    if (process.argv.includes('--check')) {
        const current = await readFile(goldenPath, 'utf8').catch(() => null);
        if (current !== serialized) {
            console.error(
                'Net golden master is stale. Run `npm --prefix tools run golden`.'
            );
            process.exitCode = 1;
            return;
        }
        console.log('Net golden master is current.');
        return;
    }

    await writeFile(goldenPath, serialized, 'utf8');
    console.log(
        `Net golden master written: ${golden.presets.length} presets, ` +
        `${golden.geometry.length} layout cases, ${golden.layouts.length} layout probes.`
    );
}

await main();
