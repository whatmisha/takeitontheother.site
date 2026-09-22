// Shared, DOM-free catalog policy. Generated HTML also works without JavaScript.
export const isAuditableState = state => state === 'migrating' || state === 'accepted';
export const runtimeTools = catalog => catalog.tools.filter(tool => isAuditableState(tool.state));
export const publishedTools = catalog => catalog.tools.filter(tool => tool.state === 'accepted');
export const toolHref = tool => tool.entry.replace(/index\.html$/, '');

export function validateDirectoryCoverage(catalog, directoryNames) {
    const directories = new Set(directoryNames);
    for (const tool of catalog.tools) {
        if (tool.state === 'planned' && directories.has(tool.id)) {
            throw new Error(`${tool.id}: copied app must be marked migrating so runtime checks cannot skip it`);
        }
        if (isAuditableState(tool.state) && !directories.has(tool.id)) {
            throw new Error(`${tool.id}: missing runtime directory`);
        }
    }
}

export function validateCatalog(catalog) {
    const fail = message => { throw new Error(`Tool catalog: ${message}`); };
    if (catalog?.schemaVersion !== 1 || catalog.scope !== 'upgrade-only') fail('unsupported schema/scope');
    if (!Array.isArray(catalog.groups) || !Array.isArray(catalog.tools)) fail('groups and tools are required');
    const groups = new Set();
    for (const group of catalog.groups) {
        if (!/^[a-z][a-z0-9-]*$/.test(group.id) || !group.name || groups.has(group.id)) fail('invalid/duplicate group');
        groups.add(group.id);
    }
    const ids = new Set();
    for (const tool of catalog.tools) {
        if (!/^[a-z][a-z0-9_-]*$/.test(tool.id) || ids.has(tool.id)) fail('invalid/duplicate tool id');
        ids.add(tool.id);
        if (tool.entry !== `${tool.id}/index.html`) fail(`${tool.id}: entry must stay in its own upgrade directory`);
        if (typeof tool.name !== 'string' || !tool.name.trim() || !groups.has(tool.group)) fail(`${tool.id}: missing name/group`);
        if (!['planned', 'migrating', 'accepted'].includes(tool.state)) fail(`${tool.id}: invalid state`);
        if (!['original', 'migration'].includes(tool.cohort)) fail(`${tool.id}: invalid cohort`);
        if (tool.cohort === 'original' && tool.state !== 'accepted') fail(`${tool.id}: original tool cannot be unpublished`);
        if (!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.json#[a-z][a-z0-9_-]*$/.test(tool.capabilityContract)) fail(`${tool.id}: invalid local contract reference`);
        const viewport = tool.referenceViewport;
        if (![viewport?.width, viewport?.height].every(value => Number.isInteger(value) && value > 0)) fail(`${tool.id}: invalid reference viewport`);
    }
    return catalog;
}

const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function renderHub(catalog) {
    validateCatalog(catalog);
    return catalog.groups.map(group => [
        `    <section aria-labelledby="${group.id}-heading">`,
        `      <h2 id="${group.id}-heading">${escape(group.name)}</h2>`,
        '      <ul>',
        ...catalog.tools.filter(tool => tool.group === group.id).map(tool => tool.state === 'accepted'
            ? `        <li><a href="${toolHref(tool)}">${escape(tool.name)}</a></li>`
            : `        <li><span class="tool-placeholder">${escape(tool.name)}</span></li>`),
        '      </ul>',
        '    </section>'
    ].join('\n')).join('\n');
}

export function renderAuditOptions(catalog) {
    validateCatalog(catalog);
    return catalog.tools.map(tool => {
        const state = tool.state === 'planned' ? ' — запланирован' : tool.state === 'migrating' ? ' — перенос' : '';
        return `                <option value="${tool.id}" data-tool-state="${tool.state}"${!isAuditableState(tool.state) ? ' disabled' : ''}${tool.id === 'wander_bender' ? ' selected' : ''}>${escape(tool.name + state)}</option>`;
    }).join('\n');
}

export function replaceGeneratedRegion(html, name, content) {
    const start = `<!-- catalog:${name}:start -->`, end = `<!-- catalog:${name}:end -->`;
    if (html.split(start).length !== 2 || html.split(end).length !== 2 || html.indexOf(start) > html.indexOf(end)) {
        throw new Error(`Missing/duplicate generated region: ${name}`);
    }
    return html.slice(0, html.indexOf(start) + start.length) + '\n' + content + '\n' + html.slice(html.indexOf(end));
}
