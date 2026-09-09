export const CLASSIC_LORENZ = Object.freeze({
    sigma: 10,
    rho: 28,
    beta: 8 / 3,
    x0: 0,
    y0: 1,
    z0: 1.05
});

const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function lorenzDerivative(x, y, z, sigma, rho, beta) {
    return [
        sigma * (y - x),
        x * (rho - z) - y,
        x * y - beta * z
    ];
}

export function rk4Step(x, y, z, dt, sigma, rho, beta) {
    const k1 = lorenzDerivative(x, y, z, sigma, rho, beta);
    const k2 = lorenzDerivative(
        x + k1[0] * dt * 0.5,
        y + k1[1] * dt * 0.5,
        z + k1[2] * dt * 0.5,
        sigma,
        rho,
        beta
    );
    const k3 = lorenzDerivative(
        x + k2[0] * dt * 0.5,
        y + k2[1] * dt * 0.5,
        z + k2[2] * dt * 0.5,
        sigma,
        rho,
        beta
    );
    const k4 = lorenzDerivative(
        x + k3[0] * dt,
        y + k3[1] * dt,
        z + k3[2] * dt,
        sigma,
        rho,
        beta
    );

    const sixth = dt / 6;
    return [
        x + sixth * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        y + sixth * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        z + sixth * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
    ];
}

export function integrateLorenz(options = {}) {
    const sigma = Math.max(0.01, finiteNumber(options.sigma, CLASSIC_LORENZ.sigma));
    const rho = Math.max(0, finiteNumber(options.rho, CLASSIC_LORENZ.rho));
    const beta = Math.max(0.01, finiteNumber(options.beta, CLASSIC_LORENZ.beta));
    const dt = Math.max(0.0001, finiteNumber(options.dt, 0.005));
    const pointCount = Math.max(1, Math.min(150000, Math.round(finiteNumber(options.pointCount, 24000))));
    const warmupSteps = Math.max(0, Math.min(100000, Math.round(finiteNumber(options.warmupSteps, 1800))));
    const sampleStride = Math.max(1, Math.min(100, Math.round(finiteNumber(options.sampleStride, 1))));
    const divergenceLimit = Math.max(100, finiteNumber(options.divergenceLimit, 1e6));

    let x = finiteNumber(options.x0, CLASSIC_LORENZ.x0);
    let y = finiteNumber(options.y0, CLASSIC_LORENZ.y0);
    let z = finiteNumber(options.z0, CLASSIC_LORENZ.z0);
    const points = new Float64Array(pointCount * 3);
    const bounds = {
        minX: Infinity, minY: Infinity, minZ: Infinity,
        maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity
    };

    let written = 0;
    let totalSteps = 0;
    const requestedSteps = warmupSteps + pointCount * sampleStride;
    for (let step = 0; step < requestedSteps; step++) {
        [x, y, z] = rk4Step(x, y, z, dt, sigma, rho, beta);
        totalSteps++;

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
            || Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > divergenceLimit) {
            break;
        }
        if (step < warmupSteps || ((step - warmupSteps) % sampleStride !== 0)) continue;

        const offset = written * 3;
        points[offset] = x;
        points[offset + 1] = y;
        points[offset + 2] = z;
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
        bounds.maxZ = Math.max(bounds.maxZ, z);
        written++;
    }

    const validPoints = written === pointCount ? points : points.slice(0, written * 3);
    return {
        points: validPoints,
        bounds,
        pointCount: written,
        requestedPointCount: pointCount,
        totalSteps,
        diverged: written < pointCount
    };
}

