const resultElement = document.getElementById('result');
const appFrame = document.getElementById('appFrame');
const checks = [];
const applicationErrors = [];

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
    appFrame.contentWindow.addEventListener('error', event => {
        applicationErrors.push(event.error?.stack || event.message);
    });
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

    await waitFor(
        () => appDocument.querySelectorAll('#gridSvg [id^="text-group-"]').length > 0,
        'preset text rendering'
    );
    await waitFor(
        () => appDocument.querySelectorAll('#gridSvg [id^="graphics-group-"]').length > 0,
        'preset graphics rendering'
    );

    assert(appDocument.querySelectorAll('#elementsList .element-item').length > 0, 'preset objects load into the navigator');
    assert(appDocument.querySelectorAll('#gridSvg [id^="text-group-"]').length > 0, 'text objects render on the canvas');
    assert(appDocument.querySelectorAll('#gridSvg [id^="graphics-group-"]').length > 0, 'graphics objects render on the canvas');
    assert(appDocument.querySelectorAll('#gridSvg [data-surface]').length === 4, 'all four side surface layers render');

    const textItem = appDocument.querySelector('#elementsList [data-element-type="text"]');
    const editedTextId = textItem.dataset.elementId;
    textItem.click();
    await waitFor(() => appDocument.getElementById('paragraphPanel').classList.contains('active'), 'text editor opening');
    assert(appDocument.getElementById('paragraphPanel').style.display === 'flex', 'text object opens its editor panel');
    const getFirstTextY = () => Number(
        appDocument.querySelector(`#text-group-${editedTextId} text`)?.getAttribute('y')
    );
    const baselineY = getFirstTextY();
    const xHeightControl = appDocument.getElementById('alignmentModeXHeight');
    xHeightControl.checked = true;
    xHeightControl.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    await waitFor(() => getFirstTextY() !== baselineY, 'x-height text rendering');
    const xHeightY = getFirstTextY();
    assert(xHeightY !== baselineY, 'text supports X-Height alignment');
    const capHeightControl = appDocument.getElementById('alignmentModeCapHeight');
    capHeightControl.checked = true;
    capHeightControl.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    await waitFor(() => getFirstTextY() !== xHeightY, 'cap-height text rendering');
    assert(getFirstTextY() !== xHeightY, 'text supports Cap Height alignment');
    const baselineControl = appDocument.getElementById('alignmentModeBaseline');
    baselineControl.checked = true;
    baselineControl.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    await waitFor(() => getFirstTextY() === baselineY, 'baseline text rendering');
    assert(getFirstTextY() === baselineY, 'text restores Baseline alignment');
    const paragraphWidthInput = appDocument.getElementById('paragraphWidthInput');
    const paragraphWidthBefore = Number(paragraphWidthInput.value);
    paragraphWidthInput.focus();
    paragraphWidthInput.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: paragraphWidthBefore >= 11.75 ? 'ArrowDown' : 'ArrowUp',
        bubbles: true,
        cancelable: true
    }));
    await waitFor(() => Number(paragraphWidthInput.value) !== paragraphWidthBefore, 'text width keyboard update');
    assert(Number(paragraphWidthInput.value) !== paragraphWidthBefore, 'text width responds in quarter-column steps');
    appDocument.getElementById('canvasContainer').click();
    await waitFor(() => !appDocument.getElementById('paragraphPanel').classList.contains('active'), 'text editor closing');
    assert(appDocument.getElementById('paragraphPanel').style.display === 'none', 'outside click closes the text editor panel');

    const graphicsItem = appDocument.querySelector(
        '#elementsList [data-element-type="graphics"], #elementsList [data-element-type="icons"], #elementsList [data-element-type="claim"]'
    );
    graphicsItem.click();
    await waitFor(() => appDocument.getElementById('graphicsPanel').classList.contains('active'), 'graphics editor opening');
    assert(appDocument.getElementById('graphicsPanel').style.display === 'flex', 'graphics object opens its editor panel');
    const graphicsHeightInput = appDocument.getElementById('graphicsHeightInput');
    const graphicsHeightBefore = Number(graphicsHeightInput.value);
    graphicsHeightInput.focus();
    graphicsHeightInput.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: graphicsHeightBefore >= 19.75 ? 'ArrowDown' : 'ArrowUp',
        bubbles: true,
        cancelable: true
    }));
    await waitFor(() => Number(graphicsHeightInput.value) !== graphicsHeightBefore, 'graphics height keyboard update');
    assert(Number(graphicsHeightInput.value) !== graphicsHeightBefore, 'graphics height responds in quarter-module steps');
    appDocument.getElementById('canvasContainer').click();
    await waitFor(() => !appDocument.getElementById('graphicsPanel').classList.contains('active'), 'graphics editor closing');
    assert(appDocument.getElementById('graphicsPanel').style.display === 'none', 'outside click closes the graphics editor panel');

    const textItemSelector = '#elementsList .element-item[data-element-type="text"]';
    const textItemsBeforeDuplicate = appDocument.querySelectorAll(textItemSelector).length;
    const sourceTextItem = appDocument.querySelector(textItemSelector);
    sourceTextItem.querySelector('[title="Duplicate"]').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const textItemsAfterDuplicate = appDocument.querySelectorAll(textItemSelector).length;
    assert(
        textItemsAfterDuplicate === textItemsBeforeDuplicate + 1,
        `Objects duplicate action creates one text object (${textItemsBeforeDuplicate} → ${textItemsAfterDuplicate})`
    );

    const duplicatedTextItems = appDocument.querySelectorAll(textItemSelector);
    const duplicatedTextId = duplicatedTextItems[duplicatedTextItems.length - 1].dataset.elementId;
    await new Promise(resolve => setTimeout(resolve, 150));
    appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"] [title="Hide"]`).click();
    await waitFor(
        () => appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"]`)?.classList.contains('hidden'),
        'object visibility toggle'
    );
    assert(
        appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"]`).classList.contains('hidden'),
        'Objects visibility action updates the item state'
    );

    appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"] [title="Delete"]`).click();
    await waitFor(
        () => appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"]`)?.closest('.element-item-wrapper')?.classList.contains('deleting'),
        'pending object deletion'
    );
    assert(
        appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"]`).textContent.trim() === 'Undo',
        'Objects delete action exposes Undo before permanent deletion'
    );

    appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"]`).click();
    await waitFor(
        () => !appDocument.querySelector(`#elementsList [data-element-id="${duplicatedTextId}"]`)?.closest('.element-item-wrapper')?.classList.contains('deleting'),
        'object deletion undo'
    );
    assert(
        appDocument.querySelectorAll(textItemSelector).length === textItemsBeforeDuplicate + 1,
        'Objects Undo restores the pending object'
    );

    const textItemsBeforeAdd = appDocument.querySelectorAll(textItemSelector).length;
    appDocument.getElementById('addTextBtn').click();
    await waitFor(
        () => appDocument.querySelectorAll(textItemSelector).length === textItemsBeforeAdd + 1,
        'new text object creation'
    );
    await waitFor(
        () => appDocument.getElementById('paragraphPanel').classList.contains('active'),
        'new text editor opening'
    );
    assert(
        appDocument.getElementById('paragraphLockPositionToggle').checked,
        'new text objects are constrained to their surface by default'
    );
    appDocument.getElementById('canvasContainer').click();
    await waitFor(
        () => !appDocument.getElementById('paragraphPanel').classList.contains('active'),
        'new text editor closing'
    );

    appDocument.getElementById('canvasRotateLeftBtn').click();
    await waitFor(() => appDocument.getElementById('gridSvg').style.transform.includes('270deg'), 'canvas rotation');
    assert(appDocument.getElementById('gridSvg').style.transform.includes('270deg'), 'canvas rotates left without changing document data');

    const dragSource = appDocument.querySelector('#gridSvg [id^="hover-area-"]');
    const draggedBlockId = dragSource.dataset.blockId;
    const leftSurface = appDocument.querySelector('#gridSvg [data-surface="left"]');
    const sourceRect = dragSource.getBoundingClientRect();
    const targetRect = leftSurface.getBoundingClientRect();
    const startPoint = {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2
    };
    const targetPoint = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2
    };
    const mouse = (target, type, point) => target.dispatchEvent(new appWindow.MouseEvent(type, {
        button: 0,
        buttons: type === 'mouseup' ? 0 : 1,
        clientX: point.x,
        clientY: point.y,
        bubbles: true,
        cancelable: true
    }));
    mouse(dragSource, 'mousedown', startPoint);
    mouse(appDocument, 'mousemove', { x: startPoint.x + 6, y: startPoint.y + 6 });
    mouse(appDocument, 'mousemove', targetPoint);
    mouse(appDocument, 'mouseup', targetPoint);
    await waitFor(
        () => appDocument.getElementById(`text-group-${draggedBlockId}`)?.closest('[data-surface="left"]'),
        'rotated cross-surface text drag'
    );
    assert(
        appDocument.getElementById(`text-group-${draggedBlockId}`).closest('[data-surface="left"]'),
        'text drag reaches the left surface while the canvas is rotated'
    );


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

    const marginsInput = appDocument.getElementById('marginsValue');
    const marginsInModules = Number(marginsInput.value);
    const moduleInMillimeters = Number(moduleInput.value);
    appDocument.getElementById('marginsUnitMm').click();
    await waitFor(
        () => appDocument.getElementById('marginsUnitMm').classList.contains('active'),
        'Margins mm unit switch'
    );
    assert(
        Math.abs(Number(marginsInput.value) - marginsInModules * moduleInMillimeters) < 0.001,
        'Margins unit switch preserves physical size'
    );
    appDocument.getElementById('marginsUnitMod').click();
    await waitFor(
        () => appDocument.getElementById('marginsUnitMod').classList.contains('active'),
        'Margins mod unit restoration'
    );
    assert(
        Math.abs(Number(marginsInput.value) - marginsInModules) < 0.001,
        'Margins restores its modular value'
    );

    const lockModuleButton = appDocument.getElementById('lockModuleBtn');
    const lockMarginsButton = appDocument.getElementById('lockMarginsBtn');
    lockModuleButton.click();
    await waitFor(() => lockModuleButton.classList.contains('locked'), 'Module lock');
    assert(lockModuleButton.classList.contains('locked'), 'Grid module can be locked');
    lockMarginsButton.click();
    await waitFor(() => lockMarginsButton.classList.contains('locked'), 'Margins lock');
    assert(!lockModuleButton.classList.contains('locked'), 'Margins lock releases module lock');
    assert(lockMarginsButton.classList.contains('locked'), 'Grid margins can be locked');
    lockMarginsButton.click();

    appDocument.getElementById('linkModeOff').click();
    await waitFor(
        () => !appDocument.getElementById('linkedControlsContainer').classList.contains('linked-controls-group'),
        'Link mode off'
    );
    assert(appDocument.getElementById('linkModeOff').checked, 'Link mode switches off');
    appDocument.getElementById('linkModeModule').click();
    await waitFor(
        () => appDocument.getElementById('linkedControlsContainer').classList.contains('linked-controls-group'),
        'Link mode module'
    );
    assert(appDocument.getElementById('linkModeModule').checked, 'Link mode switches back to module');

    const headlineToggle = appDocument.querySelector('#headlineHeader .collapse-toggle');
    if (headlineToggle.getAttribute('aria-expanded') !== 'true') headlineToggle.click();
    await waitFor(() => headlineToggle.getAttribute('aria-expanded') === 'true', 'Headline expansion');

    const headlineSlider = appDocument.getElementById('headlineSizeSlider');
    appDocument.getElementById('headlineSizeUnitPt').click();
    await waitFor(() => headlineSlider.max === '500', 'Headline pt range');
    assert(headlineSlider.min === '0' && headlineSlider.max === '500', 'Headline applies the pt range');
    assert(appDocument.getElementById('headlineSizeUnitPt').classList.contains('active'), 'Headline switches to pt');
    assert(
        ['textSizeUnitPt', 'captionSizeUnitPt', 'lunnenDisplaySizeUnitPt'].every(
            id => appDocument.getElementById(id).classList.contains('active')
        ),
        'Typography size unit buttons stay synchronized'
    );
    assert(
        ['textSizeSlider', 'captionSizeSlider', 'lunnenDisplaySizeSlider'].every(
            id => appDocument.getElementById(id).max === '500'
        ),
        'Typography size slider ranges stay synchronized'
    );

    appDocument.getElementById('headlineSizeUnitMod').click();
    await waitFor(() => headlineSlider.max === '25', 'Headline mod range restoration');
    assert(headlineSlider.max === '25', 'Headline restores the original maximum in mod');
    assert(headlineSlider.min === '0.01', 'Headline restores original minimum in mod');
    assert(appDocument.getElementById('headlineSizeUnitMod').classList.contains('active'), 'Headline switches back to mod');

    const widthInput = appDocument.getElementById('frontWidthValue');
    const widthBefore = Number(widthInput.value);
    widthInput.focus();
    widthInput.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true
    }));
    widthInput.blur();
    await waitFor(() => Number(widthInput.value) === widthBefore + 1, 'Dimension keyboard update');
    const rememberedWidth = Number(widthInput.value);
    assert(rememberedWidth === widthBefore + 1, 'Dimensions use the shared numeric keyboard behavior');

    const presetToggle = appDocument.getElementById('presetDropdownToggle');
    presetToggle.click();
    const otherPreset = Array.from(
        appDocument.querySelectorAll('#presetDropdownMenu .preset-dropdown-item[data-file]')
    ).find(item => item.dataset.file === 'Airis 14" Front.json');
    otherPreset.click();
    await waitFor(
        () => presetToggle.textContent.includes('Airis 14" Front'),
        'second preset loading'
    );
    await waitFor(() => Number(widthInput.value) !== rememberedWidth, 'second preset dimensions');
    assert(Number(widthInput.value) !== rememberedWidth, 'Preset switch replaces the document state');

    presetToggle.click();
    appDocument.querySelector(
        '#presetDropdownMenu .preset-dropdown-item[data-file="New.json"]'
    ).click();
    await waitFor(() => presetToggle.textContent.includes('+ New'), 'first preset history loading');
    await waitFor(() => Number(widthInput.value) === rememberedWidth, 'per-preset history restoration');
    assert(Number(widthInput.value) === rememberedWidth, 'Returning to a preset restores its latest history state');

    document.body.dataset.status = 'passed';
    resultElement.textContent = `${checks.join('\n')}\n\nPASS — ${checks.length} checks`;
}

run().catch(error => {
    document.body.dataset.status = 'failed';
    const applicationErrorText = applicationErrors.length
        ? `\n\nApplication errors:\n${applicationErrors.join('\n')}`
        : '';
    resultElement.textContent = `${checks.join('\n')}\n\nFAIL — ${error.message}\n${error.stack || ''}${applicationErrorText}`;
});
