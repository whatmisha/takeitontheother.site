/**
 * Centralised timing and breakpoint constants.
 *
 * Keep all magic numbers related to throttling, debouncing,
 * history sizes, and viewport breakpoints in one place so they can
 * be tuned without grepping the codebase.
 */

/** Renderer update throttle (matches a single 60fps frame). */
export const RENDER_THROTTLE_MS = 16;

/** Debounce for window resize before resizing the renderer. */
export const RESIZE_DEBOUNCE_MS = 100;

/** Debounce for auto-snapshot writes into the history manager. */
export const HISTORY_AUTOSNAPSHOT_DEBOUNCE_MS = 250;

/** Maximum number of states retained by the history manager. */
export const HISTORY_MAX_SIZE = 50;

/** Width below which the UI switches to the mobile-only layout. */
export const MOBILE_BREAKPOINT_PX = 768;

/** Width below which a tablet-style layout is considered. */
export const TABLET_BREAKPOINT_PX = 1024;

