---
id: T-1012
kind: task
title: Neovim test fixtures inherit the parent environment unless sealed explicitly
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-973
branch: t/T-1012-neovim-test-fixtures-inherit-the-parent
created: 2026-10-20T17:10:34.274Z
updated: 2026-10-24T12:25:42.966Z
closed: 2026-10-24T12:25:42.966Z
---

## Summary

Neovim test fixtures created with `createClient` inherit most of the parent's HOME, account and provider variables unless a sealed environment is supplied. A Neovim test can therefore read the human's real state or credentials. impl-1008 found this while working on T-1008 (2026-10-20); its new cases already pass the shared `fixtureEnvironment`.

## What to build

`createClient`, and every other Neovim fixture launcher, uses the sealed fixture environment by default: scratch HOME and XDG, a synthetic Git identity, credentials filtered. A test that needs a variable passes it explicitly. Existing Neovim tests move to the default.

## Acceptance criteria

- [x] C1. A Neovim fixture created without an explicit environment receives the sealed fixture environment, with no parent HOME, account or provider variable (test with a poisoned parent environment).
  - done: impl-1012 · 2026-10-24T11:58:27.072Z
  - verified: rev-26 [reviewer] · run rev-20261024-1012-final-1 · 2026-10-24T12:14:34.644Z · commit 841fbf88fcf9cb4e2e67137e2c8fe19f32d3d8d1
- [x] C2. A test can pass an explicit variable through, and only that variable reaches the fixture (test).
  - done: impl-1012 · 2026-10-24T11:58:28.396Z
  - verified: rev-26 [reviewer] · run rev-20261024-1012-final-1 · 2026-10-24T12:14:34.644Z · commit 841fbf88fcf9cb4e2e67137e2c8fe19f32d3d8d1
- [x] C3. The existing Neovim T2 tests pass on the sealed default without per-test environment edits, or each edit is listed in the item topic.
  - done: impl-1012 · 2026-10-24T11:58:28.621Z
  - verified: rev-26 [reviewer] · run rev-20261024-1012-final-1 · 2026-10-24T12:14:34.644Z · commit 841fbf88fcf9cb4e2e67137e2c8fe19f32d3d8d1

## Comments

### impl-1012 · 2026-10-24T11:53:11.018Z

Test-first: client-component poisoned-parent regression failed because child HOME equalled scratch synthetic parent-home. Applied shared fixtureEnvironment at createClient's final overlay; direct + launcher environment assertions and all 6 component tests now pass on local macOS. Inventory also found qa-runner and direct graph/resolver child launches; sealing these next. No duration allowance required by samples so far.

### impl-1012 · 2026-10-24T11:58:59.210Z

Source review requested and queued for the next free live Reviewer at pushed 841fbf88 (origin/dev 512c4960 merged before first source review). C1–C3 marked done; no per-item QA requirement. A-10889 records implementation, launch inventory, red/green and targeted receipts; shell-component additionally completed 61/61. Targeted checks are not a suite receipt. Waiting for source clearance before mode-free same-head verification; no further dev merge unless asked/conflict.

### rev-26 · 2026-10-24T12:01:51.292Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1012-source-1
commit: 841fbf88fcf9cb4e2e67137e2c8fe19f32d3d8d1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1012 full source review — clear
Head841fbf88fcf9cb4e2e67137e2c8fe19f32d3d8d1; tree89d726ab0160cd3239035ab34aeddb6d6f857118; task/origin refs agree. Fixed point512c4960bb573e8df6e215de8bceb509af8e7d6a (dev merged before first review); git diff512c4960...841fbf88,14files158+/46−. Scope full, run rev-20261024-1012-source-1, findings[].

## Standards
No findings. Shared final launch boundary replaces inherited environment copying with fixtureEnvironment after explicit controls, retaining scratch HOME/XDG/account/Git defaults and filtering credentials/repository/configuration overrides after overlays. Direct Neovim and cland-nvim paths share this environment. Existing ownership/child close/group-disappearance paths remain before directory removal; QA CLI uses shared owned process/root cleanup.
Inventory of native nvim/test child call sites inspected: client, criteria Git, layers PID probe, graph Lua host, nvim resolver/tar/PID/worktree probes, QA CLI/fixture/sandbox probe, and already-sealed web graph oracle. Updated launches have disposable cwd and shared sealing. Graph oracle source/data copied into scratch; no new live-project writer or credential input. New poisoned-parent tests use synthetic values/scratch paths even for red behavior, restore process.env in finally and inspect child-produced environment receipts. New explicit-control checks retain final assertions.
Tests remain at their existing declared seams; no timing cap, assertion, fixture scale or test tier relaxation. Matching shared test/nvim README guidance describes changed default; no product CLI/permission/role/skill behavior changed, so no unrelated help/clause padding. T0 guard extension is separately filed T-1237 by Coordinator15131736, outside this scope. AGENTS/test ownership/environment/levels guidance and smell baseline applied; whitespace check clean.

## Spec
C1 source matches: createClient builds per-client scratch environment via shared fixtureEnvironment at final native launch. Parent NVIM/CLAND/FAKE/account/provider/Git override values are excluded (only deliberate stub replay runner controls retained); synthetic Git identity/config and scratch profile paths supplied. Direct poisoned-parent regression asserts HOME/XDG/accounts/Git/log paths and removed keys.
C2 source matches: explicit scratch controls survive both direct/launcher boundaries, while supplied HOME/provider/Git overrides cannot restore ambient accounts/authority; ambient CLAND/FAKE controls absent. QA prefix probe inspects environment before product start with same boundary.
C3 source migration list checked: hub-read-component client() and inbox-actions approvalClient() remove redundant wrappers; five shell-component cases remove redundant environment roots/builders. Existing state/migration scratch XDG overrides remain. No other per-test compatibility workaround introduced. Actual complete Neovim T2 execution remains required in configured evidence, not inferred from this inventory.

All criteria test-dependent and left unverified pending same-head configured result. A-10889 is a summarized local macOS account, not full raw stdout: client6, graph13, resolver5, QA25, hub-read2,inbox22; shell61 subsequently reported. Targeted tree0acf3030/pre-dev merge; shell run spanned merge with reported unchanged candidate Neovim sources, final typecheck rerun841fbf88. No suite/count/timing extrapolation, no native Linux claim. Preserve/publish original stdout/exits/native timings and actual tree attribution without rerunning for transcription; missing outputs remain explicit.

Proceed with normal mode-free configured verify at this exact head, routing result to Reviewer/item lead. Confirm full Neovim T2 selection/receipts and changed T3/T4 once where selected, no skip-as-pass; retain generated duration stanzas and any budget limits. A changed head needs fresh source review before verification. QA none/after-stage; no item QA requirement. Reviewer used read-only pinned-source/Git/artifact inspection, no tests/probes/browser/edits/install/merge/delegation. Standards0 findings; Spec0 findings.
Durable source review A-10899.

### rev-26 · 2026-10-24T12:14:34.644Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1012-final-1
commit: 841fbf88fcf9cb4e2e67137e2c8fe19f32d3d8d1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1012 final same-head evidence review — clear

Head 841fbf88fcf9cb4e2e67137e2c8fe19f32d3d8d1; tree 89d726ab0160cd3239035ab34aeddb6d6f857118. Source review A-10899 / rev-20261024-1012-source-1 remains current. Audited original configured log A-10930 for run 3cd1cb8a-d946-4de7-8d47-85c8a2347761; task.view independently names this exact head and finished/passed result.

## Standards
No findings. This is evidence settlement only; no source change or new runtime execution by Reviewer. The log preserves actual selection, outcomes, native timings, host check output and report-only limitations. Original macOS A-10889 remains a summary of its stated development sources, not raw output or this same-head Linux suite. Missing original standalone raw files are not reconstructed or replaced by transcription reruns.

## Spec and criteria
C1 verified across A-10899 source and this run: default client poisoned-parent regression passed in ordinary Neovim T2 at 0.105398557 s, plus 5/5 actual load repetitions. The final fixture boundary supplies disposable HOME/XDG/account/Git paths and filters parent authority after overlays; direct and launcher paths share it.
C2 verified: explicit launcher-input regression passed at 0.254192883 s plus 5/5 actual repetitions. It asserts deliberate controls survive while ambient/account/provider/Git overrides remain excluded. QA environment-before-product-start case passed once at 0.510506560 s.
C3 verified: full T2 fallback covers both packages, including all existing Neovim T2 files. Relevant ordinary file receipts are client-component 6/6, hub-read-component 2/2, inbox-actions 22/22, shell-component 61/61 and graph-layout 13/13. Per-test compatibility edits remain the explicit list in A-10899: two redundant client environment wrappers and five shell environment wrappers removed; no downstream assertion/cap relaxation.

## Configured receipt and platform limits
Mode-free configured task run, mode full, exit 0. Linux x64 6.8.0-142-generic droplet c-8 lon1, cland-v0-8eb86777, Node v24.21.0, Neovim v0.12.5, configured workers 2; lifetime 626 s, cost $0.0435. T0 host check passed in 32.422 s; remote log explicitly records host gate 65e992fb5baea2829b96ad2e1dd28476369ad98c not repeated. Read-only Git confirms that identifier is a tree object, not a different commit.

Deduplicated native progress records: 3003 ordinary test passes, 3 skips, 429 file passes, no failure/cancellation; 10 additional load-gate test passes for the two new T2 identities (5/5 each), counted separately. This is 3006 ordinary test outcomes, not 3006 passing tests. Both new T2 cases are below the 2 s budget.

T1, fallback all hub/Neovim T2, Web, and selected changed T3 once all exit 0. Six changed T3 files have 50 passing identities and three explicit skips; added selected-phase wall 30.968 s excludes machine wait. Client native 4/4 (worst stale-hub case 4.981041078 s), criteria 2/2, layers 4/4, nvim-path 5/5, QA 22 pass/3 skip, plus graph 13/13. No selected T3 identity reaches the 8 s (80% of 10 s) allowance trigger; duration-check output says no stanza.

The three QA skips all state "needs macOS sandbox-exec": network denied, writes denied outside temp, and all writes denied/read-only rescue. They are Linux platform exclusions, not passing sandbox proofs. No same-head macOS sandbox execution is claimed, and these unchanged platform-specific contracts are not required to establish the C1/C2 environment cases or full T2 C3 criterion. Remaining general T3 and T4 did not run.

All duration/lint/ratchet diagnostics remain report-only: lint 133 findings in 60 files, existing Web shell/connection and hub scale warnings, projected Web wall over 40 s, and T3 ratchet 2195.814 vs base 2195.304 s would refuse growth. This exit-0 receipt is not a claim that enforce-mode budgets or the T3 growth gate passed.

Disposition: final evidence clear, findings [], C1/C2/C3 all verified across current source review and exact-head configured receipt. No per-item QA required by none/after-stage policy. Landing remains with Coordinator; perform the normal read-only current-dev conflict check without changing the reviewed head. Standards 0 findings; Spec 0 findings.
Durable review: A-10932.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T12:25:42.966Z

Merged 5e29a5f2dd92895d43afd8b9a10e23faab1f2155 onto dev.
