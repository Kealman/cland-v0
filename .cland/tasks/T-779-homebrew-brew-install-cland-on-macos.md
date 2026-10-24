---
id: T-779
kind: task
title: "Homebrew: brew install cland on macOS"
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-983
branch: t/T-779-homebrew-brew-install-cland-on-macos
created: 2026-10-18T06:04:22.818Z
updated: 2026-10-24T12:50:41.446Z
---

## Summary

The landing, the README and the install docs tell macOS users to run `brew install cland`. Nothing builds or publishes a Homebrew package yet.

## What to build

A Homebrew formula for cland, published so that the command on the site works, and updated by `cland release` on every release.

- `brew install cland` with no tap needs homebrew-core, which accepts only notable projects. Until then a tap (`Kealman/homebrew-tap`, installed as `brew install kealman/tap/cland`) is the realistic path; if the tap is the answer, change the landing, the README and `docs/install.md` to the tap form.
- cland needs Node 24 (`>=24.13 <25`): the formula depends on `node@24` or ships its own runtime.
- `brew upgrade cland` and `brew uninstall cland` work as `docs/install.md` describes.

## Acceptance criteria

- [x] C1. Before merge, sealed local source archives prove the shared installer build that the formula uses, and pure formula checks pin the Node 24 dependency, the wrapper and the build contract. A clean-macOS `brew install`, `--version`, `doctor`, `upgrade` and `uninstall` through the published tap is landing evidence once the human creates `Kealman/homebrew-tap` (E-778 DoD C1).
  - done: impl-779 · 2026-10-24T12:50:29.010Z
- [x] C2. `cland release` updates the formula to the new version.
  - done: impl-779 · 2026-10-24T12:50:29.096Z
- [x] C3. The site, the README and docs/install.md show the command that works.
  - done: impl-779 · 2026-10-24T12:50:30.094Z

## Comments

### impl-779 · 2026-10-24T12:48:51.576Z

Design approved by Coordinator in topic-983 (A-11019 plus decisions): Node@24 formula shares packaging/build-install.sh with curl installer; no Ruby/Homebrew in tests; opt-in committed release.homebrew.tap, exact tag URL preview with SHA recorded after product push, recoverable tap follow-up. Implemented sealed installer build/rollback receipts, pure formula/config checks and native local-bare tap publication/retry/race tests; initial targeted local macOS tests pass. Clean macOS brew install/audit/version/doctor/upgrade/uninstall is explicitly deferred to landing after human tap creation; pending availability is labelled in public docs. Source review will precede mode-free verification.
