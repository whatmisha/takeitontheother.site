#!/usr/bin/env python3
"""Read-only research inspector for Illustrator's private PDF/AI text data.

Not an importer or a writer. Uses pypdf for the PDF container and the observed
PostScript dictionary subset. Does not execute PostScript. Reports structure,
not customer text. Numeric ATE keys are observations, not a public Adobe schema.
"""
import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
import zlib
from io import BytesIO
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import read_object

TOOLS = Path(__file__).resolve().parent
LIMIT = 64 * 1024 * 1024
BLOCK = re.compile(r'^/(AIPrivateData|AIPDFPrivateData)([1-9][0-9]*)$')
DOCUMENT = re.compile(rb'^/(AI11(?:UndoFree)?TextDocument)\s')


def resolve(value):
    return value.get_object() if hasattr(value, 'get_object') else value


def private_payload(private):
    groups = {}
    for key in private:
        match = BLOCK.fullmatch(str(key))
        if match:
            groups.setdefault(match[1], {})[int(match[2])] = resolve(private[key])
    if not groups:
        raise ValueError('Illustrator metadata exists, but no supported private data streams were found')
    if len(groups) != 1:
        raise ValueError('Both private stream families present; selection requires investigation')
    family, blocks = next(iter(groups.items()))
    count = int(private.get('/NumBlock', 1))
    if sorted(blocks) != list(range(1, count + 1)):
        raise ValueError(f'Private blocks disagree with NumBlock={count}: {sorted(blocks)}')
    chunks = [blocks[i].get_data() for i in range(1, count + 1)]
    if sum(map(len, chunks)) > LIMIT:
        raise ValueError('Private data exceeds the 64 MiB research limit')
    return family, count, b''.join(chunks)


def decompress(payload):
    if payload.startswith(b'%AI24_ZStandard_Data'):
        result = subprocess.run(['node', str(TOOLS / 'decode-illustrator-zstd.mjs')],
                                input=payload[20:], capture_output=True, timeout=30)
        if result.returncode:
            raise ValueError('Zstandard decoder failed: ' + result.stderr.decode(errors='replace')[:1000])
        return 'zstandard', result.stdout
    if payload.startswith(b'%AI12_CompressedData'):
        decoder = zlib.decompressobj()
        decoded = decoder.decompress(payload[20:], LIMIT + 1)
        if len(decoded) > LIMIT or not decoder.eof or decoder.unused_data:
            raise ValueError('Oversized, truncated or concatenated zlib private data')
        return 'zlib', decoded
    raise ValueError('Unsupported Illustrator private compression header')


def text_documents(pgf):
    lines = re.split(rb'\r\n|\r|\n', pgf)
    result = []
    for index, line in enumerate(lines):
        match = DOCUMENT.match(line)
        if not match:
            continue
        chunks = []
        for encoded in lines[index + 1:]:
            if not encoded.startswith(b'%'):
                break
            chunks.append(encoded[1:])
            if encoded.rstrip().endswith(b'~>'):
                break
        raw = base64.a85decode(b''.join(chunks), adobe=True)
        stream = BytesIO(b'<<' + raw + b'>>')
        document = read_object(stream, None)
        if not isinstance(document, dict) or stream.read().strip():
            raise ValueError('Unsupported text engine dictionary syntax')
        result.append((match[1].decode(), document, raw))
    return result


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def table(document, key):
    return [item.get('/0', {}) for item in document.get('/0', {}).get(key, {}).get('/0', [])]


def run_lengths(story, key):
    value = story.get('/0', {}).get(key, {}).get('/0')
    return None if value is None else [int(run['/1']) for run in value]


def summarize_text(document, raw, name):
    stories = document.get('/1', {}).get('/1', [])
    summaries = []
    for index, story in enumerate(stories):
        text = story.get('/0', {}).get('/0', '')
        if not isinstance(text, str):
            raise ValueError('Unsupported native text encoding')
        length = len(text.encode('utf-16-be', errors='surrogatepass')) // 2
        frames = [node for node in walk(story.get('/1', {})) if node.get('/99') == '/F']
        runs = {label: run_lengths(story, key)
                for label, key in [('paragraph', '/5'), ('character', '/6')]}
        summaries.append({
            'index': index, 'utf16CodeUnits': length, 'carriageReturns': text.count('\r'),
            'containsCyrillic': bool(re.search('[\u0400-\u04ff]', text)),
            'runs': {label: {'lengths': value, 'coversText': sum(value) == length}
                     for label, value in runs.items() if value is not None},
            'frames': [{'id': int(frame['/10']) if '/10' in frame else None,
                        'keys': sorted(frame.keys()),
                        'fourValueBoundsPresent': isinstance(frame.get('/1'), list) and len(frame['/1']) == 4,
                        'glyphCacheRecords': sum(node.get('/99') == '/G' for node in walk(frame))}
                       for frame in frames]
        })
    return {'section': name, 'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw), 'stories': summaries,
            'fontNames': [str(font.get('/0', {}).get('/0', '')) for font in table(document, '/1')],
            'characterStyleNames': [str(style.get('/0', '')) for style in table(document, '/5')],
            'paragraphStyleNames': [str(style.get('/0', '')) for style in table(document, '/6')]}


def inspect(path):
    data = path.read_bytes()
    if len(data) > LIMIT:
        raise ValueError('Input exceeds the 64 MiB research limit')
    reader = PdfReader(BytesIO(data))
    if reader.is_encrypted:
        raise ValueError('Encrypted input is outside this research tool')
    report = {'file': path.as_posix(), 'sha256': hashlib.sha256(data).hexdigest(),
              'pages': len(reader.pages), 'nativePayloads': []}
    seen = {}
    for index, page in enumerate(reader.pages):
        piece = resolve(page.get('/PieceInfo', {}))
        illustrator = resolve(piece.get('/Illustrator', {}))
        private = resolve(illustrator.get('/Private', {}))
        if not private:
            continue
        family, blocks, payload = private_payload(private)
        digest = hashlib.sha256(payload).hexdigest()
        if digest in seen:
            seen[digest]['onPages'].append(index + 1)
            continue
        compression, pgf = decompress(payload)
        bindings = []
        for match in re.finditer(rb'/AI11Text\s*:\s*(.*?);', pgf, re.S):
            fields = {key.decode(): int(number) for number, key in
                      re.findall(rb'(-?\d+)\s+/(StoryIndex|FrameIndex|FreeUndo)\s*,', match[1])}
            bindings.append(fields)
        entry = {'onPages': [index + 1], 'streamFamily': family, 'blocks': blocks,
                 'containerVersion': int(private.get('/ContainerVersion', 0)),
                 'creatorVersion': int(private.get('/CreatorVersion', 0)),
                 'compression': compression, 'compressedBytes': len(payload),
                 'decodedBytes': len(pgf), 'privateSha256': digest,
                 'artworkTextBindings': bindings,
                 'textDocuments': [summarize_text(doc, raw, name) for name, doc, raw in text_documents(pgf)]}
        report['nativePayloads'].append(entry)
        seen[digest] = entry
    report['hasIllustratorPrivateData'] = bool(report['nativePayloads'])
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', type=Path, nargs='+')
    parser.add_argument('--output', type=Path, help='Optional JSON report; inputs are never modified')
    args = parser.parse_args()
    if args.output and args.output.resolve() in {path.resolve() for path in args.files}:
        parser.error('Output must not overwrite an input')
    reports = []
    failed = False
    for path in args.files:
        try:
            reports.append(inspect(path))
        except Exception as error:
            failed = True
            reports.append({'file': path.as_posix(), 'error': str(error)})
    result = {'scope': 'Read-only research; no native export or Illustrator acceptance implied',
              'frameTypeNote': 'Four-value /F /1 bounds are a candidate area-frame signal only; no local area-text control has verified this.',
              'files': reports}
    output = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output)
        print(f'Inspected {len(reports)} files; report: {args.output}')
    else:
        print(output, end='')
    return int(failed)


if __name__ == '__main__':
    sys.exit(main())
