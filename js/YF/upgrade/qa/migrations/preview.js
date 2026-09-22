import { validateCatalog, runtimeTools, toolHref } from '../../catalog/registry.js';

const container = document.querySelector('#tools');
try {
    const response = await fetch('../../TOOL_CATALOG.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = validateCatalog(await response.json());
    container.replaceChildren();
    for (const tool of runtimeTools(catalog).filter(tool => tool.cohort === 'migration')) {
        const article = document.createElement('article');
        const heading = document.createElement('h2');
        heading.textContent = tool.name;
        const status = document.createElement('p');
        status.textContent = `${catalog.groups.find(group => group.id === tool.group).name} · ${tool.state === 'accepted' ? 'Принят' : 'Перенос / исходный UI'}`;
        const links = document.createElement('div');
        links.className = 'links';
        const open = document.createElement('a');
        open.href = `../../${toolHref(tool)}`;
        open.textContent = 'Открыть';
        open.setAttribute('aria-label', `Открыть ${tool.name}`);
        const audit = document.createElement('a');
        audit.href = `../ui-audit/?tool=${encodeURIComponent(tool.id)}`;
        audit.textContent = 'UI-аудит';
        audit.setAttribute('aria-label', `UI-аудит ${tool.name}`);
        links.append(open, audit);
        article.append(heading, status, links);
        container.append(article);
    }
} catch (error) {
    container.textContent = `Не удалось загрузить каталог: ${error.message}`;
}
