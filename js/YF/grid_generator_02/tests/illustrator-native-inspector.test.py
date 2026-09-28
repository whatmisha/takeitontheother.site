"""Research tool checks; run separately from the JavaScript application suite."""
import base64
import importlib.util
import json
import unittest
import zlib
from pathlib import Path
from pypdf.generic import DecodedStreamObject

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('native_inspector', ROOT / 'tools/inspect-illustrator-native.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def stream(data):
    value = DecodedStreamObject()
    value.set_data(data)
    return value


class NativeInspectorTest(unittest.TestCase):
    def test_one_block_without_numblock(self):
        self.assertEqual(module.private_payload({'/AIPrivateData1': stream(b'one')}),
                         ('AIPrivateData', 1, b'one'))

    def test_pdf_block_family_and_numeric_order(self):
        private = {'/NumBlock': 12, **{f'/AIPDFPrivateData{i}': stream(bytes([i])) for i in range(12, 0, -1)}}
        self.assertEqual(module.private_payload(private), ('AIPDFPrivateData', 12, bytes(range(1, 13))))

    def test_incomplete_or_ambiguous_blocks_fail(self):
        for private in [{'/NumBlock': 2, '/AIPrivateData1': stream(b'a')},
                        {'/AIPrivateData1': stream(b'a'), '/AIPDFPrivateData1': stream(b'b')},
                        {'/AIPrivateData2': stream(b'a')}]:
            with self.assertRaises(ValueError):
                module.private_payload(private)

    def test_old_compression_and_truncation(self):
        data = b'%AI12_CompressedData' + zlib.compress(b'%!PS-Adobe-3.0\r')
        self.assertEqual(module.decompress(data), ('zlib', b'%!PS-Adobe-3.0\r'))
        with self.assertRaises(ValueError):
            module.decompress(data[:-2])

    def test_unicode_runs_both_documents_and_no_source_text_in_report(self):
        text = 'Кириллица 😀\r'
        units = len(text.encode('utf-16-be')) // 2
        raw = (f'/0 << /5 << /0 [<< /0 << /0 (Brand Character) >> >>] >> '
               f'/6 << /0 [<< /0 << /0 (Brand Body) >> >>] >> >> '
               f'/1 << /1 [<< /0 << /0 <feff{text.encode("utf-16-be").hex()}> '
               f'/6 << /0 [<< /1 {units} >>] >> >> '
               f'/1 << /2 [<< /99 /F /10 3 /1 [0 0 100 200] '
               f'/6 [<< /99 /G >>] >>] >> >>] >>').encode()
        sections = []
        for name in ['AI11TextDocument', 'AI11UndoFreeTextDocument']:
            encoded = base64.a85encode(raw) + b'~>'
            lines = [b'/' + name.encode() + b' :'] + [b'%' + encoded[i:i+80] for i in range(0, len(encoded), 80)]
            sections.append(b'\r'.join(lines) + b'\r;\r')
        for newline in [b'\r', b'\n', b'\r\n']:
            docs = module.text_documents(b''.join(sections).replace(b'\r', newline))
            self.assertEqual(len(docs), 2)
            report = module.summarize_text(docs[0][1], docs[0][2], docs[0][0])
            self.assertEqual(report['stories'][0]['utf16CodeUnits'], units)
            self.assertTrue(report['stories'][0]['runs']['character']['coversText'])
            self.assertEqual(report['paragraphStyleNames'], ['Brand Body'])
            self.assertTrue(report['stories'][0]['frames'][0]['fourValueBoundsPresent'])
            self.assertEqual(report['stories'][0]['frames'][0]['glyphCacheRecords'], 1)
            self.assertNotIn('Кириллица', json.dumps(report, ensure_ascii=False))

    def test_ordinary_pdf_has_no_native_data(self):
        report = module.inspect(ROOT / 'output/pdf/pdf-probe-tagged.pdf')
        self.assertFalse(report['hasIllustratorPrivateData'])
        self.assertEqual(report['nativePayloads'], [])

    def test_real_zstandard_and_undo_free_section(self):
        report = module.inspect(ROOT / 'graphics/icons.ai')
        payload = report['nativePayloads'][0]
        self.assertEqual(payload['compression'], 'zstandard')
        self.assertEqual([doc['section'] for doc in payload['textDocuments']],
                         ['AI11TextDocument', 'AI11UndoFreeTextDocument'])
        self.assertEqual(len(payload['textDocuments'][0]['stories']), 1)
        self.assertEqual(len(payload['textDocuments'][1]['stories']), 0)


if __name__ == '__main__':
    unittest.main()
