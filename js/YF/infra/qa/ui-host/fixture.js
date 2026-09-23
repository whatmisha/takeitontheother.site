import { defineTool, ToolUiController } from '../../framework/src/index.js';

const status = document.getElementById('fixtureStatus');
let generations = 0, encodings = 0, mounts = 1, audioRunning = false;
function draw(context, settings) {
    context.fillStyle = '#111'; context.fillRect(0, 0, 640, 360);
    context.fillStyle = '#d2d2d2';
    for (let i = 0; i < settings.count; i++) {
        if (settings.mode === 'lines') {
            context.fillRect(30 + i * 38, 180 + Math.sin(i + settings.phase) * 60, settings.length, 3);
            continue;
        }
        context.beginPath(); context.arc(30 + i * 38, 180 + Math.sin(i + settings.phase) * 60, 12, 0, Math.PI * 2); context.fill();
    }
}
const app = defineTool({
    renderer: 'canvas', dom: { canvas: 'canvasContainer', surface: 'mainCanvas' },
    settings: { width: 640, height: 360, count: 8, phase: 0, mode: 'circles', length: 24 }, zoom: false, export: false, dialog: false,
    controls: { sliders: [
        { id: 'countSlider', valueId: 'countValue', setting: 'count', min: 3, max: 16, decimals: 0, baseStep: 1 },
        { id: 'lengthSlider', valueId: 'lengthValue', setting: 'length', min: 8, max: 60, decimals: 0, baseStep: 1 }
    ] },
    panels: [{ id: 'shapePanel', headerId: 'shapeHeader' }, { id: 'linePanel', headerId: 'lineHeader' }],
    render: ({ ctx2d, settings }) => draw(ctx2d, settings)
});
await app.init();
const options = {
    id: 'unlisted-fixture', title: 'UI host fixture',
    summaries: { shapePanel: () => `${app.settings.count} ${app.settings.mode} · 640 mm × 360 mm · ${generations} generations`, linePanel: () => `${app.settings.length} px` },
    onError: error => { status.textContent = `Error: ${error.message}`; },
    actions: [
        { id: 'generate', button: 'generateExportCandidate', label: 'Generate', kind: 'command', group: 'panel', shortcut: 'space', run: async ({ signal }) => {
            status.textContent = 'Generating…';
            await new Promise(resolve => setTimeout(resolve, 200));
            if (signal.aborted) return;
            app.settings.phase++; status.textContent = `Generation ${++generations}`;
        } },
        { id: 'source', button: 'sourceButton', label: 'Load sample', kind: 'import', group: 'panel', shortcut: 'mod+o', run: () => { app.sliders.setValue('countSlider', 6); status.textContent = 'Sample loaded (simulation)'; } },
        { id: 'audio', button: 'audioButton', label: 'Audio simulation', kind: 'command', group: 'panel', shortcut: 'a', enabled: () => app.settings.mode === 'circles', run: () => { audioRunning = !audioRunning; status.textContent = `Audio simulation ${audioRunning ? 'on' : 'off'}; no microphone requested`; } },
        { id: 'png', button: 'pngButton', label: 'PNG', kind: 'export', group: 'primary', shortcut: 'mod+e', enabled: () => !document.getElementById('disableExport').checked, run: async () => {
            if (document.getElementById('failExport').checked) throw new Error('Deliberate encoder failure');
            const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
            draw(canvas.getContext('2d'), app.settings);
            const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No PNG')), 'image/png'));
            status.textContent = `PNG ${++encodings}: ${blob.size} bytes encoded; not downloaded`;
            return blob;
        } },
        { id: 'json', button: 'jsonButton', label: 'JSON', kind: 'export', group: 'extra', shortcut: 'mod+j', run: () => { status.textContent = `JSON encoded: ${app.settingsStore.toJSON()}`; } },
        { id: 'import', button: 'importButton', label: 'JSON import', kind: 'import', group: 'extra', shortcut: 'mod+shift+j', run: () => { app.sliders.setValue('countSlider', 8); status.textContent = 'JSON import simulated'; } }
    ]
};
let ui = new ToolUiController(options).init();
const refresh = () => ui.refresh();
document.getElementById('fixtureMode').addEventListener('change', event => {
    app.settings.mode = event.target.value;
    if (app.settings.mode !== 'circles') audioRunning = false;
    document.getElementById('linePanel').hidden = app.settings.mode !== 'lines';
    status.textContent = `Mode: ${app.settings.mode}`;
    ui.refresh();
});
document.getElementById('disableExport').addEventListener('change', refresh);
document.getElementById('reinitButton').addEventListener('click', () => {
    ui = new ToolUiController(options).init(); status.textContent = `UI mount ${++mounts}`;
});
window.addEventListener('pagehide', () => { ui.destroy(); app.destroy(); }, { once: true });
