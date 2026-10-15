---
id: T-458
kind: task
title: "Rulebook view: ␣R and the palette's Rulebook open the rules in the centre with scope, status and date, unfold reason and origin, follow a thread origin with gt, and add, edit and retire from the view"
state: open
status: planned
size: M
labels:
  - v0.1.3
  - nvim
  - hub
assignee: null
parent: E-423
blocked_by:
  - T-455
topic: null
branch: null
created: 2026-10-15T07:15:15.741Z
updated: 2026-10-15T13:19:34.658Z
---

## Summary

The human reads and steers the rulebook from the workbench. `␣R` (free today) and the palette action "Rulebook" open a centre view with one row per rule. Enter unfolds a rule's text, reason and origin, and `gt` on a thread origin opens the human's message. `a`, `e` and `X` add, edit and retire a rule through the same hub frames as `cland rule`, recording `workbench` as the origin.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 6 of 7; spec `docs/spec/v0.1.3.md` §3.2 ("The workbench shows the rulebook with each rule's origin"); the epic's choice "The rulebook view".

## What to build

**The view.** A new module `nvim/lua/cland/rulebook.lua` and a centre view registered beside the others in `nvim/lua/cland/views.lua` and `layout.lua`.

- Each row shows `rule <n>`, the title, the scope, the status and the date.
- Active rules come first in id order. Retired rules follow, dimmed with a highlight in `hl.lua`.
- `<CR>` folds and unfolds the rule's text, reason and origin. The origin is printed as: the topic title and message time for `message:`, the Aide's name for `session:`, the path for `memory:`, and `shell` or `workbench` as written.
- `gt` on a `message:` origin opens the topic at that message, as `gt` on a reference does elsewhere. On other origins it says that the origin is not a thread.
- The view refreshes when the rulebook changes. The hub gains a small push, `rules.changed` with the new rule list, sent to connected UI clients whenever the rulebook is written or reloaded (ticket T-455's reload). This ticket adds that push, so it does not wait on ticket T-456's session events.

**Writing.**

- `a` opens a compose buffer with `Text:`, `Scope:` and `Reason:` fields. On write it records the rule with `rule.add` and origin `workbench`, and the new row is selected.
- `e` opens the same buffer filled from the rule under the cursor and records `rule.edit`.
- `X` asks for a reason and records `rule.retire`.
- The workbench's UI client writes as the human. The hub accepts its `rule.add`, `rule.edit` and `rule.retire` frames and records origin `workbench`, extending ticket T-455's writer rule.
- A refusal or a parse error from the hub shows in the buffer's message line, and the draft stays.

**Keys and palette.**

- `actions.lua` registers `␣R` (global) and the `rulebook` scope keys `<CR>`, `gt`, `a`, `e`, `X` and `q`.
- The palette gains the action "Rulebook", and `keys.lua` and the help list them.
- `<CR>` on a `rule` row in the events view opens the rulebook at that rule. That part applies only when ticket T-456 has landed; until then it needs no work.

**Tests.** Headless Neovim against a real stdio hub (`nvim/test/`): keys go in with `nvim_input` and the screen is read with `screenstring()`.

## Acceptance criteria

- [ ] C1. `␣R` and the palette action "Rulebook" open the rulebook in the centre with one row per rule showing `rule <n>`, title, scope, status and date, active rules first and retired ones dimmed, proven headless.
- [ ] C2. `<CR>` unfolds a rule to its text, reason and origin, and `gt` on a thread origin opens the topic at the human's message, proven headless with a rule recorded from a message.
- [ ] C3. `a` with text, scope and reason written records a rule with origin `workbench` that `cland rule list --json` reads, and the view shows it without a reload.
- [ ] C4. `e` edits and `X` retires the rule under the cursor through the hub, and a hub refusal is shown in the compose buffer with the draft kept.
- [ ] C5. A rule added from the shell while the view is open appears in it without a key press.
- [ ] C6. `nvim/README.md` describes the rulebook view, its keys and the origins, and the key help lists `␣R`.
