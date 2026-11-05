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
updated: 2026-11-05T19:33:19.006Z
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

### impl-1692 · 2026-11-05T17:55:55.367Z

C2 incomplete: first14 files5/5 macOS. Third batch failed push-on-ref-move repetition5 with typed producer-result-missing/native-cleanup-retained refusal, not timeout; prior4 passed. Other six files in batch4/5; last7 macOS/allLinux unexecuted. A-16903 holds exact failure/receipts. All burners joined and lock released. Question to lead T-1692 requests diagnosis decision under test-only scope; Linux also held for Coordinator cover sequencing. Clear source7f40bc776 unchanged; no allowances committed yet.

### impl-1692 · 2026-11-05T17:56:09.905Z

Coordinator decision042c1fa5 excludes host-push-on-ref-move from C2: 'product-path cause, filed separately'. A-16903 and its4/5 macOS samples retained; no further edits beyond classified setup bounds. Cover-quiet now active; all remaining macOS repetitions/files and Linux --init batches held until Coordinator's cover-finished notice. Mode-free verification requested at reviewed7f40bc776 during this authorized window.

### impl-1692 · 2026-11-05T18:18:00.797Z

Configured same-head verification fe31ba24 passed at7f40bc776, A-16904: Linux droplet5199/5199, T0/T1/fallbackT2/8 changedT3/Web, one base execution/no repetitions. Duration findings report-only. This does not complete C2 manual load campaign. Remaining macOS and allLinux --init evidence held until Coordinator posts cover-finished notice; host-push-on-ref-move excluded by Coordinator decision042c1fa5 as product-path cause filed separately, A-16903.

### impl-1692 · 2026-11-05T19:05:24.589Z

Coordinator decisionc6b242cd excludes host-survival-native from C2: product-path cause, filed as T-1695; preserve1/2 macOS and A-16907 with retained15000ms behaviour deadline unchanged. Earlier push exclusion is T-1693/A-16903,4/5. Other26 listed files still require5/5 macOS and docker run --init Linux. Next lock turn handed to lead T-1614; remaining native repetitions wait for its release. Final allowance/import-only delta review and rule7 exception remain authorized; fe31ba24 stands.

### impl-1692 · 2026-11-05T19:16:02.359Z

Loaded proof progress: all26 included files now5/5 macOS; Linux docker run --init batch0 all7 files5/5, four yes burners on four Linux arm64 CPUs, Node24.21.0. Other19 Linux files pending. Source remains7f40bc776 and fe31ba24 green. Lock released after native writers/burners joined. Coordinator priority9e962c0b holds new acquisition until T-1696 explicitly reports release; then remaining Linux batches resume. Exclusions T-1693/A-16903 and T-1695/A-16907 retained.

### impl-1692 · 2026-11-05T19:33:19.006Z

Coordinator decisiond81427f4 excludes ONLY remoteClaude case 'lost native release reply settles without replaying native stop' from C2, product cause T-1697. A-16915 preserves Linux fifth25/26 and native exit1; prior4 full files passed. Other25 cases retain5/5 Linux proof; macOS fullfile5/5 remains. Evidence summary now separates raw process passes from case-level C2 eligibility; no source changed for the failure. Remaining3 batch1 fifth files + Linux batches2/3 pending T-1696 priority release. Two whole-file exclusions remain T-1693 and T-1695. Final allowance/import delta review + existing fe31ba24 authorized rule7 exception unchanged.
