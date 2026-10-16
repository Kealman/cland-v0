---
id: T-550
kind: task
title: Retiring a rule overwrites its own origin with the retirement's origin
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.3
  - hub
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-455
topic: topic-346
branch: t/T-550-retiring-a-rule-overwrites-its-own
created: 2026-10-16T00:31:38.513Z
updated: 2026-10-16T00:46:54.016Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, case L10, at cdad9cdc). Retiring a rule replaced its origin (`session:qa-aide`) with the retiring human message's origin (`message:general/<id>`). The E-423 brief, and the rulebook's purpose, require each rule to keep its own origin. The cause is in `hub/src/rules/file.ts:120`: `retire()` spreads `{ origin }` over the rule whenever an origin is passed.

## Acceptance criteria
- [x] C1. Retiring a rule keeps its own `origin` unchanged and records the retirement's origin in a separate field (for example `retired_origin`), which `cland rule show` and `rule.list --all` display.
  - done: impl-550 · 2026-10-16T00:45:38.787Z
  - verified: rev-30 [reviewer] · run rev-20261016-550-source · 2026-10-16T00:46:54.016Z · commit b02a703b2189a8462413e315fc954ae9adb34b4e
- [x] C2. A test retires a rule added by an Aide session through a human-origin retirement, and reads back both origins. `rule edit` keeps its current origin behaviour, and RULES.md round-trips the new field.
  - done: impl-550 · 2026-10-16T00:45:40.095Z

## Comments

### impl-550 · 2026-10-16T00:34:45.564Z

Implementation started: preserve origin on retirement, add separate retired_origin with an optional RULES.md Retired-origin field, retain edit semantics. Regression seam: existing hub rule tool scenario (Aide-added rule retired by Coordinator from a human message), CLI show/list reads, and pure codec round-trip. Local tests waiting for the under-15 Mac load gate.

### rev-30 · 2026-10-16T00:46:54.016Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-550-source
commit: b02a703b2189a8462413e315fc954ae9adb34b4e
scope: full

Source review T-550 clear at b02a703b2189a8462413e315fc954ae9adb34b4e, direct parent/fixed point 4ee9368e0e7b02b8bc7f1357f7d0054d8f6d8a62. Standards and Spec reviewed directly. No high, medium or low findings.

C1 verified: RulebookFile.retire leaves origin untouched and writes supplied retirement provenance to retired_origin. The shared codec accepts an optional Retired-origin line only for retired status, applies the existing origin grammar and reports its exact bad line. Old retired rules without it remain readable. Rendering and rewriting a changed retired rule preserve both fields; untouched source spans still preserve bytes, including CRLF. File writes parse the rendered candidate before atomic replacement, so an invalid supplied retirement origin does not replace RULES.md.

Checked both caller paths: live session tools still resolve a Coordinator origin to a real stored human message and an Aide origin to the held session identity, rechecking authorization before write. Shell/Aide-shell/workbench dispatch now supplies shell/session:<name>/workbench as retirement origin instead of silently omitting it. Neither path changes edit behavior: session tools retain origin updates, shell edits preserve origin, workbench edits retain their existing origin behavior. CLI show/list display both fields, and socket/tool JSON returns the shared Rule with retired_origin. No client protocol shape duplication or invented authority bypass.

C2 implementation reviewed: public session scenario now retires the distinct Aide-created rule using a Coordinator's human-message origin, then checks both original and retirement origins through every role's tool list and CLI show/list text and JSON. Existing edit-origin assertion remains. CLI tests also retain shell, memory-origin Aide and workbench semantics. Pure codec regression checks legacy compatibility, exact unchanged round trip, changed-entry re-render/reparse and malformed/active retirement-origin refusal. Original assertions are retained, with list expectations adjusted for which rule was retired. README accurately distinguishes current edit behavior and separate retirement provenance.

A-3504 reports before-fix red for overwrite/unknown codec field and corrected serial Mac whole-file passes: rulebook3/3, rule-sessions7/7, rule-cli7/7; loads3.84/3.84/3.79, no Coordinator local suite. New codec case0.627ms, changed human/Aide scenario1.162s; typecheck and diff check pass. Immutable diff whitespace check independently clear. These targeted receipts support source clearance, not final same-head suite evidence. C2 final criterion verification stays pending the required post-source cland verify at this head. No per-item QA; E-423 owns the L10 stage demo rerun after merge.

Read item file for criteria/body under Coordinator bd00929a's T-548 guidance; no task.view journal scan. No Reviewer tests, compiler execution, edits, installs, commits, merges or provider actions.

Review artifact A-3506 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3506-t-550-source-clear-at-b02a703b-separate-retirement-provenance.md.

Criteria: C1 verified.
