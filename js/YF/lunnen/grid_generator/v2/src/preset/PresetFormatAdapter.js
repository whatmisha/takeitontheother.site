import { PresetDocumentDeserializer } from './PresetDocumentDeserializer.js';
import { PresetDocumentSerializer } from './PresetDocumentSerializer.js';
import { migratePresetToCurrent } from './PresetMigrations.js';
import { PresetSchemaValidator } from './PresetSchemaValidator.js';

/** Coordinates preset versions, migration and document conversion. */
export class PresetFormatAdapter {
    constructor({
        serializer = new PresetDocumentSerializer(),
        deserializer = new PresetDocumentDeserializer(),
        validator = new PresetSchemaValidator(),
        migrate = migratePresetToCurrent
    } = {}) {
        this.serializer = serializer;
        this.deserializer = deserializer;
        this.validator = validator;
        this.migrate = migrate;
    }

    organize(data = {}, options = {}) {
        return this.serializer.serialize(data, options);
    }

    /**
     * Validates the file as the version it declares, migrates it to the current
     * one, then validates again so migration bugs surface here and not later in
     * a render.
     */
    normalize(data) {
        this.validator.assert(data);
        const current = this.migrate(data);
        if (current !== data) this.validator.assert(current);
        return this.deserializer.deserialize(current);
    }
}
