import { initUnifiedUi } from './UnifiedUiController.js?v=g8-ui-1';

const key = Symbol.for('lunnen.unifiedUiController');
globalThis[key]?.destroy?.();
globalThis[key] = initUnifiedUi();
