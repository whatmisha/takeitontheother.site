export async function checkRotations({ application: app, appDocument: doc, appWindow: win, assert, waitFor, presetFormat }) {
    const change = (id, value) => {
        const node = doc.getElementById(id); node.value = String(value);
        node.dispatchEvent(new win.Event('change', { bubbles: true }));
    };
    const rotate = rotation => change('surfaceRotationSelect', rotation);
    const choose = surface => doc.querySelector(`#surfaceSettingsTabs input[data-surface="${surface}"]`).click();
    const preview = app.packagingPreview, scene = preview.scene;
    // The existing box pipeline and the new cylindrical pipeline share artwork orientation.
    for (const type of ['box', 'telescopic-tube']) {
        change('constructionTypeSelect', type);
        choose('front');
        await preview.setMode('2d');
        assert(!doc.getElementById('surfaceBehaviorControls').hidden &&
            win.getComputedStyle(doc.querySelector('.surface-own-grid-chip')).display === 'none' &&
            win.getComputedStyle(doc.querySelector('.surface-visible-chip')).display === 'none', `${type}: main surface exposes orientation with its main grid controls`);
        const before = app.getStateSnapshot();
        const physical = { ...app.surfaceManager.getPhysicalRect('front', app.settingsModule.getAll()) };
        for (const rotation of [90, 180, 270]) {
            rotate(rotation);
            const context = app.surfaceCoordinates.getGridContext('front');
            const geometry = app.surfaceManager.getGeometry('front', app.currentSurfaceLayout);
            const layer = doc.getElementById('surface-display-front');
            assert(layer?.getAttribute('transform') === geometry.transform &&
                context.frontWidth === (rotation % 180 ? physical.height : physical.width), `${type} ${rotation}: canvas and grid use rotated local axes`);
            const clip = doc.querySelector('#surface-clip-display-front rect');
            assert(Math.abs(Number(clip.getAttribute('width')) - geometry.localWidth) < 1e-7 &&
                Math.abs(Number(clip.getAttribute('height')) - geometry.localHeight) < 1e-7, `${type} ${rotation}: artwork clips to the physical face`);
            const exported = await app.exportDocumentBuilder.build(false);
            const mmGeometry = app.surfaceManager.getGeometry('front', app.settingsModule.getAll());
            assert(exported.querySelector('#surface-export-front')?.getAttribute('transform') === mmGeometry.transform &&
                exported.querySelector('#surface-export-front #grid'), `${type} ${rotation}: SVG exports artwork and grid in the same rotated frame`);
            // Verify pointer mapping through the actual canvas transform, including canvas navigation.
            const point = new win.DOMPoint(geometry.localWidth * .4, geometry.localHeight * .3).matrixTransform(layer.getScreenCTM());
            const pointer = app.surfaceCoordinates.getSurfacePointer(point.x, point.y);
            assert(pointer?.surface === 'front' && Math.abs(pointer.local.x - context.frontWidth * .4) < 1e-3 &&
                Math.abs(pointer.local.y - context.frontHeight * .3) < 1e-3, `${type} ${rotation}: object placement follows the rotated axes (${JSON.stringify(pointer?.local)} vs ${context.frontWidth * .4}, ${context.frontHeight * .3})`);
        }
        await preview.setMode('3d');
        const previousTexture = scene.texture;
        rotate(90);
        await waitFor(() => scene.texture !== previousTexture && !preview.rendering && !doc.getElementById('previewStatus').textContent, 'rotated artwork texture');
        assert(scene.panels.find(p => p.spec.id === 'front').spec.rect.width === physical.width, `${type}: 3D refreshes artwork without rotating the construction`);
        const restored = presetFormat.normalize(presetFormat.organize({ settings: app.settingsModule.getAll(), textBlocks: app.objectDocument.textBlocks, graphicsBlocks: app.objectDocument.graphicsBlocks }));
        assert(restored.settings.surfaceSettings.front.rotation === 90, `${type}: preset retains the main surface rotation`);
        app.undo();
        assert(app.surfaceManager.get('front').rotation === 270 && doc.getElementById('surfaceRotationSelect').value === '270', `${type}: Undo restores orientation and its control`);
        app.redo();
        assert(app.surfaceManager.get('front').rotation === 90, `${type}: Redo reapplies orientation`);
        rotate(0);
        assert(!doc.getElementById('surface-display-front') && app.settingsModule.get('frontWidth') === before.settings.frontWidth, `${type}: returning to zero restores the original coordinate frame`);
    }
    choose('tubeCap'); rotate(90);
    choose('front'); rotate(270);
    assert(app.surfaceManager.get('tubeCap').rotation === 90 && app.surfaceManager.get('front').rotation === 270, 'body and cap retain independent orientations');
    // Observe the real artwork builder used by the 3D atlas, not a separate mock renderer.
    const frames = [];
    const createLayer = app.surfaceRenderer.createLayer;
    app.surfaceRenderer.createLayer = function(...args) {
        const frame = createLayer.apply(this, args);
        if (args[3] === 'preview') frames.push([args[1], frame.geometry.rotation]);
        return frame;
    };
    try {
        const oldTexture = scene.texture; rotate(180);
        await waitFor(() => scene.texture !== oldTexture && !preview.rendering, 'independently rotated atlas');
    } finally { app.surfaceRenderer.createLayer = createLayer; }
    assert(frames.some(([id, rotation]) => id === 'front' && rotation === 180) && frames.some(([id, rotation]) => id === 'tubeCap' && rotation === 90), '3D atlas uses both independent surface transforms');
    await app.draftRecoveryController.saveNow();
    const draft = await app.draftRecoveryController.store.load();
    assert(draft.snapshot.settings.surfaceSettings.front.rotation === 180 && draft.snapshot.settings.surfaceSettings.tubeCap.rotation === 90, 'autosave retains both orientations');
}
