---
id: T-193
kind: task
title: "Folder artifacts and their lifetime: folder with an entry file, human
  and Aide artifacts never expire, kept, artifact.keep, move and archive"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-193
parent: E-115
blocked_by: []
topic: topic-102
branch: t/T-193-folder-artifacts-and-their-lifetime
created: 2026-10-10T16:25:06.772Z
updated: 2026-10-11T00:43:43.432Z
closed: 2026-10-11T00:43:43.575Z
---

## Parent

T-115, slice 4 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

`artifact.create` with a folder and an entry file; its files listed on request; the human's and Aides' artifacts exempt from the sweep; `kept`; `artifact.keep`, `artifact.move` and `artifact.archive`; agents refused on the human's artifacts.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-193 · 2026-10-10T20:17:42.260Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-2 · 2026-10-10T20:19:29.033Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-4 · 2026-10-10T20:47:54.834Z
  - verified: rev-14 [reviewer] · run rev-20261011-193-8 · 2026-10-10T22:52:57.735Z
  - verified: rev-14 [reviewer] · run rev-20261011-193-10 · 2026-10-11T00:01:26.088Z
- [x] C2. Demo: an agent's report without `kept` is swept after the retention period, and the human's folder is not.
  - done: impl-193 · 2026-10-10T20:08:24.909Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-1 · 2026-10-10T20:14:08.387Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-2 · 2026-10-10T20:19:29.033Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-4 · 2026-10-10T20:47:54.834Z
  - verified: rev-14 [reviewer] · run rev-20261011-193-8 · 2026-10-10T22:52:57.735Z
  - verified: rev-14 [reviewer] · run rev-20261011-193-10 · 2026-10-11T00:01:26.088Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-193 · 2026-10-10T20:08:24.982Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-1 · 2026-10-10T20:14:08.532Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-2 · 2026-10-10T20:19:29.033Z
  - verified: rev-14 [reviewer] · run rev-20261010-193-4 · 2026-10-10T20:47:54.834Z
  - verified: rev-14 [reviewer] · run rev-20261011-193-8 · 2026-10-10T22:52:57.735Z
  - verified: rev-14 [reviewer] · run rev-20261011-193-10 · 2026-10-11T00:01:26.088Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-193 · 2026-10-11T00:42:49.283Z
  - verified: rev-14 [reviewer] · run rev-20261011-193-12 · 2026-10-11T00:43:34.257Z

## Comments

### impl-193 · 2026-10-10T19:49:06.595Z

Claimed. Implementing folder artifacts and lifetime/keep/move/archive through the pre-agreed real hub frame protocol seam from T-115. CLI/browser remain later slices. No role clause changes planned.

### impl-193 · 2026-10-10T20:07:57.532Z

Implementation at 4d3c131. Protocol tests cover folder entry/defaults/listing, human/Aide immutable lifetime, kept retention, explicit archive, protected-owner refusals, absorbed aliases/history/queued deliveries, and attachment protection. Filesystem/SQLite boundary faults verify folder rollback/recovery and move housekeeping. Headless workbench verifies folder entry and moved chips plus unsaved draft saves after move; fake harnesses receive folder/moved launch briefs. Self-review standards clear; spec clear except pending kept→watch integration after T-190 lands. No role clause text changed; tool grants added in .cland/roles.toml.

### impl-193 · 2026-10-10T20:08:58.945Z

Coordinator scope split: kept→watch is T-205, blocked by T-190 and T-193; T-193 implements kept retention only. Review scope at 4d3c131 excludes the watch classifier integration. C1–C3 implementation is complete; C4 will be marked by the proved persistent full-suite reporter after a clean passing run. No T-193 QA brief supplied; requesting review from rev-14 as directed.

### rev-14 · 2026-10-10T20:14:08.639Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-193-1
commit: 4d3c131f0b7c936b6edd68d7e3023cfe8098c2e6

High — hub/src/hub/artifact-lifecycle.ts:167,213,206; hub/src/hub/dispatch.ts:618: human/Aide source can be absorbed into an agent folder, whose expiry/agent authorization ignores protected contents. Actual Store/Lifecycle memory-FS reproduction deletes the human's bytes after topic close and sweep. Protect absorption or refuse incompatible destinations.
Medium — nvim/lua/cland/artifacts.lua:70,37,137: reconnect ordinary list excludes moved aliases; a cached draft moved offline keeps its deleted standalone path, so save recreates the old source instead of updating its folder. Resolve/rebind cached ids on reconnect preserving unsaved edits.

C1 failed; C2/C3 verified separately this run; C4 full-suite evidence pending. Standards clear. Kept-to-watch is excluded by tracked T-205 scope split. Both axes and reproduction source: A-763, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-763-t-193-review-protected-absorption-and-draft-reconnect-gaps.md.

Criteria: C1 failed (Human/Aide source absorbed into agent folder can be auto-deleted; draft moved while disconnected retains obsolete buffer path after reconnect.).

### impl-193 · 2026-10-10T20:17:42.497Z

Replacement 55a04db addresses rev-20261010-193-1: protected human/Aide→agent folder moves refused pre-I/O, actual lifetime regression; open cached moved ids resolved on reconnect, real headless disconnect/move/reconnect/save regression. Both focused files passed (14 tests) and typecheck passed; two-axis self-review clear. Merged origin/dev 8783ac3 without conflict, clean and pushed. C4 awaits replacement full suite; first waiting run cancelled with runner SIGINT per fairness directive. T-205 excluded; docs corrected to reflect split.

### rev-14 · 2026-10-10T20:19:29.033Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-193-2
commit: 55a04dba4623d75dbcf01f1b166b96f3f2bb3ccc

No high or medium findings remain. Protected human/Aide files are refused into agent folders before I/O; compatible protected absorption retains lifetime. Reconnect resolves missing cached ids and rebinds the existing buffer preserving unsaved text. Protocol/headless regressions and independent memory/Lua checks establish both fixes. Clean T-196 dev merge integration inspected; kept-to-watch remains T-205.
C1–C3 verified. C4 replacement full-package evidence remains pending. Both review axes and reproduction source: A-770, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-770-t-193-re-review-clear-at-55a04db-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-193 · 2026-10-10T20:46:51.840Z

A-789 found four deterministic inventory assertion failures (hub 1063/1067, typecheck pass, Neovim not reached). Corrected only DOCUMENTED_TOOLS and aideTools expected lists at ded6d27. Surface3/3, resilience11/11 and Aide defaults/init2/2 pass. Fetched/merged origin/dev8783ac3 already up to date; clean and pushed. Production behavior unchanged from clear55a04db. Requesting review and final full suite retry at ded6d27.

### rev-14 · 2026-10-10T20:46:54.410Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-193-3
commit: 55a04dba4623d75dbcf01f1b166b96f3f2bb3ccc

Medium — hub/test/aide.test.ts:10: Expected Aide inventory omits new keep/move/archive grants, failing exact assertion at :17 and blocking C4.
Medium — hub/test/harness.ts:26: DOCUMENTED_TOOLS omits archive/keep/list/move, failing resilience.test.ts:42, :104 and surface.test.ts:15 and blocking C4.
A-789: typecheck exit 0; hub 1067 total, 1063 pass, 4 fail, zero cancelled/skipped/todo; npm test exit 1, Neovim not reached. Update independent expected inventories, preserving exact permission/surface assertions, then supply complete final-head verification. C1–C3 prior clearance remains intact. Pinned source reviewed; uncommitted repairs excluded. Evidence: A-791 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-791-t-193-c4-not-clear-at-55a04db-stale-tool-inventories.md

Criteria: C4 failed (Typecheck passes, but npm test exits 1: hub 1063/1067 with four stale tool-inventory assertion failures; Neovim does not run.).

### rev-14 · 2026-10-10T20:47:54.834Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-193-4
commit: ded6d278acdfc79ecbdb1c8ea8a007ae0cfa3b30

No high or medium findings in the replacement delta. Both static expected tool inventories now include precisely the authorized new artifact tools; independent exact permission/count/name assertions remain intact. Standards and Spec axes clear. Production/docs unchanged from A-770; C1–C3 reverified through the two-list delta. C4 remains unverified until a complete final-head full package run passes; prior failed mark is not cleared by this code review. Evidence: A-792 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-792-t-193-inventory-re-review-clear-at-ded6d27-c4-pending.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-14 · 2026-10-10T20:56:39.872Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-193-5
commit: ded6d278acdfc79ecbdb1c8ea8a007ae0cfa3b30

No new code findings. Existing clear review rev-20261010-193-4 and its C1–C3 verified marks remain applicable. A-793 confirms typecheck exit 0, followed only by lock waiting then npm test exit 130; neither test phase starts. C4 remains unverified, and its earlier failed mark is not cleared by this interrupted retry. No regression established by this evidence. Cancellation review: A-800 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-800-t-193-cancelled-validation-at-ded6d27-c4-still-unverified.md

### rev-14 · 2026-10-10T21:26:44.669Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-193-6
commit: ded6d278acdfc79ecbdb1c8ea8a007ae0cfa3b30

No new code findings; A-792 clearance and C1–C3 verified marks remain applicable. A-804 confirms typecheck exit 0, then only lock waiting followed by npm test exit 130; neither hub nor Neovim tests start. C4 remains unverified, with no regression established and no criterion marks changed. Evidence: A-807 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-807-t-193-a-804-validation-incomplete-unchanged-code-clearance.md

### rev-14 · 2026-10-10T22:49:06.253Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-193-7
commit: ded6d278acdfc79ecbdb1c8ea8a007ae0cfa3b30

No new code findings for pinned ded6d27; A-792 Standards/Spec clearance and C1-C3 marks remain applicable. A-859 confirms typecheck exit0 and hub1067/1067, zero failures/cancelled/skipped/todo. Neovim only waits for its lock before npm test exit130, so C4 remains unverified and no marks change.
Current worktree has an unfinished merge with unresolved artifacts.ts, dispatch.ts and protocol.ts; integration changes are outside this review. Supply a committed combined-head review request and complete passing package log after resolution.
Evidence A-860 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-860-t-193-a-859-hub-passes-full-validation-incomplete.md.

### impl-193 · 2026-10-10T22:51:35.350Z

Merged dev59742a3 at639dab5, resolving three artifact/protocol conflicts with live publication role callback and folder/lifetime metadata retained. Fixed upgrade-shaped T190 Aide records lacking creatorKind: persisted creatorRole now protects lifetime/mutations before fallbacks. Red→green daemon restart/sweep regression passes; typecheck, visibility8, folder protocol6, headless artifacts8 pass. Two-axis integration review clear. Clean/pushed; FIFO runner final suite next, kept→watch remainsT205.

### rev-14 · 2026-10-10T22:52:57.735Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-193-8
commit: 639dab560a9611b93afdea1c2b40e4c6f711a69e

No high/medium findings in merged integration. Both Standards and Spec axes clear: conflict resolutions retain folder/lifetime metadata and visibility layers, creatorRole is captured by live publication callback, and saved provenance including explicit null governs upgrade-shaped records before fallback. Independent memory probe confirms lifetime/visibility and folder publication under role change. Prior move and cached-buffer findings remain fixed.
C1-C3 reverified through integration review and retained evidence; exact grant lines match A-861. Kept→watch remains T205. C4 unverified pending complete passing package run at this head; historical failed mark remains.
Evidence A-862 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-862-t-193-integration-review-clear-at-639dab5-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-14 · 2026-10-10T23:58:43.820Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-193-9
commit: 639dab560a9611b93afdea1c2b40e4c6f711a69e

Medium — hub/test/request-guard.test.ts:59: Other-client response1939ms fails the responsiveness budget.
Medium — hub/test/suite-runner.test.ts:514: Guard-holder exit1 fails expected0 (old unsafe SIGSTOP fixture remains at this head; dev/T207 has reviewed correction).
Medium — hub/test/tracker-ready.test.ts:145: Rebased merge times out without a result within30000ms.
C4 failed: A-909 typecheck0, hub1081/1084, npmtest1; Neovim not reached. Logged children run Node25.6.1 outside declared <25 engine; replacement package evidence must pin supported Node24. Prior A-862 C1-C3 code clearance unchanged; these are validation failures, roots not inferred. Evidence A-910 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-910-t-193-c4-review-not-clear-at-639dab5-three-hub-failures.md.

Criteria: C4 failed (Typecheck passes, npm test exits 1: hub1081/1084 with responsiveness, guard-child exit and rebased merge timeout failures; Neovim not reached.).

### impl-193 · 2026-10-11T00:00:14.200Z

C4 blocked by inherited responsiveness failure: Node24 isolated flooding task.list test fails on T193(1931ms) and baseline dev01ea28d(3871ms). Merged/pushed T207 at16edfc1; corrected guard fixture passesNode24. Gate timeout isolated pass underNode25, Node24 full still required. Assertions retained, guard/visibility source untouched. Requested supervising decision on shared fix or scoped repair.

### rev-14 · 2026-10-11T00:01:26.088Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-193-10
commit: 16edfc1f9008c1e0039a8f2958237c12c3b50a00

No high or medium code findings. Both axes clear: delta is only4 inherited reviewed T207 runner/test/docs files; T193 production unchanged. Guard ordering/exit assertions retained. Independent memory provenance/publication probe passes on mergedhead. C1-C3 carryforward/reverified from A862 and current delta; kept→watch remainsT205.
C4 unverified; A909failedmark retained. Coordinator msg9c6b3bd0 explicitly permits A909 plus Node24 isolatedguard/rebasedgate andcomplete Neovim runs ifallpass, naming T172/T207 exceptions. Required replacementresults not supplied yet. Evidence A-912 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-912-t-193-inherited-t207-integration-clear-at-16edfc1-conditional-c4-evidence-pendin.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-14 · 2026-10-11T00:42:11.999Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-193-11
commit: 639dab560a9611b93afdea1c2b40e4c6f711a69e

Medium — hub/test/suite-runner.test.ts:514: Required isolated guard-holder exit remains1 instead of0, preventing conditional C4 clearance.
A940 on639dab5: typecheck0, guard0/1 exit1, gate1/1 exit0, Neovim252/252 exit0; no cancellations/skips. A909 supplies same-head hub. Flood accepted as T172 same-way dev exception under63aba695; gate timeout has passing isolated evidence. Guard has no passing same-head supplement. Current16edfc1 code remains separately cleared inA912; C1-C3 marks unchanged. Evidence A-941 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-941-t-193-supplemental-c4-not-clear-at-639dab5-isolated-guard-still-fails.md.

Criteria: C4 failed (A-940 Node24 isolated guard still exits1 (0/1 pass), so conditional T207 exception is unmet; typecheck, isolated gate and Neovim252/252 pass.).

### impl-193 · 2026-10-11T00:42:49.616Z

Coordinator cf0d9a59 authorized C4 evidence transfer across T207-only delta639dab5→16edfc1. Node24 corrected ticket-guard test passes alone1/1 at unchanged clean16edfc1, zero failures/cancellations/skips. C4 done on A909 hub1081/1084 plus A940 Node24typecheck0/gate1/1/Neovim252/252, with named T172 flood and T207 guard exceptions. Final verification requested from rev14.

### rev-14 · 2026-10-11T00:43:34.257Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-193-12
commit: 16edfc1f9008c1e0039a8f2958237c12c3b50a00

No high or medium findings remain within Coordinator’s explicit C4 disposition. C1-C3 code clearance A-912 remains applicable.
C4 verified under cf0d9a59: Coordinator expressly carries A-909 hub1081/1084 and A-940 Node24 typecheck0/Neovim252/252/gate1/1 across the reviewed T207-only delta from639dab5 to16edfc1. Required current-head corrected guard passes1/1 inA-942,0fail/cancel/skip/todo.
Named exceptions: request-guard flood (T-172, same-way dev failure accepted by63aba695, A-911/A-938); ticket-guard (T-207 fixture fixed and passing alone on16edfc1). Earlier gate timeout has same-head isolated pass inA-940. No other failure/cancellation/skip. Original failed runs remain retained; this is authorized evidence transfer, not an all-green npmtest claim. Kept→watch excludedT-205.
Evidence A-943 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-943-t-193-final-c4-clearance-at-16edfc1-under-coordinator-evidence-transfer-decision.md.

Criteria: C4 verified.

### coord · 2026-10-11T00:43:43.432Z

Merged 33e9cf531aa57a5350a54068c7cdf322b2fcb14e onto dev.
