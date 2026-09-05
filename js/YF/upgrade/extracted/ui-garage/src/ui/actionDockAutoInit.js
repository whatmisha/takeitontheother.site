import { initActionDocks } from './ActionDockController.js';
import {
    installDocumentObserver,
    replaceObservedController
} from './ObservedControllerLifecycle.js';

// Some tools inject their action fragment after the document is ready.
replaceObservedController({
    key: Symbol.for('ui-garage.actionDockController'),
    createController: () => initActionDocks(),
    installObserver: controller => installDocumentObserver(controller, {
        ownerDocument: document,
        options: { childList: true, subtree: true }
    })
});
