import { PanelResizeController } from './PanelResizeController.js?v=9';

// Independent of the application's drag manager and compiled runtime. This also
// covers editor panels injected after startup and consumers of older UI modules.
const key = Symbol.for('yf.panelResize');
globalThis[key]?.destroy();
const controller = new PanelResizeController();
const start = () => controller.init();
const show = event => { if (event.persisted) start(); };
const hide = event => { if (event.persisted) controller.destroy(); else lifecycle.destroy(); };
const lifecycle = {
    destroy() {
        document.removeEventListener('DOMContentLoaded', start);
        window.removeEventListener('pagehide', hide);
        window.removeEventListener('pageshow', show);
        controller.destroy();
        if (globalThis[key] === lifecycle) delete globalThis[key];
    }
};
globalThis[key] = lifecycle;
window.addEventListener('pagehide', hide);
window.addEventListener('pageshow', show);
if (document.body) start();
else document.addEventListener('DOMContentLoaded', start, { once: true });
