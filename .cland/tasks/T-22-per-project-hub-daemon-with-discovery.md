---
id: T-22
kind: task
title: Per-project hub daemon with discovery and secret
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: E-19
blocked_by:
  - T-21
topic: null
branch: null
created: 2026-10-08T11:53:30Z
updated: 2026-10-10T00:58:17.321Z
github:
  repo: Kealman/cland-v0
  number: 22
  url: https://github.com/Kealman/cland-v0/issues/22
---

## Parent

Part of #19. Spec sections 4.2 and 4.9; ADR 0003; decision https://github.com/Kealman/cland-v0/issues/13.

## What to build

`cland hub start` from a project's root starts the hub as a daemon for that project: it creates the `.cland/` skeleton (`hub.db`, the discovery file `hub.json` with socket path, port, secret and pid, a generated `secret`, a managed `.cland/.gitignore` covering the volatile files), binds a WebSocket listener on 127.0.0.1 for spokes and a Unix socket for the UI, and keeps running after the client that started it exits. A spoke started in that project finds the hub through the discovery file and authenticates with the secret. `cland hub status` reports whether a hub runs for the project and what is connected; `cland hub stop` stops it and removes the discovery file. Hub state (mutes, counters, registry) survives a restart because it is in SQLite.

## Acceptance criteria

- [ ] Starting the hub twice in one project is idempotent; the second call reports the running daemon
- [ ] A spoke connects using only the discovery file and the secret; a wrong secret is refused
- [ ] The hub outlives the shell that started it; `cland hub status` shows it from a new shell
- [ ] The volatile files are ignored by git through the managed `.cland/.gitignore`; nothing under `.cland/` other than `tasks/`, `roles.toml`, `config.toml` and `.gitignore` is meant to be committed
- [ ] Tests start a real hub in a temporary project and connect a real spoke through discovery

## Comments

### Kealman · 2026-10-08T12:28:29Z

<!-- github-comment: 6059862523 -->

Done on main in commits 8987006..fc4f7b6: cland hub start/status/stop, .cland/ skeleton with hub.json, secret and managed .gitignore, Unix socket for the UI/CLI, spoke discovery, hygiene persisted in SQLite. 57/57 tests. Open: no lock file against two simultaneous starts; hub.db is 0644.
