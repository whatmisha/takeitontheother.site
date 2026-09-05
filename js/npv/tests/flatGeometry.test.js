import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    FLAT_ARTBOARD_CENTER_X,
    FLAT_ARTBOARD_CENTER_Y,
    buildFlatLayout,
    buildFlatScene,
    defaultFlatSettings,
    flatFalloff,
    normalizeFlatSettings
} from '../src/geometry/flatGeometry.js';
import { flatSceneToSvgString } from '../src/render/flatRenderer.js';

test('Person defaults reproduce the density and proportions of the supplied reference', () => {
    const settings = defaultFlatSettings();
    const scene = buildFlatScene({ ...settings, mode: 'person' });
    assert.equal(scene.elements.length, 609);

    const head = scene.elements.find((element) => element.role === 'head');
    const shoulders = scene.elements.find((element) => element.role === 'shoulders');
    assert.ok(head);
    assert.ok(shoulders);
    assert.equal(head.column, shoulders.column);
    assert.equal(shoulders.row, head.row + 1);
    assert.equal(head.cx, shoulders.cx);
    const baseRadius = Math.sqrt(settings.ellipseWidth * settings.ellipseHeight) / 2;
    const referenceBaseRadius = 4.19383;
    assert.ok(Math.abs(head.rx / baseRadius - 8.88839 / referenceBaseRadius) < 1e-9);
    assert.ok(Math.abs(shoulders.rx / baseRadius - 14.8358 / referenceBaseRadius) < 1e-9);
    assert.ok(Math.abs(shoulders.ry / baseRadius - 8.47758 / referenceBaseRadius) < 1e-9);
    assert.ok(Math.abs(
        (shoulders.cy - head.cy) / (baseRadius * 2)
        - (246.523 - 228.386) / (referenceBaseRadius * 2)
    ) < 1e-9);
});

test('Basic mode gives the cursor mark maximum growth and fades continuously to regular size', () => {
    const settings = { ...defaultFlatSettings(), mode: 'basic', width: 101, height: 113 };
    const layout = buildFlatLayout(settings);
    const center = layout.elements.find((element) => element.row === 0 && element.column === 0);
    const scene = buildFlatScene(settings, {
        transientField: { x: center.worldX, y: center.worldY }
    });
    const marks = scene.elements
        .filter((element) => element.row === center.row)
        .sort((a, b) => Math.abs(a.column - center.column) - Math.abs(b.column - center.column));
    assert.ok(Math.abs(marks[0].rx / center.rx - settings.basicScale / 100) < 1e-9);
    assert.ok(marks[0].rx > marks[1].rx);
    assert.ok(marks[1].rx >= marks[3].rx);
});

test('Basic mode composes cursor and pinned fields smoothly without exceeding maximum size', () => {
    const settings = {
        ...defaultFlatSettings(),
        mode: 'basic',
        width: 101,
        height: 113,
        staticFields: [{ id: 'corner', x: 0, y: 0, enabled: true }]
    };
    const layout = buildFlatLayout(settings);
    const corner = layout.elements[0];
    settings.staticFields[0].x = corner.worldX;
    settings.staticFields[0].y = corner.worldY;
    const scene = buildFlatScene(settings, {
        transientField: { x: 0, y: 0 }
    });
    const pinned = scene.elements.find((element) => element.id === corner.id);
    assert.equal(scene.fields.length, 2);
    assert.ok(Math.abs(pinned.rx / corner.rx - settings.basicScale / 100) < 1e-9);

    const disabled = buildFlatScene({
        ...settings,
        staticFields: [{ ...settings.staticFields[0], enabled: false }]
    });
    const disabledCorner = disabled.elements.find((element) => element.id === corner.id);
    assert.ok(disabledCorner.rx < pinned.rx);

    const single = buildFlatScene({ ...settings, staticFields: [] }, {
        transientField: { x: 0, y: 0 }
    });
    const duplicate = buildFlatScene({
        ...settings,
        staticFields: [{
            id: 'same-as-cursor',
            x: 0,
            y: 0,
            enabled: true
        }]
    }, { transientField: { x: 0, y: 0 } });
    assert.deepEqual(
        duplicate.elements.map((element) => element.rx),
        single.elements.map((element) => element.rx)
    );
});

test('falloff curve moves from soft through linear to tight without changing endpoints', () => {
    assert.equal(flatFalloff(0, 100, -100), 1);
    assert.equal(flatFalloff(100, 100, 100), 0);
    const soft = flatFalloff(50, 100, -100);
    const linear = flatFalloff(50, 100, 0);
    const tight = flatFalloff(50, 100, 100);
    assert.ok(soft > linear);
    assert.ok(linear > tight);
});

test('Person mode reverses the field by shrinking nearby ellipses', () => {
    const settings = defaultFlatSettings();
    const scene = buildFlatScene({ ...settings, mode: 'person' });
    const head = scene.elements.find((element) => element.role === 'head');
    const sideNeighbor = scene.elements.find((element) => (
        element.row === head.row && element.column === head.column - 1
    ));
    assert.ok(sideNeighbor.rx < settings.ellipseWidth / 2);
    const corner = scene.elements[0];
    assert.ok(Math.abs(corner.rx - settings.ellipseWidth / 2) < 1e-9);
});

test('Person field radius expands through the full requested range like Basic', () => {
    const settings = { ...defaultFlatSettings(), mode: 'person' };
    const layout = buildFlatLayout(settings);
    const small = buildFlatScene({ ...settings, fieldRadius: 40 });
    const huge = buildFlatScene({ ...settings, fieldRadius: 240 });
    const distantSource = layout.elements.find((element) => {
        const distance = Math.hypot(element.cx - huge.field.x, element.cy - huge.field.y);
        return distance > 100 && distance < 150;
    });
    const smallMark = small.elements.find((element) => element.id === distantSource.id);
    const hugeMark = huge.elements.find((element) => element.id === distantSource.id);
    assert.equal(small.field.radius, 40);
    assert.equal(huge.field.radius, 240);
    assert.ok(Math.abs(smallMark.rx - distantSource.rx) < 1e-9);
    assert.ok(Math.abs(hugeMark.rx - distantSource.rx) > 0.1);
});

test('Person Minimum size changes only neighboring marks, never the reference icon', () => {
    const settings = { ...defaultFlatSettings(), mode: 'person' };
    const reduced = buildFlatScene({ ...settings, personMinimumScale: 25 });
    const subtle = buildFlatScene({ ...settings, personMinimumScale: 75 });
    const reducedHead = reduced.elements.find((element) => element.role === 'head');
    const subtleHead = subtle.elements.find((element) => element.role === 'head');
    const reducedShoulders = reduced.elements.find((element) => element.role === 'shoulders');
    const subtleShoulders = subtle.elements.find((element) => element.role === 'shoulders');
    const reducedNeighbor = reduced.elements.find((element) => (
        element.row === reducedHead.row && element.column === reducedHead.column - 1
    ));
    const subtleNeighbor = subtle.elements.find((element) => element.id === reducedNeighbor.id);
    const far = reduced.elements[0];

    assert.deepEqual(reducedHead, subtleHead);
    assert.deepEqual(reducedShoulders, subtleShoulders);
    assert.ok(reducedNeighbor.rx < subtleNeighbor.rx);
    assert.ok(Math.abs(far.rx - settings.ellipseWidth / 2) < 1e-9);
});

test('Person proportions do not inherit the base ellipse aspect ratio', () => {
    const wideBase = buildFlatScene({
        ...defaultFlatSettings(),
        mode: 'person',
        ellipseWidth: 20,
        ellipseHeight: 8
    });
    const tallBase = buildFlatScene({
        ...defaultFlatSettings(),
        mode: 'person',
        ellipseWidth: 8,
        ellipseHeight: 20
    });
    const roles = (scene) => ({
        head: scene.elements.find((element) => element.role === 'head'),
        shoulders: scene.elements.find((element) => element.role === 'shoulders')
    });
    const wide = roles(wideBase);
    const tall = roles(tallBase);

    assert.equal(wide.head.rx, wide.head.ry);
    assert.equal(tall.head.rx, tall.head.ry);
    assert.equal(wide.head.rx, tall.head.rx);
    assert.equal(wide.shoulders.rx, tall.shoulders.rx);
    assert.equal(wide.shoulders.ry, tall.shoulders.ry);
});

test('Pinned fields retain their own mode, radius, curve, and size limit', () => {
    const base = {
        ...defaultFlatSettings(),
        mode: 'basic',
        width: 101,
        height: 113,
        fieldFollow: false,
        fieldX: 960,
        fieldY: 960,
        fieldRadius: 200,
        basicScale: 500
    };
    const layout = buildFlatLayout(base);
    const center = layout.elements.find((element) => element.row === 0 && element.column === 0);
    const scene = buildFlatScene({
        ...base,
        staticFields: [{
            id: 'frozen',
            x: center.worldX,
            y: center.worldY,
            enabled: true,
            mode: 'basic',
            radius: 18,
            falloffCurve: -40,
            basicScale: 150,
            personMinimumScale: 36
        }]
    });
    const frozen = scene.fields.find((field) => field.id === 'frozen');
    const mark = scene.elements.find((element) => element.id === center.id);

    assert.equal(frozen.radius, 18);
    assert.equal(frozen.falloffCurve, -40);
    assert.equal(frozen.basicScale, 150);
    assert.equal(frozen.personMinimumScale, 36);
    assert.ok(Math.abs(mark.rx / center.rx - 1.5) < 1e-9);

    const mixed = buildFlatScene({
        ...base,
        staticFields: [{ ...scene.settings.staticFields[0], mode: 'person' }]
    });
    assert.ok(mixed.elements.some((element) => element.role === 'head'));
});

test('Spacing is center-to-center and ellipse dimensions never move the lattice', () => {
    const narrow = buildFlatLayout({
        ...defaultFlatSettings(),
        width: 90,
        height: 114,
        ellipseWidth: 4,
        ellipseHeight: 40,
        spacingX: 27,
        spacingY: 31
    });
    const wide = buildFlatLayout({
        ...narrow.settings,
        ellipseWidth: 80,
        ellipseHeight: 3
    });
    assert.deepEqual(
        narrow.elements.map(({ cx, cy }) => [cx, cy]),
        wide.elements.map(({ cx, cy }) => [cx, cy])
    );
    assert.equal(narrow.elements[1].cx - narrow.elements[0].cx, 27);
    assert.ok(Math.abs(
        narrow.elements[narrow.columnCount].cy - narrow.elements[0].cy - 31
    ) < 1e-9);
});

test('The default canvas derives a centered 29×21 lattice without editable row or column counts', () => {
    const layout = buildFlatLayout(defaultFlatSettings());
    assert.equal(layout.columnCount, 29);
    assert.equal(layout.rowCount, 21);
    assert.equal(layout.elements.length, 609);
    assert.ok(layout.elements[0].cx < 0);
    assert.ok(layout.elements[28].cx > 640);
    const center = layout.elementById.get('0:0');
    assert.equal(center.worldX, 0);
    assert.equal(center.worldY, 0);
    assert.equal(center.cx, FLAT_ARTBOARD_CENTER_X);
    assert.equal(center.cy, FLAT_ARTBOARD_CENTER_Y);
});

test('Paired tiles stagger complete two-row motifs without breaking their vertical axis', () => {
    const settings = { ...defaultFlatSettings(), distribution: 'paired', width: 124, height: 183 };
    const layout = buildFlatLayout(settings);
    layout.rowIndices.filter((row) => row % 2 === 0).forEach((headRow) => {
        const shoulderRow = headRow + 1;
        if (!layout.rowIndices.includes(shoulderRow)) return;
        layout.columnIndices.forEach((column) => {
            const head = layout.elementById.get(`${headRow}:${column}`);
            const shoulders = layout.elementById.get(`${shoulderRow}:${column}`);
            assert.equal(head.cx, shoulders.cx);
        });
    });
    const firstBand = layout.elementById.get('0:0');
    const nextBand = layout.elementById.get('2:0');
    assert.ok(Math.abs(firstBand.cx - nextBand.cx) > 0);
});

test('Person still produces a valid aligned motif at the minimum row count', () => {
    const scene = buildFlatScene({ ...defaultFlatSettings(), mode: 'person', width: 80, height: 80 });
    const head = scene.elements.find((element) => element.role === 'head');
    const shoulders = scene.elements.find((element) => element.role === 'shoulders');
    assert.ok(head);
    assert.ok(shoulders);
    assert.equal(head.cx, shoulders.cx);
    assert.equal(shoulders.row, head.row + 1);
});

test('Canvas growth adds cells on every edge while centered mark and field coordinates stay fixed', () => {
    const settings = {
        ...defaultFlatSettings(),
        mode: 'basic',
        fieldFollow: false,
        fieldX: 197,
        fieldY: 137,
        staticFields: [{ id: 'outside-after-shrink', x: 380, y: 320, enabled: true }]
    };
    const small = buildFlatScene(settings);
    const large = buildFlatScene({ ...settings, width: 800, height: 620 });
    const largeById = new Map(large.elements.map((element) => [element.id, element]));

    assert.ok(large.elements.length > small.elements.length);
    small.elements.forEach((element) => {
        const expanded = largeById.get(element.id);
        assert.ok(expanded);
        assert.equal(expanded.worldX, element.worldX);
        assert.equal(expanded.worldY, element.worldY);
        assert.ok(Math.abs(expanded.rx - element.rx) < 1e-9);
        assert.ok(Math.abs(expanded.ry - element.ry) < 1e-9);
        assert.ok(Math.abs(expanded.cx - element.cx - 80) < 1e-9);
        assert.ok(Math.abs(expanded.cy - element.cy - 70) < 1e-9);
    });
    assert.deepEqual(
        large.fields.map(({ id, coordinateX, coordinateY }) => [id, coordinateX, coordinateY]),
        small.fields.map(({ id, coordinateX, coordinateY }) => [id, coordinateX, coordinateY])
    );
    large.fields.forEach((field, index) => {
        assert.equal(field.x - small.fields[index].x, 80);
        assert.equal(field.y - small.fields[index].y, 70);
    });
    const extent = (scene, axis) => {
        const values = scene.elements.map((element) => element[axis]);
        return [Math.min(...values), Math.max(...values)];
    };
    const [smallMinColumn, smallMaxColumn] = extent(small, 'column');
    const [largeMinColumn, largeMaxColumn] = extent(large, 'column');
    const [smallMinRow, smallMaxRow] = extent(small, 'row');
    const [largeMinRow, largeMaxRow] = extent(large, 'row');
    assert.ok(largeMinColumn < smallMinColumn);
    assert.ok(largeMaxColumn > smallMaxColumn);
    assert.ok(largeMinRow < smallMinRow);
    assert.ok(largeMaxRow > smallMaxRow);
    assert.equal(large.width, 800);
    assert.equal(large.height, 620);
});

test('Flat export contains clean clipped ellipses and excludes field guides', () => {
    const scene = buildFlatScene({ ...defaultFlatSettings(), showField: true });
    const svg = flatSceneToSvgString(scene);
    assert.match(svg, /^<\?xml/);
    assert.equal((svg.match(/<ellipse /g) || []).length, scene.elements.length);
    assert.match(svg, /clipPath id="artboard"/);
    assert.doesNotMatch(svg, /guide-field|data-flat-role/);
});

test('Sphere and Flat are exposed as sibling tool tabs', async () => {
    const sphere = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const flat = await readFile(new URL('../flat.html', import.meta.url), 'utf8');
    assert.match(sphere, /href="\.\/" aria-current="page">Sphere/);
    assert.match(sphere, /href="\.\/flat\.html">Flat/);
    assert.match(flat, /href="\.\/">Sphere/);
    assert.match(flat, /href="\.\/flat\.html" aria-current="page">Flat/);
});

test('Flat UI exposes pinned fields and brush-radius shortcuts without editable Person proportions', async () => {
    const html = await readFile(new URL('../flat.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/FlatApp.js', import.meta.url), 'utf8');
    const renderer = await readFile(new URL('../src/render/flatRenderer.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../styles/global.css', import.meta.url), 'utf8');
    assert.match(html, /viewBox="0 0 640 480"/);
    assert.match(html, /id="canvasWidth"[^>]*value="640"[^>]*data-flat-setting="width"/);
    assert.match(html, /id="canvasHeight"[^>]*value="480"[^>]*data-flat-setting="height"/);
    assert.doesNotMatch(html, /id="columns"|id="rows"/);
    assert.match(html, /id="fieldX"[^>]*min="-960"[^>]*max="960"[^>]*value="0"[^>]*data-flat-coordinate="x"/);
    assert.match(html, /id="fieldY"[^>]*min="-960"[^>]*max="960"[^>]*value="0"[^>]*data-flat-coordinate="y"/);
    assert.match(html, /id="personMinimumScale"/);
    assert.doesNotMatch(html, /id="personScale"/);
    assert.match(html, /id="spacingX"/);
    assert.match(html, /id="staticFieldsSection"/);
    assert.match(html, /M5\.7410987,3\.4304742/);
    assert.doesNotMatch(html, /id="centerFlatField"/);
    assert.doesNotMatch(html, /id="headScale"|id="shoulderWidthScale"|id="shoulderHeightScale"|id="shoulderLift"/);
    assert.match(app, /event\.code === 'BracketLeft'/);
    assert.match(app, /event\.code === 'BracketRight'/);
    assert.match(app, /addStaticField\(point\)/);
    assert.match(app, /interpolatePersonScene/);
    assert.match(app, /radius: this\.settings\.fieldRadius/);
    assert.match(app, /syncFieldCoordinates/);
    assert.match(app, /document\.querySelectorAll\('\[data-flat-coordinate\]'\)/);
    assert.match(app, /point\.x - this\.settings\.width \/ 2/);
    assert.doesNotMatch(app, /point\[axis\] - center/);
    assert.match(app, /setSurfaceSize\(targetScene\.width, targetScene\.height\)/);
    assert.match(app, /field\.mode === 'person' \? 'P ' : ''/);
    assert.match(app, /syncHoveredStaticFieldGuide/);
    assert.doesNotMatch(app, /button\.textContent = '✓'/);
    assert.match(renderer, /'data-field-id': field\.id/);
    assert.match(css, /\.guide-field,[\s\S]*?stroke-dasharray: 2 4/);
    assert.match(css, /\.guide-field\.is-pinned-hover\s*\{[\s\S]*?stroke-dasharray: none/);
    assert.match(css, /\.is-pinned-hover/);
    assert.doesNotMatch(app, /canvas\.addEventListener\('pointerleave'/);
    assert.match(app, /patch\.fieldX = this\.transientField\.x/);
});
test('Flat uses a 640×480 artboard with immutable center-origin field coordinates', () => {
    const settings = defaultFlatSettings();
    const scene = buildFlatScene(settings);
    assert.equal(scene.width, 640);
    assert.equal(scene.height, 480);
    assert.equal(settings.fieldX, 0);
    assert.equal(settings.fieldY, 0);
    assert.equal(scene.field.coordinateX, 0);
    assert.equal(scene.field.coordinateY, 0);
    assert.equal(scene.field.x, FLAT_ARTBOARD_CENTER_X);
    assert.equal(scene.field.y, FLAT_ARTBOARD_CENTER_Y);
});

test('legacy top-left field coordinates migrate once into the center-origin space', () => {
    const settings = normalizeFlatSettings({
        width: 800,
        height: 620,
        fieldX: 320,
        fieldY: 240,
        staticFields: [{ id: 'legacy', x: 517, y: 377, enabled: true }]
    });
    assert.equal(settings.coordinateSpace, 'center');
    assert.equal(settings.fieldX, -80);
    assert.equal(settings.fieldY, -70);
    assert.equal(settings.staticFields[0].x, 117);
    assert.equal(settings.staticFields[0].y, 67);
    const normalizedAgain = normalizeFlatSettings(settings);
    assert.equal(normalizedAgain.fieldX, -80);
    assert.equal(normalizedAgain.fieldY, -70);
    assert.equal(normalizedAgain.staticFields[0].x, 117);
    assert.equal(normalizedAgain.staticFields[0].y, 67);
});
