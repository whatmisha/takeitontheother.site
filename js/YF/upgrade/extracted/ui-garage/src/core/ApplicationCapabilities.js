/** Resolve only the subsystems a declarative tool can actually use. */
export function resolveApplicationCapabilities(config = {}, documentRef = globalThis.document) {
    const controls = config.controls || {};
    const has = selector => Boolean(documentRef?.querySelector?.(selector));
    const history = Boolean(config.presets || (config.history && config.history !== false));
    const exporter = Boolean(config.export && config.export !== false);

    return Object.freeze({
        sliders: Boolean(controls.sliders?.length),
        ranges: Boolean(controls.ranges?.length),
        toggles: controls.toggles === true
            || Boolean(controls.toggleSelector)
            || has('input[type="checkbox"][data-setting]'),
        panels: Boolean(config.panels?.length),
        colors: Boolean(config.colorPickers),
        dice: Boolean(config.dice?.params?.length),
        tooltips: config.tooltips !== false
            && (config.tooltips != null || has('[data-tooltip]')),
        dialog: config.dialog !== false
            && (Boolean(config.dialog) || has('#dialog')),
        export: exporter,
        history,
        presets: Boolean(config.presets),
        share: Boolean(config.share),
        shortcuts: Boolean(Object.keys(config.shortcuts || {}).length || history || exporter),
        mobile: Boolean(config.mobile),
        zoom: config.zoom !== false
            && (Boolean(config.zoom) || Boolean(config.dom?.zoomIndicator))
    });
}
