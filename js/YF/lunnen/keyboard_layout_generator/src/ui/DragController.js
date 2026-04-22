/**
 * DragController ? owns all drag-reorder UX on the canvas.
 *
 * Two kinds of drag live here:
 *   - bindKey(rect, key)       ? reorder keys along a row and move them between rows
 *   - bindRowHandle(hit, rowId) ? drag a whole row up/down via grip handle
 *
 * Both share:
 *   - a 4 px start-threshold that separates click from drag,
 *   - a blue `<line>` drop indicator (one at a time),
 *   - Escape-to-cancel,
 *   - commit-on-pointerup via host.commitTemplate().
 *
 * The controller is DOM-aware but template-agnostic; everything it needs
 * is supplied via the `host` object:
 *
 *   host.getSvg()                       ? <svg> root (for drop-index queries)
 *   host.getTemplate()                  ? current template (mutable reference)
 *   host.getLayout()                    ? last computed layout (for backdrop dims)
 *   host.getPadding()                   ? backdrop padding (mm)
 *   host.findKey(template, id)          ? { key, row, list, index }
 *   host.commitTemplate(tpl, opts)      ? persist edits + push history
 *   host.onDragStart?(kind)             ? optional hook
 *   host.onDragEnd?(kind, committed)    ? optional hook
 *
 * Public state flag:
 *   shouldSuppressNextClick() ? true once after a key drag finishes, then
 *                               resets so the trailing click doesn't select.
 */

import { SVG_NS } from '../render/svgHelpers.js';

const DRAG_THRESHOLD_PX = 4;
const INDICATOR_COLOR   = '#4ea1ff';

export class DragController {
    constructor(host) {
        this.host = host;
        this._indicator       = null;   // <line> shown during any drag
        this._suppressClick   = false;  // true after key-drag commits
    }

    /** Consume-once flag: call after a key drag to suppress the trailing click. */
    shouldSuppressNextClick() {
        if (this._suppressClick) {
            this._suppressClick = false;
            return true;
        }
        return false;
    }

    /* ================================================================= */
    /*  Key drag (reorder; horizontal + cross-row)                     */
    /* ================================================================= */

    bindKey(rect, key) {
        rect.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const template = this.host.getTemplate();
            const found = this.host.findKey(template, key.id);
            if (!found || !found.list) return;
            // Only template `row.keys` (not arrow cluster / additional / numpad).
            if (!template.rows?.some((r) => r.keys === found.list)) return;
            // Single row, single key: nothing to reorder.
            if (template.rows.length < 2 && found.row.keys.length < 2) return;

            // Block native text selection / image-drag on the SVG while dragging.
            e.preventDefault();
            const ptrId = e.pointerId;
            try { rect.setPointerCapture(ptrId); } catch (_) {}

            const startX = e.clientX;
            const startY = e.clientY;
            const state = {
                active:   false,
                keyId:    key.id,
                row:      found.row, // real template row: `r.keys === found.list`
                oldIndex: found.index,
                rect
            };

            const self = this;
            const cleanup = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey);
                try {
                    if (rect.hasPointerCapture?.(ptrId)) {
                        rect.releasePointerCapture(ptrId);
                    }
                } catch (_) {}
                if (typeof window !== 'undefined' && window.getSelection) {
                    window.getSelection().removeAllRanges();
                }
            };

            function onMove(ev) {
                if (!state.active) {
                    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
                    state.active = true;
                    rect.style.cursor  = 'grabbing';
                    rect.style.opacity = '0.55';
                    rect.parentNode?.appendChild(rect);
                    self.host.onDragStart?.('key');
                    window.getSelection?.()?.removeAllRanges();
                }
                ev.preventDefault();
                self._updateKeyIndicator(state, ev);
            }

            function onUp(ev) {
                cleanup();
                if (!state.active) return;
                ev.stopPropagation();
                self._suppressClick = true;
                self._commitKeyDrag(state, ev, false);
            }

            function onKey(ev) {
                if (ev.key !== 'Escape') return;
                const was = state.active;
                cleanup();
                if (was) {
                    self._commitKeyDrag(state, null, true);
                }
            }

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup',   onUp);
            document.addEventListener('keydown',     onKey, true);
        });
    }

    /**
     * Picks a template row by pointer Y: row whose key band contains `clientY`,
     * or the vertically nearest row (e.g. when the pointer is in a gap between rows).
     */
    _rowAtPointForKeys(ev) {
        const svg = this.host.getSvg();
        if (!svg) return null;
        const rows = this.host.getTemplate()?.rows || [];
        let inside  = null;
        let nearest = null;
        let bestD   = Infinity;
        for (const r of rows) {
            if (!r?.keys?.length) continue;
            const rect = svg.querySelector(`rect[data-row-id="${CSS.escape(r.id)}"]`);
            if (!rect) continue;
            const box = rect.getBoundingClientRect();
            if (ev.clientY >= box.top && ev.clientY <= box.bottom) {
                inside = r;
                break;
            }
            const midY = box.top + box.height / 2;
            const d    = Math.abs(ev.clientY - midY);
            if (d < bestD) {
                bestD   = d;
                nearest = r;
            }
        }
        return inside || nearest;
    }

    _keyDropIndex(row, ev) {
        const svg = this.host.getSvg();
        if (!svg) return 0;
        let idx = 0;
        for (const k of row.keys) {
            const r = svg.querySelector(`rect[data-object-id="${CSS.escape(k.id)}"]`);
            if (!r) continue;
            const box = r.getBoundingClientRect();
            if (ev.clientX > box.left + box.width / 2) idx++;
            else break;
        }
        return idx;
    }

    _updateKeyIndicator(state, ev) {
        const svg = this.host.getSvg();
        if (!svg) return;

        const targetRow = this._rowAtPointForKeys(ev) || state.row;
        if (!targetRow?.keys?.length) return;

        const insertIdx = this._keyDropIndex(targetRow, ev);
        const keys      = targetRow.keys;

        let xMm;
        if (insertIdx === 0) {
            const first = svg.querySelector(`rect[data-object-id="${CSS.escape(keys[0].id)}"]`)
                || svg.querySelector(`rect[data-row-id="${CSS.escape(targetRow.id)}"]`);
            if (!first) return;
            xMm = +first.getAttribute('x') - 0.3;
        } else {
            const prev = svg.querySelector(`rect[data-object-id="${CSS.escape(keys[insertIdx - 1].id)}"]`);
            if (!prev) return;
            xMm = +prev.getAttribute('x') + +prev.getAttribute('width') + 0.3;
        }

        const ref = svg.querySelector(`rect[data-object-id="${CSS.escape(keys[0].id)}"]`)
            || svg.querySelector(`rect[data-row-id="${CSS.escape(targetRow.id)}"]`);
        if (!ref) return;
        const y1 = +ref.getAttribute('y') - 0.8;
        const y2 = +ref.getAttribute('y') + +ref.getAttribute('height') + 0.8;

        this._drawIndicator({ x1: xMm, y1, x2: xMm, y2 });
    }

    _commitKeyDrag(state, ev, cancel) {
        this._removeIndicator();
        if (state.rect) {
            state.rect.style.cursor  = 'grab';
            state.rect.style.opacity = '';
        }
        if (cancel || !ev) {
            this.host.onDragEnd?.('key', false);
            return;
        }

        const template = this.host.getTemplate();
        const found    = this.host.findKey(template, state.keyId);
        if (!found || !template.rows?.some((r) => r.keys === found.list)) {
            this.host.onDragEnd?.('key', false);
            return;
        }

        const targetRow = this._rowAtPointForKeys(ev);
        if (!targetRow) {
            this.host.onDragEnd?.('key', false);
            return;
        }

        const sourceRow = found.row;
        const newIndex  = this._keyDropIndex(targetRow, ev);
        const oldIndex  = found.index;

        if (sourceRow === targetRow) {
            const insertAt = newIndex > oldIndex ? newIndex - 1 : newIndex;
            if (insertAt === oldIndex) {
                this.host.onDragEnd?.('key', false);
                return;
            }
            const [moved] = sourceRow.keys.splice(oldIndex, 1);
            sourceRow.keys.splice(insertAt, 0, moved);
        } else {
            if (sourceRow.keys.length === 1) {
                this.host.onDragEnd?.('key', false);
                return;
            }
            const insertAt = Math.min(newIndex, targetRow.keys.length);
            const [moved] = sourceRow.keys.splice(oldIndex, 1);
            targetRow.keys.splice(insertAt, 0, moved);
        }

        this.host.commitTemplate(template, {
            selectKeyId:  state.keyId,
            historyLabel: `key:reorder:${state.keyId}`
        });
        this.host.onDragEnd?.('key', true);
    }

    /* ================================================================= */
    /*  Row drag (vertical, within template.rows)                        */
    /* ================================================================= */

    bindRowHandle(hit, rowId) {
        hit.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            const template = this.host.getTemplate();
            const rows = template?.rows || [];
            const oldIndex = rows.findIndex(r => r.id === rowId);
            if (oldIndex < 0 || rows.length <= 1) return;

            const ptrId = e.pointerId;
            try { hit.setPointerCapture(ptrId); } catch (_) {}

            const startX = e.clientX;
            const startY = e.clientY;
            const state = {
                active:   false,
                rowId,
                oldIndex,
                hit
            };

            const self = this;
            const cleanup = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey, true);
                try {
                    if (hit.hasPointerCapture?.(ptrId)) {
                        hit.releasePointerCapture(ptrId);
                    }
                } catch (_) {}
                if (typeof window !== 'undefined' && window.getSelection) {
                    window.getSelection().removeAllRanges();
                }
            };

            function onMove(ev) {
                if (!state.active) {
                    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
                    state.active = true;
                    hit.style.cursor = 'grabbing';
                    self.host.onDragStart?.('row');
                    window.getSelection?.()?.removeAllRanges();
                }
                ev.preventDefault();
                self._updateRowIndicator(state, ev);
            }

            function onUp(ev) {
                cleanup();
                if (!state.active) return;
                ev.stopPropagation();
                self._commitRowDrag(state, ev, false);
            }

            function onKey(ev) {
                if (ev.key !== 'Escape') return;
                const was = state.active;
                cleanup();
                if (was) {
                    self._commitRowDrag(state, null, true);
                }
            }

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup',   onUp);
            document.addEventListener('keydown',     onKey, true);
        });
    }

    _rowDropIndex(ev) {
        const svg = this.host.getSvg();
        if (!svg) return 0;
        const rows = this.host.getTemplate()?.rows || [];

        let idx = 0;
        for (const r of rows) {
            const rect = svg.querySelector(`[data-row-id="${CSS.escape(r.id)}"]`);
            if (!rect) continue;
            const box = rect.getBoundingClientRect();
            if (ev.clientY > box.top + box.height / 2) idx++;
            else break;
        }
        return idx;
    }

    _updateRowIndicator(state, ev) {
        const svg = this.host.getSvg();
        if (!svg) return;
        const rows = this.host.getTemplate()?.rows || [];
        const insertIdx = this._rowDropIndex(ev);

        let yMm;
        if (insertIdx === 0) {
            const firstRow = rows[0];
            const ref = svg.querySelector(`rect[data-row-id="${CSS.escape(firstRow.id)}"]`);
            if (!ref) return;
            yMm = +ref.getAttribute('y') - 0.6;
        } else {
            const prevRow = rows[insertIdx - 1];
            const ref = svg.querySelector(`rect[data-row-id="${CSS.escape(prevRow.id)}"]`);
            if (!ref) return;
            yMm = +ref.getAttribute('y') + +ref.getAttribute('height') + 0.6;
        }

        const layout = this.host.getLayout();
        const pad    = +this.host.getPadding() || 0;
        const x1 = (layout?.backdropX ?? 0) + pad;
        const x2 = (layout?.backdropX ?? 0) + (layout?.backdropW ?? 0) - pad;

        this._drawIndicator({ x1, y1: yMm, x2, y2: yMm });
    }

    _commitRowDrag(state, ev, cancel) {
        this._removeIndicator();
        if (state.hit) state.hit.style.cursor = 'grab';
        if (cancel || !ev) {
            this.host.onDragEnd?.('row', false);
            return;
        }

        const template = this.host.getTemplate();
        const rows = template.rows;
        const oldIndex = rows.findIndex(r => r.id === state.rowId);
        if (oldIndex < 0) {
            this.host.onDragEnd?.('row', false);
            return;
        }

        const newIndex = this._rowDropIndex(ev);
        const insertAt = newIndex > oldIndex ? newIndex - 1 : newIndex;
        if (insertAt === oldIndex) {
            this.host.onDragEnd?.('row', false);
            return;
        }

        const [moved] = rows.splice(oldIndex, 1);
        rows.splice(insertAt, 0, moved);

        this.host.commitTemplate(template, { historyLabel: `row:reorder:${state.rowId}` });
        this.host.onDragEnd?.('row', true);
    }

    /* ================================================================= */
    /*  Shared indicator                                                 */
    /* ================================================================= */

    _drawIndicator({ x1, y1, x2, y2 }) {
        const svg = this.host.getSvg();
        if (!svg) return;
        if (!this._indicator) {
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('stroke',           INDICATOR_COLOR);
            line.setAttribute('stroke-width',     '0.6');
            line.setAttribute('stroke-linecap',   'round');
            line.setAttribute('pointer-events',   'none');
            line.setAttribute('data-interactive', 'true');
            svg.appendChild(line);
            this._indicator = line;
        }
        this._indicator.setAttribute('x1', x1);
        this._indicator.setAttribute('y1', y1);
        this._indicator.setAttribute('x2', x2);
        this._indicator.setAttribute('y2', y2);
    }

    _removeIndicator() {
        if (this._indicator?.parentNode) {
            this._indicator.parentNode.removeChild(this._indicator);
        }
        this._indicator = null;
    }
}
