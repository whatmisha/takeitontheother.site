const status = document.querySelector('[data-visual-status]');
const output = document.querySelector('#visualResult');

const families = [
    { name: 'top-link', lab: '.component-lab__chrome .top-link', tool: '.top-links .top-link', properties: ['fontFamily', 'fontSize', 'fontWeight', 'borderRadius', 'backgroundColor', 'color'] },
    { name: 'preset', lab: '.component-lab__chrome .preset-dropdown-toggle', tool: '.top-links .preset-dropdown-toggle', properties: ['fontFamily', 'fontSize', 'fontWeight', 'borderRadius', 'backgroundColor', 'color'] },
    { name: 'zoom', lab: '.component-lab__chrome .zoom-indicator', tool: '.top-links .zoom-indicator', properties: ['fontFamily', 'fontSize', 'fontWeight', 'borderRadius', 'backgroundColor', 'color'] },
    { name: 'panel', lab: '.component-lab__panel', tool: '.controls-panel', properties: ['fontFamily', 'backgroundColor', 'color', 'borderRadius', 'boxShadow'] },
    { name: 'collapse', lab: '.component-lab__panel .collapse-icon', tool: '.controls-panel .collapse-icon', properties: ['width', 'height', 'borderRadius', 'color'] },
    { name: 'action', lab: '.component-lab__dock [data-action-dock-primary-export]', tool: '.action-dock [data-action-dock-primary-export]', properties: ['fontFamily', 'fontSize', 'fontWeight', 'minHeight', 'borderRadius'] },
    { name: 'file-intake', lab: '.component-lab__intakes .file-intake__trigger', tool: '.file-intake__trigger', properties: ['fontFamily', 'fontSize', 'fontWeight', 'borderRadius', 'backgroundColor', 'color'] },
    { name: 'range', lab: '#labRange', tool: '.controls-panel input[type="range"]', properties: ['height', 'backgroundColor'] }
];

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function waitForFrame(frame) {
    return new Promise((resolve, reject) => {
        const ready = () => frame.contentDocument?.readyState === 'complete';
        if (ready()) return resolve(frame.contentWindow);
        const timeout = setTimeout(() => reject(new Error(`${frame.title} timed out`)), 8000);
        frame.addEventListener('load', () => { clearTimeout(timeout); resolve(frame.contentWindow); }, { once: true });
    });
}

function waitForMarker(win, marker) {
    return new Promise((resolve, reject) => {
        const started = performance.now();
        const poll = () => {
            if (win.document.documentElement.dataset[marker] === 'true') return resolve();
            const error = win.document.documentElement.dataset.componentLabError;
            if (error) return reject(new Error(error));
            if (performance.now() - started > 8000) return reject(new Error(`${win.document.title}: ${marker} timed out`));
            setTimeout(poll, 20);
        };
        poll();
    });
}

function styleRecord(win, selector, properties) {
    const element = win.document.querySelector(selector);
    invariant(element, `Missing ${selector} in ${win.document.title}`);
    const style = win.getComputedStyle(element);
    return Object.fromEntries(properties.map(property => [property, style[property]]));
}

function dispatchShortcut(win, key, init = {}) {
    const target = win.document.querySelector('.canvas-container') || win.document.body;
    target.dispatchEvent(new win.KeyboardEvent('keydown', { key, code: init.code || '', bubbles: true, cancelable: true, ...init }));
}

function keyboardWalkthrough(win) {
    const panels = [...win.document.querySelectorAll('.controls-panel')];
    invariant(panels.length > 0, `${win.document.title}: no panels`);
    dispatchShortcut(win, '\\', { metaKey: true });
    invariant(panels.every(panel => panel.classList.contains('panel-collapsed')), `${win.document.title}: collapse-all failed`);
    dispatchShortcut(win, '\\', { metaKey: true });
    invariant(panels.every(panel => !panel.classList.contains('panel-collapsed')), `${win.document.title}: panel restore failed`);
    dispatchShortcut(win, '?', { shiftKey: true });
    const help = win.document.querySelector('[data-shortcut-help-popup]');
    invariant(help && !help.hidden, `${win.document.title}: keyboard help failed`);
    dispatchShortcut(win, 'Escape');
    invariant(help.hidden, `${win.document.title}: Escape did not close keyboard help`);
    dispatchShortcut(win, 'j');
    const extra = win.document.querySelector('[data-action-dock-extra]');
    invariant(extra && !extra.hidden, `${win.document.title}: J did not reveal JSON actions`);
    dispatchShortcut(win, 'Escape');
    invariant(extra.hidden, `${win.document.title}: Escape did not close JSON actions`);
}

window.__uiGarageVisualContract = Promise.all([...document.querySelectorAll('iframe')].map(waitForFrame))
    .then(async ([lab, svg, canvas]) => {
        await Promise.all([
            waitForMarker(lab, 'componentLabReady'),
            waitForMarker(svg, 'starterReady'),
            waitForMarker(canvas, 'starterReady')
        ]);
        invariant(lab.document.documentElement.dataset.componentLabReady === 'true', `Component Lab runtime is not ready: ${lab.document.documentElement.dataset.componentLabError || 'no diagnostic'}`);
        invariant(svg.document.documentElement.dataset.starterReady === 'true', 'SVG starter is not ready');
        invariant(canvas.document.documentElement.dataset.starterReady === 'true', 'Canvas starter is not ready');
        const comparisons = [];
        for (const tool of [svg, canvas]) {
            for (const family of families) {
                const expected = styleRecord(lab, family.lab, family.properties);
                const actual = styleRecord(tool, family.tool, family.properties);
                invariant(JSON.stringify(actual) === JSON.stringify(expected), `${tool.document.title}: ${family.name} style mismatch\nexpected ${JSON.stringify(expected)}\nactual ${JSON.stringify(actual)}`);
                comparisons.push(`${tool.document.title}:${family.name}`);
            }
            keyboardWalkthrough(tool);
        }
        return { status: 'passed', comparisons, keyboardWalkthroughs: 2 };
    })
    .then(result => {
        status.dataset.visualStatus = 'passed';
        status.textContent = 'Visual contract passed';
        output.textContent = JSON.stringify(result, null, 2);
        return result;
    })
    .catch(error => {
        const result = { status: 'failed', error: error?.stack || String(error) };
        status.dataset.visualStatus = 'failed';
        status.textContent = 'Visual contract failed';
        output.textContent = JSON.stringify(result, null, 2);
        console.error(error);
        return result;
    });
