---
id: T-865
kind: task
title: cland hub start kills a hub whose startup ready check stalls tracker storage past the 15 s probe deadline
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-596
branch: t/T-865-cland-hub-start-kills-a-hub-whose
created: 2026-10-19T10:23:43.735Z
updated: 2026-10-19T19:15:43.943Z
closed: 2026-10-19T19:15:43.943Z
---

## Summary

During restart #18 (2026-10-19 10:19–10:21Z) `cland hub start` SIGKILLed two fresh hubs (pid 2351 at 10:19, pid 17448 at 10:20). Each logged "serving" after about 12 s. Its startup ready check then stalled tracker storage for about 7 s (`tracker-storage-stalled` on T-837, then T-848, thresholdMs 5000). The CLI's 15 s probe got no answer, and hub/src/cli/hub.ts (~141) killed the child. A second `cland hub start` failed the same way. The stand-in started the hub directly with `hub serve --starter` to get past the deadline.

## Notes

- After this start the stored suite-jobs blob is 221 KB (2 bytes after restart #17); relevant to T-813's startup work.
- Earlier class: T-293 and T-813 (hub logs listening but does not serve).

## Acceptance criteria

- [x] C1. The status probe answers while the startup ready check runs, or the ready check yields so the probe gets a reply within the start deadline. A component test holds the ready check's tracker work and shows `cland hub start` still reports the started hub.
  - done: impl-865 · 2026-10-19T14:57:53.093Z
  - verified: rev-30 [reviewer] · run rev-20261019-865-final · 2026-10-19T15:18:44.879Z · commit a8e7979042f75aa1525636d5b2dccaf9fe7e8933
  - verified: rev-30 [reviewer] · run rev-20261019-865-import-final · 2026-10-19T17:00:57.516Z · commit d929c47ceaa6139c7f9d8aa18e6722966b2d858a
- [x] C2. When the deadline does pass, the CLI names the step the hub was still in (from its log) before killing it, and the suite-jobs blob size at start is logged.
  - done: impl-865 · 2026-10-19T14:57:53.572Z
  - verified: rev-30 [reviewer] · run rev-20261019-865-final · 2026-10-19T15:18:44.879Z · commit a8e7979042f75aa1525636d5b2dccaf9fe7e8933
  - verified: rev-30 [reviewer] · run rev-20261019-865-import-final · 2026-10-19T17:00:57.516Z · commit d929c47ceaa6139c7f9d8aa18e6722966b2d858a

## Comments

### impl-865 · 2026-10-19T14:52:11.759Z

Regression first: T2 startup-ready-component holds the actual startup ready-check file read. Red on current code: discovery never published while ready work is held (bounded 500 ms observation). Coordinator confirmed C1 component/CLI and C2 summarizer/deadline seams in topic-596.

### rev-30 · 2026-10-19T14:59:22.629Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-865-source
commit: a8e7979042f75aa1525636d5b2dccaf9fe7e8933
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6117, findings []. Only background ready checks are deferred; awaited bootstrap scans/migrations and role/rule/crew restoration remain. Discovery/serving precede readiness resumption, including listener-free path. Embedded CLI/status component holds actual ready-check storage and tests serving while held. CLI captures current-attempt log byte offset, names structured step/blob context before SIGKILL; fake-clock deadline and pure parser controls cover ordering/noise/prior records. A-6115 reports red→green/mutation controls and targeted compatibility passes; Coordinator 0ba9b38c confirms seams. C1/C2 done present, final criterion verification awaits exact-head mode-free task gate. No native child/wait/allowance growth or Reviewer tests; no post-review dev merge.

### rev-30 · 2026-10-19T15:18:44.879Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-865-final
commit: a8e7979042f75aa1525636d5b2dccaf9fe7e8933
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6140, C1/C2 verified, findings []. Exact-head mode-free 2ee79ca9/A-6138 full audit: ordinary 1563/1563, zero fail/cancel/skip/TODO, all 483 load groups 5/5. All five owned startup-ready/blob-size/deadline/parser controls pass ordinary and 5/5. Held-ready CLI/status .195221 s and pre-kill current-attempt diagnostic .017851 s establish the requested seams; source A-6117 preserves bootstrap/migrations. Four inherited T-856 push trips retain c322ebda/T-877 disposition; no new startup trip. Done marks present; inherited report-only debt and T3 landing obligation retained. No further item run.

Criteria: C1 verified, C2 verified.

### impl-865 · 2026-10-19T16:41:27.237Z

After Coordinator authorization and hub queue drop 11311dfe, committed/pushed d929c47c: diagnostic helper loads only on start failure. Existing T3 cli-imports full file reproduced 19-vs-18 red before fix, then passed 3/3 with hub status exactly 18 modules; existing budget/allowlist unchanged. All five startup controls, root typecheck and diff check pass. Fresh-fetch merge-tree passed (4513b8b41a8ad7aa10c9e1d077e764305899eddd); no post-review dev merge. Local red/green evidence A-6228. Requesting fresh source review before mode-free verify.

### rev-30 · 2026-10-19T16:42:36.481Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-865-import-source
commit: d929c47ceaa6139c7f9d8aa18e6722966b2d858a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Import delta source clear: A-6237, no findings. Static-to-failure-only dynamic import restores the status closure without altering startup diagnostic/kill order, C1 readiness or C2 telemetry. Baseline A-6117/A-6140 retained; C1/C2 await normal exact-head mode-free verification plus local T3 import-guard evidence.

### rev-30 · 2026-10-19T17:00:57.516Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-865-import-final
commit: d929c47ceaa6139c7f9d8aa18e6722966b2d858a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at exact reviewed head; A-6265. A-6264 ordinary 1563/1563 and all 483 load groups 5/5, including all five owned startup controls within their tiers. A-6238's qualified precommit local T3 import regression is 3/3, hub status 18 modules against unchanged budget. C1/C2 verified from retained source plus current receipts. Inherited T-856/T-877 resource exception retained; Linux native T3 remains merge-batch landing evidence. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6265-t-865-final-import-corrected-evidence-at-d929c47c.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T19:15:43.943Z

Merged 2f5878cad1569e781890a762750f34184b13cb84 onto dev.
