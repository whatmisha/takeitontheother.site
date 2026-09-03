import { initActionDocks } from './ActionDockController.js?v=g6-action-dock-5';

const controller = initActionDocks();

// Pizza Boxer injects its action fragment after the document is ready.
const observer = new MutationObserver(() => controller.sync());
observer.observe(document.documentElement, { childList: true, subtree: true });

globalThis[Symbol.for('lunnen.actionDockController')]?.destroy?.();
globalThis[Symbol.for('lunnen.actionDockController')] = controller;
