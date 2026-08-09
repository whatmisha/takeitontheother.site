const resultElement = document.getElementById('result');
const appFrame = document.getElementById('appFrame');
const checks = [];

function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks.push(`✓ ${message}`);
}

async function waitFor(predicate, message, timeout = 8000) {
    const startedAt = performance.now();
    while (performance.now() - startedAt < timeout) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out: ${message}`);
}

async function loadApplication() {
    const loaded = new Promise((resolve, reject) => {
        appFrame.addEventListener('load', resolve, { once: true });
        appFrame.addEventListener('error', () => reject(new Error('Application iframe failed to load')), { once: true });
    });
    appFrame.src = `../index.html?browser-smoke=${Date.now()}`;
    await loaded;

    const appDocument = appFrame.contentDocument;
    await waitFor(
        () => appDocument.getElementById('gridSvg')?.childElementCount > 0,
        'application initialization'
    );
    await waitFor(
        () => !appDocument.getElementById('presetDropdownToggle')?.textContent.includes('Loading'),
        'preset loading'
    );
    return appDocument;
}

async function run() {
    const appDocument = await loadApplication();
    const appWindow = appFrame.contentWindow;

    assert(appDocument.querySelectorAll('#elementsList .element-item').length > 0, 'preset objects load into the navigator');
    assert(appDocument.querySelectorAll('#gridSvg [id^="text-group-"]').length > 0, 'text objects render on the canvas');
    assert(appDocument.querySelectorAll('#gridSvg [id^="graphics-group-"]').length > 0, 'graphics objects render on the canvas');
    assert(appDocument.querySelectorAll('#gridSvg [data-surface]').length === 4, 'all four side surface layers render');

    appDocument.getElementById('canvasRotateLeftBtn').click();
    await waitFor(() => appDocument.getElementById('gridSvg').style.transform.includes('270deg'), 'canvas rotation');
    assert(appDocument.getElementById('gridSvg').style.transform.includes('270deg'), 'canvas rotates left without changing document data');


    const surfacePanel = appDocument.getElementById('surfacePanel');
    const surfaceHeader = appDocument.getElementById('surfacePanelHeader');
    const surfaceCollapse = surfaceHeader.querySelector('.collapse-icon');
    assert(surfaceHeader.firstElementChild.textContent.trim() === 'Sides', 'collapsed panel title contains only Sides');
    assert(surfacePanel.classList.contains('panel-collapsed'), 'Sides starts collapsed');
    assert(surfaceCollapse.getAttribute('aria-expanded') === 'false', 'collapsed Sides exposes correct ARIA state');

    surfaceCollapse.click();
    await waitFor(() => !surfacePanel.classList.contains('panel-collapsed'), 'Sides expansion');
    assert(surfaceCollapse.getAttribute('aria-expanded') === 'true', 'Sides expands through its header control');

    const ownGridToggle = appDocument.getElementById('surfaceOwnGridToggle');
    ownGridToggle.click();
    await waitFor(() => ownGridToggle.checked, 'Own Grid toggle');
    assert(!appDocument.getElementById('surfaceOwnGridControls').hidden, 'Own Grid reveals independent controls');

    const gridContent = appDocument.querySelector('#gridPanel > .panel-content');
    assert(gridContent.scrollHeight <= gridContent.clientHeight, 'Own Grid does not add overflow to Grid panel');

    const moduleInput = appDocument.getElementById('gridModuleValue');
    const moduleBefore = Number(moduleInput.value);
    moduleInput.focus();
    moduleInput.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true
    }));
    await waitFor(() => Number(moduleInput.value) > moduleBefore, 'Grid module keyboard update');
    assert(Number(moduleInput.value) > moduleBefore, 'Grid module responds to ArrowUp');
    assert(Number(appDocument.getElementById('rowCountValue').value) > 0, 'Grid recalculates dependent row count');

    const headlineToggle = appDocument.querySelector('#headlineHeader .collapse-toggle');
    if (headlineToggle.getAttribute('aria-expanded') !== 'true') headlineToggle.click();
    await waitFor(() => headlineToggle.getAttribute('aria-expanded') === 'true', 'Headline expansion');

    const headlineSlider = appDocument.getElementById('headlineSizeSlider');
    appDocument.getElementById('headlineSizeUnitPt').click();
    await waitFor(() => headlineSlider.max === '500', 'Headline pt range');
    assert(headlineSlider.min === '0' && headlineSlider.max === '500', 'Headline applies the pt range');
    assert(appDocument.getElementById('headlineSizeUnitPt').classList.contains('active'), 'Headline switches to pt');

    appDocument.getElementById('headlineSizeUnitMod').click();
    await waitFor(() => headlineSlider.max === '25', 'Headline mod range restoration');
    assert(headlineSlider.max === '25', 'Headline restores the original maximum in mod');
    assert(headlineSlider.min === '0.01', 'Headline restores original minimum in mod');
    assert(appDocument.getElementById('headlineSizeUnitMod').classList.contains('active'), 'Headline switches back to mod');

    document.body.dataset.status = 'passed';
    resultElement.textContent = `${checks.join('\n')}\n\nPASS — ${checks.length} checks`;
}

run().catch(error => {
    document.body.dataset.status = 'failed';
    resultElement.textContent = `${checks.join('\n')}\n\nFAIL — ${error.message}\n${error.stack || ''}`;
});
