// Import shared framework capabilities through the application façade.
import {
    DialogHost,
    SliderController,
    WanderPanelManager
} from './framework/FrameworkAdapter.js?v=g5-feedback-2';
import { ZoomPanManager } from './ui/ZoomPanManager.js';
import { debounce, DEBOUNCE_DELAYS } from './utils/DebounceUtils.js';
import { RadialMode } from './modes/RadialMode.js';
import { RandomMode } from './modes/RandomMode.js';
import { FlowFieldMode } from './modes/FlowFieldMode.js';
import { downloadWanderSvg } from './export/WanderSvgExport.js?v=g7-export-1';

const feedbackDialogHost = new DialogHost();

// Settings storage
const settings = {
    mode: 'radial',
    
    global: {
        length: 62.5,
        width: 25,
        stroke: 22.5,
        strokeAuto: true,  // Auto calculate stroke based on width
        cornerRadius: 12.5,
        cornerRadiusMax: true,  // Keep corner radius at maximum
        arcAmount: 0  // Arc curvature (0-100)
    },
    
    radial: {
        rays: 3,
        rayRotation: 0
    },
    
    random: {
        count: 20,
        length: 100,
        areaWidth: 400,
        areaHeight: 400,
        lengthVariation: 50,  // Percentage variation in length
        randomSeed: 12345
    },
    
    flowfield: {
        density: 50,          // Target number of elements
        areaWidth: 400,       // Width of area
        areaHeight: 400,      // Height of area
        flowScale: 100,       // Scale of Perlin noise field
        flowInfluence: 50,    // How much flow affects rotation (0-100)
        flowSeed: 12345,      // Seed for flow field generation
        spacing: -50          // Spacing between elements (-100 to 100, negative = overlap)
    },
    
    // Helper methods for backward compatibility
    get(key) {
        // Support dot notation (e.g., 'flowfield.density')
        if (key.includes('.')) {
            const [section, prop] = key.split('.');
            return this[section] && this[section][prop];
        }
        // Check global settings first
        if (this.global.hasOwnProperty(key)) {
            return this.global[key];
        }
        // Then check mode-specific settings
        if (this[this.mode] && this[this.mode].hasOwnProperty(key)) {
            return this[this.mode][key];
        }
        return undefined;
    },
    
    set(key, value) {
        // Support dot notation (e.g., 'flowfield.density')
        if (key.includes('.')) {
            const [section, prop] = key.split('.');
            if (this[section] && this[section].hasOwnProperty(prop)) {
                this[section][prop] = value;
            }
            return;
        }
        // Set in global settings if it exists there
        if (this.global.hasOwnProperty(key)) {
            this.global[key] = value;
        }
        // Otherwise set in mode-specific settings
        else if (this[this.mode] && this[this.mode].hasOwnProperty(key)) {
            this[this.mode][key] = value;
        }
    }
};

/**
 * Wander Bender Generator
 * Main class that coordinates different generation modes and manages UI
 */
class WanderBenderGenerator {
    /**
     * @param {SVGElement} svgElement - Main SVG element
     */
    constructor(svgElement) {
        this.svg = svgElement;
        this.group = document.getElementById('graphicsGroup');
        this.centerX = 250;
        this.centerY = 250;
        
        // Setup Paper.js
        paper.setup(new paper.Size(500, 500));
        
        // Initialize modes
        this.modes = {
            radial: new RadialMode(this),
            random: new RandomMode(this),
            flowfield: new FlowFieldMode(this)
        };
        
        this.currentMode = null;
    }
    
    /**
     * Generate graphics based on parameters
     * @param {Object} params - Generation parameters including mode
     */
    generate(params) {
        const mode = params.mode || 'radial';
        
        if (!this.modes[mode]) {
            console.warn(`Unknown mode: ${mode}`);
            return;
        }
        
        this.currentMode = this.modes[mode];
        this.currentMode.generate(params);
    }
    
    /**
     * Reset extracted elements in radial mode
     */
    resetRadialMode() {
        if (this.modes.radial) {
            this.modes.radial.resetExtracted();
        }
    }
    
    /**
     * Reset extracted elements in random mode
     */
    resetRandomMode() {
        if (this.modes.random) {
            this.modes.random.resetExtracted();
        }
    }
    
    /**
     * Reset extracted elements in flow field mode
     */
    resetFlowFieldMode() {
        if (this.modes.flowfield) {
            this.modes.flowfield.resetExtracted();
        }
    }
}

// Initialize generator (will be created after DOM is ready)
let generator;

/**
 * Update visualization based on current settings
 * Collects parameters and triggers generation for current mode
 */
function updateVisualization() {
    // Don't update if generator is not initialized yet
    if (!generator) return;
    
    const params = {
        mode: settings.mode,
        length: settings.get('length'),
        width: settings.get('width'),
        stroke: settings.get('stroke'),
        cornerRadius: settings.get('cornerRadius'),
        arcAmount: settings.get('arcAmount')
    };
    
    // Add mode-specific parameters
    if (settings.mode === 'radial') {
        params.rays = settings.get('rays');
        params.rayRotation = settings.get('rayRotation');
    } else if (settings.mode === 'random') {
        params.count = settings.get('count');
        // Use length from random settings if available, otherwise use global
        params.length = settings.random.length !== undefined ? settings.random.length : settings.get('length');
        params.areaWidth = settings.get('areaWidth');
        params.areaHeight = settings.get('areaHeight');
        params.lengthVariation = settings.get('lengthVariation');
        params.randomSeed = settings.get('randomSeed');
    } else if (settings.mode === 'flowfield') {
        params.density = settings.get('flowfield.density');
        params.areaWidth = settings.get('flowfield.areaWidth');
        params.areaHeight = settings.get('flowfield.areaHeight');
        params.flowScale = settings.get('flowfield.flowScale');
        params.flowInfluence = settings.get('flowfield.flowInfluence');
        params.flowSeed = settings.get('flowfield.flowSeed');
        params.spacing = settings.get('flowfield.spacing');
    }
    
    generator.generate(params);
}

// Debounced update functions for different parameter categories
const updateVisualizationFast = debounce(updateVisualization, DEBOUNCE_DELAYS.FAST, 'visualization');
const updateVisualizationMedium = debounce(updateVisualization, DEBOUNCE_DELAYS.MEDIUM, 'visualization');
const updateVisualizationSlow = debounce(updateVisualization, DEBOUNCE_DELAYS.SLOW, 'visualization');

// Initialize SliderController
const sliderController = new SliderController(settings);

// Mode switcher
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        settings.mode = e.target.value;
        
        // Show/hide mode-specific controls
        const radialControls = document.getElementById('radialControls');
        const randomControls = document.getElementById('randomControls');
        const flowFieldControls = document.getElementById('flowFieldControls');
        
        // Hide all
        radialControls.style.display = 'none';
        randomControls.style.display = 'none';
        flowFieldControls.style.display = 'none';
        
        // Show active
        if (settings.mode === 'radial') {
            radialControls.style.display = 'block';
        } else if (settings.mode === 'random') {
            randomControls.style.display = 'block';
            // Update length slider to show random mode default (100)
            if (settings.random.length !== undefined) {
                const lengthSlider = document.getElementById('lengthSlider');
                const lengthValue = document.getElementById('lengthValue');
                if (lengthSlider && lengthValue) {
                    lengthSlider.value = settings.random.length;
                    lengthValue.value = settings.random.length;
                }
            }
        } else if (settings.mode === 'flowfield') {
            flowFieldControls.style.display = 'block';
        }
        
        updateVisualization();
    });
});

sliderController.initSlider('raysSlider', {
    valueId: 'raysValue',
    setting: 'rays',
    min: 1,
    max: 12,
    decimals: 0,
    baseStep: 1,
    shiftStep: 1,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('rayRotationSlider', {
    valueId: 'rayRotationValue',
    setting: 'rayRotation',
    min: 0,
    max: 360,
    decimals: 0,
    baseStep: 1,
    shiftStep: 15,
    onUpdate: updateVisualizationMedium
});

// Random mode sliders
sliderController.initSlider('randomCountSlider', {
    valueId: 'randomCountValue',
    setting: 'count',
    min: 3,
    max: 50,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('areaWidthSlider', {
    valueId: 'areaWidthValue',
    setting: 'areaWidth',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('areaHeightSlider', {
    valueId: 'areaHeightValue',
    setting: 'areaHeight',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('lengthVariationSlider', {
    valueId: 'lengthVariationValue',
    setting: 'lengthVariation',
    min: 0,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('randomSeedSlider', {
    valueId: 'randomSeedValue',
    setting: 'randomSeed',
    min: 1,
    max: 99999,
    decimals: 0,
    baseStep: 1,
    shiftStep: 100,
    onUpdate: updateVisualizationMedium
});

// Flow Field sliders
sliderController.initSlider('flowDensitySlider', {
    valueId: 'flowDensityValue',
    setting: 'flowfield.density',
    min: 10,
    max: 200,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowAreaWidthSlider', {
    valueId: 'flowAreaWidthValue',
    setting: 'flowfield.areaWidth',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowAreaHeightSlider', {
    valueId: 'flowAreaHeightValue',
    setting: 'flowfield.areaHeight',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowScaleSlider', {
    valueId: 'flowScaleValue',
    setting: 'flowfield.flowScale',
    min: 50,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowInfluenceSlider', {
    valueId: 'flowInfluenceValue',
    setting: 'flowfield.flowInfluence',
    min: 0,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowSeedSlider', {
    valueId: 'flowSeedValue',
    setting: 'flowfield.flowSeed',
    min: 1,
    max: 99999,
    decimals: 0,
    baseStep: 1,
    shiftStep: 100,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowSpacingSlider', {
    valueId: 'flowSpacingValue',
    setting: 'flowfield.spacing',
    min: -100,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('lengthSlider', {
    valueId: 'lengthValue',
    setting: 'length',
    min: 25,
    max: 500,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: (value) => {
        // Save length to random settings if in random mode
        if (settings.mode === 'random' && settings.random.length !== undefined) {
            settings.random.length = value;
        }
        updateVisualizationFast();
    }
});

sliderController.initSlider('widthSlider', {
    valueId: 'widthValue',
    setting: 'width',
    min: 10,
    max: 200,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: (value) => {
        // Update stroke if auto mode is enabled
        if (settings.get('strokeAuto')) {
            const autoStroke = value - 5;
            settings.set('stroke', autoStroke);
            document.getElementById('strokeValue').value = autoStroke;
            document.getElementById('strokeSlider').value = autoStroke;
        }
        
        // Update corner radius maximum to half of width
        const cornerRadiusSlider = document.getElementById('cornerRadiusSlider');
        const maxCornerRadius = value / 2;
        cornerRadiusSlider.setAttribute('max', maxCornerRadius);
        
        // If "Max" checkbox is checked, automatically update corner radius
        if (settings.get('cornerRadiusMax')) {
            settings.set('cornerRadius', maxCornerRadius);
            document.getElementById('cornerRadiusValue').value = maxCornerRadius;
            cornerRadiusSlider.value = maxCornerRadius;
        }
        // Otherwise, just clamp if it exceeds maximum
        else if (settings.get('cornerRadius') > maxCornerRadius) {
            settings.set('cornerRadius', maxCornerRadius);
            document.getElementById('cornerRadiusValue').value = maxCornerRadius;
            cornerRadiusSlider.value = maxCornerRadius;
        }
        
        updateVisualizationFast();
    }
});

sliderController.initSlider('strokeSlider', {
    valueId: 'strokeValue',
    setting: 'stroke',
    min: 1,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: (value) => {
        // Deactivate "auto" button when manually changing stroke
        const autoBtn = document.getElementById('strokeAutoBtn');
        if (autoBtn.classList.contains('active')) {
            autoBtn.classList.remove('active');
            autoBtn.setAttribute('aria-pressed', 'false');
            settings.set('strokeAuto', false);
        }
        updateVisualizationFast();
    }
});

// Stroke Auto button
const strokeAutoBtn = document.getElementById('strokeAutoBtn');
const strokeSlider = document.getElementById('strokeSlider');
const strokeValue = document.getElementById('strokeValue');

// Set initial state
if (settings.get('strokeAuto')) {
    strokeAutoBtn.classList.add('active');
    strokeAutoBtn.setAttribute('aria-pressed', 'true');
    strokeSlider.disabled = true;
    strokeValue.disabled = true;
}

strokeAutoBtn.addEventListener('click', () => {
    const isActive = strokeAutoBtn.classList.toggle('active');
    strokeAutoBtn.setAttribute('aria-pressed', String(isActive));
    settings.set('strokeAuto', isActive);
    
    if (isActive) {
        // Calculate and set auto stroke (width - 5 for 10px counterform)
        const autoStroke = settings.get('width') - 5;
        settings.set('stroke', autoStroke);
        strokeValue.value = autoStroke;
        strokeSlider.value = autoStroke;
        strokeSlider.disabled = true;
        strokeValue.disabled = true;
    } else {
        // Enable slider
        strokeSlider.disabled = false;
        strokeValue.disabled = false;
    }
    
    updateVisualization();
});

sliderController.initSlider('cornerRadiusSlider', {
    valueId: 'cornerRadiusValue',
    setting: 'cornerRadius',
    min: 0,
    max: settings.get('width') / 2,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: (value) => {
        // Deactivate "Max" button when manually changing corner radius
        const maxBtn = document.getElementById('cornerRadiusMaxBtn');
        if (maxBtn.classList.contains('active')) {
            maxBtn.classList.remove('active');
            maxBtn.setAttribute('aria-pressed', 'false');
            settings.set('cornerRadiusMax', false);
        }
        updateVisualizationFast();
    }
});

sliderController.initSlider('arcAmountSlider', {
    valueId: 'arcAmountValue',
    setting: 'arcAmount',
    min: 0,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationFast
});

// Corner Radius Max button
const cornerRadiusMaxBtn = document.getElementById('cornerRadiusMaxBtn');
const cornerRadiusSlider = document.getElementById('cornerRadiusSlider');
const cornerRadiusValue = document.getElementById('cornerRadiusValue');

// Set initial state
if (settings.get('cornerRadiusMax')) {
    cornerRadiusMaxBtn.classList.add('active');
    cornerRadiusMaxBtn.setAttribute('aria-pressed', 'true');
    cornerRadiusSlider.disabled = true;
    cornerRadiusValue.disabled = true;
}

cornerRadiusMaxBtn.addEventListener('click', () => {
    const isActive = cornerRadiusMaxBtn.classList.toggle('active');
    cornerRadiusMaxBtn.setAttribute('aria-pressed', String(isActive));
    settings.set('cornerRadiusMax', isActive);
    
    if (isActive) {
        // Set to maximum and disable slider
        const maxValue = settings.get('width') / 2;
        settings.set('cornerRadius', maxValue);
        cornerRadiusValue.value = maxValue;
        cornerRadiusSlider.value = maxValue;
        cornerRadiusSlider.disabled = true;
        cornerRadiusValue.disabled = true;
    } else {
        // Enable slider
        cornerRadiusSlider.disabled = false;
        cornerRadiusValue.disabled = false;
    }
    
    updateVisualization();
});

// Reset Extracted button for Random mode
document.getElementById('resetExtractedBtn').addEventListener('click', () => {
    generator.resetRandomMode();
});

document.getElementById('resetFlowExtractedBtn').addEventListener('click', () => {
    generator.resetFlowFieldMode();
});

// Reset Extracted button for Radial mode
document.getElementById('resetExtractedRadialBtn').addEventListener('click', () => {
    generator.resetRadialMode();
});

// Initialize PanelManager
const panelManager = new WanderPanelManager();
panelManager.registerPanel('controlsPanel', {
    headerId: 'controlsPanelHeader',
    draggable: true,
    persistent: true
});
panelManager.initCollapse();

// Initialize ZoomPanManager
const zoomPanManager = new ZoomPanManager(
    document.getElementById('canvasContainer'),
    document.getElementById('mainSvg')
);

// Update zoom indicator
document.getElementById('canvasContainer').addEventListener('zoomchange', (e) => {
    document.getElementById('zoomIndicator').textContent = e.detail.percent + '%';
});

// Reset zoom on click
document.getElementById('zoomIndicator').addEventListener('click', () => {
    zoomPanManager.resetZoom();
});

// Copy SVG to clipboard functionality
const copyBtn = document.getElementById('copyBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
    const svgElement = document.getElementById('mainSvg');
    const clone = svgElement.cloneNode(true);
    
    // Remove area-boundary from the clone (should not be copied)
    const areaBoundary = clone.querySelector('.area-boundary');
    if (areaBoundary) {
        areaBoundary.remove();
    }
    
    const svgData = new XMLSerializer().serializeToString(clone);
    
    try {
        await navigator.clipboard.writeText(svgData);
        // Visual feedback - temporarily change button text
        const copyBtn = document.getElementById('copyBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy SVG to clipboard:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = svgData;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById('copyBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (fallbackErr) {
            console.error('Fallback copy also failed:', fallbackErr);
            await feedbackDialogHost.alert({
                title: 'Copy failed',
                text: 'Failed to copy SVG to clipboard. Please use Export SVG instead.'
            });
        }
        document.body.removeChild(textArea);
    }
    });
}

// Export functionality
document.getElementById('exportBtn').addEventListener('click', () => {
    const svgElement = document.getElementById('mainSvg');
    downloadWanderSvg(svgElement, { rays: settings.get('rays') });
});

// Initialize when DOM and Paper.js are ready
function initializeApp() {
    // Check if Paper.js is loaded
    if (typeof paper === 'undefined') {
        // Wait a bit and try again
        setTimeout(initializeApp, 50);
        return;
    }
    
    // Create generator after DOM is ready
    generator = new WanderBenderGenerator(document.getElementById('mainSvg'));
    
    // Initial visualization
    updateVisualization();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already ready
    initializeApp();
}
