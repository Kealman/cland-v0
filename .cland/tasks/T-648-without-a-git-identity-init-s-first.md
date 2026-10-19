---
id: T-648
kind: task
title: Without a Git identity, init's first commit is made as cland <cland@local>
state: open
status: in progress
size: XS
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-646
topic: topic-542
branch: t/T-648-without-a-git-identity-init-s-first
created: 2026-10-16T16:23:59.985Z
updated: 2026-10-19T01:55:58.696Z
---

## Summary

A machine without `user.name` and `user.email` (a fresh droplet, a new laptop) no longer stops init at the first commit: init commits as `cland <cland@local>` and says so in its report (Q-599 resolution 1, question 8). The machine's Git configuration is not changed.

## What to build

- In `commitClandFiles` (`hub/src/init/repository.ts`): when no identity is set explicitly (no `user.name` or `user.email` in any Git configuration Git reads for the folder, and no `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_*` or `EMAIL` in the environment), the commit runs with `-c user.name=cland -c user.email=cland@local`. A name guessed by Git from the login and host name does not count as an identity, so the result is the same on every machine (an open question in the README).
- No `git config` write, local or global.
- The report line of the first commit ends with `as cland <cland@local>: no Git identity is set` when the fallback was used.
- The hub README names the fallback.

## Acceptance criteria

- [ ] C1. On ticket T-639's machine made with `identity: false`, `cland init` in an empty folder succeeds, and `git log -1 --format='%an <%ae>|%cn <%ce>'` prints `cland <cland@local>|cland <cland@local>` (init-first-commit.test.ts).
- [ ] C2. The repository's and the scratch machine's Git configuration files are unchanged: neither gains a `user` section.
- [ ] C3. With `identity: true` the commit carries the configured name and email, and the report does not name the fallback.
- [ ] C4. The fallback's report line says that no Git identity is set.
