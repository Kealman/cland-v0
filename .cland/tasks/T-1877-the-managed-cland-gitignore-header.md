---
id: T-1877
kind: task
title: The managed .cland/.gitignore header rewrite after a version bump moves the dev tree off its green covers before release
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1536
branch: t/T-1877-the-managed-cland-gitignore-header
created: 2026-11-15T23:32:23.381Z
updated: 2026-11-16T07:46:31.275Z
---

## Summary

On 2026-11-15 the hub restarted on the 0.4.0 build (restart #76) and rewrote the managed header of `.cland/.gitignore` from "managed by cland 0.3.2" to "0.4.0". A release needs a clean root, so the Coordinator committed the header (2939ccc59). The committed tree then left the tree the green stage covers matched (d642982363 → 12278d46): tracker files under `.cland/tasks/` are excluded from that identity, but `.cland/.gitignore` is not. `cland release --item R-1530 --dry-run` refused with `release-t3: no green T3 covers release head`, and the release waited about 45 minutes for one more full release-occasion suite, because of a comment line.

## What to build

Choose and implement one fix. Either the managed header carries no version, so a version bump never rewrites it, or cover and release tree identity excludes `.cland/.gitignore` the same way it excludes the tracker files. Check the other managed files that cland rewrites on start, if any, and say which tree-identity rule covers each.

## Acceptance criteria

- [ ] C1. A hub restart on a new version leaves the dev tree's cover identity unchanged, shown by a test with a fake version bump (test).
  - failed: rev-36 [reviewer] · 2026-11-16T07:46:31.275Z · note Repository tracked ignore header still needs its one-time migration; first new-code startup would dirty/change the covered identity.
- [x] C2. Every file cland rewrites on hub start is listed in the item, with its tree-identity handling (test or doc).
  - done: impl-1877 · 2026-11-16T07:39:17.350Z

## Comments

### impl-1877 · 2026-11-16T07:36:37.851Z

Rule 20 consumer sweep before source change: searched MANAGED_MARK, MANAGED_BY, GITIGNORE, ensureGitignore, ensureSkeleton, literal 'managed by cland' and .cland/.gitignore across hub/src, shared, hub/test (all tiers), nvim/test, web/test, qa and .agents. Migrated init.test.ts's general managed-version assertion and version-bump changed-path expectation, plus QA E-612 V2 expected header/count. Runtime consumers init/provision.ts and cli/secret.ts share the writer/constant and recognize the unchanged prefix. secrets-git.test.ts imports GITIGNORE; scenarios/hub-lifecycle.test.ts asserts prefix only; remaining config/roles/skills/adapters/territory marks retain their versions/bytes and are unaffected. No wire contract changes; older versioned ignore headers remain recognized and migrate once. Choice: versionless header preserves real ignore-policy changes in cover/release identity; excluding the entire ignore file would hide those changes.

### impl-1877 · 2026-11-16T07:37:29.943Z

C2 startup-write inventory (daemon.ts -> ensureSkeleton, configuration/rules/crew start, tracker.start, refreshTerritoryHook): (1) .cland/.gitignore is the only routinely refreshed tracked generated template; retained in candidate/release tree identity, now versionless. An old versioned header migrates once and must be committed before taking new covers. (2) .cland/roles.toml is created if missing and may undergo the existing semantic Aide-tools migration; included in identity, intentionally requiring new covers when its policy changes; no version-only refresh. (3) .cland/crew.toml is created only if absent, included in identity; existing bytes kept. (4) .cland/RULES.md is created only if absent; excluded by verification-tree.ts. (5) .cland/tasks/* status/recovery migrations persist tracker records; excluded by verification-tree.ts. (6) .cland/secret, hub.json (contains runtime version), hub.db plus SQLite sidecars, hub.lock*, log/*, journal.jsonl, run/* (including recovery/session credentials, socket state, checkpoints and caches), and artifacts/* are volatile and ignored by .cland/.gitignore, hence absent from committed identity. (7) .cland/territory.git/hooks/update is refreshed bytewise; the territory and its lock are ignored. Socket files and temporary atomic-write files are volatile too. config.toml is read, not rewritten by startup; AGENTS.md, CLAUDE.md, .claude/settings.json, docs/agents/*, skills/manifests and tasks/.gitkeep are init/update writers, not startup refreshes; their tracked policy/source files remain identity inputs except tracker paths. No other startup template gets a version-only tracked rewrite.

### rev-36 · 2026-11-16T07:46:31.275Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1877-source-1
commit: 7f5440ff919a8a47e1e3c106ed89ad0f79777862
scope: full
findings: [{"severity":"medium","text":"The pinned repository retains a versioned0.4.0 header, so the new startup writer immediately migrates this included tracked file and dirties/changes the same cover identity. No Coordinator deferral is approved (claimant confirmed). Include the repository's one-time versionless migration before new covers and add legacy-header migration coverage; the current new test starts with already-versionless bytes.","file":".cland/.gitignore","line":1},{"severity":"low","text":"Per-test guide omits the new startup/fake-version/ignore-policy regression and its native fixture/control scope. Add its section here under rule16; claimant confirms no existing guide covers it.","file":"docs/agents/tests/hub-test-verification-tree.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":1}

Full Standards/Spec audit A-19843: one medium missing repository migration and one low missing test-guide section. Long-term versionless-header choice otherwise preserves real ignore-policy identity and existing ownership. C2 startup writer/tree-handling inventory traced source-side; no additional version-only tracked template found. A-19839 honest transcribed native/precommit/final-launcher/tracker-merge/publication limits retained. No runtime criteria verified. Repair both, restore C1 done and request fresh source review before configured verification in Coordinator window. Reviewer read-only; no tests/compiler/lint/probe/hub/browser/delegation.

Criteria: C1 failed (Repository tracked ignore header still needs its one-time migration; first new-code startup would dirty/change the covered identity.).
