---
id: T-1941
kind: task
title: The fake DigitalOcean API's root ownership still relies on raw t.after and ownDirectory; enrolling an explicit TestContext needs a full caller migration
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-17T10:14:51.565Z
updated: 2026-11-17T10:14:51.565Z
---

## Summary

T-1626 tried to give fakeDigitalOcean an explicit TestContext with setup-time root ownership (setupOwnedDirectory). Each step exposed callers that depend on the old order. Volume issuance writes executor-state/spend.json outside the fake's request set, so removal raced it (ENOTEMPTY). executor-droplet registers raw t.after(api.close), which then ran after the directory phase ("fake API owner incomplete; root retained", 11 cases). T-1626 reverted to dev's ownership; this item does the hardening properly. Source: impl-1626, topic-1600, 2026-11-17.

## What to build

One owner for a fake API's setup, writers and root: an explicit context threaded through every caller, disposal that joins every writer (queued admission and spend ledger included) before removing the root, and no raw t.after(api.close) left in any caller.

## Acceptance criteria

- [ ] C1. Every fakeDigitalOcean caller, direct and transitive, is listed with its migration, and none registers a raw close after the root's removal phase (rule 41).
- [ ] C2. A queued-issuance-then-close regression and an executor-droplet cleanup regression each fail on the current fixture and pass after the change (tests).
- [ ] C3. The volume, provider, contract, executor-droplet, executor-prepare and remote-fixture-lifecycle files all pass at the final head; the native ones run on the native slot.
