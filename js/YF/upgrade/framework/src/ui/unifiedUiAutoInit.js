import { initUnifiedUi } from './UnifiedUiController.js?v=g13-ui-repair-2';

const key = Symbol.for('lunnen.unifiedUiController');
globalThis[key]?.destroy?.();
globalThis[key] = initUnifiedUi();
