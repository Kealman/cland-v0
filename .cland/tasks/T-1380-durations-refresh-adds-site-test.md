---
id: T-1380
kind: task
title: durations refresh adds site/test identities that no tier owns, and periodic dev T3 then skips
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1368
topic: null
branch: null
created: 2026-10-27T23:10:18.366Z
updated: 2026-10-27T23:10:18.366Z
---

## Summary

The stage-close refresh `node hub/test/durations.ts refresh --add-only <linux> <mac>` at c675faa3 added a file entry and five test keys under `site/test/remote-docs.test.ts`, because T-1368's hub wrapper `hub/test/remote-docs.test.ts` imports the site cases and the cover logs report them under the site file. No tier owns site/test, so the periodic dev T3 at 7ec62be1+ was skipped: `verify-tiers: duration key has no matching test identity: site/test/remote-docs.test.ts` (2026-10-27 23:09Z). Coord removed the six keys by hand; the next refresh would add them again.

## What to build

Either the refresh adds only identities the tier manifest owns (and says what it skipped), or the wrapper's imported cases are reported under the wrapper's own file, so logs and durations agree. Keep the failure as a refusal at shard planning, but make the refresh unable to create it.

## Acceptance criteria

- [ ] C1. A refresh over a log that contains site/test identities adds no key the tier manifest does not own and prints the skipped identities (test).
- [ ] C2. `npm run test:tiers` passes after a refresh over the c675faa3 cover logs A-12925 and A-12929 (test against fixture copies).
