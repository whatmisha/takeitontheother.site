import workspaceHtml from './fragments/workspace.html?raw';
import actionsHtml from './fragments/actions.html?raw';
import objectsHtml from './fragments/objects.html?raw';
import typographyHtml from './fragments/typography.html?raw';
import objectEditorsHtml from './fragments/object-editors.html?raw';
import helpHtml from './fragments/help.html?raw';

const FRAGMENTS = Object.freeze({
    workspace: workspaceHtml,
    actions: actionsHtml,
    objects: objectsHtml,
    typography: typographyHtml,
    'object-editors': objectEditorsHtml,
    help: helpHtml
});

export function loadApplicationShell(documentRef = document) {
    if (documentRef.documentElement.dataset.applicationShell === 'ready') return false;

    for (const [name, html] of Object.entries(FRAGMENTS)) {
        const slot = documentRef.querySelector(`[data-ui-fragment="${name}"]`);
        if (!slot) throw new Error(`Missing application shell slot: ${name}`);

        const template = documentRef.createElement('template');
        template.innerHTML = html;
        slot.replaceWith(template.content);
    }

    documentRef.documentElement.dataset.applicationShell = 'ready';
    return true;
}
