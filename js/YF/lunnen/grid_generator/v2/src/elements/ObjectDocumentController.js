import { cloneJson } from '../utils/cloneJson.js';
import { DEFAULT_ROOT_PLANE_ID } from '../surfaces/PlaneDefinition.js';

const GRAPHICS_TYPES = new Set(['graphics', 'icons', 'claim']);

const clone = cloneJson;

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
        x: 7,
        row: 0,
        baselineOffset: 0,
        showBounds: false,
        visible: false,
        originalWidth: 186.2242584,
        originalHeight: 28.3464565,
        lockPosition: true
    }),
    Object.freeze({
        id: 'claim2026',
        name: 'Claim 2026',
        isBuiltIn: true,
        svgContent: '',
        sizeMode: 'height',
        heightInModules: 3,
        widthInColumns: 4,
        alignment: 'left',
        x: 4,
        row: 0,
        baselineOffset: 0,
        showBounds: false,
        visible: false,
        originalWidth: 202.0335404,
        originalHeight: 32.7559817,
        lockPosition: true
    })
]);

/**
 * Owns the editable object collections and their model-only lifecycle.
 * UI, history transactions and surface geometry deliberately stay outside.
 */
export class ObjectDocumentController {
    /**
     * New objects land on the net's root plane, which the document reports —
     * the controller never assumes a particular plane id.
     */
    constructor({
        now = () => Date.now(),
        includeBuiltIns = true,
        getRootPlaneId = () => DEFAULT_ROOT_PLANE_ID
    } = {}) {
        this.now = now;
        this.getRootPlaneId = getRootPlaneId;
        this.textBlocks = [];
        this.graphicsBlocks = includeBuiltIns
            ? clone(BUILT_IN_GRAPHICS).map(block => ({ ...block, planeId: getRootPlaneId() }))
            : [];
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

    replaceDocument({ textBlocks = [], graphicsBlocks = [] } = {}) {
        this.replaceTextBlocks(textBlocks);
        this.replaceGraphicsBlocks(graphicsBlocks);
        this.normalizeLayerOrder();
        return this.createSnapshot();
    }

    createSnapshot() {
        return clone({
            textBlocks: this.textBlocks,
            graphicsBlocks: this.graphicsBlocks
        });
    }

    restoreSnapshot(snapshot = {}) {
        return this.replaceDocument(snapshot);
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

    getLayerEntries({ frontToBack = false } = {}) {
        this.normalizeLayerOrder();
        const entries = [
            ...this.textBlocks.map(block => ({ type: 'text', block })),
            ...this.graphicsBlocks.map(block => ({ type: 'graphics', block }))
        ].sort((left, right) => left.block.layerIndex - right.block.layerIndex);
        return frontToBack ? entries.reverse() : entries;
    }

    normalizeLayerOrder() {
        const entries = [
            ...this.textBlocks.map((block, sourceIndex) => ({
                block,
                fallback: sourceIndex
            })),
            ...this.graphicsBlocks.map((block, sourceIndex) => ({
                block,
                fallback: this.textBlocks.length + sourceIndex
            }))
        ];
        entries.sort((left, right) => {
            const leftLayer = Number(left.block.layerIndex);
            const rightLayer = Number(right.block.layerIndex);
            const leftValid = Number.isFinite(leftLayer) && leftLayer >= 0;
            const rightValid = Number.isFinite(rightLayer) && rightLayer >= 0;
            if (leftValid && rightValid && leftLayer !== rightLayer) return leftLayer - rightLayer;
            if (leftValid !== rightValid) return leftValid ? -1 : 1;
            return left.fallback - right.fallback;
        });
        entries.forEach(({ block }, layerIndex) => { block.layerIndex = layerIndex; });
        return entries;
    }

    moveLayer(type, blockId, direction) {
        const entries = this.getLayerEntries();
        const normalizedType = type === 'text' ? 'text' : 'graphics';
        const index = entries.findIndex(entry => (
            entry.type === normalizedType && entry.block.id === blockId
        ));
        const offset = direction === 'forward' ? 1 : (direction === 'backward' ? -1 : 0);
        const targetIndex = index + offset;
        if (index < 0 || !offset || targetIndex < 0 || targetIndex >= entries.length) return false;
        [entries[index], entries[targetIndex]] = [entries[targetIndex], entries[index]];
        entries.forEach((entry, layerIndex) => { entry.block.layerIndex = layerIndex; });
        return true;
    }

    reorderLayer(source, target, placement = 'before') {
        const entries = this.getLayerEntries({ frontToBack: true });
        const normalizeType = type => type === 'text' ? 'text' : 'graphics';
        const sourceIndex = entries.findIndex(entry => (
            entry.type === normalizeType(source?.type) && entry.block.id === source?.id
        ));
        const targetIndex = entries.findIndex(entry => (
            entry.type === normalizeType(target?.type) && entry.block.id === target?.id
        ));
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
        const [moved] = entries.splice(sourceIndex, 1);
        const adjustedTarget = entries.findIndex(entry => (
            entry.type === normalizeType(target?.type) && entry.block.id === target?.id
        ));
        const insertAt = placement === 'after' ? adjustedTarget + 1 : adjustedTarget;
        entries.splice(insertAt, 0, moved);
        entries.forEach((entry, index) => {
            entry.block.layerIndex = entries.length - 1 - index;
        });
        return true;
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

    addTextBlock(overrides = {}) {
        const layerIndex = this.getLayerEntries().length;
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
            planeId: this.getRootPlaneId(),
            showBounds: false,
            visible: true,
            alignmentMode: 'baseline',
            lockPosition: true,
            layerIndex,
            ...clone(overrides)
        };
        this.textBlocks.push(block);
        return block;
    }

    addGraphicsBlock({ svgContent, name, originalWidth, originalHeight, ...overrides } = {}) {
        const layerIndex = this.getLayerEntries().length;
        const block = {
            id: this.nextId('graphics'),
            name: name || 'Graphic',
            isBuiltIn: false,
            svgContent: svgContent || '',
            sizeMode: 'height',
            heightInModules: 3,
            widthInColumns: 4,
            alignment: 'left',
            planeId: this.getRootPlaneId(),
            x: 1,
            row: 0,
            baselineOffset: 0,
            showBounds: false,
            visible: true,
            originalWidth: originalWidth || 100,
            originalHeight: originalHeight || 100,
            lockPosition: true,
            layerIndex,
            ...clone(overrides)
        };
        this.graphicsBlocks.push(block);
        return block;
    }

    duplicate(type, blockId, transform = block => block) {
        const original = this.getBlock(type, blockId);
        if (!original) return null;

        return this.insertCopy(type, original, transform);
    }

    insertCopy(type, source, transform = block => block) {
        const isText = type === 'text';
        if (!source || (!isText && !GRAPHICS_TYPES.has(type))) return null;

        this.normalizeLayerOrder();
        const liveSource = this.getBlock(type, source.id);
        const layerIndex = liveSource === source
            ? Number(source.layerIndex) + 0.5
            : this.getLayerEntries().length;
        const duplicate = {
            ...clone(source),
            id: this.nextId(isText ? 'text' : 'graphics'),
            x: Number(source.x || 0) + 1,
            visible: true,
            deleting: false,
            layerIndex,
            ...(isText ? {} : { isBuiltIn: false })
        };
        transform(duplicate);
        (isText ? this.textBlocks : this.graphicsBlocks).push(duplicate);
        this.normalizeLayerOrder();
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
        this.normalizeLayerOrder();
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
