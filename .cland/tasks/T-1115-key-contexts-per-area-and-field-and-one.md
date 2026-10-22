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
updated: 2026-10-22T15:30:11.275Z
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
  - done: impl-1115 · 2026-10-22T15:30:00.549Z
- [x] C5. `web/README.md` under Palette and keys describes the contexts, the per-area tables and how an area declares the actions it handles (docs).
  - done: impl-1115 · 2026-10-22T15:30:00.786Z

## Comments

### impl-1115 · 2026-10-22T15:28:58.474Z

Implemented context-partitioned physical-code resolution, explicit field opt-in, handled-action help/palette and the shared non-Items AreaSlot. TDD observed resolver red (Sessions d wrongly returned plan-discuss), browser field red (composer Enter unclaimed), ordinary field ancestor red, and palette contextual-action red before fixes. Existing Web test files have not been edited. Local macOS targeted runs passed: pure resolver, new key-contexts (3 tests; each <1.1s), unchanged palette/help, folds and shell. Full queued verification follows a clear source review at its exact head; no suite receipt is claimed yet.
