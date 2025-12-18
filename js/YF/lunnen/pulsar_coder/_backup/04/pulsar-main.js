/**
 * PULSAR CODER v1.0
 * 
 * Encodes arbitrary strings into a Voyager/Pioneer-style pulsar map.
 * Features:
 * - UTF-8 encoding
 * - Framing: preamble + length + payload + CRC32
 * - Error correction: repetition (2x/3x)
 * - Deterministic generation (seed-based)
 * - Pure SVG export
 * - Verification/decoding
 * 
 * Binary structure:
 * [PREAMBLE (16-32 bits)] [LENGTH (16 bits)] [PAYLOAD (n bits)] [CRC32 (32 bits)]
 */

import { SliderController } from './js/ui/SliderController.js';
import { PanelManager } from './js/ui/PanelManager.js';
import { ZoomPanManager } from './js/ui/ZoomPanManager.js';

// ============================================
// SETTINGS STORAGE
// ============================================

const settings = {
    values: {
        // Payload
        payload: 'Hello, Universe! 🌌',
        
        // Ray parameters
        rayCount: 14,
        rayLength: 250,
        bitStep: 8,
        
        // Encoding
        bitMode: 'length', // 'length' or 'gap'
        tickShort: 4,
        tickLong: 8,
        eccMode: 'none', // 'none', 'repeat2', 'repeat3'
        
        // Visual
        strokeWidth: 1.5,
        showCalibrator: true,
        showRays: true,
        
        // Advanced
        seed: 'voyager1977',
        margin: 50,
        preambleLength: 16,
        
        // Center offset
        centerOffsetX: 0,
        centerOffsetY: 0
    },
    get(key) { return this.values[key]; },
    set(key, value) { this.values[key] = value; }
};

// ============================================
// ENCODING FUNCTIONS
// ============================================

/**
 * Convert UTF-8 string to byte array
 */
function utf8ToBytes(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

/**
 * Convert byte array back to UTF-8 string
 */
function bytesToUtf8(bytes) {
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}

/**
 * Convert byte array to bit array
 */
function bytesToBits(bytes) {
    const bits = [];
    for (let byte of bytes) {
        for (let i = 7; i >= 0; i--) {
            bits.push((byte >> i) & 1);
        }
    }
    return bits;
}

/**
 * Convert bit array to byte array
 */
function bitsToBytes(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < bits.length; i++) {
        if (bits[i]) {
            bytes[Math.floor(i / 8)] |= (1 << (7 - (i % 8)));
        }
    }
    return bytes;
}

/**
 * Calculate CRC32 checksum
 */
function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    
    // Build CRC table
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    
    // Calculate CRC
    for (let byte of bytes) {
        crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF];
    }
    
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Convert number to bit array (MSB first)
 */
function numToBits(num, length) {
    const bits = [];
    for (let i = length - 1; i >= 0; i--) {
        bits.push((num >> i) & 1);
    }
    return bits;
}

/**
 * Convert bit array to number
 */
function bitsToNum(bits) {
    let num = 0;
    for (let i = 0; i < bits.length; i++) {
        num = (num << 1) | bits[i];
    }
    return num;
}

/**
 * Add framing: preamble + length + payload + CRC32
 */
function addFraming(payloadBits, preambleLength = 16) {
    const bits = [];
    
    // Preamble: alternating 1010... for sync
    for (let i = 0; i < preambleLength; i++) {
        bits.push(i % 2);
    }
    
    // Length field (16 bits): number of payload bits
    bits.push(...numToBits(payloadBits.length, 16));
    
    // Payload
    bits.push(...payloadBits);
    
    // CRC32 of payload bytes (32 bits)
    const payloadBytes = bitsToBytes(payloadBits);
    const checksum = crc32(payloadBytes);
    bits.push(...numToBits(checksum, 32));
    
    return bits;
}

/**
 * Apply error correction
 */
function applyECC(bits, mode) {
    if (mode === 'none') return bits;
    
    const repeat = mode === 'repeat2' ? 2 : 3;
    const encoded = [];
    
    for (let bit of bits) {
        for (let i = 0; i < repeat; i++) {
            encoded.push(bit);
        }
    }
    
    return encoded;
}

/**
 * Decode ECC (majority voting)
 */
function decodeECC(bits, mode) {
    if (mode === 'none') return bits;
    
    const repeat = mode === 'repeat2' ? 2 : 3;
    const decoded = [];
    
    for (let i = 0; i < bits.length; i += repeat) {
        const chunk = bits.slice(i, i + repeat);
        const sum = chunk.reduce((a, b) => a + b, 0);
        decoded.push(sum >= Math.ceil(repeat / 2) ? 1 : 0);
    }
    
    return decoded;
}

/**
 * Split bits across rays (non-uniform distribution like pulsar map)
 */
function splitBitsToRays(bits, rayCount, seed) {
    // Validate rayCount
    if (!rayCount || rayCount < 1 || isNaN(rayCount)) {
        console.error('Invalid rayCount:', rayCount);
        rayCount = 14; // Fallback to default
    }
    
    const rays = Array.from({ length: rayCount }, () => []);
    const rng = seededRandom(seed + '_bitdist');
    
    // Generate different bit counts for each ray (like in Voyager map)
    const bitCounts = [];
    let totalAllocated = 0;
    
    for (let i = 0; i < rayCount - 1; i++) {
        // Each ray gets between 40% and 160% of average
        const avgBits = Math.floor(bits.length / rayCount);
        const variation = rng();
        const count = Math.floor(avgBits * (0.4 + variation * 1.2));
        bitCounts.push(count);
        totalAllocated += count;
    }
    
    // Last ray gets remaining bits
    bitCounts.push(bits.length - totalAllocated);
    
    // Distribute bits according to counts
    let bitIndex = 0;
    for (let rayIndex = 0; rayIndex < rayCount; rayIndex++) {
        const count = Math.max(0, bitCounts[rayIndex]);
        for (let i = 0; i < count && bitIndex < bits.length; i++) {
            rays[rayIndex].push(bits[bitIndex]);
            bitIndex++;
        }
    }
    
    // Distribute any remaining bits
    while (bitIndex < bits.length) {
        rays[bitIndex % rayCount].push(bits[bitIndex]);
        bitIndex++;
    }
    
    return rays;
}

// ============================================
// GEOMETRY FUNCTIONS
// ============================================

/**
 * Simple pseudo-random number generator (seeded)
 */
function seededRandom(seed) {
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
        state = ((state << 5) - state + seed.charCodeAt(i)) | 0;
    }
    
    return function() {
        state = (state * 1664525 + 1013904223) | 0;
        return Math.abs(state) / 0x7FFFFFFF;
    };
}

/**
 * Generate ray angles (non-uniform like pulsar map)
 * Reference ray is always at 0° (3 o'clock position)
 */
function makeAngles(rayCount, seed) {
    const angles = [];
    const rng = seededRandom(seed + '_angles');
    
    // First ray (reference) is always at 0° (3 o'clock)
    angles.push(0);
    
    // Generate non-uniform angles with varying separation
    const minSeparation = 360 / rayCount * 0.3; // Minimum 30% of uniform
    const maxSeparation = 360 / rayCount * 2.0; // Maximum 200% of uniform
    
    let currentAngle = 0; // Start from reference ray
    
    for (let i = 1; i < rayCount; i++) {
        // Vary the angular spacing
        const variation = rng();
        const separation = minSeparation + variation * (maxSeparation - minSeparation);
        
        currentAngle = (currentAngle + separation) % 360;
        angles.push(currentAngle);
    }
    
    // Sort angles, keeping 0° as first
    const referenceAngle = angles.shift(); // Remove 0°
    angles.sort((a, b) => a - b);
    angles.unshift(referenceAngle); // Put 0° back as first
    
    return angles;
}

// ============================================
// SVG GENERATION
// ============================================

/**
 * Build complete SVG with pulsar map
 */
function buildSvg(params, raysBits, metadata, forExport = false, preserveEndpoints = false) {
    const { 
        rayCount, rayLength, bitStep, 
        bitMode, tickShort, tickLong, 
        strokeWidth, showCalibrator, showRays,
        seed, margin,
        centerOffsetX = 0,
        centerOffsetY = 0
    } = params;
    
    const viewBoxSize = 1000;
    const centerDefault = viewBoxSize / 2;
    const centerX = centerDefault + centerOffsetX;
    const centerY = centerDefault + centerOffsetY;
    
    // Stroke color: white for UI (black page bg), black for export
    const strokeColor = forExport ? '#000000' : '#ffffff';
    
    // No background rect - always transparent
    const bgRect = '';
    
    let angles, rayLengths, rayEndpoints;
    
    if (preserveEndpoints && fixedRayEndpoints) {
        // Use fixed endpoints and calculate angles/lengths from them
        rayEndpoints = fixedRayEndpoints;
        angles = [];
        rayLengths = [];
        
        for (let i = 0; i < rayCount; i++) {
            const endpoint = rayEndpoints[i];
            const dx = endpoint.x - centerX;
            const dy = endpoint.y - centerY;
            
            // Calculate angle from center to fixed endpoint
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            angles.push(angle);
            
            // Calculate length
            const length = Math.sqrt(dx * dx + dy * dy);
            rayLengths.push(length);
        }
    } else {
        // Generate angles normally (always non-uniform, reference at 0°)
        angles = makeAngles(rayCount, seed);
        
        // Generate varied ray lengths (like in pulsar map)
        const rngLengths = seededRandom(seed + '_lengths');
        rayLengths = [];
        for (let i = 0; i < rayCount; i++) {
            // Each ray has length between 60% and 140% of base length
            const variation = rngLengths();
            rayLengths.push(rayLength * (0.6 + variation * 0.8));
        }
        
        // Calculate and store endpoints for future dragging
        rayEndpoints = [];
        for (let i = 0; i < rayCount; i++) {
            const rad = (angles[i] * Math.PI) / 180;
            const bits = raysBits[i] || [];
            const rayLengthAdjusted = rayLengths[i] + bits.length * bitStep;
            
            rayEndpoints.push({
                x: centerX + Math.cos(rad) * rayLengthAdjusted,
                y: centerY + Math.sin(rad) * rayLengthAdjusted
            });
        }
        
        // Store for dragging
        fixedRayEndpoints = rayEndpoints;
    }
    
    // Generate varied starting offsets for bits on each ray (like in pulsar map)
    let rayOffsets;
    
    if (preserveEndpoints && fixedRayOffsets) {
        // Use fixed offsets when dragging center
        rayOffsets = fixedRayOffsets;
    } else {
        // Generate new offsets
        const rngOffsets = seededRandom(seed + '_offsets');
        rayOffsets = [];
        const minOffset = 15; // Minimum distance from center
        for (let i = 0; i < rayCount; i++) {
            // Each ray has offset anywhere along the ray - from very close to center to far end
            const variation = rngOffsets();
            const maxOffset = rayLengths[i] * 0.9; // Up to 90% of individual ray length
            rayOffsets.push(minOffset + variation * maxOffset);
        }
        
        // Store offsets for dragging
        fixedRayOffsets = rayOffsets;
    }
    
    // SVG elements
    let elements = [];
    
    // Rays with bits (NO center circle)
    angles.forEach((angle, rayIndex) => {
        const rad = (angle * Math.PI) / 180;
        
        const bits = raysBits[rayIndex] || [];
        
        // Use stored endpoint or calculate it
        const x2 = rayEndpoints[rayIndex].x;
        const y2 = rayEndpoints[rayIndex].y;
        
        // Draw ray line only if showRays is enabled
        if (showRays) {
            elements.push(`<line x1="${centerX}" y1="${centerY}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="0.8" stroke-linecap="round"/>`);
        }
        
        // Bits along ray - each ray starts at its own offset
        // Skip bits for reference ray (rayIndex 0)
        if (rayIndex === 0) return;
        
        bits.forEach((bit, bitIndex) => {
            const dist = rayOffsets[rayIndex] + bitIndex * bitStep;
            
            // Skip if bit position exceeds ray length
            if (dist > rayLengths[rayIndex]) {
                return;
            }
            
            const x = centerX + Math.cos(rad) * dist;
            const y = centerY + Math.sin(rad) * dist;
            
            let tickLength = 0;
            if (bitMode === 'length') {
                // 0 = short, 1 = long
                tickLength = bit ? tickLong : tickShort;
            } else {
                // gap: 0 = no tick, 1 = tick
                tickLength = bit ? tickLong : 0;
            }
            
            if (tickLength > 0) {
                // Perpendicular tick
                const perpRad = rad + Math.PI / 2;
                const x1 = x - Math.cos(perpRad) * (tickLength / 2);
                const y1 = y - Math.sin(perpRad) * (tickLength / 2);
                const x2 = x + Math.cos(perpRad) * (tickLength / 2);
                const y2 = y + Math.sin(perpRad) * (tickLength / 2);
                
                elements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`);
            }
        });
    });
    
    // Calibrator scale (bottom)
    if (showCalibrator) {
        const calY = viewBoxSize - 30;
        const calX = 30;
        const calUnit = 10;
        
        // Base line
        elements.push(`<line x1="${calX}" y1="${calY}" x2="${calX + calUnit * 5}" y2="${calY}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="0.5"/>`);
        
        // Tick marks
        for (let i = 0; i <= 5; i++) {
            const x = calX + i * calUnit;
            const h = i % 5 === 0 ? 6 : 3;
            elements.push(`<line x1="${x}" y1="${calY - h}" x2="${x}" y2="${calY + h}" stroke="${strokeColor}" stroke-width="${strokeWidth * 0.8}" opacity="0.5"/>`);
        }
    }
    
    // Build SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}"
     data-codec="pulsar-v1"
     data-ray-count="${rayCount}"
     data-ecc="${params.eccMode}"
     data-crc="${metadata.crc.toString(16)}"
     data-payload-len="${metadata.payloadLength}"
     data-seed="${seed}">
    ${bgRect}
    <g id="pulsar-code" stroke-linecap="round" stroke-linejoin="round">
        ${elements.join('\n        ')}
    </g>
</svg>`;
    
    return svg;
}

// ============================================
// ENCODING PIPELINE
// ============================================

function encodePulsar(payload, params) {
    // 1. UTF-8 -> bytes
    const payloadBytes = utf8ToBytes(payload);
    
    // 2. Bytes -> bits
    const payloadBits = bytesToBits(payloadBytes);
    
    // 3. Add framing
    const framedBits = addFraming(payloadBits, params.preambleLength);
    
    // 4. Apply ECC
    const encodedBits = applyECC(framedBits, params.eccMode);
    
    // 5. Split to rays (non-uniform distribution)
    const raysBits = splitBitsToRays(encodedBits, params.rayCount, params.seed);
    
    // Metadata
    const crc = crc32(payloadBytes);
    
    return {
        raysBits,
        metadata: {
            payloadLength: payloadBits.length,
            encodedLength: encodedBits.length,
            crc,
            crcHex: crc.toString(16).toUpperCase().padStart(8, '0')
        }
    };
}

// ============================================
// DECODING / VERIFICATION
// ============================================

function verifyPulsar(raysBits, params) {
    try {
        // Reconstruct bit stream from rays
        const maxLen = Math.max(...raysBits.map(r => r.length));
        const bits = [];
        
        for (let i = 0; i < maxLen; i++) {
            for (let ray of raysBits) {
                if (i < ray.length) {
                    bits.push(ray[i]);
                }
            }
        }
        
        // Decode ECC
        const decodedBits = decodeECC(bits, params.eccMode);
        
        // Parse framing
        const preambleLength = params.preambleLength;
        
        // Check preamble
        const preamble = decodedBits.slice(0, preambleLength);
        let preambleValid = true;
        for (let i = 0; i < preambleLength; i++) {
            if (preamble[i] !== (i % 2)) {
                preambleValid = false;
                break;
            }
        }
        
        // Read length
        const lengthBits = decodedBits.slice(preambleLength, preambleLength + 16);
        const payloadLength = bitsToNum(lengthBits);
        
        // Extract payload
        const payloadStart = preambleLength + 16;
        const payloadBits = decodedBits.slice(payloadStart, payloadStart + payloadLength);
        
        // Read CRC
        const crcStart = payloadStart + payloadLength;
        const crcBits = decodedBits.slice(crcStart, crcStart + 32);
        const expectedCrc = bitsToNum(crcBits);
        
        // Calculate actual CRC
        const payloadBytes = bitsToBytes(payloadBits);
        const actualCrc = crc32(payloadBytes);
        
        // Decode payload
        const payloadText = bytesToUtf8(payloadBytes);
        
        return {
            success: actualCrc === expectedCrc,
            preambleValid,
            payloadLength,
            expectedCrc,
            actualCrc,
            crcMatch: actualCrc === expectedCrc,
            payloadText,
            details: {
                totalBits: decodedBits.length,
                payloadBits: payloadLength,
                eccMode: params.eccMode
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================
// UI CONTROLLER
// ============================================

let currentSvg = '';
let currentRaysBits = [];

// Store fixed ray endpoints for center dragging
let fixedRayEndpoints = null;
let fixedRayOffsets = null; // Store fixed offsets for bits
let baseParams = null; // Store base params for recalculation

function generate(preserveEndpoints = false) {
    const params = {
        rayCount: settings.get('rayCount') || 14,
        rayLength: settings.get('rayLength') || 250,
        bitStep: settings.get('bitStep') || 8,
        bitMode: settings.get('bitMode') || 'length',
        tickShort: settings.get('tickShort') || 4,
        tickLong: settings.get('tickLong') || 8,
        eccMode: settings.get('eccMode') || 'none',
        strokeWidth: settings.get('strokeWidth') || 1.5,
        showCalibrator: settings.get('showCalibrator') !== false,
        showRays: settings.get('showRays') !== false,
        seed: settings.get('seed') || 'voyager1977',
        margin: settings.get('margin') || 50,
        preambleLength: settings.get('preambleLength') || 16,
        centerOffsetX: settings.get('centerOffsetX') || 0,
        centerOffsetY: settings.get('centerOffsetY') || 0
    };
    
    const payload = settings.get('payload') || 'Hello, Universe! 🌌';
    
    // Encode
    const { raysBits, metadata } = encodePulsar(payload, params);
    currentRaysBits = raysBits;
    
    // Store base params if not preserving endpoints (first generation or reset)
    if (!preserveEndpoints) {
        baseParams = { ...params };
        fixedRayEndpoints = null;
        fixedRayOffsets = null;
    }
    
    // Generate SVG for UI (white on black)
    const svgUI = buildSvg(params, raysBits, metadata, false, preserveEndpoints);
    
    // Generate SVG for export (black on transparent)
    const svgExport = buildSvg(params, raysBits, metadata, true, preserveEndpoints);
    currentSvg = svgExport; // For download
    
    // Update display with UI version
    const container = document.getElementById('pulsarSvg');
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgUI, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    
    // Copy attributes and content
    container.setAttribute('viewBox', svgElement.getAttribute('viewBox'));
    container.innerHTML = svgElement.innerHTML;
    
    // Update info
    const payloadBytes = utf8ToBytes(payload);
    document.getElementById('infoPayloadBytes').textContent = `${payloadBytes.length} bytes`;
    document.getElementById('infoEncodedBits').textContent = `${metadata.encodedLength} bits`;
    document.getElementById('infoCrc').textContent = metadata.crcHex;
}

function downloadSvg() {
    if (!currentSvg) {
        alert('Generate a pulsar map first!');
        return;
    }
    
    const blob = new Blob([currentSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulsar-code-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
}

function copySvg() {
    if (!currentSvg) {
        alert('Generate a pulsar map first!');
        return;
    }
    
    navigator.clipboard.writeText(currentSvg).then(() => {
        const btn = document.getElementById('copyBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('btn-success-flash');
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('btn-success-flash');
        }, 1500);
    });
}

function verify() {
    if (!currentRaysBits.length) {
        alert('Generate a pulsar map first!');
        return;
    }
    
    const params = {
        rayCount: settings.get('rayCount'),
        eccMode: settings.get('eccMode'),
        preambleLength: settings.get('preambleLength')
    };
    
    const result = verifyPulsar(currentRaysBits, params);
    
    // Show modal
    const modal = document.getElementById('verifyModal');
    const body = document.getElementById('verifyModalBody');
    
    if (result.success) {
        body.innerHTML = `
            <p class="verify-success">✓ Verification successful!</p>
            <h3>Details</h3>
            <p><strong>Preamble:</strong> ${result.preambleValid ? '✓ Valid' : '✗ Invalid'}</p>
            <p><strong>Payload length:</strong> ${result.payloadLength} bits</p>
            <p><strong>CRC32:</strong> 0x${result.expectedCrc.toString(16).toUpperCase().padStart(8, '0')}</p>
            <p><strong>CRC match:</strong> ${result.crcMatch ? '✓ Yes' : '✗ No'}</p>
            <p><strong>Decoded message:</strong></p>
            <pre>${result.payloadText}</pre>
            <p><strong>ECC mode:</strong> ${result.details.eccMode}</p>
        `;
    } else {
        body.innerHTML = `
            <p class="verify-error">✗ Verification failed</p>
            <p>${result.error || 'CRC mismatch or corrupted data'}</p>
            ${result.payloadText ? `<p><strong>Decoded (possibly corrupted):</strong></p><pre>${result.payloadText}</pre>` : ''}
        `;
    }
    
    modal.classList.add('active');
}

// ============================================
// PRESETS
// ============================================

const presets = {
    voyager: {
        rayCount: 14,
        rayLength: 350,
        bitStep: 8,
        tickShort: 4,
        tickLong: 8,
        strokeWidth: 1.5,
        margin: 50,
        seed: 'voyager1977'
    },
    dense: {
        rayCount: 20,
        rayLength: 380,
        bitStep: 6,
        tickShort: 3,
        tickLong: 7,
        strokeWidth: 1.2,
        margin: 40,
        seed: 'dense2024'
    },
    minimal: {
        rayCount: 8,
        rayLength: 320,
        bitStep: 10,
        tickShort: 5,
        tickLong: 10,
        strokeWidth: 2,
        margin: 60,
        seed: 'minimal'
    },
    accurate: {
        rayCount: 16,
        rayLength: 360,
        bitStep: 7,
        tickShort: 4,
        tickLong: 8,
        strokeWidth: 1.5,
        margin: 50,
        seed: 'accurate42'
    }
};

function applyPreset(presetName) {
    const preset = presets[presetName];
    if (!preset) return;
    
    Object.keys(preset).forEach(key => {
        settings.set(key, preset[key]);
    });
    
    // Update UI
    document.getElementById('rayCountSlider').value = preset.rayCount;
    document.getElementById('rayCountValue').value = preset.rayCount;
    document.getElementById('rayLengthSlider').value = preset.rayLength;
    document.getElementById('rayLengthValue').value = preset.rayLength;
    document.getElementById('bitStepSlider').value = preset.bitStep;
    document.getElementById('bitStepValue').value = preset.bitStep;
    document.getElementById('tickShortSlider').value = preset.tickShort;
    document.getElementById('tickShortValue').value = preset.tickShort;
    document.getElementById('tickLongSlider').value = preset.tickLong;
    document.getElementById('tickLongValue').value = preset.tickLong;
    document.getElementById('strokeWidthSlider').value = preset.strokeWidth;
    document.getElementById('strokeWidthValue').value = preset.strokeWidth;
    document.getElementById('marginSlider').value = preset.margin;
    document.getElementById('marginValue').value = preset.margin;
    document.getElementById('seedInput').value = preset.seed;
    
    generate();
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize SliderController
    const sliderController = new SliderController(settings);
    
    const sliders = [
        { id: 'rayCountSlider', valueId: 'rayCountValue', setting: 'rayCount', decimals: 0, min: 8, max: 24, baseStep: 1, shiftStep: 2 },
        { id: 'rayLengthSlider', valueId: 'rayLengthValue', setting: 'rayLength', decimals: 0, min: 200, max: 500, baseStep: 10, shiftStep: 50 },
        { id: 'bitStepSlider', valueId: 'bitStepValue', setting: 'bitStep', decimals: 1, min: 4, max: 16, baseStep: 0.5, shiftStep: 2 },
        { id: 'tickShortSlider', valueId: 'tickShortValue', setting: 'tickShort', decimals: 1, min: 2, max: 12, baseStep: 0.5, shiftStep: 2 },
        { id: 'tickLongSlider', valueId: 'tickLongValue', setting: 'tickLong', decimals: 1, min: 4, max: 20, baseStep: 0.5, shiftStep: 2 },
        { id: 'strokeWidthSlider', valueId: 'strokeWidthValue', setting: 'strokeWidth', decimals: 1, min: 0.5, max: 4, baseStep: 0.1, shiftStep: 0.5 },
        { id: 'marginSlider', valueId: 'marginValue', setting: 'margin', decimals: 0, min: 20, max: 100, baseStep: 5, shiftStep: 10 },
        { id: 'preambleLengthSlider', valueId: 'preambleLengthValue', setting: 'preambleLength', decimals: 0, min: 8, max: 32, baseStep: 8, shiftStep: 8 }
    ];
    
    sliders.forEach(slider => {
        sliderController.initSlider(slider.id, {
            valueId: slider.valueId,
            setting: slider.setting,
            decimals: slider.decimals,
            min: slider.min,
            max: slider.max,
            baseStep: slider.baseStep,
            shiftStep: slider.shiftStep,
            onUpdate: () => {
                // Real-time generation on parameter change
                generate();
            }
        });
        
        // Sync initial value from HTML to settings
        const sliderElement = document.getElementById(slider.id);
        if (sliderElement) {
            const initialValue = parseFloat(sliderElement.value);
            if (!isNaN(initialValue)) {
                settings.set(slider.setting, initialValue);
            }
        }
    });
    
    // Initialize PanelManager
    const panelManager = new PanelManager();
    panelManager.registerPanel('mainPanel', {
        headerId: 'mainPanelHeader',
        draggable: true,
        persistent: true
    });
    panelManager.registerPanel('encodingPanel', {
        headerId: 'encodingPanelHeader',
        draggable: true,
        persistent: true
    });
    panelManager.registerPanel('visualPanel', {
        headerId: 'visualPanelHeader',
        draggable: true,
        persistent: true
    });
    
    // Initialize ZoomPanManager
    const zoomPanManager = new ZoomPanManager(
        document.getElementById('canvasContainer'),
        document.getElementById('pulsarSvg')
    );
    
    document.getElementById('canvasContainer').addEventListener('zoomchange', (e) => {
        document.getElementById('zoomIndicator').textContent = e.detail.percent + '%';
    });
    
    document.getElementById('zoomIndicator').addEventListener('click', () => {
        zoomPanManager.resetZoom();
    });
    
    // Panel collapse
    document.querySelectorAll('.collapse-icon').forEach(icon => {
        icon.addEventListener('click', function() {
            this.closest('.controls-panel').classList.toggle('panel-collapsed');
            this.classList.toggle('collapsed');
        });
    });
    
    // Collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const toggle = this.querySelector('.collapse-toggle');
            const content = this.nextElementSibling;
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
            
            toggle.setAttribute('aria-expanded', !isExpanded);
            content.classList.toggle('collapsed');
        });
    });
    
    // Payload input with debounced real-time generation
    const payloadInput = document.getElementById('payloadInput');
    const charCounter = document.getElementById('charCounter');
    
    // Initialize payload from HTML
    if (payloadInput.value) {
        settings.set('payload', payloadInput.value);
        charCounter.textContent = `${payloadInput.value.length} characters`;
    }
    
    let payloadTimeout;
    payloadInput.addEventListener('input', () => {
        settings.set('payload', payloadInput.value);
        charCounter.textContent = `${payloadInput.value.length} characters`;
        
        // Debounced generation (wait 500ms after typing stops)
        clearTimeout(payloadTimeout);
        payloadTimeout = setTimeout(() => {
            generate();
        }, 500);
    });
    
    // Radio buttons with real-time generation
    document.querySelectorAll('input[name="bitMode"]').forEach(radio => {
        if (radio.checked) {
            settings.set('bitMode', radio.value);
        }
        radio.addEventListener('change', () => {
            settings.set('bitMode', radio.value);
            generate();
        });
    });
    
    document.querySelectorAll('input[name="eccMode"]').forEach(radio => {
        if (radio.checked) {
            settings.set('eccMode', radio.value);
        }
        radio.addEventListener('change', () => {
            settings.set('eccMode', radio.value);
            generate();
        });
    });
    
    // Checkboxes
    const showCalibratorCb = document.getElementById('showCalibrator');
    const showRaysCb = document.getElementById('showRays');
    const seedInput = document.getElementById('seedInput');
    
    // Initialize from HTML
    settings.set('showCalibrator', showCalibratorCb.checked);
    settings.set('showRays', showRaysCb.checked);
    settings.set('seed', seedInput.value || 'voyager1977');
    
    showCalibratorCb.addEventListener('change', (e) => {
        settings.set('showCalibrator', e.target.checked);
        generate();
    });
    
    showRaysCb.addEventListener('change', (e) => {
        settings.set('showRays', e.target.checked);
        generate();
    });
    
    // Seed input
    seedInput.addEventListener('change', (e) => {
        settings.set('seed', e.target.value);
        generate();
    });
    
    // Buttons
    document.getElementById('downloadBtn').addEventListener('click', downloadSvg);
    document.getElementById('copyBtn').addEventListener('click', copySvg);
    document.getElementById('verifyBtn').addEventListener('click', verify);
    
    document.getElementById('randomizeBtn').addEventListener('click', () => {
        const randomSeed = Math.random().toString(36).substring(7);
        document.getElementById('seedInput').value = randomSeed;
        settings.set('seed', randomSeed);
        generate();
    });
    
    // Preset dropdown
    const presetToggle = document.getElementById('presetDropdownToggle');
    const presetMenu = document.getElementById('presetDropdownMenu');
    const presetText = document.getElementById('presetDropdownText');
    
    presetToggle.addEventListener('click', () => {
        const isExpanded = presetToggle.getAttribute('aria-expanded') === 'true';
        presetToggle.setAttribute('aria-expanded', !isExpanded);
        presetMenu.classList.toggle('active');
    });
    
    document.querySelectorAll('.preset-dropdown-item').forEach(item => {
        item.addEventListener('click', function() {
            const preset = this.dataset.preset;
            
            // Update UI
            document.querySelectorAll('.preset-dropdown-item').forEach(i => i.classList.remove('selected'));
            this.classList.add('selected');
            presetText.textContent = this.textContent;
            
            // Apply preset
            applyPreset(preset);
            
            // Close menu
            presetToggle.setAttribute('aria-expanded', 'false');
            presetMenu.classList.remove('active');
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.preset-dropdown')) {
            presetToggle.setAttribute('aria-expanded', 'false');
            presetMenu.classList.remove('active');
        }
    });
    
    // Modal
    document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('verifyModal').classList.remove('active');
    });
    
    document.getElementById('verifyModal').addEventListener('click', (e) => {
        if (e.target.id === 'verifyModal') {
            document.getElementById('verifyModal').classList.remove('active');
        }
    });
    
    // Center dragging functionality
    let isDraggingCenter = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialOffsetX = 0;
    let initialOffsetY = 0;
    
    const svgElement = document.getElementById('pulsarSvg');
    const canvasContainer = document.getElementById('canvasContainer');
    
    // Disable ZoomPanManager panning to allow center dragging
    // We'll keep zoom with mousewheel
    canvasContainer.addEventListener('mousedown', (e) => {
        // Only start dragging center on left mouse button
        if (e.button === 0) {
            isDraggingCenter = true;
            
            // Get SVG coordinates
            const rect = svgElement.getBoundingClientRect();
            const svgX = (e.clientX - rect.left) / rect.width * 1000;
            const svgY = (e.clientY - rect.top) / rect.height * 1000;
            
            dragStartX = svgX;
            dragStartY = svgY;
            initialOffsetX = settings.get('centerOffsetX') || 0;
            initialOffsetY = settings.get('centerOffsetY') || 0;
            
            canvasContainer.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
        }
    }, true); // Use capture phase to intercept before ZoomPanManager
    
    document.addEventListener('mousemove', (e) => {
        if (isDraggingCenter) {
            const rect = svgElement.getBoundingClientRect();
            const svgX = (e.clientX - rect.left) / rect.width * 1000;
            const svgY = (e.clientY - rect.top) / rect.height * 1000;
            
            const deltaX = svgX - dragStartX;
            const deltaY = svgY - dragStartY;
            
            settings.set('centerOffsetX', initialOffsetX + deltaX);
            settings.set('centerOffsetY', initialOffsetY + deltaY);
            
            generate(true); // Preserve endpoints while dragging
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDraggingCenter) {
            isDraggingCenter = false;
            canvasContainer.style.cursor = 'grab';
        }
    });
    
    // Set default cursor
    canvasContainer.style.cursor = 'grab';
    
    // Reset center button
    document.getElementById('resetCenterBtn').addEventListener('click', () => {
        settings.set('centerOffsetX', 0);
        settings.set('centerOffsetY', 0);
        generate(false); // Recalculate endpoints
    });
    
    // Generate initial (with small delay to ensure all elements are ready)
    setTimeout(() => {
        generate();
    }, 100);
});

