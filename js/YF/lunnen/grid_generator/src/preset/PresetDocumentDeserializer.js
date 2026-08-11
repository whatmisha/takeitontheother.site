import { cloneJson as clone } from '../utils/cloneJson.js';
const compact = object => Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
);

const BUILT_IN_DEFAULTS = Object.freeze({
    icons: Object.freeze({ name: 'Icons', x: 1, originalWidth: 204.0944882, originalHeight: 28.3464567 }),
    claim: Object.freeze({ name: 'Claim', x: 7, originalWidth: 186.2242584, originalHeight: 28.3464565 })
});

function deserializeText(text, index) {
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

function deserializeGraphic(graphic, index) {
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

function deserializeBuiltIn(graphic, id) {
    if (!graphic) return null;
    const defaults = BUILT_IN_DEFAULTS[id];
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

/** Converts the validated current preset JSON into the document model. */
export class PresetDocumentDeserializer {
    deserialize(data) {
        const grid = data.grid || {};
        const typography = data.typography || {};
        const units = typography.units || {};
        const locks = grid.locks || {};
        const caption = typography.caption;
        const display = typography.lunnenDisplay;
        const settings = compact({
            frontWidth: data.dimensions?.width,
            frontHeight: data.dimensions?.height,
            thickness: data.dimensions?.thickness,
            gridModule: grid.module,
            margins: grid.margins,
            marginsUnit: grid.marginsUnit,
            columnCount: grid.columns,
            rowCount: grid.rows,
            rowHeight: grid.rowHeight,
            linkMode: grid.linkMode,
            lockedModule: locks.module,
            lockedMargins: locks.margins,
            lockedModuleValue: locks.moduleValue,
            lockedMarginsValue: locks.marginsValue,
            showColumns: grid.visibility?.columns,
            showRows: grid.visibility?.rows,
            showBaseline: grid.visibility?.baseline,
            boxColor: data.colors?.background,
            fontSizeUnit: units.size,
            lineHeightUnit: units.lineHeight,
            ...this.deserializeStyle(typography.headline, 'headline'),
            ...this.deserializeStyle(typography.text, 'text'),
            ...this.deserializeStyle(caption, 'caption'),
            ...this.deserializeStyle(display, 'lunnenDisplay'),
            showDimensions: data.display?.dimensions,
            showLabels: data.display?.labels,
            showSidePanels: data.display?.sidePanels,
            showObjects: data.display?.objects,
            surfaceSettings: data.surfaces == null ? undefined : clone(data.surfaces)
        });
        const graphicsBlocks = (data.graphics?.blocks || []).map(deserializeGraphic);
        for (const id of ['icons', 'claim']) {
            const builtIn = deserializeBuiltIn(data.graphics?.[id], id);
            if (builtIn) graphicsBlocks.push(builtIn);
        }
        return {
            version: data.version,
            timestamp: data.timestamp,
            presetName: data.presetName,
            settings,
            textBlocks: (data.texts || []).map(deserializeText),
            graphicsBlocks
        };
    }

    deserializeStyle(style = {}, name, defaults = {}) {
        const keys = {
            headline: ['headlineSize', 'lineHeight', 'tracking', 'useXHeight', 'headlineFontWeight'],
            text: ['textSize', 'textLineHeight', 'textTracking', 'useXHeight2', 'textFontWeight'],
            caption: ['captionSize', 'captionLineHeight', 'captionTracking', 'useXHeightCaption', 'captionFontWeight'],
            lunnenDisplay: ['lunnenDisplaySize', 'lunnenDisplayLineHeight', 'lunnenDisplayTracking', 'useXHeightLunnenDisplay', null]
        }[name];
        return compact({
            [keys[0]]: style.size ?? defaults.size,
            [keys[1]]: style.lineHeight ?? defaults.lineHeight,
            [keys[2]]: style.tracking ?? defaults.tracking,
            [keys[3]]: style.useXHeight ?? defaults.useXHeight,
            ...(keys[4] ? { [keys[4]]: style.fontWeight ?? defaults.fontWeight } : {})
        });
    }
}
