import { PresetDocumentDeserializer } from './PresetDocumentDeserializer.js';
import { PresetDocumentSerializer } from './PresetDocumentSerializer.js';

/** Detects the external preset format and coordinates its conversion. */
export class PresetFormatAdapter {
    constructor({ serializer = new PresetDocumentSerializer(), deserializer = new PresetDocumentDeserializer() } = {}) {
        this.serializer = serializer;
        this.deserializer = deserializer;
    }

    isOrganized(data) {
        return Boolean(data?.dimensions && data?.grid && data?.typography);
    }

    organize(data = {}, options = {}) {
        return this.serializer.serialize(data, options);
    }

    normalize(data) {
        return this.isOrganized(data) ? this.fromOrganized(data) : data;
    }

    fromOrganized(data) {
        return this.deserializer.deserialize(data);
    }
}
