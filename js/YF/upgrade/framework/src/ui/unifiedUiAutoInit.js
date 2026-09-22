import { initUnifiedUi } from './UnifiedUiController.js?v=int-02';

const key = Symbol.for('lunnen.unifiedUiController');
globalThis[key]?.destroy?.();
globalThis[key] = initUnifiedUi();
