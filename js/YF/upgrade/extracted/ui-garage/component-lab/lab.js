import {
    ActionDockController,
    PresetMenuKeyboardController,
    Settings,
    UnifiedUiController
} from '../src/index.js';
import { RangeSliderController } from '../src/experimental.js';

let actionDock;
let presetKeyboard;
let rangeSliders;
let unifiedUi;

try {
    actionDock = new ActionDockController().init();
    presetKeyboard = new PresetMenuKeyboardController().init();
    const rangeSettings = new Settings({
        labIntegerMin: 20,
        labIntegerMax: 80,
        labDecimalMin: 0.25,
        labDecimalMax: 0.75
    });
    rangeSliders = new RangeSliderController(rangeSettings);
    rangeSliders.initRangeSlider('labIntegerRange', {
        minSetting: 'labIntegerMin',
        maxSetting: 'labIntegerMax',
        minValueId: 'labIntegerMin',
        maxValueId: 'labIntegerMax',
        min: 0,
        max: 100,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10,
        minAriaLabel: 'Integer interval minimum handle',
        maxAriaLabel: 'Integer interval maximum handle',
        onUpdate: (min, max) => { document.getElementById('labIntegerRangeStatus').textContent = `${min}–${max}`; }
    });
    rangeSliders.initRangeSlider('labDecimalRange', {
        minSetting: 'labDecimalMin',
        maxSetting: 'labDecimalMax',
        minValueId: 'labDecimalMin',
        maxValueId: 'labDecimalMax',
        min: 0,
        max: 1,
        decimals: 2,
        baseStep: 0.01,
        shiftStep: 0.1,
        minAriaLabel: 'Decimal interval minimum handle',
        maxAriaLabel: 'Decimal interval maximum handle',
        onUpdate: (min, max) => { document.getElementById('labDecimalRangeStatus').textContent = `${min.toFixed(2)}–${max.toFixed(2)}`; }
    });
    for (const [containerId, minLabel, maxLabel] of [
        ['labIntegerRange', 'Integer interval minimum handle', 'Integer interval maximum handle'],
        ['labDecimalRange', 'Decimal interval minimum handle', 'Decimal interval maximum handle']
    ]) {
        document.querySelector(`#${containerId} .range-slider-thumb-min`)?.setAttribute('aria-label', minLabel);
        document.querySelector(`#${containerId} .range-slider-thumb-max`)?.setAttribute('aria-label', maxLabel);
    }
    unifiedUi = new UnifiedUiController({
        toolName: 'Component Lab',
        panelSelector: '[data-lab-live-panel]',
        shortcutRows: [['Zoom', '⌘+ / ⌘−']]
    }).init();
    document.documentElement.dataset.componentLabReady = 'true';
} catch (error) {
    document.documentElement.dataset.componentLabError = error?.stack || String(error);
    console.error(error);
}

window.addEventListener('pagehide', () => {
    unifiedUi?.destroy();
    rangeSliders?.destroy();
    presetKeyboard?.destroy();
    actionDock?.destroy();
    delete document.documentElement.dataset.componentLabReady;
}, { once: true });
