"""Build the bundled Planet masks from Natural Earth's public-domain 1:50m countries.
Run with python3 scripts/build-planet-data.py. No third-party packages are required.
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
TOLERANCE = 0.06


def simplify(points):
    if len(points) <= 2:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = dx * dx + dy * dy
    best, index = 0, 0
    for i, p in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) if length else 0
        distance = (p[0] - a[0] - dx * t) ** 2 + (p[1] - a[1] - dy * t) ** 2
        if distance > best:
            best, index = distance, i
    if best > TOLERANCE ** 2:
        return simplify(points[:index + 1])[:-1] + simplify(points[index:])
    return [a, b]


def ring_points(ring):
    return [tuple(round(v, 4) for v in point[:2]) for point in ring]


def simplified_ring(ring):
    # Retain every polygon, including microstates and tiny overseas islands.
    points = ring_points(ring)
    split = len(points) // 2
    result = simplify(points[:split + 1])[:-1] + simplify(points[split:])
    return result if len(set(result)) >= 3 else points


def edge_key(a, b):
    return tuple(sorted((a, b)))


def build():
    raw = urllib.request.urlopen(SOURCE, timeout=60).read()
    features = json.loads(raw)['features']
    groups = collections.defaultdict(list)
    for feature in features:
        props = feature['properties']
        key = props['ADM0_A3'] if props['TYPE'] == 'Indeterminate' else props['SOV_A3']
        groups[key].append(feature)
    ordered = sorted(groups.values(), key=lambda group: group[0]['properties']['SOVEREIGNT'])
    countries, raw_rings = [], []
    for index, group in enumerate(ordered):
        primary = next((f for f in group if f['properties']['ADMIN'] == f['properties']['SOVEREIGNT']), group[0])
        p = primary['properties']
        aliases = set()
        polygons = []
        anchors = [[p['LABEL_X'], p['LABEL_Y']]]
        for feature in group:
            props = feature['properties']
            for key in ['NAME_EN', 'NAME_RU', 'ADMIN', 'SOVEREIGNT', 'NAME_LONG', 'ISO_A2', 'ADM0_A3']:
                if props.get(key) and props[key] != '-99':
                    aliases.add(props[key])
            geometry = feature['geometry']
            parts = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
            for polygon in parts:
                polygons.append([simplified_ring(ring) for ring in polygon])
                for ring in polygon:
                    raw_rings.append((index, ring_points(ring)))
            anchors.append([props['LABEL_X'], props['LABEL_Y']])
        countries.append(dict(id=p['ADM0_A3'], name=p.get('NAME_EN') or p['ADMIN'], nameRu=p.get('NAME_RU') or p['ADMIN'], aliases=sorted(aliases), anchors=anchors, polygons=polygons))

    owners = collections.defaultdict(set)
    for owner, ring in raw_rings:
        for a, b in zip(ring, ring[1:]):
            if a != b:
                owners[edge_key(a, b)].add(owner)
    borders = []
    for owner, ring in raw_rings:
        run, previous = [], None
        def flush():
            if len(run) >= 2 and (previous == -1 or owner < previous):
                points = simplify(run)
                if run[0] == run[-1] and len(set(points)) < 3:
                    points = run
                borders.append([owner, previous, points])
        for a, b in zip(ring, ring[1:]):
            if a == b:
                continue
            adjacent = owners[edge_key(a, b)] - {owner}
            neighbor = min(adjacent) if adjacent else -1
            if previous != neighbor:
                flush()
                run = [a]
                previous = neighbor
            if not run:
                run = [a]
            run.append(b)
        flush()
    payload = dict(source=SOURCE, sha256=hashlib.sha256(raw).hexdigest(), scale='1:50m', tolerance=TOLERANCE, countries=countries, borders=borders)
    output = ROOT / 'src/data/planetCountries.js'
    output.write_text('// Natural Earth 1:50m. Public domain. Regenerate with scripts/build-planet-data.py.\nexport const PLANET_DATA = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{len(countries)} country groups, {len(borders)} boundary paths, {output.stat().st_size:,} bytes')
    for country in countries:
        if country['id'] in ['FRA', 'VAT', 'MCO']:
            print(country['id'], len(country['polygons']), 'polygons', len(country['anchors']), 'anchors')


if __name__ == '__main__':
    build()
