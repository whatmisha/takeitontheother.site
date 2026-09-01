# UPG-056: Action and Export Compatibility Matrix

Дата аудита: 2026-08-31.

## 1. Цель и граница

UPG-056 унифицирует только оболочку нижних action-панелей:

- положение и spacing панели;
- основную, muted и help presentation кнопок;
- hover, focus, disabled и busy presentation;
- ARIA-роль и имя панели;
- при наличии долгой операции — общие визуальные состояния progress,
  completion, cancellation и failure.

Domain export остаётся у приложения. Нельзя объединять:

- SVG/PDF/PNG/MP4/ZIP/JSON builders;
- filename и timestamp policy;
- text-to-outline и font embedding;
- Canvas scale/transparency;
- batch label generation;
- import validation, history и draft recovery;
- Sticky Fingers Google Sheets;
- Sparky animation worker и cancellation;
- Pulsar verification/copy logic.

Итоговая shared-граница должна позволять приложениям использовать одинаковую
панель и состояния, не заставляя их иметь одинаковые форматы или workflow.

## 2. Общий инвентарь

Во всех восьми runtime найдено:

- 8 нижних nav.bottom-buttons;
- 31 обычная кнопка с class btn-fixed;
- 2 специальные кнопки Sparky: shortcut help и animation cancel;
- 9 label-controls рядом с экспортом;
- 33 button elements и 42 прямых button/label action controls суммарно;
- 3 панели уже имеют role=toolbar и aria-label=Main actions;
- Sparky имеет aria-label=Export actions, но полагается на implicit nav role;
- Keyboarder, Wordplayer, Pulsar и Wander пока не имеют имени action group.

Desktop browser baseline снят при 1280×720. Все восемь страниц загружаются без
module errors.

| Инструмент | Direct controls | Видимый default | Основные форматы / действия | Текущая action-shell |
|---|---:|---:|---|---|
| Sparky | 4 | 3 | PNG, PNG sequence, SVG, MP4, help, cancel | Shared base + private progress |
| Keyboarder | 8 | 6 | JSON, PDF, PNG, SVG, Import, Verify, About, Outline | Shared base |
| Wordplayer | 4 | 4 | PNG, curved SVG, About, Transparent | Shared base |
| Pulsar Coder | 3 | 3 | Verify, Copy SVG, Download SVG | Legacy centered |
| Sticky Fingers | 8 | 2 | preset JSON, current/all PDF, current/all SVG, Outline, Prepress | Legacy centered + mode/data visibility |
| Pizza Boxer | 5 | 5 | setup JSON, PDF, SVG, Outline | Legacy centered + right group |
| Dither | 9 | 9 in captured loaded state | image/layout add/remove, PNG, alpha, ×2/×4/×8 | Private left-anchored raster toolbar |
| Wander Bender | 1 | 1 | SVG | Legacy centered |

Hidden default controls are not dead: Keyboarder exposes Verify/Import in
advanced mode; Sticky reveals preset/SVG/all-label actions in edit/data states;
Sparky reveals cancel only during animation export.

## 3. Desktop geometry baseline

| Инструмент | nav rect x/y/w/h | Layout note |
|---|---|---|
| Sparky | 524.277 / 664 / 231.445 / 36 | Help sits 46 px to the left of export group |
| Keyboarder | 385.566 / 664 / 508.867 / 36 | Centered; advanced controls collapse to zero |
| Wordplayer | 420.887 / 664 / 438.227 / 36 | Centered; transparent toggle included |
| Pulsar | 483.168 / 664 / 313.664 / 36 | Centered three-button group |
| Sticky | 498.395 / 664 / 283.211 / 36 | Normal mode: current PDF + Prepress |
| Pizza | 320 / 664 / 640 / 36 | Centered; setup pair + export group |
| Dither | 20 / 664 / 904.695 / 36 | Intentionally left anchored |
| Wander | 584.992 / 664 / 110.016 / 36 | Centered one-button canary |

Sparky mobile is a separate accepted contract: at max-width 768 px or coarse
pointer the entire bottom action panel is hidden. UPG-056 must not make export
controls visible on mobile or disturb the full-screen Basic showcase.

## 4. Presentation families

### A. Direct shared consumers

Sparky, Keyboarder and Wordplayer already receive bottom-buttons and btn-fixed
directly from framework/css/othersite-styles.css.

Canonical button:

- CoFo Sans with system fallback;
- 16 px / 500;
- 8×20 px padding;
- 36 px height;
- radius 20 px;
- light primary background and dark text;
- shared shadow, hover, active and disabled states.

Private extensions are valid:

- Sparky export group and progress overlay;
- Keyboarder muted JSON, intro help and outline no-wrap;
- Wordplayer intro help and 13.6 px toggle-label text.

### B. Centered legacy copies

Pulsar and Wander still carry complete local btn-fixed and bottom-buttons bases
in css/yf-styles.css. They use 14.4 px / 600 and 8×15 px metrics. Wander adds
Arial through css/wander-bender.css; Pulsar inherits its active CoFo/system
family. Their actual action logic remains entirely private.

Wander is the smallest safe presentation canary: one SVG button, no toggle,
progress, modal state or conditional visibility.

### C. Repository and batch adapters

Pizza Boxer and Sticky Fingers carry full local action CSS after a lower
framework cascade layer. Both use legacy 14.4 px / 600 and 8×15 px metrics.
Their framework-base.css files currently retain an Arial parity bridge for
btn-fixed.

Pizza additionally owns:

- muted setup import/export pair;
- muted/bordered PDF variant;
- right-side export group;
- Outline switch;
- async PDF error presentation.

Sticky additionally owns:

- normal/edit/data-dependent visibility;
- current/all PDF and SVG;
- disabled batch generation while running;
- data status feedback;
- Outline and Prepress availability;
- Google Sheets as the only approved external runtime.

### D. Raster-safe Dither toolbar

Dither is not a centered canonical bar. It is left anchored and combines file
loading, destructive remove buttons, export and four private checkbox labels.
Its buttons use Arial 14.4/600, 8×15 px padding, a 1 px white border and no
shadow. The bar becomes vertical at 768 px even though the full app has no
accepted mobile layout.

The export button is disabled until an image exists. Alpha and ×2/×4/×8 are
part of Canvas output state; the three scales are mutually exclusive. These
labels must not be converted to the generic Outline switch.

### E. Sparky long-running export

Sparky is the only current consumer with a cancellable long-running export:

- static mode labels: Export PNG and Export ⌘E;
- animated mode labels: Export PNG sequence and Export MP4;
- both export buttons disable and become visually hidden while working;
- progress exposes a native progress element and aria-live message;
- Cancel terminates the worker and rejects with AbortError;
- success shows Done for 800 ms;
- mobile hides the entire action surface.

This state machine is a useful framework donor, but it must remain private
until a second real consumer needs cancellable progress. UPG-056 may extract
presentation tokens or a view-only helper; it must not move the animation
worker or job lifecycle into the framework.

## 5. Domain ownership matrix

| Инструмент | Output invariant | Busy/error invariant | Private controls |
|---|---|---|---|
| Sparky | static SVG/PNG; animation MP4/PNG ZIP; exact loop/render geometry | worker progress, cancel, Done, export error dialog | dynamic labels, help popup |
| Keyboarder | editable/outlined SVG, PNG, editable PDF, model JSON | existing dialog/error path; no fake progress | advanced Verify/Import, Outline |
| Wordplayer | 3× PNG and curved SVG | aria-busy per button; dialog on failure | Transparent only affects PNG |
| Pulsar | black-on-transparent SVG and clipboard text | temporary Copied state; legacy alert paths | Verify modal |
| Sticky | current/all SVG and PDF, preset JSON | batch disable + data status; PDF/SVG errors | edit/data visibility, Outline, Prepress, Sheets |
| Pizza | exact-mm SVG/PDF and schema 1.2 JSON | ErrorPresenter for PDF; import rollback | setup pair, bordered PDF, Outline |
| Dither | PNG at 1×/2×/4×/8× with optional alpha | disabled without image | add/remove image/layout, four raster checks |
| Wander | SVG without area-boundary | current synchronous path | none |

## 6. Shared contract proposed for UPG-056

Shared CSS owns:

- bottom-buttons positioning for canonical centered bars;
- btn-fixed base, primary, muted, help, hover, focus-visible and disabled;
- optional action-group flex wrapper;
- optional view-only export-status presentation if extraction remains
  behavior-neutral.

Application CSS may own:

- Dither left anchoring and destructive/file controls;
- Pizza/Sticky group structure and semantic variants;
- Sparky progress overlay and mobile hiding;
- format-specific switches and labels;
- conditional visibility.

Application JavaScript always owns:

- the action handler;
- validation and eligibility;
- busy start/end and cancellation decision;
- output generation and download;
- filename;
- errors and recovery;
- domain state and history.

No generic exporter class is introduced in UPG-056. Existing framework
SVGExporter and ExportGuard remain utilities, not a UI controller.

## 7. Accessibility baseline and target

Already explicit:

- Dither, Pizza and Sticky: role=toolbar + Main actions;
- Sparky: Export actions label;
- Wordplayer: aria-busy lifecycle on both export buttons;
- Sparky: aria-live progress and labelled cancel.

UPG-056 adds zero-visual semantics where missing:

- role=toolbar and a precise aria-label on all eight bars;
- aria-busy synchronized with real asynchronous work only;
- disabled and busy must remain distinguishable;
- focus-visible must remain keyboard reachable;
- dynamic text such as Copied and Done must not erase the accessible action
  name permanently;
- hidden advanced/edit/data controls must not remain focusable.

## 8. Rollout plan

### UPG-056a — matrix, no production diff

- record the 42 direct controls, formats, geometry and ownership;
- freeze shared/private boundaries and rollback rules;
- select Wander as the one-button canary;
- keep Gate G4 green.

### UPG-056b — machine-readable action gate + direct verification

- add check:actions to count eight bars, 31 btn-fixed buttons, two Sparky
  special buttons and nine labels;
- protect formats, IDs, conditional controls and private CSS ownership;
- verify Sparky, Keyboarder and Wordplayer without presentation changes;
- cover Sparky static/animated labels, progress/cancel state and both mobile
  widths;
- add missing zero-visual toolbar semantics separately.

### UPG-056c — Wander one-button canary

- promote shared bottom-buttons and btn-fixed presentation;
- remove the complete local component base;
- accept only the measured canonical font/padding/width change;
- preserve exact SVG, all three modes, panel geometry and extraction.

### UPG-056d — Pulsar three-action rollout

- promote shared bar and buttons;
- preserve Verify, Copy and Download handlers;
- verify Copied feedback and modal behavior;
- preserve exact encoded SVG and known verifier behavior.

### UPG-056e — Pizza Boxer action adapter

- promote shared bar/button base;
- retain only semantic muted/PDF/group extensions;
- rebuild the 15-asset runtime;
- verify schema JSON import/export, SVG/PDF, Outline, error rollback, 113 form
  states, panels/editors and exact SVG.

### UPG-056f — Sticky Fingers action adapter

- promote shared base while retaining mode/data visibility and group layout;
- verify current/all SVG/PDF, disabled batch state, Outline, Prepress, data
  rows and Google Sheets;
- preserve normal/edit geometry, 79 form states and SVG.

### UPG-056g — Dither raster-safe boundary

- keep left anchoring, remove buttons and raster option labels private;
- only promote button paint that can be isolated from Canvas output;
- verify disabled/no-image and loaded-image states;
- require 0 changed Canvas RGB channels for default, Bayer and Pixel Size 4;
- retain exact alpha and ×2/×4/×8 output dimensions.

### UPG-056h — action component gate

- decide whether Sparky progress remains private or yields a view-only shared
  primitive; no speculative framework abstraction;
- document every remaining bridge and removal condition;
- run all app suites, isolation, Gate G4 and the browser acceptance set;
- only then begin UPG-057 dialogs/tooltips/errors/toasts.

## 9. Mandatory browser acceptance

- every default bar: geometry, visible/hidden controls and computed styles;
- hover, focus-visible, disabled and restored states;
- keyboard shortcut routes without duplicate invocation;
- no mutation of settings/history merely from export preparation;
- no unexpected SVG/Canvas/panel/form-state diff after the action;
- no browser or module errors;
- Sparky at desktop, 390×844 and 430×932;
- Pizza and Sticky normal plus their private editor/data states;
- Dither unloaded and loaded image states;
- download-producing tests use captured download events and never inspect user
  download folders.

## 10. Rollback rules

Rollback the current app rollout inside upgrade if:

- output bytes, geometry, font mode, scale or filename policy changes;
- export changes settings/history or causes a reroll;
- a hidden action becomes visible/focusable in the wrong mode;
- busy/cancel can leave buttons disabled or a worker running;
- Pizza import/schema/history/draft or Sticky data/Sheets behavior changes;
- Dither Canvas pixels change outside the expected export-only buffer;
- Sparky mobile exposes the desktop action bar;
- a canonical visual change moves panels or canvas/SVG geometry;
- any runtime path escapes upgrade.

## 11. Выполнение UPG-056a

Матрица создана без production diff. Browser и static audit подтвердили восемь
bars, 31 обычную btn-fixed кнопку, две специальные кнопки Sparky и девять
label-controls. Зафиксированы geometry, formats, busy/error lifecycles,
shared/private CSS и мобильная граница Sparky. Wander выбран первым canary.

## 12. Выполнение UPG-056b

Добавлен scripts/check-action-contracts.mjs и npm command check:actions,
включённый в Gate G4. Он фиксирует 42 direct controls, IDs, toolbar semantics,
shared/local presentation ownership и восемь private export pipelines.

Sparky, Keyboarder, Wordplayer, Pulsar и Wander получили явные role=toolbar и
доступные имена. Все пять full-page captures имеют 0 changed RGB channels;
control records, bar geometry и module state не изменились.

Sparky static/Basic Wild labels, working progress, disabled/hidden buttons и
cancel restore приняты. Cancellation больше не пишет intentional AbortError как
SVG failure. На 390×844 и 430×932 bottom bar остаётся display:none. Sparky
196/196, Keyboarder и Wordplayer suites проходят.

## 13. Выполнение UPG-056c

Wander удалил local btn-fixed/bottom-buttons base и получает canonical shared
presentation. Scoped promotion нужен только для прохода через legacy universal
reset; private SVG handler и filename не менялись.

Единственный намеренный visual diff — кнопка Export SVG: Arial 14.4/600,
8×15 px и width 110.016 стали CoFo 16/500, 8×20 px и width 124.914. Центр,
36 px height и bottom anchor точны; raster diff ограничен кнопкой. Panel
300×605.703125, 41 fields и SVG Radial 1838/hash 8bcdfde2…, Random
12261/fa1daf28… и Flow 26292/f6fa2d66… сохранены. После возврата в Radial и
восстановления его fractional Length state все fields/panel/SVG совпадают
точно. Browser errors — 0, Wander 10/10 и check:actions проходят. Следующий
шаг — UPG-056d Pulsar.

## 14. Выполнение UPG-056d

Pulsar удалил local btn-fixed/bottom-buttons base и получает canonical shared
presentation. Scoped promotion нужен только для прохода через legacy universal
reset; Verify, Copy, Download SVG, filename и encoder остаются частными.

Намеренный visual diff трёх кнопок: CoFo 14.4/600, 8×15 px и group width
313.664 стали CoFo 16/500, 8×20 px и group width 366.281. Центр, 36 px height
и bottom anchor точны; raster diff ограничен action bar. Copy сохраняет зелёный
`✓ Copied!` flash и restore, Verify — прежний modal и известный legacy CRC
failure. 22 fields, три panels и SVG 40 180/hash 97155e5a… совпадают точно.
Browser/module errors — 0, Pulsar 8/8 и check:actions проходят. Следующий шаг —
UPG-056e Pizza Boxer.

## 15. Выполнение UPG-056e

Pizza Boxer удалил local action bar/fixed button base и дублирующий btn-export.
Shared shell проходит frozen reset через scoped promotion. В приложении остались
только semantic muted Setup, bordered PDF и right-group extensions; JSON/SVG/PDF
handlers, Outline, schema/history/import/draft и filenames не переносились.

Намеренный diff четырёх кнопок: Arial 14.4/600, 8×15 px → CoFo 16/500,
8×20 px. Bar остаётся [320,664,640,36], private paint и правый край Outline
сохранены; raster diff локализован в action region. JSON, SVG и PDF browser
actions не меняют state. New/E-ink/New возвращают точные 113 fields/panels и
SVG 94 374/4abbde0d…, 78 234/9d4f24e9…, 94 374/4abbde0d…. Browser/module
errors — 0; 15-asset runtime воспроизводим, Pizza 167/167 и check:actions
проходят. Следующий шаг — UPG-056f Sticky Fingers.

## 16. Выполнение UPG-056f

Sticky Fingers удалил local action bar/fixed button base и duplicate export
paint. Shared shell проходит frozen reset через scoped promotion. Private
остались muted preset/SVG variants, right group, edit/data visibility, batch
disabled lifecycle, formats, prepress, data rows и Google Sheets.

Намеренный diff кнопок: Arial 14.4/600, 8×15 px → CoFo 16/500, 8×20 px.
Normal group 283.211→306.078 px, центр, bottom anchor и 36 px height сохранены;
raster diff локализован в action region. Normal/edit дают точные 79 fields,
панели и SVG 18 640/1592eaac… и 18 607/8850fd2f…. Preset, current SVG/PDF
не мутируют state; Outline/Prepress round-trip точен, browser errors — 0.
Google Sheets остаётся explicit user action; Sticky 5/5 и check:actions
проходят. Следующий шаг — UPG-056g Dither.

## 17. Выполнение UPG-056g

Dither удалил local fixed-button base и получает shared shell через scoped
promotion. Private остались left 20 px anchor/z-index, 36 px destructive remove
buttons, четыре native 16×16 export labels и все raster/export handlers.

Намеренный diff обычных кнопок: Arial 14.4/600, 8×15, 1 px border, 35.5 px
height → CoFo 16/500, 8×20, no border, 36 px. Bar width 904.695→947.742 px;
left/bottom anchor сохранён. Default, Bayer и Pixel Size 4 имеют одинаковый
full-page diff `21675/max255/[8,400,623,423]`, целиком вне Canvas; Canvas pixels,
38 fields, panels и Canvas/overlay geometry точны. Alpha, mutually-exclusive
×2/×4/×8, PNG ×2, disabled/no-image и reload restore проходят без errors.
Dither 11/11 и check:actions проходят. Следующий шаг — UPG-056h.

## 18. Выполнение UPG-056h

Action family закрыта. Machine gate фиксирует восемь shared shells, 31
`btn-fixed`, две специальные кнопки Sparky, девять labels и восемь private
export pipelines.

| Владелец | Финальная граница | Условие удаления расширения |
|---|---|---|
| Framework | centered bar; fixed-button normal/hover/focus/disabled | canonical component |
| Sparky | progress, cancel, animated labels, mobile hiding | только при появлении второго идентичного cancellable worker lifecycle |
| Keyboarder | formats, Outline and import/export handlers | domain behavior не переносится |
| Wordplayer | aria-busy and transparent PNG option | domain behavior не переносится |
| Pulsar | Copy success flash and verifier modal | flash может стать shared только вместе с UPG-057 toast decision |
| Wander | SVG handler and filename only | presentation bridge после удаления legacy reset |
| Pizza | muted Setup, bordered PDF, right group | bridge после legacy reset; semantic variants остаются |
| Sticky | muted/group/edit/data/batch/Sheets | bridge после legacy reset; mode/data variants остаются |
| Dither | left anchor, remove buttons, native raster labels | anchor только при отдельном redesign; bridge после legacy reset |

Sparky progress остаётся private view extension: он связан с animation worker,
двумя меняющимися format actions и cancel, поэтому общего контроллера в
framework не добавлено. `revert-layer` bridges удаляются в UPG-058 только после
удаления соответствующих universal resets и повторной visual/domain приёмки.

Full Gate G4 проходит: manifests/assets/provenance, storage/path isolation,
36 framework tests, все app suites и воспроизводимый 15-asset Pizza runtime.
Следующий этап — UPG-057a dialog/tooltip/error/toast inventory.
