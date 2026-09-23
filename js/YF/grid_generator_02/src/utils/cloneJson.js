/** Deep-clones JSON-compatible state while preserving the format's old semantics. */
export function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
