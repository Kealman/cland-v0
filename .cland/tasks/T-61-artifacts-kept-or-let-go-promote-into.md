---
id: T-61
kind: task
title: "artifacts kept or let go: promote into the repo, archive with the topic, delete after the retention period"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: null
parent: T-20
blocked_by:
  - T-55
topic: topic-29
branch: t/T-61-artifacts-kept-or-let-go-promote-into
created: 2026-10-09T08:34:54.761Z
updated: 2026-10-09T15:52:33.556Z
---

## Parent

Part of T-20 (slice 2, ticket 8 of 12). Spec sections 4.8 and 7(b).

## What to build

Promote: `cland artifact promote A-3 docs/design/merge-flow.mmd`, and `p` in the topic's artifact list, copy the file (T-55) to a project path, record the path in the index and commit nothing. Promoting is the human's, and the Coordinator's from its shell through a new `artifact.promote` grant. A promoted artifact is never archived or deleted. Archive: closing a topic, by the human or by closing its bound item, archives its artifacts, and a message that reopens the topic brings back those whose files remain. Cleanup: at hub start and daily, the files of artifacts archived longer than `[artifacts] retention_days` are deleted (default 30, written to `config.toml` by `cland init` and kept by `cland update`); their index entries stay, shown as "file deleted".

## Acceptance criteria

- [ ] `cland artifact promote A-1 docs/x.md` creates `docs/x.md` with the artifact's bytes, `cland artifact list` shows `promoted: docs/x.md`, and git is untouched. A path that exists, lies outside the project or lies under `.cland/` is refused.
- [ ] Closing a topic, or its bound item, marks its artifacts `archived`; a message that reopens the topic marks them `shared` again.
- [ ] With `retention_days = 0`, a hub restart deletes an archived artifact's file and keeps its entry, shown as "file deleted" in the list and the picker; promoted artifacts and those of open topics stay.
- [ ] `config.toml` holds `[artifacts] retention_days = 30` after `cland init`, and `cland update` keeps a changed value.
- [ ] An Implementer, Reviewer or QA promoting is refused by the permission table.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents promote, archive and cleanup.

## Notes

Test seam: the CLI and frames against a real hub in a temp project; a headless Neovim for `p` and the marks. Size M. Implementer: Codex gpt-6.1-sol.

## Comments

### coord · 2026-10-09T08:39:13.389Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/56 (a sub-issue of #20; the item is the source of truth).

### impl-61 · 2026-10-09T15:20:37.839Z

Starting implementation at the spec's agreed seams: CLI and frames against a real hub, plus headless Neovim. Checking async request scopes, promotion confinement/failure rollback, and cleanup/reopen races before implementation.

### impl-61 · 2026-10-09T15:29:47.597Z

Promotion, close/reopen, bound-item close, and zero-day restart cleanup pass targeted frame/CLI tests. Failure and ordering tests also exercise the hub's existing prune job seam, injecting deferred filesystem operations and SQLite failure triggers at system boundaries. Cleanup retains a hard link until the delete/index commit finishes, restoring bytes after a reopen or failed index write.

### impl-61 · 2026-10-09T15:45:46.839Z

Implementation committed; internal standards/spec review artifacts are A-106 and the await/failure matrix is A-103 in the item topic. The post-copy realpath regression test passed after reproducing an escaped destination. Project review is now on the frozen head; waiting for T-60 to land before the single rebase and final full suite. Existing synchronous role/journal calls stay deferred to T-75.

### rev-65 · 2026-10-09T15:52:33.556Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-61-1
commit: c7bdfff575390c8ded0936228000042b64156ac4

Medium — hub/src/hub/artifact-lifecycle.ts:118: Close then delete a topic retains archived artifact files/index entries, but every retention sweep skips them because the topic no longer exists; expired files therefore leak indefinitely. Treat absent topics as eligible for already archived entries while preserving reopen protection.

Medium — hub/src/hub/artifact-lifecycle.ts:101: An escaping publication callback failure after updateArtifact commits enters rollback and deletes the destination, leaving promoted recorded and retries refused as already promoted; preserve committed bytes after the index commit. The real HubCore route was exercised with both subscriber and error-logger faults; ordinary subscriber exceptions alone are caught.

Standards: 0 findings. Spec: 2 medium findings. Read-only, in-memory probes reproduced both cases with normal promotion/cleanup controls passing. No suite run, as requested. Evidence and full probe: A-111, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-111-t-61-review-c7bdfff-rev-65-61-1.md. Existing role/journal synchrony and concurrent adversarial parent swaps remain outside this review's requested scope.
