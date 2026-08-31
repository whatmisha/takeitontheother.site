/**
 * GridGenerator - Главный оркестратор приложения
 * Координирует работу всех модулей
 */
import { Settings } from './Settings.js';
import { COLORS } from './Constants.js';
import { ColorUtils } from '../framework/FrameworkAdapter.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GridCalculator } from '../grid/GridCalculator.js';
import { GridRenderer } from '../grid/GridRenderer.js';
import { GridPresets } from '../grid/GridPresets.js';
import { SVGExporter } from '../svg/SVGExporter.js';
import { SliderController } from '../ui/SliderController.js';
import { PanelManager } from '../ui/PanelManager.js';
import { ColorPicker } from '../ui/ColorPicker.js';
import { DragDropManager } from '../ui/DragDropManager.js';
import { TextBlockManager } from '../elements/TextBlockManager.js';
import { TextRenderer } from '../elements/TextRenderer.js';
import { GraphicsManager } from '../elements/GraphicsManager.js';
import { GraphicsRenderer } from '../elements/GraphicsRenderer.js';
import { ElementsNavigator } from '../elements/ElementsNavigator.js';

export class GridGenerator {
    constructor() {
        // Инициализация модулей
        this.initializeModules();
        
        // Состояние приложения
        this.state = {
            isInitialized: false,
            isUpdating: false
        };
        
        // История для Undo/Redo
        this.history = {
            states: [],
            currentIndex: -1,
            maxStates: 50
        };
    }

    /**
     * Инициализация всех модулей
     */
    initializeModules() {
        // Core модули
        this.settings = new Settings();
        
        // Grid модули
        this.gridCalculator = new GridCalculator(this.settings);
        this.gridRenderer = new GridRenderer(this.settings, this.gridCalculator);
        this.gridPresets = new GridPresets(this.settings, this.gridCalculator);
        
        // SVG модули
        this.svgExporter = new SVGExporter(this.settings);
        
        // Elements модули
        this.textBlockManager = new TextBlockManager(this.settings, this.gridCalculator);
        this.textRenderer = new TextRenderer(this.settings, this.gridCalculator);
        this.graphicsManager = new GraphicsManager(this.settings, this.gridCalculator);
        this.graphicsRenderer = new GraphicsRenderer(this.settings, this.gridCalculator);
        this.elementsNavigator = new ElementsNavigator(
            this.textBlockManager,
            this.graphicsManager,
            {
                onSelect: (type, id) => this.onElementSelect(type, id),
                onDelete: (type, id) => this.onElementDelete(type, id),
                onToggleVisibility: (type, id) => this.onElementVisibilityToggle(type, id),
                onUpdate: () => this.updateGrid()
            }
        );
        
        // UI модули
        this.sliderController = new SliderController(this.settings);
        this.panelManager = new PanelManager();
        this.colorPicker = new ColorPicker(this.settings, {
            onChange: (color) => this.onColorChange(color)
        });
        this.dragDropManager = new DragDropManager(
            this.settings,
            this.gridCalculator,
            {
                onDragStart: (id, type, data) => this.onDragStart(id, type, data),
                onDrag: (id, type, deltaX, deltaY, data) => this.onDrag(id, type, deltaX, deltaY, data),
                onDragEnd: (id, type, position, data) => this.onDragEnd(id, type, position, data),
                onUpdate: () => this.updateGrid()
            }
        );
    }

    /**
     * Инициализация приложения после загрузки DOM
     */
    async init() {
        console.log('Initializing Grid Generator...');
        
        // Инициализация UI компонентов
        this.initializeUI();
        
        // Инициализация событий
        this.initializeEvents();
        
        // Загрузка встроенных графических элементов
        await this.initializeBuiltInGraphics();
        
        // Первая отрисовка
        this.updateGrid();
        
        // Генерация пресетов
        this.generateRowPresets();
        
        this.state.isInitialized = true;
        console.log('Grid Generator initialized successfully');
    }

    /**
     * Инициализация UI компонентов
     */
    initializeUI() {
        // Инициализация слайдеров
        this.initializeSliders();
        
        // Инициализация панелей
        this.initializePanels();
        
        // Инициализация color picker
        this.colorPicker.init();
        
        // Инициализация навигатора элементов
        this.elementsNavigator.init('elementsList');
        
        // Инициализация чекбоксов
        this.initializeCheckboxes();
        
        // Инициализация кнопок
        this.initializeButtons();
        
        // Инициализация модальных окон
        this.initializeModals();
    }

    /**
     * Инициализация всех слайдеров
     */
    initializeSliders() {
        const sliderConfigs = {
            // Dimension sliders
            frontWidthSlider: {
                valueId: 'frontWidthValue',
                setting: 'frontWidth',
                min: 10,
                max: 1000,
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            frontHeightSlider: {
                valueId: 'frontHeightValue',
                setting: 'frontHeight',
                min: 10,
                max: 1000,
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.get('linkMode') === 'module') {
                        this.calculateModule();
                    } else {
                        this.gridCalculator.calculateRowCount();
                    }
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
                min: 5,
                max: 200,
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            // Grid sliders
            gridModuleSlider: {
                valueId: 'gridModuleValue',
                setting: 'gridModule',
                min: 0.5,
                max: 20,
                decimals: 4,
                baseStep: 0.0001,
                shiftStep: 0.1,
                onUpdate: () => {
                    this.gridCalculator.calculateRowCount();
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            marginsSlider: {
                valueId: 'marginsValue',
                setting: 'margins',
                min: 0,
                max: 10,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => {
                    if (this.settings.get('linkMode') === 'module') {
                        this.calculateModule();
                    } else {
                        this.gridCalculator.calculateRowCount();
                    }
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            columnCountSlider: {
                valueId: 'columnCountValue',
                setting: 'columnCount',
                min: 1,
                max: 24,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.constrainAllObjectsToGrid();
                    this.updateGrid();
                }
            },
            rowCountSlider: {
                valueId: 'rowCountValue',
                setting: 'rowCount',
                min: 1,
                max: 50,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    const linkMode = this.settings.get('linkMode');
                    if (linkMode === 'module') {
                        this.calculateModule();
                    } else if (linkMode === 'rows-height') {
                        this.gridCalculator.calculateRowHeight();
                    }
                    this.constrainAllObjectsToGrid();
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            rowHeightSlider: {
                valueId: 'rowHeightValue',
                setting: 'rowHeight',
                min: 1,
                max: 20,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    const linkMode = this.settings.get('linkMode');
                    if (linkMode === 'module') {
                        this.calculateModule();
                    } else if (linkMode === 'rows-height') {
                        this.gridCalculator.calculateRowCount();
                    }
                    this.constrainAllObjectsToGrid();
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            // Typography sliders
            headlineSizeSlider: {
                valueId: 'headlineSizeValue',
                setting: 'headlineSize',
                min: 0.25,
                max: 10,
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            lineHeightSlider: {
                valueId: 'lineHeightValue',
                setting: 'lineHeight',
                min: 0.25,
                max: 10,
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            trackingSlider: {
                valueId: 'trackingValue',
                setting: 'tracking',
                min: -0.05,
                max: 0.05,
                decimals: 3,
                baseStep: 0.005,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            },
            textSizeSlider: {
                valueId: 'textSizeValue',
                setting: 'textSize',
                min: 0.25,
                max: 10,
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            textLineHeightSlider: {
                valueId: 'textLineHeightValue',
                setting: 'textLineHeight',
                min: 0.25,
                max: 10,
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            textTrackingSlider: {
                valueId: 'textTrackingValue',
                setting: 'textTracking',
                min: -0.05,
                max: 0.05,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            }
        };

        // Инициализируем каждый слайдер
        Object.keys(sliderConfigs).forEach(sliderId => {
            this.sliderController.initSlider(sliderId, sliderConfigs[sliderId]);
        });
    }

    /**
     * Инициализация панелей
     */
    initializePanels() {
        this.panelManager.registerPanel('controlsPanel', {
            headerId: 'panelHeader',
            draggable: true,
            persistent: true
        });
        
        this.panelManager.registerPanel('gridPanel', {
            headerId: 'gridPanelHeader',
            draggable: true,
            persistent: true
        });
        
        this.panelManager.registerPanel('textPanel', {
            headerId: 'textPanelHeader',
            draggable: true,
            persistent: true
        });
        
        this.panelManager.registerPanel('elementsNavigator', {
            headerId: 'elementsNavigatorHeader',
            draggable: true,
            persistent: true
        });
        
        this.panelManager.registerPanel('paragraphPanel', {
            headerId: 'paragraphPanelHeader',
            draggable: true,
            persistent: false
        });
        
        this.panelManager.registerPanel('graphicsPanel', {
            headerId: 'graphicsPanelHeader',
            draggable: true,
            persistent: false
        });
    }

    /**
     * Инициализация чекбоксов
     */
    initializeCheckboxes() {
        const checkboxes = [
            { id: 'showColumns', setting: 'showColumns' },
            { id: 'showRows', setting: 'showRows' },
            { id: 'showBaseline', setting: 'showBaseline' },
            { id: 'showDimensions', setting: 'showDimensions' },
            { id: 'showObjects', setting: 'showObjects' },
            { id: 'useXHeight', setting: 'useXHeight' },
            { id: 'useXHeight2', setting: 'useXHeight2' }
        ];

        checkboxes.forEach(({ id, setting }) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.settings.set(setting, e.target.checked);
                    this.updateGrid();
                });
            }
        });
    }

    /**
     * Инициализация кнопок
     */
    initializeButtons() {
        // Export SVG
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSVG());
        }

        // Export Settings
        const exportSettingsBtn = document.getElementById('exportSettingsBtn');
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => this.exportSettings());
        }

        // Help Button
        const helpButton = document.getElementById('helpButton');
        if (helpButton) {
            helpButton.addEventListener('click', () => this.showHelp());
        }

        // Add Text Button
        const addTextBtn = document.getElementById('addTextBtn');
        if (addTextBtn) {
            addTextBtn.addEventListener('click', () => this.addTextBlock());
        }

        // Add Graphics Button
        const addGraphicsBtn = document.getElementById('addGraphicsBtn');
        if (addGraphicsBtn) {
            addGraphicsBtn.addEventListener('click', () => this.showAddGraphicsPanel());
        }

        // Lunnen Blue preset button
        const lunnenBlueBtn = document.getElementById('lunnenBlue');
        if (lunnenBlueBtn) {
            lunnenBlueBtn.addEventListener('click', () => {
                this.colorPicker.setPresetColor(COLORS.LUNNEN_BLUE);
            });
        }
    }

    /**
     * Инициализация модальных окон
     */
    initializeModals() {
        const modalOverlay = document.getElementById('modalOverlay');
        const modalClose = document.getElementById('modalClose');

        if (modalClose && modalOverlay) {
            modalClose.addEventListener('click', () => {
                modalOverlay.setAttribute('aria-hidden', 'true');
                modalOverlay.style.display = 'none';
            });

            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    modalOverlay.setAttribute('aria-hidden', 'true');
                    modalOverlay.style.display = 'none';
                }
            });
        }
    }

    /**
     * Инициализация событий
     */
    initializeEvents() {
        // Клавиатурные сокращения
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + E - Export SVG
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                this.exportSVG();
            }
            
            // Cmd/Ctrl + Z - Undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            
            // Cmd/Ctrl + Shift + Z - Redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            }
        });

        // Link Mode radio buttons
        const linkModeRadios = document.querySelectorAll('input[name="linkMode"]');
        linkModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.set('linkMode', e.target.value);
                this.generateRowPresets();
            });
        });
    }

    /**
     * Загрузка встроенной графики
     */
    async initializeBuiltInGraphics() {
        // Загружаем размеры встроенной графики
        await this.graphicsManager.loadBuiltInSVG('icons');
        await this.graphicsManager.loadBuiltInSVG('claim');
    }

    /**
     * Главный метод обновления сетки
     */
    updateGrid() {
        if (this.state.isUpdating) return;
        
        this.state.isUpdating = true;

        try {
            const svg = document.getElementById('gridSvg');
            if (!svg) {
                console.error('SVG element not found');
                return;
            }

            // Очищаем SVG
            svg.innerHTML = '';

            // Обновляем цвет фона
            this.updateBackgroundColor();

            // Отрисовка сетки
            this.gridRenderer.render(svg);

            // Отрисовка элементов если включено
            if (this.settings.get('showObjects')) {
                this.renderElements(svg);
            }

            // Обновляем навигатор элементов
            this.elementsNavigator.update();

        } catch (error) {
            console.error('Error updating grid:', error);
        } finally {
            this.state.isUpdating = false;
        }
    }

    /**
     * Отрисовка всех элементов (текст и графика)
     */
    renderElements(svg) {
        // Рендерим графические блоки
        const visibleGraphics = this.graphicsManager.getVisibleBlocks();
        if (visibleGraphics.length > 0) {
            this.graphicsRenderer.renderAll(svg, visibleGraphics);
        }

        // Рендерим текстовые блоки
        const visibleText = this.textBlockManager.getVisibleBlocks();
        if (visibleText.length > 0) {
            this.textRenderer.renderAll(svg, visibleText);
        }
    }

    /**
     * Обновление цвета фона
     */
    updateBackgroundColor() {
        const color = this.settings.get('boxColor');
        document.body.style.backgroundColor = color;
    }

    /**
     * Генерация пресетов для строк
     */
    generateRowPresets() {
        const container = document.getElementById('rowPresetsContainer');
        if (!container) return;

        this.gridPresets.generatePresetButtons(container, (rowCount, rowHeight) => {
            this.settings.set('rowCount', rowCount);
            this.settings.set('rowHeight', rowHeight);
            this.sliderController.setValue('rowCountSlider', rowCount, false);
            this.sliderController.setValue('rowHeightSlider', rowHeight, false);
            this.updateGrid();
        });
    }

    /**
     * Обновление состояния кнопок пресетов
     */
    updatePresetButtons() {
        this.gridPresets.updateButtonStates();
    }

    /**
     * Расчет модуля из высоты и количества строк
     */
    calculateModule() {
        const newModule = this.gridCalculator.calculateModuleFromHeight();
        this.settings.set('gridModule', newModule);
        this.sliderController.setValue('gridModuleSlider', newModule, false);
    }

    /**
     * Ограничение всех объектов к текущей сетке
     */
    constrainAllObjectsToGrid() {
        this.textBlockManager.constrainAllToGrid();
        this.graphicsManager.constrainAllToGrid();
    }

    /**
     * Добавление текстового блока
     */
    addTextBlock() {
        const newBlock = this.textBlockManager.createBlock();
        this.updateGrid();
        
        // Открываем панель редактирования
        setTimeout(() => {
            this.elementsNavigator.selectElement('text', newBlock.id);
        }, 100);
    }

    /**
     * Показать панель добавления графики
     */
    showAddGraphicsPanel() {
        this.panelManager.open('graphicsPanel');
    }

    /**
     * Обработчик выбора элемента
     */
    onElementSelect(type, blockId) {
        console.log('Element selected:', type, blockId);
        // Здесь можно открыть панель редактирования элемента
    }

    /**
     * Обработчик удаления элемента
     */
    onElementDelete(type, blockId) {
        console.log('Element deleted:', type, blockId);
    }

    /**
     * Обработчик переключения видимости элемента
     */
    onElementVisibilityToggle(type, blockId) {
        console.log('Element visibility toggled:', type, blockId);
    }

    /**
     * Обработчик изменения цвета
     */
    onColorChange(color) {
        this.updateGrid();
    }

    /**
     * Обработчики drag & drop
     */
    onDragStart(id, type, data) {
        console.log('Drag start:', id, type);
    }

    onDrag(id, type, deltaX, deltaY, data) {
        // Обновление в реальном времени если нужно
    }

    onDragEnd(id, type, position, data) {
        console.log('Drag end:', id, type, position);
        this.updateGrid();
    }

    /**
     * Экспорт SVG
     */
    exportSVG() {
        const svg = document.getElementById('gridSvg');
        if (!svg) {
            console.error('SVG element not found');
            return;
        }

        this.svgExporter.exportToFile(svg, 'grid-layout.svg');
    }

    /**
     * Экспорт настроек
     */
    exportSettings() {
        const settingsData = {
            settings: this.settings.getAll(),
            textBlocks: this.textBlockManager.exportData(),
            graphicsBlocks: this.graphicsManager.exportData()
        };

        this.svgExporter.exportSettings(settingsData, 'grid-settings.json');
    }

    /**
     * Показать справку
     */
    showHelp() {
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'flex';
            modalOverlay.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Undo
     */
    undo() {
        // TODO: Реализация отмены действий
        console.log('Undo not yet implemented');
    }

    /**
     * Redo
     */
    redo() {
        // TODO: Реализация повтора действий
        console.log('Redo not yet implemented');
    }
}
