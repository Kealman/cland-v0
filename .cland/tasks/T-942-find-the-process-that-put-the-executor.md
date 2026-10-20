---
id: T-942
kind: task
title: Find the process that put the executor credential in argv (T-492 C3)
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - security
assignee: null
parent: E-952
blocked_by: []
topic: topic-723
branch: t/T-942-find-the-process-that-put-the-executor
created: 2026-10-20T06:21:21.658Z
updated: 2026-10-20T10:22:24.690Z
closed: 2026-10-20T10:22:24.690Z
---

## Summary

Split from T-492 at the v0.1.4 release (D76). T-492 stops every launched session and test process from inheriting the executor credential, and corrects the docs. Its C3, finding the process whose command line carried the credential, stays open: impl-455 saw it in a `pgrep -fl` listing of test:nvim npm processes on 2026-10-15, and impl-492 could not find the historical source at 5e4697e4.

## Acceptance criteria

- [x] C1. The process that put the credential in argv is named from a reproduction with a fake credential value (never the real one), or the evidence shows that no current cland or test path can do it (every spawn site that builds argv from env is listed and checked).
  - done: impl-942 · 2026-10-20T09:50:09.566Z
  - verified: rev-23 [reviewer] · run rev-20261020-942-source-corrected · 2026-10-20T10:06:59.135Z · commit 5012ed280a22c98e94597afaa4a3030f051f53b2
  - verified: rev-23 [reviewer] · run rev-20261020-942-final · 2026-10-20T10:16:30.937Z · commit 5012ed280a22c98e94597afaa4a3030f051f53b2
- [x] C2. If a path is found, it is fixed and a test with a fake credential asserts argv never contains it.
  - verified: rev-23 [reviewer] · run rev-20261020-942-source-corrected · 2026-10-20T10:06:59.135Z · commit 5012ed280a22c98e94597afaa4a3030f051f53b2
  - done: impl-942 · 2026-10-20T10:07:18.616Z
  - verified: rev-23 [reviewer] · run rev-20261020-942-final · 2026-10-20T10:16:30.937Z · commit 5012ed280a22c98e94597afaa4a3030f051f53b2
- [x] C3. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-942 · 2026-10-20T10:15:02.729Z
  - verified: rev-23 [reviewer] · run rev-20261020-942-final · 2026-10-20T10:16:30.937Z · commit 5012ed280a22c98e94597afaa4a3030f051f53b2

## Comments

### impl-942 · 2026-10-20T09:49:28.051Z

Audited launch/source inventory A-7283 (882 source files, 323 native calls across 167 files) and environment-to-command matrix A-7284, committed doc pending. Reproduced unsafe accountPrefix with test-token-not-real in attach shell argv; shared credential filter now runs before serializer reads values. Normal account selection only supplies path variables, so this is a defensive richer-overlay fix, not attribution of the historical npm listing. T1 red/green argv regression and targeted three-adapter launch/control/attach argv checks pass; machine transport fake-boundary checks pass. qaPolicy scope none; no QA criteria. Full static check in progress, source review next.

### rev-23 · 2026-10-20T10:01:51.286Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-942-source
commit: ce60e1f12fbac7e3f6d36749a679cd10f7f34c3b
scope: full
findings: [{"severity":"medium","text":"The saved-account/attach environment description lacks the executor-credential exception added by accountPrefix; docs/verification-shards.md:83 likewise omits attach serialization. Update those matching docs and link docs/executor-argv-audit.md in this item under rule 16.","file":"hub/README.md","line":826}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear for one Standards finding (M1); Spec source findings 0. A-7322 records the complete audit. The implementation correctly filters denied keys before reading account-overlay values and preserves quoting/input/DB selection. Added T1 fake serializer and injected Machine argv checks and strengthened three-adapter native checks look sound; full A-7289 is 65/65 targeted passes. Current-source env-to-command inventory alternative is supported within its explicit automatic-input scope; historical npm argv attribution remains unknown and must stay so. No additional current automatic provider-key-to-argv path found in source audit. C3 awaits clear changed-head source review and mode-free verify. Add main-doc policy exception/audit links, then send the new head; no verify before re-review. Reviewer ran no tests or credential/process inspections.

Criteria: C2 failed (Rule 16: document the changed attach-command credential filtering policy in the existing account/executor documentation and link the scoped audit.).

### impl-942 · 2026-10-20T10:03:00.444Z

Addressed source-review M1 at corrected head 5012ed280a22c98e94597afaa4a3030f051f53b2. hub/README.md account environment section and docs/verification-shards.md Executor credentials now describe shared denylist filtering before account overlays become attach shell argv and link docs/executor-argv-audit.md, preserving historical npm attribution limit. Docs-only changes since ce60e1f1; git diff --check passes. No dev merge after first source review (rule 11). Source re-review requested before verification.

### rev-23 · 2026-10-20T10:06:59.135Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-942-source-corrected
commit: 5012ed280a22c98e94597afaa4a3030f051f53b2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. M1 resolved: hub/README.md saved-environment section and docs/verification-shards.md Executor credentials now document deny-list filtering after account overlays and before attach command serialization, retained path selection/quoting, and the scoped audit with historical npm attribution unknown. Independently checked docs-only delta from ce60e1f1; implementation and tests unchanged. C1 verified through the current-source audit alternative (A-7283/A-7284; previous full source analysis A-7322), not historical process identification. C2 verified from unchanged filter/source and retained fake-only targeted evidence A-7288/A-7289 (65/65 local native tests); arbitrary user-supplied secret-bearing commands remain outside the automatic env-to-argv claim. A-7352 records the correction and evidence limits. C3 remains unverified pending mode-free verification at exact 5012ed28; no Reviewer tests.

Criteria: C1 verified, C2 verified.

### impl-942 · 2026-10-20T10:15:03.612Z

Exact reviewed-head mode-free verification b03995b6-1495-4781-b197-c7d35a553e2f passed at 5012ed280a22c98e94597afaa4a3030f051f53b2: T0–T2, fallback all T2 in both packages, 1948/1948 tests, zero failed/cancelled/skipped/TODO. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; droplet c-8 lon1 cland-v0-b57ce888, lifetime 347s, cost $0.0241. Test lint and T3 ratchet report-only. A-7394 log: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7394-suite-b03995b6-1495-4781-b197-c7d35a553e2f-auto-at-5012ed2.log. C3 claimant done mark added; awaiting Reviewer final evidence verdict. T3 absent from configured batch tiers and deferred to periodic/integrated occasions; retained local adapter contract A-7289 is separate targeted macOS evidence at unchanged source ce60e1f1, not this Linux task run. Historical npm credential argv attribution remains unknown; C1 uses scoped current-source audit alternative.

### rev-23 · 2026-10-20T10:16:30.937Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-942-final
commit: 5012ed280a22c98e94597afaa4a3030f051f53b2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining findings. Spec: no remaining findings. Same-head mode-free Linux run b03995b6/A-7394 is green: independently counted 1948 ordinary test passes, 315 file passes, no other outcomes; actual T1/T2 fallback across hub and Neovim. Account attach argv and machine argv regressions each have five distinct passing load-gate test receipts. Host typecheck gate 09ad445b was not repeated remotely; lint/T3 ratchet report-only. T3 adapter-native-boundary did not execute; local targeted A-7289 remains separate evidence, periodic/integrated coverage remains deferred. C1/C2 retain source-clear A-7352, C3 verified now. Historical npm attribution remains unknown and current-source audit excludes arbitrary user-supplied secret-bearing commands. Prior M1 resolved. A-7398 records actual tiers/platform/executor and evidence limits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T10:22:24.690Z

Merged d53dc9be33d4777a7c087704414bbb68d5d50f41 onto dev.
