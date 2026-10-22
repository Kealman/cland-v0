---
id: T-1115
kind: task
title: Key contexts per area and field, and one area slot in the shell
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: topic-852
branch: t/T-1115-key-contexts-per-area-and-field-and-one
created: 2026-10-22T15:16:12.148Z
updated: 2026-10-22T15:35:20.002Z
---

## Summary

The single physical-code key map gains contexts: one table per area and per focusable field, with the shell's table everywhere and the focused context's table resolving first. The shell renders every area other than Items through one area slot. This shared prefactor serves both E-417 (Topics, thread, inbox, events, composer) and E-418 (Sessions, Accounts, Artifacts); no visible behaviour changes.

## Parent

E-417 (prefactor before tracer step 1). E-418's area modules are blocked by it as well.

## What to build

Today one chord resolves to one action for the whole page. Digits `1` to `7` always switch areas, the Items area owns `a d k l s x A`, `d` is the Plan view's discuss key, `⌘Enter` always opens the other pane, and keys typed in a field are dropped except `⌘K`. E-417 needs `1` to `9` to answer a focused ask, `1` to `8` to filter events, `d r A` and Enter in the inbox, and Enter, Shift+Enter and `⌘Enter` in the composer's field. E-418 needs Neovim's Sessions and Artifacts letters (`l a x r d c s k A`).

- **Contexts.** Each binding in the key map names its context: the shell (areas, palette, `?`, split, other pane, Esc, folds, leader), Items (its current bindings, the Plan view's included, moved unchanged), Topics, thread, inbox, events, composer, Sessions and Artifacts. The one listener asks the shell for the focused context. It resolves a chord among that context's bindings first, then the shell's, and still matches by `KeyboardEvent.code` with exact modifiers.
- **Fields.** A field belongs to a context only when it declares one (the composer will), so ordinary fields keep today's behaviour.
- **Declared and handled.** An area's view declares the actions it handles. A declared key the view does not handle yet does nothing. `?` and the palette list the shell's keys plus the handled actions of the focused context, so each key appears in help from the ticket that makes it work. Declare the Sessions and Artifacts tables now, with their labels: Sessions `j k ↓ ↑` move, Enter opens, `l` launch, `a` Aide, `x` stop, `r` resume, `d` archive, `c` capabilities, `A` archive toggle; Artifacts `j ↓ ↑` move (`k` keeps, as in Neovim), Enter opens, `s` to composer, `k` keep, `d` archive, `A` archived section.
- **The area slot.** Inbox, Topics, Events, Sessions, Accounts and Artifacts render through one slot. Each area supplies its rows, selected row, pane content and drawer content, and until an area has its own component the slot shows today's stand-in list.

## Acceptance criteria

- [x] C1. The same physical key resolves to the Items action in Items and to the focused area's own action in a context that declares it, with exact modifiers, and every existing Items and Plan binding and `1` to `7` in the shell resolve as before (test).
  - done: impl-1115 · 2026-10-22T15:30:00.061Z
- [x] C2. A field that declares the composer context receives its context's bindings, and any other field still receives only `⌘K` (Web test).
  - done: impl-1115 · 2026-10-22T15:30:00.326Z
- [x] C3. A key declared in the Sessions table but not handled by its view does nothing there and is absent from `?` in Sessions; `?` in Items lists the same keys and labels as before (Web test).
  - done: impl-1115 · 2026-10-22T15:30:00.445Z
- [x] C4. Inbox, Sessions, Topics, Events, Artifacts and Accounts render through the area slot with their stand-in lists, selection and drawer as before, the shell has one key listener, and the existing shell, palette, fold and Items Web tests pass unchanged (Web test).
  - done: impl-1115 · 2026-10-22T15:34:04.528Z
- [x] C5. `web/README.md` under Palette and keys describes the contexts, the per-area tables and how an area declares the actions it handles (docs).
  - done: impl-1115 · 2026-10-22T15:30:00.786Z
  - verified: rev-23 [reviewer] · run rev-20261022-1115-source-2 · 2026-10-22T15:35:20.002Z · commit 13e8700d1fbd73488ba5e229365da4fe8f7324a4

## Comments

### impl-1115 · 2026-10-22T15:28:58.474Z

Implemented context-partitioned physical-code resolution, explicit field opt-in, handled-action help/palette and the shared non-Items AreaSlot. TDD observed resolver red (Sessions d wrongly returned plan-discuss), browser field red (composer Enter unclaimed), ordinary field ancestor red, and palette contextual-action red before fixes. Existing Web test files have not been edited. Local macOS targeted runs passed: pure resolver, new key-contexts (3 tests; each <1.1s), unchanged palette/help, folds and shell. Full queued verification follows a clear source review at its exact head; no suite receipt is claimed yet.

### rev-32 · 2026-10-22T15:33:32.000Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261022-1115-source
commit: e557832c6411ed553572d7e28cfde29d04653cd2
scope: full
findings: [{"severity":"medium","text":"M1 Spec/C4: mode=palette exempts every shell action from the field guard, so ordinary search characters g/digits1–7/? are prevented and swallowed as jump/area/help actions. Restore native text for unhandled shell chords and add actual key-typing regression; fill bypasses keydown.","file":"web/src/keyboard.ts","line":35}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear, A-9220. Spec M1 medium at keyboard.ts:35: palette input now consumes ordinary shell-bound characters; the previous field allowlist protected them. C4 failed. Standards 0 independent findings; other context/explicit-field/handled-actions/AreaSlot/focus-restoration source paths match the request, and existing Web files remain unchanged. A-9212 is local targeted narrative, not raw configured evidence. No Reviewer runtime execution/failure claim. Implementer accepted M1 and is correcting; fresh source review required at changed head before mode-free verify. Audit: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9220-t-1115-source-not-clear-palette-typing.md.

Criteria: C4 failed (Palette search no longer accepts ordinary shell-mapped characters (g, digits1–7 and ?); restore input filtering and cover actual key typing.).

### impl-1115 · 2026-10-22T15:34:04.397Z

Fixed reviewer M1/C4 in 13e8700d. Red observed actual '?' vs expected 'g1234567?' on real palette typing; corrected guard preserves shell-mapped input while retaining palette navigation. Regression covers native g, Digit1–7, Shift+Slash and subsequent contextual action/focus restoration. Targeted local macOS regression and unchanged palette 11/11 passed; fresh source review requested before queued verification.

### rev-23 · 2026-10-22T15:35:20.002Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1115-source-2
commit: 13e8700d1fbd73488ba5e229365da4fe8f7324a4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 13e8700d. Continuation of A-9220 full audit; only keyboard.ts guard and new key-contexts Web regression changed since e557832c, no dev merge. M1 resolved: palette field permits its local controls and common dismiss/open-other/palette actions; ordinary g/digits/? return without preventDefault, explicit composer rule retained. Native key typing regression asserts g1234567? then handled Items action and restored focus. Existing Web files unchanged. Surrounding keymap/modal dispatch and README contexts/handledActions/AreaSlot agree; C5 verified. Standards0/Spec0 findings, no Reviewer runtime execution. C1–C4 remain runtime-dependent pending exact-head configured verification including unchanged Web compatibility files. Reported local targeted tests are not a configured pass; preserve original evidence.

Criteria: C5 verified.
