# UI Garage extraction status

Status: **complete**. Stable release: `1.0.0`.

The portable framework lives only in `upgrade/extracted/ui-garage/`. The eight
existing applications neither import nor load it, and UI Garage contains no
imports, symlinks or runtime paths back to them. Their source trees have no
extraction-related changes. All independent application suites passed while the
isolated folder was physically absent; the historical aggregate gate's only
blocker was a pre-existing missing external donor path, recorded honestly in
`UI_GARAGE_NONINTERFERENCE.json`.

## Final acceptance

- 103/103 portable tests pass in place, in a Unicode-path copy and after
  unpacking the release archive;
- 150 manifested files and 44 classified framework source modules verify;
- Component Lab owns 16 required states and 10 component families;
- 16 cross-starter computed-style comparisons and two keyboard walkthroughs
  pass in a real browser;
- browser artifact smoke validates SVG, PNG, PDF and JSON with zero remote
  requests;
- the new clean-room Ribbon Field tool passes history/undo/redo, preset
  persistence, IndexedDB draft recovery, share round-trip, collapse shortcuts,
  dialog/file-intake presence, joined/repeated export and destroy/re-init;
- the unpacked canonical archive produced zero HTTP 404 responses during the
  final browser suite.

## Release artifact

- folder: `upgrade/extracted/ui-garage/`;
- archive: `upgrade/releases/ui-garage-1.0.0.tar.gz`;
- archive SHA-256:
  `c65dcef5141af256f33a5521487275b67a68de9f798cd51d7b9bcd392e9dbc5d`;
- archive size: 768090 bytes;
- manifest SHA-256:
  `83cad17c4dc1b3d270157cc710202226cf01da26174505f7ceb242d1fe4c9179`;
- two consecutive archive builds were byte-identical.

Detailed machine-readable results are in
`UI_GARAGE_RELEASE_ACCEPTANCE.json`. Start new consumer work from
`ui-garage/START_HERE.md`; update copied releases according to
`ui-garage/MIGRATION_GUIDE.md`.
