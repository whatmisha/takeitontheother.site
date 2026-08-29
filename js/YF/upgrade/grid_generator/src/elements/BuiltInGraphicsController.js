export const BUILT_IN_GRAPHICS_ASSETS = Object.freeze([
    Object.freeze({ id: 'icons', path: 'graphics/icons.svg', label: 'Icons' }),
    Object.freeze({ id: 'claim', path: 'graphics/yf_claim.svg', label: 'Claim' }),
    Object.freeze({ id: 'claim2026', path: 'graphics/yf_claim_2026.svg', label: 'Claim 2026' })
]);

/** Loads the application-owned SVG assets into their document objects. */
export class BuiltInGraphicsController {
    constructor({
        assetController,
        objectDocument,
        assets = BUILT_IN_GRAPHICS_ASSETS,
        onReady = () => {},
        logger = console
    }) {
        this.assetController = assetController;
        this.objectDocument = objectDocument;
        this.assets = assets;
        this.onReady = onReady;
        this.logger = logger;
    }

    async initialize() {
        const results = await Promise.all(
            this.assets.map(definition => this.loadAndApply(definition))
        );
        this.onReady(results);
        return results;
    }

    async loadAndApply(definition) {
        try {
            const asset = await this.assetController.load(definition.path);
            if (!asset?.content) {
                this.logger.error(`${definition.label} SVG could not be loaded from ${definition.path}`);
                return { id: definition.id, loaded: false };
            }

            const block = this.objectDocument.getGraphicsBlock(definition.id);
            if (!block) {
                // Presets may intentionally omit an optional built-in object.
                // The JSON document remains authoritative, so this is a valid skip.
                return { id: definition.id, loaded: false, skipped: true };
            }

            block.svgContent = asset.content;
            block.originalWidth = asset.width;
            block.originalHeight = asset.height;
            this.logger.log(
                `${definition.label} loaded from ${definition.path}: ${asset.width} × ${asset.height}`
            );
            return { id: definition.id, loaded: true };
        } catch (error) {
            this.logger.error(`Error loading ${definition.path}:`, error);
            return { id: definition.id, loaded: false };
        }
    }
}
