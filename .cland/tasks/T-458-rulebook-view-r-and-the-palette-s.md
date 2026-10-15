---
id: T-458
kind: task
title: "Rulebook view: ␣R and the palette's Rulebook open the rules in the centre with scope, status and date, unfold reason and origin, follow a thread origin with gt, and add, edit and retire from the view"
state: open
status: review
size: M
criterion_seq: 6
labels:
  - v0.1.3
  - nvim
  - hub
assignee: null
parent: E-423
blocked_by:
  - T-455
topic: topic-294
branch: t/T-458-rulebook-view-r-and-the-palette-s
created: 2026-10-15T07:15:15.741Z
updated: 2026-10-15T14:01:53.717Z
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

- [x] C1. `␣R` and the palette action "Rulebook" open the rulebook in the centre with one row per rule showing `rule <n>`, title, scope, status and date, active rules first and retired ones dimmed, proven headless.
  - done: impl-458 · 2026-10-15T13:35:01.097Z
- [x] C2. `<CR>` unfolds a rule to its text, reason and origin, and `gt` on a thread origin opens the topic at the human's message, proven headless with a rule recorded from a message.
  - done: impl-458 · 2026-10-15T13:35:02.603Z
- [x] C3. `a` with text, scope and reason written records a rule with origin `workbench` that `cland rule list --json` reads, and the view shows it without a reload.
  - done: impl-458 · 2026-10-15T13:35:03.229Z
- [x] C4. `e` edits and `X` retires the rule under the cursor through the hub, and a hub refusal is shown in the compose buffer with the draft kept.
  - done: impl-458 · 2026-10-15T13:35:03.826Z
- [x] C5. A rule added from the shell while the view is open appears in it without a key press.
  - done: impl-458 · 2026-10-15T13:35:04.434Z
- [x] C6. `nvim/README.md` describes the rulebook view, its keys and the origins, and the key help lists `␣R`.
  - done: impl-458 · 2026-10-15T13:35:05.061Z
  - verified: rev-30 [reviewer] · run rev-20261015-458-source · 2026-10-15T13:37:29.566Z · commit 9e11687cfac96eefa1d09ce27d6240ff983fa0af

## Comments

### impl-458 · 2026-10-15T13:22:07.971Z

Implementation seams: real stdio hub + headless Neovim keys/screen and cland rule list/show for persistence. Reusing T-456 RulebookFile.subscribe for rules.changed; coordinating overlapping hub protocol/dispatch edits.

### impl-458 · 2026-10-15T13:35:18.209Z

Source review requested at 9e11687cfac96eefa1d09ce27d6240ff983fa0af; implementation/targeted evidence A-3027. Typecheck and headless Rulebook (4), CLI (7), Events (3), palette (18) tests green; shard lint green. Await source clearance before exact-head cland verify.

### rev-30 · 2026-10-15T13:37:29.566Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-458-source
commit: 9e11687cfac96eefa1d09ce27d6240ff983fa0af
scope: full

Source review clear at 9e11687cfac96eefa1d09ce27d6240ff983fa0af; no high, medium or low findings.

Standards: no findings against AGENTS.md, repo hub/Neovim test guidance, or code-review smell baseline. New view uses the shared action registry, centre-view lifecycle and snapshot journals. Draft errors are local and retain editable buffers; the shared RulebookFile observer is unsubscribed on core close. Tests send actual keys and inspect the rendered screen against a real stdio hub for core workflows; stub use is confined to held-snapshot/event ordering.

Spec: C1–C5 have source coverage. Rows show id/title/scope/status/date with active-first numeric ordering and retired highlighting; Enter details include origin resolution; paged topic history locates an older human message before gt opens/focuses it. Add/edit use acwrite field drafts, retain refused/modified drafts, and select saved rules. Retire captures the chosen rule and prompts for a reason. Hub assigns workbench origin on UI writes and filters edit fields so extra wire origin cannot forge CLI provenance. rules.changed publishes full lists after successful writes/valid reload, and client journals replay pushes over a pending rule.list snapshot. Event rule subjects select the corresponding rule.

C6 verified by source: nvim/README.md describes entry points, fields, origin forms, keys, saving/refusals and live refresh; actions/init help exposes ␣R and local keys. keys.lua remains the generic focus/layout module; the actual registry/help and global map are in actions.lua/init.lua.

Scope: git diff 53292737320dd085686dcd1cd8cf64a89c03facb...9e11687cfac96eefa1d09ce27d6240ff983fa0af, 18 files; includes shared RulebookFile observer/per-write-origin API 9496075c. Reviewed both Standards and Spec directly because the Reviewer role disables delegation. git diff --check passes.

A-3027 reports typecheck, Rulebook 4/4, rule CLI 7/7, Events 3/3, palette 18/18 and shard lint; test sources substantiate those checks, but C1–C5 remain unverified until accepted same-head post-source verification. This hub+Neovim diff requires full relevant Linux phases. No Reviewer tests or edits; qaPolicy none/after-stage, no per-item QA brief.

Criteria: C6 verified.
