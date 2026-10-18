---
id: T-773
kind: task
title: Suites, executor, CLI and doctor T3 files move their rule tests to T2 under the same titles (A-4961 groups, ~70 s)
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-480
branch: t/T-773-suites-executor-cli-and-doctor-t3-files
created: 2026-10-18T04:49:25.413Z
updated: 2026-10-18T05:37:37.834Z
---

## Summary

This is a split of T-708, from its C1 inventory A-4961. It covers the "Suites and executor" group (42 files, 758.9 s) and the "CLI and doctor" group (31 files, 287.5 s). Scripted-provider replacement and refusal tables and queue/TTL rules move to T2 under the same titles. Worker, timeout, sentinel and watchdog claims stay native. The proposed removal is 70.4 s.

## What to build

Apply those rows of A-4961 exactly. Note in the audit which native files dominate the remaining seconds (suites and executor keep 691 s), as input for the T3 residual follow-up.

## Acceptance criteria

- [x] C1. Every "Suites and executor" and "CLI and doctor" row in A-4961 is applied or explicitly kept, with each moved test's title and assertion meaning unchanged, recorded as an audit artifact that lists the five slowest remaining native files with their seconds.
  - done: impl-773 · 2026-10-18T04:58:48.226Z
  - verified: rev-31 [reviewer] · run rev-20261018-773-source · 2026-10-18T05:13:28.015Z · commit 88f971c19605d0677b88dd8304335299c57fcc09
- [x] C2. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-31 [reviewer] · run rev-20261018-773-final · 2026-10-18T05:37:24.125Z · commit 88f971c19605d0677b88dd8304335299c57fcc09
  - done: impl-773 · 2026-10-18T05:37:37.604Z

## Comments

### impl-773 · 2026-10-18T04:58:47.681Z

C1 audit published as A-4964: all 73 assigned rows explicitly applied/kept; 22 unchanged titles mapped to lower-tier destinations; 70.405332s old T3 weight removed and 975.920048s residual. Native SSH-command assertions stay alongside native image/key-hook coverage. Typecheck, tiers, lint green. Nine-file Mac 5/5 serial series underway, loads sampled <15. No product source or duration allowance changes.

### impl-773 · 2026-10-18T05:11:10.906Z

Implemented and pushed 88f971c19605d0677b88dd8304335299c57fcc09. Final C1 audit A-4974 supersedes preliminary A-4964, accounting for all73 rows and22 exact titles,70.405332s old T3 weight removed and five slowest residual native files. A-4975 contains accepted50 whole-file receipts: nine changed test files5/5 plus unchanged native shared-defects-report5/5, all current test-source hashes and loads<15; six lower-tier enforced files pass with zero trips. Final typecheck/tiers/lint exit0. Exploratory reds disclosed, including caught Git and native fixture services. Production change is one optional reporter Git reader with unchanged native default; no duration allowance/baseline changes. T-684 remains unmerged. C2 awaits same-reviewed-head droplet receipt; no per-item QA.

### rev-31 · 2026-10-18T05:13:28.015Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-773-source
commit: 88f971c19605d0677b88dd8304335299c57fcc09
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-773 source review — clear

Head: 88f971c19605d0677b88dd8304335299c57fcc09.
Fixed point: af981f178edd32336eb7b058173273cb6c4a6bed.
Command: git diff af981f17...88f971c19605d0677b88dd8304335299c57fcc09.
Scope: full. Read-only review of the single implementation commit; no Reviewer execution, edits or delegation.

## Standards

No findings. Reviewed the new/changed tests against docs/agents/tests.md and the current lifecycle rules. Provider replacement/refusal/recovery tests use the real executor and scripted provider/transport with one complete FakeClock. Existing remoteWaits/drive advances only admitted executor delays; held retirement calls observe provider entry before advancing their deadlines. Barrier cleanup releases before hub stop/directory disposal.

Human queue/TTL tests retain real socket frames, explicit executor-start observations before semantic completion receipts, pre-release queue assertions and exact-head successful reports. The CLI executable remains the subject of documented cland subprocess calls; the heading fixture uses projectHub. Journal/shared-defect rules run without project services or caught native Git, and store persistence still reopens a real store in-process.

The sole production change adds an optional Git reader to reportSharedDefects. Its default retains the original executable, arguments, cwd,5000ms timeout,64KiB bound and trimming. Native provenance remains covered by unchanged shared-defects-report. No duration baseline, allowance, global timing or process-policy change.

Tiers delta is exactly three retags (cli T2; journal-flush/shared-defects T1) and two T2 additions. Native image bytes/key boot hooks and SSH command assertions, real hub stop/drain, cross-process lock recovery, shell/host deadlines, watchdog and sentinel lifecycle coverage remain in the native files. No new wall-clock wait or unjustified native process was introduced.

## Spec

C1 established. Independently checked A-4974:73 unique assigned rows,42 suites/executor plus31 CLI/doctor. All67 explicitly kept file sources are byte-identical to the fixed point. The six selected original files retain their22 exact moved/retiered titles; declaration comparisons found no missing original title. Reviewed the changed assertion lines and their semantic replacements, including real CLI exits retained where executable behavior is the subject, provider rollback tables, image/region refusals, journal/accounting/recovery assertions and queue order.

Independently recomputed old inventory weight1,046.325380s and removal70.405332s, leaving975.920048s. These are old inventory accounting values, not measured integrated savings. The five slowest residual native files and seconds are explicitly listed: orphan-servers80.778428, suite-runner78.554320, executor-run59.461995, suite-timeouts40.318853 and durations-runner40.105885. Residual work belongs to T-776; no blanket fake-worker replacement or unassigned retirement.

## Mac evidence

Independently audited A-4975 accepted.json against raw logs and committed source hashes. Fifty accepted serial whole-file invocations: nine changed test files5/5 plus unchanged native shared-defects-report5/5. Every accepted file hash matches this head. All220 executed cases pass; every summary has zero failures/skips/cancellations/todo, no late asynchronous failure diagnostics, peak admitted/sampled load11.14208984375 (<15). Exploratory reds/interrupted attempts are disclosed and excluded, not counted as green.

Six current lower-tier enforced files each have an exit0 receipt, no tier-mismatch line, and the final trip receipt is empty. Host typecheck, tiers, report-only lint and diff checks are retained in A-4975. Per-file Mac timings are documented there; they do not establish the pending droplet execution.

## Verdict

Source clear, verify C1 only. C2's Mac portion is established; final C2 verification waits for the mode-free diff-selected droplet receipt at this exact head. No verification has yet run. No per-item QA required. Do not merge dev or move the head without the applicable Coordinator instruction and fresh source review.

Standards:0 findings. Spec:0 source gaps; C2 runtime evidence pending.

Durable review: A-4980.

Criteria: C1 verified.

### impl-773 · 2026-10-18T05:14:20.409Z

Source clear rev-20261018-773-source / A-4980 at exact 88f971c19605d0677b88dd8304335299c57fcc09; C1 verified. Accepted mode-free droplet run b755eb77-c31f-4b03-b6df-81261e659b8a at this clean unchanged head. A-4981 dry run and A-4982 inclusion proof cover all nine touched test files plus native shared-defects-report (hub-only, 2 workers). C2 awaits actual same-head Linux receipt; no further source edits or dev merge planned.

### rev-31 · 2026-10-18T05:37:24.125Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-773-final
commit: 88f971c19605d0677b88dd8304335299c57fcc09
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-773 final exact-head evidence review — clear

Commit:88f971c19605d0677b88dd8304335299c57fcc09.
Scope:evidence. Source:C1 current under rev-20261018-773-source / A-4980.
Read-only audit; no Reviewer execution or source changes.

## Standards

No task findings. Source and branch head remain unchanged. The source review independently established the73-row disposition,22 retained titles, native seam coverage and optional Git-reader default preservation.

A-4975 Mac audit remains applicable: all nine changed test files5/5 plus native shared-defects-report5/5,50 accepted raw whole-file receipts,220 passing cases, zero failures/skips/cancellations/todo, matching committed test-file hashes, maximum admitted/sampled load11.14208984375. Six lower-tier enforced whole-file runs had zero resource trips. Disclosed exploratory reds were excluded.

## Spec and Linux evidence

Run b755eb77-c31f-4b03-b6df-81261e659b8a / A-4993 is passed, auto hub-only, exit0 at the exact reviewed commit. Independently checked the raw positive results and timing identities for all nine changed files plus unchanged native provenance. All40 top-level declarations execute positively; with four nested cases this is44 owned/supporting cases, none skipped.

Per-file top-level count and test seconds:
- cli:3 /1.352533509
- journal-flush:1 /0.021983692
- shared-defects:3 /0.037213084
- suite-human-component:3 /0.833599705
- executor-prepare-component:9 /3.281763991
- executor-safety-component:7 /2.584845895 (plus2 nested)
- executor-prepare:3 /10.688865433
- executor-safety:4 /31.940767174 (plus2 nested)
- suite-human:6 /13.437262899
- shared-defects-report:1 /6.316220738

All15 relocated new identities have5/5 load-gate receipts,75/75. The original native timeout/sentinel/watchdog/image/key tests and native shared-defect provenance execute in the same gate. C2's requested complete-file Mac and task-droplet execution are established.

Overall2133 tests:2128pass,0fail/cancelled,5unrelated prerequisite skips. Raw summaries reconcile as free209pass, machine1914pass+5skip, Neovim smoke5pass. Smoke completed in2.78s; this is hub-only plus smoke, not a full Neovim package claim. No known-failure exception is needed.

Linux x64, Node24.21.0, Neovim0.12.5,c-8 lon1,2workers; suite1227.13s, peak load7.06, droplet lifetime1304s,cost$0.0906. Report-only budgets and T3 ratchet remain diagnostic. One unrelated report-only resource trip in unchanged claude-code-schedule is separately reported to the lead for classification against T-747; no owned lower-tier file trips.

## Verdict

Final review clear; verify C2. C1 remains current from the source review. No additional task run or per-item QA requested. Claimant may refresh C2's done mark using the accepted receipt.
Standards:0 task findings. Spec:0 remaining gaps.

Durable review:A-4994.

Criteria: C2 verified.
