import { cloneJson as clone } from '../utils/cloneJson.js';
const compact = object => Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
);

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
        surface: block.surface ?? 'front',
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
        surface: block.surface ?? 'front',
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
        surface: block.surface ?? 'front',
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
        return {
            presetName: presetName ?? data.presetName ?? data.currentPresetName ?? 'Custom',
            version: data.version ?? '1.2',
            timestamp: data.timestamp,
            dimensions: {
                width: settings.frontWidth,
                height: settings.frontHeight,
                thickness: settings.thickness,
                unit: 'mm'
            },
            surfaces: clone(settings.surfaceSettings) ?? null,
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
