import { SeededRandom } from '../infra/framework/src/index.js';
import { alternatives, FORMS } from './assets.js';
import { clamp, lettersOf, normalize } from './document.js';

const radians = degrees => degrees * Math.PI / 180;

export class Silhouettes {
    constructor(metrics) {
        this.metrics = Object.fromEntries(Object.entries(metrics).map(([id, metric]) => [id, { ...metric, bits: metric.rows.map(row => parseInt(row, 16) >>> 0) }]));
    }

    dimensions(item, scene) {
        const [, , width, height] = this.metrics[item.asset].bounds;
        const size = item.scale * Math.min(scene.width, scene.height);
        return { width: size * width / Math.max(width, height), height: size * height / Math.max(width, height) };
    }

    box(item, scene) {
        const size = this.dimensions(item, scene), angle = radians(item.rotation);
        return { width: Math.abs(Math.cos(angle)) * size.width + Math.abs(Math.sin(angle)) * size.height,
            height: Math.abs(Math.sin(angle)) * size.width + Math.abs(Math.cos(angle)) * size.height };
    }

    constrain(item, scene) {
        const result = { ...item }, fraction = clamp(scene.overflow ?? 0, 0, 50) / 100;
        const retained = 1 - 2 * fraction, margin = Math.min(scene.width, scene.height) * .008 * retained;
        let box = this.box(result, scene);
        // Overflow is a fraction of the rotated bounds on each edge, not of the canvas.
        if (retained > 0) result.scale *= Math.min(1, (scene.width - margin * 2) / (box.width * retained), (scene.height - margin * 2) / (box.height * retained));
        box = this.box(result, scene);
        const insetX = box.width * (.5 - fraction) + margin, insetY = box.height * (.5 - fraction) + margin;
        result.x = clamp(result.x, insetX / scene.width, 1 - insetX / scene.width);
        result.y = clamp(result.y, insetY / scene.height, 1 - insetY / scene.height);
        return result;
    }

    contains(item, scene, x, y) {
        if (item.visible === false) return false;
        const size = this.dimensions(item, scene), angle = radians(item.rotation);
        const dx = x - item.x * scene.width, dy = y - item.y * scene.height;
        const u = (dx * Math.cos(angle) + dy * Math.sin(angle)) / size.width + .5;
        const v = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / size.height + .5;
        return u >= 0 && u < 1 && v >= 0 && v < 1 && Boolean(this.metrics[item.asset].bits[Math.floor(v * 32)] & (1 << Math.floor(u * 32)));
    }
}

// A coarse alpha field lets neighboring silhouettes share their empty corners.
// Ordered letters stay near row anchors; decorative forms search the remaining space.
class Coverage {
    constructor(scene, geometry) {
        this.scene = scene; this.geometry = geometry;
        this.unit = Math.min(scene.width, scene.height) / 76;
        this.width = Math.ceil(scene.width / this.unit); this.height = Math.ceil(scene.height / this.unit);
        this.counts = new Uint8Array(this.width * this.height);
    }

    cells(item) {
        const { scene, geometry, unit } = this;
        const box = geometry.box(item, scene), size = geometry.dimensions(item, scene);
        const cx = item.x * scene.width, cy = item.y * scene.height;
        const angle = radians(item.rotation), cos = Math.cos(angle), sin = Math.sin(angle);
        const bits = geometry.metrics[item.asset].bits, result = [];
        const minX = Math.max(0, Math.floor((cx - box.width / 2) / unit)), maxX = Math.min(this.width, Math.ceil((cx + box.width / 2) / unit));
        const minY = Math.max(0, Math.floor((cy - box.height / 2) / unit)), maxY = Math.min(this.height, Math.ceil((cy + box.height / 2) / unit));
        for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
            const dx = (x + .5) * unit - cx, dy = (y + .5) * unit - cy;
            const u = (dx * cos + dy * sin) / size.width + .5, v = (-dx * sin + dy * cos) / size.height + .5;
            if (u >= 0 && u < 1 && v >= 0 && v < 1 && (bits[Math.floor(v * 32)] & (1 << Math.floor(u * 32)))) result.push(y * this.width + x);
        }
        return result;
    }

    add(cells, delta) { for (const index of cells) this.counts[index] += delta; }
    score(cells, overlap = 1.15) {
        let score = 0;
        for (const index of cells) score += this.counts[index] ? -overlap * this.counts[index] : 1;
        return score;
    }
}

function rowGroups(items, count) {
    const rows = []; let offset = 0;
    for (let row = 0; row < count; row++) {
        const size = Math.ceil((items.length - offset) / (count - row));
        rows.push(items.slice(offset, offset + size)); offset += size;
    }
    return rows;
}

function arrangeLetters(items, scene, geometry, random) {
    if (!items.length) return [];
    const ratios = new Map(items.map(item => { const box = geometry.box({ ...item, scale: 1 }, scene); return [item.id, box.width / box.height]; }));
    let best = null;
    for (let count = 1; count <= Math.min(items.length, 12); count++) {
        const rows = rowGroups(items, count);
        const heights = rows.map(row => Math.min(scene.height / count, scene.width / row.reduce((sum, item) => sum + ratios.get(item.id), 0)));
        const area = rows.reduce((sum, row, i) => sum + heights[i] ** 2 * row.reduce((s, item) => s + ratios.get(item.id), 0), 0);
        const score = area * random.float(.96, 1.04);
        if (!best || score > best.score) best = { rows, heights, score };
    }
    const result = [], density = scene.fill / 100;
    best.rows.forEach((row, rowIndex) => {
        const rowHeight = scene.height / best.rows.length;
        const sum = row.reduce((total, item) => total + ratios.get(item.id), 0);
        let cursor = 0;
        row.forEach(item => {
            const cellWidth = scene.width * ratios.get(item.id) / sum;
            const anchor = { x: (cursor + cellWidth / 2) / scene.width,
                y: (rowIndex + .5) / best.rows.length, dx: cellWidth / scene.width, dy: 1 / best.rows.length };
            cursor += cellWidth;
            const unit = geometry.box({ ...item, scale: 1 }, scene);
            const scale = Math.min(cellWidth / unit.width, rowHeight / unit.height) * random.float(1.04, 1.17) * density;
            const placed = item.pinned ? item : geometry.constrain({ ...item, ...anchor, scale,
                x: anchor.x + random.float(-.035, .035) * anchor.dx, y: anchor.y + random.float(-.06, .06) * anchor.dy }, scene);
            result.push({ item: placed, anchor, maxScale: scale * 1.28 });
        });
    });
    return result;
}

export function generate(settings, geometry, { seed = settings.seed, reroll = true } = {}) {
    const scene = normalize({ ...settings, seed });
    const missing = [...new Set(lettersOf(scene.text))].filter(letter => !alternatives(letter).length);
    if (missing.length) throw new Error('No artwork for: ' + missing.join(', ') + '. Add these letters to the library.');
    const random = new SeededRandom(seed), assetRandom = random.fork('assets');
    const old = new Map(scene.items.map(item => [item.id, item]));
    const letters = Array.from(lettersOf(scene.text), (letter, index) => {
        const id = 'letter-' + index, previous = old.get(id);
        if (previous?.letter === letter) {
            if (previous.visible === false) return { ...previous };
            if (previous.pinned) return geometry.constrain(previous, scene);
            if (!reroll) return { ...previous, rotation: random.float(-scene.rotationRange, scene.rotationRange) };
        }
        return { id, kind: 'letter', letter, index, asset: assetRandom.pick(alternatives(letter)), rotation: random.float(-scene.rotationRange, scene.rotationRange), x: .5, y: .5, scale: .5, pinned: false, visible: true };
    });
    if (scene.shuffle) for (let i = letters.length - 1; i > 0; i--) {
        const j = random.int(0, i); [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const count = scene.formsEnabled && FORMS.length ? scene.formCount : 0;
    const formPool = [...FORMS], formRandom = random.fork('forms');
    for (let i = formPool.length - 1; i > 0; i--) {
        const j = formRandom.int(0, i); [formPool[i], formPool[j]] = [formPool[j], formPool[i]];
    }
    const forms = Array.from({ length: count }, (_, index) => {
        const id = 'form-' + index, previous = old.get(id);
        if (previous?.visible === false) return { ...previous };
        if (previous?.pinned) return geometry.constrain(previous, scene);
        if (previous && !reroll) return { ...previous };
        return { id, kind: 'form', letter: '', index, asset: formPool[index % formPool.length].id,
            rotation: random.float(-scene.rotationRange, scene.rotationRange), x: .5, y: .5, scale: .4, pinned: false, visible: true };
    });
    const field = new Coverage(scene, geometry), placed = arrangeLetters(letters.filter(item => item.visible !== false), scene, geometry, random);
    for (const form of forms.filter(item => item.pinned && item.visible !== false)) field.add(field.cells(form), 1);
    for (const entry of placed) { entry.cells = field.cells(entry.item); field.add(entry.cells, 1); }
    for (let pass = 0; pass < 7; pass++) for (const entry of placed) {
        if (entry.item.pinned) continue;
        field.add(entry.cells, -1);
        const penalty = item => ((item.x - entry.anchor.x) / entry.anchor.dx) ** 2 * 700 + ((item.y - entry.anchor.y) / entry.anchor.dy) ** 2 * 950;
        let best = entry.item, cells = entry.cells, score = field.score(cells) - penalty(best);
        for (let trial = 0; trial < 12; trial++) {
            const candidate = geometry.constrain({ ...entry.item,
                x: clamp(entry.item.x + random.float(-.095, .095) * entry.anchor.dx, entry.anchor.x - .22 * entry.anchor.dx, entry.anchor.x + .22 * entry.anchor.dx),
                y: clamp(entry.item.y + random.float(-.10, .10) * entry.anchor.dy, entry.anchor.y - .2 * entry.anchor.dy, entry.anchor.y + .2 * entry.anchor.dy),
                scale: Math.min(entry.maxScale, entry.item.scale * random.float(.96, 1.08)),
                rotation: clamp(entry.item.rotation + random.float(-scene.rotationRange / 6, scene.rotationRange / 6), -scene.rotationRange, scene.rotationRange) }, scene);
            const nextCells = field.cells(candidate), nextScore = field.score(nextCells) - penalty(candidate);
            if (nextScore > score) { best = candidate; cells = nextCells; score = nextScore; }
        }
        entry.item = best; entry.cells = cells; field.add(cells, 1);
    }
    const meanScale = placed.length ? placed.reduce((sum, entry) => sum + entry.item.scale, 0) / placed.length : .7;
    const packedForms = forms.map(form => {
        if (form.pinned || form.visible === false) return form;
        let best, bestCells, bestScore = -Infinity;
        for (let trial = 0; trial < 320; trial++) {
            const candidate = geometry.constrain({ ...form, x: random.next(), y: random.next(),
                rotation: random.float(-scene.rotationRange, scene.rotationRange), scale: meanScale * random.float(.35, 1.02) * scene.fill / 100 }, scene);
            const cells = field.cells(candidate), score = field.score(cells, 2.5);
            if (score > bestScore) { best = candidate; bestCells = cells; bestScore = score; }
        }
        field.add(bestCells, 1); return best;
    });
    const generated = [...packedForms, ...placed.map(entry => entry.item), ...letters.filter(item => item.visible === false)];
    const byId = new Map(generated.map(item => [item.id, item]));
    const previousOrder = scene.items.flatMap(item => byId.has(item.id) ? [byId.get(item.id)] : []);
    const previousIds = new Set(previousOrder.map(item => item.id));
    scene.items = [...generated.filter(item => !previousIds.has(item.id) && item.kind === 'form'), ...previousOrder,
        ...generated.filter(item => !previousIds.has(item.id) && item.kind === 'letter')];
    return normalize(scene);
}

export function changeFormat(settings, format, geometry) {
    const next = normalize({ ...settings, format });
    next.items = next.items.map(item => geometry.constrain(item, next));
    return generate(next, geometry, { reroll: false });
}
