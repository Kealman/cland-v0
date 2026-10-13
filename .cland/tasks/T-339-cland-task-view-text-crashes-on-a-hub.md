---
id: T-339
kind: task
title: cland task view (text) crashes on a hub frame without T-330's criteria counts (CLI and hub version skew)
state: open
status: backlog
labels:
  - qa-found
  - needs-triage
  - hub
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-13T17:31:48.747Z
updated: 2026-10-13T17:53:00.795Z
---

## Summary

`cland task view <id>` in text mode crashes with "cannot read properties of undefined (reading 'verified')" when the hub's `task.view` frame has no criteria counts. QA found it on 2026-10-13 during E-268's demo (run qa-2026-10-13-27-5) at dev 94c5f01, on T-266, T-267 and T-302. Cause: the live hub started at 17:13Z, before T-330 (merged 17:28Z) added the card fields, and the dev CLI's text renderer reads `criteria.verified` without a guard. `--json` works.

## What to build

- The CLI's text view renders a frame without T-330's fields: no criteria counts, no closed time, no latest verify. It shows them only when present.
- A CLI test against a frame without those fields.

## Acceptance criteria

- [ ] C1. `cland task view` in text mode never crashes on a `task.view` frame missing the card fields, and shows the rest of the item.
- [ ] C2. A test covers the old-hub frame shape.

## Comments

### coord · 2026-10-13T17:53:00.795Z

Also hits the CLI's write commands: `cland task comment` in text mode writes the comment, then crashes rendering the item (seen 2026-10-13 17:52Z on E-268). With --json it succeeds.
