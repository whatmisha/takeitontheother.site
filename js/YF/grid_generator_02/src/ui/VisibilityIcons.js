/** Existing Objects visibility glyphs shared by the two navigator lists. */
export const EYE_VISIBLE_PATHS = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
export const EYE_HIDDEN_PATHS = `${EYE_VISIBLE_PATHS}<line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
export const EYE_VISIBLE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${EYE_VISIBLE_PATHS}</svg>`;
export const EYE_HIDDEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${EYE_HIDDEN_PATHS}</svg>`;
