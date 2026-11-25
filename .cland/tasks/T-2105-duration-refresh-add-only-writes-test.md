---
id: T-2105
kind: task
title: Duration refresh --add-only writes test keys under an importing file that the identity lint then rejects, breaking test:lint on dev
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-25T13:08:45.547Z
updated: 2026-11-25T13:08:45.547Z
---

## Summary

`durations.ts refresh --add-only` on stage cover 7d542a77 (A-23394) added 42 test baselines keyed `hub/test/remote-docs.test.ts::<name>` for tests declared in `site/test/*.test.ts` files that remote-docs imports, for example `site/test/onboarding-claims.test.ts:53` "an unconditional Aide commit claim is detected". The suite log reports the importing file, so the refresh attributes the tests to it. `lintDurationIdentities` (`hub/src/suite-test-identities.ts`) then finds no matching title in remote-docs and throws `ShardManifestError: duration key has no matching test identity`, so `npm run test:lint` failed for every worktree based on f39f02dd7. Coord removed the 42 keys in 686235868.

## What to build

Make the refresh run the same identity check before it writes, and skip (and name) any key the lint would reject. Or attribute an imported test to its declaring file, if the lint and the budget reader agree on that identity.

## Acceptance criteria

- [ ] C1. A refresh from a log whose test is declared in a file imported by the reported file writes no key that the identity lint rejects, and names each skipped key (test).
- [ ] C2. After a refresh, `lint-repository-tier-plan` passes on the refreshed manifest (test).
