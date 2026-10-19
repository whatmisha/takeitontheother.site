Planet uses the public-domain Natural Earth 1:50m Admin 0 countries dataset:
https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson

`planetCountries.js` is bundled locally; the application makes no map requests.
The generated file records the source URL and SHA-256 checksum. Regenerate it
with `python3 scripts/build-planet-data.py` (Python standard library only).

Country polygons retain their holes and every island and microstate. Outlines
are simplified to a 0.06-degree tolerance. Features sharing Natural Earth's
SOV_A3 code are grouped under the sovereign country, including overseas
territories. Source features marked indeterminate remain separate
selectable regions; names and territory aliases support English and Russian search.
Antarctica remains part of the land mask. Boundaries follow the source's
default de facto representation.

Boundary adjacency is recovered before simplification so land feathering uses
coastlines and group feathering ignores borders between selected countries.
Feathering goes inward from the boundary; zero softness gives a hard mask.
If a country has no lattice center inside any of its polygons, selecting it
assigns its closest existing center full land and country influence.
