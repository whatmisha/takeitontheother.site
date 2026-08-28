export function shouldAutoplayPreset(preset = {}) {
    return preset?.focusMode === 'animate' || preset?.focusMode === 'bolid';
}

export function applyPresetPlaybackPolicy(playback, preset = {}) {
    if (!shouldAutoplayPreset(preset) || !playback) return false;
    playback.paused = false;
    playback.pausedByUser = false;
    playback.editing = false;
    playback.selectedEditorControl = null;
    return true;
}
