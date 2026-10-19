import test from 'node:test';
import assert from 'node:assert/strict';
import { PresetManager, SEEDED_PRESETS } from '../src/core/presets.js';
import { PLANET_PRESETS, planetDefaults } from '../src/core/planetPresets.js';
import { axesForSettings, constrainSettings, projectPoint, rotateVector, worldRotationForScreenSettings } from '../src/geometry/globalGeometry.js';
import { COUNTRIES, COUNTRY_BY_ID, countryAt, geographicToSurface, geographyForAxes, planetMaskForAxes, searchCountries } from '../src/geometry/planetGeography.js';
import { buildPlanetScene, countryAtScreen } from '../src/geometry/planetGeometry.js';
import { sceneToSvgString } from '../src/render/globalRenderer.js';

const settings = (patch = {}) => constrainSettings({ ...planetDefaults(), ...patch });
const axes = axesForSettings(settings());

test('Planet inherits Main Draft geometry with separate built-in presets', () => {
    const state = planetDefaults();
    for (const key of ['ellipseCount', 'diameter', 'sphereRadius', 'topologyMode', 'perspective']) {
        assert.equal(state[key], SEEDED_PRESETS['Main Draft'][key]);
    }
    assert.equal(state.showCountryBorders, false);
    assert.deepEqual(state.selectedCountries, []);
    const manager = new PresetManager(state, { builtIns: PLANET_PRESETS, storageKey: 'planetTest', defaultName: 'Planet' });
    assert.deepEqual(manager.names(), ['Planet']);
    assert.equal(manager.get('Planet').planetMode, true);
    assert.equal(manager.get('Main Draft'), null);
    assert.equal(manager.save('Planet', {}), false);
});

test('geographic masks include overseas territories, microstates and polar land', () => {
    assert.ok(COUNTRIES.length >= 190);
    for (const [lon, lat, id] of [
        [2.35, 48.85, 'FRA'], [-53, 4, 'FRA'], [-149.6, -17.6, 'FRA'],
        [12.433, 41.902, 'VAT'], [7.4, 43.75, 'MCO'], [12.44, 43.95, 'SMR'],
        [0, -89, 'ATA'], [178.4, -17.8, 'FJI'], [-179.95, -16.5, 'FJI'],
        [179, 65, 'RUS'], [-179, 67, 'RUS']
    ]) assert.equal(countryAt(lon, lat)?.id, id, `${lon}, ${lat}`);
    assert.equal(countryAt(0, 0), null);
    assert.equal(countryAt(0, 89), null);
    assert.equal(searchCountries('Франция')[0].id, 'FRA');
    assert.equal(searchCountries('French Polynesia')[0].id, 'FRA');
    assert.equal(searchCountries('Vatican')[0].id, 'VAT');
    assert.equal(searchCountries('Palestine')[0].id, 'PSX');
    assert.equal(searchCountries('Falkland')[0].id, 'GBR');
});

test('country growth multiplies land growth and a selected group applies only once', () => {
    const state = settings({ selectedCountries: ['FRA', 'DEU', 'FRA'], landGrowth: 100, countryGrowth: 200 });
    const mask = planetMaskForAxes(axes, state);
    const ocean = mask.filter((mark) => !mark.landInfluence);
    const land = mask.filter((mark) => mark.landInfluence && !mark.countryInfluence);
    const group = mask.filter((mark) => mark.countryInfluence);
    assert.ok(ocean.length && land.length && group.length);
    ocean.forEach((mark) => assert.equal(mark.surfaceScale, 1));
    land.forEach((mark) => assert.equal(mark.surfaceScale, 2));
    group.forEach((mark) => assert.equal(mark.surfaceScale, 6));
});

test('a country without a lattice center gets exactly one full-strength representative', () => {
    const geography = geographyForAxes(axes);
    const vatican = COUNTRY_BY_ID.get('VAT');
    assert.ok(geography.fallback.has(vatican.index));
    const state = settings({ selectedCountries: ['VAT'], landGrowth: 100, countryGrowth: 200, landSoftness: 10, countrySoftness: 10 });
    const mask = planetMaskForAxes(axes, state);
    const representatives = mask.map((mark, index) => ({ ...mark, index })).filter((mark) => mark.fallbackCountryIds.includes('VAT'));
    assert.equal(representatives.length, 1);
    assert.equal(representatives[0].surfaceScale, 6);
    assert.equal(mask.filter((mark) => mark.countryInfluence > 0).length, 1);
    assert.equal(representatives[0].index, geography.fallback.get(vatican.index));
    // The representative is the closest lattice point to the microstate, not a new point.
    const center = geographicToSurface(12.433, 41.902);
    const score = (record) => record.point.x * center.x + record.point.y * center.y + record.point.z * center.z;
    const best = Math.max(...geography.records.map(score));
    assert.ok(best - score(geography.records[representatives[0].index]) < 1e-4);
});

test('land softness uses coasts and group softness removes shared internal borders', () => {
    // Main Draft can miss a narrow frontier. Include a deterministic reference
    // point near the Rhine so the test checks the shared border itself.
    const borderAxes = [...axes, geographicToSurface(7.8, 49)];
    const geography = geographyForAxes(borderAxes);
    const single = planetMaskForAxes(borderAxes, settings({ selectedCountries: ['FRA'], countrySoftness: 5 }));
    const combined = planetMaskForAxes(borderAxes, settings({ selectedCountries: ['FRA', 'DEU'], countrySoftness: 5, landSoftness: 2 }));
    const frontier = geography.records.map((record, index) => ({ ...record, index })).filter((record) => record.countryId === 'FRA'
        && record.longitude > 5 && record.latitude > 47 && record.latitude < 50);
    assert.ok(frontier.length);
    assert.ok(frontier.some((record) => combined[record.index].countryInfluence > single[record.index].countryInfluence + 0.05));
    assert.ok(frontier.some((record) => combined[record.index].landInfluence > 0.99));
    assert.ok(combined.some((mark) => mark.landInfluence > 0 && mark.landInfluence < 1));
    combined.filter((mark) => !mark.countryId && !mark.fallbackCountryIds.length).forEach((mark) => assert.equal(mark.landInfluence, 0));
});

test('surface picking follows all rotation axes and perspective, and rejects points outside the globe', () => {
    const point = geographicToSurface(2.35, 48.85);
    for (const perspective of [0, 65, 100]) {
        const state = settings({ perspective, rotationX: -7, rotationY: -44, rotationZ: 17 });
        const rotation = worldRotationForScreenSettings(state);
        const projected = projectPoint(rotateVector(point, rotation.x, rotation.y, rotation.z), state);
        assert.equal(countryAtScreen(projected.x, projected.y, state)?.id, 'FRA');
        assert.equal(countryAtScreen(0, 0, state), null);
    }
});

test('geographic sizes stay attached to points during rotation and survive clean SVG export', () => {
    const state = settings({ ellipseCount: 350, selectedCountries: ['FRA', 'VAT'], showBackside: true });
    const first = buildPlanetScene(state);
    const rotated = buildPlanetScene({ ...state, rotationX: 123, rotationY: 42, rotationZ: -18 });
    const byId = new Map(first.elements.map((mark) => [mark.id, mark]));
    assert.equal(first.elements.length, 700);
    rotated.elements.forEach((mark) => {
        const original = byId.get(mark.id);
        assert.equal(mark.countryId, original.countryId);
        assert.equal(mark.surfaceScale, original.surfaceScale);
        assert.equal(mark.angularRadius, original.angularRadius);
    });
    assert.equal(first.planet, null);
    const guides = buildPlanetScene({ ...state, showCountryBorders: true });
    assert.ok(guides.planet.normal.length > 100);
    assert.ok(guides.planet.selected.length > 100);
    assert.doesNotMatch(guides.planet.normal, /NaN|Infinity/);
    assert.equal(buildPlanetScene({ ...state, showCountryBorders: true }, { includeGeographyGuides: false }).planet, null);
    const svg = sceneToSvgString(guides);
    assert.doesNotMatch(svg, /guide|outline|data-country/);
    assert.equal((svg.match(/<path /g) || []).length, guides.elements.filter((mark) => mark.frontPath).length + guides.elements.filter((mark) => mark.backPath).length);
});

test('Planet settings sanitize imported state and keep zero growth and fractional softness', () => {
    const state = settings({ landGrowth: 0, countryGrowth: -20, landSoftness: 0.7, countrySoftness: 99,
        selectedCountries: ['FRA', 'FRA', null, '<script>'], magnetStrength: 150, magnetFollow: true });
    assert.equal(state.landGrowth, 0);
    assert.equal(state.countryGrowth, 0);
    assert.equal(state.landSoftness, 0.7);
    assert.equal(state.countrySoftness, 10);
    assert.deepEqual(state.selectedCountries, ['FRA']);
    assert.equal(state.magnetStrength, 0);
    assert.equal(state.magnetFollow, false);
});
