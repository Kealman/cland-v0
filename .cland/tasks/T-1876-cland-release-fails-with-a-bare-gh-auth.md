---
id: T-1876
kind: task
title: cland release fails with a bare "gh auth failed (ENOENT)" when the hub's PATH has no gh; doctor doesn't check gh on the hub's PATH
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1535
branch: t/T-1876-cland-release-fails-with-a-bare-gh-auth
created: 2026-11-15T23:29:25.796Z
updated: 2026-11-16T07:40:09.635Z
---

## Summary

On 2026-11-15 at 23:29Z, after E-1539 closed, `cland release --item R-1530 --dry-run` exited with `cland: gh auth failed (ENOENT); check the release machine's tools and existing gh authentication`. The release runs inside the hub (`hub/src/hub/releases.ts` → `territory-release.ts` → `release-web.ts` `checkWebRelease`, active because `web_bundle = true`), and it execs `gh` with the hub's process environment. The hub had been started through launchd by `zsh -ic`, which reads `~/.zshrc` but not the login profile that adds `/opt/homebrew/bin`. So `gh` wasn't on the hub's PATH, although it was on the caller's. The message names neither the PATH nor the process whose PATH was searched, and `cland doctor` doesn't check that the hub can run `gh` when `web_bundle` is on.

## What to build

When a release tool isn't found (ENOENT), the release error says which binary is missing, that the hub's own PATH was searched, and how to fix it: restart the hub with the tool on PATH. `cland doctor` adds a check, only when `[release] web_bundle` is on, that `gh` resolves on the hub's PATH. It makes no network or auth call. Fakes only in tests.

## Acceptance criteria

- [x] C1. A release whose hub PATH lacks `gh` refuses with a message naming `gh`, the hub's PATH and the restart fix (test).
  - done: impl-1876 · 2026-11-16T07:40:05.621Z
- [x] C2. `cland doctor` warns when `web_bundle` is on and `gh` isn't on the hub's PATH, with the fix, and makes no network call (test).
  - done: impl-1876 · 2026-11-16T07:40:09.635Z

## Comments

### impl-1876 · 2026-11-16T07:34:07.648Z

Contract sweep before edits: searched hub.status, HubStatus, checkWebRelease, AssetCommand, checkToolchain and ToolchainRequirements across hub/web/nvim/shared, skills, QA and docs including all test tiers; inventory at worktree .cland/T-1876-consumers.txt. Plan: additive opt-in hub.status releaseTools boolean and optional releaseTools.gh resolution result. Existing production clients, startup probes, persisted readers, socket fixtures and all prior status requests retain their exact shape; only doctor opts in. Prior wire shape gets an explicit client regression (missing result stays unknown). No existing fields, notices, admission or outcome classes change.
