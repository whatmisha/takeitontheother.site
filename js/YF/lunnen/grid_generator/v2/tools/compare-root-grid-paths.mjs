/**
 * One-off diagnostic: compares the root plane's dedicated grid renderer with the
 * shared per-plane grid painter across every checked-in preset.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Settings } from '../src/core/Settings.js';
import { GridCalculator } from '../src/grid/GridCalculator.js';
import {
    calculateBaselineRects,
    calculateColumnRects,
    calculateRowRects
} from '../src/grid/FrontGridGeometry.js';
import { PresetDocumentDeserializer } from '../src/preset/PresetDocumentDeserializer.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const round = value => Number(Number(value).toFixed(6));
const key = rect => [rect.x, rect.y, rect.width, rect.height].map(round).join(',');

/** Mirrors SurfaceGridPainter, returning rects instead of DOM nodes. */
function painterRects(context, geometry, scale, show) {
    const module = context.gridModule * scale;
    const margins = context.margins * module;
    const { localWidth: width, localHeight: height } = geometry;
    const contentWidth = Math.max(0, width - 2 * margins);
    const contentHeight = Math.max(0, height - 2 * margins);
    const columns = [];
    const rows = [];
    const baseline = [];

    if (show.columns && contentWidth > 0) {
        const columnWidth = Math.max(
            0,
            (contentWidth - (context.columnCount - 1) * module) / context.columnCount
        );
        for (let index = 0; index < context.columnCount; index += 1) {
            const x = margins + index * (columnWidth + module);
            if (x >= width - margins + 1e-6) break;
            columns.push({
                x, y: margins,
                width: Math.min(columnWidth, width - margins - x),
                height: contentHeight
            });
        }
    }
    if (show.rows && contentHeight > 0) {
        const rowHeight = context.rowHeight * module;
        for (let index = 0; index < context.rowCount; index += 1) {
            const y = margins + index * (rowHeight + module);
            if (y + rowHeight > height - margins + 1e-6) break;
            rows.push({ x: margins, y, width: contentWidth, height: rowHeight });
        }
    }
    if (show.baseline && contentHeight > 0) {
        for (let y = margins; y + module <= height - margins + 1e-6; y += module) {
            baseline.push({ x: margins, y, width: contentWidth, height: module });
        }
    }
    return { columns, rows, baseline };
}

const manifest = JSON.parse(
    await readFile(path.join(projectRoot, 'presets', 'manifest.json'), 'utf8')
);
const deserializer = new PresetDocumentDeserializer();
let differing = 0;

for (const preset of manifest.presets.filter(item => item.file)) {
    const raw = JSON.parse(
        await readFile(path.join(projectRoot, 'presets', preset.file), 'utf8')
    );
    const document = deserializer.deserialize(raw);
    const settings = new Settings(document.settings);
    const surfaceManager = new SurfaceManager(settings);
    surfaceManager.initialize(document.presetName, document.settings.net);
    const calculator = new GridCalculator(settings);
    const layout = {
        x: 0,
        y: 0,
        frontWidth: settings.get('frontWidth'),
        frontHeight: settings.get('frontHeight'),
        thickness: settings.get('thickness'),
        scale: 1
    };
    const rootId = surfaceManager.getRootId();
    const geometry = surfaceManager.getGeometry(rootId, layout);
    const context = surfaceManager.getGridContext(
        rootId,
        geometry.localWidth,
        geometry.localHeight
    );
    const show = { columns: true, rows: true, baseline: true };

    const current = {
        columns: calculateColumnRects({
            x: geometry.rect.x, y: geometry.rect.y,
            width: geometry.localWidth, height: geometry.localHeight,
            scale: 1,
            module: settings.get('gridModule'),
            margins: settings.get('margins'),
            columnCount: settings.get('columnCount'),
            columnWidth: calculator.calculateColumnWidth()
        }),
        rows: calculateRowRects({
            x: geometry.rect.x, y: geometry.rect.y,
            width: geometry.localWidth, height: geometry.localHeight,
            scale: 1,
            module: settings.get('gridModule'),
            margins: settings.get('margins'),
            rowCount: settings.get('rowCount'),
            rowHeight: settings.get('rowHeight')
        }),
        baseline: calculateBaselineRects({
            x: geometry.rect.x, y: geometry.rect.y,
            width: geometry.localWidth, height: geometry.localHeight,
            scale: 1,
            module: settings.get('gridModule'),
            margins: settings.get('margins')
        })
    };
    const shared = painterRects(context, geometry, 1, show);

    // The root sits at rect.x/rect.y; the shared painter draws inside a group
    // translated to that corner, so shift it for a like-for-like comparison.
    const shifted = Object.fromEntries(Object.entries(shared).map(([name, rects]) => [
        name,
        rects.map(rect => ({
            ...rect,
            x: rect.x + geometry.rect.x,
            y: rect.y + geometry.rect.y
        }))
    ]));

    const report = [];
    for (const name of ['columns', 'rows', 'baseline']) {
        const a = current[name].map(key);
        const b = shifted[name].map(key);
        if (a.length !== b.length || a.some((value, index) => value !== b[index])) {
            report.push(`${name}: current ${a.length} vs shared ${b.length}` +
                (a.length === b.length ? ' (same count, different rects)' : ''));
        }
    }
    if (report.length > 0) {
        differing += 1;
        console.log(`${preset.file}: ${report.join('; ')}`);
    }
}

console.log(
    differing === 0
        ? 'Identical on every preset — the root can move to the shared painter.'
        : `${differing} preset(s) differ.`
);
