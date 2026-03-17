/**
 * Lamb Pattern Generator — генератор векторного паттерна с овечками
 * Этап 6: Полировка
 */

import { PanelManager } from './js/ui/PanelManager.js';
import { ZoomPanManager } from './js/ui/ZoomPanManager.js';
import { SliderController } from './js/ui/SliderController.js';
import { MathUtils } from './js/utils/MathUtils.js';
import { generateSheep } from './js/sheepGenerator.js';
import { DOMUtils } from './js/utils/DOMUtils.js';

// Размеры canvas
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Seeded random для воспроизводимости паттерна
function createSeededRandom(seed) {
    return function() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

// Settings — хранилище параметров (значения по умолчанию для этапа 3)
const settings = {
    values: {
        bodySpread: 0.15,
        eyeSize: 1,
        earSize: 1,
        density: 0.25,
        scale: 0.25,
        seed: 42
    },
    get(key) { return this.values[key]; },
    set(key, value) { this.values[key] = value; }
};

// DOM
const canvasContainer = document.getElementById('canvasContainer');
const mainSvg = document.getElementById('mainSvg');
const patternLayer = document.getElementById('patternLayer');
const zoomIndicator = document.getElementById('zoomIndicator');

// SliderController
const sliderController = new SliderController(settings);

const onParamChange = MathUtils.debounce(() => renderPattern(), 80);

sliderController.initSlider('bodySpreadSlider', {
    valueId: 'bodySpreadValue',
    setting: 'bodySpread',
    min: 0,
    max: 1,
    decimals: 2,
    baseStep: 0.05,
    shiftStep: 0.2,
    onUpdate: onParamChange
});

sliderController.initSlider('eyeSizeSlider', {
    valueId: 'eyeSizeValue',
    setting: 'eyeSize',
    min: 0.5,
    max: 2,
    decimals: 1,
    baseStep: 0.1,
    shiftStep: 0.5,
    onUpdate: onParamChange
});

sliderController.initSlider('earSizeSlider', {
    valueId: 'earSizeValue',
    setting: 'earSize',
    min: 0.5,
    max: 2,
    decimals: 1,
    baseStep: 0.1,
    shiftStep: 0.5,
    onUpdate: onParamChange
});

sliderController.initSlider('densitySlider', {
    valueId: 'densityValue',
    setting: 'density',
    min: 0.1,
    max: 0.6,
    decimals: 2,
    baseStep: 0.05,
    shiftStep: 0.15,
    onUpdate: onParamChange
});

sliderController.initSlider('scaleSlider', {
    valueId: 'scaleValue',
    setting: 'scale',
    min: 0.05,
    max: 0.6,
    decimals: 2,
    baseStep: 0.05,
    shiftStep: 0.15,
    onUpdate: onParamChange
});

// Seed input
const seedInput = document.getElementById('seedInput');
if (seedInput) {
    seedInput.addEventListener('change', () => {
        const val = parseInt(seedInput.value, 10);
        if (!isNaN(val) && val >= 1 && val <= 99999) {
            settings.set('seed', val);
            renderPattern();
        }
    });
}

// Random seed button
document.getElementById('randomSeedBtn')?.addEventListener('click', () => {
    const newSeed = Math.floor(Math.random() * 99998) + 1;
    settings.set('seed', newSeed);
    seedInput.value = newSeed;
    renderPattern();
});

// Инициализация PanelManager
const panelManager = new PanelManager();
panelManager.registerPanel('mainPanel', {
    headerId: 'mainPanelHeader',
    draggable: true,
    persistent: true
});

// Инициализация ZoomPanManager
const zoomPanManager = new ZoomPanManager(canvasContainer, mainSvg);

// Обновление индикатора зума
canvasContainer.addEventListener('zoomchange', (e) => {
    zoomIndicator.textContent = e.detail.percent + '%';
});

zoomIndicator.addEventListener('click', () => {
    zoomPanManager.resetZoom();
});

// Сворачивание панели
document.querySelector('.collapse-icon').addEventListener('click', function() {
    const panel = this.closest('.controls-panel');
    panel.classList.toggle('panel-collapsed');
    this.classList.toggle('collapsed');
});

// Модальное окно справки
const helpModal = document.getElementById('helpModal');
document.getElementById('modalClose').addEventListener('click', () => {
    helpModal.classList.remove('active');
});

document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        helpModal.classList.add('active');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        exportSvg();
    } else if (e.key === 'Escape' && helpModal.classList.contains('active')) {
        helpModal.classList.remove('active');
    }
});

// Экспорт SVG
function exportSvg() {
    const svg = mainSvg.cloneNode(true);
    svg.removeAttribute('id');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', '0 0 800 600');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '600');
    svg.setAttribute('aria-label', 'Lamb pattern');

    const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lamb-pattern-${settings.get('seed')}-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('exportBtn').addEventListener('click', exportSvg);

// Перерисовка паттерна по сетке
function renderPattern() {
    DOMUtils.clearElement(patternLayer);

    const bodySpread = settings.get('bodySpread');
    const eyeSize = settings.get('eyeSize');
    const earSize = settings.get('earSize');
    const density = settings.get('density');
    const scale = settings.get('scale');
    const seed = settings.get('seed');

    // Плотность: 0.1 = редкий, 0.5 = плотный. Шаг сетки в пикселях.
    const cellSpacing = 80 + (1 - density) * 180;

    const random = createSeededRandom(seed);

    for (let y = cellSpacing / 2; y < CANVAS_HEIGHT + cellSpacing; y += cellSpacing) {
        for (let x = cellSpacing / 2; x < CANVAS_WIDTH + cellSpacing; x += cellSpacing) {
            const offsetX = (random() * 2 - 1) * cellSpacing * 0.2;
            const offsetY = (random() * 2 - 1) * cellSpacing * 0.2;
            const rotation = (random() * 2 - 1) * 45;

            const sheep = generateSheep({
                x: x + offsetX,
                y: y + offsetY,
                scale,
                bodySpread,
                eyeSize,
                earSize,
                rotation,
                random
            });
            patternLayer.appendChild(sheep);
        }
    }
}

// Инициализация
renderPattern();
console.log('Lamb Pattern Generator — этап 6 инициализирован');
