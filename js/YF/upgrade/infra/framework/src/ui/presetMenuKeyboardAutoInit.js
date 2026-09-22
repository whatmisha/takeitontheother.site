import { initPresetMenuKeyboards } from './PresetMenuKeyboardController.js?v=g7-keyboard-2';
import {
    installDocumentObserver,
    replaceObservedController
} from './ObservedControllerLifecycle.js?v=g7-resilience-4';

// Pizza Boxer injects its preset fragment after the document is ready.
replaceObservedController({
    key: Symbol.for('lunnen.presetMenuKeyboardController'),
    createController: () => initPresetMenuKeyboards(),
    installObserver: controller => installDocumentObserver(controller, {
        ownerDocument: document,
        options: {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        }
    })
});
