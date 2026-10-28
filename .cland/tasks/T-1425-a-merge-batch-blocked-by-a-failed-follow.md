---
id: T-1425
kind: task
title: A merge batch blocked by a failed follow-up after landing never clears, and the queue stops behind it
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1153
branch: t/T-1425-a-merge-batch-blocked-by-a-failed-follow
created: 2026-10-28T12:21:37.799Z
updated: 2026-10-28T14:13:52.960Z
closed: 2026-10-28T14:13:52.960Z
---

## Summary

A merge batch whose landing succeeded but whose follow-up failed (`merged, follow-up failed: stop sessions: cannot inspect the OS process table: ps failed or timed out`) stays blocked for good, and the merge queue stops behind it. MergeBatches #tick skips every landed member, then returns at `if (batch.failed && !batch.retryLanding) return;`, and no path clears `failed` once all members are landed. Finishing the follow-up with `cland merge T-n` doesn't clear the batch, and a hub restart keeps it, because the batch lives in store meta. Seen 2026-10-28 11:49Z: batch ca93a32f (T-1391 alone) blocked; T-1391 closed with a merge receipt after `cland merge T-1391`; T-1402 queued behind it since 11:55Z with no progress. On 2026-10-24 (T-1209) the same block cleared only because a second member could be cancelled and re-enqueued.

## Acceptance criteria

- [x] C1. A blocked batch whose members are all landed or completed is cleaned up and cleared on the next tick, and the queue goes on to the next entry (test: fail a follow-up after landing, finish it with cland merge, then show the next queued item batched).
  - done: impl-1425 · 2026-10-28T13:13:58.917Z
  - verified: rev-32 [reviewer] · run rev-20261028-1425-evidence1 · 2026-10-28T13:42:48.596Z · commit ca5b1a792803845f3f7ca7280b5b288c7adb0f94
- [x] C2. A follow-up failure after a successful landing doesn't block the queue: the batch records the failed step on the landed item, reports it, and the queue continues (test with a ps-timeout follow-up).
  - done: impl-1425 · 2026-10-28T13:22:04.020Z
  - verified: rev-32 [reviewer] · run rev-20261028-1425-evidence1 · 2026-10-28T13:42:48.596Z · commit ca5b1a792803845f3f7ca7280b5b288c7adb0f94
- [x] C3. Startup clears a persisted blocked batch whose members are all landed (test).
  - done: impl-1425 · 2026-10-28T13:13:59.565Z
  - verified: rev-32 [reviewer] · run rev-20261028-1425-evidence1 · 2026-10-28T13:42:48.596Z · commit ca5b1a792803845f3f7ca7280b5b288c7adb0f94

## Notes

Incident in T-204 (2026-10-28 11:48–11:50Z, load 9–12, swap 12.5 of 13.3 GB). Code: hub/src/hub/merge-batches.ts #tick and #advance; isLanded is item closed plus merge receipt (dispatch.ts).

## Comments

### coord · 2026-10-28T13:05:36.179Z

Moved into 0.3 (R-1278) on the human's answer to ask 99e4939a (2026-10-28 13:05Z), under the standing yes of 05:04Z. cland-impl clears the stuck batch record by hand at the next hub restart.

### impl-1425 · 2026-10-28T13:07:06.319Z

Consumer audit before policy change (rule 20): MergeBatches/merge-batch persisted meta and restart reader; dispatch.ts boundary.land (TaskMerges followUp -> Error), isLanded (closed + receipt), report (durable item and Agents notices), verification snapshot and merge.queue; protocol MergeBatchStatus; CLI merge queue; suite-tier-report; shared/wire conformance; nvim/web verification displays; merge-batches.test.ts (T1 policy + TaskMerges composition), merge-queue.test.ts (T2 frame batch tests), merge-gate, verification-tree, test-docs-merge, skill-provenance-merge; shipped merge/implement skills, hub README, docs/agents/tests and file guides, QA briefs/startup probes searched. No reply/schema/member changes proposed: previous wire shape retained; consumers still receive existing batch/result notices. Only terminal-batch recovery and landed-error classification change. Existing non-landed untyped failure hold and typed retry tests remain controls.

### impl-1425 · 2026-10-28T13:14:51.550Z

Committed/pushed 1e57497be0b59e8c54826098e2ea4e553d77f874. Fetched origin/dev and merged before first source review (already up to date). All C1–C3 done; source request delivered to reviewer in topic-1153. Final local validation on the committed source tree: macOS arm64, changed-file node --test merge-batches.test.ts T1 68/68, merge-queue.test.ts T2 31/31; npm run typecheck passed. No browser, real platform, native ps fault or credentials. Manual retry uses real TaskMerges handler with synthetic Git facts, not the CLI executable. T0 full check/test lint, Linux/full suite, T3/T4 and droplet verification not run locally. New cases all below 0.3s locally; Linux duration receipt pending. No new droplet submission until Coordinator lifts hub restart hold. Source-review and same-head verification/evidence review remain pending.

### impl-1425 · 2026-10-28T13:19:25.402Z

M2 consumer audit before adding a durable follow-up notice obligation: MergeBatch persisted meta is written/read only by MergeBatches snapshot/save/reopen; dispatch verification/merge.queue returns the batch structurally as optional MergeBatchStatus (clients read only id/members/run/candidate.tree/failed). CLI, suite-tier-report, nvim/web views and shared wire declarations keep their previous shape and ignore optional controller-only data. dispatch report phase already handles per-item follow-up phase without a new protocol field. Existing legacy batch records omit the new optional obligation; legacy controller/Store fixture and T2 seeded startup tests retain that shape. No consumer migrates or requires the new field. Production/client/test/docs/QA/startup searches from the initial inventory also apply. Adding T1 report-fault/reopen coverage.

### rev-32 · 2026-10-28T13:19:40.314Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1425-source1
commit: 1e57497be0b59e8c54826098e2ea4e553d77f874
scope: full
findings: [{"severity":"medium","text":"M1: frozen MERGE_USAGE omits the new follow-up guidance exported by usage.ts, violating the unchanged exact-byte compatibility guard. Update only the owning row.","file":"hub/test/fixtures/cli-usage/commands.json","line":30},{"severity":"medium","text":"M2: a follow-up-phase report exception escapes before completed checkpoint; outer tick persists failed/retryLanding=false. In a multi-member batch later unlanded members defeat all-terminal cleanup and line152 holds forever after sink recovery/reopen. Retain original follow-up and separate report obligation; prevent report failure permanently blocking remaining members; add fault/reopen/progress control.","file":"hub/src/hub/merge-batches.ts","line":227}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source audit not clear; consolidated artifact A-13295 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13295-t-1425-full-source-review-at-1e57497be-not-clear.md). Two medium findings: frozen MERGE_USAGE omits the new line, and a throwing landed-follow-up report becomes a permanent untyped batch hold while remaining members are unlanded. Claimant's uncommitted M1 correction/original local receipts do not alter this pinned-head disposition. Source inspection only; no Reviewer tests/probes. C1/C3 runtime unverified; C2 failed for M2. Preserve worker barrier, non-landed untyped holds and typed retries. Fresh corrected-head full source review precedes verification; Coordinator restart/droplet hold and separate full-all gate remain.

Criteria: C2 failed (New follow-up reporting can throw into an unretryable hold and strand remaining unlanded members.).

### impl-1425 · 2026-10-28T13:21:17.763Z

M2 design refinement: the delivery obligation is in independent Store meta merge-follow-up-reports, not a new MergeBatch/wire field. Each record retains a snapshot of existing report context plus item, original error and separate reportError. MergeBatches is its sole producer/reader; absent meta means empty for previous stores. Member completion and obligation insertion are transactional before any notice attempt. Replays use dispatch's existing stable phase/item notice ids. Delivery retries run even when no batch exists or merge queue is disabled, so candidate cleanup/replacement cannot discard them and report failure cannot block current or future landings. No existing client wire field or schema changes.

### rev-32 · 2026-10-28T13:24:09.080Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1425-source2
commit: ca5b1a792803845f3f7ca7280b5b288c7adb0f94
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected-head source review clear, zero findings. A-13297 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13297-t-1425-full-source2-at-ca5b1a792-clear.md). M1 owning MERGE_USAGE snapshot matches shipped help with guard unchanged. M2 transactionally saves completed member plus independent durable follow-up notice obligation before report; separate report error cannot permanently hold remaining landings, retries survive cleanup/reopen and run with queue disabled. Stable dispatch notice IDs preserve replay behavior. Existing worker barrier, manual retry/startup controls, typed retries and non-landed untyped holds remain. No dev merge or wire change; consumer inventory/docs reviewed. Original local macOS red/green receipts supplemental only; no Reviewer executions. C1–C3 remain runtime-unverified. Same-head mode-free configured verification may proceed only after Coordinator lifts restart/droplet hold; their separate full-all landing gate before enqueue remains. Any changed head needs fresh source review.

### coord · 2026-10-28T13:33:59.193Z

Second occurrence 2026-10-28 13:32Z: batch 8af2f22c's follow-up failed on stopping impl-1402 ('process identity cannot be verified') after T-1402 landed, leaving T-1386 and T-1423 unlanded behind a blocked batch. That is C2's case: a follow-up failure after a landing must not stop the remaining members. It was cleared by cancelling and re-enqueueing T-1423.

### rev-32 · 2026-10-28T13:42:48.596Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1425-evidence1
commit: ca5b1a792803845f3f7ca7280b5b288c7adb0f94
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured evidence clear; Coordinator full-all 3dc0d1bd remains a separate pre-enqueue gate. A-13309 independently audits original 99ea15b6/A-13307 at unchanged source2 head: 3915 ordinary test passes, 499 file passes, 65 separate load passes, zero nonpassing/unfinished records. All eight new task cases pass ordinary + 5/5 load (48 task receipts), peak individual 0.363330475 s. C1 real TaskMerges manual follow-up recovery retains commit/no repeated landing and admits next heads; C2 ps-timeout recording/reporting plus report-fault later-tick/reopen/exactly-once settlement controls pass; C3 persisted startup cleanup/public merge.queue proof passes. Worker barrier, unchanged help guard, five typed retries and non-landed untyped hold pass. T0 host check separate excluded-candidate 10df1b6a, not repeated Linux typecheck. Linux c-8 lon1 T1/all fallback T2/Web completed; Shell156/1248, general2/Web4 workers; lifetime769s/$0.0534 not suite wall. Budgets/test lint report-only; no selected T3/T4, no full-all/enqueue claim. No Reviewer reruns or source changes.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-28T14:13:52.960Z

Merged 37cf86b14580d7a716eca4c4c72ad6794fffb65e onto dev.
