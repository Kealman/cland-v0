---
id: T-1692
kind: task
title: "Sweep stage-5 tests' fixed wall-clock bounds: setup bounds from the shared budget, behaviour bounds named and kept"
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1394
branch: t/T-1692-sweep-stage-5-tests-fixed-wall-clock
created: 2026-11-05T17:20:46.506Z
updated: 2026-11-05T20:11:40.401Z
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

- [x] C1. Every changed bound is listed with its old value, new value and its class (setup or behaviour), and no behaviour bound or assertion is changed (evidence).
  - done: impl-1692 · 2026-11-05T20:04:11.169Z
  - verified: rev-36 [reviewer] · run rev-36-1692-final-1 · 2026-11-05T20:10:28.424Z · commit aab9ecb94515a3a30327e5a72c2e95594b811e18
- [x] C2. Every listed file passes 5/5 locally under heavy CPU load on macOS (load 12 or more) and in a Linux container run with `docker run --init` (evidence).
  - done: impl-1692 · 2026-11-05T20:04:43.077Z
  - verified: rev-36 [reviewer] · run rev-36-1692-final-1 · 2026-11-05T20:10:28.424Z · commit aab9ecb94515a3a30327e5a72c2e95594b811e18

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

### impl-1692 · 2026-11-05T20:04:43.260Z

C1/C2 done-marked with completed proof A-16923 at finalaab9ecb94515a3a30327e5a72c2e95594b811e18. All1036 assertion call texts unchanged across28 files (770 in17 edited files); committed file/line/old/new/class/reason table. Loaded proof at reviewed7f40bc776:26 included files ×5 executions/platform,257 eligible generated cases ×5/platform=2570 passing observations. Raw included-file outcomes259/260 exit0, with T-1697 single-case exception preserving Linux25/26 exit1; T-1693/T-1695 whole-file exceptions retain native failures.29 case allowance updates +one316s aggregate file allowance, ownerC-216/expiry2026-11-11/report mode; no baseline/catalog/budget mutation. Final source delta only relocates existing import; no product logic or assertion changes. Production parser/lint, docs index, test:tiers and diff check passed. Requesting delta source review; Coordinator ba25b684 retains green fe31ba24/A-16904 under rule7 exception without a new configured verify.

### rev-36 · 2026-11-05T20:10:28.424Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1692-final-1
commit: aab9ecb94515a3a30327e5a72c2e95594b811e18
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final delta/evidence clear; Standards/Spec no findings, prior import/EOF low resolved. C1: final test delta only moves import; previous A-16898 assertion/deadline assessment preserved, old/new/class bound inventory checked. Independently verified all30 allowance stanzas (29 cases+316s aggregate) against raw passing samples, max(old,ceil1.5×worst), C-216/expiryNov11; version/source/budget/baseline files/tests unchanged, report mode retained. C2 verified ONLY under Coordinator exclusions042c1fa5(T-1693 whole file),c6b242cd(T-1695 whole file),d81427f4(T-1697 single case). Parsed260 native/TAP pairs: 259 exit0,1 retained exit1/25of26;257 eligible named identities each5/platform =2570 passes, no other eligible failures. All included Mac start loads>=12,min12.229; Linux arm64 Docker --init/four burners, Node24.21. Loaded/final28-file source hashes match respective heads. A-16926 details scope: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16926-t-1692-final-delta-and-scoped-load-evidence-review.md . Coordinator ba25b684 explicitly accepts prior green fe31ba24/A-16904 at7f40bc776 plus this delta and proof; NO final-head verify/cache hit claimed. Existing green5199/5199 T0/T1/fallbackT2/8selectedT3/Web, Linuxx64 droplet Node24.21/Nvim0.12.5/isolated HeadlessShell1248 Chrome156.0.8078.4. RemainingT3 batch/T4 unexecuted; excluded failures remain failed. Reviewer ran no tests or validators.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-05T20:10:40.543Z

Rule 7 exception (coord): head aab9ecb9 differs from the green verify fe31ba24 at 7f40bc77 (A-16904, Linux x64, 5199 passed) only in test files, durations.json and docs, with no hub/src change: the claude-code-remote import cleanup, 29 per-case allowance updates, the existing claude-code-remote file-aggregate allowance going from 225 s to 316 s, and test guides. Evidence: fe31ba24; the two-platform loaded proof A-16923 (2570 eligible observations, with approved exclusions T-1693, T-1695 and T-1697); and rev-36's delta review clear at aab9ecb9. The batch T1+T3 covers the rest. Enqueued.

### coord · 2026-11-05T20:10:56.567Z

Allowance arithmetic (coord, for the record): the claude-code-remote file aggregate of 316 s = ceil(1.5 × the worst observed full-file sum, 210.187 s), following the allowance rule. Each per-test outer timeout is 240 s, above the largest per-test cap (21 s). Kept as enqueued at aab9ecb9, with no head change.

### impl-1692 · 2026-11-05T20:11:40.401Z

Allowance arithmetic, per Coordinator a3953590:316s = ceil(1.5 ×210.187162044s), the worst passing observed full-file sum of top-level case durations. It is not the sum of independently maximized per-case caps. Claude's explicit per-test outer guards default to240s, above every individual case cap (max21s); the small older-agent case keeps Node's unlimited default. The aggregate is a separate report-only file threshold, C-216/expiry2026-11-11. No cap, source, head or review refresh: aab9ecb94515a3a30327e5a72c2e95594b811e18 stays clean/enqueued; green fe31ba24 + delta review + A-16923 stand under the authorized rule7 exception.
