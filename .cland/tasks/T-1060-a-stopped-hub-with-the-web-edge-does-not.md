---
id: T-1060
kind: task
title: A stopped hub with the web edge does not exit, and hub stop calls it not this project's hub
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-807
branch: t/T-1060-a-stopped-hub-with-the-web-edge-does-not
created: 2026-10-21T14:06:08.818Z
updated: 2026-10-21T15:12:32.743Z
closed: 2026-10-21T15:12:32.743Z
---

## Summary

After `hub stop`, the hub at cb231eeb logs "stopped" but its process stays alive past the CLI's 10 s stop deadline. `cland hub stop` then reports the live pid as "not this project's hub" and leaves it running. Something that landed between 7c5e4028 and cb231eeb keeps the event loop alive after shutdown.

## Evidence

- Restart #38, 2026-10-21. The old hub pid 33756 (code cb231eeb) logged stop-requested at 14:03:21.79Z, stopping, 9 byes, and "stopped" at 14:03:23.80Z. The process did not exit within the CLI's 10 s STOP_DEADLINE.
- `cland hub stop` found the lock released (hub/src/cli/hub.ts ownsProject false) and printed "pid 33756 … is not this project's hub (it does not hold .cland/hub.lock); left it running and removed the stale hub.json". The restart recipe SIGKILLed it at +16 s. State had been flushed at "stopped", so nothing was lost, but the stop-to-serve gap grew to 20 s.
- At restart #37 the same recipe saw pid 92080 (code 7c5e4028) exit at once.
- Log: .cland/log/hub.log 14:03:21–14:03:38Z.
- Candidates: the web edge, tunnel and liveness timers of T-988/T-989, or T-1039's start path.

## Acceptance criteria

- [x] C1. After "stopped", a served hub with the web edge enabled exits within 2 s with no open handles (test through a real `hub serve` process).
  - done: impl-1060 · 2026-10-21T14:26:27.753Z
  - verified: rev-31 [reviewer] · run rev-20261021-1060-final · 2026-10-21T15:08:02.253Z · commit 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7
- [x] C2. When `cland hub stop` sees the lock released by the pid it asked to stop and that pid is still alive, it reports "stopped, lock released, process still alive" and names the pid, not "not this project's hub" (test).
  - done: impl-1060 · 2026-10-21T14:18:55.102Z
  - verified: rev-31 [reviewer] · run rev-20261021-1060-final · 2026-10-21T15:08:02.253Z · commit 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7
- [x] C3. The handle that kept the loop alive is named in the item topic, with the commit that introduced it.
  - done: impl-1060 · 2026-10-21T14:18:55.120Z
  - verified: rev-23 [reviewer] · run rev-20261021-1060-source · 2026-10-21T14:21:37.986Z · commit 5a1f508a19939d2507c7a1e31c44c85765b70f25
  - verified: rev-23 [reviewer] · run rev-20261021-1060-source-2 · 2026-10-21T14:28:24.941Z · commit c200da18bb377f19d7be6acfc3980e4e151ada34
  - verified: rev-31 [reviewer] · run rev-20261021-1060-shared-source · 2026-10-21T14:41:31.502Z · commit 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7
  - verified: rev-31 [reviewer] · run rev-20261021-1060-final · 2026-10-21T15:08:02.253Z · commit 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7

## Comments

### impl-1060 · 2026-10-21T14:17:53.916Z

C3 diagnosis: active handle is an execFile Git ChildProcess (plus stdout/stderr pipes and its timeout) in tracker/verdict-git.ts:15 -> epic-surfaces.ts:45, epicDemoFreshness. The multi-command scan introduced by a9d2fb32613e918720216bb50284439a4486af3e (T-459) continues after tracker shutdown gives up. Identical scratch copied-tracker probes reproduce at BOTH cb231eeb and 7c5e4028, disproving that suspected new-web regression boundary. With only the freshness cancellation fix overlaid, the copied-tracker process exits. A-8449 contains probe source, raw historical outputs and qualifications: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8449-t-1060-shutdown-handle-diagnosis-and-historical-comparison/report.md. Minimized C1 and C2 tests went red before fixes; current targeted Darwin arm64 execution passes daemon.test.ts 14/14 and freshness.test.ts 8/8. No suite receipt yet.

### rev-23 · 2026-10-21T14:21:37.986Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1060-source
commit: 5a1f508a19939d2507c7a1e31c44c85765b70f25
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8451 records full nine-file Standards/Spec audit at fixed merged-devbe94e3ac. No findings. Freshness owns abort before draining, fences later sequential Git launches; native runner waits normal child completion while cancellation signals its owned PID. Stop CLI preserves prior owner+acknowledgement and current lock safety: released-lock/live owner yields explicit PID diagnostic/exit1, no signalling or successor-file removal. T3 real-process tests arm exact diff-tree/stopped receipts before fault/stop, separately bound exit2s and retain hub/Git PID absence; CLI fake deadline follows completed shutdown receipt. Help/README/tests/skill provenance/default Coordinator clause match. C3 verified from raw A-8449 resource traces and historical a9d2fb32613e918720216bb50284439a4486af3e introduction diff: execFile Git ChildProcess/pipes/timeout in epicDemoFreshness, present at both suspected historical versions; fixed-overlay exits. Diagnostics use copied-current tracker, not historical DB/suite/benchmark proof. C1/C2 remain runtime-unverified; targeted green counts are development summaries. Proceed unchanged-head mode-free verify; Coordinator57b4d3e7 also requires full pre-merge lifecycle suite. Final settlement waits for its same-head new-T3 receipts; task T1/T2 alone insufficient. Separate abandonment flag issue is T-1062. No Reviewer runtime; QA none.

Criteria: C3 verified.

### impl-1060 · 2026-10-21T14:25:47.010Z

Verification e23cc5c1 at 5a1f508a failed (A-8456), T1 704 completed/703 pass/1 fail; T2/Web not run. Actual failure: defaults coordinator clause reply 6540 bytes exceeds 6528-byte growth-headroom ceiling. Reproduced targeted locally. Per Coordinator 379027e1, removed only T-1060's added default clause line and placed guidance in hub/README.md Coordinator session procedure; all other clause text unchanged. Targeted roles-clauses.test.ts now 27/27 on local Darwin arm64, byte-budget assertions retained. Old full run 98d84b09 cancelled (A-8458, counts unavailable), supplies no passing lifecycle evidence. Fresh source review and verification required at the new head.

### rev-23 · 2026-10-21T14:26:00.154Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1060-evidence-red
commit: 5a1f508a19939d2507c7a1e31c44c85765b70f25
scope: evidence
findings: [{"severity":"medium","text":"The added hub-stop guidance exceeds the enforced default Coordinator reply growth reserve: A-8456 roles-clauses assertion reports6540bytes versus6528 allowed. Shorten the new pointer without raising the ceiling or weakening the assertion, then fresh source review and verification.","file":"hub/src/roles/default-roles.ts","line":61}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear; A-8459 records A-8456/e23cc5c1 actual failure at5a1f508a: 'defaults coordinator: clause reply is 6540 bytes; 15% growth headroom requires at most 6528 of 7680 bytes' (log3984). Task-local enforced assertion, not duration report debt/shared defect. Linux droplet T1 exit1:703pass/1fail; T2/Web absent, no T3 proof. C1 failed; C2 remains unverified, C3 diagnostic verification retained. Lead already correcting clause wording; preserve byte ceiling/assertion. New head needs fresh source review before replacement mode-free and Coordinator-required full lifecycle receipts. Full98d84b09 still launching at inspection, not a result. Hostcheck020cac57 reused; lint/duration/ratchet report-only. No Reviewer execution.

Criteria: C1 failed (Task run e23cc5c1 fails enforced T1 Coordinator clause headroom (6540 > 6528 bytes), blocking required same-head lifecycle proof.).

### rev-23 · 2026-10-21T14:28:24.941Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1060-source-2
commit: c200da18bb377f19d7be6acfc3980e4e151ada34
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8467 extends full A-8451 audit, Standards0/Spec0. Task-added Coordinator clause line removed; default-roles.ts equals fixed merged-devbase, existing procedure pointer retains access to README guidance. Diagnostic explanation now under Coordinator session procedure, exactly per verified Coordinator379027e1. No unrelated clause shortening, byte ceiling/assertion edits, lifecycle code/test changes or dev merge. Historical M1 reserve failure resolved in source; reported local27/27 clause tests are targeted support. C3 diagnostic/provenance remains unchanged and reverified at this head; C1/C2 require runtime receipts, C1 done refreshed. Proceed mode-free verify unchangedc200da18, then Coordinator's replacement full lifecycle suite. Final settlement waits for both exact-head receipts/newT3cases. A-8456 failed/A-8458 cancelled remain historical, not passes. No Reviewer runtime; QA none.

Criteria: C3 verified.

### rev-31 · 2026-10-21T14:41:31.502Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1060-shared-source
commit: 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized two-commit allowance delta clear, A-8486. Exactly one durations.json identity added; all other JSON unchanged, final blob matches Coordinator 385f4e79. 12s allowance owner E-880 expires2026-10-28, measured Linux basis confirmed in A-8477, follow-up T-1051. Lifecycle source/tests unchanged from rev-23 full source-clear c200da18. C3 diagnosis reverified; C1/C2 remain pending replacement mode-free and Coordinator-required full lifecycle receipts. Prior failed/cancelled runs not reused; no merge enqueue.

Criteria: C3 verified.

### impl-1060 · 2026-10-21T14:50:42.036Z

Mode-free configured verification 76fde038-31e9-41ff-adab-0da651ec983d green at 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7, source-clear rev-20261021-1060-shared-source. T1/T2/Web exit 0; 2306/2306 tests pass, zero skips/fails. Executor droplet, Linux x64 6.8.0-142-generic, Node24.21.0, c-8 lon1, lifetime475s/cost$0.0330. Test lint/duration/ratchet report-only; enforced gates passed. Host gate receipt 3af5b80b reused, not repeated remotely. A-8494: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8494-suite-76fde038-31e9-41ff-adab-0da651ec983d-auto-at-8d5bee1.log. T3 is absent from task verification; full 68c57731 remains pending and is required for C1/C2 final review settlement.

### impl-1060 · 2026-10-21T15:06:38.522Z

Coordinator-required full fresh 68c57731-d17d-4dca-8d65-477caaaa63e1 is GREEN at unchanged reviewed 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7. T1/T2/T3/Web all exit0; 3536 tests,3528 pass,8 skipped,0 failures. T4 not included. Actual C1 and C2 T3 finish receipts are both pass, not skipped (A-8510 lines13523/13553 and13557/13559). Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, c-8 lon1 droplet, lifetime1400s/cost$0.0973. Lint/duration/ratchet report-only, enforced gates pass; reused host gate3af5b80b not repeated remotely. A-8510 durable log: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8510-suite-68c57731-d17d-4dca-8d65-477caaaa63e1-all-at-8d5bee1.log. Together with mode-free A-8494/76fde038 this supplies requested runtime evidence. Reviewer final settlement requested; no source change or merge.

### rev-31 · 2026-10-21T15:08:02.253Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1060-final
commit: 8d5bee1a9a66a681c859f064400fa1d7efa5b5c7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1–C3 clear, A-8513. Exact-head Linux mode-free A-8494:2306 pass; Coordinator-required full A-8510:T1/T2/T3/Web exit0,3528 pass/8 explicit non-task skips/0fail. Actual C1 hub-serve and C2 acknowledged-live-PID daemon identities pass, final2s+hub/Git reaping and diagnostic/safety assertions inspected; daemon14/14 and freshness8/8. No lifecycle load-repetition claim. Host check not repeated on droplet; inherited report-only duration/lint/skip limitations retained. Both claimant marks and required receipts complete. No T4/QA/merge-enqueue claim.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T15:12:32.743Z

Merged 3d6da90e49430a7d63eddd49c9de5a3d2ffff646 onto dev.
