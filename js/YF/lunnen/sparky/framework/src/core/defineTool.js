import { ApplicationShell } from './ApplicationShell.js?v=20260823-2';

/**
 * defineTool — declare a tool with a single config object.
 *
 * Returns an ApplicationShell instance (not yet initialised). Call `.init()`
 * yourself, or pass `{ autoStart: true }` to init on DOMContentLoaded.
 *
 * @example
 * import { defineTool } from '../src/core/defineTool.js';
 *
 * defineTool({
 *   renderer: 'svg',
 *   autoStart: true,
 *   dom: { canvas: 'canvasContainer', surface: 'mainSvg', zoomIndicator: 'zoomIndicator' },
 *   settings: { width: 600, height: 600, cols: 8, color: '#82A9D9' },
 *   controls: {
 *     sliders: [
 *       { id: 'colsSlider', valueId: 'colsValue', setting: 'cols', min: 1, max: 40, decimals: 0, baseStep: 1, shiftStep: 5 }
 *     ],
 *     toggles: true
 *   },
 *   panels: [{ id: 'mainPanel', headerId: 'mainPanelHeader', persistent: true }],
 *   colorPickers: [{ containerId: 'colorPicker', setting: 'color' }],
 *   presets: { storageKey: 'gridTool', basePath: 'presets' },
 *   share: { quantizableFloatKeys: [] },
 *   export: { filename: 'grid.svg' },
 *   render(ctx) {
 *     const { svg, create, width, height, settings } = ctx;
 *     svg.appendChild(create('rect', { width, height, fill: '#fff' }));
 *     // ...draw grid...
 *   }
 * });
 *
 * @param {Object} config
 * @returns {ApplicationShell}
 */
export function defineTool(config = {}) {
    const app = new ApplicationShell(config);

    if (config.autoStart) {
        const start = () => { app.init().catch((e) => console.error('Tool init failed:', e)); };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
    }

    return app;
}
