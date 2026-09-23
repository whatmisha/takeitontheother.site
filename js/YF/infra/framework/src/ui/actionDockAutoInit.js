import { initActionDocks } from './ActionDockController.js?v=g7-keyboard-2';
import {
    installDocumentObserver,
    replaceObservedController
} from './ObservedControllerLifecycle.js?v=g7-resilience-4';

// Pizza Boxer injects its action fragment after the document is ready.
replaceObservedController({
    key: Symbol.for('lunnen.actionDockController'),
    createController: () => initActionDocks(),
    installObserver: controller => installDocumentObserver(controller, {
        ownerDocument: document,
        options: { childList: true, subtree: true }
    })
});
