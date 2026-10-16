---
id: T-603
kind: task
title: Unpinned Claude Code launches set CLAUDE_CONFIG_DIR=~/.claude explicitly and run on an empty profile (signed out, untrusted)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-611
blocked_by: []
topic: topic-387
branch: t/T-603-unpinned-claude-code-launches-set-claude
created: 2026-10-16T11:43:33.915Z
updated: 2026-10-16T17:13:51.197Z
closed: 2026-10-16T17:13:51.197Z
---

## Summary

An unpinned Claude Code launch from the hub sets `CLAUDE_CONFIG_DIR` explicitly to `~/.claude` even when the hub's own environment never had it; Claude Code 2.1.301 treats any explicit value as a separate profile (config in `$CLAUDE_CONFIG_DIR/.claude.json`, keychain item `Claude Code-credentials-<sha256(dir)[:8]>`), so the session runs signed out and without the project's trust. The explicit default must be dropped: pass the variable only when the hub inherited it or the account pins a directory.

## Facts

- `hub/src/adapters/claude-code.ts:226-227` computes `#configDir` as `env.CLAUDE_CONFIG_DIR || ~/.claude` and copies it into the adapter's env only when the hub had it, but `:418` passes `accountEnv: { CLAUDE_CONFIG_DIR: this.#configDir, ...request.accountEnv }` on every launch and `:611` does the same on resume, so the fallback `~/.claude` reaches the child as an explicit setting. Introduced by T-362 (eb32246f, 2026-10-14).
- Verified read-only on this Mac with Claude Code 2.1.301: `claude auth status` reports `loggedIn: true` with the variable unset and `loggedIn: false, authMethod: none` with `CLAUDE_CONFIG_DIR=~/.claude`. `~/.claude/.claude.json` was first created 2026-10-14T06:23Z, about an hour after the merge, and holds no project trust; the project root is trusted only in `~/.claude.json`.
- This matches D36 (docs/spec/v0.1.3.md): the Claude Code Aide launch at the trusted root stopped on the workspace-trust prompt. The trust prompt was a symptom of the empty profile, not the human's missing acceptance.

## Impact

Every Claude Code launch without `account` runs on an empty profile unless the hub's own environment carries `CLAUDE_CONFIG_DIR`. The default Aide launch (no account in roles.toml) is affected; the onboarding flow planned for v0.1.4 (map M-591) launches exactly such an Aide first.

## Fix

Pass `CLAUDE_CONFIG_DIR` to the child only when the hub inherited it (`env.CLAUDE_CONFIG_DIR`) or `request.accountEnv` carries the account's directory; keep `#configDir` for the hub's own bookkeeping (polling schedule per directory, the attach command, the signed-out remedy text), and make the remedy text print the variable only when it is actually set. A test: a launch with a clean hub environment spawns `claude` with no `CLAUDE_CONFIG_DIR`; a pinned account still gets its directory.

Found by the design session's research Q-593 (harness setup facts) under the map M-591.

## Acceptance criteria

- [x] C1. A Claude Code launch and resume from a hub whose environment has no CLAUDE_CONFIG_DIR spawn claude without the variable, and an account-pinned launch still gets its directory, proved by an adapter test against the fake harness.
  - done: impl-603 · 2026-10-16T16:36:26.980Z
  - verified: rev-30 [reviewer] · run rev-20261016-603-final · 2026-10-16T17:12:08.473Z · commit f15ee252b2204a42e23488809695dbb5e06b3805
- [x] C2. The signed-out remedy text and the attach command name CLAUDE_CONFIG_DIR only when it is actually set, and the hub's per-directory bookkeeping is unchanged.
  - done: impl-603 · 2026-10-16T16:09:19.757Z
  - verified: rev-30 [reviewer] · run rev-20261016-603-source · 2026-10-16T16:11:14.629Z · commit 60fe117c2d776161877d9e72dd36a337238df5bb
  - verified: rev-30 [reviewer] · run rev-20261016-603-duration-delta · 2026-10-16T16:36:36.287Z · commit f15ee252b2204a42e23488809695dbb5e06b3805
  - verified: rev-30 [reviewer] · run rev-20261016-603-final · 2026-10-16T17:12:08.473Z · commit f15ee252b2204a42e23488809695dbb5e06b3805

## Comments

### human · 2026-10-16T12:01:35.351Z

A prototype copy of the fix with a test exists on prototype/onboarding at 7acc4890 (hub/src/adapters/claude-code.ts: spawn and resume pass CLAUDE_CONFIG_DIR only when the hub inherited it, an account still brings its directory through accountEnv; the signed-out notice and the launch remedy print the variable only when set; new test in hub/test/claude-code-adapter.test.ts, 10/10 pass). Not covered there: sessions recorded before the change keep the explicit default on relaunch. Cherry-pick or redo as the item's branch.

### impl-603 · 2026-10-16T16:05:27.908Z

Implementation started from the item's prototype reference 7acc4890. Will prove clean launch and relaunch omit the variable, explicit inherited/pinned directories remain, and remedies/attach reflect the actual launch environment. QA policy is none/after-stage.

### impl-603 · 2026-10-16T16:09:46.195Z

Committed and pushed 60fe117c2d776161877d9e72dd36a337238df5bb; review requested from reviewer in topic-387. Evidence A-3970: typecheck exit 0 at committed head, adapter test file 13/13 exit 0, focused account cases 2/2 exit 0, four new tests all <5 s. QA none/after-stage. Awaiting source verdict before same-head cland verify.

### rev-30 · 2026-10-16T16:11:14.629Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-603-source
commit: 60fe117c2d776161877d9e72dd36a337238df5bb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-603 source review

Commit 60fe117c2d776161877d9e72dd36a337238df5bb; fixed point 5d086cfef2dbb3e52d74f7bf5a9fc3593f2d411b. Local and origin branch tips agree. Three files, 75 insertions and six deletions. Reviewed against T-603, docs/spec/v0.1.4.md §3.5 and the existing accounts contract. Both axes performed in-session; role delegation is disabled.

## Standards
No findings. The two private helpers centralize inherited selection and remedy formatting without changing the directory scheduler. The account registry exception is narrowly limited to path-less Claude accounts with no inherited selection; other harnesses, harness mismatch validation and explicit directory checks retain their paths. Shell quoting remains centralized and covers an apostrophe-containing pinned directory. Diff whitespace check passes.

## Spec
The launch overlay now consists of an actual inherited directory plus the account overlay, with the account taking precedence. An unset variable remains absent from the child environment; the bookkeeping fallback is no longer promoted to an explicit child setting. Resume fills only a missing accountEnv using the same inherited-selection helper. Existing saved overlays remain preserved, as the human's prototype note and v0.1.4 §3.5 explicitly permit.

The path-less registry change is required by §3.5: otherwise selectAccount would synthesize ~/.claude before the adapter receives the request. Returning an empty overlay also avoids requiring an explicit-profile directory for the default profile. Named-account authentication-variable stripping remains in the existing execution path.

C2 is established by source. Signed-out notices and failed-account-launch remedies prefix commands only from an actual stored or inherited selection. Existing attach behavior prefixes named account overlays: pinned accounts keep their directory; path-less accounts with an empty overlay add none. Unpinned attach behavior remains unchanged, including its existing reliance on the inherited environment. The scheduler still resolves the same account directory or #configDir fallback, with unchanged per-directory keys, persisted state, polling sharing and signed-out latching.

Four new fake-harness cases exercise unpinned, path-less, pinned and inherited selections through launch, native-conversation relaunch, discovery and stop. They inspect actual recorded invocation environments, require two background launches and a --resume argument, preserve fallback-directory assertions, check applicable attach prefixes, and provoke signed-out notice/remedies. Existing account tests retain authentication stripping and shell-executed pinned attach coverage.

## Validation and limits
A-3970 is a summarized validation note: exact-head root typecheck exit 0, adapter file 13/13 and focused existing account cases 2/2. It reports old-code red→green for absent selection and path-less accounts. New cases measured 4.879, 3.015, 2.649 and 3.428 seconds in that run. These are claimant receipts, not a raw whole-file log bundle; no Reviewer execution occurred.

Source clear, zero findings. C2 source verified. C1 and final runtime acceptance await normal same-head cland verify and its required new-test load repetitions. No per-item QA is required. Previously persisted explicit environments are intentionally not migrated; no claim is made that old rows can be distinguished from an intentional explicit default.

Standards 0 findings; Spec 0 findings.
Artifact: A-3975 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3975-t-603-source-clear-preserve-implicit-claude-profile-selection.md

Criteria: C2 verified.

### rev-30 · 2026-10-16T16:36:01.974Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-603-budget-red
commit: 60fe117c2d776161877d9e72dd36a337238df5bb
scope: evidence
findings: [{"severity":"medium","text":"New unpinned and pathless regression cases exceed the 5 s hard budget at 5.712/5.627 s without reasoned allowances; owned exact-head verification exits 1 despite functional assertions passing.","file":"hub/test/claude-code-adapter.test.ts","line":462}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-603 runtime evidence not clear: new-case duration budgets

Commit 60fe117c2d776161877d9e72dd36a337238df5bb, unchanged from source review A-3975 / rev-20261016-603-source. Exact-head post-source-review droplet f2528a40-2b5c-422f-b06b-f91133ed6128 / A-4017 exits 1.

## Standards
No additional source finding. Functional environment selection, remedies and directory bookkeeping remain source-cleared.

## Spec / gate
M1 — medium — hub/test/claude-code-adapter.test.ts:462: two newly added regression identities exceed the default five-second hard budget and have no reasoned allowances: unpinned 5.711632665 seconds; pathless account 5.627064172 seconds. These are owned task failures, not unrelated known-red exceptions. Correct the measured test budgets with reasons or the demonstrated excess work while retaining the assertions; obtain a new source verdict before another verification run.

Independently checked the full log tail: these are the only hard failures, and Finished is exit 1. Hub free 38/38; hub machine 1909 pass, zero functional failures and five platform/binary skips out of 1914. Overall 1947 pass, zero functional failure, five skips. All four new environment variants pass ordinary assertions and 5/5 repetitions each (20/20); pinned/inherited ordinary times are 3.946/3.806 seconds. This positive behavior evidence does not turn the failed gate green. Neovim smoke was not reached.

C1 runtime acceptance failed for the owned hard-budget gate. C2's existing source verification is retained; no functional C2 defect is claimed. Final review not clear. No unchanged retry requested. Duration-manifest changes still require fresh source review and appropriately accepted execution evidence.

Standards 0 additional findings; Spec/gate 1 medium finding.
Artifact: A-4018 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4018-t-603-runtime-not-clear-two-owned-hard-duration-budgets.md

Criteria: C1 failed (Own new unpinned/pathless regressions exceed 5 s hard budgets (5.712/5.627 s), making exact-head A-4017 exit 1.).

### impl-603 · 2026-10-16T16:36:06.769Z

Linux verify f2528a40 / A-4017: 1947 pass, 0 fail, 5 skipped; all four new cases passed 5/5 repetitions. Exit 1 only for two new duration budgets. Pushed f15ee252 with two reasoned measured allowances, no source/test changes or dev merge. Typecheck exit 0 at new head. Requested fresh source review before same-head droplet verification.

### rev-30 · 2026-10-16T16:36:36.287Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-603-duration-delta
commit: f15ee252b2204a42e23488809695dbb5e06b3805
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-603 duration correction source review

Commit f15ee252b2204a42e23488809695dbb5e06b3805, direct child of 60fe117c2d776161877d9e72dd36a337238df5bb. Local/origin tips agree. Only hub/test/durations.json changes; no dev merge or behavior/test-source change.

## Standards
No findings. The two new allow entries use the exact existing test identities, finite positive measured values (5.711633 and 5.627064 seconds) and specific reasons naming required fake-harness launch/stop/native-conversation relaunch/guidance boundaries. No unrelated allowance or baseline value changes. Diff whitespace check passes; claimant reports exact-head typecheck exit 0 and manifest validation.

## Spec
M1 from A-4018 is corrected in source. Values match the independently audited A-4017 Linux measurements, with all original assertions and ordinary/5-of-5 functional evidence preserved. No duration assertion is deleted and no broad file-budget escape is added.

Original source analysis A-3975 remains current for default/inherited/pinned selection, path-less accounts, remedies and bookkeeping. Refresh C2 source verification to this head.

C1 remains pending the new-head verification gate; the prior red receipt does not become an exit-0 receipt by implication. Its failed mark also cleared claimant done, so the claimant must restore the appropriate C1 done evidence. Source clear allows the requested no-mode --executor droplet verification at f15ee252. Final runtime acceptance, including completing the suite phases, remains unverified until that receipt or an explicit authorized disposition.

Standards 0 findings; Spec 0 findings.
Artifact: A-4020 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4020-t-603-duration-delta-clear-two-measured-regression-allowances.md

Criteria: C2 verified.

### impl-603 · 2026-10-16T17:11:52.955Z

Same-head droplet verify 82acdb0e passed (exit 0) at f15ee252b2204a42e23488809695dbb5e06b3805. A-4049: Linux c-8 lon1, Node v24.21.0, 1964 tests / 1959 pass / 0 fail / 5 skipped; hub-only plus Neovim smoke; lifetime 1411 s, cost $0.0980. Awaiting Reviewer's final same-head evidence verdict; claim retained through merge.

### rev-30 · 2026-10-16T17:12:08.473Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-603-final
commit: f15ee252b2204a42e23488809695dbb5e06b3805
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear T-603 at unchanged delta-reviewed f15ee252b2204a42e23488809695dbb5e06b3805. A-3975 source and A-4020 duration-delta reviews remain applicable; no findings.

Independently inspected durable A-4049, run 82acdb0e-69de-46c0-bce4-adc6e1216f48. Its header names the exact head. Host and remote typechecks complete; hub free 38/38, hub machine 1909 pass/zero fail/five unrelated prerequisite skips, Neovim smoke 12/12. Aggregate 1964 tests, 1959 pass, zero failures, five skips; Finished exit 0. No hard duration or load-gate failure.

C1: all four fake Claude profile cases pass ordinarily and 5/5 each (20/20 repetitions, lines 691–724). Unpinned 6.172 s and pathless account 6.161 s retain actual absence of CLAUDE_CONFIG_DIR through spawn/resume. Pinned 3.827 s and inherited directory 3.804 s preserve the selected environment. The reviewed assertions observe the native fake invocation environment, relaunch/resume, and discovery/stop boundaries.

C2: the same cases exercise signed-out remedies and attach prefixes against actual selected directories. Existing directory scheduling/restart/account cases pass, supporting unchanged per-directory bookkeeping. Source scope intentionally preserves already-persisted explicit account selection as specified; this is not a migration of old session rows.

Five skips concern macOS sandbox/sleep facilities and absent real OpenCode binaries, not owned cases. Linux x64 c-8 lon1, Node 24.21.0, Neovim 0.12.5, four workers; suite 1339.60 s, peak load 15.84, lifetime 1411 s, cost $0.0980. The previous owned budget failures are resolved by the reviewed reasoned allowances and this successful exact-head gate. Both criteria verified; no per-item QA requirement.
Review artifact A-4050.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T17:13:51.197Z

Merged 29aeb96d27aa85f2d11e04119f08ad596261c1a4 onto dev.
