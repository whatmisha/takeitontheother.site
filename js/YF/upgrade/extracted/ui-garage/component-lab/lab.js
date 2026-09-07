import {
    ActionDockController,
    PresetMenuKeyboardController,
    UnifiedUiController
} from '../src/index.js';

let actionDock;
let presetKeyboard;
let unifiedUi;

try {
    actionDock = new ActionDockController().init();
    presetKeyboard = new PresetMenuKeyboardController().init();
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
    presetKeyboard?.destroy();
    actionDock?.destroy();
    delete document.documentElement.dataset.componentLabReady;
}, { once: true });
