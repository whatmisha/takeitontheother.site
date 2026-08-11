import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';

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
        () => ['true', 'error'].includes(appDocument.documentElement.dataset.appReady),
        'deterministic application startup'
    );
    if (appDocument.documentElement.dataset.appReady === 'error') {
        throw new Error('Application reported a startup error');
    }
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
    const presetFormat = new PresetFormatAdapter();
    const presetRoundTrip = presetFormat.normalize(JSON.parse(JSON.stringify(
        presetFormat.organize({
            version: '1.2',
            settings: {
                frontWidth: 500,
                frontHeight: 500,
                thickness: 50,
                surfaceSettings: { front: { visible: true, rotation: 0, gridMode: 'main' } },
                gridModule: 5,
                margins: 2.5,
                columnCount: 12,
                rowCount: 12,
                rowHeight: 7,
                fontSizeUnit: 'pt',
                lineHeightUnit: 'pt',
                lockedModule: true,
                lockedModuleValue: 4.25,
                captionSize: 0.37,
                captionLineHeight: 1.25,
                captionTracking: 0.045,
                useXHeightCaption: true,
                captionFontWeight: 350,
                lunnenDisplaySize: 2.7,
                lunnenDisplayLineHeight: 3.6,
                lunnenDisplayTracking: 0.02,
                useXHeightLunnenDisplay: true
            },
            textBlocks: [{
                id: 'display',
                styleRef: 'lunnenDisplay',
                lockPosition: false,
                fontWeight: 275,
                fontFeatures: { salt: true }
            }],
            graphicsBlocks: [{
                id: 'icons',
                isBuiltIn: true,
                sizeMode: 'width',
                widthInColumns: 4.5,
                alignment: 'right',
                lockPosition: false
            }]
        }, { presetName: 'Browser round trip' })
    )));
    assert(
        presetRoundTrip.settings.captionSize === 0.37 &&
            presetRoundTrip.settings.captionFontWeight === 350,
        'Caption typography survives JSON round-trip'
    );
    assert(
        presetRoundTrip.settings.lunnenDisplaySize === 2.7 &&
            presetRoundTrip.textBlocks[0].fontFeatures.salt,
        'Lunnen Display settings and features survive JSON round-trip'
    );
    assert(
        presetRoundTrip.settings.fontSizeUnit === 'pt' &&
            presetRoundTrip.settings.lockedModuleValue === 4.25,
        'Typography units and grid locks survive JSON round-trip'
    );
    assert(
        presetRoundTrip.graphicsBlocks[0].sizeMode === 'width' &&
            presetRoundTrip.graphicsBlocks[0].lockPosition === false,
        'Built-in graphics sizing and constraints survive JSON round-trip'
    );

    const appDocument = await loadApplication();
    const appWindow = appFrame.contentWindow;
    const application = appWindow[Symbol.for('lunnen.grid-generator.application')];
    assert(
        appDocument.documentElement.dataset.applicationShell === 'ready',
        'modular HTML shell assembles before application startup'
    );
    assert(
        application?.getPerformanceMetrics().render.count > 0,
        'render performance metrics record application startup'
    );
    const exportMetricsBefore = application.getPerformanceMetrics().export;
    await application.exportDocumentBuilder.build(false);
    const exportMetricsAfter = application.getPerformanceMetrics().export;
    assert(
        exportMetricsAfter.count === exportMetricsBefore.count + 1 &&
            exportMetricsAfter.lastMs >= 0,
        'export performance metrics record a real document build'
    );
    const cacheBefore = application.getPerformanceMetrics().export.assets;
    await application.exportDocumentBuilder.loadSvgAsset('lunnen_logo.svg');
    await application.exportDocumentBuilder.loadSvgAsset('lunnen_logo.svg');
    const cacheAfter = application.getPerformanceMetrics().export.assets;
    assert(
        cacheAfter.requests === cacheBefore.requests + 1 &&
            cacheAfter.hits === cacheBefore.hits + 1,
        'export SVG template cache reuses parsed design-kit assets'
    );
    application.errorPresenter.show(new Error('Smoke notification'), {
        title: 'Smoke',
        timeoutMs: 60_000
    });
    const errorNotification = appDocument.querySelector('.app-notification-error');
    assert(
        errorNotification?.hidden === false && errorNotification.getAttribute('role') === 'alert',
        'application errors use a non-blocking accessible notification'
    );
    application.errorPresenter.clear();
    const builtInAssetUrls = ['graphics/icons.svg', 'graphics/yf_claim.svg'].map(
        path => new URL(path, appWindow.location.href).href
    );

    await waitFor(
        () => builtInAssetUrls.every(url => appWindow.performance.getEntriesByName(url).length > 0),
        'built-in graphics loading'
    );
    assert(
        builtInAssetUrls.every(url => appWindow.performance.getEntriesByName(url).length > 0),
        'both built-in SVG assets load during bootstrap'
    );
    const initialPresetEntry = appWindow.performance.getEntriesByType('resource').find(entry => (
        decodeURIComponent(new URL(entry.name).pathname).endsWith('/presets/New.json')
    ));
    const builtInAssetEntries = builtInAssetUrls.map(
        url => appWindow.performance.getEntriesByName(url)[0]
    );
    assert(
        initialPresetEntry && builtInAssetEntries.every(
            entry => entry.startTime >= initialPresetEntry.responseEnd
        ),
        'built-in SVG assets load after the default preset finishes'
    );

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
    const paragraphStyleSelect = appDocument.getElementById('paragraphStyleSelect');
    const originalTextStyle = paragraphStyleSelect.value;
    paragraphStyleSelect.value = 'lunnenDisplay';
    paragraphStyleSelect.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    await waitFor(
        () => appDocument.getElementById('lunnenDisplayFeaturesSection').style.display === 'block',
        'Lunnen Display editor controls'
    );
    assert(
        appDocument.getElementById('lunnenDisplayFeaturesSection').style.display === 'block',
        'Lunnen Display style reveals its dedicated controls'
    );
    const lunnenWeightSlider = appDocument.getElementById('lunnenDisplayWeightSlider');
    lunnenWeightSlider.focus();
    lunnenWeightSlider.value = '275';
    lunnenWeightSlider.dispatchEvent(new appWindow.Event('input', { bubbles: true }));
    lunnenWeightSlider.blur();
    const saltControl = appDocument.getElementById('featureSalt');
    saltControl.checked = true;
    saltControl.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    await waitFor(() => {
        const text = appDocument.querySelector(`#text-group-${editedTextId} text`);
        return text?.getAttribute('font-weight') === '275' &&
            text.getAttribute('font-feature-settings')?.includes("'salt' 1");
    }, 'Lunnen Display weight and feature rendering');
    assert(
        appDocument.querySelector(`#text-group-${editedTextId} text`)?.getAttribute('font-weight') === '275' &&
            appDocument.querySelector(`#text-group-${editedTextId} text`)
                ?.getAttribute('font-feature-settings')?.includes("'salt' 1"),
        'Lunnen Display weight and OpenType features update the canvas'
    );
    paragraphStyleSelect.value = originalTextStyle;
    paragraphStyleSelect.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    appDocument.getElementById('canvasContainer').click();
    await waitFor(() => !appDocument.getElementById('paragraphPanel').classList.contains('active'), 'text editor closing');
    assert(appDocument.getElementById('paragraphPanel').style.display === 'none', 'outside click closes the text editor panel');

    const graphicsItem = appDocument.querySelector(
        '#elementsList [data-element-type="graphics"], #elementsList [data-element-type="icons"], #elementsList [data-element-type="claim"]'
    );
    graphicsItem.click();
    await waitFor(() => appDocument.getElementById('graphicsPanel').classList.contains('active'), 'graphics editor opening');
    assert(appDocument.getElementById('graphicsPanel').style.display === 'flex', 'graphics object opens its editor panel');
    const editedGraphicsId = graphicsItem.dataset.elementId;
    const graphicsSurfaceSelect = appDocument.getElementById('graphicsSurfaceSelect');
    graphicsSurfaceSelect.value = 'left';
    graphicsSurfaceSelect.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    await waitFor(
        () => appDocument.querySelector(
            `#surface-display-left #graphics-group-${editedGraphicsId}`
        ),
        'graphics surface transfer'
    );
    assert(
        Boolean(appDocument.querySelector(
            `#surface-display-left #graphics-group-${editedGraphicsId}`
        )),
        'graphics surface selector moves the object exactly to the selected side'
    );
    appDocument.getElementById('graphicsSizeModeHeight').click();
    await waitFor(
        () => appDocument.getElementById('graphicsHeightGroup').style.display === 'flex',
        'graphics height mode'
    );
    assert(
        appDocument.getElementById('graphicsWidthGroup').style.display === 'none' &&
            appDocument.getElementById('graphicsHeightGroup').style.display === 'flex',
        'graphics size mode switches the visible surface-aware control'
    );
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

    const rotatedCanvas = appDocument.getElementById('canvasContainer');
    const viewBoxBeforeWheel = appDocument.getElementById('gridSvg').viewBox.baseVal;
    const panBeforeWheel = { x: viewBoxBeforeWheel.x, y: viewBoxBeforeWheel.y };
    const dispatchRotatedWheel = deltaY => rotatedCanvas.dispatchEvent(new appWindow.WheelEvent('wheel', {
        deltaX: 0,
        deltaY,
        clientX: rotatedCanvas.getBoundingClientRect().left + 100,
        clientY: rotatedCanvas.getBoundingClientRect().top + 100,
        bubbles: true,
        cancelable: true
    }));
    dispatchRotatedWheel(40);
    await waitFor(
        () => appDocument.getElementById('gridSvg').viewBox.baseVal.x < panBeforeWheel.x,
        'rotated wheel pan'
    );
    const viewBoxAfterWheel = appDocument.getElementById('gridSvg').viewBox.baseVal;
    assert(
        viewBoxAfterWheel.x < panBeforeWheel.x &&
            Math.abs(viewBoxAfterWheel.y - panBeforeWheel.y) < 1e-6,
        'vertical wheel pan follows the visible canvas axis after rotation'
    );
    dispatchRotatedWheel(-40);

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

    const hexColorInput = appDocument.getElementById('hexColorInput');
    const colorBeforeInvalidInput = hexColorInput.value;
    hexColorInput.focus();
    hexColorInput.value = 'invalid';
    hexColorInput.dispatchEvent(new appWindow.Event('input', { bubbles: true }));
    hexColorInput.blur();
    await waitFor(
        () => hexColorInput.value === colorBeforeInvalidInput,
        'invalid color restoration'
    );
    assert(
        hexColorInput.value === colorBeforeInvalidInput,
        'Invalid HEX input restores the current document color'
    );

    appDocument.getElementById('lunnenBlue').click();
    await waitFor(() => hexColorInput.value === '#2353DB', 'Lunnen Blue color preset');
    assert(hexColorInput.value === '#2353DB', 'Lunnen Blue updates the shared color state');

    const hueSlider = appDocument.getElementById('hueSlider');
    const colorBeforeHsb = hexColorInput.value;
    hueSlider.value = (Number(hueSlider.value) + 20) % 360;
    hueSlider.dispatchEvent(new appWindow.Event('input', { bubbles: true }));
    await waitFor(() => hexColorInput.value !== colorBeforeHsb, 'HSB color update');
    assert(hexColorInput.value !== colorBeforeHsb, 'HSB sliders update the document color');

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

    presetToggle.click();
    appDocument.querySelector(
        '#presetDropdownMenu .preset-dropdown-item[data-file="E-ink.json"]'
    ).click();
    await waitFor(() => presetToggle.textContent.includes('E-ink'), 'updated E-ink preset loading');
    await waitFor(() => Number(widthInput.value) === 148.5, 'updated E-ink dimensions');
    assert(Number(widthInput.value) === 148.5, 'Updated E-ink preset applies its approved dimensions');
    assert(
        Math.abs(Number(moduleInput.value) - 2.6743) < 0.0001,
        'Updated E-ink preset applies its approved module'
    );
    assert(
        appDocument.getElementById('surfaceRotationSelect').value === '270',
        'Updated E-ink preset keeps the reverse left-side orientation'
    );
    assert(
        Number(appDocument.getElementById('captionSizeValue').value) === 0.7 &&
            Number(appDocument.getElementById('captionLineHeightValue').value) === 1.25,
        'Updated E-ink preset applies its approved Caption size and line height'
    );
    assert(
        appDocument.getElementById('captionStyleDropdown').value === '500' &&
            Number(appDocument.getElementById('captionTrackingValue').value) === 0 &&
            !appDocument.getElementById('useXHeightCaption').checked,
        'Updated E-ink preset applies its approved Caption weight and metrics'
    );
    assert(applicationErrors.length === 0, 'application emits no uncaught browser errors');

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
