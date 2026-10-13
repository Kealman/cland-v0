---
id: Q-17
kind: question
title: "Process layer: what cland provisions into a project"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: M-1
blocked_by:
  - Q-8
  - Q-10
topic: null
branch: null
created: 2026-10-07T14:52:41Z
updated: 2026-10-08T13:17:15.597Z
github:
  repo: Kealman/cland-v0
  number: 17
  url: https://github.com/Kealman/cland-v0/issues/17
---

## Question

What does cland provision into a project? Decide:

- Which skills ship (based on Matt Pocock's skills, with cland's modifications).
- The `docs/agents` configuration for the chosen tracker.
- Role definitions and the hub connection setup for each harness.
- How a project is initialised, and how provisioned files are updated when cland changes.
- What stays project-owned.

## Comments

### Kealman · 2026-10-07T17:40:59Z

<!-- github-comment: 6043433641 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human. No ADR: provisioning is reversible and explained in `AGENTS.md` itself.

**What cland provisions into a project.**

- Skills: the Matt Pocock set with cland's patches, plus cland's own skills, in `.agents/skills/` as the canonical location with `.claude/skills` as a symlink to it, so Claude Code, Codex and OpenCode all see one set.
- `docs/agents/issue-tracker.md` (the `cland task` CLI, the skills' "other" tracker mode), `docs/agents/domain.md`, `docs/agents/triage-labels.md`.
- `AGENTS.md` with the generic part: you are a cland session; obey hub events; tasks through `cland task`; artifacts through the hub; never push to `github`.
- The roles config with defaults (`.cland/roles.toml`, from #10).
- For Claude Code: hooks in `.claude/settings.json` (`UserPromptSubmit`, `Stop`, `PermissionRequest`, `SessionStart` → `cland hook <event>`) and the cland mod.
- `.cland/.gitignore` for the volatile part of the cland folder, and the folder skeleton.

**`AGENTS.md` only, never `CLAUDE.md`.** cland does not create `CLAUDE.md`, because its presence stops Claude Code from reading `AGENTS.md`. If a project already has `CLAUDE.md`, cland adds one import line, `@AGENTS.md`, and touches nothing else.

**Ownership and updates.** Every provisioned file carries a "managed by cland <version>" mark. `cland init` and `cland update` overwrite only managed files and managed blocks (such as a block inside `AGENTS.md`); everything else in the project is left alone. Project-specific additions live in free sections or separate files.

**Skills: vendored fork plus cland's own.** The Matt Pocock skills are vendored into the cland repo with cland's patches; upstream updates are merged by hand. New cland skills: `qa` (the brief and run protocol from #16), `release` and `merge` (wrappers over the commands from #14), `handover` (the role handover note). Role clauses live in the roles config, not in skills.

**Committed versus not.** Committed: only files without machine paths or secrets: skills, `docs/agents/*`, `AGENTS.md`, the roles config, the Claude Code hooks (they call `cland hook`, which reads the hub location from the discovery file). Not committed: the spoke's MCP configuration (injected at spawn), the discovery file, the secret, the database, artifacts, worktrees, the bare repository.

**Commands.** `cland init`: the folder skeleton, managed files, the git territory from #14, `.gitignore`, the General and Agents topics, the roles config with defaults; idempotent. `cland update`: refresh managed files after a cland version change. `cland doctor`: versions and authentication of the three harnesses, `gh`, Neovim, and the hub's state.

**The cland folder, `.cland/` at the project root** (this resolves the "state layout" fog):

- Committed: `tasks/` (tracker items), `roles.toml`, `config.toml` (hygiene thresholds, artifact cleanup period, defaults).
- Not committed, through a managed `.cland/.gitignore`: `artifacts/`, `worktrees/`, `territory.git/` (the bare repository), `hub.db`, `hub.json` (the discovery file), `secret`, `journal.jsonl`, `log/`.
- Paths: `.cland/tasks/T-123-short-slug.md`; `.cland/artifacts/A-123-short-slug.<ext>`; `.cland/worktrees/T-123/`; task branches `t/T-123-short-slug`.
- Formats: TOML for `config.toml` and `roles.toml`, YAML frontmatter in items, JSON lines for the journal.

**Not decided here.** The exact contents of the role clauses and skill lists (implementation, iterated in use); the mod's installation path for Claude Code (implementation).
