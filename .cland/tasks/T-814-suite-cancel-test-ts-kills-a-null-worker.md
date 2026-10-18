---
id: T-814
kind: task
title: suite-cancel.test.ts kills a null worker pid when the job snapshot precedes pid recording
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-527
branch: t/T-814-suite-cancel-test-ts-kills-a-null-worker
created: 2026-10-18T18:33:03.823Z
updated: 2026-10-18T19:10:59.319Z
closed: 2026-10-18T19:10:59.319Z
---

## Summary

`hub/test/suite-cancel.test.ts` › "a worker killed while the hub is down is reported after restart and its package children are cleaned" calls `process.kill(job.pid!, 'SIGKILL')` while `job.pid` is still null. It fails with ERR_INVALID_ARG_TYPE at line 181. That happens when the launched job's snapshot is read before the worker pid is recorded. Seen on a droplet (Linux, 2 workers) in run b329e5fa for T-809 at bfbc434d (A-5477, lines 48835–48839); that change didn't touch this file.

## Acceptance criteria

- [x] C1. The test waits for the worker's recorded pid (an observed state, not a sleep) before stopping the hub, and fails with a named message if the pid never appears; all original assertions are kept.
  - verified: rev-31 [reviewer] · run rev-20261018-814-source · 2026-10-18T18:41:39.202Z · commit 6a4b07351f50f3095b2fc3807639b14d2a298f27
  - done: impl-814 · 2026-10-18T18:41:56.473Z
- [x] C2. The file passes 20 serial runs on macOS and one droplet run, with a red-to-green proof that a delayed pid recording no longer reaches process.kill(null).
  - done: impl-814 · 2026-10-18T18:44:47.378Z
  - verified: rev-31 [reviewer] · run rev-20261018-814-final · 2026-10-18T18:45:10.880Z · commit 6a4b07351f50f3095b2fc3807639b14d2a298f27

## Comments

### impl-814 · 2026-10-18T18:35:57.292Z

Implemented fixture.workerPid(job.id) observation before hub stop and signal; original assertions retained. Deterministic red→green: held only the temporary fixture's admission lock until launch returned pid=null, then released it. Original test failed ERR_INVALID_ARG_TYPE at process.kill(null); fixed test passed (3.790s file). Fault-injection patch removed from committed fix. Head 6a4b0735; fetched/merged origin/dev (already current). Running host check and 20 serial complete-file runs with provider token removed and harness-isolated account/state/executor paths.

### impl-814 · 2026-10-18T18:40:49.200Z

Host checks passed at pushed clean 6a4b0735. Evidence: A-5511 deterministic delayed-PID red→green; A-5512 npm run check; A-5518 20 serial complete-file macOS runs, 120 tests passed, 272.775s total, 12.264–18.702s/file. Requested source review via reviewer in topic-527. Awaiting clear source verdict before one mode-free droplet verify.

### rev-31 · 2026-10-18T18:41:39.202Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-814-source
commit: 6a4b07351f50f3095b2fc3807639b14d2a298f27
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-814 source review

Head:6a4b07351f50f3095b2fc3807639b14d2a298f27
Fixed base:adde1a6c2825985e61982c869469fc79f98ae4ab
Scope:full; one-file change in hub/test/suite-cancel.test.ts.

Standards:clear. Reuses existing bounded fixture.workerPid(job.id), which reads the matching current hub.status job with named eventually('worker PID published for <id>') and immediately registers process cleanup ownership. The observation precedes stopping the hub; SIGKILL uses that observed PID. Existing T3 crash/restart boundary is explained locally. No new process, sleep, helper, production change or allowance.

Spec:clear. C1 is established by source: no launch-snapshot PID is used for the signal, every original assertion line remains byte-identical, and the named bounded helper fails if publication never happens. A-5511 records a deterministic fixture-local admission lock forcing the launch PID null: original signal fails ERR_INVALID_ARG_TYPE, fixed test passes with the same injection, then temporary injection removed. The final diff contains only the rationale, observed PID and changed signal argument.

A-5518 raw Mac log audited:20 complete six-case files,120 passes,zero failures/cancellations/skips and20 exit0 receipts. These support the Mac portion of C2 but no Linux task result has run yet. A-5512 reports npm run check pass. Findings:none. Verify C1; leave C2 unverified pending same-head post-source droplet result. Claimant should maintain its done marks as evidence completes. No per-item QA or further local run is required.

Evidence:A-5519.

Criteria: C1 verified.

### rev-31 · 2026-10-18T18:45:10.881Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-814-final
commit: 6a4b07351f50f3095b2fc3807639b14d2a298f27
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-814 final evidence review

Head:6a4b07351f50f3095b2fc3807639b14d2a298f27; unchanged current source-reviewed/pushed tip.
Scope:evidence. Run9e119748-ae6f-46c4-9464-1ee1a776977e / A-5521, auto hub-selected exit0.

All six suite-cancel cases positively pass on Linux, including the fixed killed-worker/restart/child-cleanup case4.729449s. Selected hub phase14/14 and Neovim smoke6/6 complete:20pass,0fail,0cancelled,0skip; both failure arrays empty. No runtime tier trips, owned quarantine entries or owned budget failures. This is selected task evidence, not a full-suite claim; the changed case is an existing identity and no new-identity repetition gate is claimed for it.

Previously audited A-5518 supplies20 complete serial Mac six-case files/120passes/zero fail,cancel,skip; A-5511 supplies the identical forced-null-launch delayed-admission red→green proof, with temporary injection absent from the final diff. Current C1 source verification rev-20261018-814-source remains valid. Claimant13176e3f restored C2 done against these receipts.

Linux x64 c-8lon1,workers2,Node24.21.0/Neovim0.12.5; lifetime124s,cost$0.0086,peakload1.05. Findings:none. C2 verified, completing C1/C2 across source and final passes. No further task verification or per-item QA required.

Review evidence:A-5522.

Criteria: C2 verified.

### coord · 2026-10-18T19:10:59.319Z

Merged 3e941bc9a5ea6b8ef37d33759375c1d8e561ba55 onto dev.
