export const ARTBOARD_SIZE = 480;
export const ARTBOARD_CENTER = ARTBOARD_SIZE / 2;
export const MAX_ELLIPSES = 8192;

const TAU = Math.PI * 2;
const EPSILON = 1e-7;
const BACKSIDE_OPACITY = 0.2;
const MAX_CAP_ANGULAR_RADIUS = Math.PI * 0.49;
const MAGNET_SAMPLE_RINGS = 6;
const MAGNET_SAMPLES_PER_RING = 24;
const MAGNET_NORMALIZATION_FLOOR = 0.55;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const smoothstep = (value) => {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
};
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const degreesToRadians = (degrees) => Number(degrees || 0) * Math.PI / 180;
const normalize = ({ x, y, z }) => {
    const length = Math.hypot(x, y, z) || 1;
    return { x: x / length, y: y / length, z: z / length };
};

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

function candidateAxes(count = 8192) {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const candidates = [];
    for (let index = 0; index < count; index += 1) {
        const z = 1 - 2 * (index + 0.5) / count;
        const radius = Math.sqrt(Math.max(0, 1 - z * z));
        const angle = index * goldenAngle;
        let vector = normalize({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            z
        });
        if (vector.z < 0 || (Math.abs(vector.z) < EPSILON && vector.y < 0)) {
            vector = { x: -vector.x, y: -vector.y, z: -vector.z };
        }
        candidates.push(vector);
    }
    return candidates;
}

function projectiveDistanceScore(candidate, chosen) {
    let closest = Infinity;
    for (const axis of chosen) {
        const dot = Math.abs(candidate.x * axis.x + candidate.y * axis.y + candidate.z * axis.z);
        closest = Math.min(closest, Math.acos(clamp(dot, -1, 1)));
    }
    return closest;
}

function fastProjectiveDistanceScore(candidate, chosen) {
    let closestDot = 0;
    for (const axis of chosen) {
        closestDot = Math.max(
            closestDot,
            Math.abs(candidate.x * axis.x + candidate.y * axis.y + candidate.z * axis.z)
        );
    }
    return Math.acos(clamp(closestDot, -1, 1));
}

function reverseBits(value, bitCount) {
    let source = value;
    let reversed = 0;
    for (let bit = 0; bit < bitCount; bit += 1) {
        reversed = reversed * 2 + source % 2;
        source = Math.floor(source / 2);
    }
    return reversed;
}

function regularCoreAxes() {
    const halfStep = Math.PI / 9;
    const fullStep = halfStep * 2;
    const cosineDifference = Math.cos(halfStep) - Math.cos(fullStep);
    const latitude = Math.sqrt(cosineDifference / (2 + cosineDifference));
    const ringRadius = Math.sqrt(1 - latitude * latitude);
    const basisX = { x: latitude, y: 0, z: -ringRadius };
    const basisY = { x: 0, y: 1, z: 0 };
    const basisZ = { x: ringRadius, y: 0, z: latitude };

    return Array.from({ length: 9 }, (_, index) => {
        const angle = index * fullStep;
        const source = {
            x: ringRadius * Math.cos(angle),
            y: ringRadius * Math.sin(angle),
            z: latitude
        };
        let axis = {
            x: source.x * basisX.x + source.y * basisX.y + source.z * basisX.z,
            y: source.x * basisY.x + source.y * basisY.y + source.z * basisY.z,
            z: source.x * basisZ.x + source.y * basisZ.y + source.z * basisZ.z
        };
        if (axis.z < 0) axis = { x: -axis.x, y: -axis.y, z: -axis.z };
        return normalize(axis);
    });
}

function icosidodecahedronAxes() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const vertices = [
        [0, 0, phi], [0, 0, -phi],
        [0, phi, 0], [0, -phi, 0],
        [phi, 0, 0], [-phi, 0, 0]
    ];
    [-1, 1].forEach((firstSign) => {
        [-1, 1].forEach((secondSign) => {
            [-1, 1].forEach((thirdSign) => {
                const source = [firstSign * 0.5, secondSign * phi / 2, thirdSign * phi * phi / 2];
                vertices.push(
                    source,
                    [source[1], source[2], source[0]],
                    [source[2], source[0], source[1]]
                );
            });
        });
    });
    return vertices
        .map(([x, y, z]) => normalize({ x, y, z }))
        .filter((axis) => axis.z > EPSILON
            || (Math.abs(axis.z) <= EPSILON && axis.y > EPSILON)
            || (Math.abs(axis.z) <= EPSILON && Math.abs(axis.y) <= EPSILON && axis.x > 0))
        .map((axis, index) => Object.freeze({
            ...axis,
            group: index === 0 ? 'center' : index < 9 ? 'core' : 'field',
            pairIndex: index
        }));
}

const ICOSIDODECAHEDRON_AXES = Object.freeze(icosidodecahedronAxes());

function buildAxisSequence() {
    const chosen = regularCoreAxes();
    const candidates = candidateAxes();
    const separations = [Math.PI];
    for (let index = 1; index < chosen.length; index += 1) {
        separations[index] = Math.min(
            separations[index - 1],
            projectiveDistanceScore(chosen[index], chosen.slice(0, index))
        );
    }
    const scores = candidates.map((candidate) => projectiveDistanceScore(candidate, chosen));
    const greedyLimit = Math.min(MAX_ELLIPSES, 2048);
    while (chosen.length < greedyLimit) {
        let bestIndex = -1;
        let bestScore = -Infinity;
        for (let index = 0; index < candidates.length; index += 1) {
            if (scores[index] > bestScore) {
                bestIndex = index;
                bestScore = scores[index];
            }
        }
        const best = candidates[bestIndex];
        chosen.push(best);
        separations.push(Math.min(separations.at(-1), bestScore));
        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            const dotProduct = Math.abs(
                candidate.x * best.x + candidate.y * best.y + candidate.z * best.z
            );
            scores[index] = Math.min(scores[index], Math.acos(clamp(dotProduct, -1, 1)));
        }
    }
    if (chosen.length < MAX_ELLIPSES) {
        const extensionCandidates = candidateAxes(MAX_ELLIPSES * 4);
        const bitCount = Math.ceil(Math.log2(extensionCandidates.length));
        const minimumDistance = Math.acos(0.99998);
        for (let step = 0; step < extensionCandidates.length; step += 1) {
            if (chosen.length >= MAX_ELLIPSES) break;
            const candidate = extensionCandidates[reverseBits(step, bitCount)];
            const distance = fastProjectiveDistanceScore(candidate, chosen);
            if (distance < minimumDistance) continue;
            chosen.push(candidate);
            separations.push(Math.min(separations.at(-1), distance));
        }
    }
    return {
        axes: Object.freeze(chosen.map((axis, index) => Object.freeze({
            ...axis,
            group: index === 0 ? 'center' : index < 9 ? 'core' : 'field',
            pairIndex: index
        }))),
        separations: Object.freeze(separations)
    };
}

const AXIS_SEQUENCE = buildAxisSequence();
export const SPHERE_AXES = AXIS_SEQUENCE.axes;

const TESSELLATION_CACHE = new Map();
const PROGRESSIVE_CACHE = new Map();
const RING_CACHE = new Map();
const SEPARATION_CACHE = new WeakMap();

function progressiveAxes(count) {
    if (PROGRESSIVE_CACHE.has(count)) return PROGRESSIVE_CACHE.get(count);
    const axes = Object.freeze(SPHERE_AXES.slice(0, count));
    SEPARATION_CACHE.set(axes, AXIS_SEQUENCE.separations[count - 1]);
    PROGRESSIVE_CACHE.set(count, axes);
    return axes;
}

function relaxedTessellationAxes(count) {
    if (TESSELLATION_CACHE.has(count)) return TESSELLATION_CACHE.get(count);
    if (count > 128) {
        const result = progressiveAxes(count);
        TESSELLATION_CACHE.set(count, result);
        return result;
    }
    let axes = SPHERE_AXES.slice(0, count).map((axis) => ({ x: axis.x, y: axis.y, z: axis.z }));
    const iterations = 90;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const maximumMove = mix(0.035, 0.0015, iteration / (iterations - 1));
        axes = axes.map((point, index) => {
            if (index === 0) return { x: 0, y: 0, z: 1 };
            const force = { x: 0, y: 0, z: 0 };
            axes.forEach((other, otherIndex) => {
                [-1, 1].forEach((side) => {
                    if (side === 1 && index === otherIndex) return;
                    const target = { x: other.x * side, y: other.y * side, z: other.z * side };
                    const dx = point.x - target.x;
                    const dy = point.y - target.y;
                    const dz = point.z - target.z;
                    const distanceSquared = Math.max(1e-5, dx * dx + dy * dy + dz * dz);
                    const weight = 1 / (distanceSquared * Math.sqrt(distanceSquared));
                    force.x += dx * weight;
                    force.y += dy * weight;
                    force.z += dz * weight;
                });
            });
            const radial = dot(force, point);
            const tangent = {
                x: force.x - point.x * radial,
                y: force.y - point.y * radial,
                z: force.z - point.z * radial
            };
            const magnitude = Math.hypot(tangent.x, tangent.y, tangent.z);
            if (magnitude <= EPSILON) return point;
            const move = Math.min(maximumMove, magnitude * 0.004);
            return normalize({
                x: point.x + tangent.x / magnitude * move,
                y: point.y + tangent.y / magnitude * move,
                z: point.z + tangent.z / magnitude * move
            });
        });
    }
    const result = Object.freeze(axes.map((axis, index) => Object.freeze({
        ...axis,
        group: index === 0 ? 'center' : index < 9 ? 'core' : 'field',
        pairIndex: index
    })));
    TESSELLATION_CACHE.set(count, result);
    return result;
}

function ringTopologyAxes(count) {
    if (RING_CACHE.has(count)) return RING_CACHE.get(count);
    if (count === 1) return SPHERE_AXES.slice(0, 1);
    const ringCount = Math.max(1, Math.round(Math.sqrt((count - 1) / 2)));
    const weights = Array.from({ length: ringCount }, (_, index) => {
        const polar = (index + 1) / (ringCount + 0.35) * Math.PI / 2;
        return Math.sin(polar);
    });
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const allocations = weights.map((weight) => Math.max(1, Math.floor((count - 1) * weight / weightTotal)));
    while (allocations.reduce((sum, value) => sum + value, 0) < count - 1) {
        const index = allocations.indexOf(Math.min(...allocations));
        allocations[index] += 1;
    }
    while (allocations.reduce((sum, value) => sum + value, 0) > count - 1) {
        const index = allocations.lastIndexOf(Math.max(...allocations));
        if (allocations[index] > 1) allocations[index] -= 1;
    }
    const axes = [{ x: 0, y: 0, z: 1 }];
    allocations.forEach((amount, ringIndex) => {
        const polar = (ringIndex + 1) / (ringCount + 0.35) * Math.PI / 2;
        const phase = ringIndex % 2 ? Math.PI / amount : 0;
        for (let index = 0; index < amount; index += 1) {
            const angle = phase + index / amount * TAU;
            axes.push({
                x: Math.sin(polar) * Math.cos(angle),
                y: Math.sin(polar) * Math.sin(angle),
                z: Math.cos(polar)
            });
        }
    });
    const result = Object.freeze(axes.map((axis, index) => Object.freeze({
        ...axis,
        group: index === 0 ? 'center' : index < 9 ? 'core' : 'field',
        pairIndex: index
    })));
    RING_CACHE.set(count, result);
    return result;
}

function axesForSettings(settings) {
    const count = Math.ceil(settings.ellipseCount);
    if (settings.topologyMode === 'progressive') return progressiveAxes(count);
    if (settings.topologyMode === 'rings') return ringTopologyAxes(count);
    if (settings.topologyMode === 'packed' && count === 15) return ICOSIDODECAHEDRON_AXES;
    return relaxedTessellationAxes(count);
}

export function defaultSettings() {
    return {
        width: ARTBOARD_SIZE,
        height: ARTBOARD_SIZE,
        ellipseCount: 15,
        diameter: 130,
        packingCoverage: 100,
        sphereRadius: 224,
        perspective: 50,
        topologyMode: 'packed',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        magnetRadius: 42,
        magnetX: ARTBOARD_CENTER,
        magnetY: ARTBOARD_CENTER,
        magnetFollow: true,
        showMagnetField: true,
        preventOverlap: true,
        overlapGap: 4,
        showGuides: false,
        showBackside: false,
        ellipseColor: '#ffffff',
        backgroundColor: '#000000',
        animationMode: 'static',
        animationFrom: 1,
        duration: 5,
        rotationAnimation: {
            axis: 'y',
            degrees: 360,
            duration: 3,
            easing: 'smootherstep',
            coordinateMode: 'screen'
        },
        overrides: {}
    };
}

export function normalizeSettings(source = {}) {
    const defaults = defaultSettings();
    const settings = { ...defaults, ...source };
    settings.ellipseCount = clamp(Number(settings.ellipseCount) || defaults.ellipseCount, 1, MAX_ELLIPSES);
    settings.diameter = clamp(Number(settings.diameter) || defaults.diameter, 1, 480);
    settings.packingCoverage = clamp(Number(settings.packingCoverage) || defaults.packingCoverage, 1, 200);
    settings.sphereRadius = clamp(Number(settings.sphereRadius) || 190, 1, ARTBOARD_CENTER);
    settings.perspective = clamp(Number(settings.perspective) || 0, 0, 100);
    const legacyRotationCoordinates = source.rotationCoordinateMode !== 'screen';
    const sourceRotationX = finiteOr(source.rotationX, defaults.rotationX);
    const sourceRotationY = finiteOr(source.rotationY, defaults.rotationY);
    settings.rotationX = legacyRotationCoordinates ? sourceRotationY : sourceRotationX;
    settings.rotationY = legacyRotationCoordinates ? sourceRotationX : sourceRotationY;
    settings.rotationZ = Number(settings.rotationZ) || 0;
    settings.rotationCoordinateMode = 'screen';
    settings.magnetStrength = clamp(Number(settings.magnetStrength) || 0, 0, 200);
    settings.magnetRadius = clamp(Number(settings.magnetRadius) || 42, 5, 100);
    settings.magnetX = clamp(finiteOr(settings.magnetX, ARTBOARD_CENTER), 0, ARTBOARD_SIZE);
    settings.magnetY = clamp(finiteOr(settings.magnetY, ARTBOARD_CENTER), 0, ARTBOARD_SIZE);
    settings.showMagnetField = Boolean(settings.showMagnetField);
    settings.overlapGap = clamp(Number(settings.overlapGap) || 0, 0, 100);
    settings.animationFrom = clamp(Number(settings.animationFrom) || 1, 1, settings.ellipseCount);
    settings.duration = clamp(Number(settings.duration) || 5, 1, 10);
    settings.animationMode = settings.animationMode === 'grow' ? 'grow' : 'static';
    settings.topologyMode = ['packed', 'tessellated', 'progressive', 'rings'].includes(settings.topologyMode)
        ? settings.topologyMode
        : defaults.topologyMode;
    const rotationAnimation = settings.rotationAnimation
        && typeof settings.rotationAnimation === 'object'
        ? settings.rotationAnimation
        : defaults.rotationAnimation;
    const hasExplicitAnimationAxis = ['x', 'y', 'z'].includes(rotationAnimation.axis);
    const normalizedAnimationAxis = hasExplicitAnimationAxis
        ? rotationAnimation.axis
        : defaults.rotationAnimation.axis;
    const animationAxis = rotationAnimation.coordinateMode !== 'screen' && hasExplicitAnimationAxis
        ? normalizedAnimationAxis === 'x' ? 'y' : normalizedAnimationAxis === 'y' ? 'x' : 'z'
        : normalizedAnimationAxis;
    settings.rotationAnimation = {
        axis: animationAxis,
        degrees: clamp(finiteOr(rotationAnimation.degrees, defaults.rotationAnimation.degrees), -720, 720),
        duration: clamp(finiteOr(rotationAnimation.duration, defaults.rotationAnimation.duration), 0.25, 60),
        easing: ['linear', 'smootherstep'].includes(rotationAnimation.easing)
            ? rotationAnimation.easing
            : defaults.rotationAnimation.easing,
        coordinateMode: 'screen'
    };
    settings.overrides = settings.overrides && typeof settings.overrides === 'object'
        ? structuredClone(settings.overrides)
        : {};
    return settings;
}

function minimumPointSeparation(axes) {
    if (SEPARATION_CACHE.has(axes)) return SEPARATION_CACHE.get(axes);
    const points = activeSpherePoints(axes);
    let separation = Math.PI;
    for (let first = 0; first < points.length; first += 1) {
        for (let second = first + 1; second < points.length; second += 1) {
            separation = Math.min(separation, Math.acos(clamp(dot(points[first], points[second]), -1, 1)));
        }
    }
    SEPARATION_CACHE.set(axes, separation);
    return separation;
}

function packedBaseAngularRadii(settings, axes) {
    const points = activeSpherePoints(axes);
    const gap = settings.preventOverlap
        ? settings.overlapGap / Math.max(EPSILON, settings.sphereRadius)
        : 0;
    const minimumRadius = screenRadiusToAngular(0.5, settings.sphereRadius);
    if (axes.length > 128) {
        const uniformRadius = Math.max(
            minimumRadius,
            (minimumPointSeparation(axes) - gap) * 0.5
        );
        return Array(points.length).fill(uniformRadius);
    }
    return points.map((point, index) => {
        let nearest = Math.PI;
        points.forEach((other, otherIndex) => {
            if (index === otherIndex) return;
            nearest = Math.min(nearest, Math.acos(clamp(dot(point, other), -1, 1)));
        });
        return Math.max(minimumRadius, (nearest - gap) * 0.5);
    });
}

function geometryLimitsForNormalizedSettings(settings) {
    const axes = axesForSettings(settings);
    const separation = minimumPointSeparation(axes);
    const minimumRadius = screenRadiusToAngular(0.5, settings.sphereRadius);
    const physicalDiameterMax = 2 * settings.sphereRadius * Math.sin(MAX_CAP_ANGULAR_RADIUS);
    const gapMax = Math.max(0, Math.min(
        100,
        (separation - minimumRadius * 2) * settings.sphereRadius
    ));
    const effectiveGap = settings.preventOverlap ? settings.overlapGap : 0;
    const noOverlapRadius = Math.max(
        minimumRadius,
        (separation - effectiveGap / Math.max(EPSILON, settings.sphereRadius)) * 0.5
    );
    const diameterMax = settings.preventOverlap && settings.topologyMode !== 'packed'
        ? Math.min(physicalDiameterMax, 2 * settings.sphereRadius * Math.sin(noOverlapRadius))
        : physicalDiameterMax;
    let coverageMax = settings.preventOverlap ? 100 : 200;
    if (settings.topologyMode === 'packed' && !settings.preventOverlap) {
        const packedRadii = packedBaseAngularRadii({ ...settings, overlapGap: effectiveGap }, axes);
        const largestPackedRadius = Math.max(...packedRadii);
        coverageMax = Math.min(200, MAX_CAP_ANGULAR_RADIUS / Math.max(EPSILON, largestPackedRadius) * 100);
    }
    return { diameterMax, gapMax, coverageMax };
}

export function geometryControlLimits(source = {}) {
    return geometryLimitsForNormalizedSettings(normalizeSettings(source));
}

export function constrainSettings(source = {}) {
    const settings = normalizeSettings(source);
    const limits = geometryLimitsForNormalizedSettings(settings);
    settings.diameter = Math.min(settings.diameter, Math.max(1, limits.diameterMax));
    settings.packingCoverage = Math.min(settings.packingCoverage, limits.coverageMax);
    return settings;
}

export function animatedEllipseCount(settings, timeSeconds = 0) {
    if (settings.animationMode !== 'grow') return settings.ellipseCount;
    const duration = Math.max(1, Number(settings.duration) || 5);
    const phase = ((Number(timeSeconds) || 0) / duration) % 1;
    const loop = (1 - Math.cos(TAU * phase)) / 2;
    const eased = smoothstep(loop);
    return mix(settings.animationFrom, settings.ellipseCount, eased);
}

function activationForPair(pairIndex, visibleCount) {
    return smoothstep(visibleCount - pairIndex);
}

function perspectiveDistance(perspective) {
    if (perspective <= EPSILON) return Infinity;
    const amount = perspective / 100;
    return 1.04 + 4 * ((1 - amount) / amount) ** 2;
}

function cameraModel(settings) {
    const distance = perspectiveDistance(settings.perspective);
    if (!Number.isFinite(distance)) return { distance, framing: 1, horizonZ: 0 };
    return {
        distance,
        framing: distance / Math.sqrt(distance * distance - 1),
        horizonZ: 1 / distance
    };
}

function projectPoint(point, settings, camera = cameraModel(settings)) {
    const cameraScale = Number.isFinite(camera.distance)
        ? camera.distance / Math.max(0.01, camera.distance - point.z)
        : 1;
    const scale = cameraScale / camera.framing;
    return {
        x: ARTBOARD_CENTER + point.x * settings.sphereRadius * scale,
        y: ARTBOARD_CENTER + point.y * settings.sphereRadius * scale,
        z: point.z,
        scale
    };
}

function screenToSurface(x, y, settings) {
    let nx = (x - ARTBOARD_CENTER) / settings.sphereRadius;
    let ny = (y - ARTBOARD_CENTER) / settings.sphereRadius;
    const screenRadius = Math.hypot(nx, ny);
    if (screenRadius >= 1) {
        nx *= 0.999 / screenRadius;
        ny *= 0.999 / screenRadius;
    }
    const camera = cameraModel(settings);
    if (!Number.isFinite(camera.distance)) {
        return { x: nx, y: ny, z: Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) };
    }
    const imageX = nx * camera.framing;
    const imageY = ny * camera.framing;
    const distanceSquared = camera.distance * camera.distance;
    const a = imageX * imageX + imageY * imageY + distanceSquared;
    const b = -2 * distanceSquared;
    const c = distanceSquared - 1;
    const discriminant = Math.max(0, b * b - 4 * a * c);
    const time = (-b - Math.sqrt(discriminant)) / (2 * a);
    return normalize({
        x: imageX * time,
        y: imageY * time,
        z: camera.distance * (1 - time)
    });
}

function magnetAngularRadius(settings) {
    return mix(degreesToRadians(8), degreesToRadians(105), settings.magnetRadius / 100);
}

function magnetPointInfluence(point, target, radius) {
    const cosine = clamp(dot(point, target), -1, 1);
    const angle = Math.acos(cosine);
    return clamp(1 - angle / Math.max(EPSILON, radius), 0, 1);
}

function magnetInfluence(normal, markAngularRadius, settings, transientMagnet) {
    if (settings.magnetStrength <= 0) return 0;
    const target = screenToSurface(
        transientMagnet?.x ?? settings.magnetX,
        transientMagnet?.y ?? settings.magnetY,
        settings
    );
    const radius = magnetAngularRadius(settings);
    const capRadius = clamp(Number(markAngularRadius) || 0, 0, MAX_CAP_ANGULAR_RADIUS);
    const basis = tangentBasis(normal);
    let influenceTotal = magnetPointInfluence(normal, target, radius);
    let centeredTotal = 1;
    let sampleCount = 1;

    // Equal-area rings approximate how much of the unscaled spherical mark overlaps the field.
    for (let ring = 0; ring < MAGNET_SAMPLE_RINGS; ring += 1) {
        const sampleRadius = capRadius * Math.sqrt((ring + 0.5) / MAGNET_SAMPLE_RINGS);
        const cosine = Math.cos(sampleRadius);
        const sine = Math.sin(sampleRadius);
        const centeredInfluence = clamp(1 - sampleRadius / Math.max(EPSILON, radius), 0, 1);
        for (let step = 0; step < MAGNET_SAMPLES_PER_RING; step += 1) {
            const angle = step / MAGNET_SAMPLES_PER_RING * TAU;
            const sample = {
                x: normal.x * cosine + (basis.first.x * Math.cos(angle) + basis.second.x * Math.sin(angle)) * sine,
                y: normal.y * cosine + (basis.first.y * Math.cos(angle) + basis.second.y * Math.sin(angle)) * sine,
                z: normal.z * cosine + (basis.first.z * Math.cos(angle) + basis.second.z * Math.sin(angle)) * sine
            };
            influenceTotal += magnetPointInfluence(sample, target, radius);
            centeredTotal += centeredInfluence;
            sampleCount += 1;
        }
    }

    const areaAverage = influenceTotal / sampleCount;
    const centeredAverage = centeredTotal / sampleCount;
    return Math.sqrt(clamp(
        areaAverage / Math.max(MAGNET_NORMALIZATION_FLOOR, centeredAverage),
        0,
        1
    ));
}

function cross(first, second) {
    return {
        x: first.y * second.z - first.z * second.y,
        y: first.z * second.x - first.x * second.z,
        z: first.x * second.y - first.y * second.x
    };
}

function dot(first, second) {
    return first.x * second.x + first.y * second.y + first.z * second.z;
}

function tangentBasis(center) {
    const reference = Math.abs(center.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    const first = normalize(cross(reference, center));
    return { first, second: normalize(cross(center, first)) };
}

function screenRadiusToAngular(radius, sphereRadius) {
    return Math.asin(clamp(
        radius / Math.max(EPSILON, sphereRadius),
        0,
        Math.sin(MAX_CAP_ANGULAR_RADIUS)
    ));
}

function activeSpherePoints(axes) {
    const points = [];
    axes.forEach((axis) => {
        points.push(axis, { x: -axis.x, y: -axis.y, z: -axis.z });
    });
    return points;
}

function noOverlapAngularLimit(settings, axes) {
    if (!settings.preventOverlap) return MAX_CAP_ANGULAR_RADIUS;
    const separation = minimumPointSeparation(axes);
    const angularGap = settings.overlapGap / Math.max(EPSILON, settings.sphereRadius);
    return Math.max(screenRadiusToAngular(0.5, settings.sphereRadius), (separation - angularGap) * 0.5);
}

function convexHull(points) {
    if (points.length < 3) return [];
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const turn = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const lower = [];
    for (const point of sorted) {
        while (lower.length >= 2 && turn(lower.at(-2), lower.at(-1), point) <= EPSILON) lower.pop();
        lower.push(point);
    }
    const upper = [];
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
        const point = sorted[index];
        while (upper.length >= 2 && turn(upper.at(-2), upper.at(-1), point) <= EPSILON) upper.pop();
        upper.push(point);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}

function sphericalCapPolygon(center, angularRadius, settings, front, camera) {
    const cosine = Math.cos(angularRadius);
    const sine = Math.sin(angularRadius);
    const basis = tangentBasis(center);
    const candidates = [];
    const samples = 96;
    for (let step = 0; step < samples; step += 1) {
        const angle = step / samples * TAU;
        const point = {
            x: center.x * cosine + (basis.first.x * Math.cos(angle) + basis.second.x * Math.sin(angle)) * sine,
            y: center.y * cosine + (basis.first.y * Math.cos(angle) + basis.second.y * Math.sin(angle)) * sine,
            z: center.z * cosine + (basis.first.z * Math.cos(angle) + basis.second.z * Math.sin(angle)) * sine
        };
        if (front ? point.z >= camera.horizonZ - EPSILON : point.z <= camera.horizonZ + EPSILON) {
            candidates.push(projectPoint(point, settings, camera));
        }
    }

    const silhouetteRadius = Math.sqrt(Math.max(0, 1 - camera.horizonZ * camera.horizonZ));
    for (let step = 0; step < samples; step += 1) {
        const angle = step / samples * TAU;
        const point = {
            x: Math.cos(angle) * silhouetteRadius,
            y: Math.sin(angle) * silhouetteRadius,
            z: camera.horizonZ
        };
        if (dot(point, center) >= cosine - EPSILON) candidates.push(projectPoint(point, settings, camera));
    }
    return convexHull(candidates);
}

function pointsToPath(points) {
    if (points.length < 3) return '';
    return `M${points.map((point) => `${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join('L')}Z`;
}

function boundsForPolygons(polygons, fallback) {
    const points = polygons.flat().filter(Boolean);
    if (!points.length) return { cx: fallback.x, cy: fallback.y, rx: 0, ry: 0 };
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
}

function appendWireSegment(paths, first, second) {
    const bucket = (first.z + second.z) * 0.5 < paths.horizonZ ? paths.back : paths.front;
    bucket.push(`M${first.x.toFixed(2)} ${first.y.toFixed(2)}L${second.x.toFixed(2)} ${second.y.toFixed(2)}`);
}

function buildWireframe(settings, rotation) {
    if (!settings.showGuides) return { frontPath: '', backPath: '' };
    const camera = cameraModel(settings);
    const paths = { front: [], back: [], horizonZ: camera.horizonZ };
    const latitudeSteps = 72;
    [-60, -30, 0, 30, 60].forEach((latitude) => {
        const lat = degreesToRadians(latitude);
        const ringRadius = Math.cos(lat);
        let previous = null;
        for (let step = 0; step <= latitudeSteps; step += 1) {
            const longitude = step / latitudeSteps * TAU;
            const source = {
                x: ringRadius * Math.cos(longitude),
                y: Math.sin(lat),
                z: ringRadius * Math.sin(longitude)
            };
            const point = projectPoint(rotateVector(source, rotation.x, rotation.y, rotation.z), settings, camera);
            if (previous) appendWireSegment(paths, previous, point);
            previous = point;
        }
    });
    const meridianSteps = 72;
    for (let meridian = 0; meridian < 12; meridian += 1) {
        const longitude = meridian / 12 * TAU;
        let previous = null;
        for (let step = 0; step <= meridianSteps; step += 1) {
            const latitude = -Math.PI / 2 + step / meridianSteps * Math.PI;
            const source = {
                x: Math.cos(latitude) * Math.cos(longitude),
                y: Math.sin(latitude),
                z: Math.cos(latitude) * Math.sin(longitude)
            };
            const point = projectPoint(rotateVector(source, rotation.x, rotation.y, rotation.z), settings, camera);
            if (previous) appendWireSegment(paths, previous, point);
            previous = point;
        }
    }
    return {
        frontPath: paths.front.join(''),
        backPath: paths.back.join('')
    };
}

export function worldRotationForScreenSettings(settings, options = {}) {
    return {
        x: finiteOr(settings.rotationY, 0) + finiteOr(options.rotationY, 0),
        y: finiteOr(settings.rotationX, 0) + finiteOr(options.rotationX, 0),
        z: finiteOr(settings.rotationZ, 0) + finiteOr(options.rotationZ, 0)
    };
}

export function buildGlobalScene(rawSettings, options = {}) {
    const settings = constrainSettings(rawSettings);
    const rotation = worldRotationForScreenSettings(settings, options);
    const visibleCount = options.visibleCount ?? animatedEllipseCount(settings, options.timeSeconds || 0);
    const axes = axesForSettings(settings);
    const camera = cameraModel(settings);
    const baseAngularRadius = screenRadiusToAngular(settings.diameter * 0.5, settings.sphereRadius);
    const packedRadii = settings.topologyMode === 'packed'
        ? packedBaseAngularRadii(settings, axes)
        : null;
    const noOverlapLimit = noOverlapAngularLimit(settings, axes);
    const elements = [];

    axes.forEach((axis, pairIndex) => {
        const activation = activationForPair(pairIndex, visibleCount);
        if (activation <= EPSILON) return;
        [1, -1].forEach((side) => {
            const source = { x: axis.x * side, y: axis.y * side, z: axis.z * side };
            const normal = rotateVector(source, rotation.x, rotation.y, rotation.z);
            const id = `${pairIndex}:${side > 0 ? 'a' : 'b'}`;
            const override = settings.overrides[id];
            const pointIndex = pairIndex * 2 + (side > 0 ? 0 : 1);
            let requestedAngularRadius = packedRadii
                ? packedRadii[pointIndex] * settings.packingCoverage / 100
                : Math.min(baseAngularRadius, noOverlapLimit);
            if (override?.mode === 'fixed') {
                requestedAngularRadius = screenRadiusToAngular(
                    clamp(Number(override.value) || settings.diameter, 1, 480) * 0.5,
                    settings.sphereRadius
                );
            } else if (override) {
                requestedAngularRadius *= clamp(Number(override.value) || 100, 0, 500) / 100;
            }
            const influence = magnetInfluence(
                normal,
                requestedAngularRadius * activation,
                settings,
                options.transientMagnet
            );
            const magnetScale = 1 + settings.magnetStrength / 100 * 1.55 * influence;
            requestedAngularRadius *= magnetScale;
            requestedAngularRadius = clamp(requestedAngularRadius, EPSILON, MAX_CAP_ANGULAR_RADIUS);
            const angularRadius = requestedAngularRadius * activation;
            const frontPoints = sphericalCapPolygon(normal, angularRadius, settings, true, camera);
            const backPoints = settings.showBackside
                ? sphericalCapPolygon(normal, angularRadius, settings, false, camera)
                : [];
            if (frontPoints.length < 3 && backPoints.length < 3) return;
            const projectedCenter = projectPoint(normal, settings, camera);
            const bounds = boundsForPolygons([frontPoints, backPoints], projectedCenter);

            elements.push({
                id,
                pairIndex,
                side,
                group: axis.group,
                ...bounds,
                anchorX: projectedCenter.x,
                anchorY: projectedCenter.y,
                frontPoints,
                backPoints,
                frontPath: pointsToPath(frontPoints),
                backPath: pointsToPath(backPoints),
                angularRadius,
                requestedAngularRadius,
                depth: normal.z,
                activation,
                magnetInfluence: influence,
                overlapScale: activation
            });
        });
    });

    elements.sort((a, b) => a.depth - b.depth || a.pairIndex - b.pairIndex);
    const magnetCenter = screenToSurface(
        options.transientMagnet?.x ?? settings.magnetX,
        options.transientMagnet?.y ?? settings.magnetY,
        settings
    );
    const magnetGuidePoints = settings.magnetStrength > 0 && settings.showMagnetField
        ? sphericalCapPolygon(magnetCenter, magnetAngularRadius(settings), settings, true, camera)
        : [];

    return {
        width: ARTBOARD_SIZE,
        height: ARTBOARD_SIZE,
        center: ARTBOARD_CENTER,
        sphereRadius: settings.sphereRadius,
        visibleCount,
        axes,
        elements,
        backsideOpacity: BACKSIDE_OPACITY,
        noOverlapAngularLimit: noOverlapLimit,
        wireframe: buildWireframe(settings, rotation),
        settings,
        magnet: {
            x: options.transientMagnet?.x ?? settings.magnetX,
            y: options.transientMagnet?.y ?? settings.magnetY,
            path: pointsToPath(magnetGuidePoints)
        }
    };
}

export function visibleElementIds(scene) {
    return scene.elements.filter((element) => element.frontPath || element.backPath).map((element) => element.id);
}

export function coreElementIds(scene) {
    return scene.elements.filter((element) => element.pairIndex < 9).map((element) => element.id);
}

export function centerElementIds(scene) {
    return scene.elements.filter((element) => element.group === 'center').map((element) => element.id);
}
