---
id: T-1680
kind: task
title: A shared recording-Host test helper so Host doubles stay coherent when Host operations are added
state: open
status: in progress
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1624
branch: t/T-1680-a-shared-recording-host-test-helper-so
created: 2026-11-04T16:28:22.539Z
updated: 2026-11-18T11:36:23.137Z
---

## Summary

E-1532 stage 4 and stage 5 lost many verify and batch cycles to inline recording or observer Host doubles in hub/test that remap some Host operations and inherit others unmapped from `localHost` or the test Host:
- T-1644: `stat`;
- T-1606: `realpath`;
- T-1607: `launchClaude` and `adopt`;
- T-1605: the observation stream;
- T-1611: `publishFile`, a blanket read refusal, and a missing synthetic exit receipt.

Manual field-by-field sweeps kept missing one more. Proposed by impl-1611.

## What to build

A shared test helper that builds a recording Host from one scratch storage root and a set of scoped fault overrides. Every file-boundary operation (`publishFile`, `appendFile`, `writeFile`, `readFile`, `stat`, `realpath`, `makeDirectory`, `remove`) and the stop/exit receipt are redirected coherently. A contract check fails when the Host interface gains an operation that the helper does not map. Migrate the existing inline doubles to it, with every assertion unchanged.

## Acceptance criteria

- [x] C1. The helper maps every file-boundary Host operation and the stop/exit receipt into one scratch root, and a contract test fails if a Host operation is added without a mapping (test).
  - done: impl-1680 · 2026-11-18T11:31:53.903Z
- [ ] C2. The inline recording Hosts in hub/test are migrated to the helper with every test assertion unchanged, and their files pass (test).

## Comments

### impl-1680 · 2026-11-18T11:24:22.679Z

Consumer mapping, initial pass: Host interface unchanged by this item; new test-only helper consumed by hub/test/{adapter-generation,artifact-host,claude-code-host,claude-code-remote-files,codex-host,codex-remote-cleanup,executor-launch-boundary,host-attach-routing,host-launch-layout,launch-files,session-host}.test.ts (all T2), and worktree-host.test.ts (T3; native delegates explicit; run pending slot). New recording-host.test.ts is T2. Scanned Host field/interface names, localHost/testHost imports and spread-based uses, path.replace/root-to-storage remappers, recording/observer labels across hub/test. Production callers, shipped skill examples, QA briefs, startup probes and wire readers do not consume this new test-only contract; Host production shape is unchanged. Deliberate localHost native-contract subjects and testHost refusal/legacy-capability subjects remain unchanged. host-survival.test.ts migration waits for T-1679; opencode-host.test.ts waits for T-1672 (also adding Host operations). Assertions preserved. Current native worktree run is not executed.

### impl-1680 · 2026-11-18T11:25:36.587Z

Coordinator decision 35b02908: opencode-host.test.ts stays out of this migration, left for after T-1672. Whichever item lands second maps T-1672's moveDirectory operation. T-1680 proceeds without holding for that overlap. host-survival.test.ts remains deferred until T-1679 lands. Worktree observer doubles use shared scratch files with explicit native Git worktree/occupant delegates; native-contract subjects are retained.

### impl-1680 · 2026-11-18T11:36:23.137Z

Added migration: hub/test/host-survival.test.ts (T2), after merging origin/dev de3eceb22. All 22 tests pass locally on Darwin arm64 / Node 24.21.0, no native child; every assertion retained. Optional recording callback observes default Host operations so the no-stop/no-local-probe observer assertion stays meaningful; custom fault overrides retain their existing observation receipts. Refreshed recording-host.test.ts 4/4 green. T3 worktree-host still unexecuted pending Coordinator's native slot; configured verification and source review not run.
