import { PDFDocument, toBytes, create, FONT_FILES, createProbeDocument, generateProbe } from './ProbeRuntime.js';

const status = document.getElementById('status');
const button = document.getElementById('generate');
const links = document.getElementById('downloads');
const source = document.getElementById('source');
const urls = [];
const model = createProbeDocument();
source.textContent = JSON.stringify(model, null, 2);
button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Загрузка локальных шрифтов и создание двух PDF…';
    document.body.dataset.status = 'running';
    links.replaceChildren();
    urls.splice(0).forEach(url => URL.revokeObjectURL(url));
    try {
        const fonts = Object.fromEntries(await Promise.all(Object.entries(FONT_FILES).map(async ([key, file]) => {
            const response = await fetch(`../../fonts/${encodeURIComponent(file)}`);
            if (!response.ok) throw new Error(`Font ${file}: HTTP ${response.status}`);
            let font = create(new Uint8Array(await response.arrayBuffer()));
            // One explicit variable-font instance per PDF. Do not silently use
            // the font's default wght 100 for the editor's wght 400.
            if (key === 'display') font = font.getVariation({ wght: 400 });
            return [key, font];
        })));
        for (const tagged of [true, false]) {
            const result = await generateProbe({ PDFDocument, toBytes, fonts, model, tagged });
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', result.bytes)))
                .map(value => value.toString(16).padStart(2, '0')).join('');
            const url = URL.createObjectURL(new Blob([result.bytes], { type: 'application/pdf' }));
            urls.push(url);
            const link = document.createElement('a');
            link.className = 'btn-secondary';
            link.href = url;
            link.download = `pdf-probe-${tagged ? 'tagged' : 'plain'}.pdf`;
            link.textContent = tagged ? 'Скачать PDF с тегами абзацев' : 'Скачать PDF без тегов';
            const item = document.createElement('li');
            item.append(link);
            const info = document.createElement('p');
            info.className = 'hash';
            info.textContent = `${result.bytes.length} bytes / SHA-256 ${hash}`;
            item.append(info);
            links.append(item);
        }
        status.textContent = 'Готово. Два PDF созданы в браузере. Откройте их через File → Open в Illustrator 30.8.1.';
        document.body.dataset.status = 'passed';
    } catch (error) {
        links.replaceChildren();
        status.textContent = `Не удалось создать PDF: ${error.message}`;
        document.body.dataset.status = 'failed';
    } finally { button.disabled = false; }
});
window.addEventListener('pagehide', () => urls.splice(0).forEach(url => URL.revokeObjectURL(url)));
