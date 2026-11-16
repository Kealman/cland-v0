---
id: T-1843
kind: task
title: A finished suite with no lease stays in verify queue as an active remote run and holds a remote slot across restarts
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1543
branch: t/T-1843-a-finished-suite-with-no-lease-stays-in
created: 2026-11-13T12:41:29.355Z
updated: 2026-11-16T08:34:54.074Z
---

## Summary

Periodic dev-t3 run b33e7940-f94b-4916-9181-13c0dec731f7 (started 2026-11-12 23:02:11Z on droplet cland-v0-58c69f29, lon1) ended without a posted result. Since then `cland verify queue` keeps listing it as an active remote run ("remote n/8 … ETA 0s") and counting it against the remote budget, across hub restart #71. `cland verify cancel` refuses it with "suite already finished", and the droplet no longer exists (executor status tags only the live lease). So a finished suite holds a remote slot that no permitted action clears.

## What to build

A suite that has finished, or whose lease and droplet are gone, leaves the active remote list and releases its slot. That holds at hub start too, where a restored run record with no live lease and a finished state is reconciled as finished instead of active. A run that ended without a posted result still gets one posted result naming why (lost collection, missing receipt), and the heartbeat's "ended without a posted result" row clears once that result is posted.

## Acceptance criteria

- [x] C1. A remote run whose suite record is finished and whose lease is gone is absent from `cland verify queue` and does not count against `remote_budget`, both live and after a hub restart (test).
  - done: impl-1843 · 2026-11-16T08:30:19.680Z
- [ ] C2. A run that ended without a posted result gets exactly one posted result naming the missing receipt, after which the heartbeat no longer lists it (test).
  - failed: rev-35 [reviewer] · 2026-11-16T08:34:54.074Z · note Missing-evidence recovery falsely classifies previously executed runs as not-run and drops available execution/failure identities from reporting.

## Comments

### impl-1843 · 2026-11-16T08:25:44.576Z

Consumer sweep before implementation: suite.queue/verification.queue/VerificationQueue/remoteBudget and suite-jobs/suiteJobSummaries/outcome/reported searched across hub/src, hub/test (T1–T4), nvim, web, shared, QA briefs and skills. CLI hub/src/cli/suite.ts, heartbeat hub/src/hub/heartbeat.ts, core/dispatch/web-authority, Neovim state/hub/actions/explorer/init and web connection/sessions/verification consume existing queue shapes; no wire field changes. Store/daemon/startup diagnostics, suite-worker, budget, git-maintenance and executor droplet readers keep their formats. QA T-230/T-268/T-275/T-386/E-412/E-418/E-419/E-426/E-676 and implement skill examples remain valid; only terminal no-lease remote membership changes. Existing queue/client regressions retain previous wire shapes. Full path inventory will be in the evidence artifact. Tests target suite-persistence and existing remote-budget/accounting/heartbeat client coverage; no process boundary changes.

### rev-35 · 2026-11-16T08:34:54.074Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1843-source-1
commit: 0954a8ccd6c0b981514016f97a13e3a6498ef9b5
scope: full
findings: [{"severity":"medium","text":"Missing result/log receipts do not prove non-execution. Unconditionally adding notRun:'infrastructure' makes dispatch/periodic reporting falsely say no tests executed and suppresses available failing identities for a previously executed run. Preserve known execution/outcomes and use notRun only with original positive pre-execution proof.","file":"hub/src/hub/suites.ts","line":1437}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete full source pass A-19885: one confirmed medium C2 classification finding; no separate C1 source finding. A-19886 arrived afterward and is retained as supplement: original 120 hits, conservative 1402-row inventory and explicit candidate/raw-capture limitations; no runtime coverage inferred. C1 pending fresh source/configured evidence, not failed for authorized pending checks. No Reviewer runtime work. Hold released for consolidated correction and fresh source review before verification.

Criteria: C2 failed (Missing-evidence recovery falsely classifies previously executed runs as not-run and drops available execution/failure identities from reporting.).
