---
id: T-1090
kind: task
title: Refresh the recorded Neovim fixture counts after the open-snapshot changes
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by:
  - T-1089
topic: topic-845
branch: t/T-1090-refresh-the-recorded-neovim-fixture
created: 2026-10-22T01:06:41.895Z
updated: 2026-10-22T11:08:21.428Z
---

## Summary

After T-1079's selector fix, the full Neovim fixture recorder on dev fails a separate completeness guard: "fixture refresh failed: nvim/test/explorer-component.test.ts recorded 280 frames; expected at least 296" (impl-1079, 2026-10-22, macOS scratch clone). All 25 tests in that file pass. The committed per-file slice count predates the explorer's open-snapshot and closed-page changes (T-1081, with T-1089 in flight), so the recorded expectation is stale.

## Acceptance criteria

- [x] C1. After T-1089 lands, a full `npm run test:nvim-fixtures` refresh on dev completes and publishes. Every per-file count change, including explorer-component's, is listed in the item topic with its cause.
  - done: impl-1090 · 2026-10-22T10:52:06.197Z
  - verified: rev-31 [reviewer] · run rev-20261022-1090-final · 2026-10-22T11:08:21.130Z · commit 8da4ad7d0b2c2783c58d2b4af6cd40abfe4dcd21
- [x] C2. The zero- and reduced-frame guards stay in place; only audited stale expectations change.
  - done: impl-1090 · 2026-10-22T10:52:06.273Z
  - verified: rev-31 [reviewer] · run rev-20261022-1090-source · 2026-10-22T10:58:20.008Z · commit 8da4ad7d0b2c2783c58d2b4af6cd40abfe4dcd21
  - verified: rev-31 [reviewer] · run rev-20261022-1090-final · 2026-10-22T11:08:21.130Z · commit 8da4ad7d0b2c2783c58d2b4af6cd40abfe4dcd21

## Comments

### coord · 2026-10-22T07:32:13.281Z

Same class, second file: impl-1059 (T-1059, 2026-10-22 07:32Z) ran `npm run test:nvim-fixtures -- --slice nvim/test/thread.test.ts` on Darwin arm64. All 24 tests passed, but the recorder refused publication with "recorded 182 frames; expected at least 373". The refresh in this item must cover thread.test.ts's stale minimum as well as explorer-component's (280 < 296, and 283 after T-1089). The fix is an audited count refresh, never a weaker guard.

### impl-1090 · 2026-10-22T10:33:58.247Z

Initial full sealed recorder at 81641915 (Darwin arm64, local) passed explorer 21/21 but refused 284<296. All 16 removed explorer keys audited to T-1081's legacy full-list parent-loaded suppression with incoming snapshot witnesses; four additions are T-1089's three closed-container pages and T-1054 marks.get. After scratch-only audited minimum update, full recorder reached a separate zero-frame refusal: explorer-summary.test.ts passed 1/1 but recorded 0<1. Reported size S Bugs blocker and decision request to lead; zero/reduced guards untouched, no publication or full pass claimed.

### impl-1090 · 2026-10-22T10:52:06.352Z

C1/C2 done; committed/pushed candidate fd40aa7b1a33aa2884596df5edbbad89915e64a9 (tree6998adc63bf74ff15a74517c7e6bb6a18964654d). A-9107 contains every per-file count/cause, full59-key global ledger,16 explorer snapshot witnesses,194 exact relocated T4 witnesses, source-selection audit and original red/green/refresh/replay/check logs. Full unmodified recorder published5659 frames:391/391, zero skips; ordinary38-file Neovim T2 replay319/319; selector+guard10/10; npm run check exit0, existing lint132/59 report-only with0refusals. Local Darwin arm64 sealed disposable source carrier; pre-review required origin/dev merge changes tracker files only. No configured/Linux/load/QA pass claimed. Zero/reduced guards untouched. C1-required selector excludes two audited local-only Lua files with regression; existing explorer preference-reset test waits exact R-1/T-10 detail receipts instead of dropping current keys. Source review requested before mode-free verify; no per-item QA required.

### impl-1090 · 2026-10-22T10:53:59.837Z

Replacement candidate8da4ad7d0b2c2783c58d2b4af6cd40abfe4dcd21/tree168f3a37108da185f5a6af4f1db7cde4cd7dfca5 pushed. A-9112 adds final delta receipts: observer armed before preference-reset card action, exact detail receipt awaited, final card-key assertion kept. Ordinary whole explorer21/21 and official retained recorder21/21 pass on source-equivalent Darwin arm64 sealed scratch; catalog5659/explorer284 remain byte-identical. A-9107 ledger/full391/391/T2 replay319/319/check0 precede only this ordering delta. Fresh exact-head source review requested; configured verification remains pending.

### rev-31 · 2026-10-22T10:58:20.008Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1090-source
commit: 8da4ad7d0b2c2783c58d2b4af6cd40abfe4dcd21
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear, Standards and Spec; A-9113. Strict guards unchanged; all 59 aggregate removals accounted for, all 194 thread input keys independently matched in the retained extended capture, redundant explorer row witnesses and all slice counts checked. Named local-only exclusions and observer-before-action delta are sound. C1 maintenance receipts support completion; final configured exact-head evidence remains pending. Local full391/391, ordinary T2 replay319/319, final delta21/21 receipts are qualified by source lineage, not Linux/suite/QA claims. No merge authorization.

Criteria: C2 verified.

### impl-1090 · 2026-10-22T11:07:46.658Z

Mode-free verification b267f51e-e6b5-418c-965e-352df17ac396 / A-9124 passed at unchanged reviewed8da4ad7d0b2c2783c58d2b4af6cd40abfe4dcd21 on Linux x64 droplet c-8 lon1, lifetime461s/cost$0.0320. Hub reports2436 passes, zero failed/cancelled/skipped. Actual T1/all-T2 fallback (hub+Neovim)/Web completed; host check gate107021a5 completed, not repeated remotely. New selector ordinary pass plus5 distinct load passes and explicit5/5 (worst0.011877457s). Existing report-only lint132/59, budget/duration/ratchet diagnostics retained, not budget passes; no T3/T4/integrated/QA claim. Source/head unchanged; C1/final Reviewer settlement pending. Keep claim; no merge requested or performed.

### rev-31 · 2026-10-22T11:08:21.130Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1090-final
commit: 8da4ad7d0b2c2783c58d2b4af6cd40abfe4dcd21
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, A-9125. Exact reviewed head: mode-free b267f51e/A-9124 exit0, 2436/2436, zero failure/cancel/skip; Linux T1/all-T2 fallback/Web complete. Raw selector identity has five distinct passing load IDs and explicit5/5; modified explorer case passes. A-9107/A-9112/A-9114 supply qualified full local maintenance/publication, all count causes, replay and original command/source provenance; A-9113 independently audits guards and reductions. Host check not repeated remotely; lint/duration gates report-only; T3 periodic/integrated deferred, no T4 or QA claim. All criteria verified; no merge authorization or enqueue.

Criteria: C1 verified, C2 verified.
