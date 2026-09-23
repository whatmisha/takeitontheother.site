/** Owns the single shared drag session exposed through host.textDragState. */
export class ObjectDragState {
    constructor(host) {
        this.host = host;
    }

    get current() {
        return this.host.textDragState;
    }

    is(kind) {
        return this.current?.isDragging === true && this.current.kind === kind;
    }

    start(kind, blockId, pointerOffset, details = {}) {
        this.host.textDragState = {
            kind,
            isDragging: true,
            blockId,
            pointerOffset,
            duplicated: false,
            moved: false,
            ...details
        };
        return this.current;
    }

    useDuplicate(blockId) {
        this.current.blockId = blockId;
        this.current.duplicated = true;
    }

    markMoved() {
        this.current.moved = true;
    }

    reset() {
        this.host.textDragState = {
            kind: null,
            isDragging: false,
            blockId: null,
            duplicated: false,
            moved: false
        };
    }
}
