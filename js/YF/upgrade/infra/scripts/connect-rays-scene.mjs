// One-shot, fail-closed mechanical replacement of the legacy duplicate renderers.
import { readFile, writeFile } from 'node:fs/promises';
const target = new URL('../../rays_pattern_generator/script.js', import.meta.url);
let text = await readFile(target, 'utf8');
if (text.includes('import { buildRaysScene }')) throw new Error('Scene already connected');
function replaceBetween(start, end, replacement) {
    const a = text.indexOf(start), b = text.indexOf(end, a);
    if (a < 0 || b <= a) throw new Error(`Missing renderer boundary: ${start}`);
    text = text.slice(0, a) + replacement + text.slice(b);
}
replaceBetween('    // Функция отрисовки паттерна', '    // Функция переключения элементов управления растром', `    function scene() {
        return buildRaysScene(params, { width: canvas.width, height: canvas.height, imageData: params.imageData });
    }

    function drawPattern() {
        paintRaysScene(ctx, scene(), params.strokeColor);
    }

`);
replaceBetween('        // Создаем SVG элемент', '        // Преобразуем SVG в строку', `        const svg = raysSvgElement(scene(), document);

`);
replaceBetween('    // Обновляем функцию addRaysToSvg', '    function restoreSettingsFromFileName', '    function restoreSettingsFromFileName');
// The replacement includes the end marker above only once.
text = text.replace('    function restoreSettingsFromFileName    function restoreSettingsFromFileName', '    function restoreSettingsFromFileName');
text = `import { buildRaysScene } from './engine/scene.js';\nimport { paintRaysScene, raysSvgElement } from './engine/renderers.js';\n\n` + text;
await writeFile(target, text);
console.log('Rays now uses a single scene for Canvas and SVG.');
