---
id: Q-592
kind: question
title: "Install from the GitHub tag: one command on a fresh machine"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.147Z
updated: 2026-10-16T11:57:31.464Z
closed: 2026-10-16T11:57:31.464Z
---

## Question

Does one install command on a fresh machine with only Node 24 and git produce a working `cland`? Try `npm install -g github:Kealman/cland-v0#<tag>` (and the `git+ssh://` form if the repository is private) against an isolated npm prefix and HOME on this machine, never the real global prefix, with the local checkout path as a proxy when GitHub is unreachable: the root package.json `bin`, the workspaces, production dependencies, type stripping, the sh wrapper, the pinned Neovim download on first `cland open`, `cland --version`, then `cland init` and `cland doctor --json` in a scratch project. Record what fails (nested `hub/` dependencies, the version stuck at 0.1.0, files missing from the package) and the fix each needs; recommend the one install line for the first page of the docs and whether `cland release` must bump the package version. Deliver `docs/research/install-from-github.md` on research/install-from-github and the resolution comment here.

## Comments

### human · 2026-10-16T11:57:31.373Z

## Resolution

No `npm install -g` form produces a working `cland` from v0.1.2 or dev today; the causes are known and a prototype with the fixes installs from a git URL in 7 s on a cold cache and runs `cland --version`, `cland init` and `cland doctor --json`. Document: `docs/research/install-from-github.md` on research/install-from-github (87b77611).

What works today, verified on v0.1.2 with a local URL standing in for GitHub: `git clone --depth 1 --branch v0.1.2 https://github.com/Kealman/cland-v0.git ~/.local/share/cland && npm --prefix ~/.local/share/cland ci --omit=dev && npm install -g ~/.local/share/cland` (init works, doctor exits 0 once Neovim is downloaded, `--version` says 0.1.0).

The install line for the first page once the fixes ship: `npm install -g github:Kealman/cland-v0#vX.Y.Z`.

Failures and the fix each needs:
1. The root `workspaces` field makes npm prepare the git dependency; under `-g` the nested install links the temporary clone globally and the clone is deleted, npm exits 0 (npm/cli#3692, #4148). Fix: no workspaces and no install-time scripts in the root manifest.
2. Node refuses to strip types under node_modules. Fix: a JS bin launcher with a `module.registerHooks` load hook calling `stripTypeScriptTypes` (both Stability 1.2 in Node 24); the hook must reach every spawn site (adapter CLI and spoke entries, hub serve, the suite worker and recovery, the watchdog, cland-nvim, the Lua cland command, the QA stub hub), about eight places.
3. The hub's dependencies live only in hub/package.json and are never installed. Fix: root dependencies.
4. The root manifest has no version, so `npm pack` refuses it; the package carries the whole repository (1,200 files, 22 MB, `.cland/tasks` included). Fix: a root version and a `files` allowlist (353 files, 3.4 MB).
5. The pinned Neovim cache sits in the package folder: every upgrade deletes it and a root-owned prefix gets EACCES; cland-nvim runs nvim-path.ts with plain node. Fix: a per-user cache under XDG_CACHE_HOME and the resolver run through the hook.
6. The repository is private: a machine without credentials gets exit 128 "Permission denied (publickey)". Fix: make it public, or document a credential helper or an SSH key.
7. The sh wrapper hub/bin/cland breaks through a symlink: keep it off `bin`.
Also: 6 of 94 transitive dependencies float and a shipped shrinkwrap is ignored; on a bare machine doctor fails 9 checks because each missing harness counts.

Version: every tag from v0.0.1 to v0.1.2 reports 0.1.0 and spoke.ts hardcodes 0.1.0; the version stamps managed files and drives doctor's update and restart advice. Rule: the root package.json version is the only source and equals the tag; `cland release` refuses with `release-version` when dev's version differs; the bump is a commit merged before the dry run, release does not write it.

Not tested: `cland open`, hub start and the Claude Code plugin from an installed copy.
