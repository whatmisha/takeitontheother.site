// Mechanical extraction and listener ownership migration; frozen source stays in QA.
import { readFile, writeFile, access } from 'node:fs/promises';
const root = new URL('../../calendar-randomizer/', import.meta.url);
let html = await readFile(new URL('index.html', root), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error('Inline Calendar runtime missing/already extracted');
try { await access(new URL('script.js', root)); throw new Error('Do not overwrite existing runtime'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
let script = match[1].replace(/^ {8}/gm, '').trim() + '\n';
script = script.replaceAll("document.querySelector('svg')", "document.querySelector('#svg-container > svg')")
    .replaceAll("document.querySelectorAll('svg g')", "document.querySelectorAll('#svg-container > svg g')")
    .replaceAll("document.querySelectorAll('svg > :not(defs), svg > g > *, svg > g > g > *')", "svgElement.querySelectorAll(':scope > :not(defs):not(style), :scope > g > *, :scope > g > g > *')");
const start = script.indexOf('        function initializeCalendar()');
if (start < 0) throw new Error('Calendar initializer not found');
script = script.slice(0, start) + script.slice(start).replace(/(\w+)\.addEventListener\(/g, 'listen($1, ');
// These legacy global commands and collapse handler are replaced by shared UI.
const a = script.indexOf('        // Добавляем обработчик клавиатурных событий');
const b = script.indexOf('        // Функция для экспорта SVG', a);
if (a < 0 || b <= a) throw new Error('Calendar command boundaries missing');
script = script.slice(0, a) + script.slice(b);
html = html.replace(/\s*<style>[\s\S]*?<\/style>/, '')
    .replace(/\s*<link rel="stylesheet" href="\.\.\/infra\/framework\/styles\/migration-preview\.css">/, '')
    .replace('</head>', `    <link rel="stylesheet" href="../infra/framework/css/othersite-styles.css">
    <link rel="stylesheet" href="../infra/framework/css/generator-host.css?v=1">
    <link rel="stylesheet" href="../infra/framework/css/ui-contract.css">
</head>`)
    .replace(match[0], '<script src="script.js?v=integration-1"></script>');
await writeFile(new URL('script.js', root), script);
await writeFile(new URL('index.html', root), html);
console.log('Calendar runtime extracted; old UI stylesheet removed.');
