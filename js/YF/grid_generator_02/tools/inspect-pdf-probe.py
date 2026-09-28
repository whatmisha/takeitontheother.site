"""Independent PDF/font/render inspection; never a product export path."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import math
import fitz
from pypdf import PdfReader
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
out = root / 'output/pdf'
model = json.loads((out / 'source.json').read_text())
hashes = json.loads((out / 'hashes.json').read_text())

def children(node):
    value = node.get('/K', [])
    return value if isinstance(value, list) else [value]

def structures(node):
    node = node.get_object()
    if not isinstance(node, dict):
        return
    if node.get('/S'):
        yield node
    for item in children(node):
        if hasattr(item, 'get_object'):
            yield from structures(item)

reports = []
for tagged in [True, False]:
    path = out / ('pdf-probe-tagged.pdf' if tagged else 'pdf-probe-plain.pdf')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == hashes[path.name]['sha256']
    pdf = PdfReader(path)
    assert len(pdf.pages) == 2
    catalog = pdf.trailer['/Root']
    assert bool(catalog.get('/StructTreeRoot')) == tagged
    frame_count = paragraph_count = 0
    if tagged:
        tree = catalog['/StructTreeRoot']
        assert len(tree['/ClassMap']) == len(model['styles'])
        nodes = list(structures(tree))
        frames = [n for n in nodes if n.get('/S') == '/Div']
        frame_count = len(frames)
        assert frame_count == 20
        for frame, expected in zip(frames, [f for p in model['pages'] for f in p['frames']]):
            assert str(frame['/T']).startswith(expected['id'] + ' / ')
            assert len(frame['/A']['/BBox']) == 4
            paragraphs = [n.get_object() for n in children(frame)]
            assert [str(n.get('/ActualText', '')) for n in paragraphs] == expected['text'].split('\n')
            assert all(n.get('/C') == '/' + expected['style'] for n in paragraphs)
            paragraph_count += len(paragraphs)
    font_names = set()
    for page in pdf.pages:
        assert math.isclose(float(page.mediabox.width), 210 * 72 / 25.4, abs_tol=0.001)
        assert math.isclose(float(page.mediabox.height), 297 * 72 / 25.4, abs_tol=0.001)
        assert not page['/Resources'].get('/XObject')
        assert not page.get('/Annots')
        assert not any(operator in [b'W', b'W*'] for _, operator in page.get_contents().operations)
        for ref in page['/Resources']['/Font'].values():
            font = ref.get_object()
            font_names.add(str(font['/BaseFont']).split('+')[-1])
            assert '/ToUnicode' in font
            assert '<>' not in font['/ToUnicode'].get_data().decode()
            child = font['/DescendantFonts'][0].get_object()
            descriptor = child['/FontDescriptor']
            assert '/FontFile2' in descriptor or '/FontFile3' in descriptor
            if '/FontFile2' in descriptor:
                tt = TTFont(BytesIO(descriptor['/FontFile2'].get_data()))
                assert 'fvar' not in tt # Static wght 400 paths, not default VF glyphs
                for name in tt.getGlyphOrder():
                    glyph = tt['glyf'][name]
                    glyph.getCoordinates(tt['glyf']) # Fails for broken repeat flags
                    assert not glyph.isComposite()
    text = pdf.pages[0].extract_text()
    assert all(needle in text for needle in ['Ёё, Йй', '250\u00a0г', '100\u00a0мм'])
    assert text.count('Луннен / Lunnen 0123') == 2
    assert '\ufffd' not in text
    reports.append({'file': path.name, 'pages': 2, 'fonts': sorted(font_names),
                    'framesInStructure': frame_count, 'paragraphsInStructure': paragraph_count,
                    'clippingPaths': 0, 'images': 0, 'textAndGlyphChecks': 'passed'})
a = fitz.open(out / 'pdf-probe-tagged.pdf')
b = fitz.open(out / 'pdf-probe-plain.pdf')
for page_a, page_b in zip(a, b):
    assert page_a.get_pixmap().samples == page_b.get_pixmap().samples
    for block in page_a.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                box = fitz.Rect(span['bbox'])
                assert page_a.rect.contains(box), (span['text'], box)
# Human acceptance is a separate, preserved record. PDF structure checks cannot
# overwrite or stand in for behavior observed in Illustrator.
review_path = root / 'experiments/pdf/illustrator-review.json'
review = json.loads(review_path.read_text()) if review_path.exists() else None
result = {'files': reports, 'identicalRendering': True,
          'illustrator3081': {'automaticallyTested': False,
                             'userReview': '../../experiments/pdf/illustrator-review.json' if review else None,
                             'userReportedAcceptance': review['acceptance'] if review else 'not tested',
                             'testedVariant': review['testedVariant'] if review else None}}

(out / 'inspection.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
