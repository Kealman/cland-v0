---
id: T-1714
kind: task
title: One image recipe with an architecture parameter
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1709
topic: null
branch: null
created: 2026-11-06T10:48:27.331Z
updated: 2026-11-06T10:48:27.331Z
---

## Summary

`provision.sh` becomes one recipe rendered by a function of the CPU architecture (`x86_64` or `arm64`), the Node version and, for agent hosts, the pinned harness versions. Its base holds only what cland needs on any project: Ubuntu with the apt timers off, git, curl, ca-certificates, jq, lsof, procps, xz-utils, locales, the hub's exact Node, the `runner` user, build-essential and python3. The agent-host part adds the harness installers on pinned channels: OpenCode 2 only from `https://opencode.ai/v2/install`, never npm's `opencode-ai`. The executor's builder renders the base.

Hot files: `hub/src/executor/droplet/provision.sh` (becomes the recipe), `hub/src/image/recipe.ts` (new), `hub/src/executor/droplet/prepare.ts`, `hub/test/image-recipe.test.ts` (new)

## What to build

`renderRecipe({ arch, node, harnesses? })` returning the script. The executor builder calls it with its machine's architecture and no harnesses. An unknown architecture is refused. Decision (coord, open question 2): the harness pins live in `[hosts] harnesses = { opencode = "…", codex = "…", "claude-code" = "…" }`, defaulting to the doctor's tested minimums.

## Acceptance criteria

- [ ] C1. The recipe rendered for `x86_64` downloads `node-<v>-linux-x64.tar.xz` and checks it against `SHASUMS256.txt`, and the one for `arm64` does the same with `node-<v>-linux-arm64.tar.xz` (test).
- [ ] C2. Neither rendering names `nvim` or any Chromium runtime package, and the base names each listed package (test).
- [ ] C3. The agent-host rendering installs OpenCode from `https://opencode.ai/v2/install` at its pinned version, Codex and Claude Code at their pinned versions, and never the npm `opencode-ai` package (test).
- [ ] C4. An architecture other than `x86_64` or `arm64` is refused before rendering (test).
- [ ] C5. The executor's rendered base for its x86_64 builder is byte-identical to the provision-hook ticket's `provision.sh` apart from the template mechanics, so its snapshot key does not change (test).
