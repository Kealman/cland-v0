---
id: T-939
kind: task
title: "QA brief template: lessons from the v0.1.4 epic demos"
state: open
status: in progress
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: t/T-939-qa-brief-template-lessons-from-the-v0-1
created: 2026-10-20T05:13:34.829Z
updated: 2026-10-20T05:13:48.277Z
---

## Summary

The nine v0.1.4 DoD demos (2026-10-20) found the same kinds of brief defects several times. The QA skill's BRIEF.md and STAGE-BRIEF.md should warn against them so later briefs avoid them.

## What to build

A short "probes that mislead" section in the QA skill's brief templates, one line each:
- a process probe must not match its own shell (pgrep bracket trick, or exclude the probe's tree); E-614;
- a file-change probe by mtime alone is confounded by live sessions rewriting the same file; judge by isolation; E-613;
- a "ran" marker grep must not count the configuration echo line; E-614;
- a successful droplet prepare logs to the run's delivery.log, not the suite log; E-614;
- speed criteria judge measured walls, never projections; E-677;
- slots that are due or queued before the build count even when their result lands later; E-678;
- "no skip" must name platform-only cases and where they are covered; E-578;
- helper or function names in a brief are re-checked with grep at the build, because renames happen; E-578.

## Acceptance criteria

- [ ] C1. BRIEF.md and STAGE-BRIEF.md in the QA skill carry the section; `cland init`'s copy of the skill matches if it ships these templates.
- [ ] C2. A mode-free `cland verify` at the reviewed head is green.
