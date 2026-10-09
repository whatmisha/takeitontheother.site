import { fileURLToPath } from 'node:url';
import { prepareCatalog } from './catalog.mjs';

const catalog = await prepareCatalog(fileURLToPath(new URL('../', import.meta.url)));
console.log(`Prepared ${catalog.assets.length} artworks (${catalog.assets.filter(asset => asset.kind === 'letter').length} letters).`);
