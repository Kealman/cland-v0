---
id: T-39
kind: task
title: cland init and managed files
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-24
  - T-29
  - T-37
topic: null
branch: null
created: 2026-10-08T11:55:33Z
updated: 2026-10-08T13:17:15.606Z
github:
  repo: Kealman/cland-v0
  number: 39
  url: https://github.com/Kealman/cland-v0/issues/39
---

## Parent

Part of #19. Spec section 4.9; decision https://github.com/Kealman/cland-v0/issues/17.

## What to build

`cland init` prepares a project in one idempotent command: the `.cland/` skeleton with the managed `.gitignore`, `config.toml` and `roles.toml` with defaults, the General and Agents topics, the skills installed under `.agents/skills` with `.claude/skills` as a symlink, `docs/agents/issue-tracker.md`, `domain.md` and `triage-labels.md`, an `AGENTS.md` managed block with the generic cland instructions (obey hub events, tasks through `cland task`, artifacts through the hub, pushes to GitHub only on the Coordinator's explicit decision in slice 1), the Claude Code hooks in the project settings calling `cland hook`, and the cland mod. No `CLAUDE.md` is created; if one exists, an `@AGENTS.md` import line is added. Every managed file or block carries a "managed by cland <version>" mark; `cland update` refreshes managed content and touches nothing else. Committed files never contain machine paths or secrets.

## Acceptance criteria

- [ ] `cland init` on an empty repo and on a repo with its own `AGENTS.md`, `CLAUDE.md` and `.claude/settings.json` leaves user content intact and adds only managed parts
- [ ] Running `cland init` twice changes nothing; `cland update` after a version bump rewrites only managed parts
- [ ] A session launched in the initialised project reads the generic instructions from `AGENTS.md` under all three harnesses (Claude Code through the import when `CLAUDE.md` exists)
- [ ] `git status` after init shows only the committed set (`tasks/`, `roles.toml`, `config.toml`, `.gitignore`, skills, docs, `AGENTS.md`, hooks)
- [ ] Tests run init and update on fixture repos and diff the results
