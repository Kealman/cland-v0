---
id: T-38
kind: task
title: Migration of GitHub Issues into .cland/tasks
state: open
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
updated: 2026-10-08T13:17:15.606Z
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
