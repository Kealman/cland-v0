---
id: T-2009
kind: task
title: "host-supervisor teardown race: a replacement 'host serve' started while restart-owner shutdown is held can escape the join on Linux"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1740
branch: t/T-2009-host-supervisor-teardown-race-a
created: 2026-11-19T14:42:13.379Z
updated: 2026-11-24T14:22:12.711Z
closed: 2026-11-24T14:22:12.711Z
---

## Summary

`hub/test/host-supervisor.test.ts :: teardown joins a replacement started while restart-owner shutdown is held` failed once on Linux, in T-1991's full run 56cc3b92 (droplet, x64, Node 24.21.0, A-21814 lines 47340–47365). That item doesn't touch the supervisor. Literal output: `AssertionError [ERR_ASSERTION]: replacement started during teardown is joined`, with actual `[{ pid:123505, parent:1, …, command:'/opt/node/bin/node /home/runner/cland/hub/bin/cland.ts host serve' }]` and expected `[]`, at host-supervisor.test.ts:216. The file then passed 5 times out of 5 alone on local macOS arm64 at the same head (impl-1991, 2026-11-19 14:42Z), so this is an intermittent teardown race on Linux. A replacement `host serve` was left orphaned (parent 1).

## What to build

Find why a replacement started during held restart-owner shutdown can escape the teardown join on Linux, and fix the join so the case is deterministic. Reproduce first with a forced ordering at the restart-owner hold.

## Acceptance criteria

- [x] C1. A deterministic regression forces the replacement to start at the hold point, fails on the current code, and passes after the fix (test).
  - done: impl-2009 · 2026-11-24T12:06:19.400Z
  - verified: rev-41 [reviewer] · run rev-41-20261124-2009-final · 2026-11-24T12:48:11.655Z · commit 8936b8b6dfcee56c15d0f4578c324bfbd644e278
- [x] C2. No `host serve` process outlives the file in a post-run census on Linux (test).
  - done: impl-2009 · 2026-11-24T11:42:37.781Z
  - verified: rev-41 [reviewer] · run rev-41-20261124-2009-final · 2026-11-24T12:48:11.655Z · commit 8936b8b6dfcee56c15d0f4578c324bfbd644e278

## Comments

### impl-2009 · 2026-11-24T10:57:14.327Z

Initial audit: specified hold regression is still present, including native birth check before release and empty post-file cwd census. closeSupervisors/restartOwners are file-local; production supervisor.sh is unchanged since triage. No source edits yet; native red/green admission queued by Coordinator. Local macOS forced ordering evidence will be distinguished from original Linux timing.

### impl-2009 · 2026-11-24T11:06:40.587Z

A-22865 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22865-t-2009-deterministic-discovery-loss-red-and-green.md) records local macOS arm64 Node24.21.0 red/green. Discovery-loss control: replacement relocates cwd after owner stop, with durable pid/cwd receipt and independent native census. Current teardown failed literal 'replacement started during teardown is joined' (parent1); capturing births before owner stop plus final discovery passed 4/4 and empty post-file census. This control does not establish original Linux timing cause. Linux C2 pending reviewed-head mode-free verification. Audit: closeSupervisors/restartOwners are file-local; only per-file test guidance references flow; shared cleanup and production supervisor unchanged; no reachable T1 test from test-only diff.

### rev-41 · 2026-11-24T11:45:24.407Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261124-2009-source1
commit: d0df2f73c7e7cbb1c4a6bbb886363970726217e4
scope: full
findings: [{"severity":"medium","text":"M1: new relocation receipt observation defaults to 15 seconds (and may load-scale) inside a fixed 10-second test. Missing/unusable receipt can cancel the case while closing/afterStop is still active; file cleanup independently removes roots without joining that promise. Own the complete admitted control before acquisition, bound observations separately, and join it on cancellation before root removal; prove held/missing receipt cleanup.","file":"hub/test/host-supervisor.test.ts","line":224}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear at d0df2f73c7e7cbb1c4a6bbb886363970726217e4 against 45655614e. Standards: one medium finding; Spec: no separate logic finding. M1 at host-supervisor.test.ts:224: new eventually relocation wait defaults to 15,000 ms via testWaitMs (plus possible load scaling), while outer test timeout is 10,000 ms. On lost publication or a replacement exiting before its receipt, node:test can cancel before observation settles. The body's finally awaits closing, but file after cleanup does not join that in-flight promise and may independently stop owners/remove roots while the earlier afterStop still observes them. Rules 9/12 require admitted work ownership and bounded incomplete/native diagnostics. Enroll whole control/closing before acquisition, separate setup/observation bounds, and prove cancellation/held-or-missing receipt retains roots until producer/observer closure; extending timeout alone is insufficient.

Pre-stop birth retention plus final census uses existing identity-validated cleanup, and relocation signal rechecks captured birth. Shared fixture env/disposable roots, T3 lifecycle rationale and matching per-file docs checked. Diff is two files only; production supervisor/shared helpers unchanged. Detailed review A-22895 at .cland/artifacts/A-22895-t-2009-source-review-not-clear-at-d0df2f73c.md.

A-22865 contains working-tree macOS arm64 Node24.21.0 red3/4 then green4/4 with empty census; final source adds a birth assertion after that run. This proves the synthetic discovery-loss ordering, not original Linux cause or final-head execution. Full final-source typecheck/lint exit0 reported, zero refusals/advisories report-only. Reviewer ran no tests/native/browser/provider work or edits. C1 failed for lifecycle gap; C2 remains unverified pending exact-head Linux post-file census after fresh clear source review.

Criteria: C1 failed (The new relocation observation/closing work can outlive test cancellation and is not joined by file root cleanup.).

### impl-2009 · 2026-11-24T11:50:49.333Z

Review M1 corrected in working tree: complete control body enrolled before acquisition, abort releases held gate, test/file/root cleanup join same work; relocation setup explicit load-scaled3s and incomplete native row/tail diagnostic. New actual-removal-boundary cancellation control red with join withheld (literal 'root removal joins the missing receipt observer'), restored green5/5 plus empty post-file census. macOS arm64 Node24.21.0 T3-only, not Linux proof. A-22906 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22906-t-2009-m1-cancellation-ownership-red-and-green.md. Native slot released; fresh typecheck/full lint and source review pending.

### rev-41 · 2026-11-24T12:08:07.529Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261124-2009-source2
commit: 8936b8b6dfcee56c15d0f4578c324bfbd644e278
scope: full
findings: [{"severity":"low","text":"L1: the new diagnostic buffers the complete supervisor.log via readFile before slicing 2,048 characters; rendered tail is bounded but collection is not (rule 42). Use a byte-bounded positioned/streamed tail read with descriptor closure.","file":"hub/test/host-supervisor.test.ts","line":300}]
finding_counts: {"high":0,"medium":0,"low":1}

Fresh full source review clear at 8936b8b6dfcee56c15d0f4578c324bfbd644e278 against 45655614e and source1 d0df2f73c. Standards: one low finding, no high/medium; Spec: no separate findings. M1 resolved: whole replacement-control body enrolled before acquisition; test abort releases its gate; test/file/root disposal joins the same admitted work before census/removal. Body finally joins afterStop/closing and native owners. Explicit 3s load-scaled relocation setup replaces the default 15s observation. New cancellation control exercises actual root removal and requires producer-closed receipt plus bounded missing-receipt observer completion, keeping final directory absence assertion.

Low L1 at host-supervisor.test.ts:300: readFile(supervisor.log).then(log => log.slice(-2048)) still buffers the whole diagnostic log; bound bytes while reading per rule 42. It is nonblocking because this is a short-lived disposable fixture diagnostic, without cleanup-authority or success-path effect.

Pre-stop captured native births, final discovery, birth-revalidated relocation signal, both-root survivor assertion and post-file census preserved. Existing shared identity cleanup/production supervisor unchanged; filtered fixture env/T3 classification/per-file guide checked. A-22906 records literal negative control `root removal joins the missing receipt observer`, 4/5, and restored 5/5 with empty replacement/post-file censuses on working-tree macOS arm64 Node24.21.0. A-22865 retains initial discovery-loss red/green. Neither proves original Linux scheduling cause or final-head configured execution. Final-source typecheck/full lint exit0 reported; zero refusals, report-only advisories. No dev merge after source1. C1/C2 remain unverified pending exact-head configured Linux receipts. Details A-22918 at .cland/artifacts/A-22918-t-2009-source-review-clear-at-8936b8b6d.md. Reviewer ran no tests/native/browser/provider work or edits.

### rev-41 · 2026-11-24T12:19:32.594Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261124-2009-evidence1
commit: 8936b8b6dfcee56c15d0f4578c324bfbd644e278
scope: evidence
findings: [{"severity":"low","text":"L1 retained from source2: diagnostic buffers the complete supervisor.log before slicing 2,048 characters; bound bytes during read per rule 42. Nonblocking source finding, separately reported XS Tech debt.","file":"hub/test/host-supervisor.test.ts","line":300}]
finding_counts: {"high":0,"medium":0,"low":1}

Configured evidence not clear: task.view records run 32a42a6f-2794-4236-8b50-bfef7570398a finished/failed at source-reviewed head 8936b8b6dfcee56c15d0f4578c324bfbd644e278. Producing hub result: `delivery checkout/prepare: machine command failed or exceeded its time bound (exit 255): ssh: connect to host 64.225.120.42 port 22: Operation timed out`. A-22921 preserves an earlier metrics.ts upload timeout followed by successful attempt2; that retried step is not conflated with terminal checkout failure.

Only local T0 host check passed (exit0,107.435s; bound run/tree8b919d65efea7dfb3730ac810dfd228613725f15). T1/T2/selectedT3/Web unexecuted, T4 not selected; generated replacement/cancellation cases and Linux post-file census have no receipts. C1/C2 remain unverified, with no criterion failure inferred from missing execution. Printed planned/projection/tier-share figures are not observed runtime durations or coverage.

Droplet reservation c-8 sfo2 cland-v0-6e48e10e; remote platform/Node/Neovim unavailable, browser binary/version null, cached null. Budgets/ratchet advisory report-only. Source2 clear remains the source assessment; low L1 retained, no new high/medium source issue. Holding unchanged head pending Coordinator retry decision as reported by implementer. Detailed evidence A-22922 at .cland/artifacts/A-22922-t-2009-incomplete-configured-evidence-at-8936b8b6d.md. Reviewer ran no tests, retry, native/provider/browser work or edits.

### rev-41 · 2026-11-24T12:48:11.655Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261124-2009-final
commit: 8936b8b6dfcee56c15d0f4578c324bfbd644e278
scope: evidence
findings: [{"severity":"low","text":"L1 retained from source2: diagnostic buffers the complete supervisor.log before slicing 2,048 characters; bound bytes during read per rule 42. Nonblocking, separately reported XS Tech debt.","file":"hub/test/host-supervisor.test.ts","line":300}]
finding_counts: {"high":0,"medium":0,"low":1}

Final evidence review clear at unchanged source-reviewed head 8936b8b6dfcee56c15d0f4578c324bfbd644e278. No high/medium findings; source2 low L1 retained. Run c8531a9c-02e7-4f46-a4f4-fde496c7d7f5 is finished/passed; A-22947 records exit0. Bound verification tree8b919d65efea7dfb3730ac810dfd228613725f15 matches commit outside documented tracker/rulebook exclusions.

C1 verified: exact generated case `teardown joins a replacement started while restart-owner shutdown is held` has structured pass at A-22947:39841–39842; `cancelled supervisor control retains its root until a held producer and missing receipt observer drain` passes at39847–39848. Prior deterministic discovery-loss red A-22865 and removed-removal-join red A-22906 remain retained. These controls prove admitted ownership/discovery-loss handling, not the unverified original Linux scheduling cause.

C2 verified: Linux replacement census at39844 has survivors:[]; all five supervisor case finishes pass; positive file finish at39854 includes the reviewed after hook joining controls and asserting empty post-file census for every retained fixture root before removal. This is checked separately from overall exit status.

T0/T1/fallback all T2/eight selected T3 files/Web exit0; selected T3 executed once with no repetitions. Remaining T3 deferred to batch; T4 unexecuted. Linux x64 droplet c-8 sfo2, Node v24.21.0, Neovim v0.12.5, two workers; isolated Chrome for Testing156.0.8078.4 headless shell/Playwright1248. MacOS stage-selector prerequisite skip retained; budgets/ratchet/lint report-only, no enforced timing pass or projected duration used as proof; no cache reuse.

Earlier attempt32a42a6f/A-22921 remains failed delivery/SSH255 with only localT0 completed107.435s and remote phases unexecuted; A-22922 evidence not-clear remains in history. This new green is a separate same-head/tree receipt, never a pass assigned to the failed round. Details A-22948 at .cland/artifacts/A-22948-t-2009-final-evidence-review-clear-at-8936b8b6d.md. Reviewer ran no tests/retries/native/provider/browser work or edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T14:22:12.711Z

Merged bdfe3be7498c812b0e3771a3e8e542ce5a7bb2a4 onto dev.
