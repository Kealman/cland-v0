---
id: T-1098
kind: task
title: Periodic dev culprit search refuses Web test files as invalid batch diagnostic files
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-968
branch: t/T-1098-periodic-dev-culprit-search-refuses-web
created: 2026-10-22T07:52:03.979Z
updated: 2026-10-24T12:42:55.476Z
closed: 2026-10-24T12:42:55.476Z
---

## Summary

The periodic dev T3 culprit search for run 5c6f3777 (A-9033, red head 74175ef9, last green 1b4291e6) reported `web/test/palette.test.ts: inconclusive (Error: invalid batch diagnostic files)`. `hub/src/hub/suites.ts` (about line 456) accepts diagnostic files only under `hub/test`, `hub/src` and `nvim/test`, so every Web-tier failure makes the search inconclusive instead of bisecting the merges. The culprit here was known (T-1095, fixed by T-1097), but a Web regression with no obvious author would go unattributed.

## Acceptance criteria

- [x] C1. A periodic dev culprit search whose failing file is a `web/test/*.test.ts` file runs the Web tier on the candidate merges, with the same path-safety checks, and names the first red merge (component test with a fake executor).
  - done: impl-1098 · 2026-10-24T11:57:27.285Z
  - verified: rev-23 [reviewer] · run rev-20261024-1098-final · 2026-10-24T12:34:08.545Z · commit 15e75e8e4247aecd77dccde805a7b85b12e4c31d
- [x] C2. A diagnostic file outside the allowed test roots is still refused with the existing error (test).
  - done: impl-1098 · 2026-10-24T11:57:43.126Z
  - verified: rev-23 [reviewer] · run rev-20261024-1098-final · 2026-10-24T12:34:08.545Z · commit 15e75e8e4247aecd77dccde805a7b85b12e4c31d

## Comments

### coord · 2026-10-24T07:18:02.231Z

Instance 2026-10-24 07:17Z: periodic dev T3 f00422cf red at 596def62 (last green de29dda8) on web/test/items.test.ts only; culprit search inconclusive with "invalid batch diagnostic files" (hub/src/hub/suites.ts:459 accepts only hub/ and nvim/ test paths). Actual cause found by hand: 04657810 (R-377 closed left no versioned open release), fixed by c4bd17b5. Log A-10360.

### impl-1098 · 2026-10-24T11:56:34.361Z

Implemented test-first at the existing scripted-executor component seam. Initial Web test reproduced `inconclusive (Error: invalid batch diagnostic files)`; now the Web probe delivers check+Web and bisects three candidate merges to the first red merge. Added refusal checks for outside-root, absolute, wrong-suffix and parent-traversal paths; the immediate traversal case was red before moving the existing guard before the prefix. Updated periodic/test docs and implement seam pointer. Before first review merged fetched origin/dev 512c4960; current head 15e75e8e4247aecd77dccde805a7b85b12e4c31d. Targeted local macOS component evidence only so far; full mode-free verification awaits clear source review. QA policy none/after-stage; no per-item brief required.

### rev-23 · 2026-10-24T12:03:56.878Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1098-source
commit: 15e75e8e4247aecd77dccde805a7b85b12e4c31d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1098 full source review — clear

Head15e75e8e4247aecd77dccde805a7b85b12e4c31d/tree497074596cd12b33de2f7950b42a7c72b11f833a. First review merged dev512c4960bb573e8df6e215de8bceb509af8e7d6a; parentsb233c387.../512c4960..., origin task ref matches. Fixed comparison git diff512c4960...15e75e8e. Scope full, run rev-20261024-1098-source, both axes in-session under Reviewer subagents=false; findings [].

Standards: clear. Diagnostic input allowlist remains anchored to test roots and .test.ts suffix, now includes web/test and moves the parent-segment negative lookahead before the root group. This closes the immediate '../' after root case as well as retaining nested-parent refusal. No outside/absolute/source/non-test path admission. Internal probe/job interfaces and role/CLI/dependency policy unchanged. Typed test fixtures preserve owned case deadlines and existing sealed projectHub/scripted-machine cleanup; no native Git/provider/browser or new hub process is added. Correct per-test path heading/index row and implement skill CHANGES accompany the new component guidance. No independent smell finding.

Spec C1 source-sound: Web diagnostic file membership or existing Web diagnostic step enables web:'all'; Web-only requests use tiers:[] and the existing shard package-suppression contract, so the delivered plan is check/Web rather than accidental hub/Nvim runtime phases. Mixed files retain their needed package selection, and empty files with an explicit Web step retain prior behavior. loadGate:false/soak:false remain. Existing DevT3Probes.probeResult independently requires a requested-file failure for red and complete passing requested-file execution for green; unrelated full-Web failures, missing/skipped/interrupted receipts cannot assign blame. Thus selecting the candidate Web tier does not turn an unrelated test result into culprit evidence.

The scripted component test seeds an executed green baseline/red tip, repeats red, verifies baseline green and probes an intervening three-merge range. It checks actual delivered check/Web plan, exact selection/files/no repetitions, requested-file semantic completion/failure receipts, first-red merge f... rather than red tip b..., one Bug with all provenance/run ids, Coordinator/live-last-claimant delivery and candidate cleanup/no duplicate filing. Existing flake and hub culprit cases retain final assertions.

C2 source-sound: outside root, absolute path, web source path, non-test suffix, immediate/nested traversal all reject with unchanged 'invalid batch diagnostic files'; no admitted job or acquired executor. Matching docs clearly say Web tier plus the requested file's own receipt, rather than pretending the executor selects only one browser file.

The temporary new component allowance3.4s belongs to open E-1194 (independently confirmed), added2026-10-24/expires2026-10-31. Reason explicitly cites local macOS1.524/2.263s passing samples and roughly1.5x headroom; no Linux timing/baseline fabricated. Summary reports later2.274s, still within3.4s. Preserve all samples in ready evidence and assess configured Linux results separately; no identity/workload/assertion reduction or old allowance rewrite.

A-10888 is a summary, not original native receipts. It reports local regression red invalid diagnostic files, separate traversal red missing rejection, targeted component5/5, merge-batches55/55 and npmcheck exit0/report-only lint133/zero refusals at reviewed head. Original command/output/exits/timings/source/platform preservation requested without reruns for transcription. No configured Linux/browser or whole-tier pass claimed.

C1/C2 explicitly require runtime tests, so remain unverified until configured same-head evidence. Source clear permits mode-free configured verification at exact unchanged15e75e8e, result to Reviewer/lead, then evidence review. qaPolicy none/after-stage, no per-item brief/criteria. Role clause unchanged per brief; downstream T-976 lane remains the lead's scheduling responsibility. Reviewer static Git/source/tracker/artifact reads only; no tests/probes/edits/install/Git mutation/browser/delegation. Standards0 findings; Spec0 findings.
Durable audit A-10904.

### impl-1098 · 2026-10-24T12:24:52.375Z

Same-head configured mode-free verify dc5e5853-d53f-47b4-8864-d1fb3670fd7a completed auto exit 0 at 15e75e8e: 2953/2953 passed, none failed/cancelled/skipped/todo. T0 + all T1 + fallback all T2 + Web on Linux x64 droplet c-8 lon1 (639 s lifetime, $0.0444); duration/lint/ratchet gates report-only, T3/T4 deferred. Both new identities have native 5/5 load receipts in A-10961. Evidence review requested from Reviewer after source clear rev-20261024-1098-source. Final conflict check fetched dev 1039defc with --no-auto-maintenance; merge-tree exited 0, prospective tree 1e3439a0. Reviewed head unchanged and clean; no post-review merge. Coordinator enqueues merge on ready.

### rev-23 · 2026-10-24T12:34:08.545Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1098-final
commit: 15e75e8e4247aecd77dccde805a7b85b12e4c31d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1098 final same-head evidence — clear

Head15e75e8e4247aecd77dccde805a7b85b12e4c31d/tree497074596cd12b33de2f7950b42a7c72b11f833a. Full source rev-20261024-1098-source/A-10904 stands unchanged. Scope evidence, run rev-20261024-1098-final; findings []; C1/C2 verified.

Configured mode-free dc5e5853-d53f-47b4-8864-d1fb3670fd7a / original log A-10961 finishes exit0 and task.view agrees on exact head. Native finishes2953ordinary passing tests/423passing files plus10additional load-gate test/file passes: two new identities each five repetitions. Zero failures/cancellations/skips. Actual phases hostT0, allT1(137files/848top-level tests), fallback allT2hub+Neovim(242files/1770top-level tests), fullWeb44files/225top-level tests. No T3/T4 command or whole-tier/stage pass claimed.

C1:first-red Web probe component passes0.91718407s plus5/5 (maximum1.432553676s). Accepted source asserts delivered candidate plan check/Web, exact requested file, complete requested-file receipts, red-head repeat, green baseline, two intervening probes, first-red merge rather than latest tip, single Bug/provenance/live-last-claimant delivery and candidate cleanup. These are scripted-executor component facts, not a planted real browser regression or production deployment of periodic search. Ordinary fullWeb phase is separate regression coverage.

C2:outside-root/absolute/source/non-test/immediate+nested-parent traversal refusals pass0.055719454s plus5/5 (maximum0.075648265s); unchanged error and no job/acquisition assertions remain. Existing hub culprit and flake cases also pass. Source keeps requested-file evidence classification, so unrelated all-Web failures cannot assign blame.

Retain the reviewed temporary allowance unchanged:
{"hub/test/dev-t3-search-component.test.ts::red periodic run runs Web probes and names the first red merge":{"seconds":3.4,"owner":"E-1194","added":"2026-10-24","expires":"2026-10-31","reason":"Four detached scripted Web probes plus periodic reporting and Bug filing prove first-red-merge attribution. Local macOS samples 1.524 s and 2.263 s; 3.4 s is about 1.5x the worst sample (T-1098)."}}
Linux largest passing repeated sample1.432553676s is below the2sT2 budget. No new allowance/baseline adjustment needed.

HostT0check31.04s exits0; gatee9a7a20c82468f93ce4e0108ba32e4250f67e9df independently is a Git tree, retained host gate not a repeated remote typecheck. T1/T2/Web envelopes59/336/149s differ from actualsuite54.91/332.19/145.11s and shard54.89/244.50hub+87.65Nvim/145.00Web. FinalWeb projection150.266s at2workers is not measured wall at4workers. Runtime Linuxx64 6.8.0-142-generic, c-8lon1 cland-v0-02390d74, Node24.21/Nvim0.12.5, configuredworkers2/Web4, lifetime639s/$0.0444; diskfsync8.14ms/SQLite10.06ms. Report-only lint133/60, unchangedratchet2195.304s and unrelated Web/scale/render overages remain visible, including Webwall145.11s over40s/items42.758s. Not an enforcing-tier-budget clearance.

A-10911 local retained command/stdout/exit/timing records distinguish dirty development from exact15e75e8e. Web passing2.262792792s occurred while the separate traversal case failed;1.523803958s belongs to fully green file and is distinct from earlier1.523521292s failed Bug-lookup invocation. Original Web admission/traversal reds and interim metadata/type failures remain visible. Exact-head component5/5 and checkexit0/zerolintrefusals are local, not Linux. Corrected batch stdout A-10913 restores original skipped-rerun430.131958ms copying error, superseding archivedA-10912;55/55f9a31bexit0/Node16907.688208ms retained. No evidence rerun or invented check wall time.

Implementer's final read-only conflict receipt names fetched dev1039defcfa6c68d941707d6ae0e6a72b74102ff4, merge-treeexit0/prospectivetree1e3439a09114cd16f619e3683a9648992d572a72; head/tree clean unchanged, no post-review merge. QA none/after-stage/no item brief. No landing/QA/stage closure claim. Reviewer static source/Git/tracker/artifact/log reads only, no tests/probes/edits/install/Git mutation/browser/delegation. Standards0 findings; Spec0 findings.

Final artifact A-10975: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10975-t-1098-final-same-head-evidence-verdict.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T12:42:55.476Z

Merged 2ec0b26f54a095d74ed82e22773773b8385325f2 onto dev.
