---
id: T-779
kind: task
title: "Homebrew: brew install cland on macOS"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: null
branch: null
created: 2026-10-18T06:04:22.818Z
updated: 2026-10-24T09:39:32.445Z
---

## Summary

The landing, the README and the install docs tell macOS users to run `brew install cland`. Nothing builds or publishes a Homebrew package yet.

## What to build

A Homebrew formula for cland, published so that the command on the site works, and updated by `cland release` on every release.

- `brew install cland` with no tap needs homebrew-core, which accepts only notable projects. Until then a tap (`Kealman/homebrew-tap`, installed as `brew install kealman/tap/cland`) is the realistic path; if the tap is the answer, change the landing, the README and `docs/install.md` to the tap form.
- cland needs Node 24 (`>=24.13 <25`): the formula depends on `node@24` or ships its own runtime.
- `brew upgrade cland` and `brew uninstall cland` work as `docs/install.md` describes.

## Acceptance criteria

- [ ] On a clean macOS, the install command the site shows puts a working `cland` on PATH and `cland doctor` runs
- [ ] `cland release` updates the formula to the new version
- [ ] The site, the README and docs/install.md show the command that works
