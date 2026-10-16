---
id: Q-592
kind: question
title: "Install from the GitHub tag: one command on a fresh machine"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.147Z
updated: 2026-10-16T11:26:12.152Z
---

## Question

Does one install command on a fresh machine with only Node 24 and git produce a working `cland`? Try `npm install -g github:Kealman/cland-v0#<tag>` (and the `git+ssh://` form if the repository is private) against an isolated npm prefix and HOME on this machine, never the real global prefix, with the local checkout path as a proxy when GitHub is unreachable: the root package.json `bin`, the workspaces, production dependencies, type stripping, the sh wrapper, the pinned Neovim download on first `cland open`, `cland --version`, then `cland init` and `cland doctor --json` in a scratch project. Record what fails (nested `hub/` dependencies, the version stuck at 0.1.0, files missing from the package) and the fix each needs; recommend the one install line for the first page of the docs and whether `cland release` must bump the package version. Deliver `docs/research/install-from-github.md` on research/install-from-github and the resolution comment here.
