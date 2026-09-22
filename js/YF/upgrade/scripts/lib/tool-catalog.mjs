import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../../catalog/registry.js';

export const upgradeRoot = new URL('../../', import.meta.url);
export const readUpgrade = file => readFile(new URL(file, upgradeRoot), 'utf8');
export const readCatalog = async () => validateCatalog(JSON.parse(await readUpgrade('TOOL_CATALOG.json')));
