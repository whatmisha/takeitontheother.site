/**
 * Pizza Boxer boundary with the shared Upgrade framework.
 *
 * Keep Pizza Boxer's Grid Application, document model, panels, history,
 * persistence and exporters app-owned. Only capabilities that are genuinely
 * common to every tool should cross this adapter.
 */
import { ColorUtils, FileIntakeController } from '../../../framework/src/index.js';

export const PIZZA_BOXER_FRAMEWORK_ADAPTER = Object.freeze({
    appId: 'pizza-boxer',
    mode: 'grid-application-adapter',
    sharedCapabilities: Object.freeze(['ColorUtils', 'FileIntakeController'])
});

export { ColorUtils, FileIntakeController };
