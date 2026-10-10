import { ASSETS, alternatives } from './assets.js';

const textureOf = (id, assets) => assets[id]?.textureId || 'unclassified';

export function letterTextureUsage(items, { excludeId, assets = ASSETS } = {}) {
    const usage = new Map();
    for (const item of items) {
        if (item.kind !== 'letter' || item.visible === false || item.id === excludeId) continue;
        const texture = textureOf(item.asset, assets);
        if (!usage.has(texture)) usage.set(texture, []);
        usage.get(texture).push(item);
    }
    return usage;
}

function shuffled(values, random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = random.int(0, i); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function assignLetterTextures(items, random, { preserve = new Set(), assets = ASSETS, choicesFor = alternatives } = {}) {
    const free = shuffled(items.filter(item => item.kind === 'letter' && item.visible !== false && !item.pinned && !preserve.has(item.id)), random);
    if (!free.length) return new Map();
    const reserved = letterTextureUsage(items.filter(item => item.pinned || preserve.has(item.id)), { assets });
    const choices = free.map(item => {
        const groups = new Map();
        for (const id of shuffled(choicesFor(item.letter), random)) {
            const texture = textureOf(id, assets);
            if (!groups.has(texture)) groups.set(texture, []);
            groups.get(texture).push(id);
        }
        if (!groups.size) throw new Error('No artwork for: ' + item.letter);
        return groups;
    });
    const textures = shuffled(new Set(choices.flatMap(groups => [...groups.keys()])), random);
    const start = 0, textureStart = free.length + 1, end = textureStart + textures.length;
    const graph = Array.from({ length: end + 1 }, () => []);
    function edge(from, to, cost) {
        const forward = { to, cost, capacity: 1, reverse: graph[to].length };
        graph[from].push(forward);
        graph[to].push({ to: from, cost: -cost, capacity: 0, reverse: graph[from].length - 1 });
        return forward;
    }
    const options = choices.map((groups, i) => {
        edge(start, i + 1, 0);
        return textures.flatMap((texture, j) => groups.has(texture) ? [{ texture, edge: edge(i + 1, textureStart + j, 0) }] : []);
    });
    // Min-cost matching can reassign earlier choices, avoiding greedy dead ends.
    // First maximize distinct textures, then minimize repeat counts (including pins).
    const total = items.filter(item => item.kind === 'letter').length, repeatCost = (total + 1) ** 3;
    textures.forEach((texture, j) => {
        const used = reserved.get(texture)?.length || 0;
        for (let slot = 0; slot < free.length; slot++) {
            const load = used + slot;
            edge(textureStart + j, end, (load ? repeatCost + load * (total + 1) : 0) + (texture === 'unclassified' ? 1 : 0));
        }
    });
    for (let flow = 0; flow < free.length; flow++) {
        const distance = Array(graph.length).fill(Infinity), previous = [];
        distance[start] = 0;
        for (let pass = 0; pass < graph.length - 1; pass++) {
            let changed = false;
            graph.forEach((edges, from) => edges.forEach((link, index) => {
                if (link.capacity && distance[from] + link.cost < distance[link.to]) {
                    distance[link.to] = distance[from] + link.cost;
                    previous[link.to] = [from, index]; changed = true;
                }
            }));
            if (!changed) break;
        }
        if (!previous[end]) throw new Error('Unable to assign letter textures.');
        for (let node = end; node !== start;) {
            const [from, index] = previous[node], link = graph[from][index];
            link.capacity--; graph[node][link.reverse].capacity++; node = from;
        }
    }
    return new Map(free.map((item, i) => {
        const texture = options[i].find(option => option.edge.capacity === 0).texture;
        return [item.id, random.pick(choices[i].get(texture))];
    }));
}

export function nextLetterVariant(item, items) {
    const choices = alternatives(item.letter), usage = letterTextureUsage(items, { excludeId: item.id });
    const ordered = [...choices.slice(choices.indexOf(item.asset) + 1), ...choices.slice(0, choices.indexOf(item.asset))];
    const count = id => usage.get(textureOf(id, ASSETS))?.length || 0;
    const least = Math.min(...ordered.map(count));
    return ordered.find(id => count(id) === least) || item.asset;
}
