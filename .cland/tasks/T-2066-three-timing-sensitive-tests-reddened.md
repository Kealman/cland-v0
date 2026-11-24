---
id: T-2066
kind: task
title: "Three timing-sensitive tests reddened the E-1888 epic and stage covers under load: soak coverage-map timestamp, hosts-view boot wait, and a claude-code-remote hook process outliving its file"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1718
branch: t/T-2066-three-timing-sensitive-tests-reddened
created: 2026-11-24T00:28:28.732Z
updated: 2026-11-24T01:36:31.494Z
closed: 2026-11-24T01:36:31.494Z
---

## Summary

At dev 05519f77e (2026-11-23/24), three consecutive full covers each failed one test, with every other test passing. Each test passes in other runs and on its own:
1. `hub/test/suite-soak-component.test.ts › green nightly publishes a coverage map that selects task tests`. macOS epic cover 70909049 (A-22706) failed at line 211 with `pointer.created` 12:00:02.000Z against `f.clock.now()` 12:00:02.025Z: the fake clock ticks once more between publication and assertion under load. It passes 5/5 on its own. The assertion dates from 2026-10-24.
2. `web/test/hosts-view.test.ts › Hosts Add moves the real inbox login wait through booting to placed`. Linux stage cover 92a041c8 (A-22707, shard 1, fsync 25 ms) failed with a `locator.waitFor` timeout at 6000 ms waiting for "waiting for host waiting-host to boot". The wait is fixed and doesn't scale with load. The test passed in 77af614d, 6a592423, 37b7f4fd and 4e4ae4e1.
3. `hub/test/claude-code-remote.test.ts › T-1730 C2 upgraded runtime launches Claude with connected mod bridge`. macOS epic cover 42213931 (A-22710) failed with `SSH fixture cleanup incomplete`: a `cland hook mod-turn-start` process, reparented to PID 1, outlived the file.

## What to build

For each, make the test deterministic under load:
- Case 1: assert the publication timestamp the producer recorded, not the clock at assertion time.
- Case 2: use the shared load-scaled browser wait, not a fixed 6 s.
- Case 3: join or reap the hook child through the fixture's owned process census before cleanup asserts, or find why the hook survives.

Keep every behavioural assertion. These may be split into three S items if their owners differ.

## Acceptance criteria

- [x] C1. Cases 1 (soak coverage-map timestamp) and 2 (hosts-view boot wait) each pass 5/5 under an added CPU load of about 7 on macOS, and on Linux in a mode-free verify (evidence).
  - done: impl-2066 · 2026-11-24T01:22:30.220Z
  - verified: rev-35 [reviewer] · run rev-35-2066-evidence-1 · 2026-11-24T01:23:59.635Z · commit 7921d8a59f53078b258752d20f55cc3b154ab2c1
- [x] C2. Case 2 uses a load-scaled browser wait, and case 1 asserts the producer's recorded time. Case 3, the claude-code-remote hook lifecycle, is split out to its own item (test).
  - verified: rev-35 [reviewer] · run rev-35-2066-source-3 · 2026-11-24T00:49:51.496Z · commit 7921d8a59f53078b258752d20f55cc3b154ab2c1
  - done: impl-2066 · 2026-11-24T01:22:30.417Z
  - verified: rev-35 [reviewer] · run rev-35-2066-evidence-1 · 2026-11-24T01:23:59.635Z · commit 7921d8a59f53078b258752d20f55cc3b154ab2c1

## Comments

### impl-2066 · 2026-11-24T00:36:01.239Z

Implemented the three test-only fixes and matching per-file guides. Deterministic red controls and 5/5 loaded macOS targeted passes: A-22712. Full npm run test:lint and npm run typecheck exited 0. origin/dev merged before first source review (already up to date at 4c7f3202b). Linux mode-free receipt remains pending source review and verify window.

### rev-35 · 2026-11-24T00:39:44.871Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2066-source-1
commit: 26810e753780cb5f3522b0de93b269b07f0b778f
scope: full
findings: [{"severity":"medium","text":"M1: the upgraded callback directly acquires remoteClaudeFixture and awaits the new native hook join without an encompassing pre-acquisition cancellation owner or separately bounded setup. sshHostFixture joins only its enrolled fixtureWork, and this caller does not use runOwned. A timeout/rejection can therefore let the new observation/body continuation outlive fixture cleanup. Own/join this complete callback and setup before releasing roots/resources.","file":"hub/test/claude-code-remote.test.ts","line":168},{"severity":"medium","text":"M2: the claimed Mac5/5 table is an authored summary without durable raw command/native terminal outputs, per-round source/tree identities or captured worker-birth/liveness/stop/join receipts. Preserve it as reported historical attempts, with these limits; obtain fixed-reviewed-head retained evidence after correction before treating the Mac portion of C1 as proved.","file":".cland/artifacts/A-22712-t-2066-deterministic-reds-and-5-5-loaded-macos-cases.md","line":18}]
finding_counts: {"high":0,"medium":2,"low":0}

A-22713 records two medium findings, confirmed by lead e7d654b4. M1 upgraded native callback directly acquires and joins outside an encompassing owner; sshHostFixture's work only covers enrolled sequences. Add whole-case ownership before acquisition, named setup and positive close controls while retaining all behavior assertions. M2 A-22712 lacks durable raw command/native exit, per-round source and worker-birth/lifecycle receipts; preserve as reported historical attempts, not reconstructed proof. Fresh fixed-reviewed-head Mac campaign and Linux remain pending after corrected source clearance and fresh grants. Timestamp producer capture+25ms regression and shared15s browser wait are sound. No separate late-spawn finding: this fixture's no-hold spawn precedes dispatch return; helper's captured-birth receipts remain. C1/C2 failed, none verified. Read-only review, no execution/edit; hold releases for consolidated correction/fresh review. No dev merge/full task suite requested.

Criteria: C2 failed (The upgraded callback/new hook join lacks encompassing pre-acquisition cancellation ownership, separate setup bound and positive close-gated release.), C1 failed (Mac5/5 is retained only as an authored table; raw command/source/load/worker lifecycle receipts are unavailable, so fixed-head proof remains unestablished.).

### impl-2066 · 2026-11-24T00:42:48.601Z

M1 corrected using stageCase native whole-caller ownership before acquisition, separately bounded setup, proxied fixture hooks and adopted roots, with required hook-exit and hub-stop receipts captured within acquisition. Existing case-deadlines TestContext-abort held-write/rejected-close controls exercise this owner. Full lint and typecheck exited 0 sequentially. M2: A-22712 remains historical reported attempts, not retained fixed-head proof; fresh raw campaign awaits new source clearance and slot. No dev merge.

### rev-35 · 2026-11-24T00:45:06.389Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2066-source-2
commit: 00393392b4f97c740bbe0882e8b90623610ec97e
scope: full
findings: [{"severity":"medium","text":"M1 residual: remoteClaudeFixture(owner.fixtures) registers its SSH/fake/resource teardown as ancillary stageCase hooks. Rejected ancillary cleanup sets cleanupSettled=true, while confirmed() covers only initial-hook join and hub.stop after full acquisition. Returned or partial resource closure can remain unconfirmed when outer root/restoration admission is released; enroll all writer/resource closure in required positive receipts before disposal/restoration and cover rejection through the actual adapter.","file":"hub/test/claude-code-remote.test.ts","line":172}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22714 records one medium residual M1, confirmed by lead4910bd97. Original callback ownership, named setup and admitted body/join are resolved. However remoteClaudeFixture(owner.fixtures) routes SSH/fake/resource teardown through ancillary hooks; stageCase sets cleanupSettled after collecting their errors, while required confirmation covers only initial hooks and returned hub.stop. Partial/other resource close can remain unknown at outer restoration/root admission. Adapt actual resource closure into positive required receipts separately from disposal and cover rejected/then-confirmed cleanup through that adapter. Shared required-close tests are narrower. Timestamp/browser fixes remain sound. M2 is explicitly deferred fixed-reviewed-head campaign, not reconstructed proof; C1 stays unverified. C2 failed; no verification/execution at this head. Read-only review; hold releases for consolidated correction and fresh source review, no dev merge/full task suite requested.

Criteria: C2 failed (SSH/fake/partial resource closers remain ancillary hooks; their rejection is not a required positive-close fence for outer root/restoration release.).

### impl-2066 · 2026-11-24T00:48:13.902Z

Coordinator decision 89087b41 approved the scope split: all hook/source-owner edits and their guide reverted to original base byte-for-byte. Net diff contains only producer timestamp capture plus retained clock regression and shared load-scaled browser boot wait, with two per-file guides. Fresh full lint and typecheck exited 0 sequentially. Historical A-22712 is not fixed-head raw proof. Fresh reviewed-head cases 1/2 campaign and Linux verify pending.

### rev-35 · 2026-11-24T00:49:51.496Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2066-source-3
commit: 7921d8a59f53078b258752d20f55cc3b154ab2c1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22715 records narrowed source clear per Coordinator89087b41. Hook test and guide exactly match original base blobs d7aeb7a7/aeddb278; prior M1 is split out, not fixed/disproved here. Net four-file diff retains only producer timestamp capture plus25ms FakeClock regression, shared waitTimeoutMs(15000) boot-row wait, and their guides. All coverage/provenance/selection and booting/placement/departure assertions remain. Shared browser wrapper forwards explicit options without multiplying this wait again. C2 verified against narrowed criteria; C1 remains pending fresh fixed-head raw Mac5/5 for cases1/2 and same-head Linux mode-free result. A-22712 remains historical narrative, not current-head proof. Full lint/typecheck are producer-reported green. Read-only review/no execution; hold releases for authorized campaign/verify workflow, no new source/dev merge/full task suite/hook experiment requested.

Criteria: C2 verified.

### impl-2066 · 2026-11-24T00:56:01.662Z

A-22716 retains path-redacted raw fixed-reviewed-head macOS cases 1/2 5/5, native-close/source/load/worker receipts and capture source; scan passed after documented private-path redaction. One authorized mode-free verify admitted: 9e0f3c9c-50a0-4474-b02a-8866c9b925b7. Local T0 exited0 (54.952s), verify window released. Linux runtime result pending; no full pass claimed.

### rev-35 · 2026-11-24T00:56:54.825Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2066-mac-evidence-1
commit: 7921d8a59f53078b258752d20f55cc3b154ab2c1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial Mac evidence clear, not final task settlement. A-22717 independently checks A-22716's10 native command launches/closes(code0,signalnull), exact generated passes and terminal summaries: narrowed cases1/2 each5/5 at7921d8a59. All22 source snapshots clean/sameheadtree,20 liveness views match7 native worker births;7SIGTERM closes and final joined receipt precede scratch removal. This is the granted seven-worker added-stress campaign: actual one-minute readings1.40234–3.40967, with a single after-command/before-stop697%CPU ps sample, not per-round CPU or loadavg7/8. All5Web browser census receipts showafter0/scratch hubstopped; isolated mac-arm64 Headless1248/CfT156.0.8078.4,Node24.21.0.11 redacted-file SHA256 receipts match. M2 new fixed-head Mac proof resolved; A-22712 stays historical with missingprovenance limits. C1 remains unverified pending admitted Linux9e0f3c9c; C2 sourceverified/done. Read-only audit, no tests/probes or additional run/source change requested.

### rev-35 · 2026-11-24T01:23:59.635Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2066-evidence-1
commit: 7921d8a59f53078b258752d20f55cc3b154ab2c1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final narrowed same-head clear; A-22719 consolidates source/A-22715, raw Mac5/5/A-22716 auditedA-22717 and completed Linux9e0f3c9c/A-22718. Exact paired Linux pass receipts: nightly timestamp0.362551893s, periodic sibling0.331160936s, Hosts boot1.779333715s. C1/C2 verified for cases1/2 only. Mac evidence is seven-worker added stress, actual command loadavg1.40–3.41 and single final697%CPU sample, not invented avg7/8/per-round CPU. Hook scope split per89087b41; restored base bytes/earlierM1 not claimed fixed. T0/all243T1/fallback445T2/selected7T3/55Web exit0;266T3 deferred,18T4 unexecuted. Aggregate7462tests/7461pass/1prerequisite skip/0fail/cancel/todo;5separate loaded skips,3existingF2finish-only entries separately accounted. Linuxc8sfo2 Node24.21/Nvim0.12.5 isolatedHeadless1248/CfT156.0.8078.4; report-only budgets/lint. Verification tree6d1bcf78 differs from Git14d3b414; cache null unknown. No findings, reviewer execution, additional run or source change requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T01:36:31.494Z

Merged 19d381e8a6edac66d2d19f91d876d58a11af7210 onto dev.
