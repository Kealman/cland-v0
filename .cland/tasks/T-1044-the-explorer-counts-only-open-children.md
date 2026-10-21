---
id: T-1044
kind: task
title: The explorer counts only open children, so closed epics show 0/0 and live epics undercount
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1007
topic: topic-796
branch: t/T-1044-the-explorer-counts-only-open-children
created: 2026-10-21T11:16:47.594Z
updated: 2026-10-21T11:50:18.018Z
---

## Summary

Since T-1007 the Neovim explorer's startup read is `task.list projection=summary state=open` (nvim/lua/cland/init.lua:237). Closed items arrive only through `load_closed_items` (init.lua:207), which runs on demand from the archive view. Until then `explorer.index()` builds `kids` from open items, so `container_cols` (explorer.lua:542) and `right_of` (items.lua:496) count only open children.

On the human's live workbench (2026-10-21 ~10:0xZ) E-412 showed "3/4" with 13 tasks and 9 closed. E-1006 showed "0/0" with 5 closed tasks. E-789 and E-795, closed and green, showed "0/0". The human asked whether this is a bug from the speed fix. It is.

## What to build

Container rows show correct done and total counts without loading every closed item at startup. The hub's summary projection carries, for each container (release, epic, category), its child counts by state, computed server-side from the tracker index: at least done, total and the in-review count the row shows. The explorer renders container columns from those counts, and the first payload stays within T-1007's and T-1038's byte budgets. Expanding a container still loads its closed children on demand, as today.

## Acceptance criteria

- [x] C1. On a fixture with an epic of 13 tasks, 9 of them closed, and a fully closed epic of 5 tasks, the explorer's first render shows "9/13" and "5/5" (or the established format with those numbers) before any closed item is loaded (T2 test).
  - done: impl-1044 · 2026-10-21T11:26:42.272Z
  - verified: rev-23 [reviewer] · run rev-20261021-1044-task-evidence · 2026-10-21T11:50:04.219Z · commit d2997d4b4695cc737a86c19122bf90102dc8e9c0
- [x] C2. The summary projection carries per-container child counts by state, and `task.list projection=summary state=open` stays within the startup byte budget on the 1,000-item fixture (test, guard from T-1038).
  - done: impl-1044 · 2026-10-21T11:26:42.299Z
  - verified: rev-23 [reviewer] · run rev-20261021-1044-task-evidence · 2026-10-21T11:50:04.219Z · commit d2997d4b4695cc737a86c19122bf90102dc8e9c0
- [x] C3. A task changing state updates its container's counts through the existing task events, with no full re-read (test).
  - done: impl-1044 · 2026-10-21T11:38:56.497Z
  - verified: rev-23 [reviewer] · run rev-20261021-1044-task-evidence · 2026-10-21T11:50:04.219Z · commit d2997d4b4695cc737a86c19122bf90102dc8e9c0
- [x] C4. The existing explorer, explorer-card and startup-budget Neovim tests pass.
  - done: impl-1044 · 2026-10-21T11:26:42.324Z

## Comments

### impl-1044 · 2026-10-21T11:26:42.337Z

Implemented at ca876d130778622aed9818a7f3654da6a2894ff5 (tree c4a1e585706041e2cc38f0a7e76f89c16fa922a5), pushed to origin. Full-index child_counts feed both Neovim progress views; parent task events keep current/former ancestor counts fresh. Test-first regressions and targeted receipts are in A-8332, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8332-t-1044-implementation-and-targeted-evidence.md. Local darwin/arm64 targeted tracker 11/11, explorer-component 21/21, explorer-card-component 15/15, items 5/5, explorer-card 1/1, explorer 2/2 and startup-budget 4/4 passed; npm run check passed (test lint report-only, 0 refusals). Startup hard bounds passed at 38.604 ms and 67,813 bytes; 1,000-item summary guard 42,666 bytes. No whole-suite receipt yet; requesting source review before mode-free verification.

### rev-23 · 2026-10-21T11:29:11.045Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1044-source
commit: ca876d130778622aed9818a7f3654da6a2894ff5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards 0 / Spec 0 findings. A-8335 audits 13-file change from fixed base80f8f94c: complete-index child_counts before list filters; sparse status/done/work aggregates preserve release/direct-task conventions and lazy closed rows. Default/summary lists and task events carry counts. Union of previous/current ancestor paths refreshes both parents and release work after child mutations without list re-read. Explorer and Items consume counts with legacy-frame fallback. Public T1 projection/events and observed T2 first-render/update cases retain final assertions and bounded startup payload guard. Wire equality and hub/Neovim/issue-tracker docs match additive behavior. All C1–C4 remain execution-dependent; A-8332 targeted Darwin summaries are supporting evidence, not a queued task pass. Normal mode-free configured verification may proceed at unchanged reviewed head. No Reviewer runtime or source edits.

### rev-23 · 2026-10-21T11:37:30.923Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1044-evidence-red
commit: ca876d130778622aed9818a7f3654da6a2894ff5
scope: evidence
findings: [{"severity":"medium","text":"The newly emitted parent event from renaming child a is already retained when movedFrame calls waitFor(type=task,id=first). frameClient.waitFor searches all stored frames, so it consumes that older event (layers {}) instead of the later release-version change, producing A-8341's failed assertion. Observe the exact version=3.0.0 parent event before triggering the edit (or an equivalent durable boundary) and preserve the final slim/legacy layer assertions.","file":"hub/test/connection-snapshot.test.ts","line":158}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear: M1 medium at connection-snapshot.test.ts:158. A-8349 audits A-8341/runcc7f85e0 Linux x64 T1exit0/interrupted T2exit1. Actual failure lines10943–10960: layers actual{} vs expected{'T-3':'background','T-4':'watch'}, assertion line162. New parent event from prior child rename is retained; waitFor(type/id) searches all stored frames and returns it before the release-version edit. Match the exact resulting version3.0.0 parent mutation, arm before trigger, and retain final slim/legacy layer assertions. This is task-owned receipt integration, not evidence that empty layers are now correct. Completed report1958/1957pass/1fail includes repetitions; ordinary1948/1947pass/1fail. No completed Neovim/Web/T3/T4 pass; lint/durations/ratchet report-only, existing large-summary4.558s nominal0.5s overage. C1/C2/C4 unverified; C3 failed. Fresh corrected-head source review before rerun. No Reviewer runtime.

Criteria: C3 failed (New ancestor task events cause the existing slim-layer test to consume a stale parent event; failed A-8341 needs exact-mutation observation and fresh review/run.).

### impl-1044 · 2026-10-21T11:38:56.512Z

Corrected Reviewer M1/C3 at pushed head d2997d4b4695cc737a86c19122bf90102dc8e9c0 (tree 426b18c2f68473e479dd82beb70713765f947a2f): ancestor aggregate events now require count-relevant state/status/parent/kind changes, with a red/green metadata-only regression. Snapshot observer now matches version 3.0.0 before triggering the mutation, retaining both final layer assertions. Local darwin/arm64 targeted connection-snapshot 11/11 (0.888 s), tracker-summary 11/11 (1.450 s), explorer-component 21/21 (4.960 s); npm run check passed (test lint report-only, 0 refusals). Failed run cc7f85e0/A-8341 remains failed evidence. Fresh source review requested; verification follows clear at the new head. No dev merge after first review.

### rev-23 · 2026-10-21T11:39:56.056Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1044-source-2
commit: d2997d4b4695cc737a86c19122bf90102dc8e9c0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; no findings. A-8354 reviews three-file correction with prior full design audit A-8335 retained. M1 exact version3.0.0 observer is armed before edit, both final layer assertions preserved. Parent-count emissions now require state/status/parent/kind changes captured before announce; create/remove/close/reopen/reparent/status/kind keep both ancestor paths, metadata-only edits keep own-item events. Public tracker regression protects no redundant parent frames. A-8351 local targeted/check supporting evidence; old A-8341 remains failed. All C1–C4 execution-dependent at this head; proceed fresh normal mode-free configured verify. For C4 retain a current-head targeted startup-budget T3 receipt because normal task verification excludes T3; old card/startup receipts are supporting only. No Reviewer runtime.

### impl-1044 · 2026-10-21T11:49:06.534Z

Verification ea06bdba at d2997d4b4695cc737a86c19122bf90102dc8e9c0 exited 0: 2263/2263 T1/T2 including Neovim, Linux x64 c-8 lon1 droplet, lifetime 435 s/cost $0.0302; full T2 fallback. Log A-8363. Duration and test-lint budgets report-only, warning lines retained. Web not run (missing system libraries), explicitly accepted by Coordinator disposition f0b6d2fc in topic-796 because no web/ code changes. Current-head local darwin/arm64 targeted startup T3 receipt A-8355 passed 4/4 with hard bounds enforced, normal 38.511 ms/67,813 bytes. Awaiting Reviewer final same-head settlement; no branch changes.

### rev-23 · 2026-10-21T11:50:04.219Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1044-task-evidence
commit: d2997d4b4695cc737a86c19122bf90102dc8e9c0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Intermediate evidence clear, not final readiness. A-8365 audits exact-head A-8363/run ea06bdba Linux x64 c-8 T1/all-T2 both packages exit0:2263 ordinary test passes/344 files+15 separate load passes; three owned identities5/5. C1 first-render9/13,5/5 before archive, C2 complete-index counts/byte guard, C3 live parent updates/no reread and corrected slim layers all pass. A-8355 local Darwin targeted startupT3 4/4 supplies current hard startup proof38.511ms/67813bytes, accepted by Coordinator f0b6d2fc. C4 still needs current-head explorer.test.ts/explorer-card.test.ts T3 receipts or Coordinator interpretation; old ca876d13 receipts supporting only, component T2 files already passed. No new findings; earlier A-8341 remains red. Hostc503a2dd not repeated remotely; lint132/59,durations/ratchet report-only, existing large-summary5.067s exceeds nominal0.5s (not a timing-budget pass). Web NOT RUN/T-993 accepted by Coordinator; no integratedT3/T4/browser/stage/QA/Reviewer runtime claim.

Criteria: C1 verified, C2 verified, C3 verified.
