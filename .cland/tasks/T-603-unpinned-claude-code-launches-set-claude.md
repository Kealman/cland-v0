---
id: T-603
kind: task
title: Unpinned Claude Code launches set CLAUDE_CONFIG_DIR=~/.claude explicitly and run on an empty profile (signed out, untrusted)
state: open
status: review
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
updated: 2026-10-16T16:11:14.629Z
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
  - done: impl-603 · 2026-10-16T16:09:19.174Z
- [x] C2. The signed-out remedy text and the attach command name CLAUDE_CONFIG_DIR only when it is actually set, and the hub's per-directory bookkeeping is unchanged.
  - done: impl-603 · 2026-10-16T16:09:19.757Z
  - verified: rev-30 [reviewer] · run rev-20261016-603-source · 2026-10-16T16:11:14.629Z · commit 60fe117c2d776161877d9e72dd36a337238df5bb

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
