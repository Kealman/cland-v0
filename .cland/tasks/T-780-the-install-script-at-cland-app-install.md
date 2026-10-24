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
topic: topic-954
branch: t/T-780-the-install-script-at-cland-app-install
created: 2026-10-18T06:04:23.227Z
updated: 2026-10-24T09:42:07.386Z
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

- [ ] C1. Against a local fake release (file:// tarball or local HTTP, sealed scratch HOME and prefix), the script installs a working `cland` from the tag source, including the built web client, without sudo, and prints where it put the command (test).
- [ ] C2. Running the script again against a newer fake release updates the install in place (test).
- [ ] C3. With Node missing or outside `>=24.13 <25`, the script stops before changing anything and says how to get Node 24 (test).
- [ ] C4. docs/install.md describes the paths the script uses and how to remove them (docs).

Landing evidence, not a merge condition: the one-line command on a clean Ubuntu LTS and a clean Fedora droplet, recorded under E-778 C2.

## Comments

### impl-780 · 2026-10-24T09:41:34.209Z

Implementation started. Assigned test seam: POSIX installer CLI against sealed local fake releases with scratch HOME/PREFIX, proving install, update, and Node rejection. Checking release artifact contract because tagged source omits web/dist; clean Ubuntu/Fedora runs remain post-landing evidence per launch brief.
