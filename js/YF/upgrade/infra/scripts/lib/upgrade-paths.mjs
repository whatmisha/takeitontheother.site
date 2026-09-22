// Old acceptance/source reports are immutable evidence. Resolve their former
// app-root paths at the filesystem boundary, without rewriting report contents.
const infrastructureRoots = new Set(['baselines', 'catalog', 'docs', 'extracted', 'framework', 'qa', 'releases', 'scripts']);

export function resolveToolPath(relativePath) {
    if (relativePath.startsWith('tools/')) return relativePath.slice(6);
    const first = relativePath.split('/')[0];
    return infrastructureRoots.has(first) || /^[A-Z_]+\.json$/.test(first) ? `infra/${relativePath}` : relativePath;
}
