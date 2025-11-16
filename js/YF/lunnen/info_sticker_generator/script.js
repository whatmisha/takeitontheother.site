// ============================================
// Импорты модулей
// ============================================
import { ColorUtils } from './src/utils/ColorUtils.js';
import { MathUtils } from './src/utils/MathUtils.js';
import { DOMUtils } from './src/utils/DOMUtils.js';
import { Settings } from './src/core/Settings.js';
import { GridCalculator } from './src/grid/GridCalculator.js';
import { GridRenderer } from './src/grid/GridRenderer.js';
import { SliderController } from './src/ui/SliderController.js';
import { ColorPicker } from './src/ui/ColorPicker.js';
import { PanelManager } from './src/ui/PanelManager.js';
import { SVGExporter } from './src/svg/SVGExporter.js';

class StickerGenerator {
    constructor() {
        // Slider configuration
        this.SLIDER_CONFIG = {
            widthSlider: {
                valueId: 'widthValue',
                setting: 'width',
                min: 50,
                max: 300,
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            heightSlider: {
                valueId: 'heightValue',
                setting: 'height',
                min: 10,
                max: 100,
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            gridModuleSlider: {
                valueId: 'gridModuleValue',
                setting: 'gridModule',
                min: 0.5,
                max: 10,
                decimals: 4,
                baseStep: 0.0001,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            marginsSlider: {
                valueId: 'marginsValue',
                setting: 'margins',
                min: 0,
                max: 20,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            columnCountSlider: {
                valueId: 'columnCountValue',
                setting: 'columnCount',
                min: 1,
                max: 12,
                decimals: 0,
                baseStep: 1,
                shiftStep: 5,
                onUpdate: () => this.updateGrid()
            },
            baselineModulesSlider: {
                valueId: 'baselineModulesValue',
                setting: 'baselineModules',
                min: 1,
                max: 20,
                decimals: 0,
                baseStep: 1,
                shiftStep: 5,
                onUpdate: () => this.updateGrid()
            },
            hueSlider: {
                valueId: 'hueValue',
                setting: null,
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
                setting: null,
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
                setting: null,
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateSaturationGradient();
                }
            }
        };
        
        // Settings
        this.settingsModule = new Settings({
            width: 120,
            height: 25,
            backgroundColor: '#ffffff',
            gridModule: 4.1667,  // 25mm / 6 baseline modules
            margins: 3,
            columnCount: 3,
            baselineModules: 6,
            showColumns: true,
            showBaseline: true
        });
        
        // Proxy for backward compatibility
        this.settings = new Proxy({}, {
            get: (target, prop) => {
                return this.settingsModule.get(prop);
            },
            set: (target, prop, value) => {
                this.settingsModule.set(prop, value);
                return true;
            }
        });
        
        // Grid Calculator
        this.gridCalculator = new GridCalculator(this.settingsModule);
        
        // Grid Renderer
        this.gridRenderer = new GridRenderer(this.settingsModule, this.gridCalculator);
        
        // UI Controllers
        this.sliderController = null;
        this.colorPicker = null;
        this.panelManager = null;
        
        // SVG Exporter
        this.svgExporter = new SVGExporter(this.settingsModule);
        
        // Cache DOM elements
        this.cacheDOMElements();
        
        // Initialize UI Controllers
        this.initializeUIControllers();
        
        // Initialize color picker
        this.initializeColorPicker();
        
        // Initialize panels
        this.initializePanels();
        
        // Initialize export button
        this.initializeExportButton();
        
        // Initialize help modal
        this.initializeHelpModal();
        
        // Initial render
        this.updateGrid();
    }
    
    cacheDOMElements() {
        // Canvas
        this.canvas = document.getElementById('gridSvg');
        this.canvasContainer = document.getElementById('canvasContainer');
        
        // Panels
        this.gridPanel = document.getElementById('gridPanel');
        this.controlsPanel = document.getElementById('controlsPanel');
        
        // Sliders
        this.sliders = {};
        Object.keys(this.SLIDER_CONFIG).forEach(key => {
            this.sliders[key] = document.getElementById(key);
        });
        
        // Checkboxes
        this.showColumnsCheckbox = document.getElementById('showColumns');
        this.showBaselineCheckbox = document.getElementById('showBaseline');
        
        // Color inputs
        this.hexColorInput = document.getElementById('hexColorInput');
        this.colorPreview = document.getElementById('colorPreview');
        this.hsbPicker = document.getElementById('hsbPicker');
        
        // Buttons
        this.exportBtn = document.getElementById('exportBtn');
        this.helpButton = document.getElementById('helpButton');
        
        // Modal
        this.modalOverlay = document.getElementById('modalOverlay');
        this.modalClose = document.getElementById('modalClose');
        
        // Panel params displays
        this.gridParams = document.getElementById('gridParams');
        this.dimensionsParams = document.getElementById('dimensionsParams');
    }
    
    initializeUIControllers() {
        // Initialize SliderController
        this.sliderController = new SliderController(
            this.SLIDER_CONFIG,
            this.settingsModule,
            () => {} // No update callback needed, handled in SLIDER_CONFIG
        );
        
        // Setup checkboxes
        this.showColumnsCheckbox.addEventListener('change', () => {
            this.settings.showColumns = this.showColumnsCheckbox.checked;
            this.updateGrid();
        });
        
        this.showBaselineCheckbox.addEventListener('change', () => {
            this.settings.showBaseline = this.showBaselineCheckbox.checked;
            this.updateGrid();
        });
    }
    
    initializeColorPicker() {
        this.colorPicker = new ColorPicker({
            hexInput: this.hexColorInput,
            colorPreview: this.colorPreview,
            hsbPicker: this.hsbPicker,
            hueSlider: document.getElementById('hueSlider'),
            saturationSlider: document.getElementById('saturationSlider'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            hueValue: document.getElementById('hueValue'),
            saturationValue: document.getElementById('saturationValue'),
            brightnessValue: document.getElementById('brightnessValue'),
            onColorChange: (color) => {
                this.settings.backgroundColor = color;
                this.updateGrid();
            }
        });
        
        // Set initial color
        this.colorPicker.setColor(this.settings.backgroundColor);
    }
    
    initializePanels() {
        this.panelManager = new PanelManager([
            this.gridPanel,
            this.controlsPanel
        ]);
    }
    
    initializeExportButton() {
        this.exportBtn.addEventListener('click', () => {
            this.exportSVG();
        });
        
        // Keyboard shortcut for export (Cmd/Ctrl + E)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                this.exportSVG();
            }
        });
    }
    
    initializeHelpModal() {
        this.helpButton.addEventListener('click', () => {
            this.modalOverlay.classList.add('active');
            this.modalOverlay.setAttribute('aria-hidden', 'false');
        });
        
        this.modalClose.addEventListener('click', () => {
            this.closeModal();
        });
        
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.closeModal();
            }
        });
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalOverlay.classList.contains('active')) {
                this.closeModal();
            }
        });
    }
    
    closeModal() {
        this.modalOverlay.classList.remove('active');
        this.modalOverlay.setAttribute('aria-hidden', 'true');
    }
    
    updateColorFromHSB() {
        const hue = parseFloat(document.getElementById('hueValue').value);
        const saturation = parseFloat(document.getElementById('saturationValue').value);
        const brightness = parseFloat(document.getElementById('brightnessValue').value);
        
        const hex = ColorUtils.hsbToHex(hue, saturation, brightness);
        this.hexColorInput.value = hex;
        this.colorPreview.style.backgroundColor = hex;
        this.settings.backgroundColor = hex;
        this.updateGrid();
    }
    
    updateSaturationGradient() {
        const hue = parseFloat(document.getElementById('hueValue').value);
        const brightness = parseFloat(document.getElementById('brightnessValue').value);
        
        const colorAtZero = ColorUtils.hsbToHex(hue, 0, brightness);
        const colorAtHundred = ColorUtils.hsbToHex(hue, 100, brightness);
        
        const saturationSlider = document.getElementById('saturationSlider');
        saturationSlider.style.background = `linear-gradient(to right, ${colorAtZero}, ${colorAtHundred})`;
    }
    
    updateBrightnessGradient() {
        const hue = parseFloat(document.getElementById('hueValue').value);
        const saturation = parseFloat(document.getElementById('saturationValue').value);
        
        const colorAtZero = ColorUtils.hsbToHex(hue, saturation, 0);
        const colorAtHundred = ColorUtils.hsbToHex(hue, saturation, 100);
        
        const brightnessSlider = document.getElementById('brightnessSlider');
        brightnessSlider.style.background = `linear-gradient(to right, ${colorAtZero}, ${colorAtHundred})`;
    }
    
    updateGrid() {
        // Render grid using GridRenderer
        this.gridRenderer.renderStickerGrid(this.canvas);
        
        // Update panel params
        this.updatePanelParams();
    }
    
    updatePanelParams() {
        // Update grid params (module)
        const module = this.settings.gridModule;
        this.gridParams.textContent = `${module.toFixed(2)} mm`;
        
        // Update dimensions params
        const width = this.settings.width;
        const height = this.settings.height;
        this.dimensionsParams.textContent = `${width}×${height} mm`;
        
        // Show params when panel is collapsed
        const gridPanelCollapsed = this.gridPanel.classList.contains('panel-collapsed');
        const controlsPanelCollapsed = this.controlsPanel.classList.contains('panel-collapsed');
        
        this.gridParams.style.opacity = gridPanelCollapsed ? '0.4' : '0';
        this.dimensionsParams.style.opacity = controlsPanelCollapsed ? '0.4' : '0';
    }
    
    exportSVG() {
        // Use SVGExporter to export
        const svgContent = this.svgExporter.exportStickerSVG(this.canvas);
        
        // Create blob and download
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sticker_${this.settings.width}x${this.settings.height}mm.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.stickerGenerator = new StickerGenerator();
});

