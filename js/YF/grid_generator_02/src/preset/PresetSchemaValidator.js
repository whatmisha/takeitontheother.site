import validatePreset12 from './generated/validatePreset12.js';
import validatePreset20 from './generated/validatePreset20.js';

export const CURRENT_PRESET_VERSION = '2.0';

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
    if (path === 'version' && error.keyword === 'const') {
        return 'version must be 1.2 or 2.0';
    }
    return `${path || 'preset'} ${error.message || 'is invalid'}`;
}

/** Validates imported and checked-in presets against generated 1.2 and 2.0 contracts. */
export class PresetSchemaValidator {
    assert(data) {
        const validate = data?.version === '2.0' ? validatePreset20 : validatePreset12;
        if (validate(data)) return data;
        const details = (validate.errors || []).map(formatError).join('; ');
        throw new Error(`Unsupported preset format: ${details || 'preset is invalid'}`);
    }
}
