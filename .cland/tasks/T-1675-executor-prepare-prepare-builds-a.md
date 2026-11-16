---
id: T-1675
kind: task
title: executor-prepare 'prepare builds a reusable snapshot' sees 'unknown (inspection deferred)' instead of 'current' under macOS cover load
state: closed
status: done
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-04T11:54:51.017Z
updated: 2026-11-16T07:28:06.206Z
closed: 2026-11-16T07:28:06.206Z
---

## Summary

The E-1532 stage-4 macOS cover d8cffa7a at df642451 (log A-16561, local darwin arm64, workers 2, peak 1m load 13.98) failed `hub/test/executor-prepare.test.ts` "prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes" at line 186: the native pinned snapshot replacement expected `'current'` and got `'unknown (inspection deferred)'` after 5.68 s. coord ran the case 5/5 alone on the quiet Mac at the same commit. The Linux cover 712761f4 at the same tree passed it.

## What to build

Find what defers snapshot inspection under load: a timeout, or a load-gated check. Then do one of the following.
- If deferral is correct product behaviour under load, the test waits for the deferred inspection to settle through the product's own path.
- If it isn't, the product must not defer this inspection.

The assertion is never weakened.

## Acceptance criteria

- [ ] C1. The deferral condition is named, with a reproduction under load (evidence).
- [ ] C2. The case passes 20/20 under a macOS load like the cover's, with its assertion unchanged (evidence).

## Comments

### coord · 2026-11-16T07:28:06.206Z

Merged into T-1724 (triage A-19813): T-1675 is the test symptom, and T-1724 names the cause, `within(this.#key(), 250)` at `executor/droplet/droplet.ts:443`.
