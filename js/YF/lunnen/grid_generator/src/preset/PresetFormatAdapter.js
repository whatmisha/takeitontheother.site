const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

const compact = object => Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
);

const LEGACY_TYPOGRAPHY_DEFAULTS = Object.freeze({
    caption: Object.freeze({
        size: 0.5,
        lineHeight: 1,
        tracking: 0,
        useXHeight: false,
        fontWeight: 500
    }),
    lunnenDisplay: Object.freeze({
        size: 3,
        lineHeight: 4,
        tracking: 0,
        useXHeight: false
    })
});

const BUILT_IN_GRAPHICS_DEFAULTS = Object.freeze({
    icons: Object.freeze({
        name: 'Icons',
        x: 1,
        originalWidth: 204.0944882,
        originalHeight: 28.3464567
    }),
    claim: Object.freeze({
        name: 'Claim',
        x: 7,
        originalWidth: 186.2242584,
        originalHeight: 28.3464565
    })
});

function serializePosition(block, defaultColumn = 1) {
    return {
        column: block.x ?? defaultColumn,
        row: block.row ?? 0,
        baseline: block.baselineOffset ?? 0
    };
}

function serializeTextBlock(block, index) {
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
        fontWeight: block.fontWeight,
        fontFeatures: clone(block.fontFeatures)
    });
}

function serializeGraphicsBlock(block, index) {
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
        svg: block.svgContent ?? ''
    });
}

function serializeBuiltInGraphics(block, id) {
    if (!block) return null;
    const defaults = BUILT_IN_GRAPHICS_DEFAULTS[id];
    return compact({
        position: serializePosition(block, defaults.x),
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
        svg: block.svgContent ?? ''
    });
}

function deserializeTextBlock(text, index) {
    return compact({
        id: text.id ?? `text_${index + 1}`,
        content: text.content ?? '',
        styleRef: text.style ?? 'headline',
        x: text.position?.column ?? 1,
        row: text.position?.row ?? 0,
        baselineOffset: text.position?.baseline ?? 0,
        width: text.width ?? 3,
        alignment: text.alignment ?? 'left',
        textAlign: text.textAlign ?? text.alignment ?? 'left',
        alignmentMode: text.alignmentMode ?? 'baseline',
        surface: text.surface ?? 'front',
        showBounds: text.showBounds ?? false,
        visible: text.visible ?? true,
        lockPosition: text.lockPosition,
        fontWeight: text.fontWeight,
        fontFeatures: clone(text.fontFeatures)
    });
}

function deserializeGraphicsBlock(graphic, index) {
    return compact({
        id: graphic.id ?? `graphic_${index + 1}`,
        name: graphic.name ?? 'Graphic',
        isBuiltIn: false,
        svgContent: graphic.svg ?? '',
        heightInModules: graphic.height ?? 3,
        widthInColumns: graphic.widthInColumns ?? null,
        widthInModules: graphic.widthInModules ?? null,
        sizeMode: graphic.sizeMode ?? 'height',
        x: graphic.position?.column ?? 1,
        row: graphic.position?.row ?? 0,
        baselineOffset: graphic.position?.baseline ?? 0,
        alignment: graphic.alignment ?? 'left',
        surface: graphic.surface ?? 'front',
        showBounds: graphic.showBounds ?? false,
        visible: graphic.visible ?? true,
        lockPosition: graphic.lockPosition,
        originalWidth: graphic.originalWidth ?? 100,
        originalHeight: graphic.originalHeight ?? 100
    });
}

function deserializeBuiltInGraphics(graphic, id) {
    if (!graphic) return null;
    const defaults = BUILT_IN_GRAPHICS_DEFAULTS[id];
    return compact({
        id,
        name: defaults.name,
        isBuiltIn: true,
        svgContent: graphic.svg ?? '',
        heightInModules: graphic.height ?? 3,
        widthInColumns: graphic.widthInColumns ?? null,
        widthInModules: graphic.widthInModules ?? null,
        sizeMode: graphic.sizeMode ?? 'height',
        x: graphic.position?.column ?? defaults.x,
        row: graphic.position?.row ?? 0,
        baselineOffset: graphic.position?.baseline ?? 0,
        alignment: graphic.alignment ?? 'left',
        surface: graphic.surface ?? 'front',
        showBounds: graphic.showBounds ?? false,
        visible: graphic.visible ?? true,
        lockPosition: graphic.lockPosition,
        originalWidth: graphic.originalWidth ?? defaults.originalWidth,
        originalHeight: graphic.originalHeight ?? defaults.originalHeight
    });
}

/**
 * Converts between the editable document model and the human-readable preset
 * JSON. The adapter is intentionally independent from downloads and the UI so
 * format evolution and legacy compatibility stay testable in isolation.
 */
export class PresetFormatAdapter {
    isOrganized(data) {
        return Boolean(data?.dimensions && data?.grid && data?.typography);
    }

    organize(data = {}, { presetName } = {}) {
        const settings = data.settings || {};
        const textBlocks = data.textBlocks || [];
        const graphicsBlocks = data.graphicsBlocks || [];
        const iconsBlock = graphicsBlocks.find(block => block.id === 'icons');
        const claimBlock = graphicsBlocks.find(block => block.id === 'claim');

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
            texts: textBlocks.map(serializeTextBlock),
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
            colors: {
                background: settings.boxColor
            },
            typography: {
                units: {
                    size: settings.fontSizeUnit ?? 'mod',
                    lineHeight: settings.lineHeightUnit ?? 'mod'
                },
                headline: {
                    size: settings.headlineSize,
                    lineHeight: settings.lineHeight,
                    tracking: settings.tracking,
                    useXHeight: settings.useXHeight,
                    fontWeight: settings.headlineFontWeight
                },
                text: {
                    size: settings.textSize,
                    lineHeight: settings.textLineHeight,
                    tracking: settings.textTracking,
                    useXHeight: settings.useXHeight2,
                    fontWeight: settings.textFontWeight
                },
                caption: {
                    size: settings.captionSize,
                    lineHeight: settings.captionLineHeight,
                    tracking: settings.captionTracking,
                    useXHeight: settings.useXHeightCaption,
                    fontWeight: settings.captionFontWeight
                },
                lunnenDisplay: {
                    size: settings.lunnenDisplaySize,
                    lineHeight: settings.lunnenDisplayLineHeight,
                    tracking: settings.lunnenDisplayTracking,
                    useXHeight: settings.useXHeightLunnenDisplay
                }
            },
            display: {
                dimensions: settings.showDimensions,
                labels: settings.showLabels,
                sidePanels: settings.showSidePanels,
                objects: settings.showObjects
            },
            graphics: {
                blocks: graphicsBlocks
                    .filter(block => (
                        !block.isBuiltIn && block.id !== 'icons' && block.id !== 'claim'
                    ))
                    .map(serializeGraphicsBlock),
                icons: serializeBuiltInGraphics(iconsBlock, 'icons'),
                claim: serializeBuiltInGraphics(claimBlock, 'claim')
            }
        };
    }

    normalize(data) {
        return this.isOrganized(data) ? this.fromOrganized(data) : data;
    }

    fromOrganized(data) {
        const grid = data.grid || {};
        const typography = data.typography || {};
        const units = typography.units || {};
        const locks = grid.locks || {};
        const caption = typography.caption || LEGACY_TYPOGRAPHY_DEFAULTS.caption;
        const lunnenDisplay = typography.lunnenDisplay || LEGACY_TYPOGRAPHY_DEFAULTS.lunnenDisplay;

        const settings = compact({
            frontWidth: data.dimensions?.width,
            frontHeight: data.dimensions?.height,
            thickness: data.dimensions?.thickness,
            gridModule: grid.module,
            margins: grid.margins,
            marginsUnit: grid.marginsUnit ?? 'mod',
            columnCount: grid.columns,
            rowCount: grid.rows,
            rowHeight: grid.rowHeight,
            linkMode: grid.linkMode,
            lockedModule: locks.module ?? grid.lockedModule ?? false,
            lockedMargins: locks.margins ?? grid.lockedMargins ?? false,
            lockedModuleValue: locks.moduleValue ?? grid.lockedModuleValue ?? null,
            lockedMarginsValue: locks.marginsValue ?? grid.lockedMarginsValue ?? null,
            showColumns: grid.visibility?.columns,
            showRows: grid.visibility?.rows,
            showBaseline: grid.visibility?.baseline,
            boxColor: data.colors?.background,
            fontSizeUnit: units.size ?? typography.fontSizeUnit ?? 'mod',
            lineHeightUnit: units.lineHeight ?? typography.lineHeightUnit ?? 'mod',
            headlineSize: typography.headline?.size,
            lineHeight: typography.headline?.lineHeight,
            tracking: typography.headline?.tracking,
            useXHeight: typography.headline?.useXHeight,
            headlineFontWeight: typography.headline?.fontWeight,
            textSize: typography.text?.size,
            textLineHeight: typography.text?.lineHeight,
            textTracking: typography.text?.tracking,
            useXHeight2: typography.text?.useXHeight,
            textFontWeight: typography.text?.fontWeight,
            captionSize: caption.size ?? LEGACY_TYPOGRAPHY_DEFAULTS.caption.size,
            captionLineHeight: caption.lineHeight ?? LEGACY_TYPOGRAPHY_DEFAULTS.caption.lineHeight,
            captionTracking: caption.tracking ?? LEGACY_TYPOGRAPHY_DEFAULTS.caption.tracking,
            useXHeightCaption: caption.useXHeight ?? LEGACY_TYPOGRAPHY_DEFAULTS.caption.useXHeight,
            captionFontWeight: caption.fontWeight ?? LEGACY_TYPOGRAPHY_DEFAULTS.caption.fontWeight,
            lunnenDisplaySize: lunnenDisplay.size ?? LEGACY_TYPOGRAPHY_DEFAULTS.lunnenDisplay.size,
            lunnenDisplayLineHeight: lunnenDisplay.lineHeight ?? LEGACY_TYPOGRAPHY_DEFAULTS.lunnenDisplay.lineHeight,
            lunnenDisplayTracking: lunnenDisplay.tracking ?? LEGACY_TYPOGRAPHY_DEFAULTS.lunnenDisplay.tracking,
            useXHeightLunnenDisplay: lunnenDisplay.useXHeight ?? LEGACY_TYPOGRAPHY_DEFAULTS.lunnenDisplay.useXHeight,
            showDimensions: data.display?.dimensions,
            showLabels: data.display?.labels,
            showSidePanels: data.display?.sidePanels,
            showObjects: data.display?.objects,
            surfaceSettings: data.surfaces == null ? undefined : clone(data.surfaces)
        });

        const graphicsBlocks = (data.graphics?.blocks || []).map(deserializeGraphicsBlock);
        for (const id of ['icons', 'claim']) {
            const builtIn = deserializeBuiltInGraphics(data.graphics?.[id], id);
            if (builtIn) graphicsBlocks.push(builtIn);
        }

        return {
            version: data.version,
            timestamp: data.timestamp,
            presetName: data.presetName,
            settings,
            textBlocks: (data.texts || []).map(deserializeTextBlock),
            graphicsBlocks
        };
    }
}
