---
id: T-921
kind: task
title: nvim vboard.test.ts 'release versions appear once … > v0.1.1' fails intermittently on Linux T2 (T-920 verify cde54197)
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-357
found_by: cover
topic: topic-671
branch: t/T-921-nvim-vboard-test-ts-release-versions
created: 2026-10-19T23:36:38.488Z
updated: 2026-10-19T23:43:59.716Z
---

## Summary

`nvim/test/vboard.test.ts::release versions appear once in the scope, all tree, top bar and item header > v0.1.1` failed once in T-920's mode-free verify cde54197 at bf683e74 (A-6810, ~line 44376; Linux droplet, T2), though T-920 changed only nvim/test/client.test.ts. The failing screen already shows `R-228 v0.1.1` in the top bar and tree, so the assertion likely read a frame mid-render. On dev 15f9c308 the file passes 3/3 serially on macOS, and it passed in both stage covers.

## What to build

Find what the subtest's assertion reads, a count of version occurrences or a tree line, and make it wait on the settled rendered state, as T-909 did for the Items panel. Keep the "appears once" assertion exactly as strict.

## Acceptance criteria

- [x] C1. The cause is named in the report from the A-6810 screen.
  - done: impl-921 · 2026-10-19T23:38:21.460Z
  - verified: rev-30 [reviewer] · run rev-20261019-921-source-corrected · 2026-10-19T23:43:59.716Z · commit 5ce5d2703f115346b3b90426fb6eff0e6fc583ba
- [ ] C2. The file passes 20 serial local runs, and the mode-free droplet verify at the reviewed head is green (load gate 5/5 on the changed test), with receipts in the report.
  - failed: rev-30 [reviewer] · 2026-10-19T23:41:10.677Z · note Changed test is duration-baseline-known and receives0 load repetitions; required reviewed-head5/5 proof cannot be produced until corrected identity is eligible.

## Comments

### impl-921 · 2026-10-19T23:37:44.804Z

Cause confirmed from A-6810: v0.1.1 fails the tree assertion at line 203, because waitScreen accepts 'all · 2 items' while the items pane still contains board rows ('epic all · E-269', bare R-228 v0.1.1 with 0/1). set_filter changes state and state.changed schedules rendering; metadata and content can be sampled in different frames. Replaying the captured failure screen confirms old readiness=true and required tree-row predicate=false. Updated scope/tree/item waits require the exact rendered rows the existing assertions read; all assertions remain unchanged. Existing T2 Neovim/stub-hub seam retained. Baseline passes 24/24 (5.296s). origin/dev fetched and merged (already up to date); typecheck and 20 serial single-file runs underway.

### impl-921 · 2026-10-19T23:39:48.072Z

Local validation complete at pushed d4a4bb0e640f6e20b95cce7b3c136a1fc5bfc610: npm run typecheck and git diff --check pass; 20/20 serial full-file runs pass (480/480 tests, zero skipped/failures), 102.937s total, 4.762–5.940s per file. Full receipt A-6814 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6814-t-921-20-serial-vboard-test-ts-passes-macos.log. C2 remains pending same-head mode-free Linux verification and 5/5 load gate. Requesting source review now.

### rev-30 · 2026-10-19T23:41:10.677Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-921-source
commit: d4a4bb0e640f6e20b95cce7b3c136a1fc5bfc610
scope: full
findings: [{"severity":"medium","text":"M1: Changed regression retains its duration-known parent identity (durations.json:4660), so unchanged loadGateRepetitions returns0 and mode-free verify cannot supply C2's required5/5. Use a fresh descriptive identity, keeping assertions/baseline/policy intact.","file":"nvim/test/vboard.test.ts","line":175}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear, A-6820. M1 medium at vboard.test.ts:175: exact existing title is in durations.json:4660; task load policy suppresses repetitions for known identities. Give this corrected regression a fresh descriptive identity without baseline/shared-policy edits, then request fresh source review before verify. Render predicates otherwise match actual failed frame and preserve every exact assertion. Local A-6814 independently audited20/20 runs,480/480,zero nonpasses; cannot replace explicit C2 droplet5/5. C1 diagnosis supported. QA none; no Reviewer tests.

Criteria: C2 failed (Changed test is duration-baseline-known and receives0 load repetitions; required reviewed-head5/5 proof cannot be produced until corrected identity is eligible.).

### impl-921 · 2026-10-19T23:43:37.274Z

Addressed source review M1 at pushed 5ce5d2703f115346b3b90426fb6eff0e6fc583ba: renamed the corrected parent to 'release versions appear once in settled scope, all-tree, top-bar and item-header frames', giving mode-free load selection a fresh identity. No duration manifest/policy changes; all assertions remain unchanged. Repeated full local validation at this head: npm run typecheck passes; 20/20 serial full-file runs, 480/480 tests, no skips/failures, 102.543s total, 4.840–5.946s/file. Receipt A-6822: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6822-t-921-20-serial-renamed-vboard-test-ts-passes-at-5ce5d270.log. No dev merge after first source review; requesting fresh source review.

### rev-30 · 2026-10-19T23:43:59.716Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-921-source-corrected
commit: 5ce5d2703f115346b3b90426fb6eff0e6fc583ba
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear,A-6823. M1 resolved by title-only fresh descriptive parent identity absent duration baseline/allow, with assertions, row waits and shared policy unchanged. Combined one-file review has no findings. C1 diagnosis verified from recorded mixed frame and scheduled render code. Fresh A-6822 independently audited20/20 serial file exits,480/480,zero nonpasses,renamed parent20/20; C2 local portion established. C2 final awaits exact-head mode-free Linux green and actual changed-test5/5 without owned resource/budget failure. A-6820 historical; QA none; no Reviewer tests.

Criteria: C1 verified.
