const radians = (degrees) => Number(degrees || 0) * Math.PI / 180;

function rotatePoint(x, y, z, ax, ay, az) {
    const sinX = Math.sin(ax);
    const cosX = Math.cos(ax);
    const sinY = Math.sin(ay);
    const cosY = Math.cos(ay);
    const sinZ = Math.sin(az);
    const cosZ = Math.cos(az);

    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;
    const x3 = x2 * cosZ - y1 * sinZ;
    const y3 = x2 * sinZ + y1 * cosZ;
    return [x3, y3, z2];
}

function safeBounds(bounds) {
    if (!bounds || !Number.isFinite(bounds.minX)) {
        return { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -1, maxZ: 1 };
    }
    return bounds;
}

export function projectTrajectory(trajectory, settings, width, height) {
    const bounds = safeBounds(trajectory.bounds);
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
    const span = Math.max(
        bounds.maxX - bounds.minX,
        bounds.maxY - bounds.minY,
        bounds.maxZ - bounds.minZ,
        1e-9
    );
    const normalize = 2 / span;
    const ax = radians(settings.rotationX);
    const ay = radians(settings.rotationY);
    const az = radians(settings.rotationZ);
    const perspective = Math.max(0, Math.min(100, Number(settings.perspective || 0)));
    const cameraDistance = 8 - perspective * 0.052;

    const rotateAndProject = (x, y, z) => {
        // Lorenz's x/z plane is the familiar butterfly view; y supplies depth.
        const nx = (x - centerX) * normalize;
        const ny = (z - centerZ) * normalize;
        const nz = (y - centerY) * normalize;
        const rotated = rotatePoint(nx, ny, nz, ax, ay, az);
        const denominator = Math.max(0.25, cameraDistance - rotated[2]);
        const factor = perspective === 0 ? 1 : cameraDistance / denominator;
        return [rotated[0] * factor, -rotated[1] * factor, rotated[2]];
    };

    const count = trajectory.pointCount;
    const normalized = new Float32Array(count * 3);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < count; index++) {
        const offset = index * 3;
        const point = rotateAndProject(
            trajectory.points[offset],
            trajectory.points[offset + 1],
            trajectory.points[offset + 2]
        );
        normalized[offset] = point[0];
        normalized[offset + 1] = point[1];
        normalized[offset + 2] = point[2];
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
    }

    const projectedSpanX = Math.max(1e-9, maxX - minX);
    const projectedSpanY = Math.max(1e-9, maxY - minY);
    const fit = Math.min(width * 0.78 / projectedSpanX, height * 0.78 / projectedSpanY);
    const scale = fit * Math.max(0.25, Math.min(1.5, Number(settings.viewScale || 1)));
    const projectedCenterX = (minX + maxX) * 0.5;
    const projectedCenterY = (minY + maxY) * 0.5;
    const screen = new Float32Array(count * 3);
    for (let offset = 0; offset < normalized.length; offset += 3) {
        screen[offset] = width * 0.5 + (normalized[offset] - projectedCenterX) * scale;
        screen[offset + 1] = height * 0.5 + (normalized[offset + 1] - projectedCenterY) * scale;
        screen[offset + 2] = normalized[offset + 2];
    }

    const projectRawPoint = (x, y, z) => {
        const point = rotateAndProject(x, y, z);
        return {
            x: width * 0.5 + (point[0] - projectedCenterX) * scale,
            y: height * 0.5 + (point[1] - projectedCenterY) * scale,
            depth: point[2]
        };
    };

    return { points: screen, projectRawPoint, rawBounds: bounds, width, height };
}
