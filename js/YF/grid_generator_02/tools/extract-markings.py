"""Split the team's compound SVG paths without redrawing any contours.
Requires fontTools (development only). Frozen IDs must not change artwork.
"""
from pathlib import Path
import hashlib,json,re,xml.etree.ElementTree as ET
from fontTools.svgLib.path import parse_path
from fontTools.pens.boundsPen import BoundsPen

root=Path(__file__).resolve().parents[1]
specs=[
 ('eac-v1','EAC','icons.svg',list(range(4)),'EAC'),
 ('manual-v1','Read instructions','icons.svg',list(range(4,8)),'Book'),
 ('fragile-v1','Fragile','icons.svg',[8,9],'Glass'),
 ('keep-dry-v1','Keep dry','icons.svg',list(range(10,18)),'Umbrella'),
 ('pap21-v1','PAP 21','icons.svg',list(range(28,39)),'21'),
 ('pap20-v1','PAP 20','icons_kb.svg',[4,6,16,17,18,19,24,25,26,27,28,29],'20'),
 ('weee-v1','WEEE','icons.svg',list(range(18,28)),'Crossed-out wheeled bin')
]
entries=[]
for id,name,source,indices,variant in specs:
 raw=(root/'graphics'/source).read_bytes()
 path=ET.fromstring(raw).find('{http://www.w3.org/2000/svg}path').get('d')
 parts=re.findall('M[^M]*',path)
 assert not re.search('m',path), 'Splitting requires absolute moveto commands'
 selected=''.join(parts[i] for i in indices)
 pen=BoundsPen(None);parse_path(selected,pen)
 x,y,right,bottom=pen.bounds;w,h=right-x,bottom-y
 fmt=lambda n: f'{n:.7f}'.rstrip('0').rstrip('.')
 fragment=f'<g transform="translate({fmt(-x)} {fmt(-y)})"><path fill="currentColor" d="{selected}"/></g>'
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}">{fragment}</svg>\n'
 (root/'graphics'/'markings'/f'{id}.svg').write_text(svg)
 entries.append(dict(id=id,name=name,variant=variant,version=1,source='graphics/'+source,sourceSha256=hashlib.sha256(raw).hexdigest(),width=w,height=h,svgContent=fragment))
(root/'src'/'markings'/'MarkingCatalogV1.js').write_text('// Frozen artwork extracted from the team’s SVGs. Add a new ID for changed artwork.\nexport const MARKING_CATALOG_V1 = Object.freeze('+json.dumps(entries,ensure_ascii=False,indent=4)+'.map(entry => Object.freeze(entry)));\n')
print(f'Extracted {len(entries)} signs with original contours and exact bounds.')
