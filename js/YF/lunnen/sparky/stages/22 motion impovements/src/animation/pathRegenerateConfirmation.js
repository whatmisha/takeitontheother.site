export const REGENERATE_PATH_CONFIRMATION = Object.freeze({
    title: 'Regenerate path?',
    text: 'Your manual path edits will be lost.',
    confirmText: 'Regenerate',
    cancelText: 'Keep editing',
    danger: true
});

export async function confirmPathRegeneration({
    manuallyEdited,
    dialog = null,
    fallbackConfirm = null
} = {}) {
    if (!manuallyEdited) return true;
    if (dialog?.confirm) {
        return Boolean(await dialog.confirm(REGENERATE_PATH_CONFIRMATION));
    }
    return Boolean(fallbackConfirm?.(
        `${REGENERATE_PATH_CONFIRMATION.title}\n\n${REGENERATE_PATH_CONFIRMATION.text}`
    ));
}
