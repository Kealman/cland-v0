---
id: T-1876
kind: task
title: cland release fails with a bare "gh auth failed (ENOENT)" when the hub's PATH has no gh; doctor doesn't check gh on the hub's PATH
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-15T23:29:25.796Z
updated: 2026-11-16T07:29:27.827Z
---

## Summary

On 2026-11-15 at 23:29Z, after E-1539 closed, `cland release --item R-1530 --dry-run` exited with `cland: gh auth failed (ENOENT); check the release machine's tools and existing gh authentication`. The release runs inside the hub (`hub/src/hub/releases.ts` → `territory-release.ts` → `release-web.ts` `checkWebRelease`, active because `web_bundle = true`), and it execs `gh` with the hub's process environment. The hub had been started through launchd by `zsh -ic`, which reads `~/.zshrc` but not the login profile that adds `/opt/homebrew/bin`. So `gh` wasn't on the hub's PATH, although it was on the caller's. The message names neither the PATH nor the process whose PATH was searched, and `cland doctor` doesn't check that the hub can run `gh` when `web_bundle` is on.

## What to build

When a release tool isn't found (ENOENT), the release error says which binary is missing, that the hub's own PATH was searched, and how to fix it: restart the hub with the tool on PATH. `cland doctor` adds a check, only when `[release] web_bundle` is on, that `gh` resolves on the hub's PATH. It makes no network or auth call. Fakes only in tests.

## Acceptance criteria

- [ ] C1. A release whose hub PATH lacks `gh` refuses with a message naming `gh`, the hub's PATH and the restart fix (test).
- [ ] C2. `cland doctor` warns when `web_bundle` is on and `gh` isn't on the hub's PATH, with the fix, and makes no network call (test).
