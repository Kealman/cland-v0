---
id: T-324
kind: task
title: "The release row shows its version: R-228 0.1.2 Working with items (T-269 DoD gap)"
state: open
status: backlog
labels:
  - v0.1.2
  - nvim
  - hub
  - ready-for-agent
assignee: null
parent: E-269
blocked_by: []
topic: null
branch: null
created: 2026-10-13T12:05:47.468Z
updated: 2026-10-13T12:05:47.468Z
---

## Summary

T-269's Definition of done and spec §3.1 want the release row to read `R-228 0.1.2 Working with items`: the prefixed id, the version, then the title with its kind word stripped. The merged code draws no version. The items panel's scope header and the `all` tree show `R-228 Working with items`, the top bar shows `Working with items`, and `cland task view` heads `R-228  Working with items`. The QA brief writer found this gap on 2026-10-13. Close it before T-269's epic demo.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.1, the titles.

## What to build

- Wherever a release item is drawn as a row or header, show its version between the id and the title: the items panel's scope header and its `all` tree, the top bar's release, and the item view's header. `cland task view` heads `R-228  0.1.2  Working with items`.
- A release whose title is its version (`v0.1.1`, after T-316 strips "Release:") shows the version once, never twice.
- Other kinds are unchanged.

## Constraints

- Neovim headless tests on the stub hub, read with `screenstring()`. A CLI test for `task view` on a temporary project.
- Do not run the migration on this repo's tracker. The Coordinator runs it live.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. English everywhere.
- D25: request review first, then run `cland verify` at the reviewed head.

## Acceptance criteria

- [ ] C1. The items panel's scope header and `all` tree, the top bar and the item view show a release as `R-<n> <version> <title>`, and a release whose title is its version shows it once.
- [ ] C2. `cland task view` on a release heads with id, version and title.
- [ ] C3. Headless and CLI tests cover both cases, `nvim/README.md` shows the release row, and `cland verify` is green.
