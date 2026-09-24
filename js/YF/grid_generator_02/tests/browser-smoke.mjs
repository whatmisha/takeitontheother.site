import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';
import { DraftStore } from '../src/persistence/DraftStore.js';

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
    const draftStore = new DraftStore({ databaseName: 'upgrade-pizza-boxer-02-browser-smoke-v1' });
    await draftStore.clear();
    draftStore.dispose();
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
                layerIndex: 1,
                fontWeight: 275,
                fontFeatures: { salt: true }
            }],
            graphicsBlocks: [{
                id: 'icons',
                isBuiltIn: true,
                layerIndex: 0,
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
            presetRoundTrip.graphicsBlocks[0].lockPosition === false &&
            presetRoundTrip.graphicsBlocks[0].layerIndex === 0 &&
            presetRoundTrip.textBlocks[0].layerIndex === 1,
        'Built-in graphics sizing, constraints and layer order survive JSON round-trip'
    );

    const appDocument = await loadApplication();
    const appWindow = appFrame.contentWindow;
    const application = appWindow[Symbol.for('lunnen.grid-generator-02.application')];
    assert(
        appDocument.documentElement.dataset.applicationShell === 'ready',
        'modular HTML shell assembles before application startup'
    );
    assert(
        application?.getPerformanceMetrics().render.count > 0,
        'render performance metrics record application startup'
    );
    const panelGroups = [
        ['leftSettingsStack', ['controlsPanel', 'gridPanel']],
        ['rightSettingsStack', ['surfacePanel', 'elementsNavigator']]
    ];
    for (const [stackId, panelIds] of panelGroups) {
        const stack = appDocument.getElementById(stackId);
        assert([...stack.children].map(panel => panel.id).join(',') === panelIds.join(','), `${stackId} contains the requested pair in order`);
        for (const id of panelIds) {
            const panel = appDocument.getElementById(id);
            assert(panel.classList.contains('panel-collapsed') === (id !== 'surfacePanel'), `${id} starts in the requested collapsed state`);
            const icon = panel.querySelector('.collapse-icon');
            icon.click();
            icon.click();
            assert(!panel.style.top && !panel.style.bottom, `${id} stays in its stack after collapsing`);
            const header = panel.querySelector('.panel-header');
            const rect = header.getBoundingClientRect();
            const original = stack.getBoundingClientRect();
            header.dispatchEvent(new appWindow.MouseEvent('mousedown', { button: 0, clientX: rect.x + 30, clientY: rect.y + 10, bubbles: true }));
            appDocument.dispatchEvent(new appWindow.MouseEvent('mousemove', { clientX: rect.x + 20, clientY: rect.y + 20, bubbles: true }));
            appDocument.dispatchEvent(new appWindow.MouseEvent('mouseup', { bubbles: true }));
            assert(Math.abs(stack.getBoundingClientRect().x - original.x + 10) < 1, `${id} header moves the whole panel pair`);
            application.panelManager.resetPosition(stackId);
        }
    }
    assert(!appDocument.querySelector('[data-selected-surface], #surfaceSettingsTabs input:checked'), 'no side is selected or outlined at startup');
    const leftSideRow = appDocument.querySelector('[data-surface-row="left"]');
    leftSideRow.dispatchEvent(new appWindow.MouseEvent('mouseenter'));
    assert(!appDocument.querySelector('[data-selected-surface]'), 'hovering a side does not draw a selection outline');
    const selectionSnapshot = JSON.stringify(application.getStateSnapshot());
    appDocument.getElementById('surfaceSettingsLeft').click();
    assert(appDocument.querySelector('[data-selected-surface="left"]'), 'an explicit list click outlines that side');
    const selectionCanvas = appDocument.getElementById('canvasContainer');
    const selectionSvg = appDocument.getElementById('gridSvg');
    const clickCanvas = (target, point, offset = 0) => {
        target.dispatchEvent(new appWindow.PointerEvent('pointerdown', { button: 0, clientX: point.x, clientY: point.y, bubbles: true }));
        target.dispatchEvent(new appWindow.MouseEvent('click', { button: 0, clientX: point.x + offset, clientY: point.y, bubbles: true }));
    };
    const emptyPoint = new appWindow.DOMPoint(-1000, -1000).matrixTransform(selectionSvg.getScreenCTM());
    clickCanvas(selectionSvg, emptyPoint, 20);
    assert(appDocument.querySelector('[data-selected-surface="left"]'), 'dragging across empty canvas does not clear the selection');
    clickCanvas(selectionSvg, emptyPoint);
    assert(!appDocument.querySelector('[data-selected-surface], #surfaceSettingsTabs input:checked') && application.packagingPreview.selectedFace === null, 'clicking outside the net clears both the outline and side selection');
    const lidRect = application.surfaceManager.getPhysicalRect('front', application.currentSurfaceLayout);
    const lidPoint = new appWindow.DOMPoint(lidRect.x + lidRect.width / 2, lidRect.y + lidRect.height / 2).matrixTransform(selectionSvg.getScreenCTM());
    clickCanvas(selectionSvg, lidPoint);
    assert(appDocument.querySelector('[data-selected-surface="front"]'), 'clicking a face on the net explicitly selects it');
    appDocument.getElementById('surfaceMainGridButton').click();
    assert(!appDocument.getElementById('gridPanel').classList.contains('panel-collapsed') && appDocument.querySelector('#gridPanel .collapse-icon').getAttribute('aria-expanded') === 'true' && !appDocument.getElementById('surfacePanel').classList.contains('panel-collapsed'), 'Edit grid opens the left grid with matching disclosure state without collapsing Sides');
    appDocument.querySelector('#gridPanel .collapse-icon').click();
    clickCanvas(selectionCanvas, emptyPoint);
    application.updateGrid();
    assert(!appDocument.querySelector('[data-selected-surface], #surfaceSettingsTabs input:checked'), 'empty container clicks and subsequent renders keep selection cleared');
    assert(JSON.stringify(application.getStateSnapshot()) === selectionSnapshot, 'face selection and deselection do not alter the document');

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
    const builtInAssetUrls = [
        'graphics/icons.svg',
        'graphics/yf_claim.svg',
        'graphics/yf_claim_2026.svg'
    ].map(
        path => new URL(path, appWindow.location.href).href
    );

    await waitFor(
        () => builtInAssetUrls.every(url => appWindow.performance.getEntriesByName(url).length > 0),
        'built-in graphics loading'
    );
    assert(
        builtInAssetUrls.every(url => appWindow.performance.getEntriesByName(url).length > 0),
        'all built-in SVG assets load during bootstrap'
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
    const claim2026 = application.objectDocument.getGraphicsBlock('claim2026');
    assert(
        claim2026?.x === 4 &&
            claim2026.row === 11 &&
            claim2026.baselineOffset === 4 &&
            claim2026.heightInModules === 3 &&
            claim2026.originalWidth === 202.0335404 &&
            claim2026.originalHeight === 32.7559817 &&
            claim2026.svgContent.length > 0,
        'New loads Claim 2026 in column 4 at artboard height 3'
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
    assert(
        Array.from(appDocument.querySelectorAll('#elementsList .element-item')).map(
            item => item.dataset.elementId
        ).join('|') === application.objectDocument.getLayerEntries({ frontToBack: true }).map(
            entry => entry.block.id
        ).join('|'),
        'Objects lists the shared text/graphics stack from front to back'
    );

    const forwardButton = appDocument.querySelector(
        '#elementsList .element-item [title="Bring Forward"]:not(:disabled)'
    );
    const forwardItem = forwardButton?.closest('.element-item');
    const forwardBlock = forwardItem && application.objectDocument.getBlock(
        forwardItem.dataset.elementType,
        forwardItem.dataset.elementId
    );
    const forwardLayerBefore = forwardBlock?.layerIndex;
    forwardButton?.click();
    await waitFor(
        () => forwardBlock?.layerIndex === forwardLayerBefore + 1,
        'object layer button'
    );
    assert(
        forwardBlock?.layerIndex === forwardLayerBefore + 1,
        'Bring Forward reorders the shared text/graphics stack'
    );

    const dragItems = Array.from(
        appDocument.querySelectorAll('#elementsList .element-item-wrapper[draggable="true"]')
    );
    const draggedLayerItem = dragItems.at(-1);
    const layerDropTarget = dragItems[0];
    const draggedLayerId = draggedLayerItem.querySelector('.element-item').dataset.elementId;
    const layerTransfer = new appWindow.DataTransfer();
    draggedLayerItem.dispatchEvent(new appWindow.DragEvent('dragstart', {
        dataTransfer: layerTransfer,
        bubbles: true,
        cancelable: true
    }));
    const dropRect = layerDropTarget.getBoundingClientRect();
    layerDropTarget.dispatchEvent(new appWindow.DragEvent('dragover', {
        dataTransfer: layerTransfer,
        clientY: dropRect.top + 1,
        bubbles: true,
        cancelable: true
    }));
    layerDropTarget.dispatchEvent(new appWindow.DragEvent('drop', {
        dataTransfer: layerTransfer,
        clientY: dropRect.top + 1,
        bubbles: true,
        cancelable: true
    }));
    await waitFor(
        () => appDocument.querySelector('#elementsList .element-item')?.dataset.elementId === draggedLayerId,
        'object layer drag reorder'
    );
    assert(
        application.objectDocument.getLayerEntries({ frontToBack: true })[0].block.id === draggedLayerId,
        'Dragging an Objects row reorders the shared layer stack'
    );

    const editableTextBlock = application.objectDocument.textBlocks.find(block => (
        (block.surface || 'front') === 'front' && block.styleRef !== 'lunnenDisplay'
    ));
    const textItem = appDocument.querySelector(
        `#elementsList [data-element-id="${editableTextBlock.id}"]`
    );
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
    assert(surfaceHeader.firstElementChild.textContent.includes('Sides'), 'panel title identifies Sides and its count');
    assert(!surfacePanel.classList.contains('panel-collapsed'), 'Sides starts expanded');
    assert(surfaceCollapse.getAttribute('aria-expanded') === 'true', 'expanded Sides exposes correct ARIA state');
    surfaceCollapse.click();
    assert(surfacePanel.classList.contains('panel-collapsed'), 'Sides can be collapsed');
    surfaceCollapse.click();
    await waitFor(() => !surfacePanel.classList.contains('panel-collapsed'), 'Sides expansion');
    assert(surfaceCollapse.getAttribute('aria-expanded') === 'true', 'Sides expands through its header control');
    appDocument.getElementById('surfaceSettingsLeft').click();

    const ownGridToggle = appDocument.getElementById('surfaceOwnGridToggle');
    ownGridToggle.click();
    await waitFor(() => ownGridToggle.checked, 'Own Grid toggle');
    assert(!appDocument.getElementById('surfaceOwnGridControls').hidden, 'Own Grid reveals independent controls');

    const gridContent = appDocument.querySelector('#gridPanel > .panel-content');
    assert(!gridContent.contains(appDocument.getElementById('surfaceOwnGridControls')), 'Own Grid controls stay in the selected side panel');

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

    const shortcutSourceItem = appDocument.querySelector(
        `#elementsList [data-element-id="${duplicatedTextId}"]`
    );
    shortcutSourceItem.click();
    await waitFor(
        () => appDocument.getElementById('paragraphPanel').classList.contains('active'),
        'copy shortcut source selection'
    );
    const shortcutSource = application.objectDocument.getTextBlock(duplicatedTextId);
    appDocument.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: 'c',
        metaKey: true,
        bubbles: true,
        cancelable: true
    }));
    assert(
        application.objectNavigatorController.clipboardEntry?.block.id === duplicatedTextId,
        'Cmd/Ctrl+C copies the selected object'
    );

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

    const targetPresetTextIds = new Set(
        application.objectDocument.textBlocks.map(block => block.id)
    );
    const targetPresetTextCount = application.objectDocument.textBlocks.length;
    appDocument.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: 'v',
        metaKey: true,
        bubbles: true,
        cancelable: true
    }));
    await waitFor(
        () => application.objectDocument.textBlocks.length === targetPresetTextCount + 1,
        'cross-preset paste shortcut'
    );
    const crossPresetPaste = application.objectDocument.textBlocks.find(
        block => !targetPresetTextIds.has(block.id)
    );
    assert(
        crossPresetPaste?.id !== shortcutSource.id &&
            crossPresetPaste?.content === shortcutSource.content &&
            crossPresetPaste?.styleRef === shortcutSource.styleRef &&
            crossPresetPaste?.visible === true,
        'Cmd/Ctrl+V pastes an independent object into another preset'
    );
    appDocument.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true
    }));
    await waitFor(
        () => application.objectDocument.textBlocks.length === targetPresetTextCount,
        'cross-preset paste undo'
    );
    assert(
        !application.objectDocument.getTextBlock(crossPresetPaste.id),
        'Undo removes the pasted object from the target preset'
    );
    appDocument.dispatchEvent(new appWindow.KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
    }));
    await waitFor(
        () => application.objectDocument.textBlocks.length === targetPresetTextCount + 1,
        'cross-preset paste redo'
    );
    assert(
        application.objectDocument.getTextBlock(crossPresetPaste.id)?.content === shortcutSource.content,
        'Redo restores the pasted object in the target preset'
    );

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

    const exactSideSettings = {
        frontWidth: 500,
        frontHeight: 500,
        thickness: 50,
        gridModule: 5,
        margins: 2.5,
        columnCount: 12,
        rowCount: 12,
        rowHeight: 7,
        showSidePanels: true,
        showObjects: true,
        showColumns: true,
        showRows: true,
        showBaseline: true
    };
    Object.entries(exactSideSettings).forEach(([key, value]) => {
        application.settingsModule.set(key, value, true);
    });
    application.surfaceManager.initialize('+ New');
    const exactSideContext = application.getSurfaceGridContext('left');
    const exactStyle = application.textStyleResolver.getStyleSettings('text');
    let exactContent = 'Ширина';
    while (
        application.textLayout.measureTextWidth(
            exactContent,
            exactStyle.fontSize,
            1,
            exactStyle.tracking
        ) < 390
    ) {
        exactContent += ' колонок';
    }
    const exactContentWidth = application.textLayout.measureTextWidth(
        exactContent,
        exactStyle.fontSize,
        1,
        exactStyle.tracking
    );
    const exactSideBlock = {
        id: 'exact-side-width',
        content: exactContent,
        styleRef: 'text',
        x: 1,
        row: 0,
        baselineOffset: 0,
        width: 12,
        alignment: 'left',
        textAlign: 'left',
        surface: 'left',
        visible: true,
        alignmentMode: 'baseline',
        lockPosition: true
    };
    application.objectDocument.replaceTextBlocks([exactSideBlock]);
    application.objectDocument.replaceGraphicsBlocks([]);
    const exactSideSvg = await application.exportDocumentBuilder.build(false);
    const exactSideLines = exactSideSvg.querySelectorAll(
        '#surface-export-left #text-group-exact-side-width text'
    );
    assert(
        exactSideContext.columnCount === 12 &&
            application.textLayout.calculateBlockWidth(exactSideBlock, exactSideContext) === 475 &&
            exactContentWidth > 355 &&
            exactContentWidth < 475 &&
            exactSideLines.length === 1,
        'Left-side export renders a 12-column paragraph at the full 475 mm width'
    );

    application.markAsChanged();
    await application.draftRecoveryController.saveNow();
    const savedDraft = await application.draftRecoveryController.store.load();
    assert(
        savedDraft?.version === 1 &&
            savedDraft.snapshot?.document?.textBlocks?.[0]?.id === 'exact-side-width',
        'edited document autosaves to the isolated IndexedDB draft'
    );
    application.draftRecoveryController.present(savedDraft);
    assert(
        appDocument.querySelector('.app-draft-recovery [type="button"].app-draft-restore') &&
            appDocument.querySelector('.app-draft-recovery [type="button"].app-draft-discard'),
        'draft recovery offers explicit Restore and Discard actions'
    );
    const draftRect = appDocument.querySelector('.app-draft-recovery').getBoundingClientRect();
    const exportControlsRect = appDocument.querySelector('.bottom-buttons').getBoundingClientRect();
    const draftExportGap = exportControlsRect.top - draftRect.bottom;
    assert(
        Math.abs(draftRect.left + draftRect.width / 2 - appWindow.innerWidth / 2) < 1 &&
            draftExportGap >= 4 &&
            draftExportGap <= 32,
        'Unsaved draft is centered directly above the export controls'
    );
    appDocument.querySelector('.app-draft-discard').click();
    await waitFor(
        () => !appDocument.querySelector('.app-draft-recovery'),
        'draft discard'
    );
    assert(
        await application.draftRecoveryController.store.load() === null,
        'Discard removes the recovery draft without changing preset JSON'
    );
    await application.presetManager.selectPreset('New.json', '+ New');
    const preview = application.packagingPreview;
    const designBeforePreview = JSON.stringify(application.getStateSnapshot());
    appDocument.querySelector('[data-workspace-mode="3d"]').click();
    await waitFor(() => preview.scene?.texture && !preview.rendering, '3D scene and artwork texture', 15000);
    assert(appDocument.body.dataset.workspaceView === '3d' && appDocument.querySelector('#previewViewport canvas'), '3D opens in the existing workspace');
    assert(preview.scene.panels.length === 5, 'default preset folds into a lid with five printed faces');
    assert(preview.scene.texture.image.width === 2048, 'artwork is rasterized locally at bounded preview resolution');
    assert(appDocument.getElementById('previewStatus').textContent === '', 'font embedding and artwork rasterization complete without errors');
    const cameraBeforeChange = preview.scene.camera.position.toArray().join(',');
    const foldInput = appDocument.getElementById('previewFold');
    foldInput.value = '0';
    foldInput.dispatchEvent(new appWindow.Event('input', { bubbles: true }));
    assert(preview.scene.panels.every(panel => panel.hinge.rotation[panel.spec.axis] === 0), 'Unfold lays all five panels in one plane');
    foldInput.value = '50';
    foldInput.dispatchEvent(new appWindow.Event('input', { bubbles: true }));
    assert(Math.abs(preview.scene.panels.find(panel => panel.spec.id === 'left').hinge.rotation.y + Math.PI / 4) < 1e-9, 'intermediate fold uses the correct hinge angle');
    assert(JSON.stringify(application.getStateSnapshot()) === designBeforePreview, 'camera and folding leave the editable document unchanged');
    const firstTexture = preview.scene.texture;
    application.settingsModule.set('boxColor', '#224466', true);
    application.updateGrid();
    await waitFor(() => preview.scene.texture !== firstTexture && !preview.rendering, 'live artwork update');
    const pixel = preview.scene.texture.image.getContext('2d').getImageData(0, 0, 1, 1).data;
    assert(pixel[0] === 34 && pixel[1] === 68 && pixel[2] === 102, '3D texture follows the actual design background color');
    assert(preview.scene.camera.position.toArray().join(',') === cameraBeforeChange, 'editing artwork preserves the camera position');
    application.settingsModule.set('frontWidth', 420, true);
    application.updateGrid();
    assert(preview.scene.panels.find(panel => panel.spec.id === 'front').spec.width === 420, 'dimension edits update the 3D geometry');
    application.surfaceManager.update('left', { visible: false });
    application.updateGrid();
    assert(!preview.scene.panels.some(panel => panel.spec.id === 'left'), 'hidden side is absent from the model');
    appDocument.querySelector('[data-camera-view="right"]').click();
    assert(preview.selectedFace === 'right' && !appDocument.getElementById('previewEditFace').hidden, 'face navigation selects an editable surface');
    appDocument.getElementById('previewEditFace').click();
    assert(appDocument.body.dataset.workspaceView === '2d' && appDocument.getElementById('surfaceSettingsRight').checked, 'Edit in 2D returns to the selected side');
    const scene = preview.scene;
    await preview.setMode('3d');
    assert(preview.scene === scene && preview.fold === 0.5, 'view changes reuse the scene and preserve folding');
    // Exercise complete construction workflows through the same controls used by designers.
    application.surfaceManager.setAllSideVisibility(true);
    const constructionSelect = appDocument.getElementById('constructionTypeSelect');
    const setConstruction = type => {
        constructionSelect.value = type;
        constructionSelect.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    };
    preview.setFold(1);
    setConstruction('box');
    assert(scene.panels.length === 6 && appDocument.querySelectorAll('#gridSvg [data-panel-outline]').length === 6, 'six-panel construction has the same six faces in 2D and 3D');
    setConstruction('tuck-box');
    assert(scene.panels.length === 7 && appDocument.querySelectorAll('#gridSvg [data-panel-outline]').length === 7, 'tuck-box construction has seven matching faces');
    const baseMesh = scene.panels.find(panel => panel.spec.id === 'base').exterior;
    scene.model.updateMatrixWorld(true);
    const baseWorld = baseMesh.matrixWorld.elements.slice();
    const openInput = appDocument.getElementById('previewOpen');
    openInput.value = '80';
    openInput.dispatchEvent(new appWindow.Event('input', { bubbles: true }));
    scene.model.updateMatrixWorld(true);
    assert(baseMesh.matrixWorld.elements.every((value, i) => Math.abs(value - baseWorld[i]) < 1e-8), 'opening the lid leaves the assembled body in place');
    assert(scene.opening === 0.8, 'lid opening is controlled independently from the net folding');
    const flapInput = appDocument.getElementById('flapDepthInput');
    flapInput.value = '30';
    flapInput.dispatchEvent(new appWindow.Event('change', { bubbles: true }));
    assert(scene.panels.find(panel => panel.spec.id === 'flap').spec.height === 30, 'flap depth changes both construction and preview');
    const baseBlock = {
        ...application.objectDocument.textBlocks[0], id: 'construction-base-text',
        content: 'Основание\nВторая строка', surface: 'base', x: 1, row: 1,
        baselineOffset: 0, width: 4, visible: true
    };
    application.objectDocument.textBlocks.push(baseBlock);
    application.updateGrid();
    assert(appDocument.querySelector('#surface-display-base #text-group-construction-base-text'), 'the new base supports editable text using its own surface geometry');
    const physical = application.settingsModule.getAll();
    const exported = await application.exportDocumentBuilder.build(false);
    assert(exported.querySelector('#surface-export-base #text-group-construction-base-text'), 'base artwork is included in the vector export');
    assert(Number.parseFloat(exported.getAttribute('height')) === 2 * physical.frontHeight + 2 * physical.thickness + 30, 'export artboard encloses the complete seven-panel net in millimeters');
    const document2 = presetFormat.organize({ settings: physical, textBlocks: application.objectDocument.textBlocks, graphicsBlocks: application.objectDocument.graphicsBlocks });
    const restored2 = presetFormat.normalize(JSON.parse(JSON.stringify(document2)));
    assert(document2.version === '2.0' && document2.dimensions.depth === physical.thickness && restored2.settings.constructionType === 'tuck-box', 'document 2.0 records construction and box depth explicitly');
    assert(restored2.textBlocks.find(block => block.id === baseBlock.id).content === baseBlock.content, 'new-face text survives JSON export/import with paragraph breaks');
    setConstruction('lid');
    assert(!appDocument.querySelector('#surface-display-base') && scene.panels.length === 5, 'switching back to a lid hides unused faces in both views');
    assert(application.objectDocument.textBlocks.some(block => block.id === baseBlock.id), 'switching construction preserves artwork on inactive faces');
    application.undo();
    assert(constructionSelect.value === 'tuck-box' && scene.panels.length === 7, 'Undo restores construction, controls and 3D together');
    application.redo();
    assert(constructionSelect.value === 'lid' && scene.panels.length === 5, 'Redo reapplies construction without losing extra-face artwork');
    setConstruction('tuck-box');
    appDocument.querySelector('[data-camera-view="base"]').click();
    appDocument.getElementById('previewEditFace').click();
    assert(appDocument.getElementById('surfaceSettingsBase').checked && appDocument.body.dataset.workspaceView === '2d', 'the new Base face is navigable from 3D to its 2D controls');
    const geometry = application.surfaceManager.getGeometry('base', application.currentSurfaceLayout);
    assert(Math.abs(geometry.localWidth / application.currentSurfaceLayout.scale - physical.frontWidth) < 1e-8, 'scaled 2D geometry retains the physical base width');
    await application.draftRecoveryController.saveNow();
    const constructionDraft = await application.draftRecoveryController.store.load();
    assert(constructionDraft.snapshot.settings.constructionType === 'tuck-box' && constructionDraft.snapshot.document.textBlocks.some(block => block.id === baseBlock.id), 'autosave includes construction and new-face artwork');
    // Additions use real panel/net controls and the same undo history as artwork.
    setConstruction('lid');
    application.surfaceManager.setAllSideVisibility(true);
    application.updateGrid();
    appDocument.getElementById('surfaceAddToggle').click();
    assert(!appDocument.getElementById('surfaceAddChoices').hidden, 'Add side exposes the next construction face');
    appDocument.querySelector('[data-add-surface="base"]').click();
    assert(constructionSelect.value === 'box' && !appDocument.querySelector('[data-selected-surface]'), 'adding Base from the panel creates the sixth face without selecting it');
    application.undo();
    assert(constructionSelect.value === 'lid' && appDocument.querySelector('[data-net-add="base"]'), 'one Undo removes the added Base and restores its net handle');
    application.redo();
    assert(constructionSelect.value === 'box', 'Redo restores the added face');
    appDocument.querySelector('[data-net-add="flap"]').dispatchEvent(new appWindow.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert(constructionSelect.value === 'tuck-box' && !appDocument.querySelector('[data-selected-surface]'), 'keyboard activation of the net handle adds the flap without selecting it');
    const beforeSelection = JSON.stringify(application.getStateSnapshot());
    appDocument.getElementById('surfaceSettingsBase').click();
    assert(JSON.stringify(application.getStateSnapshot()) === beforeSelection, 'face selection does not change the design document');
    assert(appDocument.querySelector('[data-selected-surface="base"]'), 'panel selection highlights the same face on the net');
    appDocument.querySelector('[data-surface-visibility="base"]').click();
    assert(!application.surfaceManager.isVisible('base') && appDocument.querySelector('[data-net-add="base"]'), 'hiding a face exposes a restore handle on the net');
    appDocument.querySelector('[data-net-add="base"]').dispatchEvent(new appWindow.MouseEvent('click', { bubbles: true }));
    assert(application.surfaceManager.isVisible('base') && application.objectDocument.textBlocks.find(block => block.id === baseBlock.id).content === baseBlock.content, 'restoring a face from the net retains its artwork');
    const leftRect = appDocument.querySelector('[data-panel-outline="left"]');
    const leftBox = application.surfaceManager.getPhysicalRect('left', application.currentSurfaceLayout);
    const leftPoint = new appWindow.DOMPoint(leftBox.x + leftBox.width / 2, leftBox.y + leftBox.height / 2).matrixTransform(appDocument.getElementById('gridSvg').getScreenCTM());
    const clickPoint = { bubbles: true, button: 0, clientX: leftPoint.x, clientY: leftPoint.y };
    leftRect.dispatchEvent(new appWindow.PointerEvent('pointerdown', clickPoint));
    leftRect.dispatchEvent(new appWindow.MouseEvent('click', clickPoint));
    assert(appDocument.getElementById('surfaceSettingsLeft').checked, 'clicking a net face selects its controls even on a rotated canvas');
    await preview.setMode('3d');
    appDocument.getElementById('surfaceSettingsRight').click();
    assert(preview.selectedFace === 'right' && scene.selected === 'right', 'panel selection highlights the corresponding 3D face');
    appDocument.querySelector('[data-camera-view="base"]').click();
    assert(appDocument.getElementById('surfaceSettingsBase').checked, '3D selection follows back into the Sides panel');
    const previewCanvas = appDocument.querySelector('#previewViewport canvas');
    const previewRect = previewCanvas.getBoundingClientRect();
    scene.pointerStart = [previewRect.x + 1, previewRect.y + 1];
    scene.pick({ button: 0, clientX: previewRect.x + 1, clientY: previewRect.y + 1 });
    assert(application.packagingPreview.selectedFace === null && !appDocument.querySelector('#surfaceSettingsTabs input:checked, [data-selected-surface]'), 'clicking the 3D background clears selection in 3D, Sides and the net');

    appDocument.getElementById('surfaceSettingsBase').click();
    const createdOnBase = application.objectNavigatorController.addText({ content: 'Added to selected side' });
    assert(createdOnBase.surface === 'base', 'new text starts on the selected side');
    application.undo();
    assert(!application.objectDocument.getTextBlock(createdOnBase.id), 'Undo removes the newly added side text');
    appDocument.querySelector('[data-surface-visibility="base"]').click();
    appDocument.getElementById('surfaceSettingsBase').click();
    const addedGraphic = application.objectNavigatorController.addGraphics({ name: 'Side test', svgContent: '<rect width="10" height="10"/>', originalWidth: 10, originalHeight: 10 });
    assert(addedGraphic.surface === 'base' && application.surfaceManager.isVisible('base'), 'new graphics restores the selected hidden side in the same action');
    application.undo();
    assert(!application.surfaceManager.isVisible('base') && !application.objectDocument.getGraphicsBlock(addedGraphic.id), 'Undo restores both hidden-side state and object list');
    const cleanExport = await application.exportDocumentBuilder.build(false);
    assert(!cleanExport.querySelector('[data-surface-overlay], [data-net-add], [data-selected-surface]'), 'editor handles and selection outlines never enter the exported artwork');
    await application.draftRecoveryController.clearDraft();
    application.hasUnsavedChanges = false;
    application.dispose();
    assert(scene.disposed && !appDocument.querySelector('#previewViewport canvas'), 'application disposal releases its 3D canvas and resources');
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
