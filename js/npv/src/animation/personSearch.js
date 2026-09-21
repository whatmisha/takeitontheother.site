import {
    buildFlatLayout, flatFalloff, nonContactScale, referencePersonShapes
} from '../geometry/flatGeometry.js';
import { personTransition } from './personMotion.js';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const MOVE_START = 0.23;
const MOVE_END = 0.67;
const FADE_TIME = 0.045;

// Settings baked into the route graph, collision schedule or transition timing.
export function personSearchKey(settings) {
    return JSON.stringify(['width', 'height', 'spacingX', 'spacingY', 'distribution',
        'stagger', 'ellipseWidth', 'ellipseHeight', 'personIconScale', 'searchCandidates',
        'searchStartRandomness', 'searchPathRandomness', 'searchSeed', 'searchDuration']
        .map((key) => settings[key]));
}

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = Math.imul(state ^ (state >>> 15), state | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

class MinHeap {
    values = [];
    push(entry) {
        const a = this.values;
        let i = a.length;
        a.push(entry);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (a[parent].cost <= entry.cost) break;
            a[i] = a[parent];
            i = parent;
        }
        a[i] = entry;
    }
    pop() {
        const a = this.values;
        const first = a[0];
        const last = a.pop();
        if (a.length) {
            let i = 0;
            while (i * 2 + 1 < a.length) {
                let child = i * 2 + 1;
                if (child + 1 < a.length && a[child + 1].cost < a[child].cost) child += 1;
                if (a[child].cost >= last.cost) break;
                a[i] = a[child];
                i = child;
            }
            a[i] = last;
        }
        return first;
    }
}

function boundsOf(shapes) {
    return {
        left: Math.min(shapes.head.cx - shapes.head.rx, shapes.shoulders.cx - shapes.shoulders.rx),
        right: Math.max(shapes.head.cx + shapes.head.rx, shapes.shoulders.cx + shapes.shoulders.rx),
        top: shapes.head.cy - shapes.head.ry,
        bottom: shapes.shoulders.cy + shapes.shoulders.ry
    };
}

function intersects(a, b, gap = 4) {
    return a.left < b.right + gap && b.left < a.right + gap
        && a.top < b.bottom + gap && b.top < a.bottom + gap;
}

function travelAt(plan, candidate, progress) {
    const path = candidate.path;
    const arrivals = candidate.arrivals;
    let low = 0;
    let high = path.length - 1;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (arrivals[middle] < progress) low = middle + 1;
        else high = middle;
    }
    const to = path[low];
    const from = path[Math.max(0, low - 1)];
    const start = arrivals[Math.max(0, low - 1)];
    const end = arrivals[low];
    const step = from === to ? 0 : clamp((progress - start) / (end - start));
    return { from, to, step, x: mix(from.x, to.x, step), y: mix(from.y, to.y, step) };
}

function travelBounds(travel) {
    // Reserve both pairs throughout a handover, even while one is barely visible.
    const a = travel.from.bounds;
    const b = travel.to.bounds;
    return { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right),
        top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
}

function shortestPaths(byId, target, edgeCost) {
    const costs = new Map([[target.id, 0]]);
    const parents = new Map();
    const heap = new MinHeap();
    heap.push({ id: target.id, cost: 0 });
    while (heap.values.length) {
        const current = heap.pop();
        if (current.cost !== costs.get(current.id)) continue;
        const node = byId.get(current.id);
        for (const [dr, dc] of [[0, -1], [0, 1], [-2, -1], [-2, 0], [-2, 1], [2, -1], [2, 0], [2, 1]]) {
            const next = byId.get(`${node.head.row + dr}:${node.head.column + dc}`);
            if (!next) continue;
            const cost = current.cost + edgeCost(node, next);
            if (cost >= (costs.get(next.id) ?? Infinity)) continue;
            costs.set(next.id, cost);
            parents.set(next.id, node.id);
            heap.push({ id: next.id, cost });
        }
    }
    return { costs, parents };
}

function tracePath(start, target, tree, byId) {
    const path = [start];
    while (path.at(-1) !== target) path.push(byId.get(tree.parents.get(path.at(-1).id)));
    return path;
}

function eraseLoops(path) {
    const result = [];
    const positions = new Map();
    for (const node of path) {
        if (positions.has(node.id)) {
            const position = positions.get(node.id);
            while (result.length > position + 1) positions.delete(result.pop().id);
        } else {
            positions.set(node.id, result.length);
            result.push(node);
        }
    }
    return result;
}

function reservations(candidate) {
    const result = [{ start: 0, end: candidate.arrivals[0], bounds: candidate.path[0].bounds }];
    for (let i = 1; i < candidate.path.length; i += 1) {
        result.push({ start: candidate.arrivals[i - 1], end: candidate.arrivals[i],
            bounds: travelBounds({ from: candidate.path[i - 1], to: candidate.path[i] }) });
    }
    result.push({ start: candidate.arrivals.at(-1), end: 1, bounds: candidate.path.at(-1).bounds });
    return result;
}

function firstMeeting(a, b) {
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        const start = Math.max(a[i].start, b[j].start);
        const end = Math.min(a[i].end, b[j].end);
        if (end > start && intersects(a[i].bounds, b[j].bounds, 8)) return start;
        if (a[i].end <= b[j].end) i += 1;
        else j += 1;
    }
    return null;
}

function resolveMeetings(plan, randomness, random) {
    const occupied = plan.candidates.map(reservations);
    const events = [];
    plan.candidates.forEach((a, i) => {
        plan.candidates.slice(i + 1).forEach((b, offset) => {
            const time = firstMeeting(occupied[i], occupied[i + 1 + offset]);
            if (time !== null) events.push({ time, a, b });
        });
    });
    events.sort((a, b) => a.time - b.time || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));
    const alive = new Set(plan.candidates.map((candidate) => candidate.id));
    plan.meetings = [];
    for (const { time, a, b } of events) {
        if (!alive.has(a.id) || !alive.has(b.id)) continue;
        const aPosition = travelAt(plan, a, time);
        const bPosition = travelAt(plan, b, time);
        const remaining = ({ from, to, step }) => mix(plan.costs.get(from.id), plan.costs.get(to.id), step);
        const aPreferred = remaining(aPosition) <= remaining(bPosition);
        const aChance = (1 - randomness) * Number(aPreferred) + randomness / 2;
        const aWins = randomness === 0 ? aPreferred : random() < aChance;
        const loser = aWins ? b : a;
        const winner = aWins ? a : b;
        loser.fadeEnd = Math.max(loser.spawn + FADE_TIME, time - 0.012);
        loser.fadeStart = Math.max(loser.spawn, loser.fadeEnd - FADE_TIME);
        alive.delete(loser.id);
        plan.meetings.push({ time, winner: winner.id, loser: loser.id });
    }
    plan.winnerId = [...alive][0] ?? null;
}

export function createPersonSearchPlan(rawSettings) {
    const layout = buildFlatLayout(rawSettings);
    const settings = layout.settings;
    const diameter = Math.sqrt(settings.ellipseWidth * settings.ellipseHeight);
    const allNodes = layout.elements.filter((head) => head.row % 2 === 0).flatMap((head) => {
        const shoulders = layout.elementById.get(`${head.row + 1}:${head.column}`);
        if (!shoulders) return [];
        const node = { id: head.id, head, shoulders, x: head.cx, y: head.cy };
        node.shapes = referencePersonShapes(node, diameter, settings.personIconScale / 100);
        node.bounds = boundsOf(node.shapes);
        return [node];
    });
    // Prefer complete silhouettes inside the artboard; tiny canvases still have a usable target.
    const fitting = allNodes.filter(({ bounds: b }) => b.left >= 4 && b.right <= settings.width - 4
        && b.top >= 4 && b.bottom <= settings.height - 4);
    const nodes = fitting.length ? fitting : allNodes.filter((node) => node.x >= 0 && node.x <= settings.width
        && node.y >= 0 && node.y <= settings.height);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const target = nodes.reduce((best, node) => !best
        || Math.hypot(node.x - settings.width / 2, node.y - settings.height / 2)
        < Math.hypot(best.x - settings.width / 2, best.y - settings.height / 2) ? node : best, null);
    const plan = { layout, nodes, byId, target, candidates: [], costs: new Map(), parents: new Map(),
        meetings: [], winnerId: null };
    if (!target) return plan;
    // Separate streams keep the two randomness sliders independent.
    const startRandom = seededRandom(settings.searchSeed ^ 0x1b873593);
    const routeRandom = seededRandom(settings.searchSeed ^ 0x85ebca6b);
    const meetingRandom = seededRandom(settings.searchSeed ^ 0xc2b2ae35);
    const startAmount = settings.searchStartRandomness / 100;
    const pathAmount = settings.searchPathRandomness / 100;
    const phase = routeRandom() * Math.PI * 2;
    const terrain = (node) => 1 + pathAmount * 0.35 * (1 + Math.sin(node.head.worldX / 110 + phase)
        * Math.cos(node.head.worldY / 95 - phase));
    const edgeCost = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * (terrain(a) + terrain(b)) / 2;
    const centerTree = shortestPaths(byId, target, edgeCost);
    plan.costs = centerTree.costs;
    plan.parents = centerTree.parents;
    const reachable = nodes.filter((node) => plan.costs.has(node.id));
    const limits = reachable.reduce((b, n) => ({ left: Math.min(b.left, n.x), right: Math.max(b.right, n.x),
        top: Math.min(b.top, n.y), bottom: Math.max(b.bottom, n.y) }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    const centerX = (limits.left + limits.right) / 2;
    const centerY = (limits.top + limits.bottom) / 2;
    const halfWidth = Math.max(1, (limits.right - limits.left) / 2);
    const halfHeight = Math.max(1, (limits.bottom - limits.top) / 2);
    const outerNodes = reachable.filter((node) => Math.max(Math.abs((node.x - centerX) / halfWidth),
        Math.abs((node.y - centerY) / halfHeight)) >= 2 / 3);
    const starts = [];
    const startGap = 12 + Math.min(layout.pitchX, 2 * layout.pitchY);
    for (let i = 0; i < settings.searchCandidates; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / settings.searchCandidates
            + (startRandom() - 0.5) * Math.PI * 2 * startAmount;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const length = (1 - startRandom() * startAmount / 3) / Math.max(Math.abs(dx), Math.abs(dy));
        const x = centerX + dx * length * halfWidth;
        const y = centerY + dy * length * halfHeight;
        const ordered = [...outerNodes].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
        const start = ordered.find((node) => node !== target && starts.every((other) => !intersects(node.bounds, other.bounds, startGap)));
        if (start) starts.push(start);
    }
    if (!starts.length) starts.push(target);
    const trees = new Map([[target.id, centerTree]]);
    starts.forEach((start, index) => {
        const waypoints = [];
        const startAngle = Math.atan2((start.y - centerY) / halfHeight, (start.x - centerX) / halfWidth);
        const startRadius = Math.max(Math.abs((start.x - centerX) / halfWidth), Math.abs((start.y - centerY) / halfHeight));
        const direction = routeRandom() < 0.5 ? -1 : 1;
        const waypointCount = start === target ? 0 : Math.ceil(pathAmount * 3);
        for (let step = 0; step < waypointCount; step += 1) {
            const angle = startAngle + direction * pathAmount * (0.55 + 0.8 * (step + 1))
                + (routeRandom() - 0.5) * pathAmount * 0.6;
            const radius = clamp(startRadius * (1 - (step + 1) / (waypointCount + 1) * 0.55)
                + (routeRandom() - 0.5) * pathAmount * 0.45, 0.2, 0.98);
            const x = centerX + Math.cos(angle) * radius * halfWidth;
            const y = centerY + Math.sin(angle) * radius * halfHeight;
            const nearest = reachable.reduce((best, node) => !best
                || Math.hypot(node.x - x, node.y - y) < Math.hypot(best.x - x, best.y - y) ? node : best, null);
            if (nearest !== target && nearest !== start && !waypoints.includes(nearest)) waypoints.push(nearest);
        }
        let route = [start];
        for (const waypoint of [...waypoints, target]) {
            if (!trees.has(waypoint.id)) trees.set(waypoint.id, shortestPaths(byId, waypoint, edgeCost));
            route.push(...tracePath(route.at(-1), waypoint, trees.get(waypoint.id), byId).slice(1));
        }
        const path = eraseLoops(route);
        const distances = [0];
        for (let i = 1; i < path.length; i += 1) distances.push(distances.at(-1) + edgeCost(path[i - 1], path[i]));
        const moveStart = MOVE_START + index / Math.max(1, starts.length - 1) * 0.025;
        const arrivals = distances.map((distance) => mix(moveStart, MOVE_END, distance / Math.max(1, distances.at(-1))));
        const candidate = { id: `search-${index}`, path, arrivals, totalCost: distances.at(-1),
            spawn: 0.015 + index * 0.01, fadeStart: 1, fadeEnd: 1 };
        plan.candidates.push(candidate);
    });
    resolveMeetings(plan, pathAmount, meetingRandom);
    return plan;
}

export function samplePersonSearch(plan, progress) {
    const p = clamp(Number(progress) || 0);
    const durationMs = plan.layout.settings.searchDuration * 1000;
    const reset = 1 - personTransition((p - 0.92) / 0.065, 0.065 * durationMs);
    const selected = personTransition((p - MOVE_END) / 0.055, 0.055 * durationMs);
    const pulse = p >= 0.70 && p < 0.82 ? Math.sin((p - 0.70) / 0.12 * Math.PI) ** 2 : 0;
    const actors = plan.candidates.map((candidate) => {
        const strength = smooth((p - candidate.spawn) / FADE_TIME)
            * (1 - smooth((p - candidate.fadeStart) / Math.max(1e-9, candidate.fadeEnd - candidate.fadeStart))) * reset;
        const travel = travelAt(plan, candidate, p);
        return { ...travel, id: candidate.id, strength,
            iconScale: candidate.id === plan.winnerId ? 1 + 0.22 * selected : 1,
            radiusScale: candidate.id === plan.winnerId ? 1 + 0.18 * selected + 0.12 * pulse : 1 };
    }).filter((actor) => actor.strength > 0.00001);
    const phase = p < MOVE_START ? 'Appearing' : p < MOVE_END ? 'Searching'
        : p < 0.92 ? 'Selected' : 'Resetting';
    return { actors, phase, progress: p, count: actors.length };
}

export function buildPersonSearchScene(settings, plan, progress) {
    const frame = samplePersonSearch(plan, progress);
    const diameter = Math.sqrt(settings.ellipseWidth * settings.ellipseHeight);
    const targets = new Map();
    const fields = frame.actors.map((actor) => {
        const same = actor.from === actor.to;
        const finalistArrival = actor.id === plan.winnerId && actor.to === plan.target;
        const winner = finalistArrival ? plan.candidates.find((candidate) => candidate.id === actor.id) : null;
        const arrivalDurationMs = winner && winner.arrivals.length > 1
            ? (winner.arrivals.at(-1) - winner.arrivals.at(-2)) * settings.searchDuration * 1000 : 0;
        const handover = same ? [[actor.from, 1]] : [
            [actor.from, 1 - smooth((actor.step - 0.12) / 0.43)],
            [actor.to, finalistArrival
                ? personTransition((actor.step - 0.48) / 0.44, arrivalDurationMs * 0.44)
                : smooth((actor.step - 0.48) / 0.44)]
        ];
        handover.forEach(([node, weight]) => {
            const strength = weight * actor.strength;
            if (strength <= 0) return;
            const shapes = referencePersonShapes(node, diameter, settings.personIconScale / 100 * actor.iconScale);
            for (const role of ['head', 'shoulders']) {
                const shape = shapes[role];
                if (strength > (targets.get(shape.id)?.strength ?? 0)) {
                    targets.set(shape.id, { shape, strength, role, pairId: node.id });
                }
            }
        });
        return { id: actor.id, kind: 'search', mode: 'person', x: actor.x, y: actor.y,
            radius: settings.fieldRadius * actor.radiusScale, strength: actor.strength };
    });
    const silhouettes = [...targets.values()].map(({ shape, strength, pairId }) => {
        const base = plan.layout.elementById.get(shape.id);
        return { ...shape, strength, pairId, cy: mix(base.cy, shape.cy, strength), rx: mix(base.rx, shape.rx, strength),
            ry: mix(base.ry, shape.ry, strength) };
    });
    const elements = plan.layout.elements.map((base) => {
        const target = targets.get(base.id);
        const influence = fields.reduce((value, field) => Math.max(value, field.strength * flatFalloff(
            Math.hypot(base.cx - field.x, base.cy - field.y), field.radius, settings.falloffCurve)), 0);
        let scale = 1 - (1 - settings.personMinimumScale / 100) * influence;
        for (const shape of silhouettes) {
            if (shape.id === base.id || target?.pairId === shape.pairId) continue;
            // Ease the last sliver of clearance back into the lattice as a pair disappears.
            const clearance = mix(1, nonContactScale(base, shape), smooth(shape.strength / 0.05));
            scale = Math.min(scale, clearance);
        }
        if (target) return { ...base, role: target.role, influence: target.strength,
            cy: mix(base.cy, target.shape.cy, target.strength),
            rx: mix(base.rx * scale, target.shape.rx, target.strength),
            ry: mix(base.ry * scale, target.shape.ry, target.strength) };
        return { ...base, role: 'neighbor', influence, rx: base.rx * scale, ry: base.ry * scale };
    });
    return { width: settings.width, height: settings.height, settings, elements, fields,
        field: fields[0], pitchX: plan.layout.pitchX, pitchY: plan.layout.pitchY, search: frame };
}
