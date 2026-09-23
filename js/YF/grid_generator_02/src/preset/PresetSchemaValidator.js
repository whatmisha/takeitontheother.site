import validatePreset12 from './generated/validatePreset12.js';

export const CURRENT_PRESET_VERSION = '1.2';

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
        return `version must be ${CURRENT_PRESET_VERSION}`;
    }
    return `${path || 'preset'} ${error.message || 'is invalid'}`;
}

/** Validates imported and checked-in presets against the generated 1.2 contract. */
export class PresetSchemaValidator {
    assert(data) {
        if (validatePreset12(data)) return data;
        const details = (validatePreset12.errors || []).map(formatError).join('; ');
        throw new Error(`Unsupported preset format: ${details || 'preset is invalid'}`);
    }
}
