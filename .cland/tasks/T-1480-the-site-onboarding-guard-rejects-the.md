---
id: T-1480
kind: task
title: The site onboarding guard rejects the Aide's conditional root commit and blocks every site build
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1275
found_by: review
topic: topic-1234
branch: t/T-1480-the-site-onboarding-guard-rejects-the
created: 2026-10-30T10:20:12.069Z
updated: 2026-10-30T10:21:20.467Z
---

## Summary

The site's onboarding guard (`site/test/onboarding-claims.test.ts`, "the site and docs agree on who commits the onboarding at the root") has been red on dev since T-1275 (c966b0869, 2026-10-25). `docs/agents/session-permissions.md` says "An Aide with current root Git write access commits and publishes itself", which is a conditional claim, but `aideCommitClaims` reports it as unconditional. The guard runs in the site prebuild only, so no suite tier caught it, and every site build fails before Astro runs (found by T-1479, 2026-10-30).

## What to build

The site builds on dev again, and the guard still rejects every unconditional "the Aide commits at the root" claim. Decide from T-1274's and T-1275's intent whether the guard learns the conditional form (an Aide with root Git write access, or another policy that grants it) or the doc sentence is reworded to a form the guard already accepts. Keep T-1274's rejected and accepted fixture sentences as they are. Then add the guard to a tier that runs on every verify, so a later doc edit cannot turn it red unseen.

## Acceptance criteria

- [ ] C1. `site/test/onboarding-claims.test.ts` passes on dev with session-permissions.md stating the Aide's conditional commit, and T-1274's unconditional fixture sentences are still rejected.
- [ ] C2. The site's prebuild guard tests run in a suite tier that every `cland verify` selects when docs or site files change, shown by a planted unconditional claim failing a mode-free verify selection dry run.

## Comments

### impl-1480 · 2026-10-30T10:21:20.467Z

Intent audit: T-1274 source reviews explicitly preserve conditional capable-harness commits while refusing unconditional clauses; T-1275 source/final reviews require current-policy root access plus existing role/tool grants. I will teach the guard the existing exact current-root-Git-write-access conditional rather than change correct policy prose. Existing fixtures remain unchanged. Consumer inventory: aideCommitClaims is exported only in site/test/onboarding-claims.test.ts; site/package.json test/prebuild runs both onboarding-claims and remote-docs tests. Add a T1 hub test entry importing both guards, with a discovery assertion that every prebuild *.test.ts stays included; existing suite-shards planner, tiers lint, task selection and runner consume it as an ordinary hub T1 file. No production wire/schema/policy change; no new gate (existing prebuild checks get existing T1 cadence).
