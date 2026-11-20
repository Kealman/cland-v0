---
id: T-2026
kind: task
title: fake-claude-cleanup reads the worker's session marker before it is fully written (stat then read, non-atomic write)
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-1675
branch: t/T-2026-fake-claude-cleanup-reads-the-worker-s
created: 2026-11-20T03:46:30.294Z
updated: 2026-11-20T05:17:27.234Z
closed: 2026-11-20T05:17:27.234Z
---

## Summary

`hub/test/fake-claude-cleanup.test.ts` "orphan sweep joins a fake Claude session after its fixture worker is killed" failed in T-1873's merge batch 407e9d64 (log A-22075, Linux, peak load 11.3) with `SyntaxError: Unexpected end of JSON input` at line 105. The worker writes its session marker with a plain `writeFile`, and the test waits only for the file to exist (`fs.stat`) before reading and parsing it. Under load the read can land between create and write, and gets an empty or partial file.

## What to build

Make the marker publication atomic, by writing a temporary file and renaming it, or make the test wait for a complete, parseable receipt rather than the file's existence. Keep every assertion.

## Acceptance criteria

- [x] C1. A held write between the marker's create and its content, done deterministically, makes the current test fail and the fixed test pass (test).
  - done: impl-2026 · 2026-11-20T03:49:24.696Z
  - verified: rev-35 [reviewer] · run rev-35-2026-evidence-1 · 2026-11-20T04:02:56.484Z · commit 71cebd1add730ece422311b9841f50892d86c31d

## Comments

### impl-2026 · 2026-11-20T03:48:54.705Z

Consumer audit: launched.json is local to the worker-death test; no production, skill, QA, persisted reader or other-tier consumer found for that path or worker receipt name. Same-file session.json is read only after worker.closed, so its plain write is complete. hook-pid is written synchronously before late-hook.log is appended; waiting for that log precedes reading hook-pid. polls.jsonl stat in setup-rejection case has no subsequent parse/read; other polls waits inspect matching content. fakeClaude jobs and writers JSON use writeJson or registerWriter temp+rename; census/harness readers select only .json. Remaining stat calls assert post-cleanup absence or held-home presence, not content readiness. No shared production contract changes; no T1 file is reachable from this test-only diff.

### rev-35 · 2026-11-20T03:54:50.540Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2026-source-1
commit: 71cebd1add730ece422311b9841f50892d86c31d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 71cebd1add730ece422311b9841f50892d86c31d (Git tree 1d029f9ced1c3ddb9766de22e4c18175460819d1). Standards and spec review: the worker holds an empty temporary marker, the parent positively observes that hold and public-path absence, and the worker closes the complete JSON before atomic rename. Existing native lifecycle, SIGKILL, orphan-discovery, guarded-removal and final census assertions remain. The encompassing owner joins the worker and discovers/stops detached descendants before root disposal, including failure during the hold. Marker consumers and file guidance remain compatible. No high, medium or low findings; A-22079 records the review. C1 remains unverified pending configured verification at this exact head. A-22078's old direct-publication red and local macOS full-file 12/12 green remain separate local evidence, with their stated provenance limits; no configured, loaded, Linux or browser execution is claimed by this source pass.

### rev-35 · 2026-11-20T04:02:56.484Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2026-evidence-1
commit: 71cebd1add730ece422311b9841f50892d86c31d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged source-reviewed 71cebd1add730ece422311b9841f50892d86c31d; C1 verified. A-22083 audits producing run 14c29f67/A-22082, task finished/passed. All 2246 unique structured start/finish pairs match: 2008 generated-case passes (2001 top-level/seven nested), 238 file passes, no fail/cancel/skip/unknown. Exact held-marker orphan-sweep case passes once at log 10937 (2.807831646s); all ten top-level/two nested cleanup cases and final zero census pass. All 236 T1 files, changed T3 file and five-case Web smoke executed; selected T2 phase has no test cases, no load repetitions, 271 other T3 batch-deferred and 18 T4 unexecuted. T0 npm run check exits0; host typecheck explicitly not repeated on droplet. Linux x64 c-8 ams3 Node24.21/Nvim0.12.5, cached:null, Chrome Headless Shell1248/Chrome for Testing156.0.8078.4. Canonical verification tree d8aa02c2 differs in identity kind from Git tree1d029f9c. Advisories report-only; no changed-file allowance. A-22078's old deterministic direct-publication red and local Mac green retain their stated synopsis/provenance limits and are separate from this run. No new execution performed by review; no findings.

Criteria: C1 verified.

### coord · 2026-11-20T05:17:27.234Z

Merged 3d149a00b1c4c8b66bdb1066d8ab51a9d697bbf4 onto dev.
