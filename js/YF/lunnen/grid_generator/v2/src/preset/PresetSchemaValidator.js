import validatePreset12 from './generated/validatePreset12.js';
import validatePreset20 from './generated/validatePreset20.js';
import { CURRENT_PRESET_VERSION, LEGACY_PRESET_VERSION } from './PresetMigrations.js';

export { CURRENT_PRESET_VERSION, LEGACY_PRESET_VERSION };

const VALIDATORS = new Map([
    [LEGACY_PRESET_VERSION, validatePreset12],
    [CURRENT_PRESET_VERSION, validatePreset20]
]);

function pointerToPath(pointer = '') {
    return pointer
        .split('/')
        .slice(1)
        .map(segment => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
        .reduce((path, segment) => (
            /^\d+$/.test(segment)
                ? `${path}[${segment}]`
                : path ? `${path}.${segment}` : segment
        ), '');
}

function formatError(error) {
    const path = pointerToPath(error.instancePath);
    if (error.keyword === 'required') {
        return `${path ? `${path}.` : ''}${error.params.missingProperty} is required`;
    }
    if (error.keyword === 'additionalProperties') {
        return `${path ? `${path}.` : ''}${error.params.additionalProperty} is not supported`;
    }
    return `${path || 'preset'} ${error.message || 'is invalid'}`;
}

/**
 * Validates presets against the contract of the version they declare.
 *
 * Legacy files are checked before migration so a corrupt 1.2 file fails on its
 * own terms rather than as a confusing 2.0 error.
 */
export class PresetSchemaValidator {
    assert(data) {
        const validate = VALIDATORS.get(data?.version);
        if (!validate) {
            const supported = [...VALIDATORS.keys()].join(' or ');
            throw new Error(`Unsupported preset format: version must be ${supported}`);
        }
        if (validate(data)) return data;
        const details = (validate.errors || []).map(formatError).join('; ');
        throw new Error(`Unsupported preset format: ${details || 'preset is invalid'}`);
    }
}
