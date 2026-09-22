// Acquisition only: no npm install/lifecycle scripts, no writes outside upgrade.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';

const root = new URL('../framework/vendor/p5/', import.meta.url);
const pins = [
    ['1.4.0', 'sha512-U888W2ChcIzPhRhnv4FkNhaa4f5BDIWZfLhzvx9ZrQ5KtkZr/+o1UPIicV3yWTRy0HEG23NviHyDR3kgjaJ9wA=='],
    ['1.7.0', 'sha512-qrbT/44Dwm63ZtOKX/mp61pw+5yj6ijYLOmRv7p6zcfjbo83Vb0gVFEvW0kTLFu7hceWCig0HONo9F1bSlqbsQ=='],
    ['1.9.0', 'sha512-+5/hz0ZokCDf7BMMAeemE7FIo7gFZK7ImL62acHLXZwerGjqj+171bnaAWj4aCFCx6fwysAr2U7/AKuPyPhehA==']
];
const sha256 = data => createHash('sha256').update(data).digest('hex');
if (process.argv.includes('--check')) {
    const manifest = JSON.parse(await readFile(new URL('MANIFEST.json', root), 'utf8'));
    assert.deepEqual(manifest.packages.map(p => [p.version, p.integrity]), pins);
    for (const pkg of manifest.packages) for (const file of pkg.files) {
        assert.match(file.path, /^[a-zA-Z0-9./_-]+$/);
        assert.ok(!file.path.split('/').includes('..'));
        const target = new URL(`${pkg.version}/${file.path}`, root);
        assert.ok((await lstat(target)).isFile(), 'No symlink/vendor substitution');
        assert.equal(sha256(await readFile(target)), file.sha256, `${pkg.version}/${file.path}`);
    }
    console.log('Pinned p5 1.4.0 / 1.7.0 / 1.9.0 + sound: local hashes verified.');
} else {
    assert.ok(process.argv.includes('--acquire'), 'Use --check or --acquire');
    try { await lstat(root); throw Error('Vendor directory already exists; refusing overwrite'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const packages = [];
    // Prepare and verify every archive in memory before creating any file.
    for (const [version, integrity] of pins) {
        const tarball = `https://registry.npmjs.org/p5/-/p5-${version}.tgz`;
        const response = await fetch(tarball);
        assert.ok(response.ok, `${tarball}: ${response.status}`);
        const archive = Buffer.from(await response.arrayBuffer());
        assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, integrity);
        const paths = ['lib/p5.js', 'license.txt', 'package.json', 'README.md'];
        if (version !== '1.4.0') paths.push('lib/p5.min.js');
        if (version === '1.9.0') paths.push('lib/addons/p5.sound.js', 'lib/addons/p5.sound.min.js');
        const files = paths.map(path => {
            const data = execFileSync('tar', ['-xOzf', '-', `package/${path}`], { input: archive, maxBuffer: 12 * 1024 * 1024 });
            return { path, bytes: data.length, sha256: sha256(data), data };
        });
        assert.equal(JSON.parse(files.find(f => f.path === 'package.json').data).version, version);
        packages.push({ version, integrity, tarball, license: 'LGPL-2.1', files });
    }
    for (const pkg of packages) for (const file of pkg.files) {
        const target = new URL(`${pkg.version}/${file.path}`, root);
        await mkdir(new URL('./', target), { recursive: true });
        await writeFile(target, file.data, { flag: 'wx' });
    }
    const manifest = { schemaVersion: 1, note: 'Unmodified official p5 packages; readable source and license accompany minified builds. Each app retains its original version.', packages: packages.map(pkg => ({ ...pkg, files: pkg.files.map(({ data, ...file }) => file) })) };
    await writeFile(new URL('MANIFEST.json', root), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    console.log(`Acquired ${packages.length} pinned versions inside framework/vendor/p5/.`);
}
