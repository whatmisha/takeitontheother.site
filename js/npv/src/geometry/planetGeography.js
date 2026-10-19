import { PLANET_DATA } from '../data/planetCountries.js';

const RAD = Math.PI / 180;
const CELL = 10;
const MAX_SOFTNESS = 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const length = (a) => Math.hypot(a.x, a.y, a.z);
const wrap = (value) => ((value + 180) % 360 + 360) % 360 - 180;

export const COUNTRIES = PLANET_DATA.countries;
export const COUNTRY_BY_ID = new Map(COUNTRIES.map((country, index) => [country.id, { ...country, index }]));
export const BOUNDARIES = PLANET_DATA.borders;

export function geographicToSurface(longitude, latitude) {
    const lon = longitude * RAD;
    const lat = latitude * RAD;
    return { x: Math.cos(lat) * Math.sin(lon), y: -Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}

export function surfaceToGeographic(point) {
    return { longitude: Math.atan2(point.x, point.z) / RAD, latitude: -Math.asin(clamp(point.y, -1, 1)) / RAD };
}

function prepareRing(points) {
    // Natural Earth splits most dateline crossings. Unwrap the remaining ones;
    // retain the Antarctic pole closure in the full longitude range.
    const polar = points.some((point) => Math.abs(point[1]) > 89.99);
    const ring = [];
    points.forEach(([longitude, latitude]) => {
        let lon = longitude;
        if (!polar && ring.length) {
            while (lon - ring.at(-1)[0] > 180) lon -= 360;
            while (lon - ring.at(-1)[0] < -180) lon += 360;
        }
        ring.push([lon, latitude]);
    });
    return ring;
}

function ringBounds(ring) {
    return [Math.min(...ring.map((p) => p[0])), Math.min(...ring.map((p) => p[1])), Math.max(...ring.map((p) => p[0])), Math.max(...ring.map((p) => p[1]))];
}

function insideRing(ring, longitude, latitude) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i];
        const b = ring[j];
        if ((a[1] > latitude) !== (b[1] > latitude)
            && longitude < (b[0] - a[0]) * (latitude - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}

const polygons = COUNTRIES.flatMap((country, countryIndex) => country.polygons.map((rings) => {
    const prepared = rings.map(prepareRing);
    return { countryIndex, rings: prepared, bounds: ringBounds(prepared[0]) };
}));

function polygonContains(polygon, longitude, latitude) {
    const [minX, minY, maxX, maxY] = polygon.bounds;
    if (latitude < minY || latitude > maxY) return false;
    const lon = longitude + 360 * Math.round(((minX + maxX) / 2 - longitude) / 360);
    if (lon < minX || lon > maxX || !insideRing(polygon.rings[0], lon, latitude)) return false;
    return !polygon.rings.slice(1).some((ring) => {
        const shift = 360 * Math.round((ring[0][0] - lon) / 360);
        return insideRing(ring, lon + shift, latitude);
    });
}

function cellX(longitude) { return clamp(Math.floor((longitude + 180) / CELL), 0, 35); }
function cellY(latitude) { return clamp(Math.floor((latitude + 90) / CELL), 0, 17); }

function addBounds(grid, bounds, index) {
    const [minX, minY, maxX, maxY] = bounds;
    for (const shift of [-360, 0, 360]) {
        const left = minX + shift;
        const right = maxX + shift;
        if (right < -180 || left > 180) continue;
        for (let y = cellY(minY); y <= cellY(maxY); y += 1) {
            for (let x = cellX(Math.max(-180, left)); x <= cellX(Math.min(180, right)); x += 1) {
                const key = y * 36 + x;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(index);
            }
        }
    }
}

const polygonGrid = new Map();
polygons.forEach((polygon, index) => addBounds(polygonGrid, polygon.bounds, index));
// Tiny enclaves can overlap a simplified surrounding polygon. Pick the smaller
// region first so Vatican City and San Marino remain independently selectable.
polygonGrid.forEach((indices) => indices.sort((a, b) => {
    const area = (polygon) => (polygon.bounds[2] - polygon.bounds[0]) * (polygon.bounds[3] - polygon.bounds[1]);
    return area(polygons[a]) - area(polygons[b]);
}));

export function countryAt(longitude, latitude) {
    const lon = wrap(longitude);
    const candidates = polygonGrid.get(cellY(latitude) * 36 + cellX(lon)) || [];
    for (const index of candidates) {
        const polygon = polygons[index];
        if (polygonContains(polygon, lon, latitude)) return COUNTRIES[polygon.countryIndex];
    }
    return null;
}

const segments = [];
const segmentGrid = new Map();
const countrySegments = new Map();
BOUNDARIES.forEach(([owner, neighbor, points]) => {
    for (let index = 1; index < points.length; index += 1) {
        const first = points[index - 1];
        const second = points[index];
        const a = geographicToSurface(...first);
        const b = geographicToSurface(...second);
        const normal = cross(a, b);
        const magnitude = length(normal);
        if (magnitude < 1e-10) continue;
        const endLon = first[0] + wrap(second[0] - first[0]);
        const segment = { owner, neighbor, a, b, cosine: dot(a, b), normal: { x: normal.x / magnitude, y: normal.y / magnitude, z: normal.z / magnitude } };
        const segmentIndex = segments.push(segment) - 1;
        for (const countryIndex of [owner, neighbor]) {
            if (countryIndex < 0) continue;
            if (!countrySegments.has(countryIndex)) countrySegments.set(countryIndex, []);
            countrySegments.get(countryIndex).push(segment);
        }
        addBounds(segmentGrid, [Math.min(first[0], endLon), Math.min(first[1], second[1]), Math.max(first[0], endLon), Math.max(first[1], second[1])], segmentIndex);
    }
});

function nearbySegments(longitude, latitude) {
    const latitudePadding = MAX_SOFTNESS + 1;
    const longitudePadding = Math.min(180, latitudePadding / Math.cos(Math.min(89, Math.abs(latitude) + latitudePadding) * RAD));
    const result = new Set();
    for (const shift of [-360, 0, 360]) {
        const left = longitude - longitudePadding + shift;
        const right = longitude + longitudePadding + shift;
        if (right < -180 || left > 180) continue;
        for (let y = cellY(latitude - latitudePadding); y <= cellY(latitude + latitudePadding); y += 1) {
            for (let x = cellX(Math.max(-180, left)); x <= cellX(Math.min(180, right)); x += 1) {
                (segmentGrid.get(y * 36 + x) || []).forEach((index) => result.add(index));
            }
        }
    }
    return [...result];
}

function segmentDistance(point, segment) {
    const height = dot(point, segment.normal);
    const projected = { x: point.x - height * segment.normal.x, y: point.y - height * segment.normal.y, z: point.z - height * segment.normal.z };
    const magnitude = length(projected);
    if (magnitude > 1e-10) {
        const q = { x: projected.x / magnitude, y: projected.y / magnitude, z: projected.z / magnitude };
        if (dot(cross(segment.a, q), segment.normal) >= -1e-10
            && dot(cross(q, segment.b), segment.normal) >= -1e-10) {
            return Math.asin(clamp(Math.abs(height), 0, 1)) / RAD;
        }
    }
    return Math.acos(clamp(Math.max(dot(point, segment.a), dot(point, segment.b)), -1, 1)) / RAD;
}

const latticeCache = new WeakMap();

export function geographyForAxes(axes) {
    if (latticeCache.has(axes)) return latticeCache.get(axes);
    const records = [];
    const represented = new Set();
    axes.forEach((axis, pairIndex) => {
        [1, -1].forEach((side) => {
            const point = { x: axis.x * side, y: axis.y * side, z: axis.z * side };
            const { longitude, latitude } = surfaceToGeographic(point);
            const country = countryAt(longitude, latitude);
            const countryIndex = country ? COUNTRY_BY_ID.get(country.id).index : -1;
            if (countryIndex >= 0) represented.add(countryIndex);
            records.push({ point, pairIndex, countryIndex, countryId: country?.id || null, longitude, latitude, nearby: null, coastDistance: null });
        });
    });
    const fallback = new Map();
    COUNTRIES.forEach((country, countryIndex) => {
        if (represented.has(countryIndex)) return;
        // With no center inside a country, use the center closest to its geometry.
        // This also handles small islands far from the country's main landmass.
        const boundary = countrySegments.get(countryIndex) || [];
        let best = Infinity;
        let nearest = 0;
        records.forEach((record, index) => {
            for (const segment of boundary) {
                const distance = segmentDistance(record.point, segment);
                if (distance < best) { best = distance; nearest = index; }
            }
        });
        fallback.set(countryIndex, nearest);
    });
    const result = { records, fallback, masks: new Map() };
    latticeCache.set(axes, result);
    return result;
}

function distanceForRecord(record, isBoundary) {
    record.nearby ??= nearbySegments(record.longitude, record.latitude);
    let distance = MAX_SOFTNESS;
    record.nearby.forEach((index) => {
        const segment = segments[index];
        if (isBoundary(segment)) distance = Math.min(distance, segmentDistance(record.point, segment));
    });
    return distance;
}

function feather(distance, softness) {
    if (softness <= 0) return 1;
    const t = clamp(distance / softness, 0, 1);
    return t * t * (3 - 2 * t);
}

export function planetMaskForAxes(axes, settings) {
    const geography = geographyForAxes(axes);
    const selectedIds = [...new Set(settings.selectedCountries || [])].filter((id) => COUNTRY_BY_ID.has(id)).sort();
    const selected = new Set(selectedIds.map((id) => COUNTRY_BY_ID.get(id).index));
    const key = JSON.stringify([selectedIds, settings.landSoftness, settings.countrySoftness]);
    let weights = geography.masks.get(key);
    if (!weights) {
        const fallbackAt = new Map();
        selected.forEach((countryIndex) => {
            if (!geography.fallback.has(countryIndex)) return;
            const index = geography.fallback.get(countryIndex);
            if (!fallbackAt.has(index)) fallbackAt.set(index, []);
            fallbackAt.get(index).push(COUNTRIES[countryIndex].id);
        });
        weights = geography.records.map((record, index) => {
            const fallbackCountryIds = fallbackAt.get(index) || [];
            const forced = fallbackCountryIds.length > 0;
            let landInfluence = record.countryIndex >= 0 ? 1 : 0;
            if (landInfluence && settings.landSoftness > 0) {
                record.coastDistance ??= distanceForRecord(record, (segment) => segment.neighbor === -1);
                landInfluence = feather(record.coastDistance, settings.landSoftness);
            }
            let countryInfluence = selected.has(record.countryIndex) ? 1 : 0;
            if (countryInfluence && settings.countrySoftness > 0) {
                const distance = distanceForRecord(record, (segment) => selected.has(segment.owner) !== selected.has(segment.neighbor));
                countryInfluence = feather(distance, settings.countrySoftness);
            }
            // The guaranteed representative gets the full land and group factors.
            if (forced) { landInfluence = 1; countryInfluence = 1; }
            return { landInfluence, countryInfluence, countryId: record.countryId, fallbackCountryIds };
        });
        if (geography.masks.size >= 6) geography.masks.delete(geography.masks.keys().next().value);
        geography.masks.set(key, weights);
    }
    return weights.map((weight) => ({ ...weight, surfaceScale: (1 + settings.landGrowth / 100 * weight.landInfluence) * (1 + settings.countryGrowth / 100 * weight.countryInfluence) }));
}

export function searchCountries(query = '') {
    const normalize = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
    const search = normalize(query.trim());
    return COUNTRIES.filter((country) => !search || normalize([country.name, country.nameRu, country.id, ...country.aliases].join(' ')).includes(search))
        .sort((a, b) => a.name.localeCompare(b.name));
}
