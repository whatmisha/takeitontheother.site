#!/usr/bin/env node

import { mkdtemp, mkdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frameworkRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function usage() {
    return `Create a clean UI Garage tool

Usage:
  node scripts/create-tool.mjs <output-directory> --id <tool-id> [options]

Options:
  --renderer <svg|canvas>  Render target (default: svg)
  --name <display name>    Visible tool name (default: title-cased id)
  --id <tool-id>           Lowercase storage-safe id, for example line-lab
  --help                   Show this help

The output must be outside the UI Garage folder. Existing paths are never
overwritten. The generated tool imports only UI Garage's public src/index.js.
`;
}

function parseArguments(argv) {
    if (argv.includes('--help')) return { help: true };
    const positional = [];
    const flags = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            positional.push(token);
            continue;
        }
        const key = token.slice(2);
        if (!['renderer', 'name', 'id'].includes(key)) throw new Error(`Unknown option: ${token}`);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
        flags[key] = value;
        index += 1;
    }
    if (positional.length !== 1) throw new Error('Provide exactly one output directory.');
    const id = flags.id;
    if (!id || !/^[a-z][a-z0-9-]{2,63}$/u.test(id)) {
        throw new Error('--id must match ^[a-z][a-z0-9-]{2,63}$.');
    }
    const renderer = flags.renderer || 'svg';
    if (!['svg', 'canvas'].includes(renderer)) throw new Error('--renderer must be svg or canvas.');
    const name = flags.name || id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
    if (!name.trim() || /[\r\n]/u.test(name)) throw new Error('--name must be a non-empty single line.');
    return { output: positional[0], id, renderer, name: name.trim() };
}

function escapeHtml(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function toWebPath(value) {
    const portable = value.split(path.sep).join('/');
    return portable.startsWith('.') ? portable : `./${portable}`;
}

function htmlTemplate({ name, renderer, frameworkPath }) {
    const surface = renderer === 'svg'
        ? '<svg id="artboard" aria-label="Generated artwork"></svg>'
        : '<canvas id="artboard" aria-label="Generated artwork"></canvas>';
    const safeName = escapeHtml(name);
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeName}</title>
    <link rel="icon" href="./favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="${escapeHtml(frameworkPath)}/css/framework.css">
    <link rel="stylesheet" href="${escapeHtml(frameworkPath)}/css/ui-contract.css">
    <link rel="stylesheet" href="./app.css">
</head>
<body>
    <main class="tool-layout">
        <header class="tool-header"><h1>${safeName}</h1><span id="zoomIndicator">100%</span></header>
        <section id="canvasContainer" class="canvas-container">${surface}</section>
        <aside id="settingsPanel" class="controls-panel" aria-label="Generator settings">
            <div id="settingsPanelHeader" class="panel-header">
                <span>Settings</span>
                <button class="collapse-icon" type="button" aria-label="Collapse panel" aria-expanded="true">⌄</button>
            </div>
            <div class="panel-content">
                <div class="control-group">
                    <label for="densitySlider"><span>Density</span><output id="densityValue" class="value-display">12</output></label>
                    <input id="densitySlider" type="range" min="3" max="40" value="12">
                </div>
                <label class="checkbox-label"><input type="checkbox" data-setting="invert"><span>Invert</span></label>
            </div>
        </aside>
        <nav class="bottom-buttons action-dock" role="toolbar" aria-label="Export actions">
            <div class="action-dock__slot action-dock__slot--primary">
                <button id="pngExport" class="btn-fixed" type="button">PNG</button>
                ${renderer === 'svg' ? '<button id="svgExport" class="btn-fixed" type="button">SVG ⌘E</button>' : ''}
            </div>
        </nav>
    </main>
    <script type="module" src="./app.js"></script>
</body>
</html>
`;
}

function appTemplate({ id, renderer, frameworkPath }) {
    const renderBody = renderer === 'svg'
        ? `const background = settings.invert ? '#111' : '#f5f5f2';
        const foreground = settings.invert ? '#f5f5f2' : '#111';
        svg.appendChild(create('rect', { width, height, fill: background }));
        const step = width / settings.density;
        for (let x = step / 2; x < width; x += step) {
            svg.appendChild(create('line', { x1: x, y1: 0, x2: width - x, y2: height, stroke: foreground, 'stroke-width': 2 }));
        }`
        : `const background = settings.invert ? '#111' : '#f5f5f2';
        const foreground = settings.invert ? '#f5f5f2' : '#111';
        ctx2d.fillStyle = background;
        ctx2d.fillRect(0, 0, width, height);
        ctx2d.strokeStyle = foreground;
        ctx2d.lineWidth = 2;
        const step = width / settings.density;
        for (let x = step / 2; x < width; x += step) {
            ctx2d.beginPath();
            ctx2d.moveTo(x, 0);
            ctx2d.lineTo(width - x, height);
            ctx2d.stroke();
        }`;
    return `import { defineTool } from ${JSON.stringify(`${frameworkPath}/src/index.js`)};

const app = defineTool({
    renderer: ${JSON.stringify(renderer)},
    dom: { canvas: 'canvasContainer', surface: 'artboard', zoomIndicator: 'zoomIndicator' },
    settings: { width: 420, height: 420, density: 12, invert: false },
    controls: {
        sliders: [
            { id: 'densitySlider', valueId: 'densityValue', setting: 'density', min: 3, max: 40, decimals: 0, baseStep: 1, shiftStep: 5 }
        ],
        toggles: true
    },
    panels: [{ id: 'settingsPanel', headerId: 'settingsPanelHeader', persistent: true }],
    history: { maxSize: 50, debounceMs: 120 },
    export: { filename: ${JSON.stringify(`${id}.${renderer === 'svg' ? 'svg' : 'png'}`)} },
    render({ settings, svg, ctx2d, create, width, height }) {
        ${renderBody}
    }
});

await app.init();
document.querySelector('#pngExport').addEventListener('click', () => void app.exportPNG(${JSON.stringify(`${id}.png`)}));
document.querySelector('#svgExport')?.addEventListener('click', () => void app.exportSVG(${JSON.stringify(`${id}.svg`)}));
window.addEventListener('pagehide', () => app.destroy(), { once: true });
`;
}

function cssTemplate() {
    return `.tool-layout { min-height: 100vh; overflow: hidden; }
.tool-header { position: fixed; inset: 18px 20px auto 20px; z-index: 10; display: flex; justify-content: space-between; pointer-events: none; }
.tool-header h1 { margin: 0; font-size: 14px; font-weight: 500; }
.canvas-container { position: fixed; inset: 0; display: grid; place-items: center; background: var(--color-bg); }
.canvas-container > svg, .canvas-container > canvas { max-width: calc(100vw - 80px); max-height: calc(100vh - 80px); background: #f5f5f2; }
.controls-panel { position: fixed; top: 58px; left: 20px; width: 240px; }
`;
}

function readmeTemplate({ name, renderer, outputName, frameworkPath }) {
    return `# ${name}

Clean ${renderer.toUpperCase()} tool generated from UI Garage.

The application imports only \`${frameworkPath}/src/index.js\`. Keep the tool
directory and UI Garage under the same static-server root.

From their common parent directory:

\`\`\`sh
python3 -m http.server 8000
\`\`\`

Then open \`http://127.0.0.1:8000/${encodeURIComponent(outputName)}/\`.
`;
}

export async function createTool(options) {
    const outputRoot = path.resolve(options.output);
    try {
        await stat(outputRoot);
        throw new Error(`Output path already exists: ${outputRoot}`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    const parent = path.dirname(outputRoot);
    await mkdir(parent, { recursive: true });
    const canonicalFrameworkRoot = await realpath(frameworkRoot);
    const canonicalOutputRoot = path.join(await realpath(parent), path.basename(outputRoot));
    if (canonicalOutputRoot === canonicalFrameworkRoot
        || canonicalOutputRoot.startsWith(`${canonicalFrameworkRoot}${path.sep}`)) {
        throw new Error('The generated tool must live outside the UI Garage folder.');
    }
    const temporaryRoot = await mkdtemp(path.join(parent, '.ui-garage-tool-'));
    const frameworkPath = toWebPath(path.relative(canonicalOutputRoot, canonicalFrameworkRoot));
    const templateOptions = { ...options, frameworkPath, outputName: path.basename(outputRoot) };
    try {
        await Promise.all([
            writeFile(path.join(temporaryRoot, 'index.html'), htmlTemplate(templateOptions)),
            writeFile(path.join(temporaryRoot, 'app.js'), appTemplate(templateOptions)),
            writeFile(path.join(temporaryRoot, 'app.css'), cssTemplate()),
            writeFile(path.join(temporaryRoot, 'README.md'), readmeTemplate(templateOptions)),
            writeFile(path.join(temporaryRoot, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#ff5c35"/><circle cx="16" cy="16" r="7" fill="#111"/></svg>\n')
        ]);
        await rename(temporaryRoot, outputRoot);
    } catch (error) {
        await rm(temporaryRoot, { recursive: true, force: true });
        throw error;
    }
    return { outputRoot, frameworkPath, renderer: options.renderer, id: options.id };
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(usage());
        return;
    }
    const result = await createTool(options);
    process.stdout.write(`Created ${result.renderer} tool at ${result.outputRoot}\nFramework URL: ${result.frameworkPath}\n`);
}

const isCommandLine = process.argv[1]
    && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url));

if (isCommandLine) {
    main().catch(error => {
        process.stderr.write(`create-tool: ${error.message}\n\n${usage()}`);
        process.exitCode = 1;
    });
}
