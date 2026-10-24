---
id: T-780
kind: task
title: The install script at cland.app/install.sh
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: null
branch: t/T-780-the-install-script-at-cland-app-install
created: 2026-10-18T06:04:23.227Z
updated: 2026-10-24T09:39:45.535Z
---

## Summary

The landing, the README and the install docs tell Linux users to run `curl -fsSL https://cland.app/install.sh | sh`. The script does not exist.

## What to build

`install.sh`, served by the site at `https://cland.app/install.sh` (from `site/public/`), that installs the released cland on Linux and on macOS without Homebrew.

- It installs a released version, not a checkout of `dev`, and states where it put the `cland` command (`docs/install.md` says `command -v cland` shows it).
- It checks for Node 24 (`>=24.13 <25`) and says how to get it when missing, or brings its own runtime.
- Running it again updates cland, as `docs/install.md` says.
- It is POSIX `sh`, prints what it does, and never uses `sudo` silently.

## Acceptance criteria

- [ ] On a clean Ubuntu LTS and a clean Fedora, the one-line command installs a working `cland` and `cland doctor` runs
- [ ] Running the script again updates to the newest release
- [ ] docs/install.md describes the paths the script uses and how to remove them
