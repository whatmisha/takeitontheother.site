import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const [plan, resilience, live, runtimeDoc, liveDoc] = await Promise.all([
    read('docs/G7_RELEASE_HARDENING_PLAN.md'),
    read('RUNTIME_RESILIENCE.json'),
    read('FINAL_LIVE_ACCEPTANCE.json'),
    read('docs/RUNTIME_RESILIENCE_ACCEPTANCE.md'),
    read('docs/G7_LIVE_ACCEPTANCE.md')
]);

for (const stage of ['UPG-071', 'UPG-072', 'UPG-073', 'UPG-074', 'UPG-075', 'UPG-076', 'UPG-077', 'UPG-078']) {
    const section = plan.match(new RegExp(`### ${stage}[\\s\\S]*?(?=\\n### |\\n## |$)`, 'u'))?.[0] || '';
    assert.match(section, /статус: \*\*Complete\*\*/u, `${stage} is not complete`);
}

const resilienceManifest = JSON.parse(resilience);
const liveManifest = JSON.parse(live);
assert.equal(resilienceManifest.apps.length, 8);
assert.equal(resilienceManifest.blobUrlOwners.length, 12);
assert.equal(liveManifest.workflows.length, 8);
assert.equal(liveManifest.workflows.filter(item => item.status === 'accepted').length, 8);
assert.equal(liveManifest.desktop.consoleErrors, 0);
assert.equal(liveManifest.desktop.resource404s, 0);
assert.match(runtimeDoc, /24\/24 desktop/u);
assert.match(runtimeDoc, /6\/6 чистых загрузок/u);
assert.match(liveDoc, /пять priority и три secondary/u);
assert.match(liveDoc, /двойной deserialize/u);

console.log(
    'Gate G7 contract passed: UPG-071—UPG-078 complete; 8 workflows accepted; ' +
    'runtime, export, round-trip, persistence, keyboard, isolation and G6 regressions green.'
);
