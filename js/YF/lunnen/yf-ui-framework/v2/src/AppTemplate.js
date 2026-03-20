/**
 * AppTemplate — шаблон приложения на YF UI Framework.
 *
 * Демонстрирует подключение и инициализацию всех модулей фреймворка.
 * Не содержит бизнес-логики — только wiring и примеры вызовов.
 *
 * Используйте как отправную точку: скопируйте, переименуйте класс
 * и замените update() / getStateSnapshot() / restoreState() своей логикой.
 */

import { Settings }       from './core/Settings.js';
import { DOMCache }        from './core/DOMCache.js';
import { ZoomPanManager }  from './ui/ZoomPanManager.js';
import { SliderController } from './ui/SliderController.js';
import { PanelManager }    from './ui/PanelManager.js';
import { ColorPicker }     from './ui/ColorPicker.js';
import { DragDropManager }  from './ui/DragDropManager.js';
import { HistoryManager }  from './history/HistoryManager.js';
import { PresetManager }   from './preset/PresetManager.js';
import { SVGExporter }     from './export/SVGExporter.js';

class AppTemplate {

    /** @param {Object} [overrides] — переопределения настроек по умолчанию */
    constructor(overrides = {}) {
        const defaults = {
            width:      500,
            height:     500,
            color:      '#808080',
            showLayer1: true,
            showLayer2: true,
            showLayer3: true,
            ...overrides
        };

        /** @type {Settings} */
        this.settingsStore = new Settings(defaults);

        /** Proxy-обёртка — позволяет обращаться к настройкам как к свойствам */
        this.settings = this.settingsStore.createProxy();

        /** @type {DOMCache} */
        this.domCache = new DOMCache();

        /** Proxy-обёртка для быстрого доступа к DOM-элементам */
        this.dom = null;

        /** @type {{ isInitialized: boolean, isUpdating: boolean }} */
        this.state = { isInitialized: false, isUpdating: false };

        /** @type {ZoomPanManager|null} */
        this.zoomPan = null;
        /** @type {SliderController|null} */
        this.sliders = null;
        /** @type {PanelManager|null} */
        this.panels = null;
        /** @type {ColorPicker|null} */
        this.colorPicker = null;
        /** @type {DragDropManager|null} */
        this.dragDrop = null;
        /** @type {HistoryManager|null} */
        this.historyManager = null;
        /** @type {PresetManager|null} */
        this.presetManager = null;
        /** @type {SVGExporter|null} */
        this.svgExporter = null;
    }

    /* ------------------------------------------------------------------ */
    /*  Инициализация                                                     */
    /* ------------------------------------------------------------------ */

    /** Главная точка входа — вызывается после DOMContentLoaded */
    async init() {
        this.domCache.init({
            svg:                   'mainSvg',
            canvas:                'canvasContainer',
            widthSlider:           'widthSlider',
            widthValue:            'widthValue',
            heightSlider:          'heightSlider',
            heightValue:           'heightValue',
            zoomIndicator:         'zoomIndicator',
            presetDropdown:        'presetDropdown',
            presetDropdownToggle:  'presetDropdownToggle',
            presetDropdownMenu:    'presetDropdownMenu'
        });

        this.dom = this.domCache.createProxy();

        this.initSliders();
        this.initPanels();
        this.initColorPicker();
        this.initZoom();
        this.initHistory();
        this.initPresets();
        this.initExporter();
        this.initCheckboxes();
        this.initCollapse();
        this.initButtons();
        this.initModals();
        this.initKeyboardShortcuts();

        this.update();

        this.state.isInitialized = true;
        console.log('App initialized');
    }

    /* ------------------------------------------------------------------ */
    /*  Слайдеры                                                          */
    /* ------------------------------------------------------------------ */

    /** Инициализирует слайдеры ширины и высоты */
    initSliders() {
        this.sliders = new SliderController(this.settingsStore);

        this.sliders.initSlider('widthSlider', {
            valueId:  'widthValue',
            setting:  'width',
            min:      50,
            max:      1000,
            decimals: 1,
            baseStep: 0.5,
            shiftStep: 10,
            onUpdate: () => this.update()
        });

        this.sliders.initSlider('heightSlider', {
            valueId:  'heightValue',
            setting:  'height',
            min:      50,
            max:      1000,
            decimals: 1,
            baseStep: 0.5,
            shiftStep: 10,
            onUpdate: () => this.update()
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Панели                                                            */
    /* ------------------------------------------------------------------ */

    /** Регистрирует перетаскиваемые панели */
    initPanels() {
        this.panels = new PanelManager();

        this.panels.registerPanel('mainPanel', {
            headerId:   'mainPanelHeader',
            draggable:  true,
            persistent: true
        });

        this.panels.registerPanel('secondaryPanel', {
            headerId:   'secondaryPanelHeader',
            draggable:  true,
            persistent: true
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Цвет                                                              */
    /* ------------------------------------------------------------------ */

    /** Создаёт и инициализирует пикер цвета */
    initColorPicker() {
        this.colorPicker = new ColorPicker(this.settingsStore, {
            settingKey:   'color',
            defaultColor: '#808080',
            onChange:      () => this.update()
        });

        this.colorPicker.init();
    }

    /* ------------------------------------------------------------------ */
    /*  Зум и панорамирование                                             */
    /* ------------------------------------------------------------------ */

    /** Настраивает ZoomPanManager и индикатор зума */
    initZoom() {
        const svg    = this.dom.svg;
        const canvas = this.dom.canvas;

        this.zoomPan = new ZoomPanManager(canvas, svg);

        canvas.addEventListener('zoomchange', () => {
            const indicator = this.dom.zoomIndicator;
            if (indicator) {
                indicator.textContent = `${this.zoomPan.getZoomPercent()}%`;
            }
        });

        const indicator = this.dom.zoomIndicator;
        if (indicator) {
            indicator.addEventListener('click', () => this.zoomPan.resetZoom());
        }

        setTimeout(() => this.zoomPan.fitToScreen(), 100);
    }

    /* ------------------------------------------------------------------ */
    /*  История                                                           */
    /* ------------------------------------------------------------------ */

    /** Инициализирует менеджер истории (undo/redo) */
    initHistory() {
        this.historyManager = new HistoryManager({ maxSize: 50 });
    }

    /* ------------------------------------------------------------------ */
    /*  Пресеты                                                           */
    /* ------------------------------------------------------------------ */

    /** Подключает менеджер пресетов к dropdown-элементам */
    initPresets() {
        this.presetManager = new PresetManager({
            dropdown:       this.dom.presetDropdown,
            dropdownToggle: this.dom.presetDropdownToggle,
            dropdownMenu:   this.dom.presetDropdownMenu,
            onPresetLoad:   (data) => {
                this.settingsStore.fromJSON(data);
                this.update();
            }
        });

        this.presetManager.init();
    }

    /* ------------------------------------------------------------------ */
    /*  Экспорт                                                           */
    /* ------------------------------------------------------------------ */

    /** Создаёт SVG-экспортёр */
    initExporter() {
        this.svgExporter = new SVGExporter();
    }

    /* ------------------------------------------------------------------ */
    /*  Чекбоксы (toggle chips)                                           */
    /* ------------------------------------------------------------------ */

    /** Связывает toggle-chip чекбоксы с настройками */
    initCheckboxes() {
        const chips = document.querySelectorAll('.toggle-chip input[type="checkbox"]');

        chips.forEach((checkbox) => {
            const key = checkbox.dataset.setting;
            if (!key) return;

            checkbox.checked = this.settingsStore.get(key);

            checkbox.addEventListener('change', () => {
                this.settingsStore.set(key, checkbox.checked);
                this.update();
            });

            this.settingsStore.subscribe(key, (value) => {
                checkbox.checked = value;
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Кнопки                                                            */
    /* ------------------------------------------------------------------ */

    /** Привязывает collapse-иконки в панелях */
    initCollapse() {
        document.querySelectorAll('.collapse-icon').forEach((icon) => {
            icon.addEventListener('click', () => {
                const panel = icon.closest('.controls-panel');
                if (panel) {
                    panel.classList.toggle('panel-collapsed');
                    icon.classList.toggle('collapsed');
                }
            });
        });

        document.querySelectorAll('.collapsible-header').forEach((header) => {
            header.addEventListener('click', () => {
                const toggle = header.querySelector('.collapse-toggle');
                const content = header.nextElementSibling;
                if (toggle && content) {
                    const isExpanded = toggle.getAttribute('aria-expanded') !== 'false';
                    toggle.setAttribute('aria-expanded', !isExpanded);
                    content.classList.toggle('collapsed');
                }
            });
        });
    }

    /** Привязывает обработчики к кнопкам интерфейса */
    initButtons() {
        const bind = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };

        bind('exportSvgBtn',  () => this.exportSVG());
        bind('exportPdfBtn',  () => this.exportPDF());
        bind('helpBtn',       () => this.showHelp());
    }

    /* ------------------------------------------------------------------ */
    /*  Модалки                                                           */
    /* ------------------------------------------------------------------ */

    /** Настраивает закрытие модальных окон */
    initModals() {
        const closeModal = (overlay) => {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        };

        document.querySelectorAll('.modal-close').forEach((btn) => {
            btn.addEventListener('click', () => {
                const overlay = btn.closest('.modal-overlay');
                if (overlay) closeModal(overlay);
            });
        });

        document.querySelectorAll('.modal-overlay').forEach((overlay) => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal(overlay);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Горячие клавиши                                                   */
    /* ------------------------------------------------------------------ */

    /** Регистрирует клавиатурные сокращения */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;

            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if (e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            } else if (e.key === 'e') {
                e.preventDefault();
                this.exportSVG();
            }
        });
    }

    /* ================================================================== */
    /*  Основной рендер                                                   */
    /* ================================================================== */

    /**
     * Перерисовывает SVG-контент.
     * Замените тело этого метода своей логикой рендеринга.
     */
    update() {
        if (this.state.isUpdating) return;
        this.state.isUpdating = true;

        try {
            const svg = this.dom?.svg;
            if (!svg) return;

            while (svg.firstChild) svg.removeChild(svg.firstChild);

            const w = this.settings.width;
            const h = this.settings.height;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', w);
            rect.setAttribute('height', h);
            rect.setAttribute('fill', this.settings.color);
            svg.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', w / 2);
            text.setAttribute('y', h / 2);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.setAttribute('fill', '#ffffff');
            text.setAttribute('font-size', '24');
            text.textContent = 'Your Content Here';
            svg.appendChild(text);
        } finally {
            this.state.isUpdating = false;
        }
    }

    /* ================================================================== */
    /*  История: undo / redo                                              */
    /* ================================================================== */

    /** Отменяет последнее действие */
    undo() {
        if (!this.historyManager?.canUndo()) return;
        const prev = this.historyManager.undo();
        if (prev) this.restoreState(prev);
    }

    /** Повторяет отменённое действие */
    redo() {
        if (!this.historyManager?.canRedo()) return;
        const next = this.historyManager.redo();
        if (next) this.restoreState(next);
    }

    /* ================================================================== */
    /*  Экспорт                                                           */
    /* ================================================================== */

    /** Экспортирует текущий SVG в файл */
    exportSVG() {
        const svg = this.dom?.svg;
        if (!svg) return;
        this.svgExporter.exportToFile(svg, 'export.svg', { removeInteractive: true });
    }

    /** Экспортирует текущий SVG в PDF */
    async exportPDF() {
        const svg = this.dom?.svg;
        if (!svg) return;
        await this.svgExporter.exportToPDF(svg, 'export.pdf', { removeInteractive: true });
    }

    /* ================================================================== */
    /*  Модалки                                                           */
    /* ================================================================== */

    /** Показывает модальное окно помощи */
    showHelp() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
        }
    }

    /* ================================================================== */
    /*  Снимки состояния (для HistoryManager)                             */
    /* ================================================================== */

    /**
     * Возвращает сериализуемый снимок текущего состояния.
     * @returns {Object}
     */
    getStateSnapshot() {
        return this.settingsStore.toJSON();
    }

    /**
     * Восстанавливает состояние из снимка и перерисовывает.
     * @param {Object} snapshot
     */
    restoreState(snapshot) {
        this.settingsStore.fromJSON(snapshot);
        this.update();
    }
}

export { AppTemplate };
