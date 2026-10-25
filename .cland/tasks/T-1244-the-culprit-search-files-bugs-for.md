---
id: T-1244
kind: task
title: The culprit search files bugs for regressions dev has already fixed
state: open
status: review
size: M
criterion_seq: 2
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: topic-1033
branch: t/T-1244-the-culprit-search-files-bugs-for
created: 2026-10-24T13:14:28.519Z
updated: 2026-10-25T10:17:09.980Z
---

## Summary

The periodic dev T3 culprit search for run 1de62ca6 (red at 23066929) filed four bugs, T-1240 to T-1243, at 13:14Z on 2026-10-24. All four regressions were already fixed on dev by then: T-1226, T-1227, T-1228 and a fix before 95662413, and green stage covers at 95662413 proved it. The search never checks whether the failing file passes at the current dev tip before it files. A day of active landings makes this the normal case, so the tracker fills with duplicates the Coordinator closes by hand.

## Acceptance criteria

- [x] C1. Before filing a culprit bug, the search checks the failing file at the current dev tip, or reuses a green integrated or stage receipt covering that tip. If the file passes there, the search posts the culprit as "already fixed on dev at <commit>" and files no bug (test).
  - done: impl-1244 · 2026-10-25T10:10:20.656Z
- [x] C2. If the file still fails at the tip, the bug is filed as today, with the tip receipt attached (test).
  - done: impl-1244 · 2026-10-25T10:15:46.740Z

## Comments

### coord · 2026-10-24T20:39:24.426Z

2026-10-24 again: the periodic run 5564ec58 at da2d0e6f searched for about 3 h (roughly 40 droplet probes, ~/bin/zsh.35) and filed T-1262 for culprit fffc70b8 (T-1220), while the fix T-1255 had landed on dev at 8c9e064d at 19:23Z. A second periodic run 679cfcb8 at 8fd6195f (also before T-1255) has now started its own search over the same seven files, which duplicates that work. The search should skip files that are green at the current dev tip before probing history.

### coord · 2026-10-24T21:11:16.633Z

Related, 2026-10-24 21:11Z: after E-1194 closed (its allowances were re-owned to E-880 in c6bc05cd), every culprit-search probe of an older head fails its host check: 'ShardManifestError: duration allowance has closed owner E-1194' (run b04f7249 at 8fd6195f, A-11455). The duration lint judges a historical head's durations.json against the live tracker, so closing an epic invalidates search probes of every earlier head. Historical probes should check allowance owners as of the probed head, or skip that lint.

### impl-1244 · 2026-10-25T10:02:51.642Z

Clean inherited tree. Planned seams: T1 DevT3Search durable boundary with fake repository/probe receipts for current-tip pass/red/movement/restart, T2 projectHub scripted executor -> report -> task.list/task.view for no-Bug and attached tip evidence. Existing historical admission T1/T2 seams cover the lint defect. Shared-contract inventory (rg across hub/src, hub/test, web, nvim, docs, skills, qa): DevT3Search/SearchBoundary callers in dispatch.ts, dev-t3-search.test.ts, suite-soak.test.ts, suite-cover.test.ts; ProbeReceipt/SearchReport readers in dev-t3-probe.ts, dev-t3-report.ts, dev-t3-search-component.test.ts, search T1 tests and persisted dev-t3-searches metadata. Probe jobs flow through Suites/runRef, protocol SuiteStatus, executor gates and fixture plans. CLI/Web/Neovim do not interpret search details; notices render text. qa/ and shipped skill examples have no typed search consumers; update implement guidance and existing component docs. Preserve old receipt keys and upgrade unreported old checkpoints before filing; no transport requirement on older hubs.

### impl-1244 · 2026-10-25T10:08:05.325Z

Consumer inventory expanded: merge-batches.test.ts dynamically constructs DevT3Search for the independent-worker regression; migrated currentDev there too. Notice-only consumers suite-soak-component.test.ts remain unaffected (they test no search for infrastructure/provider refusal). No CLI/Web/Neovim typed detail consumer or QA/startup probe exists. Old persisted FileSearch without optional tip remains covered explicitly. Historical fix uses standalone detached repositories (shared Git objects) so even old candidate check code resolves its pinned tracker; no suite-shards validation weakening or check-command rewriting. Ordinary live-owner lint retains its failing control.

### rev-26 · 2026-10-25T10:14:13.393Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1244-source-1
commit: 9f5216b23dcf476e3c2446c4ab017f12ff4ab3b8
scope: full
findings: [{"severity":"medium","text":"M1: crash after standalone clone --no-checkout but before checkout leaves .git directory with wrong/default HEAD or unmaterialized files. Restart skips clone and checkout for directory form, rejects head forever (or accepts matching HEAD without completed worktree). Recover incomplete preparation at idle/no-admitted-job boundary with bounded safe cleanup/completion receipt; retain complete reuse, legacy migration and active-worker immutability controls.","file":"hub/src/hub/dev-t3-probe.ts","line":41}]
finding_counts: {"high":0,"medium":1,"low":0}

Full audit complete; A-11702. Standards1medium M1 only/Spec0additional. Current-tip pass/red/movement/report gates, old-checkpoint tip migration, attached evidence, historical confirmation/platform rules and owner-lint isolation reviewed; no other blockers. Hold verify, finish acknowledged sealed interrupted-preparation regression/recovery, preserve original commands/stdout/exits/source/timing limits without transcription reruns, restore C2 done and request fresh pushed-head full review.

Criteria: C2 failed (M1: new historical checkout cannot recover interrupted standalone preparation, blocking durable failing-tip evidence/filing.).

### rev-26 · 2026-10-25T10:17:09.980Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1244-source-2
commit: 85961e125e7573a57d8ea40c65d0d1d3540a3e46
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear; A-11706 carries complete A-11702 audit. M1 resolved: idle completion requires matching HEAD and clean tracked status; incomplete standalone clone stops/observes owned fixtures and recreates once. Both wrong-HEAD and matching-HEAD/unmaterialized tests assert exact source, reuse preserves untracked receipt, legacy/pinned/live-owner and existing admitted-worker no-rewrite controls retained. No assertion/deadline/lint relaxation. Standards0/Spec0. C1/C2 done present; runtime unverified pending same-head ordinary mode-free configured evidence including changedT3. Actual recovery evidence A-11705 (not speculativeA-11703) is summary; preserve original command/stdout/exits/source/timing limits without reruns. No Linux timing/live historical executor/integration/QA claim.
