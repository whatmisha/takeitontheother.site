const GRAPHICS_TYPES = new Set(['graphics', 'icons', 'claim']);

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

const BUILT_IN_GRAPHICS = Object.freeze([
    Object.freeze({
        id: 'icons',
        name: 'Icons',
        isBuiltIn: true,
        svgContent: '',
        sizeMode: 'height',
        heightInModules: 3,
        widthInColumns: 4,
        alignment: 'left',
        surface: 'front',
        x: 1,
        row: 0,
        baselineOffset: 0,
        showBounds: false,
        visible: false,
        originalWidth: 204.0944882,
        originalHeight: 28.3464567,
        lockPosition: true
    }),
    Object.freeze({
        id: 'claim',
        name: 'Claim',
        isBuiltIn: true,
        svgContent: '',
        sizeMode: 'height',
        heightInModules: 3,
        widthInColumns: 4,
        alignment: 'left',
        surface: 'front',
        x: 7,
        row: 0,
        baselineOffset: 0,
        showBounds: false,
        visible: false,
        originalWidth: 186.2242584,
        originalHeight: 28.3464565,
        lockPosition: true
    })
]);

/**
 * Owns the editable object collections and their model-only lifecycle.
 * UI, history transactions and surface geometry deliberately stay outside.
 */
export class ObjectDocumentController {
    constructor({ now = () => Date.now(), includeBuiltIns = true } = {}) {
        this.now = now;
        this.textBlocks = [];
        this.graphicsBlocks = includeBuiltIns ? clone(BUILT_IN_GRAPHICS) : [];
        this.idSequence = 0;
    }

    replaceTextBlocks(blocks = []) {
        this.textBlocks = clone(Array.isArray(blocks) ? blocks : []);
        return this.textBlocks;
    }

    replaceGraphicsBlocks(blocks = []) {
        this.graphicsBlocks = clone(Array.isArray(blocks) ? blocks : []);
        return this.graphicsBlocks;
    }

    getTextBlock(id) {
        return this.textBlocks.find(block => block.id === id) || null;
    }

    getGraphicsBlock(id) {
        return this.graphicsBlocks.find(block => block.id === id) || null;
    }

    getBlock(type, id) {
        if (type === 'text') return this.getTextBlock(id);
        if (GRAPHICS_TYPES.has(type)) return this.getGraphicsBlock(id);
        return null;
    }

    getBlockNumber(blockId) {
        const block = this.getTextBlock(blockId);
        if (!block) return 1;
        const matching = this.textBlocks.filter(candidate => candidate.styleRef === block.styleRef);
        const index = matching.findIndex(candidate => candidate.id === blockId);
        return (index >= 0 ? index : 0) + 1;
    }

    getBuiltInGraphicsBlocks() {
        return this.graphicsBlocks.filter(block => block.isBuiltIn === true);
    }

    getCustomGraphicsBlocks() {
        return this.graphicsBlocks.filter(block => block.isBuiltIn !== true);
    }

    getVisibleGraphicsBlocks() {
        return this.graphicsBlocks.filter(block => block.visible !== false);
    }

    isBuiltInGraphics(blockOrId) {
        const block = typeof blockOrId === 'string'
            ? this.getGraphicsBlock(blockOrId)
            : blockOrId;
        return block?.isBuiltIn === true;
    }

    setBuiltInBlock(id, value) {
        const index = this.graphicsBlocks.findIndex(block => block.id === id);
        if (value == null) {
            if (index >= 0) this.graphicsBlocks.splice(index, 1);
            return null;
        }

        const next = { ...clone(value), id, isBuiltIn: true };
        if (index >= 0) this.graphicsBlocks.splice(index, 1, next);
        else this.graphicsBlocks.push(next);
        return next;
    }

    addTextBlock(overrides = {}) {
        const block = {
            id: this.nextId('text'),
            content: 'Lunnen — бренд компьютерной техники, придуманный в Яндексе. Это спутник, с которым просто. Просто решать задачи. Создавать новое. И изучать неизведанное.',
            styleRef: 'text',
            x: 1,
            row: 0,
            baselineOffset: 0,
            width: 3,
            alignment: 'left',
            textAlign: 'left',
            surface: 'front',
            showBounds: false,
            visible: true,
            alignmentMode: 'baseline',
            lockPosition: true,
            ...clone(overrides)
        };
        this.textBlocks.push(block);
        return block;
    }

    addGraphicsBlock({ svgContent, name, originalWidth, originalHeight, ...overrides } = {}) {
        const block = {
            id: this.nextId('graphics'),
            name: name || 'Graphic',
            isBuiltIn: false,
            svgContent: svgContent || '',
            sizeMode: 'height',
            heightInModules: 3,
            widthInColumns: 4,
            alignment: 'left',
            surface: 'front',
            x: 1,
            row: 0,
            baselineOffset: 0,
            showBounds: false,
            visible: true,
            originalWidth: originalWidth || 100,
            originalHeight: originalHeight || 100,
            lockPosition: true,
            ...clone(overrides)
        };
        this.graphicsBlocks.push(block);
        return block;
    }

    duplicate(type, blockId, transform = block => block) {
        const original = this.getBlock(type, blockId);
        if (!original) return null;

        const isText = type === 'text';
        const duplicate = {
            ...clone(original),
            id: this.nextId(isText ? 'text' : 'graphics'),
            x: Number(original.x || 0) + 1,
            visible: true,
            deleting: false,
            ...(isText ? {} : { isBuiltIn: false })
        };
        transform(duplicate);
        (isText ? this.textBlocks : this.graphicsBlocks).push(duplicate);
        return duplicate;
    }

    remove(type, blockId) {
        const blocks = type === 'text'
            ? this.textBlocks
            : (GRAPHICS_TYPES.has(type) ? this.graphicsBlocks : null);
        if (!blocks) return false;
        const index = blocks.findIndex(block => block.id === blockId);
        if (index < 0) return false;
        blocks.splice(index, 1);
        return true;
    }

    nextId(prefix) {
        const base = Number(this.now()) || Date.now();
        let id;
        do {
            const suffix = this.idSequence > 0 ? `-${this.idSequence}` : '';
            id = `${prefix}-${base}${suffix}`;
            this.idSequence += 1;
        } while (this.getTextBlock(id) || this.getGraphicsBlock(id));
        return id;
    }
}

export { BUILT_IN_GRAPHICS, GRAPHICS_TYPES };
