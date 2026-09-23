import { PresetDocumentDeserializer } from './PresetDocumentDeserializer.js';
import { PresetDocumentSerializer } from './PresetDocumentSerializer.js';
import { PresetSchemaValidator } from './PresetSchemaValidator.js';

/** Coordinates the single supported preset format and document conversion. */
export class PresetFormatAdapter {
    constructor({
        serializer = new PresetDocumentSerializer(),
        deserializer = new PresetDocumentDeserializer(),
        validator = new PresetSchemaValidator()
    } = {}) {
        this.serializer = serializer;
        this.deserializer = deserializer;
        this.validator = validator;
    }

    organize(data = {}, options = {}) {
        return this.serializer.serialize(data, options);
    }

    normalize(data) {
        this.validator.assert(data);
        return this.deserializer.deserialize(data);
    }
}
