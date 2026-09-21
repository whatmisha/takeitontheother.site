import test from 'node:test';
import assert from 'node:assert/strict';
import { getFlatPreset } from '../src/core/flatPresets.js';
import { normalizeFlatSettings, buildFlatScene } from '../src/geometry/flatGeometry.js';
import { createPersonSearchPlan, samplePersonSearch, buildPersonSearchScene } from '../src/animation/personSearch.js';
import { flatSceneToSvgString, drawFlatSceneOnContext } from '../src/render/flatRenderer.js';
import { PERSON_RESPONSE_MS, personTransition } from '../src/animation/personMotion.js';

const settings = normalizeFlatSettings(getFlatPreset('Talent'));
const plan = createPersonSearchPlan(settings);

test('Search defaults match the requested animation settings without changing startup mode', () => {
    assert.equal(settings.personAnimation, 'interactive');
    assert.equal(settings.searchCandidates, 12);
    assert.equal(settings.searchDuration, 10);
    assert.equal(settings.searchStartRandomness, 100);
    assert.equal(settings.searchPathRandomness, 0);
});

test('finalist transitions share the fast interactive response and settle exactly', () => {
    assert.equal(PERSON_RESPONSE_MS, 95);
    assert.equal(personTransition(-1), 0);
    assert.equal(personTransition(2), 1);
    assert.ok(personTransition(0.2) > 0.6);
    const steps = Array.from({ length: 11 }, (_, i) => personTransition(i / 10));
    for (let i = 2; i < steps.length; i += 1) {
        assert.ok(steps[i] - steps[i - 1] < steps[i - 1] - steps[i - 2]);
    }
    const selected = samplePersonSearch(plan, 0.67 + 0.055 * 0.2).actors.find(a => a.id === plan.winnerId);
    assert.ok((selected.iconScale - 1) / 0.22 > 0.6);
    const disappearing = samplePersonSearch(plan, 0.92 + 0.065 * 0.2).actors[0];
    assert.ok(disappearing.strength < 0.4);
    assert.equal(samplePersonSearch(plan, 0.985).count, 0);
});

test('zero-randomness Dijkstra paths use intact vertical pairs and decrease cost until the center', () => {
    const plan = createPersonSearchPlan({ ...settings, searchPathRandomness: 0, searchStartRandomness: 0 });
    assert.equal(plan.candidates.length, settings.searchCandidates);
    assert.equal(plan.target.head.worldX, 0);
    assert.equal(plan.target.head.worldY, 0);
    for (const { path } of plan.candidates) {
        assert.equal(path.at(-1).id, plan.target.id);
        assert.equal(new Set(path.map((node) => node.id)).size, path.length);
        path.forEach((node, index) => {
            assert.equal(node.head.cx, node.shoulders.cx);
            assert.equal(node.shoulders.row, node.head.row + 1);
            if (index) assert.ok(plan.costs.get(path[index - 1].id) > plan.costs.get(node.id));
        });
    }
});

test('a complete search gradually selects one person and returns to the exact initial lattice', () => {
    assert.equal(samplePersonSearch(plan, 0.17).count, settings.searchCandidates);
    const counts = [0.17, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8].map((p) => samplePersonSearch(plan, p).count);
    assert.ok(new Set(counts).size >= 4);
    assert.equal(counts.at(-1), 1);
    assert.ok(counts.every((count, i) => i === 0 || count <= counts[i - 1]));
    const winner = samplePersonSearch(plan, 0.8).actors[0];
    assert.equal(winner.x, plan.target.x);
    assert.equal(winner.y, plan.target.y);
    assert.ok(winner.iconScale > 1);
    for (const progress of [0, 0.999, 1]) {
        const scene = buildPersonSearchScene(settings, plan, progress);
        assert.equal(scene.fields.length, 0);
        scene.elements.forEach((mark, i) => {
            const original = plan.layout.elements[i];
            for (const key of ['cx', 'cy', 'rx', 'ry']) assert.equal(mark[key], original[key]);
        });
    }
});

test('full-size candidates never share or intersect occupied pairs during a search', () => {
    for (let frame = 0; frame < 480; frame += 1) {
        const actors = samplePersonSearch(plan, frame / 480).actors;
        const bounds = actors.map((actor) => {
            const a = actor.from.bounds, b = actor.to.bounds;
            return { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right),
                top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
        });
        bounds.forEach((a, i) => bounds.slice(i + 1).forEach((b) => {
            assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
                `overlap at frame ${frame}`);
        }));
    }
});

test('random-access preview and export frames are deterministic and handovers are continuous', () => {
    const before = JSON.stringify(settings);
    const first = buildPersonSearchScene(settings, plan, 0.41);
    buildPersonSearchScene(settings, plan, 0.8);
    assert.deepEqual(buildPersonSearchScene(settings, createPersonSearchPlan(settings), 0.41), first);
    assert.equal(JSON.stringify(settings), before);
    for (let frame = 1; frame < 400; frame += 1) {
        const p = frame / 400;
        const a = buildPersonSearchScene(settings, plan, p - 0.000001);
        const b = buildPersonSearchScene(settings, plan, p + 0.000001);
        a.elements.forEach((mark, i) => {
            assert.equal(mark.cx, plan.layout.elements[i].cx);
            for (const key of ['cy', 'rx', 'ry']) assert.ok(Math.abs(mark[key] - b.elements[i][key]) < 0.05,
                `${key} discontinuity at ${p}, mark ${mark.id}`);
        });
    }
});

test('selected Person preserves the reference silhouette and vector exports capture the selected frame', () => {
    const scene = buildPersonSearchScene(settings, plan, 0.8);
    const regular = buildFlatScene(settings);
    for (const role of ['head', 'shoulders']) {
        const selected = scene.elements.find((mark) => mark.role === role);
        const original = regular.elements.find((mark) => mark.role === role);
        assert.ok(Math.abs(selected.rx / original.rx - 1.22) < 1e-9);
        assert.ok(Math.abs(selected.ry / original.ry - 1.22) < 1e-9);
    }
    assert.doesNotMatch(flatSceneToSvgString(scene), /NaN|Infinity|guide/);
});

test('handover boundaries stay continuous with large non-circular source ellipses', () => {
    const s = normalizeFlatSettings({ ...settings, personIconScale: 300, ellipseWidth: 10, ellipseHeight: 30 });
    const p = createPersonSearchPlan(s);
    for (const candidate of p.candidates) {
        for (let i = 1; i < candidate.path.length; i += 1) {
            for (const step of [0, 0.48, 0.55, 1]) {
                const from = candidate.arrivals[i - 1];
                const to = candidate.arrivals[i];
                const progress = from + (to - from) * step;
                const before = buildPersonSearchScene(s, p, progress - 1e-8);
                const after = buildPersonSearchScene(s, p, progress + 1e-8);
                before.elements.forEach((mark, j) => {
                    for (const key of ['cy', 'rx', 'ry']) {
                        assert.ok(Math.abs(mark[key] - after.elements[j][key]) < 0.01,
                            `${key} jumps at ${progress}, mark ${mark.id}`);
                    }
                });
            }
        }
    }
});

test('paired tiles, small canvases and oversized icons remain finite and respect available space', () => {
    for (const patch of [
        { distribution: 'paired', stagger: 100 },
        { width: 80, height: 80 },
        { width: 80, height: 80, spacingY: 160 },
        { width: 160, height: 160, personIconScale: 400 },
        { ellipseWidth: 6, ellipseHeight: 36, searchCandidates: 12 }
    ]) {
        const s = normalizeFlatSettings({ ...settings, ...patch });
        const p = createPersonSearchPlan(s);
        assert.ok(p.candidates.length <= s.searchCandidates);
        for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
            const scene = buildPersonSearchScene(s, p, progress);
            scene.elements.forEach((mark) => {
                for (const key of ['cx', 'cy', 'rx', 'ry']) assert.ok(Number.isFinite(mark[key]));
                assert.ok(mark.rx >= 0 && mark.ry >= 0);
            });
        }
    }
});

test('search settings survive JSON while old presets keep interactive behavior', () => {
    assert.equal(settings.personAnimation, 'interactive');
    const animated = normalizeFlatSettings({ ...settings, personAnimation: 'search', searchCandidates: 6,
        searchDuration: 12, searchStartRandomness: 87, searchPathRandomness: 92, searchSeed: 4294967295 });
    assert.deepEqual(normalizeFlatSettings(JSON.parse(JSON.stringify(animated))), animated);
});

test('start randomness stays in the outer third and is independent of route randomness', () => {
    const starts = (p) => p.candidates.map(({ path }) => path[0].id);
    const regular = createPersonSearchPlan({ ...settings, searchStartRandomness: 0 });
    const random = createPersonSearchPlan({ ...settings, searchStartRandomness: 100 });
    const newRoutes = createPersonSearchPlan({ ...settings, searchStartRandomness: 100, searchPathRandomness: 100 });
    assert.notDeepEqual(starts(regular), starts(random));
    assert.deepEqual(starts(random), starts(newRoutes));
    const minX = Math.min(...random.nodes.map((n) => n.x)), maxX = Math.max(...random.nodes.map((n) => n.x));
    const minY = Math.min(...random.nodes.map((n) => n.y)), maxY = Math.max(...random.nodes.map((n) => n.y));
    for (const { path } of random.candidates) {
        const normalizedX = Math.abs((path[0].x - (minX + maxX) / 2) / ((maxX - minX) / 2));
        const normalizedY = Math.abs((path[0].y - (minY + maxY) / 2) / ((maxY - minY) / 2));
        assert.ok(Math.max(normalizedX, normalizedY) >= 2 / 3);
    }
});

test('route randomness introduces detours and outward steps without loops or broken grid edges', () => {
    const random = createPersonSearchPlan({ ...settings, searchPathRandomness: 100 });
    let detours = 0, outwardSteps = 0;
    for (const { path, totalCost, arrivals } of random.candidates) {
        if (totalCost > random.costs.get(path[0].id) * 1.1) detours += 1;
        assert.equal(path.at(-1).id, random.target.id);
        assert.equal(new Set(path.map((n) => n.id)).size, path.length);
        path.slice(1).forEach((node, i) => {
            const previous = path[i];
            assert.ok(Math.abs(node.head.column - previous.head.column) <= 1);
            assert.ok([0, 2].includes(Math.abs(node.head.row - previous.head.row)));
            assert.ok(arrivals[i + 1] > arrivals[i]);
            if (random.costs.get(node.id) > random.costs.get(previous.id)) outwardSteps += 1;
        });
    }
    assert.ok(detours >= random.candidates.length / 2);
    assert.ok(outwardSteps > 0);
});

test('seed changes the staging and outcome, while zero randomness ignores the seed', () => {
    const signature = (p) => ({ paths: p.candidates.map((c) => c.path.map((n) => n.id)), winner: p.winnerId });
    assert.notDeepEqual(signature(plan), signature(createPersonSearchPlan({ ...settings, searchSeed: 2 })));
    assert.deepEqual(signature(createPersonSearchPlan({ ...settings, searchSeed: 1, searchStartRandomness: 0, searchPathRandomness: 0 })),
        signature(createPersonSearchPlan({ ...settings, searchSeed: 2, searchStartRandomness: 0, searchPathRandomness: 0 })));
    const winners = new Set();
    let nonShortestWinner = false;
    for (let seed = 0; seed < 12; seed += 1) {
        const p = createPersonSearchPlan({ ...settings, searchPathRandomness: 100, searchSeed: seed });
        const alive = new Set(p.candidates.map((c) => c.id));
        p.meetings.forEach(({ winner, loser }) => {
            assert.ok(alive.has(winner) && alive.has(loser));
            alive.delete(loser);
        });
        assert.deepEqual([...alive], [p.winnerId]);
        winners.add(p.winnerId);
        const winner = p.candidates.find((c) => c.id === p.winnerId);
        nonShortestWinner ||= winner.totalCost > Math.min(...p.candidates.map((c) => c.totalCost));
    }
    assert.ok(winners.size >= 3);
    assert.ok(nonShortestWinner);
});

test('random encounters stay separated and end with one survivor for multiple seeds and layouts', () => {
    for (const distribution of ['grid', 'paired']) {
        for (let seed = 0; seed < 10; seed += 1) {
            const p = createPersonSearchPlan({ ...settings, distribution, searchSeed: seed,
                searchStartRandomness: 100, searchPathRandomness: 100, searchCandidates: 12 });
            assert.equal(samplePersonSearch(p, 0.8).count, 1);
            for (let frame = 0; frame < 240; frame += 1) {
                const actors = samplePersonSearch(p, frame / 240).actors;
                const bounds = actors.map(({ from, to }) => ({ left: Math.min(from.bounds.left, to.bounds.left),
                    right: Math.max(from.bounds.right, to.bounds.right), top: Math.min(from.bounds.top, to.bounds.top),
                    bottom: Math.max(from.bounds.bottom, to.bounds.bottom) }));
                bounds.forEach((a, i) => bounds.slice(i + 1).forEach((b) => {
                    assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
                        `${distribution}, seed ${seed}, frame ${frame}`);
                }));
            }
        }
    }
});

test('PNG sequence rendering omits the background, while video fills it at the artboard aspect ratio', () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]) });
    const scene = buildPersonSearchScene(settings, plan, 0.8);
    drawFlatSceneOnContext(ctx, scene, { width: 1080, height: 608, transparent: true });
    assert.equal(calls.filter(([name]) => name === 'fillRect').length, 0);
    assert.ok(calls.some(([name]) => name === 'ellipse'));
    assert.deepEqual(calls[0], ['setTransform', 1080 / settings.width, 0, 0, 608 / settings.height, 0, 0]);
    drawFlatSceneOnContext(ctx, scene, { width: 1080, height: 608 });
    assert.equal(calls.filter(([name]) => name === 'fillRect').length, 1);
});
