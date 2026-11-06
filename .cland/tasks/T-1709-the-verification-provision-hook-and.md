---
id: T-1709
kind: task
title: The `[verification] provision` hook, and Neovim and Chromium leave the recipe
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1402
branch: t/T-1709-the-verification-provision-hook-and
created: 2026-11-06T10:47:58.346Z
updated: 2026-11-06T10:50:33.745Z
---

## Summary

`[verification] provision` names a script the executor's image builder runs once as root, after the recipe and before `prepare` runs as `runner`. The snapshot key drops its Neovim pin and gains the hook's content digest. This project's own hook installs its Chromium runtime libraries and its pinned Neovim, which leave `provision.sh` in the same change, so the executor's droplet snapshot keeps passing this project's suites.

Hot files: `hub/src/executor/droplet/provision.sh`, `hub/src/executor/droplet/prepare.ts` (`PrepareKey`, `prepareKey`, `sameKey`, `staleParts`), `hub/src/init/config.ts` (`[verification]`), `hub/bin/verify-prepare.ts`, this project's hook script (new), `.cland/config.toml`, `hub/test/executor-prepare.test.ts`

## What to build

- the config key, with its template comment;
- the builder step that copies the hook and runs it as root, its output logged with `executor-prepare-install`;
- the key change and its staleness report;
- `verify-prepare.ts` reading a key without `nvim`;
- this project's hook with the Neovim tag and digest embedded, so that a pin change changes the hook's content.

Notes: `provision.sh` is read from the running hub's code, so the new recipe and key take effect at the hub restart after landing, which triggers one snapshot rebuild. The Coordinator restarts and watches the first droplet run before any batch relies on it (epic constraint "The executor stays green").

## Acceptance criteria

- [ ] C1. On the scripted machine, the builder runs the hook as root before `prepare` runs as `runner`, and a failing hook fails the prepare with its output (test).
- [ ] C2. The snapshot key carries the hook's content digest and no Neovim field, and editing one byte of the hook marks the snapshot stale with `provision` named in its stale parts (test).
- [ ] C3. `provision.sh` installs no `nvim` and none of the Chromium runtime packages (test).
- [ ] C4. This project's hook installs those Chromium packages and the Neovim tag and digest of `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, which a test keeps equal (test).
- [ ] C5. `cland config` documents `[verification] provision`, and a project without it prepares exactly as before apart from the key (test).
