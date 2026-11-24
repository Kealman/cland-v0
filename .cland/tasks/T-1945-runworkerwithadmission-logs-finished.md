---
id: T-1945
kind: task
title: runWorkerWithAdmission logs "Finished" before persisting the worker receipt, so a throwing terminal log skips the durable receipt
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1723
branch: t/T-1945-runworkerwithadmission-logs-finished
created: 2026-11-17T12:20:13.013Z
updated: 2026-11-24T10:28:21.793Z
---

## Summary

In hub/src/hub/suite-worker-admission.ts, runWorkerWithAdmission calls options.log("Finished …") before options.persist(receipt), and nothing guards the log call. If the terminal log throws synchronously, the durable receipt is never written, even though the worker's outcome already exists (rules 25 and 39). Found by impl-1935 by reading the source during T-1935 (topic-1594, 2026-11-17); not reproduced.

## What to build

Persist the receipt first, or isolate the log so that its failure adds a secondary diagnostic and never prevents or replaces the receipt.

## Acceptance criteria

- [x] C1. With a log callback that throws, the worker's receipt is still persisted with its original outcome, and the log failure is reported as a secondary diagnostic (test, fakes only).
  - done: impl-1945 · 2026-11-24T09:48:23.745Z
  - verified: rev-35 [reviewer] · run rev-35-1945-evidence-1 · 2026-11-24T10:28:21.614Z · commit 2e7ffc150e7072373228f4d49ef361a6741404a5
- [x] C2. The readers of the worker receipt are listed with their dispositions (rule 41).
  - done: impl-1945 · 2026-11-24T09:48:25.011Z
  - verified: rev-35 [reviewer] · run rev-35-1945-source-2 · 2026-11-24T09:49:54.183Z · commit 2e7ffc150e7072373228f4d49ef361a6741404a5
  - verified: rev-35 [reviewer] · run rev-35-1945-evidence-1 · 2026-11-24T10:28:21.614Z · commit 2e7ffc150e7072373228f4d49ef361a6741404a5

## Comments

### impl-1945 · 2026-11-24T09:04:24.182Z

C2 consumer census (searched runWorkerWithAdmission, WorkerCompletion, suite-worker/admission imports, job.result/run.result/ref.result, and raw result JSON readers across hub/shared/nvim/web, docs and shipped skills): production writer hub/src/hub/suite-worker.ts gains the stderr diagnostic sink; hub/src/executor/local.ts status and retirement readers retain the exact legacy completion shape; hub/src/hub/suites.ts restore/collect/terminal materialization and result enrichment readers remain unchanged because no receipt field changes. Droplet run/status programs produce their own receipts and do not invoke this admission owner. Direct tests/fixtures: suite-worker-cause (T1, migrated/additional fake regressions); suite-command, suite-recovery, suite-timeouts, suite-stage-cover and state-paths-inventory reference worker execution (unchanged legacy shape); suite-accounting, suite-cache, executor-safety-component, suite-hung-component, suite-soak, suite-cover, suite-persistence, measure-memory and memory-streaming directly read/write local result files (unchanged). Remaining suite result readers consume the unchanged hub/executor result interfaces. Docs/skills/startup probes and frozen CLI fixtures have no caller of this owner or dependency on terminal-log-before-receipt ordering; no CLI/help bytes change. Existing suite-worker-cause deep-equal receipt assertions preserve previous wire shape. C1 red: AssertionError completion must be durable before terminal logging, 0 !== 1. After fix targeted T1 file 11/11 passes on local macOS arm64, Node 24.21.0; no browser/native or configured suite run yet.

### rev-35 · 2026-11-24T09:18:33.876Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1945-source-1
commit: f8ffbc360d4b3feba7747976b6568e5eb380d7ea
scope: full
findings: [{"severity":"medium","text":"M1: moving result publication before terminal stdout/stderr leaves new writes after the authoritative success receipt. LocalExecutor.status returns done on that file and release's success fast path drops native ownership without joining the worker, so collection/finalization can race an open log fd and lose the terminal/secondary diagnostic write. Retain publication as the final owner action via the task's isolated-log alternative, or add a positive writer-close fence; update the reader disposition and cover this boundary.","file":"hub/src/suite-worker-admission.ts","line":42}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22782 records one medium integration finding, confirmed by lead327a4750. Result rename is observable before new terminal/secondary writes; LocalExecutor.status118 treats it as done and release228–233 drops successful ownership without join, allowing log finalization to race the old open fd. The item permits isolating diagnostic sinks before final publication, or a positive native-close fence if keeping post-receipt writes. Correct the reader disposition and retained boundary controls. Pure11/11 T1 callbacks establish synchronous isolation/legacy shape only, not native collection ordering. C2 failed; C1 remains done/unverified, none verified here. Read-only source/tracker/artifact inspection, no execution/edit. Hold releases for correction/fresh source review; no verify at this head, dev merge/full task suite requested.

Criteria: C2 failed (LocalExecutor consumes success receipt as done/releases without worker join, so new post-receipt stdout/stderr writes race collection; unchanged receipt fields do not make this reader unaffected.).

### impl-1945 · 2026-11-24T09:19:28.532Z

C2 corrected disposition after source1 M1 (A-22782): LocalExecutor.status treats readable result JSON as done; successful release drops launch ownership without joining the worker. These readers depend on receipt publication following all worker diagnostic callbacks, despite unchanged field shape. The correction restores that order: terminal log and secondary diagnostic callbacks are guarded before persist, and persistence is the final callback. Suites restore/collection/finalization consequently sees no newly introduced post-publication callback. No executor lifecycle/flush guarantee is claimed; fake callback-order evidence is not native fd-close evidence. Remaining reader census and old-wire-shape dispositions from the earlier comment stand. Correction red at f8ffbc360: 9/11 passed, 2 failed; literal first error 'receipt publication must be the final callback', actual [persist, log, diagnostic], expected [log, diagnostic, persist]. Corrected working source: 11/11 T1 suite-worker-cause passed, local macOS arm64 Node 24.21.0, no browser/native worker. Full lint/typecheck pending Coordinator lint slot grant; no configured verify run.

### rev-35 · 2026-11-24T09:49:54.183Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1945-source-2
commit: 2e7ffc150e7072373228f4d49ef361a6741404a5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22799: source clear, Standards 0/Spec 0 findings. Source1 M1 is resolved through the task's isolated-log alternative: guarded terminal and secondary diagnostic callbacks precede final persistence, restoring the existing local-reader ordering. Corrected fake controls retain exact original outcomes/metadata, final-callback order and persistence exception identity. C2 reader dispositions checked/verified; no native fd-flush/close claim. C1 remains done/unverified pending actual same-head configured evidence. A-22784's local red/green is authored evidence with explicit fake-boundary limits; request reports final-head lint/typecheck0. No reviewer execution or edits. Hold releases; seek Coordinator window for mode-free verification at unchanged head. No full task-head suite or dev merge requested.

Criteria: C2 verified.

### impl-1945 · 2026-11-24T10:26:52.009Z

Same-head configured evidence: run e15c843e-9459-4d19-a06c-5d7b8f32f31a / A-22827 at 2e7ffc150e7072373228f4d49ef361a6741404a5, exit 0. Log independently contains finish/timing outcome pass for C1 cases: terminal logging failure preserves the persisted worker outcome and reports a secondary diagnostic; a failed diagnostic sink cannot replace the durable worker outcome; receipt publication preserves its exact error after both diagnostic sinks fail. T0, all T1, fallback all T2, seven selected T3 importer files and Web exited 0; remaining T3 deferred to merge batch, no T4 claimed. Summary: 7464 pass, zero fail, one macOS prerequisite skip. Executor droplet c-8 nyc1, Linux x64 6.8.0-149-generic, Node 24.21.0, Neovim 0.12.5; Web Chrome Headless Shell chromium_headless_shell-1248 / Google Chrome for Testing 156.0.8078.4. Duration/lint budget findings are report-only. Droplet lifetime 1859 s, cost $0.1291. Awaiting reviewer same-head settlement; no changes or resubmissions.

### rev-35 · 2026-11-24T10:28:21.614Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1945-evidence-1
commit: 2e7ffc150e7072373228f4d49ef361a6741404a5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22828 audits same-head run e15c843e/A-22827: finished/passed, result code0/empty cause, complete run/tree-bound T0/T1/T2/selected-T3/Web receipts. All11 worker-cause cases pass; each3 new sink/persistence control passes base+5distinct load repetitions. C1 verified with source2's isolated-log/final-persist ordering; C2 reader dispositions retained and verified. Completed243T1/445T2/7T3/55Web files, remaining266T3 deferred,18T4 unexecuted. Aggregate7464pass/1prerequisite skip/0fail; loaded15pass/5skip separate, known3F2 finish-only records not added. Linux c8nyc1 Node24.21/nvim0.12.5, isolated Headless1248 Chrome156.0.8078.4; report-only budgets/lint. Canonical2de962dd differs from Git73df5bac. No new native flush/close claim, full integrated cover or reviewer execution/edit. Findings=[]; final clear.

Criteria: C1 verified, C2 verified.
