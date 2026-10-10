---
id: T-38
kind: task
title: Migration of GitHub Issues into .cland/tasks
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-37
topic: null
branch: null
created: 2026-10-08T11:55:26Z
updated: 2026-10-10T00:58:17.473Z
github:
  repo: Kealman/cland-v0
  number: 38
  url: https://github.com/Kealman/cland-v0/issues/38
---

## Parent

Part of #19. Spec section 6 (tracker bootstrap); decision https://github.com/Kealman/cland-v0/issues/18.

## What to build

A one-shot migration `cland task import-github` that reads this repo's GitHub Issues (open ones by default, all with a flag) and writes them as items: title, body, labels, state, sub-issue parents, blocked-by edges, comments with author and time, and the issue number kept in the frontmatter for reference. Running it on the cland project itself moves the open work (the slice epics and their tickets) into `.cland/tasks`, after which `docs/agents/issue-tracker.md` in this repo switches to the own tracker. The import is idempotent: re-running updates items that already carry the issue number.

## Acceptance criteria

- [ ] Importing a test repository with sub-issues and blocked-by edges reproduces parent and `blocked_by` in the frontmatter and the comments in the files
- [ ] Re-running the import changes nothing when GitHub has not changed
- [ ] Run once on the cland repo: every open issue has an item, and `docs/agents/issue-tracker.md` on `main` describes `cland task`
- [ ] The run and its counts are recorded in a comment on this ticket

## Comments

### Kealman · 2026-10-08T13:19:05Z

<!-- github-comment: 6060763048 -->

## Import run on this repo (2026-10-08)

Branch `worktree-agent-a01aac6285c9ae2b5` (not merged yet), in that worktree:

```sh
node hub/bin/cland.ts hub start
node hub/bin/cland.ts task import-github --repo Kealman/cland-v0 --all
node hub/bin/cland.ts task import-github --repo Kealman/cland-v0 --all   # idempotence check
node hub/bin/cland.ts hub stop
```

**First run:** 42 issues, 0 pull requests skipped. **Created 42, updated 0, unchanged 0, comments added 31.**
**Re-run:** created 0, updated 0, unchanged 42, comments added 0. The 42 files were byte-identical before and after (shasum).

- **Open and closed:** I imported with `--all`. All 20 open issues have an item, and so do the 22 closed ones (the map's decision record and the finished slice-1 tickets). That way every parent and `blocked_by` edge GitHub reports points at an item. For example `T-23` is blocked by `T-22` (closed). Without `--all`, an edge to an issue that was not imported is kept as `github:#<n>`, and a later run that does import that issue resolves it.
- **Ids:** the issues were numbered oldest first and the repo has no PRs, so every issue got the id of its number: `T-1`…`T-42` ↔ #1…#42.
- **Kinds:** 2 `epic` (#19, #20), 1 `map` (#1), 16 `question` (`wayfinder:research/grilling/prototype`), 23 `task` (including #6, `wayfinder:task`, which follows the own-tracker template).
- **Edges:** 41 items have a parent (#2–#18 under `T-1`, #21–#42 under `T-19`). The blocked-by edges match GitHub. For example #38 → `T-37`, and #42 → `T-31, T-33, T-34, T-36, T-38, T-40, T-41`.
- **Frontmatter:** each item carries `github: {repo, number, url}`.
- **Committed:** `.cland/.gitignore` and the 42 `.cland/tasks/*.md` files. `hub.db`, `hub.json`, `secret` and `log` are ignored.
- **Tracker doc:** `docs/agents/issue-tracker.md` now describes `cland task`. GitHub Issues remain the human-facing mirror until slice 1 is done, and `import-github --all` refreshes the items from them.

### Kealman · 2026-10-08T13:20:55Z

<!-- github-comment: 6060795716 -->

Done on main (merge c072ad3): cland task import-github with a fake-gh test suite, the real run imported all 42 issues as T-1..T-42 (idempotent re-run byte-identical), docs/agents/issue-tracker.md and AGENTS.md now describe cland task with GitHub Issues as the mirror until slice 1 is done.
