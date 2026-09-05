import { initUnifiedUi } from './UnifiedUiController.js';

const key = Symbol.for('ui-garage.unifiedUiController');
globalThis[key]?.destroy?.();
globalThis[key] = initUnifiedUi(globalThis.UI_GARAGE_CONFIG?.ui);
