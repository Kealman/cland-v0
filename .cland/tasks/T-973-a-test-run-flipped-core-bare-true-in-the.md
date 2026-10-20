---
id: T-973
kind: task
title: A test run flipped core.bare=true in the live repository (shared by all worktrees), breaking merge admission
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - bug
  - security
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-749
branch: t/T-973-a-test-run-flipped-core-bare-true-in-the
created: 2026-10-20T13:44:18.343Z
updated: 2026-10-20T17:27:13.595Z
---

## Summary

At 2026-10-20 13:31:25Z (.git/config mtime), `core.bare` became `true` in the live repository's config, which every task worktree shares. The hub's merge admission then failed with `merge-tiers: git rev-parse --show-toplevel: fatal: this operation must be run in a work tree`, dropping T-970 and T-972 (13:42:58Z). The Coordinator restored it with `git config core.bare false`. In that window, implementers impl-970 and impl-972 were running targeted test files in their task worktrees, and the Coordinator had just run bisection probes in detached worktrees of the live repository. The usual mechanism is `git init --bare` or `git clone --bare` running with GIT_DIR or GIT_COMMON_DIR inherited, which reinitialises the inherited repository as bare.

## What to build

Find the writer and close the class. Every test and fixture child strips GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR, GIT_INDEX_FILE and the other GIT_* repository-location variables. The sealed builder from T-961 should already do this; check whether it covers these and whether the culprit bypassed it. The hub refuses to admit or batch while the root reports `core.bare=true`, with a clear message naming the fix. Rule 15 applies.

## Acceptance criteria

- [x] C1. The writer is identified (test, command or session) from a reproduction in a scratch repository, or the evidence lists every candidate checked.
  - verified: rev-26 [reviewer] · run rev-20261020-973-source-1 · 2026-10-20T16:53:29.775Z · commit f52a9182afc9a97b838ee90c9d64a08aab9cb302
  - done: impl-973 · 2026-10-20T17:01:58.057Z
  - verified: rev-26 [reviewer] · run rev-20261020-973-source-2 · 2026-10-20T17:02:19.405Z · commit 8e9593c0cf32f0440f716d17c394a06c9009c541
  - verified: rev-32 [reviewer] · run rev-20261020-973-source-3 · 2026-10-20T17:14:22.482Z · commit 519078b1d8bca275c91076bd4fac628712b019f5
  - verified: rev-32 [reviewer] · run rev-20261020-973-final-3 · 2026-10-20T17:22:22.315Z · commit 519078b1d8bca275c91076bd4fac628712b019f5
- [x] C2. A T1 test with a poisoned GIT_DIR/GIT_COMMON_DIR proves the fixture environment strips them, and a native T3 case in territory-cli.test.ts shows a fixture git init --bare / clone --bare leaves the scratch parent repository's config bytes unchanged (targeted local run before review; its Linux receipt is landing evidence).
  - done: impl-973 · 2026-10-20T17:01:43.874Z
  - verified: rev-26 [reviewer] · run rev-20261020-973-source-2 · 2026-10-20T17:02:19.405Z · commit 8e9593c0cf32f0440f716d17c394a06c9009c541
  - verified: rev-32 [reviewer] · run rev-20261020-973-source-3 · 2026-10-20T17:14:22.482Z · commit 519078b1d8bca275c91076bd4fac628712b019f5
  - verified: rev-32 [reviewer] · run rev-20261020-973-final-3 · 2026-10-20T17:22:22.315Z · commit 519078b1d8bca275c91076bd4fac628712b019f5
- [x] C3. Merge admission reports `core.bare=true` in the root as its own clear error instead of a raw rev-parse failure.
  - done: impl-973 · 2026-10-20T17:13:05.295Z
  - verified: rev-32 [reviewer] · run rev-20261020-973-final-3 · 2026-10-20T17:22:22.315Z · commit 519078b1d8bca275c91076bd4fac628712b019f5

## Comments

### coord · 2026-10-20T13:45:01.828Z

Coordinator investigation notes (13:45Z): impl-970 and impl-972 report that all their test runs used disposable roots and fixture environments that strip GIT_DIR, GIT_WORK_TREE and GIT_COMMON_DIR, and that only read-only or operational git ran in task worktrees. The Coordinator's bisect probes (13:13–13:28Z) ran node --test in detached worktrees of the live repository with only HOME replaced, which is a rule-15 gap, but they ended about 3 minutes before the 13:31:25Z write. Other sessions on this machine with worktrees of this repository include ~/.claude/jobs/723d0f6e/tmp/wt-fix and wt-ps (another Claude job), plus cland-explorer, brand, setup, onboarding and the research worktrees. The writer is unidentified; C1 stays open.

### impl-973 · 2026-10-20T16:48:29.917Z

Implemented and pushed c888e8e2c057ad64b3532d52ab44732c2d1e8eee. C1 candidate evidence is artifact A-7710 (durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7710-t-973-scratch-reproductions-candidate-audit-and-regression-evidence.md): historical writer remains unidentified, but inherited GIT_DIR and GIT_COMMON_DIR scratch writers are reproduced; init-fixture.sh's late-overlay bypass is reproduced and fixed. C2 follows Coordinator-approved T1/T3 split. C3 returns merge-bare at admission and batch preparation before worktree-dependent operations, without repairing config. Local macOS direct targeted 82-test run passed on implementation tree; final pure 52-test run passed; hub typecheck and diff check passed. No suite/tripwire gate mode enabled on those direct runs. Full mode-free T0–T2 verification will follow clear source review. Native Linux T3 remains landing evidence per Coordinator decision. QA policy scope none.

### impl-973 · 2026-10-20T16:50:16.897Z

M1 corrected in pushed head f52a9182afc9a97b838ee90c9d64a08aab9cb302: .cland/roles.toml Coordinator/Lead now carry merge-bare guidance. Coordinator default/project clauses point to the merge skill to preserve byte reserve; equivalent project heartbeat prose shortened. roles-clauses.test.ts passed 27/27 at this head on local macOS (direct targeted T1; no suite/tripwire gate mode). All existing reserve/wording guards retained. No dev merge or verification run after first source review request.

### rev-26 · 2026-10-20T16:53:29.775Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-973-source-1
commit: f52a9182afc9a97b838ee90c9d64a08aab9cb302
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at f52a9182; no remaining findings across Standards and Spec. A-7720 records the full read-only audit. M1 is resolved: default/project Coordinator and Lead clauses now cover merge-bare, with unchanged wording/reserve guards passing 27/27 at this head (A-7716). The sealed shell/machine builders strip repository-location Git variables after overlays; root bare admission refuses before worktree-dependent Git and names inspect/owner repair without editing config. C1 uses A-7710's enumerated-candidate alternative: historical writer remains unidentified. C2 uses source plus original focused macOS T1/T3 4/4 receipt A-7713 at c888e8e2, whose implementation/tests are unchanged at f52a9182, and actual mutation red A-7712. Native Linux T3 is landing evidence under amended C2. Earlier 82/82 is qualified pre-final tree evidence; reported later 52/52 is not relied on without its raw receipt. C3 remains unverified pending accepted same-head mode-free task verification and final evidence review. A-7715 was interim superseded material; no old-head formal verdict was recorded.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-20T16:58:32.326Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-973-final-1
commit: f52a9182afc9a97b838ee90c9d64a08aab9cb302
scope: evidence
findings: [{"severity":"medium","text":"fixtureEnvironment adds CLAND_EXECUTOR_STATE, changing scratchMachine's default XDG/legacy-ledger contract and causing 16 task-owned T1 failures in executor-spend and executor-lock-liveness. Preserve the sealed Git filtering while restoring this helper's default-ledger behavior.","file":"hub/test/init-machine.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear: A-7725/run 7ac3c6f9 at exact reviewed f52a9182 exits 1. A-7728 records actual failures and the source-attributed helper regression. executor-spend.test.ts:103 receives <scratch>/executor-state/spend.json instead of scratch HOME/.local/state/cland/spend.json; retirement reports that CLAND_EXECUTOR_STATE must be absent. The changed scratchMachine uses fixtureEnvironment's synthetic explicit ledger default, so legacy migration/lock contracts are bypassed. Base T1: 642 tests, 626 pass/16 fail; the 647/631/16 interruption aggregate additionally counts five passing load-gate repetitions. T2/Neovim/native T3 did not execute. Poisoned Git isolation and the new bare-batch identity pass, including 5/5 batch load repetitions, but do not cure the regression. Linux c-8 lon1, two configured workers, lifetime 129s/$0.0089. C1 audit remains valid; C2 failed for the helper regression and C3 remains unverified. Fix needs fresh source review before another task verification; no Reviewer rerun performed.

Criteria: C2 failed (Shared fixture environment now supplies an explicit executor ledger, breaking existing default-ledger/migration and legacy-lock assertions (16 T1 failures in A-7725).).

### impl-973 · 2026-10-20T17:01:44.623Z

Corrected own default-ledger regression in pushed head 8e9593c0cf32f0440f716d17c394a06c9009c541: scratchMachine removes only the shared builder's injected CLAND_EXECUTOR_STATE default, preserving isolated HOME/XDG product defaults and all Git/credential filtering. Existing executor-spend and executor-lock-liveness tests reproduce the old failures (A-7729); corrected-head complete run of both plus fixture-environment and territory-cli passed 51/51 on local macOS, direct T1/T3 without suite/tripwire gate mode, exit 0, no signal. The earlier interrupted wrapper run A-7731 is partial and not counted as a pass. Hub typecheck and diff check passed on this unchanged correction tree. C2 done restored; fresh source review requested before any new mode-free verification. Old run 7ac3c6f9 remains failed T1 with T2/Neovim absent.

### rev-26 · 2026-10-20T17:02:19.405Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-973-source-2
commit: 8e9593c0cf32f0440f716d17c394a06c9009c541
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 from final-1 is resolved. A-7734 audits the entire two-file delta from f52a9182: scratchMachine deletes only the shared builder's synthetic CLAND_EXECUTOR_STATE, preserving the Git/credential seal and restoring scratch HOME/XDG default-ledger migration/lock semantics; docs name that contract. Existing assertions/tiers remain unchanged. A-7733 is complete local macOS direct targeted T1/T3 at this head: 51/51 pass, exit 0/signal null, no skips/cancellations, total 85.249877833s. Previously failing spend and lock contracts pass; native bare fixture/config-preservation case passes 0.294967333s. This direct run had no suite/tripwire gate, and two existing ledger/lock timings exceed 2s; no enforced-budget or Linux proof is claimed. A-7729 preserves the old-head 16-failure red; interrupted A-7731 is not passing evidence. C1 retains the candidate-audit alternative, with historical writer unidentified. Renew C1/C2; C2 done is restored. C3/final settlement awaits fresh mode-free verification at 8e9593c0. Failed A-7725 is not reused; native Linux T3 remains landing evidence under amended C2.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-20T17:10:24.763Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-973-final-2
commit: 8e9593c0cf32f0440f716d17c394a06c9009c541
scope: evidence
findings: [{"severity":"medium","text":"The new bare-root preflight invokes native Git inside projectHub's in-process component probe mode. A-7746 project-probes zero-child census observes execFile:1, with the same guard in T2 tripwire stacks. Wire this fact through the injectable/native probe boundary while preserving production bare refusal and the zero-child assertion.","file":"hub/src/hub/merge.ts","line":115}]
finding_counts: {"high":0,"medium":1,"low":0}

Final not clear at 8e9593c0. A-7750 audits failed A-7746/run 3e1fdc51. Actual project-probes.test.ts:58 cleanup expects {} but sees {execFile:1}; line 15 file hook repeats that census failure. New requireMergeWorktree at merge.ts:115 invokes TaskMerges' native Git runner despite projectHub's in-process facts; report-only tripwire stacks confirm the guard→territoryGitAsync→execFile chain under T2. Preserve the injection boundary, not a weakened census or tier downgrade. Prior default-ledger fix is confirmed: all 21 executor-spend/lock identities pass. T1 exits 0; T2 exits 1 before Neovim. Header counts 1800/1798/2 include the file hook, whereas interruption progress 1804/1803/1 includes five passing load repetitions and excludes that hook. No full or partial aggregate is accepted green. Linux c8 lon1 two workers,351s/$0.0244; T3 deferred. C1/C2 remain source-established; C3 failed. Corrected head needs source re-review before another verification.

Criteria: C3 failed (New merge-bare preflight escapes the injected component boundary and launches native Git, failing the zero-child project-probes contract in A-7746.).

### impl-973 · 2026-10-20T17:13:06.220Z

Second own regression fixed in pushed head 519078b1d8bca275c91076bd4fac628712b019f5: DispatcherOptions.git now supplies TaskMerges' read-only root-probe slot; native operational recovery/territory runner remains separate. Standalone plan-stage fixture supplies its existing facts.read. project-probes preserves both zero-child census assertions and now proves injected bare=true returns merge-bare. Exact-head local macOS targeted project-probes + prior four requested files + all affected plan-stage callers/Aide/queue: 103/103 passed, exit 0/signal null, direct T1/T2/T3 without suite/tripwire gate mode. Native merge admission/batch bare-root case also passed at this head (A-7759). Hub typecheck and diff check passed on unchanged code tree. C3 done restored; fresh source review required before next mode-free verify. 3e1fdc51 remains failed T2, with native T3/Neovim absent; no passing-run claim.

### rev-32 · 2026-10-20T17:14:22.482Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-973-source-3
commit: 519078b1d8bca275c91076bd4fac628712b019f5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No findings at 519078b1d8bca275c91076bd4fac628712b019f5. Reviewed the full T-973 source since 42f7c9c3 plus the correction from prior reviewed 8e9593c0. The new root fact uses DispatcherOptions.git through TaskMerges' read-only #rootGit boundary; native/injected operational #git still handles recovery and territory writes. Standalone plan-stage supplies existing facts.read. The component test preserves both zero-child census assertions across imports and cleanup and now rejects injected bare=true as merge-bare. No tier downgrade or weakened assertion.

The fixture changes seal inherited and late-overlay GIT_* pointers through the shared environment builder. scratchMachine retains own HOME/XDG/no-identity contracts and removes only the synthetic executor-state default which caused the earlier ledger regression. CLI help, README, docs/agents/tests.md, merge skill and default/project Coordinator/Lead clauses match the refusal and repair workflow. No Reviewer runtime execution.

## Spec

No findings. C1's candidate-audit alternative is supported by qualified A-7710: historical writer remains unidentified; scratch experiments distinguish inherited GIT_DIR/GIT_COMMON_DIR from cwd-only/explicit-clone candidates and audit bare-operation call sites. The demonstrated init-fixture sh late-overlay class member is sealed. A-7710 is labelled investigation/transcription evidence, not an invented raw scratch log.

C2: pure poisoned-parent/overlay test explicitly includes GIT_DIR/GIT_COMMON_DIR and related overrides; native territory case compares scratch-parent config bytes after implicit init, linked-cwd clone and actual shared-shell late overlays. A-7761 is exact-head local macOS direct targeted T1/T2/T3 103/103, exit 0/signal null, including the requested five files, affected plan-stage/Aide/queue callers, default-ledger/legacy-lock cases and native poison proof. No suite/tripwire budget gate was enabled. Renew C1/C2 as established by source/audit and retained targeted evidence; native Linux T3 remains landing evidence under current C2.

C3 source: requireMergeWorktree rejects bare roots before worktree-dependent admission/squash/tree inspection/batch preparation, names root, core.bare=true and owner repair command, and never edits config. Current correction restores the injected component boundary. A-7759 retains exact-head macOS native admission/batch case 1/1, exit 0; A-7761 contains the zero-child component checks. C3 final freshness remains pending mode-free same-head verification.

Previous A-7746 remains failed at 8e9593c0: actual zero-child assertion expected {} but observed {execFile:1}; it is a task-owned native-probe escape, not a flake. Earlier ledger failure remains failed at f52a9182. Neither receipt is reused as green.

Source clear only, scope full for the corrected probe design. Fresh mode-free verification is required at 519078b1 before final settlement; no Linux/task/integrated green claim. Totals: Standards 0, Spec 0.

Artifact A-7769: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7769-t-973-corrected-source-review-at-519078b1.md

Criteria: C1 verified, C2 verified.

### rev-32 · 2026-10-20T17:22:22.315Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-973-final-3
commit: 519078b1d8bca275c91076bd4fac628712b019f5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at 519078b1d8bca275c91076bd4fac628712b019f5 following source verdict rev-20261020-973-source-3 / A-7769. Current branch tip and hub verify head match. No findings. Verify C1–C3.

A-7781, fresh mode-free run 364779dc-179e-45b6-8f3e-c11971217793, exited 0 on Linux x64 6.8.0-142-generic droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5. T1 exit 0 (42s), all-T2 fallback exit 0 (259s), including hub and Neovim. Aggregate 2063/2063 reported passes including load checks. Host typecheck gate a7bb585599ce6aeee0590200b2ebbd9cd9038ecf was reused, not repeated remotely. Lint census 131 findings/59 files, budget and T3 ratchet diagnostics remain report-only; refusal policy enforced.

Confirmed the prior regressions are resolved on Linux: all 15 executor-spend and six executor-lock-liveness cases pass; both project-probes cases pass, preserving the import/teardown zero-child assertions. The bare-project batch refusal passes ordinary execution and a separate 5/5 load receipt. Thus the new root fact is exercised through the injected component boundary without the previous native execFile escape.

C1 remains the source-reviewed candidate-audit alternative in A-7710: the historical writer is unidentified, and no attribution is fabricated. C2 combines same-head T1 poisoned-environment proof with exact-head local macOS targeted native config-byte preservation in A-7761. C3 combines source-reviewed clear merge-bare refusal and same-head component/batch execution with native production admission/batch refusal A-7759 (local macOS 1/1). A-7761 is a supplemental exact-head local direct mixed T1/T2/T3 103/103 receipt, not a Linux T3 pass. Current C2 explicitly makes native Linux territory-cli execution landing evidence.

Both earlier task receipts remain failed on their older heads: A-7725 default-ledger regression and A-7746 probe escape/census duplicate. No failure is reclassified as a flake or reused green. T3/T4 did not execute in this task gate and remain deferred periodic/integrated landing coverage. No Reviewer tests or probes were run.

Standards: 0 findings. Spec: 0 findings.

Artifact A-7786: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7786-t-973-final-same-head-evidence-at-519078b1.md

Criteria: C1 verified, C2 verified, C3 verified.
