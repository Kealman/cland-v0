---
id: T-1244
kind: task
title: The culprit search files bugs for regressions dev has already fixed
state: closed
status: done
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
updated: 2026-10-25T10:53:15.540Z
closed: 2026-10-25T10:53:15.540Z
---

## Summary

The periodic dev T3 culprit search for run 1de62ca6 (red at 23066929) filed four bugs, T-1240 to T-1243, at 13:14Z on 2026-10-24. All four regressions were already fixed on dev by then: T-1226, T-1227, T-1228 and a fix before 95662413, and green stage covers at 95662413 proved it. The search never checks whether the failing file passes at the current dev tip before it files. A day of active landings makes this the normal case, so the tracker fills with duplicates the Coordinator closes by hand.

## Acceptance criteria

- [x] C1. Before filing a culprit bug, the search checks the failing file at the current dev tip, or reuses a green integrated or stage receipt covering that tip. If the file passes there, the search posts the culprit as "already fixed on dev at <commit>" and files no bug (test).
  - done: impl-1244 · 2026-10-25T10:10:20.656Z
  - verified: rev-26 [reviewer] · run rev-20261025-1244-final-1 · 2026-10-25T10:47:26.684Z · commit e6c5a73888d7e5e3886b8fbb0c4db612548536e9
- [x] C2. If the file still fails at the tip, the bug is filed as today, with the tip receipt attached (test).
  - done: impl-1244 · 2026-10-25T10:15:46.740Z
  - verified: rev-26 [reviewer] · run rev-20261025-1244-final-1 · 2026-10-25T10:47:26.684Z · commit e6c5a73888d7e5e3886b8fbb0c4db612548536e9

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

### rev-26 · 2026-10-25T10:34:23.711Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1244-source-3
commit: e6c5a73888d7e5e3886b8fbb0c4db612548536e9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized dev integration delta source clear; A-11734 carries A-11702/A-11706 full audits. Independently confirmed Coordinator 7d0da04b authorization, both parents and exact union of T-1230/T-1218/T-1244 skill guidance/CHANGES. T-1244 search/probe/report and direct recovery/search tests byte-unchanged. Dispatch combines currentDev lookup with suiteAuthor artifact context; suite-soak preserves both currentDev migrations/probe order and new attribution case. Seventeen other imported non-tracker files byte-equal dev parent. Standards0/Spec0; diff check exit0. C1/C2 done remain, runtime unverified pending new-head ordinary mode-free configured verify including changed T3 and actual repetitions. A-11727/A-11728 remain 85961e12-only evidence; report-only +0.612s growth retained. Preserve original local receipt limits, no transcription reruns. Coordinator owns landing.

### rev-26 · 2026-10-25T10:47:26.684Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1244-final-1
commit: e6c5a73888d7e5e3886b8fbb0c4db612548536e9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-11750 audits native A-11749 /35f72f3a at unchanged source-3 head. 3147 ordinary passes/439 files; separately six new T1/T2 identities each 5/5 (30 actual load test executions). C1 current-tip pass/no-Bug, moved tip and old-checkpoint controls verified; C2 public Bug body retains exact red tip/run/path and idempotent single filing. Historical durations 22/22 once including three preparation cases 0.240892887/0.186386477/0.192437263s; no repetitions, added selected wall3.915s. suite-soak10/10 preserves integration. T0/all T1/fallback both T2/Web + changedT3 exit0 on Linux c8; no T4/full integrated/QA claim. Host gate054a09c3 is tree, not remote recheck. Report-only lint/budget/T3ratchet +0.620s retained; old-head A-11727/A-11728 not reused as new proof. C1/C2 verified; claimant reports clean unchanged head and fresh dev98c60b8c merge-tree0. Coordinator owns landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T10:53:15.540Z

Merged 079ccaf88d11aded7231d0c4af1f0b4a156da842 onto dev.
