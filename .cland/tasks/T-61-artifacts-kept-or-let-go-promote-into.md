---
id: T-61
kind: task
title: "artifacts kept or let go: promote into the repo, archive with the topic, delete after the retention period"
state: closed
status: done
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
updated: 2026-10-10T00:58:17.698Z
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

### rev-65 · 2026-10-09T16:02:22.063Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-61-2
commit: f01861726299604397d8e562d8ddf6347c01a343

High none; medium none; low none. Standards 0 (clear); Spec 0 (clear). Both rev-65-61-1 mediums are resolved in git diff c7bdfff f018617.

Retention now relies on the artifact's own archive status/time and promotion/deletion flags, allowing cleanup after topic deletion. Reopen still changes marks atomically and cleanup rechecks/restores after I/O. Publication follows the promotion index commit: a callback failure retains copied bytes and the mark and returns followUp.error. Dispatcher, CLI and Neovim consume that shape. Observer/error-logger faults are isolated, and later subscribers continue; background cleanup error-logger faults cannot stop retry.

Read A-115 and all nine changed files/added regressions. Independent read-only virtual-filesystem probes loaded Store, HubCore and ArtifactLifecycle directly from pinned f018617 into memory while the checkout rebased. Seven cases passed: promotion control, observer/logger isolation, direct publication follow-up, closed/deleted-topic expiry, archive/reopen faults plus reopen before/during unlink, and cleanup publication-fault recovery. Both prior reproductions now meet the required invariants. No suite run or edits; full-suite evidence remains pending on the subsequent rebased head.

Evidence A-116: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-116-t-61-resolution-review-f018617.md.

### rev-65 · 2026-10-09T16:07:15.075Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-61-3
commit: 42a7abcd979d1b6dd75eeb08a25ff4485a9d2f01

High none; medium none; low none. Standards 0 (clear); Spec 0 (clear).

Rebase-resolution review: git range-diff bf37548..f018617 1be69e4..42a7abc maps all three commits. Eleven of the same twenty patch files have identical stable per-file patch-id; the nine shared-file changes were inspected. ArtifactLifecycle is byte-identical to the previously clear head. Duplicate artifact/event definitions resolve to T-60's existing definitions, including guarded updateArtifact; T-61 adds its archive transaction and lifecycle handlers without removing T-60's async create/attachment paths.

Direct byte comparisons confirm T-60's artifact/attached-send handler region, native editable buffer, artifact registration/update, bounded-text Hygiene and draft help remain; T-60 prompt/send and T-70 termination/orphan documentation survive, and T-61 lifecycle documentation matches f018617. Neovim retains draft save/send/attach alongside promotion and deleted/promoted marks. Atomic attached-send/status writes and atomic topic/archive transitions coexist.

Seven pinned in-memory virtual-filesystem probes passed on 42a7abc, including deleted-topic expiry, post-commit publication consistency, observer/logger isolation and reopen during unlink. No suite run or edits; the Implementer's full suite remains running per the request.

Evidence A-118: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-118-t-61-rebase-resolution-review-42a7abc.md.

### impl-61 · 2026-10-09T16:13:43.205Z

Ready for integration at 42a7abcd979d1b6dd75eeb08a25ff4485a9d2f01, rebased once onto landed T-60 and pushed to origin. Typecheck and diff-check pass. One full npm test passed: hub 486 + Neovim 94 = 580 tests, 0 failures or skips. Both project-review findings fixed; fix patch-id unchanged through rebase. Final evidence, changes by file, exact project config/role lines for Coordinator, and deferred T-75 synchronous paths: A-120, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-120-t-61-final-implementation-and-validation-evidence.md.

### coord · 2026-10-09T16:13:51.164Z

Merged 9a95f9995c67b38c33916bac8efb750caeeb4bda onto dev.

### coord · 2026-10-09T16:14:24.263Z

Merged by the Coordinator through `cland merge T-61`: squash 9a95f99 on dev. Gate: review rev-65-61-3 clear on the rebased head 42a7abc (resolution; rev-65-61-2 clear on f018617 for the fix of rev-65-61-1). Suite on 42a7abc: 486 hub + 94 Neovim passed (A-120). qa-12's live matrix passed on 42a7abc (A-119); its verdict lands after the merge. This project's grant and config lines from A-120 are in a8ba2b2. Remaining synchronous permission and journal I/O is T-75. Concurrent parent-directory swaps by other processes are out of scope by the Coordinator's decision; there is a realpath post-check. impl-61 stopped.

### qa-12 · 2026-10-09T16:14:29.766Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-61-1
commit: 42a7abcd979d1b6dd75eeb08a25ff4485a9d2f01

Commit: 42a7abcd979d1b6dd75eeb08a25ff4485a9d2f01. Run: qa-12-61-1. Recorded after integration, as requested.

Ran:
- Read T-61 and checked acceptance criteria and hub/README.md documentation.
- git archive export of the requested head, linked to parent node_modules. npm run typecheck passed.
- Independent live CLI/real-hub matrix in a scratch Git project. CLAND_HUB_FILE, CLAND_SESSION_ID and CLAND_SESSION_NAME unset; role checks explicitly supplied each scratch spoke's identity. Exercised cland task list/create/view/close.
- cland artifact promote A-1 docs/x.md copied an eight-byte binary fixture exactly, retained its source, and listed promoted: docs/x.md. HEAD, index entries and git write-tree remained identical; porcelain status showed only the new untracked docs/x.md.
- Existing destination, absolute path outside the project, ../ escape, .cland/ destination and symlinked parent to a separate outside directory were refused. Existing bytes remained unchanged, outside directory stayed empty, and no promotion mark was recorded.
- Connected actual Implementer, Reviewer and QA spokes and ran the promote CLI with their session identities: all returned forbidden and created no destination. Separately verified the positive Coordinator spoke-shell grant, which copied the exact bytes successfully. Promotion is a CLI/UI operation, so these checks exercised its role table through that documented interface.
- One headless Neovim using the project's nvim_input/screenstring harness: p in the topic artifact list prompted for a path, promoted the file, and updated the list and picker marks.
- Closing a topic archived its unpromoted artifact with archivedAt while its promoted artifact remained shared. A reopening message returned the ordinary artifact to shared and removed archivedAt. Closing the bound item archived it again.
- cland init wrote [artifacts] retention_days = 30. cland update preserved changed values 7 and 0.
- With retention_days = 0, restarted the hub while keeping the same Neovim process open. Startup cleanup deleted archived files from a closed topic and a topic that had been closed then deleted. Both index entries remained and CLI list, live Neovim list and picker displayed file deleted; opening the deleted picker entry was refused with artifact: file deleted.
- Promoted source files and repository copies survived, as did files in open topics. A reopening message after deletion retained the deleted entry without claiming its bytes were restored.

Shared full suite: read A-120, impl-61's final-head evidence, also relayed by Coordinator. npm run typecheck passed; npm test exit 0, 486/486 hub + 94/94 Neovim = 580 passed, zero failures/cancellations/skips. Suite duration 555.39s, lock wait 0.01s, peak 1m load 10.15. No duplicate full suite run.

Findings by severity: high none; medium none; low none in the requested scope.

Raw evidence A-119: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-119-t-61-independent-live-promote-archive-retention-qa-evidence.zip. Contains independent drivers, CLI/Git responses, screenstring grids, artifact state transitions, journal, typecheck output and cleanup evidence. SHA256 2828e4f3fa25c145c1818fc7d959cb41098777f69b1673f334fef3053dd6b45b.

Cleanup verified all eight owned process IDs absent and all three scratch roots removed. Export/staging removed after verifying the durable artifact hash; task worktree clean. No product fixes.
Summary A-121: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-121-t-61-qa-clear-on-42a7abc.md.
