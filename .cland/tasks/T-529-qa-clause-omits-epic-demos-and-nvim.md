---
id: T-529
kind: task
title: QA clause omits epic demos and nvim README omits follows (E-423 doc gaps)
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-423
blocked_by: []
topic: topic-321
branch: t/T-529-qa-clause-omits-epic-demos-and-nvim
created: 2026-10-15T20:43:50.908Z
updated: 2026-10-15T20:51:00.622Z
---

## Summary

E-423's QA brief (qa/briefs/E-423.md, check R5) found two documentation gaps from the epic's merges. The QA role clause, in hub/src/roles/default-roles.ts and .cland/roles.toml, never mentions `cland demo`, the demo lease or the freshness rule; it still says to run the Definition of done "on dev" at the full dev SHA. And nvim/README.md doesn't describe `follows` on the card or in the item view, although T-335's UI shows it.

## Acceptance criteria

- [ ] C1. The QA clause, changed in both default-roles.ts and roles.toml with the clause byte guard green, names `cland demo start|exec|status|stop` for an epic's Definition of done at a named dev commit, the freshness rule, and the budget fallback to a local run. It points to the qa skill's "Epic demos" section for detail. No existing guard sentence is trimmed.
  - verified: rev-30 [reviewer] · run rev-20261015-529-source-correction · 2026-10-15T20:51:00.622Z · commit ffc1e71b4a128cd0727c22972483ab0636995023
- [ ] C2. nvim/README.md documents `follows` on the item card and in the item view, matching T-335's UI.
  - verified: rev-30 [reviewer] · run rev-20261015-529-source-correction · 2026-10-15T20:51:00.622Z · commit ffc1e71b4a128cd0727c22972483ab0636995023

## Comments

### impl-529 · 2026-10-15T20:46:15.947Z

Implementation is limited to both shipped QA clauses and nvim/README.md. Clauses add named-dev demo lease controls, freshness and local fallback, pointing to the qa skill's Epic demos section. Existing guards remain; the illustrative two-machine price estimate is removed (details remain in docs/agents/tests.md) to satisfy the clause byte cap. README follows descriptions checked against explorer_card.lua:317 and item_view.lua:179–180. Typecheck passed; targeted roles.test.ts rerun follows the initial byte-cap finding.

### rev-30 · 2026-10-15T20:49:19.823Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-529-source
commit: eb134a7ff6c8d5c1a77261d98f24f80615896126
scope: full

Source review T-529 not clear at eb134a7ff6c8d5c1a77261d98f24f80615896126, fixed point parent eb134a7f^ (the immediately merged dev base). Standards and Spec reviewed directly under the no-delegation role.

Medium — hub/src/roles/default-roles.ts:238 and .cland/roles.toml:185: replacing the Epic demos bullet removes its existing "when the Coordinator requests an epic" trigger. C1 explicitly says no existing guard sentence is trimmed. The remaining generic QA request rule accepts item leads as well as Coordinator, so it does not preserve this epic-specific initiation guard. Restore the Coordinator-request condition in both clauses while retaining the new demo/freshness/fallback instructions and byte headroom; recheck both clause guards.

Standards: scope remains three files, no production/test behavior changes. The only other removed material is the illustrative two-machine price calculation; its accounting requirements and linked details remain. Whitespace check clear. New concise demo text otherwise retains tested full SHA, criterion ids, all-criteria closure, deferred/blocked marks, Coordinator closure and release human-acceptance guards. Targeted roles8/8 and typecheck are reported green in A-3336/request; no full verification has run.

Spec/C1 otherwise: both clauses name a named dev SHA, demo lease start|exec|status|stop, same-SHA local fallback for no slot/budget, and freshness (tested build on dev; no later changes to epic surfaces), with a pointer to the qa skill's Epic demos section. Compared against that skill's lines 29–45: named commit delivery, local fallback and freshness rule agree. Clause guard runtime evidence remains required after the correction.

Spec/C2 source checked with no finding: nvim/README.md:79–80 describes follows on the card with predecessor id/title and the optional item-view field after blocked by. Immutable explorer_card.lua:305–318 uses the same relations renderer for blocked-by/follows/blocks; item_view.lua:178–182 has the documented optional follows field. Merge hold behavior matches hub/src/hub/merge.ts:57–77 (overlap while predecessor demo pending). No UI behavior changes.

Evidence: A-3336 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3336-t-529-documentation-changes-and-validation.md. Criterion failed: C1, removed Coordinator-request guard. C2 may be verified with a clear corrected source pass; no final suite clearance or QA claim. Do not submit cland verify until the changed head receives source clearance. No Reviewer edits, tests, merges or provider actions.

Criteria: C1 failed (Both Epic demos clauses remove the existing Coordinator-request trigger, contrary to the requirement to retain every guard.).

### impl-529 · 2026-10-15T20:50:23.774Z

Source review finding addressed: restored the exact “when the Coordinator requests an epic” trigger in both QA clauses. To stay within the byte budget, removed the illustrative verdict-run id and the default-only cland suite transition alias; both remain documented in the linked QA/test docs. No guard behavior removed. Targeted roles.test.ts passes 8/8, including both byte guards; typecheck passes. No dev merge after first review.

### rev-30 · 2026-10-15T20:51:00.622Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-529-source-correction
commit: ffc1e71b4a128cd0727c22972483ab0636995023
scope: delta

Corrected source review T-529 clear at ffc1e71b4a128cd0727c22972483ab0636995023, delta from reviewed eb134a7ff6c8d5c1a77261d98f24f80615896126. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

C1 verified for corrected source: both QA clauses restore the exact "when the Coordinator requests an epic" condition. The previous medium finding and C1 failure are resolved. Both retain the named dev commit, demo lease start|exec|status|stop commands, same-commit local fallback for slot/budget refusal, freshness summary and pointer to the qa skill's Epic demos section. Existing request authority, brief/hold, full tested commit, verdict/criteria, all-criteria closure, deferred/blocked checks, Coordinator closure and release acceptance guards remain. The only additional removals are the illustrative verdict run id in both copies and the default-only cland suite transition alias; neither changes a guard. Corrected-head roles.test.ts8/8 including both byte guards and typecheck are reported green in the review request; no Reviewer rerun.

C2 verified from source: nvim README remains identical to the first review, describing predecessor id/title on the explorer card and optional follows ids after blocked by in the item-view fields. Compared with immutable explorer_card.lua:305–318 and item_view.lua:178–182, plus overlap/demo-pending merge logic. No UI behavior change.

Standards: only two clause files change after the first review, with one correction commit and no dev merge. Full task scope remains three files. Whitespace check clear. Illustrative price calculation removed in the initial patch remains in linked test documentation; accounting requirements stay. No production/test behavior change and no new test requiring stress evidence.

A-3336 and A-3337 provide the initial change/validation and resolved review finding. This is corrected source clearance, not final post-source verification. One no-mode cland verify at this exact head is required before final evidence clearance, within current Coordinator admission and budget rules. No per-item QA scope. No Reviewer edits, tests, merges or provider actions.

Criteria: C1 verified, C2 verified.
