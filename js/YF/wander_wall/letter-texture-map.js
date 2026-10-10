// Visually checked material triples in the existing alphabet, not a rule for new sets.
const triples = [
    ['blue', 'metal', 'white'],
    ['deep_blue', 'orange', 'copper'],
    ['iridescent', 'orange_coral', 'green_pixels'],
    ['glitch', 'pink_fur', 'lime'],
    ['glitchy', 'pink_patch', 'chrome'],
    ['green_balloon', 'purple_fur', 'pixels'],
    ['lime_chrome', 'purple_glass', 'white_fur'],
    ['lime_fur', 'soft', 'quartz'],
    ['metal', 'white', 'opalescent_crystal'],
    ['orange', 'copper', 'blue'],
    ['orange_coral', 'green_pixels', 'deep_blue'],
    ['pink_fur', 'lime', 'iridescent'],
    ['pink_patch', 'chrome', 'glitch'],
    ['purple_fur', 'pixels', 'glitchy'],
    ['purple_glass', 'white_fur', 'green_balloon'],
    ['soft', 'quartz', 'lime_chrome'],
    ['white', 'opalescent_crystal', 'lime_fur'],
    ['copper', 'blue', 'metal'],
    ['green_pixels', 'deep_blue', 'orange'],
    ['lime', 'iridescent', 'orange_coral'],
    ['chrome', 'glitch', 'pink_fur'],
    ['pixels', 'glitchy', 'pink_patch'],
    ['white_fur', 'green_balloon', 'purple_fur'],
    ['quartz', 'lime_chrome', 'purple_glass'],
    ['opalescent_crystal', 'lime_fur', 'soft']
];
const setOffsets = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 5, 6: 6 };

export const LETTER_TEXTURES = {};
for (const [set, offset] of Object.entries(setOffsets)) {
    for (let index = 0; index < 26; index++) {
        triples[(index + offset) % triples.length].forEach((texture, variant) => {
            LETTER_TEXTURES[`${String.fromCharCode(65 + index)}-${set}-${variant + 1}`] = texture;
        });
    }
}
// These originals depart from their set's material sequence.
Object.assign(LETTER_TEXTURES, {
    'A-2-1': 'blue', 'Y-2-1': 'deep_blue',
    'A-3-1': 'blue', 'X-3-1': 'iridescent'
});
