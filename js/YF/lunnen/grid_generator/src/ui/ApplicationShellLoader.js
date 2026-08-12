const FRAGMENTS = Object.freeze([
    Object.freeze({ name: 'workspace', url: new URL('./fragments/workspace.html', import.meta.url) }),
    Object.freeze({ name: 'actions', url: new URL('./fragments/actions.html', import.meta.url) }),
    Object.freeze({ name: 'objects', url: new URL('./fragments/objects.html', import.meta.url) }),
    Object.freeze({ name: 'typography', url: new URL('./fragments/typography.html', import.meta.url) }),
    Object.freeze({ name: 'object-editors', url: new URL('./fragments/object-editors.html', import.meta.url) }),
    Object.freeze({ name: 'help', url: new URL('./fragments/help.html', import.meta.url) })
]);
const pendingLoads = new WeakMap();

async function fetchFragment({ name, url: sourceUrl }, { fetchImpl, fragmentsBaseUrl }) {
    const url = fragmentsBaseUrl ? new URL(`${name}.html`, fragmentsBaseUrl) : sourceUrl;
    const response = await fetchImpl(url.href);
    if (!response.ok) {
        throw new Error(`Failed to load application shell fragment: ${name} (${response.status})`);
    }
    return [name, await response.text()];
}

async function assembleApplicationShell(documentRef, options) {
    const fragments = await Promise.all(FRAGMENTS.map(fragment => (
        fetchFragment(fragment, options)
    )));

    for (const [name, html] of fragments) {
        const slot = documentRef.querySelector(`[data-ui-fragment="${name}"]`);
        if (!slot) throw new Error(`Missing application shell slot: ${name}`);

        const template = documentRef.createElement('template');
        template.innerHTML = html;
        slot.replaceWith(template.content);
    }

    documentRef.documentElement.dataset.applicationShell = 'ready';
    return true;
}

/**
 * Loads the modular HTML shell using ordinary same-origin requests.
 * This deliberately avoids bundler-only raw imports so the checked-in source
 * works when Netlify serves the directory as a static site.
 */
export function loadApplicationShell(documentRef = document, {
    fetchImpl = globalThis.fetch,
    fragmentsBaseUrl = null
} = {}) {
    if (documentRef.documentElement.dataset.applicationShell === 'ready') {
        return Promise.resolve(false);
    }
    if (typeof fetchImpl !== 'function') {
        return Promise.reject(new Error('Fetch API is required to load the application shell'));
    }

    const pendingLoad = pendingLoads.get(documentRef);
    if (pendingLoad) return pendingLoad;

    documentRef.documentElement.dataset.applicationShell = 'loading';
    const load = assembleApplicationShell(documentRef, { fetchImpl, fragmentsBaseUrl })
        .catch(error => {
            documentRef.documentElement.dataset.applicationShell = 'error';
            throw error;
        })
        .finally(() => pendingLoads.delete(documentRef));
    pendingLoads.set(documentRef, load);
    return load;
}
