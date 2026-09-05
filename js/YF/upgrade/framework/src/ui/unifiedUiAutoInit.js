import { initUnifiedUi } from './UnifiedUiController.js?v=g11-controls-1';

const key = Symbol.for('lunnen.unifiedUiController');
globalThis[key]?.destroy?.();
globalThis[key] = initUnifiedUi();
