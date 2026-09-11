import { buildCascadeScene, normalizeCascadeSettings } from './cascadeGeometry.js';

const TAU = Math.PI * 2;
const EPSILON = 1e-7;
export const SPHERE_BACKSIDE_OPACITY = 0.2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const degreesToRadians = (degrees) => degrees * Math.PI / 180;

function normalize(point) {
    const length = Math.hypot(point.x, point.y, point.z) || 1;
    return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function rotateVector(source, rotationX, rotationY, rotationZ) {
    const rx = degreesToRadians(rotationX);
    const ry = degreesToRadians(rotationY);
    const rz = degreesToRadians(rotationZ);
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);
    const x1 = source.x;
    const y1 = source.y * cosX - source.z * sinX;
    const z1 = source.y * sinX + source.z * cosX;
    const x2 = x1 * cosY + z1 * sinY;
    const y2 = y1;
    const z2 = -x1 * sinY + z1 * cosY;
    return {
        x: x2 * cosZ - y2 * sinZ,
        y: x2 * sinZ + y2 * cosZ,
        z: z2
    };
}

function worldRotation(settings) {
    return {
        x: settings.sphereRotationY,
        y: settings.sphereRotationX,
        z: settings.sphereRotationZ
    };
}

function perspectiveDistance(perspective) {
    if (perspective <= EPSILON) return Infinity;
    const amount = perspective / 100;
    return 1.04 + 4 * ((1 - amount) / amount) ** 2;
}

function cameraModel(settings) {
    const distance = perspectiveDistance(settings.spherePerspective);
    if (!Number.isFinite(distance)) return { distance, framing: 1, horizonZ: 0 };
    return {
        distance,
        framing: distance / Math.sqrt(distance * distance - 1),
        horizonZ: 1 / distance
    };
}

function uvToSphere(point, width, height) {
    const longitude = point.x / width * TAU - Math.PI;
    const latitude = point.y / height * Math.PI - Math.PI / 2;
    const ring = Math.cos(latitude);
    return {
        x: Math.sin(longitude) * ring,
        y: Math.sin(latitude),
        z: Math.cos(longitude) * ring
    };
}

function projectPoint(point, width, height, radius, camera) {
    const cameraScale = Number.isFinite(camera.distance)
        ? camera.distance / Math.max(0.01, camera.distance - point.z)
        : 1;
    const scale = cameraScale / camera.framing;
    return {
        x: width / 2 + point.x * radius * scale,
        y: height / 2 + point.y * radius * scale,
        z: point.z
    };
}

function midpoint2d(first, second) {
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function tessellateTriangle(points, maxU, maxV, output, depth = 0) {
    const edges = [
        [0, 1],
        [1, 2],
        [2, 0]
    ];
    let longestIndex = 0;
    let longestScore = -Infinity;
    edges.forEach(([from, to], index) => {
        const first = points[from];
        const second = points[to];
        const score = Math.hypot(
            (second.x - first.x) / maxU,
            (second.y - first.y) / maxV
        );
        if (score > longestScore) {
            longestScore = score;
            longestIndex = index;
        }
    });
    if (longestScore <= 1 || depth >= 12) {
        output.push(points);
        return;
    }

    const [from, to] = edges[longestIndex];
    const remaining = 3 - from - to;
    const middle = midpoint2d(points[from], points[to]);
    tessellateTriangle([points[from], middle, points[remaining]], maxU, maxV, output, depth + 1);
    tessellateTriangle([middle, points[to], points[remaining]], maxU, maxV, output, depth + 1);
}

function tessellatePolygons(polygons, width, height) {
    const triangles = [];
    const maxU = width / 42;
    const maxV = height / 28;
    polygons.forEach(({ points }) => {
        for (let index = 1; index < points.length - 1; index += 1) {
            tessellateTriangle(
                [points[0], points[index], points[index + 1]],
                maxU,
                maxV,
                triangles
            );
        }
    });
    return triangles;
}

function sphericalIntersection(first, second, horizonZ) {
    let low = 0;
    let high = 1;
    const firstSide = first.z >= horizonZ;
    for (let iteration = 0; iteration < 18; iteration += 1) {
        const amount = (low + high) / 2;
        const point = normalize({
            x: first.x + (second.x - first.x) * amount,
            y: first.y + (second.y - first.y) * amount,
            z: first.z + (second.z - first.z) * amount
        });
        if ((point.z >= horizonZ) === firstSide) low = amount;
        else high = amount;
    }
    const amount = (low + high) / 2;
    return normalize({
        x: first.x + (second.x - first.x) * amount,
        y: first.y + (second.y - first.y) * amount,
        z: first.z + (second.z - first.z) * amount
    });
}

function clipToHorizon(points, horizonZ, front) {
    const output = [];
    let previous = points.at(-1);
    let previousInside = front ? previous.z >= horizonZ - EPSILON : previous.z <= horizonZ + EPSILON;
    points.forEach((current) => {
        const currentInside = front ? current.z >= horizonZ - EPSILON : current.z <= horizonZ + EPSILON;
        if (currentInside !== previousInside) {
            output.push(sphericalIntersection(previous, current, horizonZ));
        }
        if (currentInside) output.push(current);
        previous = current;
        previousInside = currentInside;
    });
    return output;
}

function projectedArea(points) {
    let area = 0;
    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        area += point.x * next.y - next.x * point.y;
    });
    return Math.abs(area) / 2;
}

function projectedPatch(points, front, width, height, radius, camera) {
    const clipped = clipToHorizon(points, camera.horizonZ, front);
    if (clipped.length < 3) return null;
    const projected = clipped.map((point) => projectPoint(point, width, height, radius, camera));
    if (projectedArea(projected) <= 1e-5) return null;
    return {
        depth: clipped.reduce((sum, point) => sum + point.z, 0) / clipped.length,
        points: projected
    };
}

function appendGuideSegment(target, first, second, camera, width, height, radius) {
    const firstFront = first.z >= camera.horizonZ;
    const secondFront = second.z >= camera.horizonZ;
    if (firstFront === secondFront) {
        target[firstFront ? 'front' : 'back'].push([
            projectPoint(first, width, height, radius, camera),
            projectPoint(second, width, height, radius, camera)
        ]);
        return;
    }
    const horizon = sphericalIntersection(first, second, camera.horizonZ);
    const projectedHorizon = projectPoint(horizon, width, height, radius, camera);
    target[firstFront ? 'front' : 'back'].push([
        projectPoint(first, width, height, radius, camera),
        projectedHorizon
    ]);
    target[secondFront ? 'front' : 'back'].push([
        projectedHorizon,
        projectPoint(second, width, height, radius, camera)
    ]);
}

function buildSphereGuides(settings, rotation, camera, width, height, radius) {
    const guides = { front: [], back: [] };
    if (!settings.sphereGuides) return guides;
    const appendLine = (sourcePoints) => {
        let previous = rotateVector(sourcePoints[0], rotation.x, rotation.y, rotation.z);
        for (let index = 1; index < sourcePoints.length; index += 1) {
            const current = rotateVector(sourcePoints[index], rotation.x, rotation.y, rotation.z);
            appendGuideSegment(guides, previous, current, camera, width, height, radius);
            previous = current;
        }
    };

    [-60, -30, 0, 30, 60].forEach((degrees) => {
        const latitude = degreesToRadians(degrees);
        const ring = Math.cos(latitude);
        appendLine(Array.from({ length: 73 }, (_, step) => {
            const longitude = step / 72 * TAU;
            return {
                x: Math.sin(longitude) * ring,
                y: Math.sin(latitude),
                z: Math.cos(longitude) * ring
            };
        }));
    });
    for (let meridian = 0; meridian < 12; meridian += 1) {
        const longitude = meridian / 12 * TAU;
        appendLine(Array.from({ length: 73 }, (_, step) => {
            const latitude = -Math.PI / 2 + step / 72 * Math.PI;
            const ring = Math.cos(latitude);
            return {
                x: Math.sin(longitude) * ring,
                y: Math.sin(latitude),
                z: Math.cos(longitude) * ring
            };
        }));
    }
    return guides;
}

export function sphereGuidePathData(segments) {
    return segments.map(([first, second]) => (
        `M${first.x.toFixed(3)} ${first.y.toFixed(3)}L${second.x.toFixed(3)} ${second.y.toFixed(3)}`
    )).join('');
}

export function buildCascadeSphereScene(source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    const width = Number(options.width) || settings.width;
    const height = Number(options.height) || settings.height;
    const radius = Math.min(width, height) * settings.sphereSize / 200;
    const camera = cameraModel(settings);
    const rotation = worldRotation(settings);
    const flatScene = buildCascadeScene(
        { ...settings, surfaceType: 'flat', layoutMode: 'linear' },
        { width, height, generation: options.generation }
    );
    const mesh = tessellatePolygons(flatScene.polygons, width, height);
    const frontPolygons = [];
    const backPolygons = [];

    mesh.forEach((triangle) => {
        const worldPoints = triangle.map((point) => rotateVector(
            uvToSphere(point, width, height),
            rotation.x,
            rotation.y,
            rotation.z
        ));
        const front = projectedPatch(worldPoints, true, width, height, radius, camera);
        if (front) frontPolygons.push(front);
        if (settings.sphereBackside) {
            const back = projectedPatch(worldPoints, false, width, height, radius, camera);
            if (back) backPolygons.push(back);
        }
    });

    frontPolygons.sort((first, second) => first.depth - second.depth);
    backPolygons.sort((first, second) => first.depth - second.depth);
    return {
        settings,
        width,
        height,
        radius,
        center: { x: width / 2, y: height / 2 },
        generation: flatScene.generation,
        flatScene,
        frontPolygons,
        backPolygons,
        backsideOpacity: SPHERE_BACKSIDE_OPACITY,
        guides: buildSphereGuides(settings, rotation, camera, width, height, radius)
    };
}
