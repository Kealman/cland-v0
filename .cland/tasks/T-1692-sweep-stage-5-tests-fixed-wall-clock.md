---
id: T-1692
kind: task
title: "Sweep stage-5 tests' fixed wall-clock bounds: setup bounds from the shared budget, behaviour bounds named and kept"
state: open
status: review
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1394
branch: t/T-1692-sweep-stage-5-tests-fixed-wall-clock
created: 2026-11-05T17:20:46.506Z
updated: 2026-11-05T17:33:00.759Z
---

## Summary

Each E-1532 stage-5 cover pair has gone red on a different fixed wall-clock bound in a test added or changed in stage 5. The cover's load gate repeats these tests five times under load:
- cover 1: revoke, survival and reboot (T-1685, T-1686);
- cover 2: claude-code-remote:302 (T-1690) and the reboot CLI (T-1691);
- cover 3, macOS 2ffb2169 (A-16896): hub/test/launch-files.test.ts "rollback bounds a missing native exit receipt and fences undo and repeated stop until it resolves", whose test timeout is `{timeout:1000}`, timed out once in the load gate (4/5) at peak load 9.4.

Fixing these one per cover costs about two hours each. This item sweeps the whole class at once.

## What to build

In the test files the stage-5 load gate repeats, classify every fixed wall-clock bound as one of two kinds, and keep that distinction explicit in names:
- **Setup / harness bound** (test timeout, readiness, initial turn, producer or fixture setup): derive it from the shared native setup budget, with each test timeout above its setup budget plus the test's own work.
- **Behaviour bound** (a product deadline, settlement bound, "refuses within N", or a post-signal check): keep the value, and name it as a behaviour bound.

Files, from the load-gate sets in A-16869, A-16872 and A-16896: host-revoke, host-ref-watch-recovery, host-settlement, host-flush, process-identity, claude-stop, host-reboot, host-reboot-controller, codex-host, host-attach, claude-code-remote, opencode-host, host-ref-watch-compat, host-attach-routing, host-push-on-ref-move, host-flush-native, host-survival, launch-files, host-push-facts, host-contract-coverage, host-boot, host-boot-source, claude-stop-owner-component, host-local-contract, claude-capture-concurrency, host-survival-native, host-revoke-native, host-reboot-native. Fake-clock tests whose wall timeout guards a hang may keep a small bound, but at least 5× their unloaded duration.

## Acceptance criteria

- [ ] C1. Every changed bound is listed with its old value, new value and its class (setup or behaviour), and no behaviour bound or assertion is changed (evidence).
- [ ] C2. Every listed file passes 5/5 locally under heavy CPU load on macOS (load 12 or more) and in a Linux container run with `docker run --init` (evidence).

## Comments

### impl-1692 · 2026-11-05T17:22:34.336Z

Audit in progress: all 28 listed files inspected for test envelopes, eventually/AbortSignal waits, helper defaults and fake-clock timers. Setup literals will use shared testWaitMs; post-signal receipt deadlines retain exact values with explicit comments. No production edits or assertion changes.

### impl-1692 · 2026-11-05T17:26:55.818Z

Extreme-load batch0 failure retained as artifact A-16897. Coordinator decision79bcc3f7 authorized test-only diagnosis; c43851b16 replaces unrelated real-clock1ms guard in scripted Claude capture with shared setup budget. Persistent case still asserts null, exactly two reads and zero signals; fake-clock deadline cases unchanged. Fresh review requested. Restarting all C2 evidence at target12–15 with10 yes burners; Linux docker --init remains pending.

### rev-35 · 2026-11-05T17:33:00.759Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1692-source-1
commit: 7f40bc776b8dbc25c17d37c241806c9b4d3081d0
scope: full
findings: [{"severity":"low","text":"git diff --check reports a new blank line at EOF; the testWaitMs import is appended to the final test terminator at line 554. Move the import beside the other imports and remove the extra blank line in the next source pin.","file":"hub/test/claude-code-remote.test.ts","line":555}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear; A-16898 records the full standards/spec review. All 770 assertion calls in 17 edited test files are byte-identical to base; no production changes, retained publication/post-signal/fake-clock deadlines, explicit setup helper budgets and corrected reboot CLI/owning guides checked. Coordinator-authorized real-clock Claude identity-test headroom is separate from unchanged fake deadline assertions. C1/C2 remain unverified pending completed loaded campaigns, final measured allowance head and configured exact-head receipt. A-16897 remains failed partial evidence. No Reviewer test/native/browser execution.
