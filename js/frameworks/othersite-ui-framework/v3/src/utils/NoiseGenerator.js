/**
 * NoiseGenerator - Simplex noise 2D generator
 * Used for creating smooth, natural-looking displacements for wobbly/jittery line effects.
 * 
 * Based on simplified Open Simplex noise algorithm.
 * Returns values in range [-1, 1].
 */

export class NoiseGenerator {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        this.generatePermutation(seed);
    }

    /**
     * Generate permutation table from seed
     */
    generatePermutation(seed) {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        
        // Fisher-Yates shuffle with seeded random
        let s = seed * 2147483647;
        if (s <= 0) s = 1;
        const nextRandom = () => {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
        
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(nextRandom() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    // Gradients for 2D simplex noise
    static GRAD3 = [
        [1, 1], [-1, 1], [1, -1], [-1, -1],
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    // Skewing factors for 2D
    static F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    static G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    /**
     * 2D Simplex noise - returns value in [-1, 1]
     * @param {number} xin - X coordinate
     * @param {number} yin - Y coordinate
     * @returns {number} noise value in [-1, 1]
     */
    noise2D(xin, yin) {
        const F2 = NoiseGenerator.F2;
        const G2 = NoiseGenerator.G2;
        const GRAD3 = NoiseGenerator.GRAD3;
        
        let n0, n1, n2;
        
        // Skew input space to determine simplex cell
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;
        
        // Determine which simplex we are in
        let i1, j1;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }
        
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;
        
        // Hash coordinates of the three simplex corners
        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.permMod12[ii + this.perm[jj]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
        
        // Calculate contribution from the three corners
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
        }
        
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
        }
        
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
        }
        
        // Scale to [-1, 1]
        return 70.0 * (n0 + n1 + n2);
    }

    /**
     * Get displacement offset for a point
     * Uses two different noise lookups for X and Y offsets (shifted by 100 units)
     * @param {number} x - point X coordinate
     * @param {number} y - point Y coordinate
     * @param {number} frequency - noise frequency (smaller = smoother)
     * @param {number} amplitude - max displacement in pixels
     * @returns {Object} {dx, dy} - displacement
     */
    getOffset(x, y, frequency, amplitude) {
        return {
            dx: this.noise2D(x * frequency, y * frequency) * amplitude,
            dy: this.noise2D(x * frequency + 100, y * frequency + 100) * amplitude
        };
    }

    /**
     * Update seed (for Update button)
     * @param {number} newSeed - new seed value
     */
    reseed(newSeed) {
        this.seed = newSeed !== undefined ? newSeed : Math.random();
        this.generatePermutation(this.seed);
    }
}
