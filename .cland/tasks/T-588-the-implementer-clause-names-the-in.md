---
id: T-588
kind: task
title: The Implementer clause names the in-process test hub and the startDaemon lifecycle-only line
state: open
status: review
size: XS
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
updated: 2026-10-16T10:56:01.633Z
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

- [ ] C1. Both Implementer clauses carry the in-process default and the startDaemon lifecycle-only line, worded consistently with docs/agents/tests.md, and every test file asserting clause text or size passes.

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
