---
id: T-1557
kind: task
title: The adapters' boundary lint
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
  - T-1545
  - T-1547
  - T-1548
topic: topic-1318
branch: t/T-1557-the-adapters-boundary-lint
created: 2026-10-31T23:47:43.954Z
updated: 2026-11-02T03:19:06.408Z
closed: 2026-11-02T03:19:06.408Z
---

## Summary

A T1 lint keeps the adapters behind the Host. It fails when the sessions layer or an adapter spawns, kills, stats or realpaths a session's process or directory directly.

Hot files: `hub/test/host-boundary.test.ts` (new)

## Acceptance criteria

- [x] C1. The test fails when `sessions.ts`, `claude-code.ts`, `codex.ts`, `opencode.ts`, `opencode/server.ts` or `launch-files.ts` makes a value import from `node:child_process`, calls `process.kill` other than at the `CLAND_TEST_CRASH_AT` self-kills, or imports `pidAlive`, `processAlive`, `sameProcess`, `endProcess`, `processIdentityAsync`, `systemProcesses` or `sessionCwdRefusal` (test).
  - done: impl-1557 · 2026-11-02T02:05:06.112Z
  - verified: rev-36 [reviewer] · run rev-36-1557-final-1 · 2026-11-02T02:23:19.847Z · commit d858082a61b2f62cb8fbc9b63dfc6e1b5b47138e
- [x] C2. The test fails when `sessions.ts`, `claude-code.ts`, `codex.ts` or `opencode.ts` imports `stat`, `lstat` or `realpath` from `node:fs` or `node:fs/promises` (test).
  - done: impl-1557 · 2026-11-02T01:58:59.457Z
  - verified: rev-36 [reviewer] · run rev-36-1557-final-1 · 2026-11-02T02:23:19.847Z · commit d858082a61b2f62cb8fbc9b63dfc6e1b5b47138e
- [x] C3. The lint passes on the head, and fixture sources with one forbidden use of each kind make it fail, naming the file and the use (test).
  - done: impl-1557 · 2026-11-02T02:05:06.242Z
  - verified: rev-36 [reviewer] · run rev-36-1557-final-1 · 2026-11-02T02:23:19.847Z · commit d858082a61b2f62cb8fbc9b63dfc6e1b5b47138e

## Comments

### impl-1557 · 2026-11-02T01:56:03.680Z

Audit/seam: recursively scan hub/src/adapters, excluding *.test.* and named native implementation files processes.ts, session-cwd.ts, claude-code-local.ts. Remaining hits: sessions.ts two CLAND_TEST_CRASH_AT self-kills; launch-files.ts stat(path) in hubFileMeta for hub-owned rollback; opencode/server.ts stat(files.log) for hub-local log offset; launch-files.ts type-only ChildProcess import. All other process/fs bypasses flagged. Fixtures exercise lint diagnostics without mutating real adapters. No runtime/wire contract changes. T1 test is explicitly enforcing under C1–C3 (rule 27 item exception).

### impl-1557 · 2026-11-02T02:00:38.455Z

Source review requested on pushed 71ec9826b23b0621804d02b75f073c08c161eadc. Audit/red-green evidence A-15519. Local Darwin arm64 Node v24.21.0: 9 boundary tests pass, full npm run typecheck exit 0, exact-head npm run test:lint exit 0 / 0 refusals (existing advisory findings retained). Fetched/merged origin/dev before first review, merge-tree clean. Awaiting source verdict before mode-free verification; stage QA remains after-stage.

### impl-1557 · 2026-11-02T02:01:12.916Z

Correction superseding the initial audit note's rule-27 sentence: per Coordinator decision 24c7ee88-e1d0-424a-aa5c-5117fa8d3d3b, this is an ordinary enforcing T1 boundary/source-invariant test with named exceptions, as C1–C3 request; it is not a rule-27 gate or exception. Guide wording corrected. Runtime/test implementation unchanged.

### rev-35 · 2026-11-02T02:02:21.511Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1557-source-1
commit: 9e81868f15e4c2a8d0d9f37c4c8f1d48a2a1a4ff
scope: full
findings: [{"severity":"low","text":"The native-helper namespace regex also matches the substring lock in shared/clock.ts, so a safe namespace clock import gets a Host-bypass diagnostic. Narrow actual native-module matching and retain a harmless clock namespace fixture; current named clock imports are unaffected.","file":"hub/test/host-boundary.ts","line":62}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low finding; no high/medium. Recursive AST scan, audited named native/file/crash exceptions, all9 positive/negative fixture tests, tier/docs/skill reviewed. Low host-boundary.ts:62 overbroad lock substring flags shared/clock.ts namespace imports. Coordinator cd419f5f confirms ordinary enforcing T1 source invariant, not rule27 gate; replacement guide/item correction retained. C1–C3 runtime unverified pending exact-head queued mode-free run and named9 outcomes; local identical-code/static receipts supplemental only. A-15522 contains both review axes and limits. No Reviewer execution/browser/edits; QA full after-stage separate.

### rev-36 · 2026-11-02T02:04:09.590Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1557-source-1
commit: e8cb67e1a2088fe6ce04d6fd05df386b69d032e3
scope: full
findings: [{"severity":"medium","text":"Narrow namespace regex omits system-processes.ts, the real exporter of endProcess/systemProcesses. import * as native from '../system-processes.ts'; native.endProcess(row,log) now yields no finding: no named imports, regex misses and visit checks no helper member calls. Old process substring caught this module. Keep clock allowed but cover actual forbidden-helper exporters (also project.ts pidAlive) or inspect accessed helper exports; add positive fixtures.","file":"hub/test/host-boundary.ts","line":62}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. Medium host-boundary.ts:62 narrows away real system-processes.ts exporter (endProcess/systemProcesses), previously caught by process substring. Namespace import plus native.endProcess now produces no finding: neither named-import nor regex/member visitor catches it. Keep clock harmless while covering actual native exporters or helper namespace access,including project.ts pidAlive; add positive fixtures. Prior full scanner/design/Coordinator source-invariant decision reviewed; no other findings. Pure regex/source inspection only,no test/browser/edits. Local reported10passes miss this case; fresh source review before verify.

Criteria: C1 failed (Namespace import from actual system-processes.ts exporter now hides forbidden endProcess/systemProcesses operations from the lint.), C3 failed (New harmless/native namespace matrix omits the real system-processes exporter, so its positive controls miss the introduced bypass.).

### rev-36 · 2026-11-02T02:05:41.793Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1557-source-2
commit: d858082a61b2f62cb8fbc9b63dfc6e1b5b47138e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear; Standards/Spec no findings. A-15523 medium and previous clock low resolved: imported namespace/default bindings checked against forbidden accessed helper names independent of exporter path; actual system-processes/project and future reexport now covered. New actual-exporter matrix covers property/literal-element accesses; harmlessclock/type-only controls retained. Existing named/native/fs/crash/narrow-exception/recursive cases unchanged; guide and Coordinator source-invariant interpretation reviewed. Reported Darwinarm64 Node24.21.0 eleven cases/typecheck supplemental,exact-head lint pending; no post-source suite yet. C1–C3 await exact-head mode-free verify/named11 outcomes. No Reviewer tests/browser/edits;QA after-stage separate.

### rev-36 · 2026-11-02T02:23:19.847Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1557-final-1
commit: d858082a61b2f62cb8fbc9b63dfc6e1b5b47138e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec no findings. Current sourceA-15525 unchanged. Independently streamed all11 generated host-boundary outcomes in A-15532: native/helper/kill/fs diagnostics,crash/file exceptions,type-only/text/dynamic controls,recursive current tree,planted nested bypass/correction,promisesalias,clock and actual exporter/reexport cases allpass. C1–C3verified. Exact-head d9aba959 exit0,4660pass,zero fail/cancel/skip/todo;uncachedLinuxx64 dropletNode24.21.0/Neovim0.12.5,isolatedHeadlessShell1248/ChromeTesting156.0.8078.4. T0,T1,fallbackallT2,Webcomplete;T3batch/T4unexecuted. Runtime advisoriesreportonly;boundary itself ordinary enforcingT1 perCoordinator. Premergebatch/after-stageQA separate;no Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-02T03:19:06.408Z

Merged e061c395520bce620bc70747ec894cc573da6ac5 onto dev.
