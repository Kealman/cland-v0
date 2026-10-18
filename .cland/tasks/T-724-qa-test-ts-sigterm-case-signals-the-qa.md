---
id: T-724
kind: task
title: qa.test.ts SIGTERM case signals the QA run before its handler is installed and sees no BLOCKED line
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - flaky
  - nvim
assignee: null
parent: E-482
blocked_by: []
topic: topic-485
branch: t/T-724-qa-test-ts-sigterm-case-signals-the-qa
created: 2026-10-17T05:55:15.692Z
updated: 2026-10-18T07:58:33.699Z
closed: 2026-10-18T07:58:33.699Z
---

## Summary

nvim/test/qa.test.ts "a run that is interrupted (SIGTERM) takes its Neovim with it and still says BLOCKED" failed in integrated cover b0cd94d7 at 7d6ebc1f (A-4317): `one JSON line on stdout, got: 0` after 126 ms. It passed 5 of 5 times alone at the same commit on the Mac, 278–403 ms each. The early failure time suggests the test signals the QA run before the run has installed its SIGTERM handler, so the run dies without printing its BLOCKED line.

## What to build

The case waits for an observable readiness signal from the QA run, such as its start line, the Neovim child's pid or a ready marker, before it sends SIGTERM. It then asserts the same outcome: Neovim is gone and stdout carries one BLOCKED JSON line. No fixed delay before the signal.

## Acceptance criteria

- [x] C1. The case sends SIGTERM only after an observable readiness signal from the QA run, with its assertions unchanged in meaning, proved by the file passing with an injected start delay in the run.
  - done: impl-724 · 2026-10-18T07:20:49.899Z
  - verified: rev-31 [reviewer] · run rev-20261018-724-source-2 · 2026-10-18T07:25:03.914Z · commit fe3875ab7860f7b0bf9b756e9c8b744bf391b74a
- [x] C2. nvim/test/qa.test.ts passes 10/10 serially as a whole file on the Mac and once in the task's droplet verify.
  - done: impl-724 · 2026-10-18T07:57:59.419Z
  - verified: rev-31 [reviewer] · run rev-20261018-724-final · 2026-10-18T07:58:25.191Z · commit fe3875ab7860f7b0bf9b756e9c8b744bf391b74a

## Comments

### coord · 2026-10-18T07:11:06.170Z

New receipt (coord, 2026-10-18 07:11Z): Linux droplet run 6c237173 (A-5048), T-771 at 004f53ac, failed nvim/test/qa.test.ts:290, "a run that is interrupted (SIGTERM) takes its Neovim with it and still says BLOCKED", with "one JSON line on stdout, got: 0". That's this item's signature. On the Mac it passed 10/10 at both the T-771 head and clean dev 5f8d274a (A-5052). It's Linux-only so far.

### impl-724 · 2026-10-18T07:13:58.540Z

Diagnosed the signal-handler readiness race: an awaited 2s startup gap after Neovim spawn reproduces empty stdout (0 JSON lines); waiting for the post-handler-installation stderr marker passes with that same mutation (A-5054). Required typecheck, test:tiers and test:lint pass. Delayed whole-file and 10 serial Mac repetitions underway; no QA policy or QA criteria require a separate brief.

### impl-724 · 2026-10-18T07:17:46.181Z

Implementation committed and pushed as 6f58083b7d6a5f20bf06a4c637923e601ca08803. Final-tree qa.test.ts passes 10/10 serially on Mac (22 tests each; 18.53–21.11s; sampled 1m load 5.52–7.36), A-5057. Required npm typecheck, test:tiers, test:lint pass. C1 red/green probe A-5054 and delayed whole-file pass A-5055. C2 awaits exact-reviewed-head droplet verification after source clearance; separate QA scope is none.

### rev-31 · 2026-10-18T07:19:30.090Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-724-source-1
commit: 6f58083b7d6a5f20bf06a4c637923e601ca08803
scope: full
findings: [{"severity":"medium","text":"M1: only the CLI is owned while readiness is pending; parent cancellation before handler installation can leave its detached Neovim group alive.","file":"nvim/test/qa.test.ts","line":311}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-724 source review — not clear

Commit:6f58083b7d6a5f20bf06a4c637923e601ca08803.
Fixed point:b27f71f4bfc16bea228ef55c5d2f79248535b658.
Scope:full. Read-only review, no Reviewer execution or edits.

## Standards

M1 medium — nvim/test/qa.test.ts:311. The new readiness wait can fail/cancel after nv.pid resolves but before QA signal handlers are installed. The CLI child is owned by qa-runner, but its Neovim is a detached group with no separate fixture owner. Cleanup may SIGKILL the CLI before it can reap that group, while tempDir cleanup proceeds. The parent PID alone does not establish ownership of that separately detached group in the shared targeted cleanup path.

Register the observed Neovim group immediately when nv.pid resolves, before the readiness race can complete, and retain bounded group/close observations before directory disposal. Add a controlled suppressed/held-readiness cancellation check proving both owned processes are gone and the root remains until cleanup completes. Implementer confirms no outer owner (f977ccf4) and will correct before verification.

No other source finding. qa() invokes its started callback synchronously, so the ready Promise is installed before Promise.all evaluates it. qaReady handles split data, closed stderr and a10s bound. The emitted stderr marker follows handler installation; stdout's single JSON result remains untouched. No fixed signal delay, skip or allowance was introduced.

## Spec

The main signal race is addressed: SIGTERM waits for both the Neovim PID and the post-handler marker; the original BLOCKED,exit2,interrupted-message and group-gone assertions remain. Child finish before readiness is a failure, not permission to signal an exited run.

A-5054 records the2s pre-handler mutation: old case fails with zero JSON lines; corrected readiness passes with the same delay. A-5055 raw delayed whole-file receipt is22/22pass,0fail/skip/cancel,21.908404125s. Temporary injected delay is removed from final source.

A-5057 supplies ten run summaries with exit0/load5.52–7.36; raw ten-run transcripts have since been attached as A-5060 and await audit with the corrected-source repetitions. Typecheck/tiers/lint are reported passed. No task verification before fresh source clearance.

## Verdict

Source not clear for M1; C1 failed until readiness failure cleanup owns the detached group. C2's corrected-source Mac10/10 and same-head droplet execution remain pending. No per-item QA.
Standards:1 medium finding. Spec:positive readiness proof present; failure-path ownership and final execution evidence pending.

Durable review:A-5062.

Criteria: C1 failed (Readiness failure/cancellation can leave the detached Neovim group unowned; register it on PID receipt and prove bounded cleanup before root disposal.).

### impl-724 · 2026-10-18T07:24:26.028Z

M1 corrected and pushed at fe3875ab7860f7b0bf9b756e9c8b744bf391b74a: ownProcess registers detached Neovim immediately on PID observation. Held-readiness cancellation proof A-5063 demonstrates group-gone before fixture disposal with ownership, versus a surviving group without ownership; temporary probes removed. Fresh typecheck, test:tiers and test:lint pass. Fresh whole-file Mac10/10 (22 tests per file, 18.55–22.20s; sampled load 5.10–7.95) with raw transcripts and loads in A-5066. C2 droplet remains pending clear source review.

### rev-31 · 2026-10-18T07:25:03.914Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-724-source-2
commit: fe3875ab7860f7b0bf9b756e9c8b744bf391b74a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-724 corrected source review — clear

Commit:fe3875ab7860f7b0bf9b756e9c8b744bf391b74a.
Scope:full source continuation. Prior review:A-5062 /rev-20261018-724-source-1.
Read-only; no Reviewer execution or edits.

## Standards

M1 resolved. The test now registers the detached Neovim group immediately in nv.pid().then, before the combined PID/readiness barrier resolves. Shared owned-process cleanup covers the CLI and detached group even if readiness fails before the CLI can handle signals. Normal BLOCKED/exit2/message/group-gone assertions are retained.

A-5063 independently inspected: an unreleased post-spawn/pre-handler barrier intentionally reaches the readiness AbortError. Without ownership the group remains at the fixture-disposal boundary; with ownership it is gone while the fixture still exists, then the fixture is removed. These are intentional red primary tests used for cleanup control, not counted as green. Probe barriers/assertions are removed from final source.

The marker remains after all signal-handler registrations; qa() invokes started synchronously, so its listener Promise is installed before evaluation of Promise.all. Readiness is bounded10s and handles fragmented chunks, stream closure and early completion. SIGTERM occurs only after both marker and PID receipt. No fixed signal delay, skip, allowance or unrelated source change; no dev merge after first review.

## Spec and evidence

C1 established. The2s startup-delay mutation in A-5054 makes the old signal-on-PID case fail with zero JSON lines and the corrected marker case pass. A-5055 delayed complete-file execution is22/22pass with no skip/cancellation. Assertion meaning is unchanged: one BLOCKED JSON result,exit2,interrupted-by-SIGTERM message and the Neovim group gone.

A-5066 current-source raw transcripts independently audited: ten complete serial Mac runs,22pass each,220passes total, zero failures/skips/cancellations/todo and no late asynchronous diagnostics. All ten SIGTERM cases execute positively. Wall18.55–22.20s/file; sampled load5.10–7.95. Refreshed host typecheck/tiers/lint are reported passed. Earlier A-5057 summary/A-5060 raw logs are historical; current proof is A-5066.

C2's Mac portion is established; final verification waits for the exact-reviewed-head mode-free diff-selected droplet receipt. Both current origin branch and review request name this commit. No separate per-item QA.

## Verdict

Source clear; verify C1. C2 remains unverified pending Linux execution. No additional Mac run requested.
Standards:0 remaining findings. Spec:0 source gaps; C2 runtime pending.

Durable review:A-5067.

Criteria: C1 verified.

### impl-724 · 2026-10-18T07:58:00.213Z

C2 complete: droplet verification 35a2aa29-d594-4505-9c54-00eb0fdf29e1 passed at exact reviewed fe3875ab7860f7b0bf9b756e9c8b744bf391b74a (A-5085). Linux x64, Node v24.21.0, Neovim v0.12.5; 2535 tests, 2527 pass, zero failures, 8 platform skips. Target SIGTERM case passed without skip in 378.89ms; qa.test.ts ran as a whole file (three sandbox-exec-only cases skip on Linux). Corrected Mac10/10 raw receipts remain A-5066. Droplet lifetime 1923s, cost $0.1335. Head/tree unchanged; awaiting Reviewer final same-head verdict.

### rev-31 · 2026-10-18T07:58:25.191Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-724-final
commit: fe3875ab7860f7b0bf9b756e9c8b744bf391b74a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-724 final exact-head evidence review — clear

Commit:fe3875ab7860f7b0bf9b756e9c8b744bf391b74a.
Scope:evidence. Source continuity:rev-20261018-724-source-2 /A-5067.
Read-only audit; no Reviewer execution or edits.

## Standards

No remaining findings. The post-handler readiness marker, separate detached-group ownership and original BLOCKED/exit/message/group-gone assertions remain unchanged. C1's delayed-start red/green and held-readiness cleanup proof remain current.

A-5066's corrected-source ten complete serial Mac transcripts were independently audited in source-2:22passes per file,220passes total,0fail/skip/cancel/todo, no late asynchronous diagnostic, sampled load5.10–7.95. Historical pre-correction summaries are not substituted for these current transcripts.

## Spec and Linux execution

A-5085 /35a2aa29-d594-4505-9c54-00eb0fdf29e1 is passed/exit0 at the exact reviewed commit, automatic full selection for mixed hub/Neovim paths. Current origin branch still names this head.

Independently matched all22 qa.test.ts timing identities with raw outcomes:19positive passes and3explicit needs-macOS-sandbox-exec skips. Those three sandbox cases all execute on the Mac evidence; none is the changed SIGTERM case. The SIGTERM case executes positively on Linux in0.378893701s and retains the single BLOCKED JSON,exit2,interrupted message and group-gone assertions.

Overall2535tests,2527pass,0fail/cancelled,8prerequisite skips. Raw phase summaries reconcile as free224pass, machine1912pass+5skip, Neovim391pass+3skip. Full Neovim completed186.20s. No known-failure exception is needed; report-only budgets/ratchet notices are diagnostic.

Linux x64,Node24.21.0,Neovim0.12.5,c-8 lon1,2workers; suite1836.68s,peak load7.46,lifetime1923s,cost$0.1335.

## Verdict

Final review clear; verify C2. C1 remains current from source-2. Claimant may refresh C2 done using the accepted receipt. No further task run, Mac repetitions or per-item QA requested.
Standards:0 findings. Spec:0 remaining gaps.

Durable review:A-5086.

Criteria: C2 verified.

### coord · 2026-10-18T07:58:33.699Z

Merged 2cb7047a567cf715a19937a7eea694351273eed8 onto dev.
