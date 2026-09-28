export const BUILT_IN_TEXT_STYLES = Object.freeze([
    { id: 'headline', name: 'Headline' }, { id: 'text', name: 'Text' },
    { id: 'caption', name: 'Caption' }, { id: 'lunnenDisplay', name: 'Lunnen Display' }
]);
export const MAX_CUSTOM_TEXT_STYLES = 64;
export const allTextStyles = settings => [
    ...BUILT_IN_TEXT_STYLES, ...(settings.get('customTextStyles') || [])
];

export function uniqueStyleName(base, styles) {
    const names = new Set(styles.map(style => style.name.toLocaleLowerCase()));
    const stem = base.slice(0, 70);
    let name = stem, index = 2;
    while (names.has(name.toLocaleLowerCase())) name = `${stem} ${index++}`;
    return name;
}

/** Check references as well as the shape of each definition before importing. */
export function assertTextStyleReferences(document) {
    const customs = document.typography?.customStyles || [];
    const ids = new Set(BUILT_IN_TEXT_STYLES.map(style => style.id));
    const names = new Set(BUILT_IN_TEXT_STYLES.map(style => style.name.toLocaleLowerCase()));
    for (const style of customs) {
        if (ids.has(style.id)) throw new Error(`Duplicate text style ID: ${style.id}`);
        if (!style.name.trim() || names.has(style.name.trim().toLocaleLowerCase())) {
            throw new Error(`Text style names must be non-empty and unique: ${style.name}`);
        }
        ids.add(style.id);
        names.add(style.name.trim().toLocaleLowerCase());
    }
    for (const text of document.texts || []) {
        if (!ids.has(text.style)) throw new Error(`Missing text style: ${text.style}`);
    }
}
