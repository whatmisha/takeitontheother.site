// Old acceptance/source reports are immutable evidence. Resolve their former
// app-root paths at the filesystem boundary, without rewriting report contents.
const historicalToolRoots = new Set([
    'sparky', 'grid_generator', 'label_generator', 'keyboarder',
    'wordplayer', 'dither', 'wander_bender', 'pulsar_coder', 'rays_pattern_generator'
]);

export function resolveToolPath(relativePath) {
    const first = relativePath.split('/')[0];
    return historicalToolRoots.has(first) ? `tools/${relativePath}` : relativePath;
}
