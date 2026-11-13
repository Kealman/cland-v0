---
id: T-1844
kind: task
title: A local merge batch checkout has no node_modules, so dependency-reading tests fail
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-13T16:36:17.739Z
updated: 2026-11-13T16:36:17.739Z
---

## Summary

With `[verification] executor = "local"`, a merge batch runs in a bare `git worktree add --detach` checkout under `.cland/run/merge-batches/<id>` (`checkoutMergeBatch` in `hub/src/hub/merge-batch-territory.ts`), which has no `node_modules` of its own. Most tests pass only because Node's resolution climbs to the root's `node_modules`. Tests that read `<tree>/node_modules/…` directly, or copy the runtime outside the root, fail. Batch 6aafd978 for T-1827 (run 1b02c42a, log A-19194, 1 worker, darwin arm64, Web not run) failed 11 tests this way.

## Evidence (A-19194)

- `suite-admission-native` (2): `ENOENT … realpath '…/.cland/run/merge-batches/6aafd978…/node_modules/@modelcontextprotocol/sdk'`.
- `host-runtime-delivery` C1-C3: `ERR_MODULE_NOT_FOUND: Cannot find package '@modelcontextprotocol/sdk' imported from /private/tmp/cland-suite-…/…/.runtime-…/hub/src/spoke/spoke.ts`.
- `claude-code-remote` T-1730 C2, plus the claude-code cases of `login-resignin-native` and `login-signed-out-native`: "Claude launch cleanup incomplete: worker identity unavailable".
- The opencode and codex cases of the same files: "exact native signal persisted on its login: not within 15000 ms". These are likely the same missing-dependency start failure; not yet proven.

The same identities also failed in batch 35865a52 (4 workers, A-19192), alongside extra load timeouts. The droplet executor installs dependencies into its delivered tree, so droplet batches are unaffected. A local batch never got Web either: "playwright-core is not installed" in that tree.

## What to build

A local merge batch (and a local periodic dev T3 run) gets the same dependencies the root's verify runs have: its tree resolves `node_modules` (including Web's playwright-core) as a root verify would. The cleanup must leave the root's `node_modules` untouched. A local batch whose dependencies cannot be provided ends as inconclusive with that reason, never as a red batch that drops its members.

## Acceptance criteria

- [ ] C1. A local merge-batch checkout resolves `<tree>/node_modules/@modelcontextprotocol/sdk` and the Web tier's browser dependency, and its removal leaves the root's `node_modules` intact (test).
- [ ] C2. A local batch whose tree cannot get its dependencies holds as inconclusive naming the missing dependency, and its members stay queued (test).
