---
id: T-1480
kind: task
title: The site onboarding guard rejects the Aide's conditional root commit and blocks every site build
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1275
found_by: review
topic: null
branch: null
created: 2026-10-30T10:20:12.069Z
updated: 2026-10-30T10:20:12.069Z
---

## Summary

The site's onboarding guard (`site/test/onboarding-claims.test.ts`, "the site and docs agree on who commits the onboarding at the root") has been red on dev since T-1275 (c966b0869, 2026-10-25). `docs/agents/session-permissions.md` says "An Aide with current root Git write access commits and publishes itself", which is a conditional claim, but `aideCommitClaims` reports it as unconditional. The guard runs in the site prebuild only, so no suite tier caught it, and every site build fails before Astro runs (found by T-1479, 2026-10-30).

## What to build

The site builds on dev again, and the guard still rejects every unconditional "the Aide commits at the root" claim. Decide from T-1274's and T-1275's intent whether the guard learns the conditional form (an Aide with root Git write access, or another policy that grants it) or the doc sentence is reworded to a form the guard already accepts. Keep T-1274's rejected and accepted fixture sentences as they are. Then add the guard to a tier that runs on every verify, so a later doc edit cannot turn it red unseen.

## Acceptance criteria

- [ ] C1. `site/test/onboarding-claims.test.ts` passes on dev with session-permissions.md stating the Aide's conditional commit, and T-1274's unconditional fixture sentences are still rejected.
- [ ] C2. The site's prebuild guard tests run in a suite tier that every `cland verify` selects when docs or site files change, shown by a planted unconditional claim failing a mode-free verify selection dry run.
