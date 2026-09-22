import { defineTool, SeededRandom } from '../src/index.js';

function draw({ ctx2d, width, height, settings }) {
    ctx2d.fillStyle = '#0a0a0a';
    ctx2d.fillRect(0, 0, width, height);
    const random = new SeededRandom(settings.seed);
    for (let index = 0; index < settings.count; index += 1) {
        const radius = random.float(settings.radius * 0.35, settings.radius);
        const x = random.float(radius, width - radius);
        const y = random.float(radius, height - radius);
        ctx2d.beginPath();
        ctx2d.arc(x, y, radius, 0, Math.PI * 2);
        ctx2d.fillStyle = `hsl(${Math.round(random.float(185, 245))} 65% 65%)`;
        ctx2d.fill();
    }
}

const app = defineTool({
    renderer: 'canvas',
    autoStart: true,
    dom: { canvas: 'canvasContainer', surface: 'mainCanvas', zoomIndicator: 'zoomIndicator' },
    settings: { width: 640, height: 480, count: 36, radius: 12, seed: 20260830 },
    controls: {
        sliders: [
            { id: 'countSlider', valueId: 'countValue', setting: 'count', min: 4, max: 100, decimals: 0, baseStep: 1 },
            { id: 'radiusSlider', valueId: 'radiusValue', setting: 'radius', min: 2, max: 40, decimals: 0, baseStep: 1 }
        ]
    },
    panels: [{ id: 'canvasPanel', headerId: 'canvasPanelHeader', persistent: true }],
    dialog: false,
    export: { filename: 'canvas-studio.svg' },
    render: draw,
    renderTo: draw,
    onReady(tool) {
        document.getElementById('shuffleBtn')?.addEventListener('click', () => {
            tool.settings.seed = Math.floor(Math.random() * 0xFFFFFFFF);
        });
        document.getElementById('exportPngBtn')?.addEventListener('click', () => tool.exportPNG());
    }
});

export default app;
