# Runtime Baselines

## Storage

- Pizza Boxer: IndexedDB `lunnen-grid-generator`, store `drafts`, record `current`.
- Keyboarder: preset key `keyboarder`; дополнительные keys для UI mode, SVG export text mode и performance flag.
- Sparky: `lunnenSparkyGeneratorV2` и migration reader `lunnenSparkyGeneratorV1`.
- Wordplayer: `wordplayerPresetsV18`.
- Framework preset stores создают дополнительный seed marker на основе storage key.

Upgrade не имеет права читать или изменять перечисленные namespaces.

## External runtime dependencies

- Framework v3: remote CoFo Sans; lazy jsPDF, svg2pdf и OpenType CDN.
- Keyboarder embedded base CSS содержит remote font declarations, но app theme использует локальные fonts.
- Sticky Fingers: jsPDF/svg2pdf/OpenType CDN; Google Sheets user data.
- Wander Bender: Paper.js 0.12.17 CDN.
- Wander Pattern donor: Paper.js и framework export CDN dependencies.
- Void: remote fonts, external About URL и Yandex Metrika; они не переносятся.

## Absolute/back-navigation paths

Часть legacy-инструментов использует `/js/YF/`. После копирования ссылки должны стать относительными к `/upgrade/`, без runtime-обращения к оригинальному индексу.

## Preset loading risk

Sticky Fingers после чтения manifest дополнительно запрашивает directory listing и может использовать GitHub API fallback. В upgrade остаётся только deterministic manifest loading.

## Acceptance rule

До Gate G1 network audit должен показывать только same-origin `/upgrade/**`. Google Sheets разрешается только в отдельном тесте после явного пользовательского действия.

