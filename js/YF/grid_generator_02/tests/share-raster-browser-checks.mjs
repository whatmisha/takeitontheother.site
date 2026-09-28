export async function checkShareAndRaster({ application: app, appDocument: doc, appWindow: win, assert, waitFor, presetFormat }) {
    const change = (id, value) => {
        const node = doc.getElementById(id); node.value = String(value);
        node.dispatchEvent(new win.Event('change', { bubbles: true }));
    };
    const fileFromCanvas = async (color, name) => {
        const canvas = doc.createElement('canvas'); canvas.width = 1600; canvas.height = 800;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 1600, 800);
        ctx.fillStyle = '#00ee44'; ctx.fillRect(0, 0, 400, 800);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        return new win.File([blob], name, { type: 'image/png' });
    };
    await app.packagingPreview.setMode('2d');
    doc.getElementById('surfaceSettingsFront').click();
    change('surfaceRotationSelect', 90);
    app.objectEditorPanelController.openNewGraphicsPanel();
    const file = await fileFromCanvas('#ff0000', 'Photo test.png');
    const transfer = new win.DataTransfer(); transfer.items.add(file);
    doc.getElementById('svgFileInput').files = transfer.files;
    doc.getElementById('svgFileInput').dispatchEvent(new win.Event('change', { bubbles: true }));
    await waitFor(() => app.objectDocument.graphicsBlocks.some(b => b.name === file.name), 'raster upload through shared FileIntake');
    let block = app.objectDocument.graphicsBlocks.find(b => b.name === file.name);
    const id = block.id;
    assert(block.raster.width === 1024 && block.raster.height === 512 && block.svgContent === '', 'raster upload stores a bounded color preview independently of SVG');
    assert(doc.querySelector(`#graphics-group-${id} image`)?.getAttribute('href') === block.raster.dataUrl, 'raster appears on the rotated body wrap');
    app.panelManager.bringToFront('rightSettingsStack');
    app.objectEditorPanelController.openGraphicsPanel(id);
    assert(Number(doc.getElementById('graphicsPanel').style.zIndex) > Number(doc.getElementById('rightSettingsStack').style.zIndex), 'image editor opens above the Sides and Objects stack');
    assert(!doc.getElementById('rasterControls').hidden && !doc.getElementById('fileUploadArea').contains(doc.getElementById('rasterControls')), 'image controls are outside the upload trigger');
    change('rasterFrameSelect', '1'); change('rasterFitSelect', 'contain');
    assert(block.originalWidth === block.originalHeight && doc.querySelector(`#graphics-group-${id} image`).getAttribute('preserveAspectRatio') === 'xMidYMid meet', 'square frame fits the entire image without stretching');
    change('rasterFitSelect', 'cover');
    assert(doc.querySelector(`#graphics-group-${id} image`).getAttribute('preserveAspectRatio') === 'xMidYMid slice', 'Fill frame crops the image at its original proportions');
    const firstData = block.raster.dataUrl;
    await app.graphicsAssetController.handleFile(await fileFromCanvas('#0000ff', 'Replacement.png'));
    app.undo(); block = app.objectDocument.getGraphicsBlock(id);
    assert(block.raster.dataUrl === firstData && block.originalWidth === block.originalHeight, 'Undo restores the original image with its frame');
    app.redo(); block = app.objectDocument.getGraphicsBlock(id);
    assert(block.name === 'Replacement.png' && block.raster.dataUrl !== firstData, 'Redo restores the replacement image');
    const exportSvg = await app.exportDocumentBuilder.build(false);
    assert(!exportSvg.querySelector('image') && exportSvg.querySelector(`[data-image-frame="${id}"]`), 'SVG/PDF source replaces raster pixels with an editable vector frame');
    const roundTrip = presetFormat.normalize(presetFormat.organize({ settings: app.settingsModule.getAll(), textBlocks: app.objectDocument.textBlocks, graphicsBlocks: app.objectDocument.graphicsBlocks }));
    assert(roundTrip.graphicsBlocks.find(b => b.id === id).raster.dataUrl === block.raster.dataUrl, 'JSON project retains the low-resolution image');
    const previousTexture = app.packagingPreview.scene.texture;
    await app.packagingPreview.setMode('3d');
    await waitFor(() => app.packagingPreview.scene.texture !== previousTexture && !app.packagingPreview.rendering, 'raster on 3D tube');
    const pixels = app.packagingPreview.scene.texture.image.getContext('2d').getImageData(0, 0, app.packagingPreview.scene.texture.image.width, app.packagingPreview.scene.texture.image.height).data;
    let colored = false;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i+1] < 40 && pixels[i+2] > 180) { colored = true; break; }
    assert(colored, '3D atlas retains the actual image colors');
    const libraryAsset = await app.graphicsAssetController.load('graphics/icons.svg');
    const library = app.objectNavigatorController.addGraphics({ name: 'Bundled markings', svgContent: libraryAsset.content, originalWidth: libraryAsset.width, originalHeight: libraryAsset.height });
    app.dom.convertToOutlinesCheckbox.checked = true;
    const url = await app.presetShareController.buildUrl();
    const codec = await app.presetShareController.getCodec();
    const sourceIcon = app.objectDocument.getGraphicsBlock(library.id);
    if (sourceIcon?.svgContent && !codec.byContent.has(sourceIcon.svgContent)) {
        const candidate = [...codec.catalog].map(([key, value]) => {
            let prefix = 0; while (prefix < value.length && value[prefix] === sourceIcon.svgContent[prefix]) prefix++;
            return { key, prefix, length: value.length, sample: value.slice(Math.max(0, prefix-20), prefix+100) };
        }).sort((a, b) => b.prefix - a.prefix)[0];
        throw new Error(`Catalog mismatch: source ${sourceIcon.svgContent.length}, ${JSON.stringify(candidate)}; source sample ${sourceIcon.svgContent.slice(Math.max(0, candidate.prefix-20), candidate.prefix+100)}`);
    }
    const decoded = await codec.decode(new URL(url).hash.slice(3));
    const photo = decoded.data.graphicsBlocks.find(b => b.id === id);
    assert(photo.missingAsset && photo.raster.dataUrl === '' && photo.originalWidth === photo.originalHeight, 'share link excludes image bytes and retains crop, name and frame');
    assert(decoded.outlineFonts && decoded.data.settings.surfaceSettings.front.rotation === 90, 'share link retains export options and surface orientation');
    assert(!new URL(url).search && url.length < 64000, 'share link strips test parameters and fits the complete-document budget');
    // A new application instance proves this is self-contained, independent of history and asset cache.
    await app.draftRecoveryController.saveNow();
    const draftBefore = await app.draftRecoveryController.store.load();
    const iframe = document.createElement('iframe');
    iframe.style.width = '1280px'; iframe.style.height = '720px';
    const sharedUrl = new URL(url); sharedUrl.searchParams.set('browser-smoke', 'shared-open');
    iframe.src = sharedUrl.href; document.body.appendChild(iframe);
    let opened;
    try {
        await waitFor(() => {
            opened = iframe.contentWindow?.[Symbol.for('lunnen.grid-generator-02.application')];
            return opened?.currentPresetName?.startsWith('Shared —');
        }, 'shared link in a fresh app instance');
        const restored = opened.objectDocument.getGraphicsBlock(id);
        assert(restored?.missingAsset && iframe.contentDocument.querySelector(`[data-image-frame="${id}"]`), 'fresh link opens a visible relinkable image frame');
        assert(opened.settingsModule.get('constructionType') === 'telescopic-tube' && opened.surfaceManager.get('front').rotation === 90, 'fresh link restores tube geometry and artwork orientation');
        assert(opened.objectDocument.getGraphicsBlock(library.id)?.svgContent === libraryAsset.content, 'bundled technical artwork is restored from the versioned catalog');
        assert(opened.dom.convertToOutlinesCheckbox.checked, 'fresh link restores the actual export checkbox');
        const draftAfter = await app.draftRecoveryController.store.load();
        assert(draftAfter.snapshot.document.graphicsBlocks.some(b => b.id === id && b.raster?.dataUrl) && draftBefore.presetName === draftAfter.presetName, 'opening a shared link does not erase the existing local draft');
        opened.objectEditorPanelController.openGraphicsPanel(id);
        await opened.graphicsAssetController.handleFile(file);
        const relinked = opened.objectDocument.getGraphicsBlock(id);
        assert(relinked.raster.dataUrl && !relinked.missingAsset && relinked.originalWidth === relinked.originalHeight, 'relinking restores image pixels while retaining the shared crop frame');
        opened.hasUnsavedChanges = false;
    } finally { opened?.dispose(); iframe.remove(); }
    const output = document.createElement('a'); output.id = 'testedShareUrl'; output.href = url; output.textContent = `Shared preset (${url.length} characters)`; document.body.appendChild(output);
}
