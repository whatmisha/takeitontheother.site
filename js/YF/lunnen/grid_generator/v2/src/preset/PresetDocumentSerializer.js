import { cloneJson as clone } from '../utils/cloneJson.js';
import { DEFAULT_ROOT_PLANE_ID, normalizePlane } from '../surfaces/PlaneDefinition.js';
import {
    createBoxPlaneDocument,
    defaultOwnGrid,
    normalizeGrid
} from '../surfaces/PlaneDocumentStore.js';
import { CURRENT_PRESET_VERSION } from './PresetMigrations.js';
const compact = object => Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
);
const finitePositive = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback
);

function masterGridFrom(settings = {}) {
    return {
        module: finitePositive(settings.gridModule, 5),
        margins: Number.isFinite(Number(settings.margins)) ? Number(settings.margins) : 2,
        columns: Math.max(1, Math.round(finitePositive(settings.columnCount, 4))),
        rows: Math.max(1, Math.round(finitePositive(settings.rowCount, 4))),
        rowHeight: Math.max(1, Math.round(finitePositive(settings.rowHeight, 4))),
        marginsUnit: settings.marginsUnit === 'mm' ? 'mm' : 'mod',
        lockedModule: false,
        lockedMargins: false
    };
}

/**
 * Writes the net exactly as the 2.0 contract describes it, filling in anything
 * an older in-memory document left implicit.
 */
function serializeNet(settings, presetName = '') {
    const masterGrid = masterGridFrom(settings);
    const document = settings.planeDocument?.planes?.length
        ? settings.planeDocument
        : createBoxPlaneDocument(presetName, masterGrid);
    const ownGridFallback = defaultOwnGrid(masterGrid);
    const planes = document.planes.map((raw, index) => {
        const plane = normalizePlane(raw, index);
        return {
            ...plane,
            grid: {
                mode: plane.grid.mode === 'own' ? 'own' : 'inherit',
                own: normalizeGrid(plane.grid.own, ownGridFallback)
            }
        };
    });
    const rootId = planes.some(plane => plane.id === document.rootId)
        ? document.rootId
        : planes[0].id;
    const variables = Object.fromEntries(
        Object.entries(document.variables || {})
            .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
            .map(([name, value]) => [name, Number(value)])
    );
    return {
        rootId,
        variables,
        planes: planes.map(plane => (
            plane.id === rootId ? { ...plane, attach: null, visible: true } : plane
        ))
    };
}

const BUILT_IN_DEFAULTS = Object.freeze({
    icons: Object.freeze({ x: 1 }),
    claim: Object.freeze({ x: 7 }),
    claim2026: Object.freeze({ x: 4 })
});

function serializePosition(block, defaultColumn = 1) {
    return {
        column: block.x ?? defaultColumn,
        row: block.row ?? 0,
        baseline: block.baselineOffset ?? 0
    };
}

function serializeText(block, index) {
    return compact({
        id: block.id ?? `text_${index + 1}`,
        content: block.content ?? '',
        style: block.styleRef ?? 'headline',
        position: serializePosition(block),
        width: block.width ?? 3,
        alignment: block.alignment ?? 'left',
        textAlign: block.textAlign ?? 'left',
        alignmentMode: block.alignmentMode ?? 'baseline',
        plane: block.planeId ?? DEFAULT_ROOT_PLANE_ID,
        showBounds: block.showBounds ?? false,
        visible: block.visible ?? true,
        lockPosition: block.lockPosition ?? true,
        layer: block.layerIndex,
        fontWeight: block.fontWeight,
        fontFeatures: clone(block.fontFeatures)
    });
}

function serializeGraphic(block, index) {
    return compact({
        id: block.id ?? `graphic_${index + 1}`,
        name: block.name ?? `Graphic ${index + 1}`,
        position: serializePosition(block),
        height: block.heightInModules ?? 3,
        widthInColumns: block.widthInColumns,
        widthInModules: block.widthInModules,
        sizeMode: block.sizeMode ?? 'height',
        originalWidth: block.originalWidth,
        originalHeight: block.originalHeight,
        alignment: block.alignment ?? 'left',
        plane: block.planeId ?? DEFAULT_ROOT_PLANE_ID,
        showBounds: block.showBounds ?? false,
        visible: block.visible ?? true,
        lockPosition: block.lockPosition ?? true,
        layer: block.layerIndex,
        svg: block.svgContent ?? ''
    });
}

function serializeBuiltIn(block, id) {
    if (!block) return null;
    return compact({
        position: serializePosition(block, BUILT_IN_DEFAULTS[id].x),
        height: block.heightInModules ?? 3,
        widthInColumns: block.widthInColumns,
        widthInModules: block.widthInModules,
        sizeMode: block.sizeMode ?? 'height',
        originalWidth: block.originalWidth,
        originalHeight: block.originalHeight,
        alignment: block.alignment ?? 'left',
        plane: block.planeId ?? DEFAULT_ROOT_PLANE_ID,
        showBounds: block.showBounds ?? false,
        visible: block.visible ?? true,
        lockPosition: block.lockPosition ?? true,
        layer: block.layerIndex,
        svg: block.svgContent ?? ''
    });
}

/** Serializes the editable source-of-truth document into preset JSON. */
export class PresetDocumentSerializer {
    serialize(data = {}, { presetName } = {}) {
        const settings = data.settings || {};
        const textBlocks = data.textBlocks || [];
        const graphicsBlocks = data.graphicsBlocks || [];
        const icons = graphicsBlocks.find(block => block.id === 'icons');
        const claim = graphicsBlocks.find(block => block.id === 'claim');
        const claim2026 = graphicsBlocks.find(block => block.id === 'claim2026');
        const name = presetName ?? data.presetName ?? data.currentPresetName ?? 'Custom';
        return {
            presetName: name,
            version: CURRENT_PRESET_VERSION,
            timestamp: data.timestamp,
            dimensions: {
                width: settings.frontWidth,
                height: settings.frontHeight,
                thickness: settings.thickness,
                unit: 'mm'
            },
            net: serializeNet(settings, name),
            texts: textBlocks.map(serializeText),
            grid: {
                module: settings.gridModule,
                margins: settings.margins,
                marginsUnit: settings.marginsUnit ?? 'mod',
                columns: settings.columnCount,
                rows: settings.rowCount,
                rowHeight: settings.rowHeight,
                linkMode: settings.linkMode,
                locks: {
                    module: settings.lockedModule ?? false,
                    margins: settings.lockedMargins ?? false,
                    moduleValue: settings.lockedModuleValue ?? null,
                    marginsValue: settings.lockedMarginsValue ?? null
                },
                visibility: {
                    columns: settings.showColumns,
                    rows: settings.showRows,
                    baseline: settings.showBaseline
                }
            },
            colors: { background: settings.boxColor },
            typography: {
                units: {
                    size: settings.fontSizeUnit ?? 'mod',
                    lineHeight: settings.lineHeightUnit ?? 'mod'
                },
                headline: this.serializeStyle(settings, 'headline'),
                text: this.serializeStyle(settings, 'text'),
                caption: this.serializeStyle(settings, 'caption'),
                lunnenDisplay: this.serializeStyle(settings, 'lunnenDisplay')
            },
            display: {
                dimensions: settings.showDimensions,
                labels: settings.showLabels,
                sidePanels: settings.showSidePanels,
                objects: settings.showObjects
            },
            graphics: {
                blocks: graphicsBlocks
                    .filter(block => !block.isBuiltIn && !['icons', 'claim', 'claim2026'].includes(block.id))
                    .map(serializeGraphic),
                icons: serializeBuiltIn(icons, 'icons'),
                claim: serializeBuiltIn(claim, 'claim'),
                claim2026: serializeBuiltIn(claim2026, 'claim2026')
            }
        };
    }

    serializeStyle(settings, style) {
        const fields = {
            headline: ['headlineSize', 'lineHeight', 'tracking', 'useXHeight', 'headlineFontWeight'],
            text: ['textSize', 'textLineHeight', 'textTracking', 'useXHeight2', 'textFontWeight'],
            caption: ['captionSize', 'captionLineHeight', 'captionTracking', 'useXHeightCaption', 'captionFontWeight'],
            lunnenDisplay: ['lunnenDisplaySize', 'lunnenDisplayLineHeight', 'lunnenDisplayTracking', 'useXHeightLunnenDisplay', null]
        }[style];
        return compact({
            size: settings[fields[0]],
            lineHeight: settings[fields[1]],
            tracking: settings[fields[2]],
            useXHeight: settings[fields[3]],
            fontWeight: fields[4] ? settings[fields[4]] : undefined
        });
    }
}
