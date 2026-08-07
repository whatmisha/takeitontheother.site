/**
 * Централизованное кэширование DOM элементов
 * 
 * Все DOM-элементы кэшируются один раз при инициализации,
 * затем доступны через геттеры для предотвращения повторных querySelector.
 */

export class DOMCache {
    constructor() {
        this._cache = null;
    }

    /**
     * Инициализация кэша DOM элементов
     * Должна вызываться после загрузки DOM
     */
    init() {
        this._cache = {
            // ============================================
            // Main SVG
            // ============================================
            svg: document.getElementById('gridSvg'),
            canvasContainer: document.getElementById('canvasContainer'),
            
            // ============================================
            // Dimension sliders
            // ============================================
            frontWidthSlider: document.getElementById('frontWidthSlider'),
            frontHeightSlider: document.getElementById('frontHeightSlider'),
            thicknessSlider: document.getElementById('thicknessSlider'),
            frontWidthValue: document.getElementById('frontWidthValue'),
            frontHeightValue: document.getElementById('frontHeightValue'),
            thicknessValue: document.getElementById('thicknessValue'),
            
            // ============================================
            // Grid sliders
            // ============================================
            gridModuleSlider: document.getElementById('gridModuleSlider'),
            gridModuleValue: document.getElementById('gridModuleValue'),
            lockModuleBtn: document.getElementById('lockModuleBtn'),
            marginsSlider: document.getElementById('marginsSlider'),
            marginsValue: document.getElementById('marginsValue'),
            lockMarginsBtn: document.getElementById('lockMarginsBtn'),
            marginsUnitMod: document.getElementById('marginsUnitMod'),
            marginsUnitMm: document.getElementById('marginsUnitMm'),
            columnCountSlider: document.getElementById('columnCountSlider'),
            columnCountValue: document.getElementById('columnCountValue'),
            rowCountSlider: document.getElementById('rowCountSlider'),
            rowCountValue: document.getElementById('rowCountValue'),
            rowHeightSlider: document.getElementById('rowHeightSlider'),
            rowHeightValue: document.getElementById('rowHeightValue'),
            linkedControlsContainer: document.getElementById('linkedControlsContainer'),
            
            // ============================================
            // Checkboxes
            // ============================================
            showSidePanels: document.getElementById('showSidePanels'),
            showColumns: document.getElementById('showColumns'),
            showRows: document.getElementById('showRows'),
            showBaseline: document.getElementById('showBaseline'),
            showObjects: document.getElementById('showObjects'),

            // ============================================
            // Side surface settings
            // ============================================
            surfaceSettingsSelect: document.getElementById('surfaceSettingsSelect'),
            surfaceVisibleToggle: document.getElementById('surfaceVisibleToggle'),
            surfaceOwnGridToggle: document.getElementById('surfaceOwnGridToggle'),
            surfaceRotationOptions: document.getElementById('surfaceRotationOptions'),
            surfaceOwnGridControls: document.getElementById('surfaceOwnGridControls'),
            surfaceGridModuleInput: document.getElementById('surfaceGridModuleInput'),
            surfaceGridMarginsInput: document.getElementById('surfaceGridMarginsInput'),
            surfaceGridColumnsInput: document.getElementById('surfaceGridColumnsInput'),
            surfaceGridRowsInput: document.getElementById('surfaceGridRowsInput'),
            surfaceGridRowHeightInput: document.getElementById('surfaceGridRowHeightInput'),
            
            // ============================================
            // Link mode
            // ============================================
            linkModeOff: document.getElementById('linkModeOff'),
            linkModeRowsHeight: document.getElementById('linkModeRowsHeight'),
            linkModeModule: document.getElementById('linkModeModule'),
            
            // ============================================
            // Color controls
            // ============================================
            colorPreview: document.getElementById('colorPreview'),
            hexColorInput: document.getElementById('hexColorInput'),
            lunnenBlue: document.getElementById('lunnenBlue'),
            hsbPicker: document.getElementById('hsbPicker'),
            hueSlider: document.getElementById('hueSlider'),
            saturationSlider: document.getElementById('saturationSlider'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            hueValue: document.getElementById('hueValue'),
            saturationValue: document.getElementById('saturationValue'),
            brightnessValue: document.getElementById('brightnessValue'),
            
            // ============================================
            // Action buttons
            // ============================================
            exportBtn: document.getElementById('exportBtn'),
            exportPDFBtn: document.getElementById('exportPDFBtn'),
            convertToOutlinesCheckbox: document.getElementById('convertToOutlinesCheckbox'),
            exportSettingsBtn: document.getElementById('exportSettingsBtn'),
            importSettingsBtn: document.getElementById('importSettingsBtn'),
            
            // ============================================
            // Preset dropdown
            // ============================================
            presetDropdown: document.getElementById('presetDropdown'),
            presetDropdownToggle: document.getElementById('presetDropdownToggle'),
            presetDropdownMenu: document.getElementById('presetDropdownMenu'),
            
            // ============================================
            // Typography - Headline
            // ============================================
            headlineSizeSlider: document.getElementById('headlineSizeSlider'),
            headlineSizeValue: document.getElementById('headlineSizeValue'),
            headlineSizeUnitMod: document.getElementById('headlineSizeUnitMod'),
            headlineSizeUnitPt: document.getElementById('headlineSizeUnitPt'),
            lineHeightSlider: document.getElementById('lineHeightSlider'),
            lineHeightValue: document.getElementById('lineHeightValue'),
            headlineLineHeightUnitMod: document.getElementById('headlineLineHeightUnitMod'),
            headlineLineHeightUnitPt: document.getElementById('headlineLineHeightUnitPt'),
            trackingSlider: document.getElementById('trackingSlider'),
            trackingValue: document.getElementById('trackingValue'),
            useXHeight: document.getElementById('useXHeight'),
            headlineFontSize: document.getElementById('headlineFontSize'),
            
            // ============================================
            // Typography - Text
            // ============================================
            textSizeSlider: document.getElementById('textSizeSlider'),
            textSizeValue: document.getElementById('textSizeValue'),
            textSizeUnitMod: document.getElementById('textSizeUnitMod'),
            textSizeUnitPt: document.getElementById('textSizeUnitPt'),
            textLineHeightSlider: document.getElementById('textLineHeightSlider'),
            textLineHeightValue: document.getElementById('textLineHeightValue'),
            textLineHeightUnitMod: document.getElementById('textLineHeightUnitMod'),
            textLineHeightUnitPt: document.getElementById('textLineHeightUnitPt'),
            textTrackingSlider: document.getElementById('textTrackingSlider'),
            textTrackingValue: document.getElementById('textTrackingValue'),
            useXHeight2: document.getElementById('useXHeight2'),
            textFontSize: document.getElementById('textFontSize'),
            
            // ============================================
            // Typography - Caption
            // ============================================
            captionSizeSlider: document.getElementById('captionSizeSlider'),
            captionSizeValue: document.getElementById('captionSizeValue'),
            captionSizeUnitMod: document.getElementById('captionSizeUnitMod'),
            captionSizeUnitPt: document.getElementById('captionSizeUnitPt'),
            captionLineHeightSlider: document.getElementById('captionLineHeightSlider'),
            captionLineHeightValue: document.getElementById('captionLineHeightValue'),
            captionLineHeightUnitMod: document.getElementById('captionLineHeightUnitMod'),
            captionLineHeightUnitPt: document.getElementById('captionLineHeightUnitPt'),
            captionTrackingSlider: document.getElementById('captionTrackingSlider'),
            captionTrackingValue: document.getElementById('captionTrackingValue'),
            useXHeightCaption: document.getElementById('useXHeightCaption'),
            captionFontSize: document.getElementById('captionFontSize'),
            
            // ============================================
            // Typography - Lunnen Display
            // ============================================
            lunnenDisplaySizeSlider: document.getElementById('lunnenDisplaySizeSlider'),
            lunnenDisplaySizeValue: document.getElementById('lunnenDisplaySizeValue'),
            lunnenDisplaySizeUnitMod: document.getElementById('lunnenDisplaySizeUnitMod'),
            lunnenDisplaySizeUnitPt: document.getElementById('lunnenDisplaySizeUnitPt'),
            lunnenDisplayLineHeightSlider: document.getElementById('lunnenDisplayLineHeightSlider'),
            lunnenDisplayLineHeightValue: document.getElementById('lunnenDisplayLineHeightValue'),
            lunnenDisplayLineHeightUnitMod: document.getElementById('lunnenDisplayLineHeightUnitMod'),
            lunnenDisplayLineHeightUnitPt: document.getElementById('lunnenDisplayLineHeightUnitPt'),
            lunnenDisplayTrackingSlider: document.getElementById('lunnenDisplayTrackingSlider'),
            lunnenDisplayTrackingValue: document.getElementById('lunnenDisplayTrackingValue'),
            lunnenDisplayFontSize: document.getElementById('lunnenDisplayFontSize'),
            
            // ============================================
            // Paragraph settings panel
            // ============================================
            paragraphPanel: document.getElementById('paragraphPanel'),
            paragraphPanelTitle: document.getElementById('paragraphPanelTitle'),
            paragraphXInput: document.getElementById('paragraphXInput'),
            paragraphRowInput: document.getElementById('paragraphRowInput'),
            paragraphBaselineInput: document.getElementById('paragraphBaselineInput'),
            paragraphWidthInput: document.getElementById('paragraphWidthInput'),
            paragraphTextArea: document.getElementById('paragraphTextArea'),
            charCounter: document.getElementById('charCounter'),
            paragraphStyleSelect: document.getElementById('paragraphStyleSelect'),
            paragraphSurfaceSelect: document.getElementById('paragraphSurfaceSelect'),
            
            // Alignment controls
            alignmentModeBaseline: document.getElementById('alignmentModeBaseline'),
            alignmentModeXHeight: document.getElementById('alignmentModeXHeight'),
            alignmentModeCapHeight: document.getElementById('alignmentModeCapHeight'),
            paragraphLockPositionToggle: document.getElementById('paragraphLockPositionToggle'),
            paragraphAlignRightToggle: document.getElementById('paragraphAlignRightToggle'),
            textAlignmentLeft: document.getElementById('textAlignmentLeft'),
            textAlignmentCenter: document.getElementById('textAlignmentCenter'),
            textAlignmentRight: document.getElementById('textAlignmentRight'),
            
            // ============================================
            // Graphics panel
            // ============================================
            graphicsPanel: document.getElementById('graphicsPanel'),
            graphicsPanelTitle: document.getElementById('graphicsPanelTitle'),
            graphicsXInput: document.getElementById('graphicsXInput'),
            graphicsRowInput: document.getElementById('graphicsRowInput'),
            graphicsBaselineInput: document.getElementById('graphicsBaselineInput'),
            graphicsWidthInput: document.getElementById('graphicsWidthInput'),
            graphicsHeightInput: document.getElementById('graphicsHeightInput'),
            graphicsSizeModeWidth: document.getElementById('graphicsSizeModeWidth'),
            graphicsSizeModeHeight: document.getElementById('graphicsSizeModeHeight'),
            graphicsWidthGroup: document.getElementById('graphicsWidthGroup'),
            graphicsHeightGroup: document.getElementById('graphicsHeightGroup'),
            graphicsLockPositionToggle: document.getElementById('graphicsLockPositionToggle'),
            graphicsAlignRightToggle: document.getElementById('graphicsAlignRightToggle'),
            graphicsSurfaceSelect: document.getElementById('graphicsSurfaceSelect'),
            fileUploadArea: document.getElementById('fileUploadArea'),
            svgFileInput: document.getElementById('svgFileInput'),
            
            // ============================================
            // Elements navigator
            // ============================================
            elementsNavigator: document.getElementById('elementsNavigator'),
            elementsNavigatorHeader: document.getElementById('elementsNavigatorHeader'),
            elementsList: document.getElementById('elementsList'),
            addTextBtn: document.getElementById('addTextBtn'),
            addGraphicsBtn: document.getElementById('addGraphicsBtn'),
            
            // ============================================
            // Zoom indicator
            // ============================================
            zoomIndicator: document.getElementById('zoomIndicator'),
            canvasRotateLeftBtn: document.getElementById('canvasRotateLeftBtn'),
            
            // ============================================
            // Panel params displays
            // ============================================
            gridParams: document.getElementById('gridParams'),
            dimensionsParams: document.getElementById('dimensionsParams'),
            textStylesParams: document.getElementById('textStylesParams'),
            objectsParams: document.getElementById('objectsParams')
        };
        
        // Дополнительная инициализация для элементов, которые требуют поиска внутри других
        this._cache.presetDropdownText = this._cache.presetDropdownToggle?.querySelector('.preset-dropdown-text');
        
        return this;
    }

    /**
     * Получить элемент из кэша
     * @param {string} key - ключ элемента
     * @returns {HTMLElement|null}
     */
    get(key) {
        if (!this._cache) {
            console.warn('DOMCache not initialized. Call init() first.');
            return null;
        }
        return this._cache[key] || null;
    }

    /**
     * Проверить наличие элемента в кэше
     * @param {string} key - ключ элемента
     * @returns {boolean}
     */
    has(key) {
        return this._cache && this._cache[key] != null;
    }

    /**
     * Получить весь кэш (для обратной совместимости)
     * @returns {Object}
     */
    getAll() {
        return this._cache || {};
    }

    /**
     * Добавить или обновить элемент в кэше
     * @param {string} key - ключ элемента
     * @param {HTMLElement|null} value - элемент
     */
    set(key, value) {
        if (!this._cache) {
            console.warn('DOMCache not initialized. Call init() first.');
            return;
        }
        this._cache[key] = value;
    }

    /**
     * Proxy для доступа к элементам как к свойствам (для обратной совместимости с this.dom.element)
     * @returns {Proxy}
     */
    createProxy() {
        const cache = this;
        return new Proxy({}, {
            get(target, prop) {
                return cache.get(prop);
            },
            set(target, prop, value) {
                // Позволяем динамическое добавление элементов в кэш
                cache.set(prop, value);
                return true;
            }
        });
    }
}
