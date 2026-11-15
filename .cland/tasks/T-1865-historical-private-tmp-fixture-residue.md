---
id: T-1865
kind: task
title: Historical /private/tmp fixture residue cleanup with positive closure proof (split from T-1806 C2)
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
created: 2026-11-15T07:01:05.627Z
updated: 2026-11-15T07:01:05.627Z
---

## Summary

T-1806 stops native host fixtures from leaking `cland-h-*` socket folders and `ct-*` aliases into /private/tmp (C1), and adds a shared name-set inventory helper (C3). The one-off cleanup of the historical residue was T-1806's C2. It is split out here because T-1806's source review found a safety defect at 29fe07ba8. Worker-only owner receipts plus a negative argv/cwd/lsof census cannot prove that idle descendants of an inherited home are gone, and no positive closure receipt covers account, `hc-*` or suite roots. So the dry run's "eligible" set (12,555 of 12,561 candidates at 2026-11-15 06:54Z) is not safe authority to delete.

## What to build

Base the cleanup on positive proof, never on absence of evidence. Either:
- limit it to classes whose closure can be proven, such as socket folders and aliases whose recorded owner process has a confirmed native identity that is gone; or
- add closure receipts at fixture teardown that later cleanup can trust.

Anything without positive proof is kept and reported. The script removes by literal path, keeps a receipt listing each path, and is run by the Coordinator after review. A session never runs it.

## Acceptance criteria

- [ ] C1. Each class the cleanup removes is justified by a positive closure proof, and roots without such proof (account, `hc-*` and suite roots with inherited homes) are kept and reported (test with planted live-descendant controls).
- [ ] C2. A dry run against /private/tmp lists every removal with its proof and every kept root with its reason. The real run removes only that list, by literal path, with a receipt (test on planted fixtures; the real run is the Coordinator's).
