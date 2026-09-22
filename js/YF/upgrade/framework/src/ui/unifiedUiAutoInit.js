import { initUnifiedUi } from './UnifiedUiController.js?v=uiq-5';

const key = Symbol.for('lunnen.unifiedUiController');
globalThis[key]?.destroy?.();
globalThis[key] = initUnifiedUi();
