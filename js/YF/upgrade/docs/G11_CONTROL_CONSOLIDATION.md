# G11 control consolidation

Дата: 2026-09-05.

G11 реализует одобренные решения из G10 variance audit. Частная генеративная
логика, форматы файлов, persistence и export pipelines не меняются.

## UPG-092 — boolean и exclusive controls

Статус: **Complete**.

- Pizza Boxer: `Visible`, `Own Grid`, `Sides` и `Objects` переведены со старых
  `toggle-chip` на общий `pill-toggle`.
- Eye icons и обслуживающий их `toggle-chip-checked` synchronizer удалены.
  Само состояние видимости surfaces, sides и objects осталось прежним.
- Pizza Boxer: взаимоисключающие `Width / Height` в Graphics editor теперь
  используют общий `segmented-control`; ids, radio group и size-mode controller
  сохранены.
- Sparky: визуально избыточная pill `Manual` удалена. Оставлен один checkbox/pill
  `Follow cursor`: checked означает следование за курсором, unchecked — прежний
  ручной режим с видимой drag handle.
- Изменение Angle/Distance по-прежнему выключает `Follow cursor`; внутренний
  `showPoint` остаётся частью состояния и preset compatibility, а не DOM-контролом.
- Сводка Modes больше не пишет противоречивое `Manual · Follow`: для Static она
  показывает `Static · Follow` или `Static · Fixed`, для Path/Bolid — только mode.

## UPG-093 — color trigger и Dither Reset

Статус: **Complete**.

- Все 13 цветовых triggers в Sparky, Pizza Boxer, Sticky Fingers, Keyboarder,
  Wordplayer и Dither используют один общий контракт: hit area 30×30 px,
  padding 6 px и видимая цветовая точка 18×18 px.
- Сохранены прежние `color-dot` / `color-preview` hooks, inline color state и
  частные picker controllers. Framework унифицирует только presentation.
- Dither Reset теперь имеет высоту 36 px, не имеет собственной обводки и
  использует нейтральный focus-visible ring вместо системного синего; reset
  handler и transform defaults не менялись.

## UPG-094 — OpenType features: решение отложено

Статус: **Deferred by design**.

`salt`, `aalt`, `ss01`, `ss02`, `tnum`, `dlig` — OpenType feature tags:

- `salt` — stylistic alternates;
- `aalt` — access all alternates;
- `ss01`, `ss02` — первый и второй stylistic sets;
- `tnum` — tabular numerals;
- `dlig` — discretionary ligatures.

Они управляют glyph substitution/metrics внутри генерируемой типографики, а не
обычным UI-режимом. Поэтому их названия и логику нельзя менять вслепую. В G11
они намеренно остаются отдельным `toggle-chip`-семейством. Следующий безопасный
шаг — унифицировать только padding/type metrics между Pizza Boxer и Sticky
Fingers после отдельного визуального решения.

## Изоляция

Изменения ограничены `js/YF/upgrade/**`. Runtime Pizza Boxer воспроизводимо
пересобран из локального source; внешние `lunnen`, `othersite-ui-framework`,
Void и author-owned `lunnen/sparky/stages` не менялись.
