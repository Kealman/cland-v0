---
id: T-788
kind: task
title: verify admission runs T-684's test-lint policy before replying and overruns the CLI's 15 s deadline
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-684
topic: null
branch: null
created: 2026-10-18T09:09:07.078Z
updated: 2026-10-18T09:09:07.078Z
---

## Summary

Since the 08:58Z hub restart (pid 18334) put T-684's admission lint live, both mode-free droplet submissions in a row timed out client-side at 15 s: T-709 at 08:59:32Z (run b633487b) and T-787 at about 09:04Z (run 0e2e6544). The hub accepted both. `suite.start` awaits `testLintPolicy` in `hub/src/hub/suite-candidate.ts` before it replies, and that spawns one `git show` per manifest file, about 10 s of `npm run test:lint` work on a quiet Mac. T-770's "sent, unconfirmed" exit 75 keeps this from causing duplicates, but every submission now looks failed, and `--dry-run` throws on the same timeout.

## Acceptance criteria

- [ ] C1. A T2 test measures `suite.start` admission against a manifest the size of the repository's and shows the reply arriving inside the CLI deadline with margin. It fails before the fix.
- [ ] C2. The lint verdict still refuses a violating head before any queue slot or droplet is reserved, and the refusal still reaches the submitter with the same findings.
- [ ] C3. `cland verify --dry-run` on this repository answers within the deadline.
