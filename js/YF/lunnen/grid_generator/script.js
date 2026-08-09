// ============================================
// Импорты модулей
// ============================================
// Итерация 1: Утилиты
import { ColorUtils } from './src/utils/ColorUtils.js';
import { MathUtils } from './src/utils/MathUtils.js';
import { DOMUtils } from './src/utils/DOMUtils.js';
import { TextToPath } from './src/utils/TextToPath.js';

// Итерация 2: Core
import { Settings } from './src/core/Settings.js';
import { DOMCache } from './src/core/DOMCache.js?v=1.12.17';

// Итерация 3: Grid
import { GridCalculator } from './src/grid/GridCalculator.js?v=1.12.28';
import { GridRenderer } from './src/grid/GridRenderer.js';

// Итерация 4: Config
import { SLIDER_CONFIG } from './src/config/SliderConfig.js';

// Итерация 5: UI Controllers
import { SliderController } from './src/ui/SliderController.js?v=1.12.31';
import { PanelManager } from './src/ui/PanelManager.js';
import { ZoomPanManager } from './src/ui/ZoomPanManager.js?v=1.12.10';
import { TypographyUnitController } from './src/ui/TypographyUnitController.js?v=1.12.29';
import { GridSettingsController } from './src/ui/GridSettingsController.js?v=1.12.31';

// Итерация 6: Elements
import { GraphicsRenderer } from './src/elements/GraphicsRenderer.js?v=1.12.25';
import { TextBlockRenderer } from './src/elements/TextBlockRenderer.js?v=1.12.27';
import { TextLayout } from './src/elements/TextLayout.js?v=1.12.27';
import { TextStyleResolver } from './src/elements/TextStyleResolver.js?v=1.12.28';
import { ObjectEditorPanelController } from './src/elements/ObjectEditorPanelController.js?v=1.12.18';
import { ObjectEditorInputController } from './src/elements/ObjectEditorInputController.js?v=1.12.20';
import { ObjectNavigatorController } from './src/elements/ObjectNavigatorController.js?v=1.12.22';
import { ObjectDragController } from './src/elements/ObjectDragController.js?v=1.12.24';

// Итерация 7: SVG Export
import { SVGExporter } from './src/svg/SVGExporter.js';

// Итерация 8: Preset Management
import { PresetManager } from './src/preset/PresetManager.js?v=1.12.32';
import { PresetApplicationController } from './src/preset/PresetApplicationController.js?v=1.12.32';

// Итерация 9: History Management
import { HistoryManager } from './src/history/HistoryManager.js';

// Surface model
import { SurfaceManager, SURFACE_IDS, SIDE_SURFACE_IDS } from './src/surfaces/SurfaceManager.js?v=1.12.10';
import { SurfacePanelController } from './src/surfaces/SurfacePanelController.js?v=1.12.10';
import { SurfaceCoordinateMapper } from './src/surfaces/SurfaceCoordinateMapper.js?v=1.12.11';
import { SurfaceRenderer } from './src/surfaces/SurfaceRenderer.js?v=1.12.11';

const TEXT_PRESETS = [
    { id: 'brand',        label: 'Brand',         text: 'Lunnen — бренд компьютерной техники и аксессуаров, придуманный в Яндекс Фабрике. Сопровождает в исследованиях, работе и развлечениях.' },
    { id: 'outer',        label: 'Outer',         text: 'Продвинутая линейка Lunnen Outer для исследований неизведанного. Эффективные технологии для работы с графикой или развлечений разного уровня сложностей.' },
    { id: 'ground',       label: 'Ground',        text: 'Базовая линейка Lunnen Ground для решения земных задач. Всё необходимое для повседневной работы: от прочного корпуса до современных технологий.' },
    { id: 'airis',        label: 'Airis',         text: 'Lunnen Airis — лёгкая линейка с мощными возможностями. Справляется с тяжёлыми задачами и расширяет границы невесомости.' },
    { id: 'work',         label: 'Work',          text: 'Серия аксессуаров для компьютерной техники Lunnen Work — подходит для работы и повседневных задач.' },
    { id: 'manufacturer', label: 'Изготовитель',  text: 'Изготовитель: Винд Мобилити Текнолоджи (Пекин) Лимитед. Адрес: офис 11605, 13 этаж, корпус 1, дом 2, переулок Наньчжугань, район Дунчэн, Пекин, Китай. Сделано в Китае.' },
    { id: 'market',       label: 'Маркет.Трейд',  text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «Маркет. Трейд». Адрес: 121099, Россия, г. Москва, Новинский б-р, д. 8. Info@lunnen.pro' },
    { id: 'cyberstor',    label: 'Сайберстор',    text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «САЙБЕРСТОР». Адрес импортёра: 123112, Россия, г. Москва, вн.тер.г. Муниципальный Округ Пресненский, 1-й Красногвардейский, д. 21, стр. 1. Info@lunnen.pro' },
].map(p => ({ ...p, text: p.text.replace(/ {2,}/g, ' ') }));

class GridGenerator {
    constructor() {
        // Slider configuration - defines behavior for each slider
        // Дополнено min, max и valueId для использования с SliderController
        this.SLIDER_CONFIG = {
            ...SLIDER_CONFIG,
            surfaceGridModuleSlider: {
                valueId: 'surfaceGridModuleInput',
                setting: null,
                min: 0.1,
                max: 100,
                decimals: 4,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: value => this.surfacePanelController?.applyGridValue('module', value)
            },
            surfaceGridMarginsSlider: {
                valueId: 'surfaceGridMarginsInput',
                setting: null,
                min: 0,
                max: 10,
                decimals: 4,
                baseStep: 0.0001,
                shiftStep: 0.1,
                onUpdate: value => this.surfacePanelController?.applyGridValue('margins', value)
            },
            surfaceGridColumnsSlider: {
                valueId: 'surfaceGridColumnsInput',
                setting: null,
                min: 1,
                max: 128,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: value => this.surfacePanelController?.applyGridValue('columns', value)
            },
            surfaceGridRowsSlider: {
                valueId: 'surfaceGridRowsInput',
                setting: null,
                min: 1,
                max: 128,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: value => this.surfacePanelController?.applyGridValue('rows', value)
            },
            surfaceGridRowHeightSlider: {
                valueId: 'surfaceGridRowHeightInput',
                setting: null,
                min: 1,
                max: 64,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: value => this.surfacePanelController?.applyGridValue('rowHeight', value)
            },
            hueSlider: {
                valueId: 'hueValue',
                setting: null, // Handled by the HSB controls below
                min: 0,
                max: 360,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateSaturationGradient();
                    this.updateBrightnessGradient();
                }
            },
            saturationSlider: {
                valueId: 'saturationValue',
                setting: null, // Handled by the HSB controls below
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateBrightnessGradient();
                }
            },
            brightnessSlider: {
                valueId: 'brightnessValue',
                setting: null, // Handled by the HSB controls below
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateSaturationGradient();
                }
            },
            headlineSizeSlider: {
                valueId: 'headlineSizeValue',
                // ВАЖНО: headlineSize всегда храним во ВНУТРЕННЕЙ системе в модулях,
                // а слайдер показывает либо модули, либо пункты в зависимости от fontSizeUnit.
                setting: null,
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('headlineSizeSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.headlineSizeSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.headlineSizeSlider?.value || '0');
                        }
                    }

                    // Переводим отображаемое значение в модули и сохраняем во внутренних настройках
                    let sizeInMod;
                    if (this.settingsModule.get('fontSizeUnit') === 'pt') {
                        // Конвертируем из пунктов в мм, затем в модули с учетом метрик шрифта
                        const sizeInMm = MathUtils.ptToMm(value);
                        sizeInMod = this.textStyleResolver.fontSizeMmToModules(sizeInMm, 'headline');
                    } else {
                        sizeInMod = value;
                    }
                    sizeInMod = parseFloat(sizeInMod.toFixed(2));
                    this.settingsModule.set('headlineSize', sizeInMod);
                    this.updateGridDebounced();
                }
            },
            lineHeightSlider: {
                valueId: 'lineHeightValue',
                // ВАЖНО: lineHeight всегда храним во ВНУТРЕННЕЙ системе в модулях,
                // а слайдер показывает либо модули, либо пункты в зависимости от lineHeightUnit.
                setting: null,
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('lineHeightSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.lineHeightSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.lineHeightSlider?.value || '0');
                        }
                    }

                    // Переводим отображаемое значение в модули и сохраняем во внутренних настройках
                    let lineHeightInMod;
                    const currentModule = this.settingsModule.get('gridModule');
                    if (this.settingsModule.get('lineHeightUnit') === 'pt') {
                        // Конвертируем из пунктов в мм, затем в модули
                        const lineHeightInMm = MathUtils.ptToMm(value);
                        lineHeightInMod = currentModule > 0 ? lineHeightInMm / currentModule : 0;
                    } else {
                        lineHeightInMod = value;
                    }
                    lineHeightInMod = parseFloat(lineHeightInMod.toFixed(2));
                    this.settingsModule.set('lineHeight', lineHeightInMod);
                    this.updateGridDebounced();
                }
            },
            trackingSlider: {
                valueId: 'trackingValue',
                setting: 'tracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => {
                    this.markAsChanged();
                    this.updateGridDebounced();
                }
            },
            textSizeSlider: {
                valueId: 'textSizeValue',
                setting: null,
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('textSizeSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.textSizeSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.textSizeSlider?.value || '0');
                        }
                    }

                    let sizeInMod;
                    if (this.settingsModule.get('fontSizeUnit') === 'pt') {
                        // Конвертируем из пунктов в мм, затем в модули с учетом метрик шрифта
                        const sizeInMm = MathUtils.ptToMm(value);
                        sizeInMod = this.textStyleResolver.fontSizeMmToModules(sizeInMm, 'text');
                    } else {
                        sizeInMod = value;
                    }
                    sizeInMod = parseFloat(sizeInMod.toFixed(2));
                    this.settingsModule.set('textSize', sizeInMod);
                    this.updateGridDebounced();
                }
            },
            textLineHeightSlider: {
                valueId: 'textLineHeightValue',
                setting: null,
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('textLineHeightSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.textLineHeightSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.textLineHeightSlider?.value || '0');
                        }
                    }

                    let lineHeightInMod;
                    const currentModule = this.settingsModule.get('gridModule');
                    if (this.settingsModule.get('lineHeightUnit') === 'pt') {
                        const lineHeightInMm = MathUtils.ptToMm(value);
                        lineHeightInMod = currentModule > 0 ? lineHeightInMm / currentModule : 0;
                    } else {
                        lineHeightInMod = value;
                    }
                    lineHeightInMod = parseFloat(lineHeightInMod.toFixed(2));
                    this.settingsModule.set('textLineHeight', lineHeightInMod);
                    this.updateGridDebounced();
                }
            },
            textTrackingSlider: {
                valueId: 'textTrackingValue',
                setting: 'textTracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => {
                    this.markAsChanged();
                    this.updateGridDebounced();
                }
            },
            captionSizeSlider: {
                valueId: 'captionSizeValue',
                setting: null,
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('captionSizeSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.captionSizeSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.captionSizeSlider?.value || '0');
                        }
                    }

                    let sizeInMod;
                    if (this.settingsModule.get('fontSizeUnit') === 'pt') {
                        // Конвертируем из пунктов в мм, затем в модули с учетом метрик шрифта
                        const sizeInMm = MathUtils.ptToMm(value);
                        sizeInMod = this.textStyleResolver.fontSizeMmToModules(sizeInMm, 'caption');
                    } else {
                        sizeInMod = value;
                    }
                    sizeInMod = parseFloat(sizeInMod.toFixed(2));
                    this.settingsModule.set('captionSize', sizeInMod);
                    this.updateGridDebounced();
                }
            },
            captionLineHeightSlider: {
                valueId: 'captionLineHeightValue',
                setting: null,
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('captionLineHeightSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.captionLineHeightSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.captionLineHeightSlider?.value || '0');
                        }
                    }

                    let lineHeightInMod;
                    const currentModule = this.settingsModule.get('gridModule');
                    if (this.settingsModule.get('lineHeightUnit') === 'pt') {
                        const lineHeightInMm = MathUtils.ptToMm(value);
                        lineHeightInMod = currentModule > 0 ? lineHeightInMm / currentModule : 0;
                    } else {
                        lineHeightInMod = value;
                    }
                    lineHeightInMod = parseFloat(lineHeightInMod.toFixed(2));
                    this.settingsModule.set('captionLineHeight', lineHeightInMod);
                    this.updateGridDebounced();
                }
            },
            captionTrackingSlider: {
                valueId: 'captionTrackingValue',
                setting: 'captionTracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => {
                    this.markAsChanged();
                    this.updateGridDebounced();
                }
            },
            lunnenDisplaySizeSlider: {
                valueId: 'lunnenDisplaySizeValue',
                setting: null,
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('lunnenDisplaySizeSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.lunnenDisplaySizeSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.lunnenDisplaySizeSlider?.value || '0');
                        }
                    }

                    let sizeInMod;
                    if (this.settingsModule.get('fontSizeUnit') === 'pt') {
                        // Конвертируем из пунктов в мм, затем в модули с учетом метрик шрифта
                        const sizeInMm = MathUtils.ptToMm(value);
                        sizeInMod = this.textStyleResolver.fontSizeMmToModules(sizeInMm, 'lunnenDisplay');
                    } else {
                        sizeInMod = value;
                    }
                    sizeInMod = parseFloat(sizeInMod.toFixed(2));
                    this.settingsModule.set('lunnenDisplaySize', sizeInMod);
                    this.updateGridDebounced();
                }
            },
            lunnenDisplayLineHeightSlider: {
                valueId: 'lunnenDisplayLineHeightValue',
                setting: null,
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('lunnenDisplayLineHeightSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.lunnenDisplayLineHeightSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.lunnenDisplayLineHeightSlider?.value || '0');
                        }
                    }

                    let lineHeightInMod;
                    const currentModule = this.settingsModule.get('gridModule');
                    if (this.settingsModule.get('lineHeightUnit') === 'pt') {
                        const lineHeightInMm = MathUtils.ptToMm(value);
                        lineHeightInMod = currentModule > 0 ? lineHeightInMm / currentModule : 0;
                    } else {
                        lineHeightInMod = value;
                    }
                    lineHeightInMod = parseFloat(lineHeightInMod.toFixed(2));
                    this.settingsModule.set('lunnenDisplayLineHeight', lineHeightInMod);
                    this.updateGridDebounced();
                }
            },
            lunnenDisplayTrackingSlider: {
                valueId: 'lunnenDisplayTrackingValue',
                setting: 'lunnenDisplayTracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => {
                    this.markAsChanged();
                    this.updateGridDebounced();
                }
            }
        };

        // ============================================
        // Settings (Итерация 2: используем Settings модуль)
        // ============================================
        this.settingsModule = new Settings({
            frontWidth: 500,
            frontHeight: 500,
            thickness: 50,
            showLabels: false,
            showSidePanels: true,
            boxColor: '#404040',
            gridModule: 5.0505,
            margins: 2,
            marginsUnit: 'mod',
            fontSizeUnit: 'mod',  // 'mod' или 'pt' для кегля
            lineHeightUnit: 'mod',  // 'mod' или 'pt' для интерлиньяжа (независимо от fontSizeUnit)
            columnCount: 12,
            rowCount: 12,
            rowHeight: 7,
            linkMode: 'module',
            showColumns: true,
            showRows: true,
            showBaseline: true,
            showObjects: true,
            headlineSize: 1.5,
            lineHeight: 2.0,
            tracking: -0.015,
            useXHeight: false,
            headlineFontWeight: 500,
            textSize: 0.5,
            textLineHeight: 1.0,
            textTracking: 0,
            useXHeight2: false,
            textFontWeight: 500,
            // Caption style
            captionSize: 0.5,
            captionLineHeight: 1.0,
            captionTracking: 0,
            useXHeightCaption: false,
            captionFontWeight: 500,
            // Lunnen Display style
            lunnenDisplaySize: 3.0,
            lunnenDisplayLineHeight: 4.0,
            lunnenDisplayTracking: 0,
            useXHeightLunnenDisplay: false
        });
        this.textStyleResolver = new TextStyleResolver(this.settingsModule);

        // ============================================
        // Surface model
        // ============================================
        this.surfaceManager = new SurfaceManager(this.settingsModule);
        this.surfaceManager.initialize('+ New');
        this.surfacePanelController = null;
        this.currentSurfaceLayout = null;
        this.surfaceCoordinates = new SurfaceCoordinateMapper({
            settings: this.settingsModule,
            surfaceManager: this.surfaceManager,
            getLayout: () => this.currentSurfaceLayout,
            clientToSvgPoint: (clientX, clientY) => (
                this.zoomPanManager?.clientToSvgPoint(clientX, clientY) || null
            )
        });
        this.surfaceRenderer = new SurfaceRenderer({
            settings: this.settingsModule,
            surfaceManager: this.surfaceManager,
            sideSurfaces: SIDE_SURFACE_IDS,
            getGridContext: surface => this.surfaceCoordinates.getGridContext(surface),
            createSvgElement: (type, attrs, container) => this.createSVGElement(type, attrs, container),
            getContrastColor: () => this.getContrastColor(),
            getGridOpacity: opacity => this.getGridOpacity(opacity),
            getTextBlocks: () => this.textBlocks || [],
            getGraphicsBlocks: () => this.graphicsBlocks || [],
            drawTextBlock: (...args) => this.drawTextBlock(...args),
            drawGraphicsBlock: (...args) => this.drawGraphicsBlock(...args),
            drawGraphicsBlockForExport: (...args) => this.drawGraphicsBlockForExport(...args)
        });

        // ============================================
        // Grid Calculator (Итерация 3)
        // ============================================
        this.gridCalculator = new GridCalculator(this.settingsModule);
        this.gridSettingsController = new GridSettingsController(this);
        Object.assign(this.SLIDER_CONFIG, this.gridSettingsController.getSliderConfigs());

        // ============================================
        // Grid Renderer (Итерация 4)
        // ============================================
        this.gridRenderer = new GridRenderer(this.settingsModule, this.gridCalculator);

        // ============================================
        // UI Controllers (Итерация 5)
        // ============================================
        // Инициализируем после DOMCache
        this.sliderController = null;
        this.panelManager = null;
        this.zoomPanManager = null;

        // GraphicsRenderer is initialized after the built-in SVG dimensions load.
        this.graphicsRenderer = null;

        // Graphics blocks - UNIFIED array for all graphics (built-in and custom)
        // Initialize if not exists (for backward compatibility)
        if (!this.graphicsBlocks) {
            this.graphicsBlocks = [];
        }

        // Storage for deletion timers to allow cancellation
        this.deletionTimers = {};

        // Undo/Redo history - отдельный HistoryManager для каждого пресета
        this.presetHistories = new Map(); // presetName → HistoryManager
        this.historyManager = new HistoryManager({ maxSize: 50 });

        // SVG content will be loaded from graphics/icons.svg in initializeBuiltInGraphics()
        // Initialize built-in graphics blocks (Icons and Claim)
        // Icons block
        this.graphicsBlocks.push({
            id: 'icons',
            name: 'Icons',
            isBuiltIn: true,  // Flag to identify built-in graphics
            svgContent: '',  // Will be loaded from graphics/icons.svg
            sizeMode: 'height',  // 'width' or 'height'
            heightInModules: 3,
            widthInColumns: 4,  // Will be recalculated based on aspect ratio
            alignment: 'left',  // 'left' or 'right'
            surface: 'front',
            x: 1,
            row: 0,  // Will be calculated
            baselineOffset: 0,  // Will be calculated
            showBounds: false,
            visible: false,
            originalWidth: 204.0944882,
            originalHeight: 28.3464567,
            lockPosition: true  // Constrain to grid bounds by default
        });

        // Claim block
        this.graphicsBlocks.push({
            id: 'claim',
            name: 'Claim',
            isBuiltIn: true,  // Flag to identify built-in graphics
            svgContent: '',  // Will be loaded from graphics/yf_claim.svg
            sizeMode: 'height',  // 'width' or 'height'
            heightInModules: 3,
            widthInColumns: 4,  // Will be recalculated based on aspect ratio
            alignment: 'left',  // 'left' or 'right'
            surface: 'front',
            x: 7,
            row: 0,  // Will be calculated
            baselineOffset: 0,  // Will be calculated
            showBounds: false,
            visible: false,
            originalWidth: 186.2242584,
            originalHeight: 28.3464565,
            lockPosition: true  // Constrain to grid bounds by default
        });

        // Calculate initial positions for built-in graphics
        this.updateBuiltInGraphicsPositions();

        // Text blocks - пустой массив по умолчанию
        this.textBlocks = [];

        // Состояние для drag & drop текстовых блоков
        this.textDragState = {
            kind: null,
            isDragging: false,
            blockId: null,
            startMouseX: 0,
            startMouseY: 0,
            startBlockX: 0,  // позиция блока в колонках
            startBlockY: 0,  // позиция блока в модулях baseline
            frontX: 0,  // координаты front панели для расчетов
            frontY: 0,
            scale: 1
        };

        // Текущий редактируемый блок в панели параграфа
        this.currentEditingBlock = null;

        // Начальное состояние блока (для отмены изменений)
        this.initialBlockState = null;

        // Display constants
        this.PADDING = 60; // padding around the grid (increased for dimensions)

        // ============================================
        // Performance: Debounced/Throttled update methods (Итерация 11)
        // ============================================
        // Debounced версия для слайдеров - откладывает рендеринг до прекращения ввода
        this._debouncedUpdateGridCore = MathUtils.debounce(() => {
            this._updateGridCore();
        }, 16); // ~60fps, достаточно для плавности

        // Throttled версия для drag операций - ограничивает частоту обновлений
        this._throttledUpdateGridCore = MathUtils.throttle(() => {
            this._updateGridCore();
        }, 16); // ~60fps

        // ============================================
        // Cache DOM elements (Итерация 9: DOMCache модуль)
        // ============================================
        this.domCache = new DOMCache().init();
        this.dom = this.domCache.getAll();
        this.objectEditorPanelController = new ObjectEditorPanelController(this);
        this.objectEditorInputController = new ObjectEditorInputController(this);
        this.objectNavigatorController = new ObjectNavigatorController(this);
        this.objectDragController = new ObjectDragController(this);
        this.initTextBlockDrag();
        this.initTextLayout();
        this.initTextRenderer();

        // ============================================
        // Initialize UI Controllers (Итерация 5)
        // ============================================
        this.initUIControllers();
        this.typographyUnitController = new TypographyUnitController({
            settings: this.settingsModule,
            dom: this.dom,
            sliderController: this.sliderController,
            styleResolver: this.textStyleResolver,
            beginAction: label => (
                this.historyManager.beginAction(label, this.getStateSnapshot())
            ),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot()),
            markChanged: () => this.markAsChanged()
        });

        // ============================================
        // SVG Exporter (Итерация 7)
        // ============================================
        this.textToPath = new TextToPath();
        this.svgExporter = new SVGExporter(this.settingsModule, this.textToPath);
        this.presetApplicationController = new PresetApplicationController(this);

        // ============================================
        // Presets (Итерация 10: PresetManager модуль)
        // ============================================
        this.hasUnsavedChanges = false; // Флаг наличия несохраненных изменений
        this.presetManager = new PresetManager({
            dropdownToggle: this.dom.presetDropdownToggle,
            dropdownMenu: this.dom.presetDropdownMenu,
            dropdown: this.dom.presetDropdown,
            onPresetLoad: (data, name) => this.handlePresetLoad(data, name),
            onPresetSelect: (file, name) => {
                this.hasUnsavedChanges = false;
            }
        });
        this.presetManager.init();

        // Предупреждение при закрытии вкладки с несохраненными изменениями
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                // Стандартный диалог браузера
                e.preventDefault();
                e.returnValue = ''; // Для Chrome
                return ''; // Для других браузеров
            }
        });

        // Calculate initial row count to fill the format (after DOM is ready)
        const rowCount = this.gridCalculator.calculateRowCount();
        this.settingsModule.set('rowCount', rowCount);
        this.sliderController.setValue('rowCountSlider', rowCount, false);

        // Update lock buttons state
        this.gridSettingsController.syncLocks();

        // Generate row presets
        this.gridSettingsController.generateRowPresets();

        // Initialize
        this.initEventListeners();
        this.initSurfaceControls();

        // PanelManager - регистрация всех панелей
        this.initPanels();
        console.log('✅ PanelManager initialized with all panels');

        // НЕ сохраняем начальное состояние здесь — SVG иконок, claim и пресет
        // загружаются асинхронно. Первое состояние в истории будет создано
        // автоматически при первом beginAction/commitAction (загрузка пресета).
        this.initCollapsibleSections();

        // Initialize font size unit buttons state
        this.typographyUnitController.sync();
        this.initDropdowns();
        this.initParagraphPanel();
        this.initGraphicsPanel();
        this.initPanelClickOutsideHandler();
        this.initElementsNavigator();
        this.gridSettingsController.updateLinkedControlsVisual();
        this.initColorPreview();
        this.constrainAllObjectsToGrid();
        this.updateCanvasSize();
        this.initEyeIcons();
        this.updateGrid();

        // Автоматический fit to screen при загрузке (с задержкой для отрисовки SVG)
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (this.zoomPanManager) {
                    this.zoomPanManager.fitToScreen();
                }
            }, 100);
        });

        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.updateGrid();
        });
    }

    // Отметить, что были внесены изменения
    markAsChanged() {
        this.hasUnsavedChanges = true;
        if (this.presetManager) {
            this.presetManager.markAsChanged();
        }
    }

    // Сбросить флаг изменений (при загрузке пресета, импорте и т.д.)
    resetChangesFlag() {
        this.hasUnsavedChanges = false;
        this.presetManager?.markAsSaved();
    }

    // Getters for backward compatibility with existing code
    get iconsBlock() {
        return this.graphicsBlocks.find(b => b.id === 'icons');
    }

    set iconsBlock(value) {
        // Setter for backward compatibility (used when setting to null)
        if (value === null) {
            const index = this.graphicsBlocks.findIndex(b => b.id === 'icons');
            if (index !== -1) {
                this.graphicsBlocks.splice(index, 1);
            }
        }
    }

    get claimBlock() {
        return this.graphicsBlocks.find(b => b.id === 'claim');
    }

    set claimBlock(value) {
        // Setter for backward compatibility (used when setting to null)
        if (value === null) {
            const index = this.graphicsBlocks.findIndex(b => b.id === 'claim');
            if (index !== -1) {
                this.graphicsBlocks.splice(index, 1);
            }
        }
    }


    initEventListeners() {
        // ============================================
        // NOTE: Slider initialization moved to initUIControllers()
        // ============================================

        // Show side panels checkbox
        this.dom.showSidePanels.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle side panels', this.getStateSnapshot());
            this.markAsChanged();
            this.surfaceManager.setAllSideVisibility(e.target.checked);
            this.updateEyeIcon(e.target);
            this.syncSurfaceControls();
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        this.gridSettingsController.bind();

        // Show columns checkbox
        this.dom.showColumns.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle columns', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showColumns', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Show rows checkbox
        this.dom.showRows.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle rows', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showRows', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Show baseline checkbox
        this.dom.showBaseline.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle baseline', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showBaseline', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Show objects checkbox
        this.dom.showObjects.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle objects', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showObjects', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Use x-height checkbox
        this.dom.useXHeight.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle x-height', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('useXHeight', e.target.checked);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Use x-height 2 checkbox
        this.dom.useXHeight2.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle x-height 2', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('useXHeight2', e.target.checked);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Use x-height Caption checkbox
        if (this.dom.useXHeightCaption) {
            this.dom.useXHeightCaption.addEventListener('change', (e) => {
                this.historyManager.beginAction('toggle x-height caption', this.getStateSnapshot());
                this.markAsChanged();
                this.settingsModule.set('useXHeightCaption', e.target.checked);
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }


        this.typographyUnitController.bindButtons();

        // Style dropdowns в панели Text Styles - изменяют начертание (font-weight)
        const headlineStyleDropdown = document.getElementById('headlineStyleDropdown');
        const textStyleDropdown = document.getElementById('textStyleDropdown');

        if (headlineStyleDropdown) {
            headlineStyleDropdown.addEventListener('change', (e) => {
                this.historyManager.beginAction('change headline font weight', this.getStateSnapshot());
                this.settingsModule.set('headlineFontWeight', parseInt(e.target.value));
                this.updateElementsNavigator();
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }

        if (textStyleDropdown) {
            textStyleDropdown.addEventListener('change', (e) => {
                this.historyManager.beginAction('change text font weight', this.getStateSnapshot());
                this.settingsModule.set('textFontWeight', parseInt(e.target.value));
                this.updateElementsNavigator();
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }

        const captionStyleDropdown = document.getElementById('captionStyleDropdown');
        if (captionStyleDropdown) {
            captionStyleDropdown.addEventListener('change', (e) => {
                this.historyManager.beginAction('change caption font weight', this.getStateSnapshot());
                this.settingsModule.set('captionFontWeight', parseInt(e.target.value));
                this.updateElementsNavigator();
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }

        // Lunnen Display doesn't have font weight dropdown (always Regular)

        // Color preview button - toggle HSB picker
        this.dom.colorPreview.addEventListener('click', () => {
            const isVisible = this.dom.hsbPicker.style.display !== 'none';
            this.dom.hsbPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.updateHSBFromHex(this.settingsModule.get('boxColor'));
            }
        });

        // Lunnen Blue preset
        this.dom.lunnenBlue.addEventListener('click', () => {
            this.historyManager.beginAction('apply Lunnen Blue color', this.getStateSnapshot());
            this.markAsChanged();
            const lunnenBlueColor = '#2353DB';
            this.settingsModule.set('boxColor', lunnenBlueColor);
            this.dom.hexColorInput.value = lunnenBlueColor;
            this.dom.colorPreview.style.backgroundColor = lunnenBlueColor;
            this.updateHSBFromHex(lunnenBlueColor);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Hex color input - history tracking
        this.dom.hexColorInput.addEventListener('focus', () => {
            this.historyManager.beginAction('edit hex color', this.getStateSnapshot());
        });

        // Hex color input - только форматирование при вводе, без применения изменений
        this.dom.hexColorInput.addEventListener('input', (e) => {
            let hexValue = e.target.value;

            // Remove all # symbols and add one at the start
            hexValue = hexValue.replace(/#/g, '');
            if (hexValue) {
                hexValue = '#' + hexValue;
                e.target.value = hexValue;
            }
        });

        // Обработка Enter для hexColorInput
        this.dom.hexColorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.dom.hexColorInput.blur();
            }
        });

        // Validate hex input when focus is lost
        this.dom.hexColorInput.addEventListener('blur', (e) => {
            let hexValue = e.target.value;

            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                // Если некорректный, берем текущий цвет из настроек вместо дефолтного
                hexValue = this.settingsModule.get('boxColor') || '#dadde6';
            }

            // Проверяем, изменился ли цвет
            const currentColor = this.settingsModule.get('boxColor');
            if (hexValue !== currentColor) {
                this.markAsChanged();
            }

            e.target.value = hexValue;
            this.settingsModule.set('boxColor', hexValue);
            this.dom.colorPreview.style.backgroundColor = hexValue;
            this.updateHSBFromHex(hexValue);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Export button
        this.dom.exportBtn.addEventListener('click', () => this.exportSVG());

        // Export PDF button
        if (this.dom.exportPDFBtn) {
            this.dom.exportPDFBtn.addEventListener('click', () => this.exportPDF());
        }

        // Export Settings button
        this.dom.exportSettingsBtn.addEventListener('click', () => this.exportSettings());

        // Import Settings button (Итерация 7)
        if (this.dom.importSettingsBtn) {
            this.dom.importSettingsBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.importSettings(file);
                    }
                };
                input.click();
            });
        }

        // Help button removed

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd+E / Ctrl+E - Export SVG
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportSVG();
            }
            // Cmd+Z / Ctrl+Z - Undo, Cmd+Shift+Z / Ctrl+Shift+Z - Redo
            // Используем toLowerCase() т.к. при зажатом Shift e.key может быть 'Z' (заглавная)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                // Если пользователь в инпуте — сначала коммитим текущие изменения (blur),
                // а потом выполняем undo/redo
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    activeEl.blur();
                }
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            }
            // Delete / Backspace - Delete selected element
            if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
                // Проверяем, что пользователь не находится в поле ввода
                const activeElement = document.activeElement;
                const isInputFocused = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                if (!isInputFocused) {
                    // Проверяем, есть ли выделенный текстовый блок
                    if (this.currentEditingBlock) {
                        e.preventDefault();
                        const blockId = this.currentEditingBlock.id;
                        const block = this.textBlocks.find(b => b.id === blockId);
                        if (block) {
                            const name = block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '');

                            // Close panel first
                            this.closeParagraphPanel();

                            // Find the delete button in elements list and trigger delete
                            const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                            if (elementButton) {
                                const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                                if (deleteBtn) {
                                    this.startDeleteElement(deleteBtn, 'text', blockId, name);
                                }
                            }
                        }
                    }
                    // Проверяем, есть ли выделенный графический блок
                    else if (this.currentEditingGraphicsId) {
                        e.preventDefault();
                        const blockId = this.currentEditingGraphicsId;
                        const block = this.getGraphicsBlock(blockId);
                        if (block) {
                            const name = block.name || 'Graphic';

                            // Close panel first
                            this.closeGraphicsPanel();

                            // Find the delete button in elements list and trigger delete
                            const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                            if (elementButton) {
                                const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                                if (deleteBtn) {
                                    this.startDeleteElement(deleteBtn, 'graphics', blockId, name);
                                }
                            }
                        }
                    }
                }
            }
        });

        // Initialize panel collapse functionality
        this.initPanelCollapse();
    }


    // ============================================
    // Panel Collapse Functionality
    // ============================================

    /**
     * Инициализация управления отдельными боковыми поверхностями.
     */
    initSurfaceControls() {
        this.surfacePanelController = new SurfacePanelController({
            dom: this.dom,
            surfaceManager: this.surfaceManager,
            sliderController: this.sliderController,
            sideSurfaces: SIDE_SURFACE_IDS,
            onBeginAction: action => this.historyManager.beginAction(action, this.getStateSnapshot()),
            onCommitAction: () => this.historyManager.commitAction(this.getStateSnapshot()),
            onMarkChanged: () => this.markAsChanged(),
            onConstrainObjects: () => this.constrainAllObjectsToGrid(),
            onRender: () => this.updateGrid(),
            onRenderDebounced: () => this.updateGridDebounced(),
            onUpdateEyeIcon: input => this.updateEyeIcon(input)
        });
        this.surfacePanelController.init();
    }

    syncSurfaceControls() {
        this.surfacePanelController?.sync();
    }

    moveBlockToSurface(block, surface) {
        if (!block || !SURFACE_IDS.includes(surface)) return;
        block.surface = surface;
        block.x = 1;
        block.row = 0;
        block.baselineOffset = 0;
        this.constrainAllObjectsToGrid();
        if (this.currentEditingBlock?.id === block.id) {
            if (this.dom.paragraphXInput) this.dom.paragraphXInput.value = 1;
            if (this.dom.paragraphRowInput) this.dom.paragraphRowInput.value = 1;
            if (this.dom.paragraphBaselineInput) this.dom.paragraphBaselineInput.value = 1;
        }
        if (this.currentEditingGraphicsId === block.id) {
            if (this.dom.graphicsXInput) this.dom.graphicsXInput.value = 1;
            if (this.dom.graphicsRowInput) this.dom.graphicsRowInput.value = 1;
            if (this.dom.graphicsBaselineInput) this.dom.graphicsBaselineInput.value = 1;
        }
    }

    initPanelCollapse() {
        // Storage for text styles state
        this.textStylesState = {
            headline: false, // false = collapsed
            text: false,
            caption: false,
            lunnenDisplay: false
        };

        // Find all collapse icons
        const collapseIcons = document.querySelectorAll('.collapse-icon');

        collapseIcons.forEach(icon => {
            const panel = icon.closest('.controls-panel');
            if (!panel) return;

            const header = icon.closest('.panel-header');
            const content = panel.querySelector('.panel-content');

            if (!header || !content) return;

            const isInitiallyCollapsed = panel.classList.contains('panel-collapsed');
            icon.classList.toggle('collapsed', isInitiallyCollapsed);
            icon.setAttribute('aria-expanded', String(!isInitiallyCollapsed));
            icon.setAttribute('aria-label', isInitiallyCollapsed ? 'Expand panel' : 'Collapse panel');

            // Check if panel is bottom-anchored (like elements-navigator and text panel)
            const isBottomAnchored = panel.classList.contains('elements-navigator') || panel.classList.contains('controls-panel-text');

            // Check if this is the text styles panel
            const isTextPanel = panel.classList.contains('controls-panel-text');

            // Store original position for bottom-anchored panels
            if (isBottomAnchored && !panel.dataset.originalTop) {
                // Save the initial top position when panel is first loaded
                const rect = panel.getBoundingClientRect();
                panel.dataset.originalTop = rect.top;
            }

            // Click handler
            const toggleCollapse = (e) => {
                e.stopPropagation(); // Prevent drag from triggering

                const isCollapsed = panel.classList.contains('panel-collapsed');

                if (isCollapsed) {
                    // Expand
                    panel.classList.remove('panel-collapsed');
                    icon.classList.remove('collapsed');
                    icon.setAttribute('aria-label', 'Collapse panel');
                    icon.setAttribute('aria-expanded', 'true');

                    // For bottom-anchored panels, keep the top position (don't switch back to bottom)
                    // This prevents the panel from jumping

                    // Restore text styles state if this is text panel
                    if (isTextPanel) {
                        this.restoreTextStylesState();
                    }
                } else {
                    // Collapse
                    // Save text styles state if this is text panel
                    if (isTextPanel) {
                        this.saveTextStylesState();
                    }

                    // For bottom-anchored panels, switch to top anchor before collapsing
                    if (isBottomAnchored) {
                        const rect = panel.getBoundingClientRect();
                        panel.style.top = `${rect.top}px`;
                        panel.style.bottom = 'auto';
                    }

                    panel.classList.add('panel-collapsed');
                    icon.classList.add('collapsed');
                    icon.setAttribute('aria-label', 'Expand panel');
                    icon.setAttribute('aria-expanded', 'false');
                }

                // Update panel params display
                this.updatePanelParams();
            };

            icon.addEventListener('click', toggleCollapse);

            // Keyboard support
            icon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollapse(e);
                }
            });
        });
    }

    saveTextStylesState() {
        // Save current state of all text style collapsible sections
        const headlineToggle = document.querySelector('#headlineHeader .collapse-toggle');
        const textToggle = document.querySelector('#textHeader .collapse-toggle');
        const captionToggle = document.querySelector('#captionHeader .collapse-toggle');
        const lunnenDisplayToggle = document.querySelector('#lunnenDisplayHeader .collapse-toggle');

        if (headlineToggle) {
            this.textStylesState.headline = headlineToggle.getAttribute('aria-expanded') === 'true';
        }
        if (textToggle) {
            this.textStylesState.text = textToggle.getAttribute('aria-expanded') === 'true';
        }
        if (captionToggle) {
            this.textStylesState.caption = captionToggle.getAttribute('aria-expanded') === 'true';
        }
        if (lunnenDisplayToggle) {
            this.textStylesState.lunnenDisplay = lunnenDisplayToggle.getAttribute('aria-expanded') === 'true';
        }
    }

    restoreTextStylesState() {
        // Restore saved state of all text style collapsible sections
        const headlineToggle = document.querySelector('#headlineHeader .collapse-toggle');
        const textToggle = document.querySelector('#textHeader .collapse-toggle');
        const captionToggle = document.querySelector('#captionHeader .collapse-toggle');
        const lunnenDisplayToggle = document.querySelector('#lunnenDisplayHeader .collapse-toggle');

        const headlineContent = document.getElementById('headlineContent');
        const textContent = document.getElementById('textContent');
        const captionContent = document.getElementById('captionContent');
        const lunnenDisplayContent = document.getElementById('lunnenDisplayContent');

        if (headlineToggle && headlineContent) {
            if (this.textStylesState.headline) {
                headlineToggle.setAttribute('aria-expanded', 'true');
                headlineContent.classList.remove('collapsed');
            } else {
                headlineToggle.setAttribute('aria-expanded', 'false');
                headlineContent.classList.add('collapsed');
            }
        }

        if (textToggle && textContent) {
            if (this.textStylesState.text) {
                textToggle.setAttribute('aria-expanded', 'true');
                textContent.classList.remove('collapsed');
            } else {
                textToggle.setAttribute('aria-expanded', 'false');
                textContent.classList.add('collapsed');
            }
        }

        if (captionToggle && captionContent) {
            if (this.textStylesState.caption) {
                captionToggle.setAttribute('aria-expanded', 'true');
                captionContent.classList.remove('collapsed');
            } else {
                captionToggle.setAttribute('aria-expanded', 'false');
                captionContent.classList.add('collapsed');
            }
        }

        if (lunnenDisplayToggle && lunnenDisplayContent) {
            if (this.textStylesState.lunnenDisplay) {
                lunnenDisplayToggle.setAttribute('aria-expanded', 'true');
                lunnenDisplayContent.classList.remove('collapsed');
            } else {
                lunnenDisplayToggle.setAttribute('aria-expanded', 'false');
                lunnenDisplayContent.classList.add('collapsed');
            }
        }
    }

    // Update panel parameters display in collapsed state
    updatePanelParams() {
        // Grid panel
        const gridParams = document.getElementById('gridParams');
        if (gridParams) {
            const mod = this.settingsModule.get('gridModule').toFixed(2);
            const col = this.settingsModule.get('columnCount');
            const row = this.settingsModule.get('rowCount');
            gridParams.textContent = `Mod ${mod}  •  Col ${col}  •  Row ${row}`;
        }

        // Dimensions panel
        const dimensionsParams = document.getElementById('dimensionsParams');
        if (dimensionsParams) {
            const w = Math.round(this.settingsModule.get('frontWidth'));
            const h = Math.round(this.settingsModule.get('frontHeight'));
            const t = Math.round(this.settingsModule.get('thickness'));
            dimensionsParams.textContent = `${w}\u2009×\u2009${h}\u2009×\u2009${t} mm`;
        }

        // Objects panel
        const objectsParams = document.getElementById('objectsParams');
        if (objectsParams) {
            const textCount = this.textBlocks.length;
            const graphicsCount = this.graphicsBlocks.length;
            objectsParams.textContent = `Txt ${textCount}  •  Obj ${graphicsCount}`;
        }

        // Text styles panel
        const textStylesParams = document.getElementById('textStylesParams');
        if (textStylesParams) {
            const stylesCount = this.getTextStylesCount();
            textStylesParams.textContent = `${stylesCount} styles`;
        }
    }

    getTextStylesCount() {
        if (!Array.isArray(this.textBlocks)) return 0;

        const uniqueStyles = new Set();

        this.textBlocks.forEach(block => {
            if (block.styleRef) {
                uniqueStyles.add(block.styleRef);
            }
        });

        return uniqueStyles.size;
    }

    // ============================================
    // Presets Management (Итерация 10)
    // ============================================

    // Handle preset load from PresetManager
    async handlePresetLoad(data, presetName) {
        return this.presetApplicationController.load(data, presetName);
    }

    syncApplicationUI() {
        const settings = this.settingsModule.getAll();
        this.gridSettingsController.sync(settings);

        const manualSettings = {
            headlineSizeSlider: 'headlineSize',
            lineHeightSlider: 'lineHeight',
            textSizeSlider: 'textSize',
            textLineHeightSlider: 'textLineHeight',
            captionSizeSlider: 'captionSize',
            captionLineHeightSlider: 'captionLineHeight',
            lunnenDisplaySizeSlider: 'lunnenDisplaySize',
            lunnenDisplayLineHeightSlider: 'lunnenDisplayLineHeight'
        };
        const sizeStyles = {
            headlineSize: 'headline',
            textSize: 'text',
            captionSize: 'caption',
            lunnenDisplaySize: 'lunnenDisplay'
        };

        Object.entries(this.SLIDER_CONFIG).forEach(([sliderId, config]) => {
            if (this.gridSettingsController.isGridSlider(sliderId)) return;
            if (config.setting && settings[config.setting] !== undefined) {
                this.sliderController.setValue(sliderId, settings[config.setting], false);
                return;
            }

            const settingKey = manualSettings[sliderId];
            if (!settingKey || settings[settingKey] === undefined) return;
            const isSize = settingKey.endsWith('Size');
            const unit = isSize
                ? (settings.fontSizeUnit || 'mod')
                : (settings.lineHeightUnit || 'mod');
            let displayValue = settings[settingKey];
            if (unit === 'pt') {
                const millimeters = isSize
                    ? this.textStyleResolver.calculateFontSize(sizeStyles[settingKey])
                    : displayValue * settings.gridModule;
                displayValue = MathUtils.mmToPt(millimeters);
            }
            this.sliderController.setValue(
                sliderId,
                Number.parseFloat(displayValue.toFixed(2)),
                false
            );
        });

        if (this.dom.useXHeight) this.dom.useXHeight.checked = settings.useXHeight !== false;
        if (this.dom.useXHeight2) this.dom.useXHeight2.checked = settings.useXHeight2 || false;
        if (this.dom.useXHeightCaption) {
            this.dom.useXHeightCaption.checked = settings.useXHeightCaption || false;
        }

        this.typographyUnitController.syncButtons(settings);
        if (settings.boxColor) {
            if (this.dom.colorPreview) this.dom.colorPreview.style.backgroundColor = settings.boxColor;
            if (this.dom.hexColorInput) this.dom.hexColorInput.value = settings.boxColor;
            this.updateHSBFromHex(settings.boxColor);
        }

        this.gridSettingsController.generateRowPresets();
        this.syncSurfaceControls();
    }

    initColorPreview() {
        // Set initial color preview
        this.dom.colorPreview.style.backgroundColor = this.settingsModule.get('boxColor');
        this.updateHSBFromHex(this.settingsModule.get('boxColor'));
    }

    initCollapsibleSections() {
        // Initialize collapsible sections (like Headline settings)
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');

        collapsibleHeaders.forEach(header => {
            const toggle = header.querySelector('.collapse-toggle');
            const contentId = header.id.replace('Header', 'Content');
            const content = document.getElementById(contentId);

            if (!toggle || !content) return;

            // Handle click on header or toggle button
            const handleToggle = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                const newState = !isExpanded;

                // Update aria-expanded attribute
                toggle.setAttribute('aria-expanded', newState);

                // Toggle collapsed class
                if (newState) {
                    content.classList.remove('collapsed');
                } else {
                    content.classList.add('collapsed');
                }
            };

            // Click on entire header toggles
            header.addEventListener('click', handleToggle);

            // Prevent dragging when clicking on collapsible header
            header.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });
    }

    initDropdowns() {
        // Initialize dropdown menus for value inputs
        const dropdownToggles = document.querySelectorAll('.dropdown-toggle');

        dropdownToggles.forEach(toggle => {
            const targetId = toggle.getAttribute('data-target');
            const dropdown = document.getElementById(targetId);

            if (!dropdown) return;

            // Get the input field (sibling of toggle)
            const container = toggle.closest('.value-input-with-dropdown');
            const input = container.querySelector('.value-display');
            const sliderId = input.id.replace('Value', 'Slider');

            // Toggle dropdown on button click
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();

                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                    if (menu !== dropdown) {
                        menu.classList.remove('active');
                    }
                });

                // Toggle this dropdown
                dropdown.classList.toggle('active');

                // Update selected state
                this.updateDropdownSelection(dropdown, input.value);
            });

            // Handle item selection
            const items = dropdown.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.historyManager.beginAction(`select ${sliderId} dropdown`, this.getStateSnapshot());
                    const value = parseFloat(item.getAttribute('data-value'));

                    // Update slider using universal method
                    this.updateSliderValue(sliderId, value);

                    // Close dropdown
                    dropdown.classList.remove('active');
                    this.historyManager.commitAction(this.getStateSnapshot());
                });
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.value-input-with-dropdown')) {
                document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                    menu.classList.remove('active');
                });
            }
        });

        // Initialize font weight dropdowns in Text Styles panel
        const headlineStyleDropdown = document.getElementById('headlineStyleDropdown');
        const textStyleDropdown = document.getElementById('textStyleDropdown');

        if (headlineStyleDropdown) {
            headlineStyleDropdown.value = this.settingsModule.get('headlineFontWeight').toString();
        }

        if (textStyleDropdown) {
            textStyleDropdown.value = this.settingsModule.get('textFontWeight').toString();
        }
    }

    updateDropdownSelection(dropdown, currentValue) {
        // Update selected state for dropdown items
        const items = dropdown.querySelectorAll('.dropdown-item');
        const numValue = parseFloat(currentValue);

        items.forEach(item => {
            const itemValue = parseFloat(item.getAttribute('data-value'));
            if (Math.abs(itemValue - numValue) < 0.01) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Инициализация панели настроек параграфа
    initParagraphPanel() {
        // ===== History: focus/blur обработчики для инпутов текстовых блоков =====
        // Группируют все изменения (набор текста, стрелки) в одно действие
        const textBlockInputIds = [
            'paragraphXInput', 'paragraphRowInput', 'paragraphBaselineInput', 'paragraphWidthInput'
        ];
        textBlockInputIds.forEach(inputId => {
            const input = this.dom[inputId];
            if (input) {
                input.addEventListener('focus', () => {
                    this.historyManager.beginAction(`edit text block ${inputId}`, this.getStateSnapshot());
                });
                input.addEventListener('blur', () => {
                    this.historyManager.commitAction(this.getStateSnapshot());
                });
            }
        });

        // Обработчики изменений параметров
        if (this.dom.paragraphXInput) {
            this.dom.paragraphXInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.markAsChanged();
                    let newX = parseInt(this.dom.paragraphXInput.value);
                    const surface = this.currentEditingBlock.surface || 'front';
                    const { columnCount } = this.getSurfaceGridContext(surface);

                    // Ограничиваем X в зависимости от alignment
                    const alignment = this.currentEditingBlock.alignment || 'left';
                    if (alignment === 'right') {
                        // For right-aligned: минимум = ceil(width), максимум = columnCount
                        const minX = Math.ceil(this.currentEditingBlock.width);
                        newX = Math.max(minX, Math.min(newX, columnCount));
                    } else {
                        // For left-aligned: минимум = 1, максимум зависит от ширины
                        newX = Math.max(1, Math.min(newX, columnCount));
                    }

                    // Устанавливаем новое значение X
                    this.currentEditingBlock.x = newX;

                    // Корректируем width если блок выходит за пределы
                    if (alignment === 'right') {
                        // For right-aligned: block grows left, so max width = x
                        if (this.currentEditingBlock.width > this.currentEditingBlock.x) {
                            this.currentEditingBlock.width = Math.max(0.25, this.currentEditingBlock.x);
                            this.dom.paragraphWidthInput.value = this.currentEditingBlock.width.toFixed(2);
                        }
                    } else {
                        // For left-aligned: block grows right
                        // x начинается с 1, поэтому последняя занятая колонка = x + width - 1
                        if (this.currentEditingBlock.x + this.currentEditingBlock.width - 1 > columnCount) {
                            this.currentEditingBlock.width = Math.max(0.25, columnCount - this.currentEditingBlock.x + 1);
                            this.dom.paragraphWidthInput.value = this.currentEditingBlock.width.toFixed(2);
                        }
                    }

                    // Обновляем отображение X (на случай коррекции), округляем до целого
                    this.dom.paragraphXInput.value = Math.round(this.currentEditingBlock.x);
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphXInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'x', 'paragraphXInput');
            });
        }

        if (this.dom.paragraphRowInput) {
            this.dom.paragraphRowInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.markAsChanged();
                    const newRow = parseInt(this.dom.paragraphRowInput.value) - 1;
                    const surface = this.currentEditingBlock.surface || 'front';
                    const context = this.getSurfaceGridContext(surface);

                    // Calculate max allowed row based on content height and text block height
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции: первая строка блока должна быть
                    // в пределах контентной области. Остальное (lineHeight) может выходить за поля.
                    const maxY = maxYInBaseline - 1;

                    // Calculate Y position from row (baselineOffset всегда сбрасывается в 0)
                    const rowHeight = context.rowHeight;
                    const yPos = newRow * (rowHeight + 1);

                    // Constrain Y
                    const constrainedY = Math.max(0, Math.min(yPos, maxY));

                    // При изменении Row всегда ставим объект на первый baseline новой row
                    // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
                    const rowWithGutter = rowHeight + 1;
                    const finalRow = Math.floor(constrainedY / rowWithGutter);

                    this.currentEditingBlock.row = Math.max(0, finalRow);
                    this.currentEditingBlock.baselineOffset = 0; // Всегда на первый baseline в row
                    this.dom.paragraphRowInput.value = this.currentEditingBlock.row + 1;

                    // Update baseline input if needed
                    if (this.dom.paragraphBaselineInput) {
                        const globalBaseline = this.rowBaselineToY(this.currentEditingBlock.row, this.currentEditingBlock.baselineOffset, surface);
                        this.dom.paragraphBaselineInput.value = globalBaseline + 1;
                    }

                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphRowInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'row', 'paragraphRowInput');
            });
        }

        if (this.dom.paragraphBaselineInput) {
            this.dom.paragraphBaselineInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.markAsChanged();
                    const globalBaseline = parseInt(this.dom.paragraphBaselineInput.value) - 1;
                    const surface = this.currentEditingBlock.surface || 'front';
                    const context = this.getSurfaceGridContext(surface);

                    // Calculate max allowed baseline based on content height and text block height
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции первой строки
                    const maxY = maxYInBaseline - 1;

                    // Constrain baseline
                    const constrainedBaseline = Math.max(0, Math.min(globalBaseline, maxY));

                    // Преобразуем глобальный номер baseline в row и baselineOffset
                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.yToRowBaseline(constrainedBaseline, surface);

                    this.currentEditingBlock.row = Math.max(0, newRow);
                    this.currentEditingBlock.baselineOffset = newBaselineOffset;

                    // Обновляем отображение (на случай коррекции)
                    const correctedGlobalBaseline = this.rowBaselineToY(this.currentEditingBlock.row, this.currentEditingBlock.baselineOffset, surface);
                    this.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.dom.paragraphRowInput.value = this.currentEditingBlock.row + 1;

                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphBaselineInput.addEventListener('keydown', (e) => {
                if (this.currentEditingBlock && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    const globalBaseline = parseInt(this.dom.paragraphBaselineInput.value) - 1;
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    const step = e.shiftKey ? 10 : 1;
                    let newGlobalBaseline = globalBaseline + delta * step;
                    const surface = this.currentEditingBlock.surface || 'front';
                    const context = this.getSurfaceGridContext(surface);

                    // Calculate max allowed baseline
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции первой строки
                    const maxY = maxYInBaseline - 1;

                    newGlobalBaseline = Math.max(0, Math.min(newGlobalBaseline, maxY));

                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.yToRowBaseline(newGlobalBaseline, surface);
                    this.currentEditingBlock.row = Math.max(0, newRow);
                    this.currentEditingBlock.baselineOffset = newBaselineOffset;

                    // Обновляем отображение с правильным значением
                    const correctedGlobalBaseline = this.rowBaselineToY(this.currentEditingBlock.row, this.currentEditingBlock.baselineOffset, surface);
                    this.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.dom.paragraphRowInput.value = this.currentEditingBlock.row + 1;
                    this.updateGrid();
                }
            });
        }

        if (this.dom.paragraphWidthInput) {
            this.dom.paragraphWidthInput.addEventListener('change', () => {
                this.markAsChanged();
                if (this.currentEditingBlock) {
                    const newWidth = parseFloat(this.dom.paragraphWidthInput.value);
                    const alignment = this.currentEditingBlock.alignment || 'left';
                    const { columnCount } = this.getSurfaceGridContext(this.currentEditingBlock.surface || 'front');

                    // Округляем до ближайшего кратного 0.25
                    const roundedWidth = Math.round(newWidth * 4) / 4;

                    // Max width depends on alignment
                    let maxWidth;
                    if (alignment === 'right') {
                        // For right-aligned: max width = x (block grows left from column x)
                        maxWidth = this.currentEditingBlock.x;
                    } else {
                        // For left-aligned: max width = columns available to the right
                        maxWidth = columnCount - this.currentEditingBlock.x + 1;
                    }

                    this.currentEditingBlock.width = Math.max(0.25, Math.min(roundedWidth, maxWidth));
                    this.dom.paragraphWidthInput.value = this.currentEditingBlock.width.toFixed(2);

                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphWidthInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'width', 'paragraphWidthInput');
            });
        }

        // Обработчик для текстового поля - изменения применяются только при blur или Enter
        if (this.dom.paragraphTextArea) {
            // Обработка клавиш для принудительных переносов и неразрывных пробелов
            this.dom.paragraphTextArea.addEventListener('keydown', (e) => {
                // Shift+Enter или Shift+Space - принудительный перенос строки (\n)
                if ((e.key === 'Enter' || e.key === ' ') && e.shiftKey) {
                    e.preventDefault();
                    const textarea = e.target;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;

                    // Вставляем \n в позицию курсора
                    textarea.value = text.substring(0, start) + '\n' + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                    this.updateCharCounter();
                }
                // Option+Space (Alt+Space на Windows/Linux) - неразрывный пробел (\u00A0)
                else if (e.key === ' ' && (e.altKey || e.metaKey)) {
                    e.preventDefault();
                    const textarea = e.target;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;

                    // Вставляем неразрывный пробел в позицию курсора
                    textarea.value = text.substring(0, start) + '\u00A0' + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                    this.updateCharCounter();
                }
                // Обычный Enter без Shift - закрываем редактор
                else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.dom.paragraphTextArea.blur();
                }
            });

            // Применение изменений при потере фокуса
            this.dom.paragraphTextArea.addEventListener('blur', () => {
                if (this.currentEditingBlock) {
                    this.currentEditingBlock.content = this.dom.paragraphTextArea.value;
                    this.updateCharCounter();
                    this.updateGrid();
                }
            });
        }

        // Кнопки быстрой вставки текстовых пресетов
        this.initTextPresetChips();

        // Обработчик для дропдауна стиля текста
        if (this.dom.paragraphStyleSelect) {
            this.dom.paragraphStyleSelect.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.currentEditingBlock.styleRef = this.dom.paragraphStyleSelect.value;

                    // Показываем/скрываем секцию настроек Lunnen Display
                    const lunnenDisplayFeaturesSection = document.getElementById('lunnenDisplayFeaturesSection');
                    if (lunnenDisplayFeaturesSection) {
                        if (this.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            lunnenDisplayFeaturesSection.style.display = 'block';
                        } else {
                            lunnenDisplayFeaturesSection.style.display = 'none';
                        }
                    }

                    // Показываем/скрываем Alignment Mode (для Lunnen Display не показываем)
                    const alignmentModeSection = document.querySelector('#paragraphPanel .control-group:has([name="alignmentMode"])');
                    if (alignmentModeSection) {
                        if (this.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            alignmentModeSection.style.display = 'none';
                        } else {
                            alignmentModeSection.style.display = 'block';
                        }
                    }

                    this.updateElementsNavigator();
                    this.updateGrid();
                }
            });
        }

        // Обработчик для дропдауна выбора поверхности (текст)
        if (this.dom.paragraphSurfaceSelect) {
            this.dom.paragraphSurfaceSelect.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.historyManager.beginAction('move text to surface', this.getStateSnapshot());
                    this.moveBlockToSurface(this.currentEditingBlock, this.dom.paragraphSurfaceSelect.value);
                    this.markAsChanged();
                    this.updateElementsNavigator();
                    this.updateGrid();
                    this.historyManager.commitAction(this.getStateSnapshot());
                }
            });
        }

        // Обработчик для кнопки Hide
        const paragraphHideBtn = document.getElementById('paragraphHideBtn');
        if (paragraphHideBtn) {
            paragraphHideBtn.addEventListener('click', () => {
                if (this.currentEditingBlock) {
                    this.toggleElementVisibility('text', this.currentEditingBlock.id);
                    // Update button icon based on visibility
                    const block = this.textBlocks.find(b => b.id === this.currentEditingBlock.id);
                    if (block) {
                        const svg = paragraphHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                // Show hide icon (eye with slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                // Show visible icon (eye without slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            });
        }

        // Обработчик для кнопки Duplicate
        const paragraphDuplicateBtn = document.getElementById('paragraphDuplicateBtn');
        if (paragraphDuplicateBtn) {
            paragraphDuplicateBtn.addEventListener('click', () => {
                if (this.currentEditingBlock) {
                    this.duplicateElement('text', this.currentEditingBlock.id);
                }
            });
        }

        // Обработчик для кнопки Delete
        const paragraphDeleteBtn = document.getElementById('paragraphDeleteBtn');
        if (paragraphDeleteBtn) {
            paragraphDeleteBtn.addEventListener('click', () => {
                if (this.currentEditingBlock) {
                    const blockId = this.currentEditingBlock.id;
                    const block = this.textBlocks.find(b => b.id === blockId);
                    if (block) {
                        const name = block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '');

                        // Close panel first
                        this.closeParagraphPanel();

                        // Find the delete button in elements list and trigger delete
                        const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                        if (elementButton) {
                            const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                            if (deleteBtn) {
                                this.startDeleteElement(deleteBtn, 'text', blockId, name);
                            }
                        }
                    }
                }
            });
        }

        // Обработчики для режима выравнивания (Alignment Mode)
        if (this.dom.alignmentModeBaseline) {
            this.dom.alignmentModeBaseline.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.alignmentModeBaseline.checked) {
                    this.currentEditingBlock.alignmentMode = 'baseline';
                    this.updateGrid();
                }
            });
        }

        if (this.dom.alignmentModeXHeight) {
            this.dom.alignmentModeXHeight.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.alignmentModeXHeight.checked) {
                    this.currentEditingBlock.alignmentMode = 'x-height';
                    this.updateGrid();
                }
            });
        }

        if (this.dom.alignmentModeCapHeight) {
            this.dom.alignmentModeCapHeight.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.alignmentModeCapHeight.checked) {
                    this.currentEditingBlock.alignmentMode = 'cap-height';
                    this.updateGrid();
                }
            });
        }

        // Обработчик для Constrain to Grid toggle
        if (this.dom.paragraphLockPositionToggle) {
            this.dom.paragraphLockPositionToggle.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.currentEditingBlock.lockPosition = this.dom.paragraphLockPositionToggle.checked;
                    this.updateGrid();
                }
            });
        }

        // Обработчик для Align Right toggle
        if (this.dom.paragraphAlignRightToggle) {
            this.dom.paragraphAlignRightToggle.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const wasRight = this.currentEditingBlock.alignment === 'right';
                    const nowRight = this.dom.paragraphAlignRightToggle.checked;

                    // Adjust X position to keep block visually in the same place
                    if (nowRight && !wasRight) {
                        // Switching from left to right alignment
                        // X should move right by (width - 1) columns
                        // Example: X=7, width=3, left → X=9, width=3, right (occupies columns 7,8,9 in both cases)
                        const widthInColumns = Math.ceil(this.currentEditingBlock.width);
                        this.currentEditingBlock.x += (widthInColumns - 1);

                        // Update input display
                        if (this.dom.paragraphXInput) {
                            this.dom.paragraphXInput.value = this.currentEditingBlock.x;
                        }
                    } else if (!nowRight && wasRight) {
                        // Switching from right to left alignment
                        // X should move left by (width - 1) columns
                        const widthInColumns = Math.ceil(this.currentEditingBlock.width);
                        this.currentEditingBlock.x -= (widthInColumns - 1);

                        // Ensure X doesn't go below 1
                        this.currentEditingBlock.x = Math.max(1, this.currentEditingBlock.x);

                        // Update input display
                        if (this.dom.paragraphXInput) {
                            this.dom.paragraphXInput.value = this.currentEditingBlock.x;
                        }
                    }

                    this.currentEditingBlock.alignment = nowRight ? 'right' : 'left';
                    this.updateGrid();
                }
            });
        }

        // Обработчики для Text Alignment radio buttons
        if (this.dom.textAlignmentLeft) {
            this.dom.textAlignmentLeft.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.textAlignmentLeft.checked) {
                    this.currentEditingBlock.textAlign = 'left';
                    this.updateGrid();
                }
            });
        }

        if (this.dom.textAlignmentCenter) {
            this.dom.textAlignmentCenter.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.textAlignmentCenter.checked) {
                    this.currentEditingBlock.textAlign = 'center';
                    this.updateGrid();
                }
            });
        }

        if (this.dom.textAlignmentRight) {
            this.dom.textAlignmentRight.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.textAlignmentRight.checked) {
                    this.currentEditingBlock.textAlign = 'right';
                    this.updateGrid();
                }
            });
        }

        // Обработчик для weight slider (Lunnen Display)
        const lunnenDisplayWeightSlider = document.getElementById('lunnenDisplayWeightSlider');
        const lunnenDisplayWeightValue = document.getElementById('lunnenDisplayWeightValue');
        if (lunnenDisplayWeightSlider && lunnenDisplayWeightValue) {
            // Обновление значения при изменении слайдера
            lunnenDisplayWeightSlider.addEventListener('input', () => {
                if (this.currentEditingBlock) {
                    const weight = parseInt(lunnenDisplayWeightSlider.value);
                    lunnenDisplayWeightValue.value = weight;
                    this.currentEditingBlock.fontWeight = weight;
                    this.updateGrid();
                }
            });

            // Обновление слайдера при изменении текстового поля - применяется при blur или Enter
            lunnenDisplayWeightValue.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    lunnenDisplayWeightValue.blur();
                }
            });

            lunnenDisplayWeightValue.addEventListener('blur', () => {
                if (this.currentEditingBlock) {
                    let weight = parseInt(lunnenDisplayWeightValue.value);
                    weight = Math.max(100, Math.min(400, weight));
                    lunnenDisplayWeightValue.value = weight;
                    lunnenDisplayWeightSlider.value = weight;
                    this.currentEditingBlock.fontWeight = weight;
                    this.updateGrid();
                }
            });
        }

        // Обработчики для OpenType features checkboxes
        const featureCheckboxes = [
            { id: 'featureSalt', key: 'salt' },
            { id: 'featureAalt', key: 'aalt' },
            { id: 'featureSs01', key: 'ss01' },
            { id: 'featureSs02', key: 'ss02' },
            { id: 'featureTnum', key: 'tnum' },
            { id: 'featureDlig', key: 'dlig' }
        ];

        featureCheckboxes.forEach(({ id, key }) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (this.currentEditingBlock) {
                        if (!this.currentEditingBlock.fontFeatures) {
                            this.currentEditingBlock.fontFeatures = {
                                salt: false,
                                aalt: false,
                                ss01: false,
                                ss02: false,
                                tnum: false,
                                dlig: false
                            };
                        }
                        this.currentEditingBlock.fontFeatures[key] = checkbox.checked;
                        this.updateGrid();
                    }
                });
            }
        });

        // Graphics Lock Position toggle
        if (this.dom.graphicsLockPositionToggle) {
            this.dom.graphicsLockPositionToggle.addEventListener('change', () => {
                const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                if (block) {
                    block.lockPosition = this.dom.graphicsLockPositionToggle.checked;
                    this.updateGrid();
                }
            });
        }

        // Graphics Align Right toggle
        if (this.dom.graphicsAlignRightToggle) {
            this.dom.graphicsAlignRightToggle.addEventListener('change', () => {
                const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                if (block) {
                    const wasRight = block.alignment === 'right';
                    const nowRight = this.dom.graphicsAlignRightToggle.checked;

                    // Don't adjust X position - just change alignment mode
                    // The rendering code will handle positioning correctly based on alignment
                    block.alignment = nowRight ? 'right' : 'left';
                    this.updateGrid();
                }
            });
        }
    }

    initTextPresetChips() {
        const container = document.getElementById('textPresetChips');
        if (!container) return;

        const plusSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

        TEXT_PRESETS.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'text-preset-chip';
            btn.type = 'button';
            btn.setAttribute('aria-label', `Insert text: ${preset.label}`);
            btn.innerHTML = `${plusSvg}<span>${preset.label}</span>`;

            btn.addEventListener('click', () => {
                if (!this.currentEditingBlock || !this.dom.paragraphTextArea) return;

                this.historyManager.beginAction(`insert text preset: ${preset.label}`, this.getStateSnapshot());
                this.markAsChanged();

                this.dom.paragraphTextArea.value = preset.text;
                this.currentEditingBlock.content = preset.text;
                this.updateCharCounter();
                this.updateGrid();

                this.historyManager.commitAction(this.getStateSnapshot());
            });

            container.appendChild(btn);
        });
    }

    // Обновить счетчик символов
    updateCharCounter() {
        if (this.dom.charCounter && this.dom.paragraphTextArea) {
            const count = this.dom.paragraphTextArea.value.length;
            const plural = count === 1 ? 'character' : 'characters';
            this.dom.charCounter.textContent = `${count} ${plural}`;
        }
    }

    // Ограничить позиции элементов в пределах сетки
    constrainElementsToBounds() {
        this.textBlocks.forEach(block => this.constrainBlockToSurface(block, 'text'));
        (this.graphicsBlocks || []).forEach(block => this.constrainBlockToSurface(block, 'graphics'));
    }

    constrainBlockToSurface(block, type) {
        if (!block || !block.lockPosition) return;
        const surface = block.surface || 'front';
        const context = this.getSurfaceGridContext(surface);
        const module = context.gridModule;
        const margins = context.margins;
        const columnCount = context.columnCount;
        const rowHeight = context.rowHeight;
        const contentHeightMm = Math.max(module, context.frontHeight - 2 * margins * module);
        const maxYInBaseline = Math.max(1, Math.floor(contentHeightMm / module + 1e-9));

        block.surface = surface;
        block.baselineOffset = Math.max(0, Math.min(rowHeight, Number(block.baselineOffset) || 0));

        if (type === 'text') {
            block.width = Math.max(0.25, Math.min(Number(block.width) || 1, columnCount));
            const alignment = block.alignment || 'left';
            const minX = alignment === 'right' ? Math.ceil(block.width) : 1;
            const maxX = alignment === 'right'
                ? columnCount
                : Math.max(1, columnCount - block.width + 1);
            block.x = Math.max(minX, Math.min(Number(block.x) || 1, maxX));
        } else {
            const columnWidth = Math.max(
                module * 0.1,
                (context.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount
            );
            let widthInColumns = Number(block.widthInColumns) || 1;
            if (block.sizeMode !== 'width') {
                const aspectRatio = block.originalWidth && block.originalHeight
                    ? block.originalWidth / block.originalHeight
                    : 1;
                const widthInMm = module * (Number(block.heightInModules) || 3) * aspectRatio;
                widthInColumns = Math.max(1, (widthInMm + module) / (columnWidth + module));
            }
            const maxX = Math.max(1, Math.floor(columnCount - widthInColumns) + 1);
            block.x = Math.max(1, Math.min(Number(block.x) || 1, maxX));
        }

        const elementHeight = type === 'graphics' ? Number(block.heightInModules) || 3 : 1;
        const maxY = Math.max(0, maxYInBaseline - elementHeight);
        const currentY = this.getBlockY(block);
        const constrainedY = Math.max(0, Math.min(currentY, maxY));
        const rowPosition = this.yToRowBaseline(constrainedY, surface);
        block.row = Math.max(0, Math.min(context.rowCount - 1, rowPosition.row));
        block.baselineOffset = Math.max(0, Math.min(rowHeight, rowPosition.baselineOffset));
    }

    // Инициализация панели настроек иконок
    initGraphicsInputsWithArrows() {
        this.objectEditorInputController.initGraphicsInputs();
    }

    // Обработка стрелок клавиатуры для числовых полей
    handleArrowKeysForInput(event, property, inputId) {
        this.objectEditorInputController.handleTextArrow(event, property, inputId);
    }

    // Показать панель настроек параграфа
    showParagraphPanel(blockId) {
        const block = this.getTextBlock(blockId);
        if (!block) return;

        this.currentEditingBlock = block;

        // Сохраняем начальное состояние блока для возможности отмены
        this.saveInitialBlockState(block);

        // Устанавливаем заголовок панели с названием из контента
        if (this.dom.paragraphPanelTitle) {
            let displayName = block.content.trim().substring(0, 24);
            if (block.content.trim().length > 24) {
                displayName = displayName + '...';
            }
            // Если текст пустой, используем стандартное имя
            if (!displayName) {
            const styleName = this.getStyleDisplayName(block.styleRef);
            const blockNumber = this.getBlockNumber(blockId);
            const formattedNumber = blockNumber.toString().padStart(2, '0');
                displayName = `${styleName} ${formattedNumber}`;
            }
            this.dom.paragraphPanelTitle.textContent = displayName;
        }

        // Заполняем поля панели
        if (this.dom.paragraphStyleSelect) {
            // Дропдаун управляет стилем текста (headline/text)
            this.dom.paragraphStyleSelect.value = block.styleRef || 'text';
        }
        if (this.dom.paragraphSurfaceSelect) {
            // Дропдаун управляет выбором поверхности
            this.dom.paragraphSurfaceSelect.value = block.surface || 'front';
        }
        if (this.dom.paragraphXInput) {
            // Column всегда целое число - текст привязывается к левому краю колонки
            this.dom.paragraphXInput.value = Math.round(block.x);
        }
        if (this.dom.paragraphRowInput) {
            this.dom.paragraphRowInput.value = block.row + 1;
        }
        if (this.dom.paragraphBaselineInput) {
            // Показываем глобальный номер baseline на всей сетке (с учетом гутеров между rows)
            const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset, block.surface || 'front');
            this.dom.paragraphBaselineInput.value = globalBaseline + 1;
        }
        if (this.dom.paragraphWidthInput) {
            this.dom.paragraphWidthInput.value = typeof block.width === 'number' ? block.width.toFixed(2) : block.width;
        }
        if (this.dom.paragraphTextArea) {
            this.dom.paragraphTextArea.value = block.content;
        }

        // Показываем/скрываем Alignment Mode в зависимости от стиля
        // Для Lunnen Display не показываем (нет строчных букв)
        const alignmentModeSection = document.querySelector('#paragraphPanel .control-group:has([name="alignmentMode"])');
        if (alignmentModeSection) {
            if (block.styleRef === 'lunnenDisplay') {
                alignmentModeSection.style.display = 'none';
            } else {
                alignmentModeSection.style.display = 'block';

                // Устанавливаем режим выравнивания (по умолчанию baseline)
                const alignmentMode = block.alignmentMode || 'baseline';
                if (this.dom.alignmentModeBaseline && this.dom.alignmentModeXHeight && this.dom.alignmentModeCapHeight) {
                    if (alignmentMode === 'x-height') {
                        this.dom.alignmentModeXHeight.checked = true;
                        this.dom.alignmentModeBaseline.checked = false;
                        this.dom.alignmentModeCapHeight.checked = false;
                    } else if (alignmentMode === 'cap-height') {
                        this.dom.alignmentModeCapHeight.checked = true;
                        this.dom.alignmentModeBaseline.checked = false;
                        this.dom.alignmentModeXHeight.checked = false;
                    } else {
                        this.dom.alignmentModeBaseline.checked = true;
                        this.dom.alignmentModeXHeight.checked = false;
                        this.dom.alignmentModeCapHeight.checked = false;
                    }
                }
            }
        }

        // Устанавливаем состояние Lock Position toggle
        if (this.dom.paragraphLockPositionToggle) {
            this.dom.paragraphLockPositionToggle.checked = block.lockPosition || false;
        }

        // Устанавливаем состояние Align Right toggle
        if (this.dom.paragraphAlignRightToggle) {
            this.dom.paragraphAlignRightToggle.checked = block.alignment === 'right';
        }

        // Устанавливаем состояние Text Alignment radio buttons
        const textAlign = block.textAlign || 'left';
        if (this.dom.textAlignmentLeft) {
            this.dom.textAlignmentLeft.checked = textAlign === 'left';
        }
        if (this.dom.textAlignmentCenter) {
            this.dom.textAlignmentCenter.checked = textAlign === 'center';
        }
        if (this.dom.textAlignmentRight) {
            this.dom.textAlignmentRight.checked = textAlign === 'right';
        }

        // Обновляем счетчик символов
        this.updateCharCounter();

        // Показываем/скрываем секцию настроек Lunnen Display в зависимости от выбранного стиля
        const lunnenDisplayFeaturesSection = document.getElementById('lunnenDisplayFeaturesSection');
        if (lunnenDisplayFeaturesSection) {
            if (block.styleRef === 'lunnenDisplay') {
                lunnenDisplayFeaturesSection.style.display = 'block';

                // Устанавливаем значения для weight slider
                const weightSlider = document.getElementById('lunnenDisplayWeightSlider');
                const weightValue = document.getElementById('lunnenDisplayWeightValue');
                if (weightSlider && weightValue) {
                    const weight = block.fontWeight || 400;
                    weightSlider.value = weight;
                    weightValue.value = weight;
                }

                // Устанавливаем значения для OpenType features checkboxes
                const features = block.fontFeatures || {
                    salt: false,
                    aalt: false,
                    ss01: false,
                    ss02: false,
                    tnum: false,
                    dlig: false
                };

                document.getElementById('featureSalt').checked = features.salt || false;
                document.getElementById('featureAalt').checked = features.aalt || false;
                document.getElementById('featureSs01').checked = features.ss01 || false;
                document.getElementById('featureSs02').checked = features.ss02 || false;
                document.getElementById('featureTnum').checked = features.tnum || false;
                document.getElementById('featureDlig').checked = features.dlig || false;
            } else {
                lunnenDisplayFeaturesSection.style.display = 'none';
            }
        }

        // Устанавливаем правильную иконку для кнопки Hide/Show
        const paragraphHideBtn = document.getElementById('paragraphHideBtn');
        if (paragraphHideBtn) {
            const svg = paragraphHideBtn.querySelector('svg');
            if (svg) {
                if (block.visible) {
                    // Show hide icon (eye with slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                } else {
                    // Show visible icon (eye without slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                }
            }
        }

        // Показываем панель и позиционируем рядом с элементом
        if (this.dom.paragraphPanel) {
            this.dom.paragraphPanel.style.display = 'flex';
            this.dom.paragraphPanel.classList.add('active');
            this.positionPanelNextToBlock(this.dom.paragraphPanel, blockId, 'text');
        }
    }

    // Сохранить начальное состояние блока
    saveInitialBlockState(block) {
        this.objectEditorPanelController.saveInitialTextState(block);
    }

    // Отменить изменения и закрыть панель
    cancelParagraphChanges() {
        this.objectEditorPanelController.cancelTextChanges();
    }

    // Закрыть панель настроек параграфа
    closeParagraphPanel() {
        this.objectEditorPanelController.closeTextPanel();
    }

    // Show Graphics Upload Panel
    showGraphicsPanel() {
        this.objectEditorPanelController.openNewGraphicsPanel();
    }

    // Close Graphics Upload Panel
    closeGraphicsPanel() {
        this.objectEditorPanelController.closeGraphicsPanel();
    }

    // Initialize Graphics Panel
    initGraphicsPanel() {
        if (this.dom.graphicsSurfaceSelect) {
            this.dom.graphicsSurfaceSelect.addEventListener('change', () => {
                const block = this.getGraphicsBlock(this.currentEditingGraphicsId);
                if (!block) return;
                this.historyManager.beginAction('move graphics to surface', this.getStateSnapshot());
                this.moveBlockToSurface(block, this.dom.graphicsSurfaceSelect.value);
                this.initGraphicsInputsWithArrows();
                this.markAsChanged();
                this.updateElementsNavigator();
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }

        // File upload area click handler
        if (this.dom.fileUploadArea) {
            this.dom.fileUploadArea.addEventListener('click', () => {
                if (this.dom.svgFileInput) {
                    this.dom.svgFileInput.click();
                }
            });

            // Drag and drop handlers
            this.dom.fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dom.fileUploadArea.classList.add('dragover');
            });

            this.dom.fileUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dom.fileUploadArea.classList.remove('dragover');
            });

            this.dom.fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dom.fileUploadArea.classList.remove('dragover');

                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type === 'image/svg+xml') {
                    this.handleSvgFile(files[0]);
                }
            });
        }

        // File input change handler
        if (this.dom.svgFileInput) {
            this.dom.svgFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleSvgFile(e.target.files[0]);
                }
            });
        }

        // Hide button handler
        const graphicsHideBtn = document.getElementById('graphicsHideBtn');
        if (graphicsHideBtn) {
            graphicsHideBtn.addEventListener('click', () => {
                if (this.currentEditingGraphicsId) {
                    this.toggleElementVisibility('graphics', this.currentEditingGraphicsId);
                    // Update button icon based on visibility
                    const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                    if (block) {
                        const svg = graphicsHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                // Show hide icon (eye with slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                // Show visible icon (eye without slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            });
        }

        // Duplicate button handler
        const graphicsDuplicateBtn = document.getElementById('graphicsDuplicateBtn');
        if (graphicsDuplicateBtn) {
            graphicsDuplicateBtn.addEventListener('click', () => {
                if (this.currentEditingGraphicsId) {
                    const block = this.getGraphicsBlock(this.currentEditingGraphicsId);
                    if (block) {
                        // Determine element type
                        let elementType = 'graphics';
                        if (block.isBuiltIn) {
                            if (block.id === 'icons') elementType = 'icons';
                            else if (block.id === 'claim') elementType = 'claim';
                        }
                        this.duplicateElement(elementType, this.currentEditingGraphicsId);
                    }
                }
            });
        }

        // Delete button handler
        const graphicsDeleteBtn = document.getElementById('graphicsDeleteBtn');
        if (graphicsDeleteBtn) {
            graphicsDeleteBtn.addEventListener('click', () => {
                if (this.currentEditingGraphicsId) {
                    const blockId = this.currentEditingGraphicsId;
                    const block = this.getGraphicsBlock(blockId);
                    if (block) {
                        const name = block.name || 'Graphic';

                        // Close panel first
                        this.closeGraphicsPanel();

                        // Find the delete button in elements list and trigger delete
                        const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                        if (elementButton) {
                            const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                            if (deleteBtn) {
                                this.startDeleteElement(deleteBtn, 'graphics', blockId, name);
                            }
                        }
                    }
                }
            });
        }

        // Size mode radio buttons handler
        if (this.dom.graphicsSizeModeWidth && this.dom.graphicsSizeModeHeight) {
            const handleSizeModeChange = () => {
                if (!this.currentEditingGraphicsId) return;

                const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                if (!block) return;

                // Update sizeMode
                block.sizeMode = this.dom.graphicsSizeModeWidth.checked ? 'width' : 'height';

                // Show/hide width or height input based on sizeMode
                if (this.dom.graphicsWidthGroup) {
                    this.dom.graphicsWidthGroup.style.display = block.sizeMode === 'width' ? 'flex' : 'none';
                }
                if (this.dom.graphicsHeightGroup) {
                    this.dom.graphicsHeightGroup.style.display = block.sizeMode === 'height' ? 'flex' : 'none';
                }

                // Если переключились на режим по ширине, нужно рассчитать widthInColumns из текущих размеров
                if (block.sizeMode === 'width') {
                    const module = this.settingsModule.get('gridModule');
                    const aspectRatio = block.originalWidth / block.originalHeight;
                    const heightInMm = module * block.heightInModules;
                    const widthInMm = heightInMm * aspectRatio;
                    block.widthInColumns = parseFloat(this.mmToColumns(widthInMm).toFixed(2));
                    if (this.dom.graphicsWidthInput) {
                        this.dom.graphicsWidthInput.value = block.widthInColumns.toFixed(2);
                    }
                } else {
                    // Если переключились на режим по высоте, нужно рассчитать heightInModules из текущих размеров
                    const module = this.settingsModule.get('gridModule');
                    const aspectRatio = block.originalWidth / block.originalHeight;
                    const widthInMm = this.columnsToMm(block.widthInColumns);
                    const heightInMm = widthInMm / aspectRatio;
                    block.heightInModules = parseFloat((heightInMm / module).toFixed(2));
                    if (this.dom.graphicsHeightInput) {
                        this.dom.graphicsHeightInput.value = block.heightInModules.toFixed(2);
                    }
                }

                this.updateGrid();
            };

            this.dom.graphicsSizeModeWidth.addEventListener('change', handleSizeModeChange);
            this.dom.graphicsSizeModeHeight.addEventListener('change', handleSizeModeChange);
        }
    }

    // Initialize click outside handler for closing panels
    initPanelClickOutsideHandler() {
        this.objectEditorPanelController.initOutsideClickHandler();
    }

    // Load and process SVG file (same as handleSvgFile but for file paths)
    // Works over HTTP and tries XMLHttpRequest as fallback for file:// protocol
    async loadAndProcessSvg(filePath) {
        try {
            let svgContent = null;

            // Try fetch first (works over HTTP)
        try {
            const response = await fetch(filePath);
                if (response.ok) {
                    svgContent = await response.text();
                }
            } catch (fetchError) {
                // If fetch fails (e.g., file:// protocol), try XMLHttpRequest
                // Note: XMLHttpRequest also doesn't work with file:// in most browsers
                console.log(`Fetch failed for ${filePath}, trying XMLHttpRequest...`);
                try {
                    svgContent = await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', filePath, true);
                        xhr.onload = () => {
                            if (xhr.status === 0 || xhr.status === 200) {
                                resolve(xhr.responseText);
                            } else {
                                reject(new Error(`XMLHttpRequest failed with status ${xhr.status}`));
                            }
                        };
                        xhr.onerror = () => reject(new Error('XMLHttpRequest failed'));
                        xhr.send();
                    });
                } catch (xhrError) {
                    // Both fetch and XMLHttpRequest failed - likely file:// protocol
                    const isFileProtocol = window.location.protocol === 'file:';
                    if (isFileProtocol) {
                        console.warn(`Cannot load ${filePath} via file:// protocol. Please use a local HTTP server or open via http://localhost`);
                    }
                    throw fetchError; // Re-throw original error
                }
            }

            if (!svgContent) {
                console.warn(`Could not load ${filePath} - file may not exist or protocol not supported`);
                return null;
            }

            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');

            if (svgElement) {
                // Extract viewBox or width/height
                const viewBox = svgElement.getAttribute('viewBox');
                let width, height;

                if (viewBox) {
                    const [, , w, h] = viewBox.split(' ').map(parseFloat);
                    width = w;
                    height = h;
                } else {
                    width = parseFloat(svgElement.getAttribute('width')) || 100;
                    height = parseFloat(svgElement.getAttribute('height')) || 100;
                }

                // Extract inner content FIRST (before processing colors)
                let innerContent = svgElement.innerHTML;

                // Process inner content to replace fill colors with currentColor (same as handleSvgFile)
                // Replace all fill attributes with currentColor (except 'none')
                innerContent = innerContent.replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"');
                innerContent = innerContent.replace(/fill='(?!none)[^']*'/gi, "fill='currentColor'");

                // Replace stroke colors with currentColor (except 'none')
                innerContent = innerContent.replace(/stroke="(?!none)[^"]*"/gi, 'stroke="currentColor"');
                innerContent = innerContent.replace(/stroke='(?!none)[^']*'/gi, "stroke='currentColor'");

                // Replace fill in style attributes (be careful not to match path d attributes)
                // Only match fill: in style attributes, not in path data
                innerContent = innerContent.replace(/style="([^"]*)"/gi, (match, styleContent) => {
                    const processed = styleContent
                        .replace(/fill:\s*(?!none)[^;"}]+/gi, 'fill: currentColor')
                        .replace(/stroke:\s*(?!none)[^;"}]+/gi, 'stroke: currentColor');
                    return `style="${processed}"`;
                });

                // Process style elements separately
                innerContent = innerContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styleText) => {
                    const processed = styleText
                        .replace(/fill:\s*(?!none)[^;"}]+/gi, 'fill: currentColor')
                        .replace(/stroke:\s*(?!none)[^;"}]+/gi, 'stroke: currentColor');
                    return match.replace(styleText, processed);
                });

                // Replace class names in paths to use currentColor (for claim and icons)
                // Determine which class to use based on file path
                const isIcons = filePath.includes('icons.svg');
                const className = isIcons ? 'icon-fill' : 'claim-fill';

                // Replace .st0, .st1, etc. with appropriate class
                innerContent = innerContent.replace(/class="st\d+"/gi, `class="${className}"`);
                innerContent = innerContent.replace(/class='st\d+'/gi, `class='${className}'`);

                // Ensure appropriate style is present in defs
                if (innerContent.includes(className) && !innerContent.includes(`.${className}`)) {
                    // Add style if not present
                    const fillStyle = `<defs>
    <style>
      .${className} {
        fill: currentColor;
      }
    </style>
  </defs>`;
                    // Check if defs already exists
                    if (innerContent.includes('<defs>')) {
                        // Add style to existing defs
                        innerContent = innerContent.replace(/<defs>([\s\S]*?)<\/defs>/gi, (match, defsContent) => {
                            if (!defsContent.includes(`.${className}`)) {
                                return `<defs>${defsContent}
    <style>
      .${className} {
        fill: currentColor;
      }
    </style>
  </defs>`;
                            }
                            return match;
                        });
                    } else {
                        // Add defs with style at the beginning
                        innerContent = fillStyle + innerContent;
                    }
                }

                return {
                    width,
                    height,
                    content: innerContent
                };
            }
        } catch (error) {
            console.error(`Error loading SVG from ${filePath}:`, error);
        }
        return null;
    }

    // Handle SVG file upload
    handleSvgFile(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const svgContent = e.target.result;
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');

            if (svgElement) {
                // Extract viewBox or width/height
                const viewBox = svgElement.getAttribute('viewBox');
                let width, height;

                if (viewBox) {
                    const [, , w, h] = viewBox.split(' ').map(parseFloat);
                    width = w;
                    height = h;
                } else {
                    width = parseFloat(svgElement.getAttribute('width')) || 100;
                    height = parseFloat(svgElement.getAttribute('height')) || 100;
                }

                // Process SVG content to replace fill colors with currentColor
                let processedContent = svgContent;

                // Replace all fill attributes with currentColor (except 'none')
                // This regex matches fill="..." but not fill="none"
                processedContent = processedContent.replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"');
                processedContent = processedContent.replace(/fill='(?!none)[^']*'/gi, "fill='currentColor'");

                // Replace stroke colors with currentColor (except 'none')
                processedContent = processedContent.replace(/stroke="(?!none)[^"]*"/gi, 'stroke="currentColor"');
                processedContent = processedContent.replace(/stroke='(?!none)[^']*'/gi, "stroke='currentColor'");

                // Replace fill in style attributes
                processedContent = processedContent.replace(/fill:\s*(?!none)[^;"}]+/gi, 'fill: currentColor');
                processedContent = processedContent.replace(/stroke:\s*(?!none)[^;"}]+/gi, 'stroke: currentColor');

                // Replace class names in paths to use currentColor (for claim and icons)
                // Replace .st0, .st1, etc. with claim-fill or icon-fill classes
                processedContent = processedContent.replace(/class="st\d+"/gi, 'class="claim-fill"');
                processedContent = processedContent.replace(/class='st\d+'/gi, "class='claim-fill'");

                // Extract inner content for processing (remove outer SVG tags)
                const parser2 = new DOMParser();
                const svgDoc2 = parser2.parseFromString(processedContent, 'image/svg+xml');
                const svgElement2 = svgDoc2.querySelector('svg');
                let innerContent = svgElement2 ? svgElement2.innerHTML : processedContent;

                // Ensure claim-fill style is present in defs
                if (innerContent.includes('claim-fill') && !innerContent.includes('.claim-fill')) {
                    // Add claim-fill style if not present
                    const claimFillStyle = `<defs>
    <style>
      .claim-fill {
        fill: currentColor;
      }
    </style>
  </defs>`;
                    // Check if defs already exists
                    if (innerContent.includes('<defs>')) {
                        // Add style to existing defs
                        innerContent = innerContent.replace(/<defs>([\s\S]*?)<\/defs>/gi, (match, defsContent) => {
                            if (!defsContent.includes('.claim-fill')) {
                                return `<defs>${defsContent}
    <style>
      .claim-fill {
        fill: currentColor;
      }
    </style>
  </defs>`;
                            }
                            return match;
                        });
                    } else {
                        // Add defs with style at the beginning
                        innerContent = claimFillStyle + innerContent;
                    }
                    processedContent = innerContent;
                }

                // Store uploaded SVG data
                this.uploadedSvgData = {
                    content: processedContent,
                    name: file.name.replace('.svg', ''),
                    width: width,
                    height: height
                };

                // Update UI to show file is loaded
                const placeholder = this.dom.fileUploadArea.querySelector('.upload-placeholder p');
                if (placeholder) {
                    placeholder.textContent = `✓ ${file.name}`;
                }

                // If editing existing graphics block, update it immediately
                if (this.currentEditingGraphicsId) {
                    const block = this.getGraphicsBlock(this.currentEditingGraphicsId);
                    if (block) {
                        // Update the block with new SVG data (works for all graphics including built-in)
                        block.svgContent = processedContent;
                        block.name = this.uploadedSvgData.name;
                        block.originalWidth = width;
                        block.originalHeight = height;

                        // Update panel title
                        if (this.dom.graphicsPanelTitle) {
                            let displayName = block.name || 'Graphic';
                            if (displayName.length > 24) {
                                displayName = displayName.substring(0, 24) + '...';
                            }
                            this.dom.graphicsPanelTitle.textContent = displayName;
                        }

                        // Update placeholder text
                        if (placeholder) {
                            placeholder.textContent = `Current: ${block.name || 'Graphic'} — Upload new SVG to replace`;
                        }

                        // Update elements list
                        this.updateElementsNavigator();

                        // Render updated graphics
                        this.updateGrid();

                        console.log('Graphics block updated with new SVG');
                    }
                } else {
                    // Creating NEW graphics block - automatically create it
                    console.log('Creating new graphics block from uploaded SVG');
                    this.addGraphicsBlock(
                        processedContent,
                        this.uploadedSvgData.name,
                        width,
                        height
                    );

                    // Close the panel after creating
                    this.closeGraphicsPanel();
                }
            }
        };

        reader.readAsText(file);
    }

    // ============================================
    // Color methods (Итерация 8: обертки удалены, используем ColorUtils напрямую)
    // ============================================

    updateHSBFromHex(hex) {
        const rgb = ColorUtils.hexToRgb(hex);
        if (rgb) {
            const hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
            this.dom.hueSlider.value = hsb.h;
            this.dom.saturationSlider.value = hsb.s;
            this.dom.brightnessSlider.value = hsb.b;
            this.dom.hueValue.value = hsb.h;
            this.dom.saturationValue.value = hsb.s;
            this.dom.brightnessValue.value = hsb.b;
            this.updateSaturationGradient();
            this.updateBrightnessGradient();
        }
    }

    updateColorFromHSB() {
        this.markAsChanged();
        const h = parseInt(this.dom.hueSlider.value);
        const s = parseInt(this.dom.saturationSlider.value);
        const b = parseInt(this.dom.brightnessSlider.value);

        const rgb = ColorUtils.hsbToRgb(h, s, b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);

        this.settingsModule.set('boxColor', hex);
        this.dom.hexColorInput.value = hex;
        this.dom.colorPreview.style.backgroundColor = hex;
        this.updateGrid();
    }

    updateSaturationGradient() {
        const h = parseInt(this.dom.hueSlider.value);
        const b = parseInt(this.dom.brightnessSlider.value);

        const leftColor = ColorUtils.hsbToRgb(h, 0, b);
        const rightColor = ColorUtils.hsbToRgb(h, 100, b);

        const leftHex = ColorUtils.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = ColorUtils.rgbToHex(rightColor.r, rightColor.g, rightColor.b);

        const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        // Применяем градиент к широким дорожкам через динамические стили для псевдоэлементов
        this.updateSliderWideTrackGradient('saturationSlider', gradient);
    }

    updateBrightnessGradient() {
        const h = parseInt(this.dom.hueSlider.value);
        const s = parseInt(this.dom.saturationSlider.value);

        const leftColor = ColorUtils.hsbToRgb(h, s, 0);
        const rightColor = ColorUtils.hsbToRgb(h, s, 100);

        const leftHex = ColorUtils.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = ColorUtils.rgbToHex(rightColor.r, rightColor.g, rightColor.b);

        const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        // Применяем градиент к широким дорожкам через динамические стили для псевдоэлементов
        this.updateSliderWideTrackGradient('brightnessSlider', gradient);
    }

    updateSliderWideTrackGradient(sliderId, gradient) {
        // Remove existing style if present
        let styleId = `${sliderId}-wide-track-style`;
        let existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new style element для широких дорожек (высота 10px вместо 1px)
        // Центрируем ползунок: (10px - 8px) / 2 = 1px
        // Используем конкретное значение 8px вместо CSS переменной для надежности
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${sliderId}::-webkit-slider-runnable-track {
                background: ${gradient} !important;
                height: 10px !important;
            }
            #${sliderId}::-moz-range-track {
                background: ${gradient} !important;
                height: 10px !important;
            }
            #${sliderId}::-webkit-slider-thumb {
                width: 8px !important;
                height: 8px !important;
                margin-top: 1px !important;
            }
            #${sliderId}::-moz-range-thumb {
                width: 8px !important;
                height: 8px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // Universal method to update slider value based on configuration
    updateSliderValue(sliderId, newValue) {
        this.sliderController.setValue(sliderId, newValue, true);
    }

    getDecimalsFromStep(step) {
        return this.sliderController.getDecimalsFromStep(step);
    }

    updateCanvasSize() {
        // Calculate canvas size based on viewport height
        const viewportHeight = window.innerHeight;
        const topBottomPadding = 40; // 20px padding on each side
        this.DISPLAY_SIZE = viewportHeight - topBottomPadding;
    }

    constrainAllObjectsToGrid() {
        this.textBlocks.forEach(block => this.constrainBlockToSurface(block, 'text'));
        (this.graphicsBlocks || []).forEach(block => this.constrainBlockToSurface(block, 'graphics'));
    }

    // Получить текстовый блок по ID
    getTextBlock(id) {
        return this.textBlocks.find(block => block.id === id);
    }

    // Получить номер блока (для отображения в UI)
    getBlockNumber(blockId) {
        // Группируем блоки по styleRef и считаем номер внутри группы
        const block = this.getTextBlock(blockId);
        if (!block) return 1;

        const blocksWithSameStyle = this.textBlocks.filter(b => b.styleRef === block.styleRef);
        const index = blocksWithSameStyle.findIndex(b => b.id === blockId);
        return (index >= 0 ? index : 0) + 1;
    }

    // Получить название стиля для отображения
    getStyleDisplayName(styleRef) {
        switch(styleRef) {
            case 'headline':
                return 'Headline';
            case 'text':
                return 'Text';
            case 'caption':
                return 'Caption';
            case 'lunnenDisplay':
                return 'Lunnen Display';
            default:
                return styleRef.charAt(0).toUpperCase() + styleRef.slice(1);
        }
    }

    getStyleFontWeight(styleRef) {
        // Возвращаем начертание (Medium или Regular) вместо стиля
        switch(styleRef) {
            case 'headline':
                return this.settingsModule.get('headlineFontWeight') === 500 ? 'Medium' : 'Regular';
            case 'text':
                return this.settingsModule.get('textFontWeight') === 500 ? 'Medium' : 'Regular';
            case 'caption':
                return this.settingsModule.get('captionFontWeight') === 500 ? 'Medium' : 'Regular';
            case 'lunnenDisplay':
                return 'Regular'; // Lunnen Display always Regular
            default:
                return 'Medium';
        }
    }

    // ============================================
    // Graphics Helpers (Path 3 Refactoring)
    // ============================================

    // Получить графический блок по ID
    getGraphicsBlock(id) {
        return this.graphicsBlocks?.find(b => b.id === id);
    }

    // Получить все встроенные графические блоки
    getBuiltInGraphicsBlocks() {
        return this.graphicsBlocks?.filter(b => b.isBuiltIn) || [];
    }

    // Получить все кастомные графические блоки
    getCustomGraphicsBlocks() {
        return this.graphicsBlocks?.filter(b => !b.isBuiltIn) || [];
    }

    // Получить все видимые графические блоки
    getVisibleGraphicsBlocks() {
        return this.graphicsBlocks?.filter(b => b.visible !== false) || [];
    }

    // Проверить, является ли блок встроенным
    isBuiltInGraphics(blockIdOrBlock) {
        if (typeof blockIdOrBlock === 'string') {
            const block = this.getGraphicsBlock(blockIdOrBlock);
            return block ? block.isBuiltIn === true : false;
        }
        return blockIdOrBlock?.isBuiltIn === true;
    }

    getSurfaceGridContext(surface = 'front') {
        return this.surfaceCoordinates.getGridContext(surface);
    }

    // Конвертировать Row + BaselineOffset в Y (позиция в baseline модулях)
    rowBaselineToY(row, baselineOffset, surface = 'front') {
        return this.surfaceCoordinates.rowBaselineToY(row, baselineOffset, surface);
    }

    // Конвертировать Y (позиция в baseline модулях) в Row + BaselineOffset
    yToRowBaseline(y, surface = 'front') {
        return this.surfaceCoordinates.yToRowBaseline(y, surface);
    }

    // Получить Y позицию блока в baseline модулях
    getBlockY(block) {
        return this.surfaceCoordinates.getBlockY(block);
    }

    getSurfacePointer(clientX, clientY) {
        return this.surfaceCoordinates.getSurfacePointer(clientX, clientY);
    }

    getBlockPointerOffset(block, clientX, clientY) {
        const pointer = this.getSurfacePointer(clientX, clientY);
        if (!pointer || pointer.surface !== (block.surface || 'front')) return { x: 0, y: 0 };
        const context = pointer.context;
        const position = this.textLayout.calculateBlockPosition(block, 1);
        return {
            x: pointer.local.x - position.x,
            y: pointer.local.y - (position.y + context.gridModule * context.margins)
        };
    }

    positionBlockAtPointer(block, clientX, clientY, type, offset = { x: 0, y: 0 }) {
        const pointer = this.getSurfacePointer(clientX, clientY);
        if (!pointer) return false;
        const { context, surface } = pointer;
        const module = context.gridModule;
        const margin = module * context.margins;
        const columnWidth = Math.max(
            module * 0.1,
            (context.frontWidth - 2 * margin - (context.columnCount - 1) * module) / context.columnCount
        );
        const localX = pointer.local.x - offset.x;
        const localY = pointer.local.y - offset.y;

        block.surface = surface;
        block.x = Math.round((localX - margin) / (columnWidth + module)) + 1;
        const yInBaseline = Math.round((localY - margin) / module);
        const rowPosition = this.yToRowBaseline(Math.max(0, yInBaseline), surface);
        block.row = rowPosition.row;
        block.baselineOffset = rowPosition.baselineOffset;
        this.constrainBlockToSurface(block, type);

        if (type === 'text' && this.currentEditingBlock?.id === block.id) {
            if (this.dom.paragraphSurfaceSelect) this.dom.paragraphSurfaceSelect.value = surface;
            if (this.dom.paragraphXInput) this.dom.paragraphXInput.value = Math.round(block.x);
            if (this.dom.paragraphRowInput) this.dom.paragraphRowInput.value = block.row + 1;
            if (this.dom.paragraphBaselineInput) {
                this.dom.paragraphBaselineInput.value = this.rowBaselineToY(block.row, block.baselineOffset, surface) + 1;
            }
        }
        if (type === 'graphics' && this.currentEditingGraphicsId === block.id) {
            if (this.dom.graphicsSurfaceSelect) this.dom.graphicsSurfaceSelect.value = surface;
            if (this.dom.graphicsXInput) this.dom.graphicsXInput.value = Math.round(block.x);
            if (this.dom.graphicsRowInput) this.dom.graphicsRowInput.value = block.row + 1;
            if (this.dom.graphicsBaselineInput) {
                this.dom.graphicsBaselineInput.value = this.rowBaselineToY(block.row, block.baselineOffset, surface) + 1;
            }
        }
        return true;
    }

    // Конвертировать колонки в мм
    columnsToMm(columns, surface = 'front') {
        return this.surfaceCoordinates.columnsToMm(columns, surface);
    }

    // Конвертировать мм в колонки
    mmToColumns(widthMm, surface = 'front') {
        return this.surfaceCoordinates.mmToColumns(widthMm, surface);
    }

    // Пересчитать ширину графического блока из высоты (для нормализации при загрузке пресетов)
    recalculateGraphicsWidthFromHeight(block) {
        if (!block.originalWidth || !block.originalHeight) {
            // Если нет оригинальных размеров, используем дефолтное значение
            block.widthInColumns = 4;
            return;
        }

        const context = this.getSurfaceGridContext(block.surface || 'front');
        const module = context.gridModule;
        const aspectRatio = block.originalWidth / block.originalHeight;
        const heightInMm = module * (block.heightInModules || 3);
        const widthInMm = heightInMm * aspectRatio;
        block.widthInColumns = parseFloat(this.mmToColumns(widthInMm, block.surface || 'front').toFixed(2));
    }

    // Draw text block on canvas and in export SVG
    drawTextBlock(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        return this.textRenderer.draw(
            container, block, frontX, frontY, frontWidth, frontHeight, scale
        );
    }

    // Draw graphics block on canvas
    drawGraphicsBlock(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        return this.graphicsRenderer?.draw(
            container, block, frontX, frontY, frontWidth, frontHeight, scale
        );
    }

    // Show Graphics Edit Panel for existing graphics
    showGraphicsEditPanel(blockId) {
        const block = this.graphicsBlocks?.find(b => b.id === blockId);
        if (!block) return;

        // Initialize sizeMode if not set (for backward compatibility)
        if (!block.sizeMode) {
            block.sizeMode = 'height';
        }

        // Initialize widthInColumns if not set (for backward compatibility with old presets)
        if (block.widthInColumns === undefined || block.widthInColumns === null) {
            const surface = block.surface || 'front';
            const module = this.getSurfaceGridContext(surface).gridModule;
            const aspectRatio = block.originalWidth / block.originalHeight;
            const heightInMm = module * (block.heightInModules || 3);
            const widthInMm = heightInMm * aspectRatio;
            block.widthInColumns = parseFloat(this.mmToColumns(widthInMm, surface).toFixed(2));
        }

        // Set panel title
        if (this.dom.graphicsPanelTitle) {
            let displayName = block.name || 'Graphic';
            if (displayName.length > 24) {
                displayName = displayName.substring(0, 24) + '...';
            }
            this.dom.graphicsPanelTitle.textContent = displayName;
        }

        // Fill panel fields
        if (this.dom.graphicsSurfaceSelect) {
            this.dom.graphicsSurfaceSelect.value = block.surface || 'front';
        }
        if (this.dom.graphicsXInput) {
            this.dom.graphicsXInput.value = block.x;
        }
        if (this.dom.graphicsRowInput) {
            this.dom.graphicsRowInput.value = block.row + 1;
        }
        if (this.dom.graphicsBaselineInput) {
            const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset, block.surface || 'front');
            this.dom.graphicsBaselineInput.value = globalBaseline + 1;
        }

        // Set size mode radio buttons
        if (this.dom.graphicsSizeModeWidth && this.dom.graphicsSizeModeHeight) {
            if (block.sizeMode === 'width') {
                this.dom.graphicsSizeModeWidth.checked = true;
            } else {
                this.dom.graphicsSizeModeHeight.checked = true;
            }
        }

        // Show/hide width or height input based on sizeMode
        if (this.dom.graphicsWidthGroup) {
            this.dom.graphicsWidthGroup.style.display = block.sizeMode === 'width' ? 'flex' : 'none';
        }
        if (this.dom.graphicsHeightGroup) {
            this.dom.graphicsHeightGroup.style.display = block.sizeMode === 'height' ? 'flex' : 'none';
        }

        if (this.dom.graphicsWidthInput) {
            this.dom.graphicsWidthInput.value = (block.widthInColumns || 4).toFixed(2);
        }
        if (this.dom.graphicsHeightInput) {
            this.dom.graphicsHeightInput.value = (block.heightInModules || 3).toFixed(2);
        }

        if (this.dom.graphicsLockPositionToggle) {
            this.dom.graphicsLockPositionToggle.checked = block.lockPosition || false;
        }

        if (this.dom.graphicsAlignRightToggle) {
            this.dom.graphicsAlignRightToggle.checked = block.alignment === 'right';
        }

        // Show file upload area with updated placeholder
        if (this.dom.fileUploadArea) {
            this.dom.fileUploadArea.style.display = 'block';
            const placeholder = this.dom.fileUploadArea.querySelector('.upload-placeholder p');
            if (placeholder) {
                placeholder.textContent = `Current: ${block.name || 'Graphic'} — Upload new SVG to replace`;
            }
        }

        // Update action button icons and visibility
        const graphicsHideBtn = document.getElementById('graphicsHideBtn');
        const graphicsDeleteBtn = document.getElementById('graphicsDeleteBtn');

        if (graphicsHideBtn) {
            // Update hide icon based on visibility
            const svg = graphicsHideBtn.querySelector('svg');
            if (svg) {
                if (block.visible) {
                    // Show hide icon (eye with slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                } else {
                    // Show visible icon (eye without slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                }
            }
        }

        if (graphicsDeleteBtn) {
            // Show delete button for all graphics (including built-in)
            graphicsDeleteBtn.style.display = 'flex';
        }

        // Также показываем/скрываем кнопку скрытия (она работает для всех типов)
        if (graphicsHideBtn) {
            graphicsHideBtn.style.display = 'flex';
        }

        // Center and show panel
        if (this.dom.graphicsPanel) {
            this.dom.graphicsPanel.style.display = 'flex';
            this.dom.graphicsPanel.classList.add('active');
            this.positionPanelNextToBlock(this.dom.graphicsPanel, blockId, 'graphics');
        }

        // Store current editing block ID
        this.currentEditingGraphicsId = blockId;

        // Initialize input handlers with arrow key support
        this.initGraphicsInputsWithArrows();
    }

    centerPanel(panelElement) {
        if (!panelElement) return;

        const padding = 16;
        const panelRect = panelElement.getBoundingClientRect();
        const panelWidth = panelRect.width || panelElement.offsetWidth || 0;
        const panelHeight = panelRect.height || panelElement.offsetHeight || 0;

        const availableWidth = window.innerWidth - panelWidth - padding;
        const availableHeight = window.innerHeight - panelHeight - padding;

        const left = Math.max(
            padding,
            Math.min((window.innerWidth - panelWidth) / 2, availableWidth)
        );
        const top = Math.max(
            padding,
            Math.min((window.innerHeight - panelHeight) / 2, availableHeight)
        );

        panelElement.style.left = `${Math.round(left)}px`;
        panelElement.style.top = `${Math.round(top)}px`;
        panelElement.style.transform = 'none';
    }

    positionPanelNextToBlock(panelElement, blockId, type = 'graphics') {
        if (!panelElement) return;

        const targetRect = this.getBlockViewportRect(blockId, type);
        if (!targetRect) {
            this.centerPanel(panelElement);
            return;
        }

        const padding = 16;
        const offset = 24;
        const bottomMargin = 80; // Минимальный отступ от нижнего края окна
        const panelRect = panelElement.getBoundingClientRect();
        const panelWidth = panelRect.width || panelElement.offsetWidth || 0;
        const panelHeight = panelRect.height || panelElement.offsetHeight || 0;

        const maxLeft = window.innerWidth - panelWidth - padding;
        const maxTop = window.innerHeight - panelHeight - padding;

        let left = targetRect.right + offset;
        let top = targetRect.top;

        // Проверка горизонтального позиционирования
        if (left > maxLeft) {
            left = targetRect.left - panelWidth - offset;
        }

        left = Math.max(padding, Math.min(left, maxLeft));

        // Проверка вертикального позиционирования с учетом bottomMargin
        // Вычисляем максимальную позицию top так, чтобы нижняя граница панели
        // не опускалась ниже bottomMargin от нижнего края окна
        const maxBottomTop = window.innerHeight - panelHeight - bottomMargin;

        // Сначала применяем стандартное ограничение
        top = Math.max(padding, Math.min(top, maxTop));

        // Затем применяем ограничение по bottomMargin (только если оно строже)
        if (top > maxBottomTop) {
            top = Math.max(padding, maxBottomTop);
        }

        panelElement.style.left = `${Math.round(left)}px`;
        panelElement.style.top = `${Math.round(top)}px`;
        panelElement.style.transform = 'none';
    }

    getBlockViewportRect(blockId, type = 'graphics') {
        if (!blockId) return null;

        if (type === 'text') {
            const bounds = document.getElementById(`bounds-${blockId}`);
            if (bounds) return bounds.getBoundingClientRect();

            const hoverArea = document.getElementById(`hover-area-${blockId}`);
            if (hoverArea) return hoverArea.getBoundingClientRect();

            return null;
        }

        const specialGroups = {
            icons: 'icons-group',
            claim: 'claim-group'
        };

        const specialGroupId = specialGroups[blockId];
        if (specialGroupId) {
            const specialGroup = document.getElementById(specialGroupId);
            if (specialGroup?.boundsElement) {
                return specialGroup.boundsElement.getBoundingClientRect();
            }
            if (specialGroup) {
                return specialGroup.getBoundingClientRect();
            }
        }

        const graphicsGroup = document.getElementById(`graphics-group-${blockId}`);
        if (graphicsGroup?.boundsElement) {
            return graphicsGroup.boundsElement.getBoundingClientRect();
        }
        if (graphicsGroup) {
            return graphicsGroup.getBoundingClientRect();
        }

        const fallback = document.querySelector(`[data-block-id="${blockId}"]`);
        if (fallback) {
            return fallback.getBoundingClientRect();
        }

        return null;
    }

    // Draw graphics block for export (without event handlers)
    drawGraphicsBlockForExport(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        return this.graphicsRenderer?.drawForExport(
            container, block, frontX, frontY, frontWidth, frontHeight, scale
        );
    }

    // Load SVG files from graphics folder (works only over HTTP, not file://)
    // This function MUST be called to load SVG content for icons and claim
    async initializeBuiltInGraphics() {
        // Load icons.svg from graphics folder
        try {
            const iconsData = await this.loadAndProcessSvg('graphics/icons.svg');
            if (iconsData) {
                const iconsBlock = this.graphicsBlocks.find(b => b.id === 'icons');
                if (iconsBlock) {
                    iconsBlock.originalWidth = iconsData.width;
                    iconsBlock.originalHeight = iconsData.height;
                    // Always update SVG content from file
                    if (iconsData.content) {
                        iconsBlock.svgContent = iconsData.content;
                        console.log(`Icons loaded from graphics/icons.svg: ${iconsData.width} × ${iconsData.height}`);
                    } else {
                        console.warn('Icons SVG content is empty after loading');
                    }
                }
            } else {
                console.error('Failed to load icons.svg - file not found or empty');
            }
        } catch (e) {
            console.error('Error loading icons.svg:', e);
            // Try to show error to user
            const iconsBlock = this.graphicsBlocks.find(b => b.id === 'icons');
            if (iconsBlock && !iconsBlock.svgContent) {
                console.error('Icons block has no SVG content - file graphics/icons.svg must be loaded');
            }
        }

        // Load yf_claim.svg from graphics folder
        try {
            const claimData = await this.loadAndProcessSvg('graphics/yf_claim.svg');
            if (claimData) {
                const claimBlock = this.graphicsBlocks.find(b => b.id === 'claim');
                if (claimBlock) {
                    claimBlock.originalWidth = claimData.width;
                    claimBlock.originalHeight = claimData.height;
                    // Always update SVG content from file
                    if (claimData.content) {
                        claimBlock.svgContent = claimData.content;
                        console.log(`Claim loaded from graphics/yf_claim.svg: ${claimData.width} × ${claimData.height}`);
                    } else {
                        console.warn('Claim SVG content is empty after loading');
                    }
                }
            } else {
                console.error('Failed to load yf_claim.svg - file not found or empty');
            }
        } catch (e) {
            console.error('Error loading yf_claim.svg:', e);
            // Try to show error to user
            const claimBlock = this.graphicsBlocks.find(b => b.id === 'claim');
            if (claimBlock && !claimBlock.svgContent) {
                console.error('Claim block has no SVG content - file graphics/yf_claim.svg must be loaded');
            }
        }

        // Update positions after dimensions are loaded (or use existing)
        this.updateBuiltInGraphicsPositions();

        this.initGraphicsRenderer();

        // Update navigator and redraw grid
        this.updateElementsNavigator();
        this.updateGrid();
    }

    // Update positions for built-in graphics (Icons and Claim) - they go to last baseline
    updateBuiltInGraphicsPositions() {
        const module = this.settingsModule.get('gridModule');
        const margins = this.settingsModule.get('margins');
        const frontHeight = this.settingsModule.get('frontHeight');

        // Calculate total available height in modules (excluding margins)
        const contentHeight = frontHeight - (margins * 2 * module);
        const totalModules = Math.floor(contentHeight / module);

        // Update positions for all built-in graphics
        this.graphicsBlocks.forEach(block => {
            if (block.isBuiltIn) {
                // Position at last baseline - block height
                const lastBaselineY = totalModules - block.heightInModules;

                // Convert to row and baseline offset
                const rowHeight = this.settingsModule.get('rowHeight');
                const { row, baselineOffset } = this.yToRowBaseline(lastBaselineY);

                block.row = row;
                block.baselineOffset = baselineOffset;
            }
        });
    }

    // УДАЛЕНО: showIconsPanel, closeIconsPanel, showClaimPanel, closeClaimPanel
    // Icons и Claim теперь используют единую функцию showGraphicsEditPanel()
    // и хранятся в общем массиве graphicsBlocks с флагом isBuiltIn: true

    // Initialize Elements Navigator
    initElementsNavigator() {
        this.objectNavigatorController.init();
    }

    // Update Elements Navigator with current elements
    updateElementsNavigator() {
        this.objectNavigatorController.render();
    }

    // Add hover handlers for objects to highlight corresponding buttons in Objects panel
    addObjectHoverHandlers() {
        this.objectNavigatorController.bindCanvasHover();
    }

    // Create element item with actions (visibility and delete)
    createElementItem(name, type, blockId, isVisible, isDeleting = false) {
        return this.objectNavigatorController.createItem({
            name, type, blockId, visible: isVisible, deleting: isDeleting
        });
    }

    // Toggle element visibility
    toggleElementVisibility(type, blockId) {
        this.objectNavigatorController.toggleVisibility(type, blockId);
    }

    // Update eye icon for toggle-chip and checkbox-label elements
    updateEyeIcon(checkbox) {
        const label = checkbox.closest('label');
        if (!label) return;

        const isChecked = checkbox.checked;

        // Add/remove class for checked state (for CSS compatibility)
        if (isChecked) {
            label.classList.add('toggle-chip-checked');
        } else {
            label.classList.remove('toggle-chip-checked');
        }
    }

    // Initialize eye icons on page load
    initEyeIcons() {
        // Initialize all toggle-chip and checkbox-label eye icons
        const checkboxes = [
            this.dom.showColumns,
            this.dom.showRows,
            this.dom.showBaseline,
            this.dom.showSidePanels,
            this.dom.surfaceVisibleToggle,
            this.dom.showObjects
        ];

        checkboxes.forEach(checkbox => {
            if (checkbox) {
                this.updateEyeIcon(checkbox);
            }
        });
    }

    // Duplicate element
    duplicateElement(type, blockId, skipSelection = false) {
        return this.objectNavigatorController.duplicate(type, blockId, skipSelection);
    }

    // Start delete element with progress bar
    startDeleteElement(button, type, blockId, name) {
        return this.objectNavigatorController.startDelete(button, type, blockId, name);
    }

    // Delete element
    deleteElement(type, blockId) {
        return this.objectNavigatorController.delete(type, blockId);
    }

    // Object navigator compatibility callbacks.
    onElementSelect(type, id) {
        // Вызываем существующий метод selectElement
        this.selectElement(type, id);
    }

    onElementDelete(type, id) {
        // Вызываем существующий метод deleteElement
        this.deleteElement(type, id);
    }

    // Add new text block
    addTextBlock() {
        // Begin action: add text block
        this.historyManager.beginAction('add text block', this.getStateSnapshot());

        // Создаем новый уникальный ID
        const newId = 'text-' + Date.now();

        // Создаем новый текстовый блок с дефолтным текстом
        const newBlock = {
            id: newId,
            content: 'Lunnen — бренд компьютерной техники, придуманный в Яндексе. Это спутник, с которым просто. Просто решать задачи. Создавать новое. И изучать неизведанное.',
            styleRef: 'text',
            x: 1,
            row: 0,
            baselineOffset: 0,
            width: 3,
            alignment: 'left',
            textAlign: 'left', // Text alignment inside paragraph: 'left', 'center', 'right'
            surface: 'front',
            showBounds: false,
            visible: true,
            alignmentMode: 'baseline' // Default alignment mode
        };

        this.textBlocks.push(newBlock);
        this.updateElementsNavigator();
        this.updateGrid();

        // Commit action: add text block
        this.historyManager.commitAction(this.getStateSnapshot());

        // Открываем панель редактирования для нового блока
        setTimeout(() => {
            this.selectElement('text', newId);
        }, 100);
    }

    // Add new graphics block
    addGraphicsBlock(svgContent, name, originalWidth, originalHeight) {
        // Begin action: add graphics block
        this.historyManager.beginAction('add graphics block', this.getStateSnapshot());

        if (!this.graphicsBlocks) {
            this.graphicsBlocks = [];
        }

        // Создаем новый уникальный ID
        const newId = 'graphics-' + Date.now();

        // Создаем новый графический блок
        const newBlock = {
            id: newId,
            name: name,
            isBuiltIn: false,  // Explicitly mark as custom (not built-in)
            svgContent: svgContent,
            sizeMode: 'height',  // 'width' or 'height'
            heightInModules: 3,
            widthInColumns: 4,  // Will be recalculated based on aspect ratio
            alignment: 'left',
            surface: 'front',
            x: 1,
            row: 0,
            baselineOffset: 0,
            showBounds: false,
            visible: true,
            originalWidth: originalWidth,
            originalHeight: originalHeight,
            lockPosition: true  // Default to constrain to grid
        };

        this.graphicsBlocks.push(newBlock);
        this.updateElementsNavigator();
        this.updateGrid();

        // Commit action: add graphics block
        this.historyManager.commitAction(this.getStateSnapshot());
    }

    // Select and highlight element
    selectElement(type, blockId = null) {
        this.objectNavigatorController.select(type, blockId);
    }

    // Highlight element on canvas
    highlightElement(type, blockId = null) {
        this.objectNavigatorController.highlight(type, blockId);
    }

    // Show element bounds on hover (from Objects panel)
    showElementBounds(type, blockId = null) {
        this.objectNavigatorController.showBounds(type, blockId);
    }

    // Hide element bounds on hover leave (from Objects panel)
    hideElementBounds(type, blockId = null) {
        this.objectNavigatorController.hideBounds(type, blockId);
    }

    // Инициализация drag & drop для текстовых блоков
    initTextBlockDrag() {
        this.objectDragController.init();
    }

    // Начать перемещение текстового блока
    startTextBlockDrag(blockId, mouseX, mouseY, frontX, frontY, scale) {
        return this.objectDragController.startText(blockId, mouseX, mouseY);
    }

    // Обработка перемещения мыши
    handleTextBlockDrag(event) {
        return this.objectDragController.moveText(event);
    }

    // Завершить перемещение
    endTextBlockDrag() {
        return this.objectDragController.endText();
    }


    /**
     * Немедленное обновление сетки (для критичных операций)
     * Используйте updateGridDebounced() для слайдеров
     */
    updateGrid() {
        this._updateGridCore();
    }

    /**
     * Debounced обновление сетки - для слайдеров и частых изменений
     * Откладывает рендеринг до прекращения ввода
     */
    updateGridDebounced() {
        this._debouncedUpdateGridCore();
    }

    /**
     * Throttled обновление сетки - для drag операций
     * Ограничивает частоту обновлений до ~60fps
     */
    updateGridThrottled() {
        this._throttledUpdateGridCore();
    }

    /**
     * Внутренний метод обновления сетки
     * @private
     */
    _updateGridCore() {
        // Constrain elements to grid bounds if lockPosition is enabled
        this.constrainElementsToBounds();

        // Сохраняем текущее состояние зума ПЕРЕД изменением SVG
        let savedZoom = null;
        let savedPanX = null;
        let savedPanY = null;
        if (this.zoomPanManager) {
            savedZoom = this.zoomPanManager.zoom;
            savedPanX = this.zoomPanManager.panX;
            savedPanY = this.zoomPanManager.panY;
        }

        const { frontWidth, frontHeight, thickness } = this.settingsModule.getAll();

        // Calculate total dimensions in mm
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;

        // Calculate scale to fit in display area with extra space for dimensions
        const maxDimension = Math.max(totalWidth, totalHeight);
        const availableSize = this.DISPLAY_SIZE - 2 * this.PADDING;
        const scale = availableSize / maxDimension;

        // Calculate scaled dimensions
        const scaledTotalWidth = totalWidth * scale;
        const scaledTotalHeight = totalHeight * scale;

        // Set SVG to fixed size (square, equal to viewport height)
        const svgSize = this.DISPLAY_SIZE;
        this.dom.svg.setAttribute('width', svgSize);
        this.dom.svg.setAttribute('height', svgSize);
        // НЕ устанавливаем viewBox напрямую - это управляется ZoomPanManager
        // this.dom.svg.setAttribute('viewBox', `0 0 ${svgSize} ${svgSize}`);

        // Обновляем размеры в ZoomPanManager
        if (this.zoomPanManager) {
            this.zoomPanManager.reinitializeSVGDimensions();
        }

        // Clear existing content
        this.dom.svg.innerHTML = '';

        // Calculate positions (perfectly centered)
        const startX = (svgSize - scaledTotalWidth) / 2;
        const startY = (svgSize - scaledTotalHeight) / 2;

        const scaledFrontWidth = frontWidth * scale;
        const scaledFrontHeight = frontHeight * scale;
        const scaledThickness = thickness * scale;
        this.currentSurfaceLayout = {
            x: startX,
            y: startY,
            frontWidth: scaledFrontWidth,
            frontHeight: scaledFrontHeight,
            thickness: scaledThickness,
            scale
        };

        // Draw rectangles
        this.drawRectangles(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness, scale);

        // Draw labels if enabled (but default is false now)
        if (this.settingsModule.get('showLabels')) {
            this.drawLabels(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness);
        }

        // Draw grid elements on front panel
        const frontX = startX + scaledThickness;
        const frontY = startY + scaledThickness;

        // Draw columns if enabled
        if (this.settingsModule.get('showColumns')) {
            this.gridRenderer.drawColumns(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }

        // Draw rows if enabled
        if (this.settingsModule.get('showRows')) {
            this.gridRenderer.drawRows(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }

        // Draw baseline if enabled
        if (this.settingsModule.get('showBaseline')) {
            this.gridRenderer.drawBaseline(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }

        // Боковые поверхности используют локальные координаты, собственную
        // ориентацию и, при необходимости, независимую сетку.
        this.surfaceRenderer.drawSideLayers(this.dom.svg, this.currentSurfaceLayout, scale);

        // Draw text and graphics objects on the front surface.
        if (this.settingsModule.get('showObjects')) {
            // Draw text blocks on front panel (only visible and not deleting)
            this.textBlocks.forEach(block => {
                if ((block.surface || 'front') === 'front' && block.visible !== false && !block.deleting) {
                    this.drawTextBlock(this.dom.svg, block, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
                }
            });

            // Draw ALL graphics blocks (icons, claim, custom) on front panel
            if (this.graphicsBlocks) {
                this.graphicsBlocks.forEach(block => {
                    // Only draw if visible and not being deleted
                    if ((block.surface || 'front') === 'front' && block.visible !== false && !block.deleting) {
                        this.drawGraphicsBlock(this.dom.svg, block, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
                    }
                });
            }
        }

        // Add hover handlers for objects to highlight corresponding buttons in Objects panel
        this.addObjectHoverHandlers();

        // Update font size displays
        this.typographyUnitController.updateDisplays();

        // Update elements navigator (which also updates panel params)
        this.updateElementsNavigator();

        // Восстанавливаем зум ПОСЛЕ обновления SVG
        if (this.zoomPanManager && savedZoom !== null) {
            this.zoomPanManager.zoom = savedZoom;
            this.zoomPanManager.panX = savedPanX;
            this.zoomPanManager.panY = savedPanY;
            this.zoomPanManager.updateTransform();
        }
    }

    // Universal method for creating SVG elements
    createSVGElement(type, attrs, container) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', type);
        Object.entries(attrs).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        container.appendChild(element);
        return element;
    }

    drawRectangles(container, x, y, frontW, frontH, thickness, scale = 1) {
        // For export: 0.25pt = 25.4/72*0.25 = 0.088194444... mm (since viewBox is in mm)
        const strokeWidth = scale === 1 ? '0.088194444' : '0.5';

        // Front (center) - always visible
        const boxColor = this.settingsModule.get('boxColor');
        const showSidePanels = this.settingsModule.get('showSidePanels');

        this.createSVGElement('rect', {
            x: x + thickness,
            y: y + thickness,
            width: frontW,
            height: frontH,
            fill: boxColor,
            stroke: '#000000',
            'stroke-width': strokeWidth
        }, container);

        // Side panels - only if showSidePanels is enabled
        if (showSidePanels) {
            // Left
            if (this.surfaceManager.isVisible('left')) {
                this.createSVGElement('rect', {
                    x: x,
                    y: y + thickness,
                    width: thickness,
                    height: frontH,
                    fill: boxColor,
                    stroke: '#000000',
                    'stroke-width': strokeWidth
                }, container);
            }

            // Right
            if (this.surfaceManager.isVisible('right')) {
                this.createSVGElement('rect', {
                    x: x + thickness + frontW,
                    y: y + thickness,
                    width: thickness,
                    height: frontH,
                    fill: boxColor,
                    stroke: '#000000',
                    'stroke-width': strokeWidth
                }, container);
            }

            // Top
            if (this.surfaceManager.isVisible('top')) {
                this.createSVGElement('rect', {
                    x: x + thickness,
                    y: y,
                    width: frontW,
                    height: thickness,
                    fill: boxColor,
                    stroke: '#000000',
                    'stroke-width': strokeWidth
                }, container);
            }

            // Bottom
            if (this.surfaceManager.isVisible('bottom')) {
                this.createSVGElement('rect', {
                    x: x + thickness,
                    y: y + thickness + frontH,
                    width: frontW,
                    height: thickness,
                    fill: boxColor,
                    stroke: '#000000',
                    'stroke-width': strokeWidth
                }, container);
            }
        }
    }

    drawDimensions(container, x, y, frontW, frontH, thickness, scale = 1) {
        const { frontWidth, frontHeight, thickness: thicknessMm } = this.settingsModule.getAll();
        const offset = scale === 1 ? 5 : 15; // smaller offset in mm for export
        const fontSize = scale === 1 ? '3' : null; // fontSize only for export

        // Front width dimension (below front panel)
        this.createDimensionText(
            container,
            x + thickness + frontW / 2,
            y + thickness + frontH + offset,
            `${frontWidth.toFixed(1)} mm`,
            'middle',
            fontSize
        );

        // Front height dimension (right of front panel)
        this.createDimensionText(
            container,
            x + thickness + frontW + offset,
            y + thickness + frontH / 2,
            `${frontHeight.toFixed(1)} mm`,
            'middle',
            fontSize
        );

        // Thickness dimension (right of right panel)
        this.createDimensionText(
            container,
            x + thickness + frontW + thickness + offset,
            y + thickness + frontH / 2,
            `${thicknessMm.toFixed(1)} mm`,
            'middle',
            fontSize
        );
    }

    createDimensionText(container, x, y, text, anchor = 'middle', fontSize = null) {
        const attrs = {
            x,
            y,
            'text-anchor': anchor,
            'dominant-baseline': 'middle'
        };

        if (fontSize) {
            // Export mode
            attrs['font-size'] = fontSize;
            attrs['font-family'] = 'Arial, sans-serif';
            attrs['fill'] = '#666666';
        } else {
            // Display mode
            attrs['class'] = 'grid-text';
        }

        const textElement = this.createSVGElement('text', attrs, container);
        textElement.textContent = text;
    }

    drawLabels(container, x, y, frontW, frontH, thickness, scale = 1) {
        const fontSize = scale === 1 ? '4' : null;

        // Front label
        this.createLabel(container, x + thickness + frontW / 2, y + thickness + frontH / 2, 'FRONT', false, fontSize);

        // Left label
        if (this.surfaceManager.isVisible('left')) {
            this.createLabel(container, x + thickness / 2, y + thickness + frontH / 2, 'LEFT', true, fontSize);
        }

        // Right label
        if (this.surfaceManager.isVisible('right')) {
            this.createLabel(container, x + thickness + frontW + thickness / 2, y + thickness + frontH / 2, 'RIGHT', true, fontSize);
        }

        // Top label
        if (this.surfaceManager.isVisible('top')) {
            this.createLabel(container, x + thickness + frontW / 2, y + thickness / 2, 'TOP', false, fontSize);
        }

        // Bottom label
        if (this.surfaceManager.isVisible('bottom')) {
            this.createLabel(container, x + thickness + frontW / 2, y + thickness + frontH + thickness / 2, 'BOTTOM', false, fontSize);
        }
    }

    createLabel(container, x, y, text, rotate = false, fontSize = null) {
        const attrs = {
            x,
            y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle'
        };

        if (fontSize) {
            // Export mode
            attrs['font-size'] = fontSize;
            attrs['font-weight'] = '600';
            attrs['font-family'] = 'Arial, sans-serif';
            attrs['fill'] = '#999999';
        } else {
            // Display mode
            attrs['class'] = 'grid-label';
        }

        if (rotate) {
            attrs['transform'] = `rotate(-90 ${x} ${y})`;
        }

        const textElement = this.createSVGElement('text', attrs, container);
        textElement.textContent = text;
    }

    getContrastColor() {
        // Use ColorUtils for consistency with GridRenderer
        const bgColor = this.settingsModule.get('boxColor');
        const luminance = ColorUtils.getLuminance(bgColor);

        // Store luminance for opacity calculation (if needed in future)
        this.currentLuminance = luminance;

        return ColorUtils.getContrastColor(bgColor);
    }

    getGridOpacity(baseOpacity) {
        // Always use the same opacity regardless of background brightness
        // Color switching (light/dark) is handled by getContrastColor()
        return baseOpacity;
    }

    // Итерация 7: Упрощенный экспорт SVG через SVGExporter
    async exportSVG() {
        const { frontWidth, frontHeight, thickness, gridModule, columnCount, rowCount, margins, marginsUnit, showSidePanels } = this.settingsModule.getAll();

        // Создаем SVG для экспорта (scale = 1 для точных размеров)
        const exportSvg = await this.createExportSVG();

        // Генерируем timestamp в формате 251101_2200 (год месяц день_час минуты)
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2); // Последние 2 цифры года
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${year}${month}${day}_${hours}${minutes}`;

        // Формируем части имени файла
        const filenameParts = [];

        // 1. Название пресета (если не "+New")
        const presetName = this.currentPresetName || 'Custom';
        // Проверяем, что пресет не начинается с "+New" и не равен "Custom"
        if (!presetName.startsWith('+New') && presetName !== 'Custom') {
            // Заменяем пробелы на подчеркивания
            const sanitizedPresetName = presetName.replace(/\s+/g, '_');
            filenameParts.push(sanitizedPresetName);
        }

        // 2. Размеры макета
        if (showSidePanels) {
            filenameParts.push(`${frontWidth}×${frontHeight}×${thickness}`);
        } else {
            filenameParts.push(`${frontWidth}×${frontHeight}`);
        }

        // 3. Параметры сетки: 12col_19rows_module_2.71mm_margins_2mm
        // ВАЖНО: margins всегда хранится в модулях во внутренней системе,
        // поэтому всегда пересчитываем в миллиметры для имени файла
        const marginsInMm = margins * gridModule;

        const gridParams = `${columnCount}col_${rowCount}rows_module_${gridModule.toFixed(2)}mm_margins_${marginsInMm.toFixed(2)}mm`;
        filenameParts.push(gridParams);

        // 4. Дата и время
        filenameParts.push(timestamp);

        // Собираем имя файла
        const filename = `${filenameParts.join('_')}.svg`;

        // Получаем значение тогла "Outline fonts"
        const convertToOutlines = this.dom.convertToOutlinesCheckbox ? this.dom.convertToOutlinesCheckbox.checked : false;

        // Экспортируем через модуль
        await this.svgExporter.exportToFile(exportSvg, filename, {
            removeInteractive: true,
            optimizeSize: true,
            convertTextToOutlines: convertToOutlines
        });
    }

    // Экспорт в PDF
    async exportPDF() {
        const { frontWidth, frontHeight, thickness, gridModule, columnCount, rowCount, margins, marginsUnit, showSidePanels } = this.settingsModule.getAll();

        // Создаем SVG для экспорта (scale = 1 для точных размеров)
        // Для PDF не включаем справочные элементы за пределами артборда
        const exportSvg = await this.createExportSVG(false);

        // Генерируем timestamp в формате 251101_2200 (год месяц день_час минуты)
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2); // Последние 2 цифры года
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${year}${month}${day}_${hours}${minutes}`;

        // Формируем части имени файла
        const filenameParts = [];

        // 1. Название пресета (если не "+New")
        const presetName = this.currentPresetName || 'Custom';
        // Проверяем, что пресет не начинается с "+New" и не равен "Custom"
        if (!presetName.startsWith('+New') && presetName !== 'Custom') {
            // Заменяем пробелы на подчеркивания
            const sanitizedPresetName = presetName.replace(/\s+/g, '_');
            filenameParts.push(sanitizedPresetName);
        }

        // 2. Размеры макета
        if (showSidePanels) {
            filenameParts.push(`${frontWidth}×${frontHeight}×${thickness}`);
        } else {
            filenameParts.push(`${frontWidth}×${frontHeight}`);
        }

        // 3. Параметры сетки: 12col_19rows_module_2.71mm_margins_2mm
        // ВАЖНО: margins всегда хранится в модулях во внутренней системе,
        // поэтому всегда пересчитываем в миллиметры для имени файла
        const marginsInMm = margins * gridModule;

        const gridParams = `${columnCount}col_${rowCount}rows_module_${gridModule.toFixed(2)}mm_margins_${marginsInMm.toFixed(2)}mm`;
        filenameParts.push(gridParams);

        // 4. Дата и время
        filenameParts.push(timestamp);

        // Собираем имя файла
        const filename = `${filenameParts.join('_')}.pdf`;

        // Для PDF экспорта текст ВСЕГДА конвертируется в кривые (независимо от чекбокса)
        // Это необходимо для правильного отображения кириллицы в PDF
        try {
            // Экспортируем через модуль
            // convertTextToOutlines игнорируется для PDF - конвертация всегда выполняется
            await this.svgExporter.exportToPDF(exportSvg, filename, {
                removeInteractive: true,
                convertTextToOutlines: true, // Всегда true для PDF
                unit: 'mm'
            });
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Ошибка при экспорте PDF: ' + error.message);
        }
    }

    // Итерация 7: Создание SVG для экспорта (без интерактивных элементов)
    async createExportSVG(includeReferenceElements = true) {
        const { frontWidth, frontHeight, thickness } = this.settingsModule.getAll();

        // Create a new SVG for export with actual mm dimensions
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;
        const scale = 1; // Export uses scale = 1 (actual mm)

        // Create SVG with mm units
        const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        exportSvg.setAttribute('width', `${totalWidth}mm`);
        exportSvg.setAttribute('height', `${totalHeight}mm`);
        exportSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

        // Create groups for better organization in Figma/Illustrator
        const boxGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        boxGroup.setAttribute('id', 'box');
        exportSvg.appendChild(boxGroup);

        // Draw rectangles at actual mm scale
        this.drawRectangles(boxGroup, 0, 0, frontWidth, frontHeight, thickness, scale);

        // Draw grid elements on front panel (in mm)
        const frontX = thickness;
        const frontY = thickness;

        // Create main grid group to hold all grid elements
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridGroup.setAttribute('id', 'grid');
        exportSvg.appendChild(gridGroup);

        // Draw columns (only if visible)
        if (this.settingsModule.get('showColumns')) {
            const columnsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            columnsGroup.setAttribute('id', 'columns');
            gridGroup.appendChild(columnsGroup);
            this.gridRenderer.drawColumns(columnsGroup, frontX, frontY, frontWidth, frontHeight, scale);

        }

        // Draw rows (only if visible)
        if (this.settingsModule.get('showRows')) {
            const rowsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            rowsGroup.setAttribute('id', 'rows');
            gridGroup.appendChild(rowsGroup);
            this.gridRenderer.drawRows(rowsGroup, frontX, frontY, frontWidth, frontHeight, scale);
        }

        // Draw baseline (only if visible)
        if (this.settingsModule.get('showBaseline')) {
            const baselineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            baselineGroup.setAttribute('id', 'baseline');
            gridGroup.appendChild(baselineGroup);

            // Front panel baseline
            this.gridRenderer.drawBaseline(baselineGroup, frontX, frontY, frontWidth, frontHeight, scale);

        }

        this.surfaceRenderer.drawSideLayers(exportSvg, {
            x: 0,
            y: 0,
            frontWidth,
            frontHeight,
            thickness,
            scale
        }, scale, { forExport: true });

        // Add labels if enabled (in separate group)
        if (this.settingsModule.get('showLabels')) {
            const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelsGroup.setAttribute('id', 'labels');
            exportSvg.appendChild(labelsGroup);
            this.drawLabels(labelsGroup, 0, 0, frontWidth, frontHeight, thickness, scale);
        }

        // Add text blocks (in separate groups, only if visible)
        this.textBlocks.forEach(block => {
            if ((block.surface || 'front') === 'front' && block.visible !== false) {
                const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                textGroup.setAttribute('id', `text-${block.id}`);
                exportSvg.appendChild(textGroup);
                this.drawTextBlock(textGroup, block, frontX, frontY, frontWidth, frontHeight, scale);
            }
        });

        // Add graphics blocks (in separate groups)
        if (this.graphicsBlocks) {
            this.graphicsBlocks.forEach(block => {
                if ((block.surface || 'front') === 'front' && block.visible !== false && block.svgContent) {
                    const graphicsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    // Use simple id for built-in blocks (icons, claim) without prefix
                    graphicsGroup.setAttribute('id', block.isBuiltIn ? block.id : `graphics-${block.id}`);
                    exportSvg.appendChild(graphicsGroup);

                    // Draw graphics block
                    this.drawGraphicsBlockForExport(graphicsGroup, block, frontX, frontY, frontWidth, frontHeight, scale);
                }
            });
        }

        // Add text styles summary and design kit outside artboard (only for SVG export, not for PDF)
        if (includeReferenceElements) {
            // Add text styles summary outside artboard (for reference in editor)
            this.addTextStylesSummary(exportSvg, totalWidth, scale);

            // Add design kit (logo and graphic elements) in multiple sizes outside artboard (for reference in editor)
            await this.addLunnenLogoReference(exportSvg, totalWidth, scale);
        }

        return exportSvg;
    }

    /**
     * Добавить справку по текстовым стилям за пределами артборда
     */
    addTextStylesSummary(svg, artboardWidth, scale = 1) {
        // Позиция справа от артборда с отступом 20mm
        const summaryX = artboardWidth + 20;
        const summaryY = 10;
        const lineHeight = 5; // mm между строками

        // Создаем группу для справки
        const summaryGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        summaryGroup.setAttribute('id', 'text-styles-reference');
        summaryGroup.setAttribute('opacity', '0.7');

        // Получаем контрастный цвет для текста
        const textColor = this.getContrastColor();

        // Функция для создания строки текста
        const createTextLine = (content, x, y, fontSize = 3, fontWeight = 400) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x * scale);
            text.setAttribute('y', y * scale);
            text.setAttribute('font-family', 'TT Commons Classic, -apple-system, sans-serif');
            text.setAttribute('font-size', fontSize * scale);
            text.setAttribute('font-weight', fontWeight);
            text.setAttribute('fill', textColor);
            text.textContent = content;
            return text;
        };

        // Заголовок
        summaryGroup.appendChild(createTextLine('Text Styles', summaryX, summaryY, 4, 500));

        let currentY = summaryY + lineHeight * 1.5;

        // Получаем все текстовые стили и их параметры
        const styles = this.getTextStylesInfo();

        styles.forEach(style => {
            const line = `${style.name}  ${style.fontSize}/${style.lineHeight} pt`;
            summaryGroup.appendChild(createTextLine(line, summaryX, currentY, 3, 400));
            currentY += lineHeight;
        });

        svg.appendChild(summaryGroup);
    }

    /**
     * Получить информацию о всех текстовых стилях
     */
    getTextStylesInfo() {
        const { gridModule } = this.settingsModule.getAll();
        const mmToPt = 2.83465; // 1mm = 2.83465pt

        const styles = [];

        // Headline
        const headlineSize = this.settingsModule.get('headlineSize') || 1;
        const headlineLineHeight = this.settingsModule.get('lineHeight') || 2;
        const headlineFontSize = this.calculateActualFontSize('headline', headlineSize);
        const headlineLineHeightPt = (headlineLineHeight * gridModule * mmToPt).toFixed(1);

        styles.push({
            name: 'Headline',
            fontSize: (headlineFontSize * mmToPt).toFixed(1),
            lineHeight: headlineLineHeightPt
        });

        // Text
        const textSize = this.settingsModule.get('textSize') || 1;
        const textLineHeight = this.settingsModule.get('textLineHeight') || 2;
        const textFontSize = this.calculateActualFontSize('text', textSize);
        const textLineHeightPt = (textLineHeight * gridModule * mmToPt).toFixed(1);

        styles.push({
            name: 'Text',
            fontSize: (textFontSize * mmToPt).toFixed(1),
            lineHeight: textLineHeightPt
        });

        // Caption
        const captionSize = this.settingsModule.get('captionSize') || 0.5;
        const captionLineHeight = this.settingsModule.get('captionLineHeight') || 1;
        const captionFontSize = this.calculateActualFontSize('caption', captionSize);
        const captionLineHeightPt = (captionLineHeight * gridModule * mmToPt).toFixed(1);

        styles.push({
            name: 'Caption',
            fontSize: (captionFontSize * mmToPt).toFixed(1),
            lineHeight: captionLineHeightPt
        });

        // Lunnen Display
        const lunnenSize = this.settingsModule.get('lunnenDisplaySize') || 3;
        const lunnenLineHeight = this.settingsModule.get('lunnenDisplayLineHeight') || 4;
        const lunnenFontSize = this.calculateActualFontSize('lunnenDisplay', lunnenSize);
        const lunnenLineHeightPt = (lunnenLineHeight * gridModule * mmToPt).toFixed(1);

        styles.push({
            name: 'Lunnen Display',
            fontSize: (lunnenFontSize * mmToPt).toFixed(1),
            lineHeight: lunnenLineHeightPt
        });

        return styles;
    }

    /**
     * Рассчитать реальный размер шрифта с учетом cap-height/x-height
     */
    calculateActualFontSize(styleRef, sizeInModules) {
        const { gridModule } = this.settingsModule.getAll();
        const targetSize = gridModule * sizeInModules; // size in mm

        // Метрики шрифтов
        const fontMetrics = {
            capHeight: 630,
            xHeight: 447,
            unitsPerEm: 1000
        };

        // Определяем, какой стиль использует x-height
        let useXHeight = false;
        if (styleRef === 'headline') {
            useXHeight = this.settingsModule.get('useXHeight') !== false;
        } else if (styleRef === 'text') {
            useXHeight = this.settingsModule.get('useXHeight2') !== false;
        } else if (styleRef === 'caption') {
            useXHeight = this.settingsModule.get('useXHeightCaption') !== false;
        }
        // Lunnen Display всегда использует cap-height

        // Calculate font size based on whether we're using cap height or x-height
        let fontSize;
        if (useXHeight) {
            fontSize = targetSize * (fontMetrics.unitsPerEm / fontMetrics.xHeight);
        } else {
            fontSize = targetSize * (fontMetrics.unitsPerEm / fontMetrics.capHeight);
        }

        return fontSize; // in mm
    }

    /**
     * Добавить дизайн-кит (логотип и графические элементы) в нескольких размерах за пределами артборда
     */
    async addLunnenLogoReference(svg, artboardWidth, scale = 1) {
        try {
            const { gridModule } = this.settingsModule.getAll();

            // Список всех графических элементов для дизайн-кита
            const graphicElements = [
                { file: 'lunnen_logo.svg', name: 'Lunnen Logo' },
                { file: '1.svg', name: '1' },
                { file: '2.svg', name: '2' },
                { file: '3.svg', name: '3' },
                { file: 'icons.svg', name: 'Icons' },
                { file: 'l_sign.svg', name: 'L Sign' },
                { file: 'qr_lunnen.pro.svg', name: 'QR' },
                { file: 'yf_claim.svg', name: 'YF Claim' }
            ];

            // Позиция под справкой по текстовым стилям
            const startX = artboardWidth + 20;
            let currentY = 40; // Под Text Styles
            const verticalGap = 3; // mm между элементами
            const sectionGap = 10; // mm между разными графическими элементами

            // Размеры в модулях (от большего к меньшему)
            const sizes = [6, 5, 4, 3, 2, 1];

            // Создаем группу для всего дизайн-кита
            const designKitGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            designKitGroup.setAttribute('id', 'design-kit-reference');
            designKitGroup.setAttribute('opacity', '0.7');

            // Получаем контрастный цвет для текста
            const textColor = this.getContrastColor();

            // Проходим по каждому графическому элементу
            for (const element of graphicElements) {
                // Загружаем SVG элемента
                const response = await fetch(`graphics/${element.file}`);
                if (!response.ok) {
                    console.warn(`Failed to load ${element.file}`);
                    continue;
                }

                const svgText = await response.text();

                // Парсим SVG
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.querySelector('svg');

                if (!svgElement) {
                    console.warn(`Invalid SVG structure for ${element.file}`);
                    continue;
                }

                // Получаем оригинальные размеры из viewBox
                const viewBox = svgElement.getAttribute('viewBox');
                const [, , originalWidth, originalHeight] = viewBox.split(' ').map(Number);
                const aspectRatio = originalWidth / originalHeight;

                // Добавляем заголовок секции
                const sectionTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                sectionTitle.setAttribute('x', startX * scale);
                sectionTitle.setAttribute('y', currentY * scale);
                sectionTitle.setAttribute('font-family', 'TT Commons Classic, -apple-system, sans-serif');
                sectionTitle.setAttribute('font-size', 4 * scale);
                sectionTitle.setAttribute('font-weight', 500);
                sectionTitle.setAttribute('fill', textColor);
                sectionTitle.setAttribute('dominant-baseline', 'hanging');
                sectionTitle.textContent = element.name;

                designKitGroup.appendChild(sectionTitle);

                currentY += 6; // Отступ после заголовка

                // Рендерим элемент в разных размерах
                sizes.forEach(heightInModules => {
                    // Вычисляем размеры
                    const heightInMm = gridModule * heightInModules;
                    const widthInMm = heightInMm * aspectRatio;

                    // Создаем группу для этого экземпляра
                    const instanceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    instanceGroup.setAttribute('transform', `translate(${startX * scale}, ${currentY * scale}) scale(${(heightInMm / originalHeight) * scale})`);

                    // Копируем все содержимое SVG (включая defs, если есть)
                    Array.from(svgElement.children).forEach(child => {
                        const clonedChild = child.cloneNode(true);
                        instanceGroup.appendChild(clonedChild);
                    });

                    designKitGroup.appendChild(instanceGroup);

                    // Добавляем подпись с размером справа от элемента
                    const labelX = startX + widthInMm + 5; // 5mm отступ справа
                    const labelY = currentY + (heightInMm / 2); // По центру высоты

                    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    label.setAttribute('x', labelX * scale);
                    label.setAttribute('y', labelY * scale);
                    label.setAttribute('font-family', 'TT Commons Classic, -apple-system, sans-serif');
                    label.setAttribute('font-size', 3 * scale);
                    label.setAttribute('font-weight', 400);
                    label.setAttribute('fill', textColor);
                    label.setAttribute('dominant-baseline', 'middle');
                    label.textContent = `${heightInModules} mod`;

                    designKitGroup.appendChild(label);

                    // Обновляем позицию для следующего экземпляра
                    currentY += heightInMm + verticalGap;
                });

                // Добавляем отступ между секциями
                currentY += sectionGap;
            }

            svg.appendChild(designKitGroup);
        } catch (error) {
            console.error('Error adding design kit reference:', error);
        }
    }

    // Итерация 7: Экспорт настроек в JSON через SVGExporter
    exportSettings() {
        const { frontWidth, frontHeight, thickness, gridModule, columnCount, rowCount, margins, marginsUnit, showSidePanels } = this.settingsModule.getAll();

        const data = {
            version: '1.1',
            timestamp: new Date().toISOString(),
            settings: this.settingsModule.getAll(),
            textBlocks: this.textBlocks,
            graphicsBlocks: this.graphicsBlocks || [],
            iconsBlock: this.iconsBlock || null,
            claimBlock: this.claimBlock || null,
            currentPresetName: this.currentPresetName || 'Custom'
        };

        // Генерируем timestamp в формате 251101_2200 (год месяц день_час минуты)
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2); // Последние 2 цифры года
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${year}${month}${day}_${hours}${minutes}`;

        // Формируем части имени файла (тот же принцип, что и для SVG/PDF)
        const filenameParts = [];

        // 1. Название пресета (если не "+New")
        const presetName = this.currentPresetName || 'Custom';
        // Проверяем, что пресет не начинается с "+New" и не равен "Custom"
        if (!presetName.startsWith('+New') && presetName !== 'Custom') {
            // Заменяем пробелы на подчеркивания
            const sanitizedPresetName = presetName.replace(/\s+/g, '_');
            filenameParts.push(sanitizedPresetName);
        }

        // 2. Размеры макета
        if (showSidePanels) {
            filenameParts.push(`${frontWidth}×${frontHeight}×${thickness}`);
        } else {
            filenameParts.push(`${frontWidth}×${frontHeight}`);
        }

        // 3. Параметры сетки: 12col_19rows_module_2.71mm_margins_2mm
        // ВАЖНО: margins всегда хранится в модулях во внутренней системе,
        // поэтому всегда пересчитываем в миллиметры для имени файла
        const marginsInMm = margins * gridModule;

        const gridParams = `${columnCount}col_${rowCount}rows_module_${gridModule.toFixed(2)}mm_margins_${marginsInMm.toFixed(2)}mm`;
        filenameParts.push(gridParams);

        // 4. Дата и время
        filenameParts.push(timestamp);

        // Собираем имя файла
        const filename = `${filenameParts.join('_')}.json`;

        this.svgExporter.exportSettings(data, filename);
    }

    // Итерация 7: Импорт настроек из JSON
    async importSettings(file) {
        try {
            await this.presetApplicationController.importFile(file);
            console.log('✅ Settings imported successfully');
        } catch (error) {
            console.error('❌ Failed to import settings:', error);
            alert('Ошибка при импорте настроек: ' + error.message);
        }
    }

    getStateSnapshot() {
        return this.presetApplicationController.createSnapshot();
    }

    undo() {
        if (!this.presetApplicationController.undo()) {
            console.log('[UNDO] Nothing to undo');
        }
    }

    redo() {
        if (!this.presetApplicationController.redo()) {
            console.log('[REDO] Nothing to redo');
        }
    }

    initSliderHistoryHandlers() {
        // Map для отслеживания активных транзакций слайдеров
        this.activeSliderTransactions = new Map();
        // Set для отслеживания транзакций по вводу значений с клавиатуры
        this.activeInputTransactions = new Set();

        // Добавляем обработчики для каждого слайдера
        this.sliderController.sliders.forEach((sliderData, sliderId) => {
            const slider = sliderData.element;
            const valueInput = sliderData.valueInput;

            // ===== Обработчики для перетаскивания слайдера мышью =====

            // Начало перетаскивания - начинаем транзакцию
            slider.addEventListener('mousedown', (e) => {
                // Только левая кнопка мыши
                if (e.button !== 0) return;

                // Сохраняем состояние "до" изменений
                this.historyManager.beginAction(`adjust ${sliderId}`, this.getStateSnapshot());
                this.activeSliderTransactions.set(sliderId, true);
            });

            // Окончание перетаскивания - завершаем транзакцию
            slider.addEventListener('mouseup', (e) => {
                // Только левая кнопка мыши
                if (e.button !== 0) return;

                if (this.activeSliderTransactions.has(sliderId)) {
                    // Сохраняем состояние "после" изменений
                    this.historyManager.commitAction(this.getStateSnapshot());
                    this.activeSliderTransactions.delete(sliderId);
                }
            });

            // Обработка случая, когда мышь уходит за пределы слайдера во время перетаскивания
            slider.addEventListener('mouseleave', (e) => {
                // Если кнопка мыши все еще зажата, это означает, что перетаскивание продолжается
                // Мы не завершаем транзакцию здесь, а ждем mouseup
            });

            // ===== Обработчики для ввода значений с клавиатуры =====
            // Паттерн: focus → beginAction, blur → commitAction
            // Группирует все изменения (набор текста, стрелки) в одно действие

            if (valueInput) {
                valueInput.addEventListener('focus', () => {
                    if (!this.activeInputTransactions.has(sliderId)) {
                        this.historyManager.beginAction(`type ${sliderId}`, this.getStateSnapshot());
                        this.activeInputTransactions.add(sliderId);
                    }
                });

                valueInput.addEventListener('blur', () => {
                    if (this.activeInputTransactions.has(sliderId)) {
                        this.historyManager.commitAction(this.getStateSnapshot());
                        this.activeInputTransactions.delete(sliderId);
                    }
                });
            }
        });

        // Глобальный обработчик mouseup на случай, если мышь отпущена вне слайдера
        document.addEventListener('mouseup', (e) => {
            if (this.activeSliderTransactions.size > 0) {
                // Завершаем все активные транзакции
                this.activeSliderTransactions.forEach((_, sliderId) => {
                    this.historyManager.commitAction(this.getStateSnapshot());
                });
                this.activeSliderTransactions.clear();
            }
        });
    }

    // ============================================
    // UI Controllers initialization (Итерация 5)
    // ============================================
    initUIControllers() {
        // ============================================
        // Шаг 5.1: SliderController
        // ============================================
        // Создаем SliderController
        this.sliderController = new SliderController(this.settingsModule);

        // Инициализируем все слайдеры из SLIDER_CONFIG
        // Все слайдеры, включая HSB, управляются через SliderController
        Object.keys(this.SLIDER_CONFIG).forEach(sliderId => {
            const config = this.SLIDER_CONFIG[sliderId];
            this.sliderController.initSlider(sliderId, config);
        });

        // Добавляем обработчики mousedown/mouseup для группировки действий слайдеров
        this.initSliderHistoryHandlers();

        console.log('✅ SliderController initialized with', this.sliderController.sliders.size, 'sliders');

        // PanelManager
        this.panelManager = new PanelManager();

        // Регистрация панелей (вызывается после того как DOM готов)
        // Перенесено в init() так как требуется готовый DOM

        console.log('✅ PanelManager created');

        // ============================================
        // Шаг 5.4: ZoomPanManager
        // ============================================
        this.zoomPanManager = new ZoomPanManager(
            this.dom.canvasContainer,
            this.dom.svg
        );

        // Обработчик изменения зума для обновления UI
        this.dom.canvasContainer.addEventListener('zoomchange', (e) => {
            // Сохраняем текущий процент зума
            this.currentZoomPercent = e.detail.percent;
            // Обновляем текст если не наведена мышь
            if (!this.zoomIndicatorHovered) {
                this.dom.zoomIndicator.textContent = `${e.detail.percent}%`;
            }
        });

        // Флаг для отслеживания наведения на индикатор зума
        this.zoomIndicatorHovered = false;
        this.currentZoomPercent = 100;

        // Обработчик наведения на индикатор зума - меняет текст на "Fit"
        this.dom.zoomIndicator.addEventListener('mouseenter', () => {
            this.zoomIndicatorHovered = true;
            this.dom.zoomIndicator.textContent = 'Fit';
        });

        // Обработчик ухода мыши - возвращает процент зума
        this.dom.zoomIndicator.addEventListener('mouseleave', () => {
            this.zoomIndicatorHovered = false;
            this.dom.zoomIndicator.textContent = `${this.currentZoomPercent}%`;
        });

        // Клик на индикатор зума - сброс в 100%
        this.dom.zoomIndicator.addEventListener('click', () => {
            this.zoomPanManager.resetZoom();
        });

        this.dom.canvasRotateLeftBtn?.addEventListener('click', () => {
            this.zoomPanManager.rotateLeft();
        });

        console.log('✅ ZoomPanManager initialized');

    }

    // ============================================
    // Panel registration (Итерация 5.3)
    // ============================================
    initPanels() {
        // Регистрируем все панели через PanelManager
        const panels = [
            { id: 'controlsPanel', headerId: 'panelHeader', draggable: true },
            { id: 'rightSettingsStack', headerId: 'gridPanelHeader', draggable: true },
            { id: 'textPanel', headerId: 'textPanelHeader', draggable: true },
            { id: 'paragraphPanel', headerId: 'paragraphPanelHeader', draggable: true },
            { id: 'graphicsPanel', headerId: 'graphicsPanelHeader', draggable: true },
            { id: 'elementsNavigator', headerId: 'elementsNavigatorHeader', draggable: true }
        ];

        panels.forEach(panel => {
            this.panelManager.registerPanel(panel.id, {
                headerId: panel.headerId,
                draggable: panel.draggable
            });
        });
    }

    initGraphicsRenderer() {
        this.graphicsRenderer = new GraphicsRenderer({
            settings: this.settingsModule,
            createSvgElement: (type, attrs, container) => (
                this.createSVGElement(type, attrs, container)
            ),
            getContrastColor: () => this.getContrastColor(),
            getBlockY: block => this.getBlockY(block),
            attachInteractions: (group, block) => (
                this.objectDragController.attachGraphics(group, block)
            )
        });
    }

    initTextRenderer() {
        this.textRenderer = new TextBlockRenderer({
            settings: this.settingsModule,
            createSvgElement: (type, attrs, container) => (
                this.createSVGElement(type, attrs, container)
            ),
            getContrastColor: () => this.getContrastColor(),
            getStyleSettings: styleRef => this.textStyleResolver.getStyleSettings(styleRef),
            getFontMetrics: styleRef => this.textStyleResolver.getFontMetrics(styleRef),
            layout: this.textLayout,
            attachInteractions: (element, block) => (
                this.objectDragController.attachText(element, block)
            ),
            attachResize: (handle, block) => (
                this.objectDragController.attachTextResize(handle, block)
            ),
            isDragging: () => this.textDragState.isDragging
        });
    }

    initTextLayout() {
        this.textLayout = new TextLayout({
            settings: this.settingsModule,
            getSurfaceGridContext: surface => this.getSurfaceGridContext(surface),
            getBlockY: block => this.getBlockY(block)
        });
    }
}

// Initialize when DOM is loaded and fonts are ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for fonts to load before initializing
    try {
        // Загружаем шрифт явно
        await document.fonts.load('500 16px "TT Commons Classic"');
        await document.fonts.load('400 16px "TT Commons Classic"');

        // Также ждем когда все шрифты будут готовы
        await document.fonts.ready;
    } catch (e) {
        console.warn('Font loading warning:', e);
    }

    // Небольшая дополнительная задержка для уверенности
    setTimeout(async () => {
        const generator = new GridGenerator();
        // Load built-in graphics dimensions from SVG files
        await generator.initializeBuiltInGraphics();
    }, 50);
});
