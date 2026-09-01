# UPG-057: Dialog, Tooltip and Feedback Compatibility Matrix

Дата аудита: 2026-09-01.

## 1. Цель и граница

UPG-057 унифицирует presentation и базовый lifecycle диалогов,
подсказок и обратной связи. Framework может владеть:

- visual tokens и shell;
- show/hide, Escape, backdrop, focus entry/return и cleanup listeners;
- нейтральными `status`, `success`, `warning` и `error` presentation;
- механикой клавиатурной подсказки.

Приложение обязано сохранять владение:

- текстом, validation и recovery decision;
- domain HTML внутри verification/import/help;
- решением, можно ли продолжать export/import/delete;
- Pizza Boxer draft recovery и import rollback;
- Sticky Fingers Google Sheets status;
- Sparky animation progress/cancel;
- Pulsar verifier и его известной CRC-особенностью.

На этапе UPG-057a production files не меняются.

## 2. Фактический инвентарь до rollout

В восьми runtime найдено:

- 3 нативных `<dialog>`: Sparky, Keyboarder, Wordplayer;
- 2 активных fullscreen overlay: Dither и Pulsar Coder;
- 2 недостижимых overlay fragment: Pizza Boxer без opener/controller и
  Sticky Fingers с оставшимся controller, но без удалённой Help button;
- 1 private non-modal popup Sparky с `role="dialog"` для shortcuts;
- 47 статических tooltip hosts: Sparky 4, Keyboarder 21,
  Wordplayer 22;
- shared `ApplicationShell._showToast()` и 8 активных Keyboarder calls;
- 2 private Pizza notification families: `ErrorPresenter` и
  `DraftRecoveryController`;
- 1 inline Sticky `dataStatus` family с loading/error/success;
- 9 primary blocking browser calls: Sticky 5 `alert()` + 1 `confirm()`,
  Pulsar 3 `alert()`; Wander имеет ещё 1 error-only `alert()` в clipboard
  fallback;
- 1 button-local Pulsar success flash `✓ Copied!`;
- 1 private Sparky animation live region, который не входит в
  generic toast family.

Fallback `window.alert`/`window.confirm` в Sparky не считаются primary:
они вызываются только при отсутствующем framework `DialogHost`.
Donor examples, documentation, tests, generated Pizza assets и vendor code в active
counts не входят.

## 3. Dialog family matrix

| Инструмент | Runtime family | Содержимое | Текущий lifecycle | Владелец после UPG-057 |
|---|---|---|---|---|
| Sparky | native shared `DialogHost` | confirm path regeneration, import/export errors | backdrop, Escape, initial focus; browser native modal focus | shared shell/lifecycle, private copy/decision |
| Sparky | private anchored popup | keyboard shortcuts | button, outside pointer, Escape, focus return | private disclosure; shared tokens только если zero-diff |
| Keyboarder | native shared `DialogHost` | about, verify report, import review, prompt/confirm/errors | shared base + rich private content/extensions | shared shell/lifecycle, private report/review |
| Wordplayer | native shared `DialogHost` | about and export/asset errors | shared base | shared shell/lifecycle, private copy |
| Dither | legacy overlay | instructions | close, backdrop, Escape, body overflow | first `OverlayDialogHost` canary; help body private |
| Sticky Fingers | dormant legacy overlay | instructions | controller остался, но `helpButton` удалён и UI-trigger отсутствует | не активировать; удалить только после orphan-proof в UPG-058 |
| Pulsar Coder | legacy overlay | rich verification result | close/backdrop; no Escape/focus return or dialog ARIA | shared overlay lifecycle; verifier HTML private |
| Pizza Boxer | orphan overlay fragment | instructions | no source opener/controller found | do not activate; prove orphan, remove only in UPG-058 |
| Wander Bender | none | — | dead copied modal CSS only | no runtime component; CSS cleanup only in UPG-058 |

### Native DialogHost findings

Existing `DialogHost` already provides a Promise API, safe text by default,
opt-in HTML, button construction, input focus, Escape and backdrop dismissal.
Native `<dialog>` supplies modal focus containment and normally returns focus to
the invoking control.

The following contract gaps must be covered before expanding usage:

- there are no framework unit tests for the dialog lifecycle;
- markup in the three apps does not explicitly connect the dialog to its title
  with `aria-labelledby`;
- an external native `cancel`/`close` path can leave `resolvePromise` pending;
- a second `show()` while a dialog is open has no explicit replacement policy;
- `close()` must be idempotent and must resolve exactly once;
- opt-in HTML must remain an application responsibility and must never become
  the default error API.

### Overlay findings

Shared CSS contains both legacy overlay rules and native dialog rules. Both use
the unscoped selector `.modal-content`. The later native rule sets `width: 100%`
and `padding: var(--spacing-3xl)`, so it can also affect an overlay when its local
copy is removed. Responsive CSS repeats the same broad selector.

This collision is a hard rollout blocker. The native selector must first become
`.modal > .modal-content` (and its responsive equivalent), protected by tests
for both families. No application may delete its overlay CSS before that gate.

The two active overlays differ in lifecycle; Sticky is recorded separately as
dormant code:

- Dither supports Escape, backdrop and body-scroll restore, but has no explicit
  initial focus or focus return;
- Sticky's unreachable controller supports close/backdrop only and toggles
  inline `display`;
- Pulsar supports close/backdrop only and currently lacks `role="dialog"`,
  `aria-modal`, `aria-labelledby` and synchronized `aria-hidden`.

`OverlayDialogHost` is justified by two active consumers with the same shell.
It may own only
open/close, Escape, backdrop, ARIA synchronization, focus entry/return and
listener cleanup. It must accept the existing element and classes; it must not
generate or reinterpret domain content.

## 4. Tooltip family matrix

| Группа | Count | Текущее поведение | Целевой контракт |
|---|---:|---|---|
| Sparky | 4 | shared cursor tooltip; some hosts also retain native `title` | pointer and keyboard parity without changing labels |
| Keyboarder | 21 | shared cursor tooltip; one label can change dynamically | dynamic text remains current; disabled copy remains supported |
| Wordplayer | 22 | shared cursor tooltip in Dither/Forms and action controls | mode-hidden hosts never expose stale tooltip |
| Other five apps | 0 | no tooltip runtime | no speculative rollout |

`TooltipService` currently listens only to mouse events. Its generated element
has no `role="tooltip"`, keyboard focus does not reveal it, and no host receives
`aria-describedby`. Positioning uses global `window` instead of the injected
document's `defaultView`.

UPG-057 must add focus-in/focus-out support without changing pointer pixels.
The service may add and remove only its own description ID; it must preserve an
existing `aria-describedby`, update dynamic `data-tooltip`, distinguish disabled
copy and clean every listener/attribute in `destroy()`.

## 5. Feedback and error family matrix

| Инструмент | Family | Инвариант | Shared/private decision |
|---|---|---|---|
| Keyboarder | `ApplicationShell._showToast` / `role=status` | eight success/status paths; timer reset at 2200 ms | shared lifecycle/presentation stays; copy private |
| Pizza Boxer | `ErrorPresenter` / assertive alert | non-blocking error, safe text, timer/dispose | keep private controller; may consume shared tokens later |
| Pizza Boxer | draft recovery dialog-like notification | Restore/Discard, persistence, async recovery | entirely private domain component |
| Sticky Fingers | inline `dataStatus` | Sheets loading/error/success near source controls | private placement/state; add live semantics separately |
| Sticky Fingers | browser alert/confirm | five export/import/preset errors, one delete decision | migrate to shared dialog only after exact behavior tests |
| Pulsar Coder | button flash + browser alerts | Copy success and three empty-map errors | keep button-local success; move errors only after canary |
| Wander Bender | browser alert fallback | clipboard failure only | low-priority shared alert migration |
| Sparky | export live region | progress, cancel, Done, failure | private, tied to animation worker |
| Wordplayer | button busy + shared alert | export preparation/failure | private busy, shared dialog shell |
| Dither | none | — | do not add feedback without a real state |

There is no honest single `FeedbackController` for these cases. UPG-057 may
standardize visual tokens and accessibility roles, but must not merge recovery,
Sheets, verifier, export or animation state machines.

## 6. Shared/private boundary

Framework owns after rollout:

- scoped native-dialog and overlay-dialog shells;
- reusable native and overlay dismissal/focus lifecycle;
- tooltip pointer/keyboard lifecycle and tooltip presentation;
- existing neutral toast lifecycle and status/error presentation tokens;
- tests that prevent selector collision, missing ARIA and orphaned listeners.

Applications continue to own:

- all message text and localization;
- validation, confirmation result handling and retry decisions;
- rich report/review/help markup;
- domain progress and busy state;
- placement when it communicates domain context, notably Sticky Sheets;
- Pizza draft storage/recovery and ErrorPresenter disposal;
- Pulsar Copy flash and verifier result construction;
- Sparky shortcut disclosure and animation export state.

## 7. Rollout plan

### UPG-057a — inventory, no production diff

- freeze counts, families, ownership and known lifecycle gaps;
- record the `.modal-content` selector collision as a rollout blocker;
- select Dither as overlay canary because it has the strongest existing
  lifecycle and already has three raster-safe visual baselines;
- keep full Gate G4 green.

### UPG-057b — machine-readable feedback contract

- add `check:feedback` to gate 3 native dialogs, 2 active overlays, the Pizza
  and Sticky dormant fragments, the Sparky popup and 47 static tooltip hosts;
- gate primary alert/confirm calls, live regions, private presenters and app
  ownership markers;
- include the checker in Gate G4 before any production change.

### UPG-057c — shared CSS and native DialogHost hardening

- scope native `.modal-content` rules so overlay geometry cannot inherit them;
- add DialogHost lifecycle tests for confirm/prompt/alert, backdrop, Escape,
  external cancel/close, repeated close and focus return;
- add zero-visual labelling in Sparky, Keyboarder and Wordplayer;
- verify their rich private extensions and all priority app suites.

### UPG-057d — keyboard-accessible TooltipService

- add role/description and focus lifecycle while preserving mouse behavior;
- test dynamic and disabled copy, viewport collision and destroy cleanup;
- verify all 47 hosts in Sparky, Keyboarder and both Wordplayer modes;
- require zero pointer-state visual diff outside the tooltip itself.

### UPG-057e — Dither overlay canary

- introduce the minimal shared `OverlayDialogHost`;
- replace only Dither's duplicated lifecycle code;
- preserve exact open/closed geometry, body-scroll restore and help content;
- require zero changed Canvas pixels for default, Bayer and Pixel Size 4.

### UPG-057f — Pulsar overlay rollout and dormant-fragment proof

- move Pulsar close/backdrop/Escape/focus/ARIA lifecycle to the shared host;
- preserve Pulsar rich verification HTML and known CRC behavior;
- prove the Pizza fragment has no controller and the Sticky fragment has no
  active trigger; leave both removals for UPG-058;
- preserve Sticky Sheets and all export paths without reviving removed Help UI.

### UPG-057g — feedback accessibility and blocking-call migration

- add live semantics to Sticky data status without moving Sheets logic;
- migrate browser alert/confirm calls one app at a time to the proven shared
  dialog surface, starting with the smallest error-only Wander fallback;
- preserve Keyboarder toast timing, Pizza presenters, Pulsar Copy flash and
  Sparky progress as documented private families;
- do not introduce messages or progress where none existed.

### UPG-057h — feedback component gate

- run `check:feedback`, isolation, all eight app suites and full Gate G4;
- browser-check every open/close path, keyboard dismissal and focus return;
- record remaining private families and removal conditions;
- only then start UPG-058 legacy cleanup.

## 8. Browser acceptance

Every dialog rollout must capture closed and open states and verify:

- trigger identity, initial focus, Tab containment where modal, Escape,
  close button, backdrop and focus return;
- `aria-hidden`, `aria-expanded`, `aria-modal`, label and live-region state;
- no scroll-lock leak after close or repeated open/close;
- no input, panel, SVG/Canvas or export-state mutation caused by presentation;
- no new console/module/resource errors.

Application-specific acceptance:

- Sparky: desktop plus 390×844 and 430×932; shortcut popup and animation
  progress remain distinct;
- Keyboarder: verify report and import review HTML, confirm/prompt and all
  eight toast paths;
- Wordplayer: Dither/Forms, asset/export errors and busy restore;
- Pizza Boxer: ErrorPresenter timeout/dispose and draft Restore/Discard;
- Sticky Fingers: dormant help proof, delete confirm, five error paths and
  Sheets status;
- Pulsar Coder: verifier success/failure layout, known CRC failure, Copy flash
  and empty-map errors;
- Dither: help plus byte-identical default/Bayer/Pixel Size 4 Canvas;
- Wander Bender: clipboard failure path and all three SVG modes.

## 9. Rollback rules

Roll back the current app change inside `upgrade` when any of the following is
true:

- dialog geometry changes outside the explicitly accepted shared typography;
- focus is lost to `body`, Escape/backdrop differs from the recorded contract
  or a Promise remains unresolved;
- a hidden dialog/popup remains keyboard reachable;
- a tooltip overwrites an existing accessible description or remains after
  destroy/mode switch;
- a message changes validation, recovery, export, persistence or Sheets logic;
- SVG/Canvas hash, form state, panel geometry or export bytes change;
- Dither Canvas capture changes by even one pixel during its overlay canary;
- any request crosses the `upgrade/` isolation boundary.

## 10. Confirmed first decision

UPG-057 is not a conversion of every message into one generic component. It is
a shared presentation/lifecycle layer around several deliberately separate
domain families. The first production edit is forbidden until `check:feedback`
protects the inventory and the `.modal-content` collision has a regression
test.

## 11. UPG-057b/c result

`check:feedback` is active inside Gate G4. It protects 3 native dialogs,
2 active overlays, 2 dormant fragments, the Sparky popup, 47 static tooltip
hosts, 10 primary blocking browser calls and the private presenter boundaries.

The CSS blocker is resolved with separately scoped overlay and native content
shells. Existing computed presentation is deliberately preserved: Keyboarder
before/after keeps the exact 480×406.5 dialog, transformed 456×386.175 content,
20 px padding, 12 px radius, 80 vh max-height, 0.95 transform, 0.35 s transition
and 24 px title. Wordplayer preserves the same style family and returns focus to
`introHelpBtn` after Escape. Dither and Pulsar still open their 600 px overlay
shells; Sticky remains dormant because there is no `helpButton`.

`DialogHost` now owns native `cancel` and external `close`, explicit replacement
of a pending dialog, exact-once resolution, focus restoration and listener
cleanup. The three direct consumers explicitly reference `dialogTitle` through
`aria-labelledby`. Framework tests increase from 36 to 38; full Gate G4 passes.
UPG-057d may now change TooltipService without touching dialog/domain behavior.

## 12. UPG-057d result

All 47 existing hosts now share pointer and keyboard behavior. The service adds
`role="tooltip"`, synchronized `aria-hidden`, focus-in/focus-out, reversible
`aria-describedby` and Escape dismissal. Existing descriptions are preserved,
disabled copy still wins for inactive controls, dynamic attributes are reread,
viewport collision uses the injected document window and `destroy()` removes
every listener, description and generated node.

Pointer presentation is exact before/after in all three consumers. Sparky keeps
its 92.242×26 tooltip at the measured pointer position; Keyboarder and
Wordplayer keep 100.094×25.5. Text, 6×10 padding, 12/400 font, colors, 4 px
radius, opacity, visibility and z-index are unchanged. Keyboard focus exposes
the same Copy share link text and Escape removes only the service-owned
description while leaving focus on the trigger. Framework tests increase to
39 and full Gate G4 passes. Next is the Dither overlay canary.

## 13. UPG-057e result

The new shared `OverlayDialogHost` is presentation-neutral: it consumes existing
overlay/content/trigger/close nodes and owns only class/ARIA state, reversible
scroll lock, Escape/backdrop dismissal, Tab containment, focus return and
listener cleanup. It does not own copy, rich HTML, CSS or an application action.
Two unit tests prove idempotent initialization, exact restoration of a prior
body overflow value, close/backdrop/Escape, Tab wrap, focus return and destroy.

Dither is the first consumer through its existing adapter. Its duplicate local
listeners and direct class/overflow writes are gone; its public `openModal()`
and `closeModal()` compatibility methods delegate to the host. Closed default,
Bayer and Pixel Size 4 snapshots have no state differences and zero changed RGB
channels. The open shell retains the exact `[340, 118.234375, 600,
483.5234375]` content rectangle, 30 px padding, 12 px radius, 600 px max-width,
576 px max-height, background and transform. Help copy and markup are unchanged.

The deliberate open-state change is focus: it now starts on `modalClose`
instead of remaining behind the overlay on `helpButton`. The trigger receives
`aria-haspopup="dialog"`, `aria-controls="modalOverlay"` and synchronized
`aria-expanded`; Escape and backdrop return focus to it and restore body
overflow. The single close control forms a contained Tab loop. Dither passes
11/11, framework 41/41, the feedback contract and full Gate G4. Next is the
Pulsar overlay rollout and dormant Pizza/Sticky proof.

## 14. UPG-057f result

Pulsar now consumes the same shared host with `bindTrigger: false`: the app
still verifies first, owns its rich HTML and calls `open()` only after the
domain result is ready. The legacy CRC failure body is unchanged. The open
content remains exactly `[340, 223.5859375, 600, 272.8203125]` with the same
30 px padding, 12 px radius, max sizes, background and transform. Its 22 fields,
three panels and 40,180-character SVG hash `97155e5a…` are unchanged; Copy flash
still restores after 1.5 seconds.

Initial focus moves intentionally from the obscured Verify trigger to Close.
Tab wraps on the only focusable control; Escape, backdrop and Close return to
Verify, restore body overflow and synchronize `aria-hidden`/`aria-expanded`.
The content is labelled by `verifyModalTitle`, and the close action has an
accessible name. No browser/module error is introduced.

Dormant-fragment proof is both static and runtime. Pizza loads one orphan
overlay but has zero Help/ARIA trigger and no modal controller or shared-host
reference. Sticky keeps one closed overlay and its pre-existing old controller,
but has zero `helpButton`; runtime remains inactive, `aria-hidden="true"`,
opacity 0 and pointer-events none. The shared host is absent from both apps, so
UPG-057f cannot revive their removed Help UI. Framework passes 42/42, Pulsar
8/8, feedback contract and full Gate G4. Next is UPG-057g feedback accessibility
and blocking-call migration.

## 15. UPG-057g result

The remaining ten primary browser-blocking calls are now zero. Sticky Fingers
routes its five error paths and the dormant navigator delete decision through
the shared `DialogHost`; Pulsar routes its three empty-map export guards through
the same host; Wander Bender routes its clipboard fallback through it. Domain
copy, validation, codec, export, persistence and recovery decisions remain in
their applications. The private Pizza error/draft presenters, Sparky shortcut
popup and Wordplayer busy/error lifecycle are deliberately unchanged.

Sticky `dataStatus` is now an atomic live region: normal progress/success is
`status`/polite and validation failure is `alert`/assertive. Its Google Sheets
request remains explicit and user-initiated; the blank-URL acceptance path makes
no request and reports the existing “Please enter a URL” text. The dormant Help
fragment remains closed and untriggered.

Closed Sticky and Wander captures are byte-identical to their immediate
baselines. Sticky retains 79 fields and exact SVG markup; Wander retains 41
fields, the 300×605.703125 panel and exact Radial SVG. Pulsar retains all 22
fields, three panels, rich Verify failure body and the 40,180-character SVG hash
`97155e5a…`; its known reload-only SVG raster jitter remains 291 RGB channels,
maximum delta 2. Hidden dialogs introduce no geometry or paint difference and
no browser/module error.

The feedback gate now protects 6 native dialogs, 2 active overlays plus 2
dormant fragments, 1 private popup, 47 tooltip hosts and 0 primary blocking
calls. Sticky passes 5/5, Pulsar 8/8, Wander 10/10, framework 42/42, isolation,
all other application suites and full Gate G4 pass. UPG-057h is the final
ownership/removal-condition audit before UPG-058.

## 16. UPG-057h final component gate

The accepted runtime inventory after rollout is:

| Family | Shared owner | Application owner | Removal rule |
|---|---|---|---|
| 6 native dialogs | `DialogHost` lifecycle and shell | copy, validation, rich HTML and decisions in Sparky, Keyboarder, Wordplayer, Sticky, Pulsar and Wander | keep; remove only with the consuming feature |
| 2 active overlays | `OverlayDialogHost` lifecycle | Dither help and Pulsar verification body/style extensions | keep; local duplicate lifecycle must not return |
| 2 dormant overlay fragments | none | Pizza orphan markup; Sticky orphan markup/controller | UPG-058 only after selector/controller proof and exact closed-state capture |
| 47 tooltips | `TooltipService` and shared presentation | dynamic copy on 4 Sparky, 21 Keyboarder and 22 Wordplayer hosts | keep; other apps get no speculative hosts |
| Keyboarder toast | shared `ApplicationShell` lifecycle | eight messages and invoking decisions | keep; timing stays 2200 ms |
| Pizza error/recovery | none | `ErrorPresenter` and `DraftRecoveryController` | keep private; not a duplicate of generic feedback |
| Sticky Sheets status | shared neutral tokens only | inline placement, loading/error/success and Sheets lifecycle | keep private live region |
| Sparky feedback | shared dialog where generic; private shortcut popup and animation live region | shortcut disclosure, progress/cancel/Done/failure | keep private domain state |
| Pulsar Copy flash | shared button tokens only | copy result and 1.5 s restore | keep private |
| Wordplayer busy feedback | shared dialog for errors | button busy/restore and export state | keep private |

UPG-058 may delete Pizza's orphan overlay only when no opener, controller,
ARIA relationship, test or generated public-runtime reference remains. It may
delete Sticky's dormant overlay/controller only when `helpButton` is still absent
and removing both leaves its 79-field normal/edit baselines, exports and Sheets
status exact. Wander's overlay-only selectors may be removed after proving there
is no overlay runtime markup. Its broad `.modal-content` is not an orphan: it
now also matches the native feedback dialog and must be separated with an open-
state capture. Dither and Pulsar local overlay CSS may lose only declarations
fully covered by the shared shell; their measured geometry, help/verifier
content and private visual extensions remain protected.

Cumulative browser acceptance covers native Escape/backdrop/focus return in the
priority consumers, Dither and Pulsar overlay Tab/Escape/backdrop/scroll paths,
tooltip pointer/focus/Escape behavior and every changed closed state. The final
runtime smoke loads all eight entrypoints to `readyState=complete`, with every
dialog/overlay closed and zero browser errors. The intentionally dormant Wander
clipboard and Sticky navigator paths are not revived solely for testing; their
presentation lifecycle is covered by the shared host tests and their call sites
by the feedback boundary.

Final evidence: `check:feedback`, `check:isolation`, framework 42/42, all eight
application suites and full Gate G4 pass. UPG-057 is complete; the next task is
UPG-058a, a no-production-diff legacy CSS/orphan-selector inventory.
