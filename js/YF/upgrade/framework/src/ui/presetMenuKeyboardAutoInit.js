import { initPresetMenuKeyboards } from './PresetMenuKeyboardController.js?v=g6-choice-1';

const controller = initPresetMenuKeyboards();

// Pizza Boxer injects its preset fragment after the document is ready.
const observer = new MutationObserver(() => controller.sync());
observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
});

globalThis[Symbol.for('lunnen.presetMenuKeyboardController')]?.destroy?.();
globalThis[Symbol.for('lunnen.presetMenuKeyboardController')] = controller;
