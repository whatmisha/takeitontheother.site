// Development-only observer. No writes to application DOM, storage or settings.
const $ = selector => document.querySelector(selector);
const AUDITOR_VERSION = 'uiq-4';
const subject = $('#subject');
const sparky = $('#sparkyReference');
const word = $('#wordReference');
const allowedTools = new Set([...$('#tool').options].map(option => option.value));
const params = new URLSearchParams(location.search);
if (allowedTools.has(params.get('tool'))) $('#tool').value = params.get('tool');
const typography = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'];
const buttonProperties = [...typography, 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderTopWidth'];
const labels = { diff: 'Отклонение', match: 'Совпадает', review: 'Проверить', unavailable: 'Не проверено' };
let report = null;
let loadedTool = null;
let busy = false;
const notesByTool = new Map();

function visible(element) {
    const view = element.ownerDocument.defaultView;
    const style = view.getComputedStyle(element);
    return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function find(doc, selector) {
    return [...doc.querySelectorAll(selector)].filter(visible);
}

function identify(element) {
    if (element.id) return `#${element.id}`;
    const text = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return `${element.tagName.toLowerCase()}.${[...element.classList].join('.')} ${text}`;
}

function styleOf(element, properties) {
    const computed = element.ownerDocument.defaultView.getComputedStyle(element);
    return Object.fromEntries(properties.map(property => [property, computed[property]]));
}

function equal(actual, expected) {
    if (actual === expected) return true;
    if (/^-?[\d.]+px$/.test(actual) && /^-?[\d.]+px$/.test(expected)) {
        return Math.abs(parseFloat(actual) - parseFloat(expected)) <= 0.5;
    }
    return false;
}

function compare(name, elements, reference, properties) {
    if (!reference || !elements.length) return { name, status: 'unavailable', detail: !reference ? 'Эталон отсутствует или скрыт.' : 'В текущем состоянии нет видимых элементов.', differences: [] };
    const expected = styleOf(reference, properties);
    const differences = elements.flatMap(element => {
        const actual = styleOf(element, properties);
        return properties.filter(property => !equal(actual[property], expected[property])).map(property => ({
            element: identify(element), property, actual: actual[property], expected: expected[property]
        }));
    });
    return { name, status: differences.length ? 'diff' : 'match', detail: `${elements.length} элементов; эталон ${identify(reference)}.`, differences };
}

function pinned(name, element, expected) {
    if (!element) return { name, status: 'unavailable', detail: 'Эталон не найден.', differences: [] };
    const actual = styleOf(element, Object.keys(expected));
    const differences = Object.entries(expected).filter(([property, value]) => !equal(actual[property], value))
        .map(([property, value]) => ({ element: identify(element), property, actual: actual[property], expected: value }));
    return { name, status: differences.length ? 'diff' : 'match', detail: 'Проверка самого эталона по закреплённым значениям.', differences };
}

function resting(element) {
    return Boolean(element && !element.disabled && !element.dataset.exportFeedbackState && !element.matches(':hover, :focus') && !animating(element));
}

function animating(element) {
    return element.getAnimations().some(animation => animation.pending || animation.playState === 'running');
}

async function settle(frame) {
    // Do not sample a fading Done label or a colour halfway through a transition.
    // Bound the wait: an ongoing export must become "not checked", not freeze the auditor.
    const start = Date.now();
    let previous = '', stable = 0;
    while (Date.now() - start < 3000) {
        const buttons = find(frame.contentDocument, '.action-dock button');
        const active = buttons.some(button => animating(button) || (!button.disabled && button.dataset.exportFeedbackState));
        const sample = JSON.stringify(buttons.map(button => styleOf(button, ['backgroundColor', 'color', 'width', 'height'])));
        stable = !active && sample === previous ? stable + 1 : 0;
        if (stable >= 2) return;
        previous = sample;
        await new Promise(resolve => setTimeout(resolve, 120));
    }
}

function collect() {
    const doc = subject.contentDocument;
    const expectedPath = new URL(`../../${loadedTool}/`, location.href).pathname;
    if (!doc || new URL(doc.URL).pathname !== expectedPath) {
        throw new Error('Рабочее окно перешло на другую страницу. Нажмите «Открыть и проверить», чтобы вернуть выбранный инструмент.');
    }
    const ref = sparky.contentDocument;
    const wordDoc = word.contentDocument;
    const results = [];
    const primary = find(ref, '#exportSvgBtn')[0];
    const referenceHeading = find(wordDoc, '#lightToneGroupLabel')[0];
    results.push(pinned('Эталон кнопок Sparky', primary, { fontSize: '16px', fontWeight: '500', height: '36px', backgroundColor: 'rgb(210, 210, 210)' }));
    results.push(pinned('Эталон заголовков Wordplayer', referenceHeading, { fontSize: '12px', fontWeight: '400', marginBottom: '24px', paddingTop: '12px', color: 'rgb(136, 136, 136)' }));
    const families = [
        ['Навигация', '.top-link, .mode-nav-back', ref, '.top-link', buttonProperties],
        ['Основной экспорт', '[data-action-dock-primary-export]', ref, '#exportSvgBtn', buttonProperties],
        ['Кнопка справки', '[data-shortcut-help-button]', ref, '#shortcutHelpBtn', buttonProperties],
        ['Заголовки групп', '.control-field-heading, .tone-group-heading', wordDoc, '#lightToneGroupLabel', [...typography, 'letterSpacing', 'color', 'textTransform', 'paddingTop', 'paddingLeft', 'marginBottom', 'borderTopWidth']],
        ['Подписи обычных слайдеров', '.control-group:has(> input[type="range"]) > label', ref, 'label[for="rayCountSlider"]', [...typography, 'marginBottom']],
        ['Обычные слайдеры', '.control-group > input[type="range"]', ref, '#rayCountSlider', ['height', 'marginTop', 'marginBottom', 'backgroundColor', 'backgroundImage']]
    ];
    for (const [name, selector, referenceDoc, referenceSelector, properties] of families) {
        results.push(compare(name, find(doc, selector), find(referenceDoc, referenceSelector)[0], properties));
    }
    const exports = find(doc, '[data-action-dock-primary-export]');
    const panelActions = find(doc, '.controls-panel .panel-action, .controls-panel #resetTransform').filter(resting);
    for (const action of panelActions) {
        results.push(pinned(`Кнопка панели ${identify(action)}`, action, {
            fontSize: '16px', fontWeight: '500', height: '36px', borderTopWidth: '0px',
            backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(210, 210, 210)'
        }));
    }
    if (loadedTool === 'dither') {
        const sourceIds = ['uploadBtnFixed', 'removeImageBtn', 'uploadSampleBtn', 'removeSampleBtn', 'imageInput', 'sampleInput'];
        const misplaced = sourceIds.filter(id => !doc.getElementById(id)?.closest('#transformPanel') || doc.getElementById(id)?.closest('.action-dock'));
        results.push({ name: 'Источники Dither — в панели, не в экспорте', status: misplaced.length ? 'diff' : 'match', detail: misplaced.length ? `Неверное расположение: ${misplaced.join(', ')}` : 'Оба input и четыре действия находятся в Texture. Успех загрузки и ошибки проверяются отдельным сценарием.', differences: [] });
        const canvas = doc.getElementById('canvas'), overlay = doc.getElementById('overlayCanvas');
        if (canvas && overlay && visible(canvas) && visible(overlay)) {
            const c = canvas.getBoundingClientRect(), o = overlay.getBoundingClientRect();
            const sameScale = Math.abs(c.width / canvas.width - o.width / overlay.width) < 0.002 && Math.abs(c.height / canvas.height - o.height / overlay.height) < 0.002;
            const sameCenter = Math.abs(c.left + c.width / 2 - o.left - o.width / 2) < 1 && Math.abs(c.top + c.height / 2 - o.top - o.height / 2) < 1;
            results.push({ name: 'Масштаб слоя трансформации Dither', status: sameScale && sameCenter ? 'match' : 'diff', detail: `Холст: ${(c.width / canvas.width).toFixed(3)}; overlay: ${(o.width / overlay.width).toFixed(3)}. Центры ${sameCenter ? 'совпадают' : 'различаются'}. Сам overlay больше холста из-за разрешённого overflow; это не ошибка.`, differences: [] });
        }
    }
    const edges = find(doc, '.ui-artboard');
    for (const edge of edges) results.push(pinned(`Граница листа ${identify(edge)}`, edge, { outlineWidth: '1px', outlineStyle: 'solid', outlineColor: 'rgb(51, 51, 51)' }));
    results.push({ name: 'Семантика рамок холста', status: 'review', detail: `Явных границ листа .ui-artboard: ${edges.length}. Не смешивать границу листа, выделение/трансформацию, область генерации Wander и печатные контуры Pizza. CSS всего viewport не проверяет границы логического листа внутри SVG/Canvas. Полный визуальный проход остаётся отдельной проверкой.`, differences: [] });
    results.push(compare('Цвет основного экспорта в покое', exports.filter(resting), resting(primary) ? primary : null, ['backgroundColor', 'color']));
    const exportButtons = [...doc.querySelectorAll('.action-dock [data-action-dock-primary-export], .action-dock [data-action-dock-json-export], .action-dock button[id^="export"]')];
    const explicitExports = exportButtons.filter(button => button.dataset.exportFeedback === 'explicit');
    const legacyExports = exportButtons.filter(button => button.dataset.exportFeedback !== 'explicit');
    results.push({
        name: 'Владение статусом экспорта', status: exportButtons.length ? 'review' : 'unavailable',
        detail: `Общий explicit feedback: ${explicitExports.length}/${exportButtons.length} кнопок (включая скрытые JSON). Без него: ${legacyExports.map(identify).join(', ') || 'нет'}. Маркер подтверждает только подключение, не успешный экспорт. Частный прогресс, отмена, ошибки и артефакты требуют отдельного сценария.`, differences: []
    });

    const dock = find(doc, '.action-dock')[0];
    const referenceDock = find(ref, '.action-dock')[0];
    if (dock && referenceDock) {
        const rect = dock.getBoundingClientRect(), view = subject.contentWindow;
        const delta = Math.abs(rect.left + rect.width / 2 - view.innerWidth / 2);
        const buttons = find(doc, '.action-dock button');
        const clipped = buttons.filter(element => {const r = element.getBoundingClientRect(); return r.left < -1 || r.right > view.innerWidth + 1 || r.bottom > view.innerHeight + 1;});
        const referenceBottom = sparky.contentWindow.innerHeight - referenceDock.getBoundingClientRect().bottom;
        const bottom = view.innerHeight - rect.bottom;
        results.push({ name: 'Геометрия нижней панели', status: delta > 1 || clipped.length || Math.abs(bottom - referenceBottom) > 1 ? 'diff' : 'match', detail: `Смещение центра: ${delta.toFixed(1)} px; отступ снизу: ${bottom.toFixed(1)} px (эталон ${referenceBottom.toFixed(1)}); кнопок за окном: ${clipped.length}; размер группы ${rect.width.toFixed(0)} × ${rect.height.toFixed(0)}.`, differences: [] });
        results.push({ name: 'Состав нижней панели', status: 'review', detail: `Действия: ${buttons.map(element => element.textContent.trim()).join(' / ')}. Совпадение размеров не подтверждает правильность группировки и набора действий.`, differences: [] });
    } else results.push({ name: 'Геометрия нижней панели', status: 'unavailable', detail: 'Нижняя панель инструмента или эталона скрыта либо отсутствует.', differences: [] });

    const ui = find(doc, '.controls-panel label, .controls-panel h3, .controls-panel button, .controls-panel input:not([type=file]):not([type=hidden]), .action-dock button, .top-links a');
    const forbidden = ui.filter(element => {const s = subject.contentWindow.getComputedStyle(element); return !['400', '500'].includes(s.fontWeight) || /Arial|TT.?Commons|CoFo/i.test(s.fontFamily);});
    results.push({ name: 'Запрещённые шрифты и жирности', status: !ui.length ? 'unavailable' : forbidden.length ? 'diff' : 'match', detail: `${ui.length} видимых UI-элементов проверено на Arial, TT Commons, CoFo и жирности кроме 400/500; отклонений: ${forbidden.length}. Шрифты самой генерации исключены. Проверяется CSS-стек, не фактически выбранный системный глиф.`, differences: forbidden.map(element => ({ element: identify(element), property: 'fontFamily / fontWeight', actual: `${subject.contentWindow.getComputedStyle(element).fontFamily} / ${subject.contentWindow.getComputedStyle(element).fontWeight}`, expected: 'system / Inter / Segoe UI / Roboto; 400 или 500' })) });
    const help = doc.querySelector('[data-shortcut-help-popup]');
    const documented = help?.textContent || '';
    const shortcuts = [...new Set(find(doc, '.action-dock button, [data-file-shortcut]').flatMap(element => element.textContent.match(/(?:⇧)?⌘[A-Z\\]/g) || []))];
    const absent = shortcuts.filter(shortcut => !documented.includes(shortcut));
    results.push({ name: 'Кнопки и справка шоткатов', status: !help ? 'unavailable' : absent.length ? 'diff' : 'match', detail: !help ? 'Справка ещё не создана.' : absent.length ? `На кнопках есть, в справке нет: ${absent.join(', ')}. Выполнение команд отдельно не проверялось.` : 'Написанные на кнопках команды присутствуют в справке. Выполнение команд отдельно не проверялось.', differences: [] });
    const hidden = [...doc.querySelectorAll('.controls-panel, .control-field-heading, .tone-group-heading, .hsb-picker')].filter(element => !visible(element));
    results.push({ name: 'Непокрытые состояния', status: 'review', detail: `Скрытых панелей, групп и пикеров: ${hidden.length}. Откройте нужный режим или Edit Mode и повторите замер. Hover, focus, экспорт, ошибки, содержимое файлов и мобильная версия требуют отдельных сценариев.`, differences: [] });

    return { schemaVersion: 1, auditorVersion: AUDITOR_VERSION, tool: loadedTool, url: subject.contentWindow.location.href, recordedAt: new Date().toISOString(), viewport: { width: subject.contentWindow.innerWidth, height: subject.contentWindow.innerHeight }, stylesheets: [...doc.querySelectorAll('link[rel=stylesheet]')].map(link => link.href), scripts: [...doc.querySelectorAll('script[src]')].map(script => script.src), modes: [...doc.querySelectorAll('input[type=radio]:checked')].map(input => ({ name: input.name, value: input.value })), results };
}

function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
}

function render() {
    const host = $('#results');
    host.replaceChildren();
    const sorted = [...report.results].sort((a,b) => ['diff','unavailable','review','match'].indexOf(a.status) - ['diff','unavailable','review','match'].indexOf(b.status));
    for (const result of sorted) {
        const section = element('details');
        section.dataset.result = result.status;
        section.open = result.status === 'diff';
        section.append(element('summary', `${labels[result.status]} · ${result.name}`), element('p', result.detail));
        if (result.differences.length) {
            const scroll = element('div'); scroll.className = 'table-scroll';
            const table = element('table'), head = element('tr');
            ['Элемент', 'Свойство', 'Сейчас', 'Эталон'].forEach(text => head.append(element('th', text)));
            const thead = element('thead'); thead.append(head); table.append(thead);
            const tbody = element('tbody');
            for (const diff of result.differences) {
                const row = element('tr');
                [diff.element, diff.property, diff.actual, diff.expected].forEach(text => row.append(element('td', text)));
                tbody.append(row);
            }
            table.append(tbody); scroll.append(table); section.append(scroll);
        }
        host.append(section);
    }
    const counts = report.results.reduce((out, result) => { out[result.status] = (out[result.status] || 0) + 1; return out; }, {});
    $('#status').textContent = `${report.tool}: ${counts.diff || 0} групп с отклонениями · ${counts.match || 0} совпадают · ${(counts.unavailable || 0) + (counts.review || 0)} требуют проверки. ${report.viewport.width} × ${report.viewport.height}.`;
}

async function scan() {
    $('#scanButton').disabled = $('#reportButton').disabled = true;
    $('#status').textContent = 'Измеряю установившееся состояние…';
    try {
        await Promise.all([subject, sparky, word].map(settle));
        report = collect(); render(); $('#reportButton').disabled = false;
    }
    catch (error) { report = null; $('#reportButton').disabled = true; $('#status').textContent = `Не удалось измерить: ${error.message}`; }
    finally { $('#scanButton').disabled = false; }
}

async function openFrame(frame, tool, width, height) {
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    const url = new URL(`../../${tool}/`, location.href);
    url.searchParams.set('ui-audit', Date.now().toString());
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { frame.onload = null; reject(new Error(`${tool}: загрузка дольше 20 секунд. Повторите открытие.`)); }, 20000);
        frame.onload = () => { clearTimeout(timeout); frame.onload = null; resolve(); };
        frame.src = url.href;
    });
    const start = Date.now();
    while (!frame.contentDocument?.querySelector('[data-shortcut-help-popup]')) {
        if (Date.now() - start > 10000) throw new Error(`${tool}: общий UI не инициализирован; замер не принят.`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    await Promise.race([frame.contentDocument.fonts.ready, new Promise((_, reject) => setTimeout(() => reject(new Error(`${tool}: шрифты не готовы.`)), 10000))]);
}

async function load(event) {
    event?.preventDefault();
    if (busy) return;
    if (loadedTool) notesByTool.set(loadedTool, $('#reproduction').value);
    busy = true; report = null; loadedTool = $('#tool').value;
    $('#reproduction').value = notesByTool.get(loadedTool) || '';
    $('#results').replaceChildren();
    $('#tool').disabled = $('#viewport').disabled = $('#loadButton').disabled = $('#scanButton').disabled = $('#reportButton').disabled = true;
    $('#status').textContent = 'Открываю инструмент и два эталона…';
    const [width, height] = $('#viewport').value.split('x').map(Number);
    try {
        const outcomes = await Promise.allSettled([openFrame(subject, loadedTool, width, height), openFrame(sparky, 'sparky', width, height), openFrame(word, 'wordplayer', width, height)]);
        const errors = outcomes.filter(outcome => outcome.status === 'rejected');
        if (errors.length) throw new Error(errors.map(outcome => outcome.reason.message).join(' '));
        await scan();
        history.replaceState(null, '', `?tool=${encodeURIComponent(loadedTool)}`);
    } catch (error) { $('#status').textContent = error.message; }
    finally { busy = false; $('#tool').disabled = $('#viewport').disabled = $('#loadButton').disabled = false; }
}

function downloadReport() {
    if (!report) return;
    const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
    const lines = ['# UI-аудит Upgrade', '', `Версия аудитора: ${report.auditorVersion}`, `Инструмент: ${report.tool}`, `URL: ${report.url}`, `Время: ${report.recordedAt}`, `Окно: ${report.viewport.width} × ${report.viewport.height}`, '', 'Это замер текущего состояния, не полная приёмка инструмента.', '', '## Наблюдения и шаги', '', $('#reproduction').value.trim() || 'Не записаны.', '', '## Режимы', '', JSON.stringify(report.modes), '', '## JS-точки входа (script src, без вложенных imports)', '', ...report.scripts.map(url => `- ${url}`), '', '## Результаты'];
    for (const result of report.results) {
        lines.push('', `### ${labels[result.status]} — ${result.name}`, '', result.detail);
        if (result.differences.length) {
            lines.push('', '| Элемент | Свойство | Сейчас | Эталон |', '| --- | --- | --- | --- |');
            for (const diff of result.differences) lines.push(`| ${[diff.element, diff.property, diff.actual, diff.expected].map(escape).join(' | ')} |`);
        }
    }
    lines.push('', '## Загруженные CSS', '', ...report.stylesheets.map(path => `- ${path}`), '');
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
    const link = element('a'); link.href = url; link.download = `ui-audit-${report.tool}-${report.recordedAt.slice(0,10)}.md`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

$('#auditForm').addEventListener('submit', load);
$('#scanButton').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    $('#tool').disabled = $('#viewport').disabled = $('#loadButton').disabled = true;
    try { await scan(); }
    finally { busy = false; $('#tool').disabled = $('#viewport').disabled = $('#loadButton').disabled = false; }
});
$('#reportButton').addEventListener('click', downloadReport);
load();
