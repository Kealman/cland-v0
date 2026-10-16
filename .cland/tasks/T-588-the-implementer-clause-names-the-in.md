---
id: T-588
kind: task
title: The Implementer clause names the in-process test hub and the startDaemon lifecycle-only line
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - hub
  - qa-found
assignee: null
parent: E-387
blocked_by: []
topic: topic-370
branch: t/T-588-the-implementer-clause-names-the-in
created: 2026-10-16T10:49:49.485Z
updated: 2026-10-16T11:31:10.806Z
closed: 2026-10-16T11:31:10.806Z
---

## Summary

E-387's demo run qa-2026-10-16-27-21 failed R1 (criterion C5). Both Implementer clauses, `hub/src/roles/default-roles.ts` `[implementer]` and `.cland/roles.toml` `[implementer]`, describe coverage selection but leave out the in-process test hub default and the rule that `startDaemon` is kept only for hub-process lifecycle tests. `docs/agents/tests.md` and `hub/README.md` (Tests) already describe both.

## What to build

Add one line to the Implementer clause in both files, next to the `hub-selected` line, saying that:
- tests use the in-process hub, `projectHub(t, root, env?)` from `hub/test/harness.ts`, by default;
- `startDaemon` is kept only when an assertion concerns the hub process (startup, stop, signals, crash or restart, lock, discovery, pid, orphan sweep, watchdog, the CLI with the hub down), and such a test names that behaviour;
- `docs/agents/tests.md` has the details.

Keep the wording consistent with `docs/agents/tests.md`. Make no other clause changes. Under rule 6, grep hub/test and nvim/test for clause text or clause-size assertions, and run every matching test file.

## Acceptance criteria

- [x] C1. Both Implementer clauses carry the in-process default and the startDaemon lifecycle-only line, worded consistently with docs/agents/tests.md, and every test file asserting clause text or size passes.
  - done: impl-588b · 2026-10-16T11:29:47.694Z
  - verified: rev-30 [reviewer] · run rev-20261016-588-final · 2026-10-16T11:30:13.290Z · commit eb00ccc56914ff65fdba5488cbd9f4923c551176

## Comments

### impl-588b · 2026-10-16T10:51:56.684Z

Added one identical guidance line beside hub-selected in both Implementer clauses, following docs/agents/tests.md: projectHub default, startDaemon only for hub-process assertions, and named lifecycle behavior. Fetched and fast-forwarded origin/dev before first review. Clause text/size/parity search complete; matching targeted files are being run serially.

### impl-588b · 2026-10-16T10:54:40.376Z

Source ready at eb00ccc56914ff65fdba5488cbd9f4923c551176; committed and pushed to origin. Exactly 2 added lines in the requested files. Serial targeted runs: roles (8), roles-snapshot (10), surface (3), review-qa (3), permissions (5), skills-qa (16), rule-sessions (7), session-brief (8), codex-adapter (35), opencode-adapter (17): 112 passed, zero failed/skipped. Searched both hub/test and nvim/test; no matching Neovim clause text/size assertions. QA policy none. Requesting source review before diff-selected verification.

### rev-30 · 2026-10-16T10:56:01.633Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-588-source
commit: eb00ccc56914ff65fdba5488cbd9f4923c551176
scope: full

# T-588 source review clear

Reviewed pushed `eb00ccc56914ff65fdba5488cbd9f4923c551176`, branch `t/T-588-the-implementer-clause-names-the-in`; local/origin refs agree. Fixed point/merge base with origin/dev `133ce00862a55cd6abf246a5df248c1da9af2fc4`. Captured three-dot diff and commit list: one implementation commit, exactly two files/two added lines. Took hold and read claimant impl-588b, item spec and sole C1; QA policy scope none.

## Standards

No high/medium/low findings. Exactly one line added beside hub-selected in each Implementer clause, default-roles.ts:153 and .cland/roles.toml:105. Independently normalized template-literal backtick escapes and confirmed identical guidance text. No other clause, permission, launch setting, production logic or test changes. Whitespace diff check clean.

The line points to the existing canonical testing guide and summarizes its actual fixture/default/exception, avoiding a second competing mechanism. Existing generated-default versus project-clause difference elsewhere is unchanged and outside this scope. No Fowler-baseline or documented-standard finding.

## Spec

C1 source requirements satisfied: names `projectHub(t, root, env?)` from `hub/test/harness.ts` as project-test default; retains `startDaemon` only for hub-process assertions (startup/shutdown/signals/crash-restart/lock-discovery-PID identity/orphan sweep/watchdog/down-or-unreachable hub CLI), requires naming the lifecycle behavior proved, links docs/agents/tests.md. Independently read that guide at the reviewed head: the default and exception list match directly, including the down/unreachable distinction. No broader lifecycle claim is introduced.

Searched hub/test+nvim/test for clause content/byte budget/default source/parity assertions. The actual role-content and byte-headroom assertions are covered by submitted files: roles checks the delivered base clause bytes against MAX_TEXT_BYTES minus headroom; roles-snapshot/surface/review-qa/skills-qa assert clause policy; permissions checks generated permission parity; rule-sessions tests oversized clause delivery and current rules. The remaining submitted session-brief/Codex/OpenCode files exercise clause/brief delivery. Other generic role-clause event-count tests/fixture-role edits and Neovim's task criterion string mentioning 'clause' do not assert this added text or size, and are not omitted matching content/size guards.

## Local evidence and next gate

**A-3880**, durable copied text of ten whole-file runs, independently parsed: **112tests/112pass/0fail/0cancel/0skip**. Per file roles8,roles-snapshot10,surface3,review-qa3,permissions5,skills-qa16,rule-sessions7,session-brief8,codex-adapter35,opencode-adapter17. Source assertions read directly, including byte-cap guard; no new guard/assertion is requested for this two-line reversible guidance change. Lead reports serial execution, no targeted cancellation from hub restart. Artifact preserves per-file outputs, not a separate load/PID admission transcript.

Source **clear**, with zero findings. Sole C1 combines clause text with runtime test passage; leave final criterion verification pending the requested **no-mode fresh exact-head cland verify** receipt. No criterion failed. Record claimant C1 done when the evidence is ready, then final Reviewer settlement uses that receipt. No full local suite or per-item QA requested. Any changed head requires fresh delta review under rule11.

Primary Coordinator e16eae88-52ea-4122-a8f3-eba2cb591c09 permits review/verify as normal but holds merge until E-425 demo verdict; keep that ordering. Reviewer only reads source/evidence, no tests/compiler/binaries/edits/subagents.

Findings: Standards0; Spec0. Source clear; C1 final runtime verification pending.

Artifact A-3881 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3881-t-588-source-clear-identical-fixture-guidance-in-both-implementer-clauses.md

### impl-588b · 2026-10-16T11:28:25.352Z

Verification 84d72d8f at reviewed eb00ccc5 exited 1; A-3888. Linux hub-only: 1943 passed, 0 test failures, 5 skips. Gate failures: territory-lock executor lock contention test 4/5 load repetitions; three demo-release stop tests exceeded 5-second budgets. Reported these out-of-scope gate failures as shared-defect candidates to lead T-588; diagnosis held for Coordinator triage/shared fix. Source head unchanged.

### rev-30 · 2026-10-16T11:28:50.853Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-588-linux-first
commit: eb00ccc56914ff65fdba5488cbd9f4923c551176
scope: evidence

# T-588 first Linux gate not clear pending outside-failure classification

Unchanged source-reviewed `eb00ccc56914ff65fdba5488cbd9f4923c551176`, local/origin refs agree; branch `t/T-588-the-implementer-clause-names-the-in`. Current claim/C1 and hold checked once. Source A-3881 /rev-20261016-588-source remains clear.

## Standards

No new high/medium/low source findings. Task still contains exactly two identical clause-guidance additions; no assertion or behavior change. Reviewer reads evidence only.

## Spec / owned evidence

Actual Linux **84d72d8f-cf52-4830-8829-7410263afe0f /A-3888**,c-8lon1/x64,Node24.21.0/Neovim pin0.12.5,fourworkers. Exit1:1948tests/1943pass/0functional-fail/5skip.1824.90s,peak15.62,load-gate extra100.70s,lifetime1899s,cost$0.1318. Hub-only selection because unsupported.cland/roles.toml coverage path. Neovim smoke not reached after the hub gate failure; no Neovim success claimed.

Independent raw timing audit confirms **all112 tests across ten clause text/size/parity/delivery files pass ordinarily**, matching A-3880's Mac112/112: roles8,roles-snapshot10,surface3,review-qa3,permissions5,skills-qa16,rule-sessions7,session-brief8,codex-adapter35,opencode-adapter17. Both delivered-clause snapshots/byte-headroom guards pass. No owned test failure or task duration-budget miss. Task adds no new test identity requiring an own five-repeat gate.

## Outstanding gate blockers

Uncapped raw tail contains exactly:
1. **hub/test/territory-lock.test.ts::executor lock wait bounds contention and names the lock and elapsed wait —4/5 load repetitions** (log4559). Ordinary case passed0.2213s. Receipt has no failed repetition assertion detail; do not invent its cause or claim ordinary failure. Bugs/S shared candidate for lead classification (test originates from T-491).
2. Three hard budgets in **hub/test/demo-release.test.ts**:
   - accepted-active deletion exceeds bound/attention+alert **5.737s>5s**;
   - id mismatch even after acceptedDELETE **5.231s>5s**;
   - name mismatch even after acceptedDELETE **6.183s>5s**.
   These are T-583-owned tests outside the clause diff. Tech debt/XS measured shared-allowance candidates; no branch-local allowance or code edit is authorized by this review.

Outside-diff status alone is not gate acceptance. Current supplied topic history contains no primary classification/exception for this exact combination. Evidence verdict **not clear** pending lead/Coordinator classification and admissible gate direction. C1's source/owned runtime evidence is retained, but final verification remains pending. No C1 failure mark solely for outside reds, and no claim that the clause task caused them.

Do not submit an unchanged retry, pick an unposted fix, alter unrelated tests or diagnose the lock case on this branch absent Coordinator direction. No per-item QA. Any changed head needs source delta review before verification. Findings: Standards0; Spec0 source findings; four outside-diff gate failures require disposition.

Artifact A-3889 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3889-t-588-linux-gate-not-clear-112-owned-tests-pass-external-load-and-budget-reds.md

### rev-30 · 2026-10-16T11:30:13.290Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-588-final
commit: eb00ccc56914ff65fdba5488cbd9f4923c551176
scope: evidence

# T-588 final evidence review clear under explicit Coordinator disposition

Reviewed unchanged pushed `eb00ccc56914ff65fdba5488cbd9f4923c551176`, branch `t/T-588-the-implementer-clause-names-the-in`; local/origin exact head confirmed in A-3889 audit. Hold and current claimant/sole C1 checked. Source **A-3881 /rev-20261016-588-source** and detailed raw Linux audit **A-3889** apply; no later head change.

## Standards

No high/medium/low source findings. Exactly one identical fixture-guidance line in each Implementer clause, consistent with docs/agents/tests.md; no permissions, tests or production behavior changed.

## Spec / C1 evidence

Verify **C1**. Mac targeted **A-3880** and actual Linux **A-3888 /84d72d8f** each provide all112 ordinary passes across ten clause-content/byte-budget/parity/delivery files. In particular both delivered-clause snapshots and byte-headroom checks pass after the addition. The wording names projectHub default, lifecycle-only startDaemon exceptions and named behavior, and links the canonical guide. No owned functional failure or new-test gate identity exists.

Actual Linux receipt:1948tests/1943pass/0ordinary-fail/5skip,exit1. c-8lon1/x64,fourworkers,Node24.21.0/Neovim pin0.12.5,lifetime1899s,cost$0.1318,suite1824.90s,peak15.62,extra100.70s. Full raw-tail audit remains A-3889: territory-lock bounded-contention load4/5, ordinary0.2213s pass, failed repetition assertion details absent; three T-583 demo-release hard budgets5.737/5.231/6.183s. These are not hidden or rewritten as an exit0.

## Primary gate disposition

**Direct Coordinator decision31c1c96f-ef8b-4858-8abe-3706e7b45c83** explicitly accepts A-3888 at unchangedeb00ccc5 under rule7, classifies all four outside-diff entries as known/stale-manifest items to be covered by dev's durations refresh from A-3877, and assigns bounded-contention a known-flake follow-up. That is the authoritative acceptance, not an independently inferred diagnosis of the missing repetition assertion. It directs **no new run, no head change**; the refresh is not needed on this branch.

The same primary decision expressly says **no Neovim phase is required for this roles-only task**. Neovim smoke was not reached in the receipt and no success is claimed. The post-merge release-occasion run on dev remains the full integrated cover, Coordinator-owned. This task's disposition does not waive the release cover or authorize a release.

Earlier not-clear A-3889 is superseded by this classification/acceptance without suppressing its recorded outside failures. Final evidence **clear**, C1 verified at exact head. Claimant's C1 done mark was not yet present in the final task read; Coordinator31c1c96f already directs claimant to add it, and this verdict supplies the independent verification rather than making that claimant assertion. No per-item QA; merge/demo/release sequencing remains Coordinator-owned.

Findings: Standards0; Spec0. Read-only Reviewer: no edits/test/compiler/binary/provider calls or subagents.

Artifact A-3890 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3890-t-588-final-clear-clause-tests-pass-coordinator-accepts-outside-gate-reds.md

Criteria: C1 verified.

### coord · 2026-10-16T11:31:10.806Z

Merged 32b4c62f134cddd060045adea590dda58be81e86 onto dev.
