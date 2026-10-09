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
topic: null
branch: null
created: 2026-10-09T08:34:54.761Z
updated: 2026-10-09T08:39:13.389Z
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
