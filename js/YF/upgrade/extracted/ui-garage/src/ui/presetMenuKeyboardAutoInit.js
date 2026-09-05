import { initPresetMenuKeyboards } from './PresetMenuKeyboardController.js';
import {
    installDocumentObserver,
    replaceObservedController
} from './ObservedControllerLifecycle.js';

// Some tools inject their preset fragment after the document is ready.
replaceObservedController({
    key: Symbol.for('ui-garage.presetMenuKeyboardController'),
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
