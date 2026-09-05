/**
 * UI Garage — public API barrel.
 *
 * Most tools only need `defineTool`. The individual modules are re-exported for
 * advanced wiring or for building on top of single subsystems.
 */

// Engine
export { defineTool } from './core/defineTool.js';
export { ApplicationShell } from './core/ApplicationShell.js';
export { resolveApplicationCapabilities } from './core/ApplicationCapabilities.js';

// Core
export { Settings } from './core/Settings.js';
export { DOMCache } from './core/DOMCache.js';
export { ShortcutRouter } from './core/ShortcutRouter.js';

// Render targets
export { RenderTarget } from './render/RenderTarget.js';
export { SvgTarget } from './render/SvgTarget.js';
export { CanvasTarget } from './render/CanvasTarget.js';

// UI components
export { SliderController } from './ui/SliderController.js';
export { PanelManager } from './ui/PanelManager.js';
export { ColorPicker } from './ui/ColorPicker.js';
export { UnifiedColorPicker } from './ui/UnifiedColorPicker.js';
export { DialogHost } from './ui/DialogHost.js';
export { OverlayDialogHost } from './ui/OverlayDialogHost.js';
export { TooltipService } from './ui/TooltipService.js';
export { FileIntakeController, fileMatchesAccept } from './ui/FileIntakeController.js';
export { ActionDockController, initActionDocks } from './ui/ActionDockController.js';
export { UnifiedUiController, initUnifiedUi } from './ui/UnifiedUiController.js';
export { PresetMenuKeyboardController, initPresetMenuKeyboards } from './ui/PresetMenuKeyboardController.js';
export { ZoomPanManager } from './ui/ZoomPanManager.js';

// Features
export { HistoryManager } from './history/HistoryManager.js';
export { HistoryBridge } from './history/HistoryBridge.js';
export { PresetStore } from './preset/PresetStore.js';
export { PresetSession, SHARED_SLOT, NEW_SLOT } from './preset/PresetSession.js';
export { ShareCodec, SHARE_SOFT_LIMIT_CHARS } from './preset/ShareCodec.js';
export { SVGExporter, svgDocumentString } from './export/SVGExporter.js';
export { ExportGuard } from './export/ExportGuard.js';
export { TextToPath } from './export/TextToPath.js';

// Opt-in responsive coordination
export { MobileBootstrap } from './mobile/MobileBootstrap.js';

// Effects
export { WobblyEffect } from './effects/WobblyEffect.js';
export { GradientStrokeEffect } from './effects/GradientStrokeEffect.js';

// Utils
export { ColorUtils } from './utils/ColorUtils.js';
export { MathUtils } from './utils/MathUtils.js';
export { NoiseGenerator } from './utils/NoiseGenerator.js';
export { SeededRandom, seedToUint32 } from './utils/SeededRandom.js';
export * as StripeGeometry from './geometry/StrokeGeometry.js';

// Config
export * from './config/timings.js';
