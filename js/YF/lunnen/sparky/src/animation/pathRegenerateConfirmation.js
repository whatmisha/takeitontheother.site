export const REGENERATE_PATH_CONFIRMATION = Object.freeze({
    title: 'Regenerate path?',
    text: 'Your manual path edits will be lost.',
    confirmText: 'Regenerate',
    cancelText: 'Keep editing',
    danger: true
});

export const REGENERATE_IMPORTED_PATH_CONFIRMATION = Object.freeze({
    title: 'Replace imported path?',
    text: 'The imported SVG path and its closure edits will be lost.',
    confirmText: 'Regenerate',
    cancelText: 'Keep path',
    danger: true
});

export async function confirmPathRegeneration({
    manuallyEdited,
    imported = false,
    dialog = null,
    fallbackConfirm = null
} = {}) {
    if (!manuallyEdited) return true;
    const content = imported
        ? REGENERATE_IMPORTED_PATH_CONFIRMATION
        : REGENERATE_PATH_CONFIRMATION;
    if (dialog?.confirm) {
        return Boolean(await dialog.confirm(content));
    }
    return Boolean(fallbackConfirm?.(
        `${content.title}\n\n${content.text}`
    ));
}
