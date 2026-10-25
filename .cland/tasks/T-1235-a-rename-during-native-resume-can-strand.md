---
id: T-1235
kind: task
title: A rename during native resume can strand the launch reservation under the old name
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1065
branch: t/T-1235-a-rename-during-native-resume-can-strand
created: 2026-10-24T11:19:13.427Z
updated: 2026-10-25T19:53:14.296Z
closed: 2026-10-25T19:53:14.296Z
---

## Summary

A native session resume records its launch reservation under the admitted session name. The settlement then uses the current name: `#resume` calls `releaseLaunchRole(row().name, …)` on failure and `launchSettled(process.name)` on success. Store reservations are keyed by name and do not follow a rename, so a Coordinator rename during a native resume can strand the original reservation key. impl-1220 found this statically during the T-1220 M4 audit; it is not yet reproduced.

## Acceptance criteria

- [x] C1. A rename during a native resume releases or settles the reservation recorded under the admitted name, on both failure and success (test).
  - done: impl-1235 · 2026-10-25T18:54:07.667Z
  - verified: rev-31 [reviewer] · run rev-20261025-1235-final · 2026-10-25T19:11:21.603Z · commit f3fbdb3d5955659dcde4b5e8db7d790837a28d06
- [x] C2. No reservation key outlives its resume after a rename (test).
  - done: impl-1235 · 2026-10-25T18:56:03.476Z
  - verified: rev-31 [reviewer] · run rev-20261025-1235-final · 2026-10-25T19:11:21.603Z · commit f3fbdb3d5955659dcde4b5e8db7d790837a28d06

## Comments

### impl-1235 · 2026-10-25T18:50:34.333Z

Initial inspection: worktree clean; defect remains in #resume's three rollback paths and successful publication. Use the triage-approved adapter seam at T2: hold the in-process adapter's resume, rename over the public session protocol, settle failure/success, then inspect the store's durable reservations and public process identity. No reply/list/schema or admission-policy change; only settlement uses the existing admitted name rather than mutable display name.

### impl-1235 · 2026-10-25T18:52:48.304Z

TDD reproduced: before success fix the exact assertion `no reservation outlives the completed resume` failed with actual [{name:'coord',role:'coordinator',previous:null}], expected []. After success fix, missing/throwing/forbidden failure cases produced the same stale key. All 8 tests in session-resume-component.test.ts now pass locally (darwin arm64, in-process fake adapters; no browser or suite run). Changed all four #resume settlement calls to the admitted name; rollback still uses sessionId to resolve the renamed identity.

### rev-31 · 2026-10-25T18:55:30.557Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1235-source1
commit: c1e7a68b0f12293d14c61121498620d94379b177
scope: full
findings: [{"severity":"medium","text":"M1: new guide heading is prose, but existing test-docs.test.ts:23–25 requires exact test-path heading; candidate deterministically fails 'hub-test-session-resume-component.test.ts.md: test file heading'. Use '# hub/test/session-resume-component.test.ts'; retain guide/index/guard and reproduce red/green with existing targeted docs test.","file":"docs/agents/tests/hub-test-session-resume-component.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source NOT CLEAR; A-12106 complete Standards1medium/Spec0-separate audit at treeee6798945608ba4698bb8bab74cb5355d48e73cb. Core production fix sound: all4 native-resume settlement calls retain admitted name while releaseLaunchRole resolves current ownership by stableId. T2 held-adapter/public-Coordinator-rename matrix positively proves durable old key then empty list across success/missing/throwing/forbidden, retaining role/identity assertions. No new native process/browser/policy/schema change. Fix only M1 guide heading; existing docs guard red/green then pushed successor/fresh source before mode-free verify. Do not relax guard, add dev merge or expand runtime scope. Local A-12105 is implementation-tree summary8/8/typecheck, not configured/Linux evidence; preserve original native outputs/exits/timings/capture limits without transcription reruns. C1/C2 runtime pending; restore affected claimant mark after correction. Reviewer read-only.

Criteria: C2 failed (New per-file guide violates existing exact-path heading contract, so candidate test-docs guard fails before complete verification.).

### rev-31 · 2026-10-25T18:56:46.875Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1235-source2
commit: f3fbdb3d5955659dcde4b5e8db7d790837a28d06
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source CLEAR; Standards0/Spec0. A-12108 carries full A-12106 audit at tree033702704b90176517417043a792388b1c62eaed. Only one heading line changed; M1 exact test-path contract resolved, body/index/runtime/assertions unchanged, no dev merge. A-12107 retains local existing docs guard exact red2/3 exit1/file138.454417ms then corrected-source green3/3 exit0/file89.4285ms, original tool-output/capture limits explicit. Admitted-name settlement/stable-id rollback and four-outcome durable-reservation matrix remain source-sound. C1/C2 done, runtime verification pending. Submit one ordinary configured mode-free verify at unchangedf3fbdb3d; final review needs exact generated outcomes/new-case load receipts and actual phase/provenance limits. No extra local probe/repeat for transcription, forced all or dev merge requested. QA none. Reviewer read-only.

### rev-31 · 2026-10-25T19:11:21.603Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1235-final
commit: f3fbdb3d5955659dcde4b5e8db7d790837a28d06
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR; C1/C2 verified. A-12113 carries full source A-12106/A-12108 and independent raw A-12111 audit. Exact-head mode-free d2e0d189 exit0:3264ordinary passes plus20additional load finishes(four rename outcomes5/5 each), nofail/cancel/skip/TODO. Successful/missing/throwing/forbidden base .235410644/.151017531/.107697412/.107281437s; worstnewload .374501384s, no>=3s allowance. All8 touched-file cases and3docs-guard identities pass. Durable original reservation positively checked before/after real public Coordinator rename then empty after completed reply; stableId current-role rollback retained. HostT0/allT1/fallbackallhub+NeovimT2/mappedT4onecaseonce/Web complete; T3deferred, no fullT4/all/providerQA claim. Guard100-frame case1.343823151s; selected addedwall2.292s excludesmachinewait. Linuxc8lon1 Node24.21/Nvim0.12.5/HeadlessShell156v1248 forWeb; lifetime740s/$0.0514 distinctfromwall. HostgateTREEe32a18a6 reused remotely. Report-onlylint133/60/sevenbudgetwarnings/Web154.89>40s/ratchet2232.554same retained. Original local summary/capture limits explicit; no transcription reruns. QA none. Coordinator owns enqueue/separate pre-merge checks. Reviewer read-only.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T19:53:14.296Z

Merged 48bcab2955a177633118856fb7e9d7701a750625 onto dev.
