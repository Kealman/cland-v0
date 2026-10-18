---
id: T-798
kind: task
title: Publish marketing commits (site, brand, README) to GitHub main and site without a release, then sync
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: E-617
blocked_by: []
topic: null
branch: null
created: 2026-10-18T10:27:50.246Z
updated: 2026-10-18T10:27:50.246Z
---

## Summary

The human, 2026-10-18 10:27Z in General: marketing material should reach GitHub without waiting for a release, so the scheme needs to be worked out. Today it is done by hand (D56, D59): brand/identity commits are cherry-picked onto GitHub `site`, the same tip is pushed as `main`, the branch is merged into dev, and `cland sync` brings main back under dev so that the next `cland release` passes its behind check. Each step is easy to get wrong. In D56 the branch carried 282 unreleased dev commits and had to be cherry-picked instead of pushed.

## What to build

`cland publish <branch>` (name open) from the Coordinator's or the human's shell:
- takes the branch's commits that dev's last release lacks;
- refuses unless every changed path is in a configured allow-list (default `site/**`, `docs/brand/**`, `README.md`, `LICENSE`, `.github/workflows/pages.yml`);
- with the human's approval (an ask, the same as release), cherry-picks them onto GitHub `main` as a fast-forward and moves `site` to the same tip;
- merges the branch into dev and runs the sync step;
- comments the tip on a tracker item.
A dry run shows the commits, the paths and the resulting tips.

## Acceptance criteria

- [ ] C1. A T2 test on a fixture territory with a fake GitHub remote publishes two site-only commits: main and site fast-forward to one tip, dev contains them, and a following `cland release --dry-run` passes the behind check.
- [ ] C2. A commit touching a path outside the allow-list refuses the whole publish and names the path, proved by a test.
- [ ] C3. The skill docs (`release`) and docs/agents describe publish as the only out-of-release GitHub push, with the human's approval.
