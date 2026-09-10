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

function complexPower(real, imaginary, exponent) {
    let resultReal = 1;
    let resultImaginary = 0;
    for (let index = 0; index < exponent; index++) {
        const nextReal = resultReal * real - resultImaginary * imaginary;
        resultImaginary = resultReal * imaginary + resultImaginary * real;
        resultReal = nextReal;
    }
    return [resultReal, resultImaginary];
}

export function protoLorenzDerivative(p, q, z, sigma, rho, beta, wingCount = 3) {
    const wings = Math.max(2, Math.min(8, Math.round(finiteNumber(wingCount, 3))));
    const radius = Math.hypot(p, q);
    if (radius < 1e-12) return [0, 0, -beta * z];

    // The n-fold cover w ↦ wⁿ of Miranda and Stone's proto-Lorenz system.
    const [u, v] = complexPower(p, q, wings);
    const norm = Math.hypot(u, v);
    const protoU = -(sigma + 1) * u + (sigma - rho + z) * v + (1 - sigma) * norm;
    const protoV = (rho - sigma - z) * u - (sigma + 1) * v + (rho + sigma - z) * norm;
    const [powerReal, powerImaginary] = complexPower(p, q, wings - 1);
    const denominator = wings * (powerReal * powerReal + powerImaginary * powerImaginary);

    return [
        (protoU * powerReal + protoV * powerImaginary) / denominator,
        (protoV * powerReal - protoU * powerImaginary) / denominator,
        0.5 * v - beta * z
    ];
}

function rk4SystemStep(x, y, z, dt, derivative, sigma, rho, beta, wingCount) {
    const k1 = derivative(x, y, z, sigma, rho, beta, wingCount);
    const k2 = derivative(
        x + k1[0] * dt * 0.5,
        y + k1[1] * dt * 0.5,
        z + k1[2] * dt * 0.5,
        sigma,
        rho,
        beta,
        wingCount
    );
    const k3 = derivative(
        x + k2[0] * dt * 0.5,
        y + k2[1] * dt * 0.5,
        z + k2[2] * dt * 0.5,
        sigma,
        rho,
        beta,
        wingCount
    );
    const k4 = derivative(
        x + k3[0] * dt,
        y + k3[1] * dt,
        z + k3[2] * dt,
        sigma,
        rho,
        beta,
        wingCount
    );

    const sixth = dt / 6;
    return [
        x + sixth * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        y + sixth * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        z + sixth * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
    ];
}

export function rk4Step(x, y, z, dt, sigma, rho, beta) {
    return rk4SystemStep(x, y, z, dt, lorenzDerivative, sigma, rho, beta);
}

export function rk4ProtoLorenzStep(p, q, z, dt, sigma, rho, beta, wingCount = 3) {
    return rk4SystemStep(p, q, z, dt, protoLorenzDerivative, sigma, rho, beta, wingCount);
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
    const systemType = options.systemType === 'protoLorenz' ? 'protoLorenz' : 'lorenz63';
    const wingCount = Math.max(3, Math.min(8, Math.round(finiteNumber(options.wingCount, 3))));
    const stepper = systemType === 'protoLorenz' ? rk4ProtoLorenzStep : rk4Step;

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
        [x, y, z] = stepper(x, y, z, dt, sigma, rho, beta, wingCount);
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
        diverged: written < pointCount,
        systemType,
        wingCount
    };
}
