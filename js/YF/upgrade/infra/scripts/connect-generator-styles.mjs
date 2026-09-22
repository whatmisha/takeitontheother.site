// Mechanical entry-point migration. Generator algorithms are edited separately.
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
for (const id of ['random_lines_generator', 'asterisk_pattern_generator', 'pattern_generator_02', 'hyperspace', 'pattern_generator', 'chladni-sound-pattern']) {
    const path = new URL(`${id}/index.html`, root);
    let html = await readFile(path, 'utf8');
    if (html.includes('generator-host.css')) continue;
    html = html.replace(/\s*<link rel="stylesheet" href="(?:styles?\.css|\.\.\/infra\/framework\/styles\/migration-preview\.css)">/g, '');
    html = html.replace('</head>', `    <link rel="stylesheet" href="../infra/framework/css/othersite-styles.css">
    <link rel="stylesheet" href="../infra/framework/css/generator-host.css?v=1">
    <link rel="stylesheet" href="../infra/framework/css/ui-contract.css">
</head>`);
    html = html.replace(/<script src="(?!\.\.\/)([^"?]+\.js)"><\/script>/g, '<script src="$1?v=integration-1"></script>');
    await writeFile(path, html);
}
console.log('Six generator entry points now reference shared styles; legacy CSS not loaded.');
