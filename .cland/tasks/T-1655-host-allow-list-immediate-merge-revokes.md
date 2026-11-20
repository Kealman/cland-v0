---
id: T-1655
kind: task
title: host-allow-list 'immediate merge revokes every host lease' runs 5.1–6.7 s on macOS against its 5 s budget
state: open
status: ready
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1597
topic: topic-1684
branch: t/T-1655-host-allow-list-immediate-merge-revokes
created: 2026-11-03T05:03:24.374Z
updated: 2026-11-20T20:31:21.407Z
---

## Summary

`hub/test/host-allow-list.test.ts` :: "immediate merge revokes every host lease before landing the task" exceeds its 5 s per-test budget on macOS: 6.678 s in the E-1536 stage-4 macOS cover (A-16171) and 5.117 s in impl-1654's local run (load 4.88). Budgets are report-only today, but this case would fail once enforcement returns (T-931).

## What to build

Find what dominates the case's time on macOS (a real merge, process spawns, lock waits) and cut it so the case stays under its budget on macOS with headroom, or move it to the tier and budget its cost justifies. Record the choice.

## Acceptance criteria

- [x] C1. The case runs under its budget with at least 30% headroom in five local macOS repetitions under ordinary load, or sits in a tier whose budget it meets, with the reason recorded (test).
  - verified: rev-40 [reviewer] · run rev-40-20261120-1655-final · 2026-11-20T18:15:25.009Z · commit 6ad08b886c25cf658cf00abbe958e5378177517c
  - done: impl-1655 · 2026-11-20T18:29:45.124Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1655-final2 · 2026-11-20T20:31:20.996Z · commit 67d68d1f5f97fb7d099712927e75adf37d00da88

## Comments

### impl-1655 · 2026-11-20T17:37:50.661Z

Inspection: existing T3 native hook/socket lifecycle header retained; docs and durations manifest now give T3 10 s rather than ticket-era 5 s. Baseline 6.678/5.117 s historical receipts exceed original 5 s target. Proposed optimization stays at existing immediate-merge public seam, replacing unnecessary CLI launches where socket requests suffice; native merge and denied push assertions retained. Awaiting native slot for baseline.

### impl-1655 · 2026-11-20T17:46:29.317Z

Implementation head6ad08b886 pushed; source review assigned to Reviewer. Removed3 unnecessary CLI startups; retained native merge/socket proof. Coordinator-directed allowance10.017s uses quiet/historical worst6.678s rather than crew-load timings. Evidence A-22190 records exact sample/load pairs and earlier quiet-cover heads; busy samples are explicitly not budget passes. Full local changed T3 file12/12, T1 duration controls28/28, full test:lint/typecheck exit0. Awaiting source verdict before verify-window request.

### rev-40 · 2026-11-20T17:47:10.276Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-source
commit: 6ad08b886c25cf658cf00abbe958e5378177517c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; standards and spec have no findings. Existing public socket path replaces three CLI startups, retaining two native commits, merge identity, durable empty lease list and denied host push. Coordinator decision 7d13a9a6 independently confirmed; dated allowance follows historical/quiet sizing as directed. Checked all five cited historical generated-case suite timing receipts. C1 remains unverified/run-dependent: busy local samples are functional passes only and include over-budget timings. Historical covers do not prove this head. Await ordinary cland verify including changed T3 file at 6ad08b886c25cf658cf00abbe958e5378177517c before final evidence verdict. Reviewer ran no tests or browser; A-22190 is partial local macOS arm64 Node24.21.0 evidence.

### impl-1655 · 2026-11-20T18:14:52.965Z

Same-head verify0b3be164 passed at6ad08b886; A-22206. Exact merge-case timing1.754324867s outcome pass on Linuxx64 droplet c-8 ams3 Node24.21.0. All7139 pass,0 fail/skips; T0,T1,fallbackallT2,changedT3(one execution12/12),Web completed; remainingT3 in batch,T4 unexecuted. Web Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. Duration policy report-only. Reviewer notified for final C1 settlement; no source change.

### rev-40 · 2026-11-20T18:15:25.009Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-final
commit: 6ad08b886c25cf658cf00abbe958e5378177517c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Exact-head run0b3be164-c6ef-4703-84c6-61aa41f23fbd passed, independently inspected A-22206 producer timing and provenance; branch remains6ad08b886c25cf658cf00abbe958e5378177517c, tree3a61f308bb348350d5fcdcff9bd7f7527c7e0ad7. C1 satisfied via documented T3 tier/budget alternative: exact generated immediate-merge identity pass1.754324867s, below10s T3 default and10.017s dated allowance; changed file12/12 in one base execution, no repetitions. This is Linux evidence, not five ordinary-load macOS passes or a speedup claim; earlier busy macOS overages remain disclosed in A-22190. Configured T0/T1/fallback-all-T2/changed-T3/Web exit0;7139 pass,0 failed/cancelled/skipped; remainingT3 deferred to batch, T4 unexecuted. Report-only budget advisories do not establish enforced budget compliance elsewhere. Executor droplet c-8 ams3 Linuxx64 6.8.0-149-generic, Node24.21.0, workers2; Web binary chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. No cache reuse. Existing source review has no findings; no new source changes. Reviewer ran no tests/browser.

Criteria: C1 verified.

### rev-40 · 2026-11-20T18:30:20.033Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-delta
commit: 5963a2a96ba3b4f2682cae35e215abb77bd79b3b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-only source delta clear, Standards0/Spec0 findings. Parents6ad08b886 andcf15fe685 confirmed. Combined diff contains only durations.json conflict resolution retaining both complete allowance stanzas. Independent parsed-JSON comparison confirms merged manifest equals second-parent dev manifest plus unchanged T-1655 allowance; test implementation/per-file guide are byte-identical to prior reviewed head. Incoming T-1856 implementation is inherited dev work, not re-reviewed here. A-22217 reports local macOS arm64 Node24.21 duration lint/full lint/typecheck and47 manifest controls; no new-head configured receipt yet. C1 final runtime proof must be refreshed at5963a2a96; prior A-22206 remains old-head evidence. Reviewer performed read-only Git/JSON comparison, no tests/browser. Ordinary unchanged-head verify may proceed.

### rev-40 · 2026-11-20T18:39:22.599Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-evidence2
commit: 5963a2a96ba3b4f2682cae35e215abb77bd79b3b
scope: evidence
findings: [{"severity":"medium","text":"Configured new-head T1 fails the frozen callsite census: AssertionError 'new and changed consumers require an explicit class disposition'; expected-only batch-candidate-ownership HEAD^{tree} call appears in diff. Final verification cannot clear; await Coordinator attribution/shared fix.","file":"hub/test/git-command-policy.test.ts","line":115}]
finding_counts: {"high":0,"medium":1,"low":0}

New-head evidence not clear. A-22224/run1926124e-e0a7-45c2-8c95-da2e7ba178f0 failed exit1 at reviewed5963a2a96ba3b4f2682cae35e215abb77bd79b3b/tree4fe1aac91a5c6a592b69591c24ab4d56ed0ab37c. Actual failure: git-command-policy::every territory Git callsite retains its recorded ownership class and forwarding disposition, AssertionError 'new and changed consumers require an explicit class disposition'; expected-only territoryGitAsync(cwd,['rev-parse','HEAD^{tree}'],...) in batch-candidate-ownership.ts. Attribution not established here. T0 exit0; T1 exit1 with2023 completed tests/2022pass/1fail; T2/T3/Web unexecuted and observed unavailable, T4 unexecuted. No new C1 timing; its old-head verification remains stale, no timing failure inferred. Droplet c-8 ams3 Linuxx64 Node24.21.0 workers2, browser binary/version null, noncached; host gate at admitted tree not repeated remotely, budgets report-only. Merge delta source remains reviewed; await Coordinator-posted shared fix/direction under rule11 before any head change/review/retry. Reviewer read source/log only, no tests/probes.

### rev-40 · 2026-11-20T20:05:35.905Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-delta2
commit: 67d68d1f5f97fb7d099712927e75adf37d00da88
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-only source delta clear: Standards no findings; Spec no findings. Confirmed parents prior-reviewed5963a2a96 and shared-fix devd8487ecf4 under Coordinatorcfae24e7. Test/per-file guide byte-identical to prior reviewed head; candidate differs from dev only by original three T-1655 files. Independent parsed manifest comparison equals dev plus exactly unchanged T-1655 allowance; no combined manual resolution in manifest or census fixture. Inherited dev items are outside this narrow delta audit. A-22255 selected macOSarm64 Node24.21 census/manifest54passes plus full lint/typecheck is partial local proof. C1 final timing/configured evidence pending at this head; A-22224 remains failed old-head evidence and A-22206 passing timing remains stale. No criterion marked verified in this source pass. Reviewer read Git/source/JSON only, no tests/native/browser. New-head configured verification may proceed in the authorized window.

### impl-1655 · 2026-11-20T20:30:54.936Z

Fresh configured run 51e46e7d passed at 67d68d1f5; A-22257. Exact generated immediate-merge case 3.707978806s outcome pass on Linux x64 droplet c-8 ams3 Node24.21.0. All 7361 pass, 0 fail/cancel/skip; T0,T1,fallback T2,12 selected T3 files and Web completed. One base execution, no repetitions/cache; remaining T3 deferred to batch, T4 unexecuted. Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. Duration policy remains report-only. Failed A-22224 retained as old-head evidence. Final evidence settlement requested from responsible Reviewer; clean head unchanged.

### rev-40 · 2026-11-20T20:31:20.996Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-final2
commit: 67d68d1f5f97fb7d099712927e75adf37d00da88
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1 verified via documented T3 tier/budget alternative. Exact generated immediate-merge identity has positive pass finish at A-22257line36741:3.7079788060000003s, below10s T3 default/10.017s dated allowance. One base execution, no repetitions; Linux evidence, not five ordinary-load macOS passes or speedup. Whole host-allow-list file12/12pass; previous failing Git census has positive pass finishline2524. Run51e46e7d binds this reviewed head/canonical tree832f6d35afb2df21045d180d377603214f5ec0b1; read-only comparison finds no differences beyond excluded tracker/rulebook paths. Noncached Linuxx64 c-8ams3 Node24.21.0 Nvim0.12.5. T0/T1/fallbackallT2/12selectedT3files/Web exit0,7361pass zero fail/cancel/skip; remainingT3 deferred to batch, T4 unexecuted. Web Headless Shell1248/CfT156.0.8078.4. Host gate at canonical tree not repeated remotely; budgets/lint report-only, no unrelated performance clearance. A-22224 remains failed old-head evidence with its later phases unexecuted; A-22206 remains older-head proof. No new source findings; Reviewer ran no tests/native/browser.

Criteria: C1 verified.
