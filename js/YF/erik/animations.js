import { CrawlRenderer, loadFont } from './renderer.js?v=2';
import { framePlan } from './model.js';
// A type owns its renderer and duration calculation; project files store its stable ID.
const types = Object.freeze({ crawl: { id: 'crawl', label: 'Crawl', load: loadFont, createRenderer: () => new CrawlRenderer(), plan: framePlan } });
export function animationType(id = 'crawl') {
    if (!Object.hasOwn(types, id)) throw new Error(`Unsupported animation type: ${id}`);
    return types[id];
}
