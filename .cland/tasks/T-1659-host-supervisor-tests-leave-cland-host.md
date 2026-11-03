---
id: T-1659
kind: task
title: "host-supervisor tests leave 'cland host serve' agents alive after passing: cleanup never captures agent ownership"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1594
topic: topic-1370
branch: t/T-1659-host-supervisor-tests-leave-cland-host
created: 2026-11-03T07:18:11.410Z
updated: 2026-11-03T23:08:38.253Z
closed: 2026-11-03T23:08:38.253Z
---

## Summary

Found by QA's process census in the E-1532 stage-2 run (qa-678, topic-1362, dev 722f1ce5). Rows 04 and 05 ran `hub/test/host-supervisor.test.ts` six times. Afterwards, 18 `cland host serve` processes survived, three per invocation. They have this run's worktree argv, births at 07:02–07:03Z, and their cwd sits under the hs-* and hs-owner-* fixture roots, including row 05's long root. Every TAP assertion passed, and the fixture directories were removed.

Cause, from QA's read of the source (the survivors themselves are observed): host-supervisor.test.ts:65, 94–98 and 155 close harnesses and supervisors but never capture the agents' ownership, and process-cleanup.ts:436 selects only seed PIDs that are not group leaders, taking whole groups only for group leaders. So the supervisor's agent descendants escape cleanup. Leaked fixture processes accumulate across suites; see the orphan census in the hourly check, with 97 leaked pairs on 2026-10-29 (T-1445).

## What to build

The fixture records every agent the supervisor starts, by PID and start identity, and teardown stops and joins them before the root is removed. Any other fixture that starts supervised agents gets the same, or a recorded reason why it is unaffected. Add a post-file census assertion: no `cland host serve` whose cwd is under the file's roots survives teardown.

## Acceptance criteria

- [x] C1. After host-supervisor.test.ts passes, no `cland host serve` process whose cwd is under its fixture roots survives, checked by a census assertion with a positive control taken before the fix (test).
  - done: impl-1659 · 2026-11-03T22:00:59.281Z
  - verified: rev-35 [reviewer] · run rev-35-1659-final-1 · 2026-11-03T22:28:13.530Z · commit 01d7ab36559958750a6f0c24ff6ca0ee886568d4
- [x] C2. The same holds with five load-gate repetitions and the long macOS suite TMPDIR root (test).
  - done: impl-1659 · 2026-11-03T22:03:20.510Z
  - verified: rev-35 [reviewer] · run rev-35-1659-final-1 · 2026-11-03T22:28:13.530Z · commit 01d7ab36559958750a6f0c24ff6ca0ee886568d4

## Comments

### coord · 2026-11-03T19:32:08.531Z

More evidence (coord, 2026-11-03 ~19:32Z): a census on the Mac found 33 orphaned `cland host serve` processes, each with ppid 1 and about 14.5 h old. They come from this morning's runs of host-supervisor and fake-host fixtures (argv in the T-1653 worktree). Their cwds: 18 under /private/tmp/cland-suite-60a1d8e3-…, 14 under the system TMPDIR, 1 under a fake-ssh root. They used no CPU. I stopped them with SIGTERM by literal PID, and the count is now 0. The leak keeps accumulating across suite runs on the macOS cover machine until this item lands.

### impl-1659 · 2026-11-03T21:53:18.126Z

Pre-fix positive control on macOS local / Node v24.21.0: node --test hub/test/host-supervisor.test.ts with only retained roots and a post-file census assertion added. Three existing tests passed (1716/496/829 ms), then census failed: 'post-file fixture process census: supervised writers survived teardown', reporting host serve PIDs 50706, 51689, 51945, all parent 1 with captured native darwin births. Control safety cleanup joined all three before removing roots. No full suite or load stress ran. Auditing createFakeHost, supervisor, host serve callers across all test tiers; process-cleanup.ts will remain unchanged.

### rev-35 · 2026-11-03T21:58:31.888Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1659-source-1
commit: 4fff7bcddb6ce1cf4c526bbc7e391a907548d2a8
scope: full
findings: [{"severity":"medium","text":"Remaining writers are captured before stopping restart owners; an agent restarted after this snapshot has no captured owner and is absent from remaining. The shared-root case also reaches the other owner's agents before stopping that supervisor. Stop/join all relevant restart owners, then census and join remaining writers; retain the final assertion and prove the held restart-during-teardown boundary.","file":"hub/test/host-supervisor.test.ts","line":114},{"severity":"medium","text":"Renaming the setup-failure case leaves its old exact identity in durations.json:9881. Configured admission/shard planning refuses stale duration keys before running tests; restore the old title or remove the stale key under docs/agents/tests.md:1682–1687.","file":"hub/test/host-supervisor.test.ts","line":123}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear at 4fff7bcddb6ce1cf4c526bbc7e391a907548d2a8. Two medium findings, no lows. Standards: stale duration identity; Spec: restart-owner ordering and post-stop writer discovery. Detail A-16346 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16346-t-1659-source-review-restart-teardown-ordering-and-duration-identity.md). A-16343's local macOS 3/3 and positive control are summarized evidence, not configured exact-head verification. C1 failed; C2 unverified and still held pending Coordinator's quiet-machine notice. process-cleanup.ts unchanged. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation. Fresh source review required before verification.

Criteria: C1 failed (Teardown can miss agents restarted after its pre-stop census, and the renamed test leaves a stale duration identity that blocks configured execution.).

### rev-35 · 2026-11-03T22:02:14.066Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1659-source-2
commit: 01d7ab36559958750a6f0c24ff6ca0ee886568d4
scope: full
findings: [{"severity":"low","text":"The guide still says 'all three roots'; the new held-restart case creates a fourth root. Prefer 'all fixture roots' or update the count.","file":"docs/agents/tests/hub-test-host-supervisor.test.ts.md","line":15}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear; both prior medium findings resolved. Root registry stops/joins every supervisor and starter before the final writer snapshot, including shared-root owners; native-birth held replacement regression keeps the final empty-census assertion. Setup-failure literal identity restored to its existing duration key. One low documentation count finding retained. Detail A-16349: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16349-t-1659-corrected-source-clear-stop-owners-before-writer-discovery.md. C1/C2 run-dependent criteria remain unverified pending same-head configured evidence; C2 load work is still held for Coordinator's explicit quiet-machine notice. A-16348 has four named macOS Node24.21 candidate passes, execution started pre-commit; no separate native exit/signal receipt, no exact-HEAD execution claim. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation. process-cleanup.ts and production contracts unchanged.

### rev-35 · 2026-11-03T22:28:13.530Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1659-final-1
commit: 01d7ab36559958750a6f0c24ff6ca0ee886568d4
scope: evidence
findings: [{"severity":"low","text":"The guide still says 'all three roots'; the new held-restart case creates a fourth root. Prefer 'all fixture roots' or update the count.","file":"docs/agents/tests/hub-test-host-supervisor.test.ts.md","line":15}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear, C1/C2 verified at unchanged source-clear head. One existing low guide-count finding retained, no high/medium. A-16343 before-fix positive control failed 'post-file fixture process census: supervised writers survived teardown' with three parent-1 native agent births; qualified control evidence, not current-head execution. A-16351 current-head macOS local Node24.21 production runLoadGate normal4/4 plus all four exact identities5/5, UUID TMPDIR/shared suite+machine lease, each final census passed, driver native code0/signalnull; explicit quiet authorization confirmed. Superseded A-16350 lost third-case timing remains UNKNOWN and is not proof. Exact-head queued14d9a6b5/A-16368 exit0,4927/4927, zero fail/cancel/skip/todo. Independently streamed four ordinary timing passes at25932/25937/25942/25947 and file finish/pass25949 including after hook. T0/allT1/fallbackallT2/changedT3 file once/Web complete; remainingT3 deferred,T4 unexecuted; Linux5/5 not claimed. Uncached Linuxx64 c-8sfo2 Node24.21/Nvim0.12.5 tree1ff25080e102cf054f4dcd113423bfaf30bda99e, isolated HeadlessShell1248/ChromeForTesting156.0.8078.4. Budgets/lint/ratchet/skip checks report-only; skips[]/missing0. Billing1331s/$0.0924 not suite wall. Added duration cause accepted by Coordinator c0a7bf05; no new exception. Detail A-16369 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16369-t-1659-final-evidence-clear-native-cleanup-and-long-root-repetitions.md. QA none; batch/integrated coverage separate. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-03T23:08:38.253Z

Merged 77cfe3cf29bff9992022621fe8b3cf83a8bed53f onto dev.
