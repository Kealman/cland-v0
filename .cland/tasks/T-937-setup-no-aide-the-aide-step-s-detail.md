---
id: T-937
kind: task
title: "setup --no-aide: the Aide step's detail line names --no-aide"
state: open
status: in progress
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-691
branch: t/T-937-setup-no-aide-the-aide-step-s-detail
created: 2026-10-20T05:13:34.640Z
updated: 2026-10-20T05:14:00.122Z
---

## Summary

E-613's DoD demo (qa-676, A-7031/A-7033) found that with `cland setup --no-aide`, the skipped Aide step's detail reads "cland starts the hub with the workbench" and never says it was skipped because of `--no-aide`.

## Acceptance criteria

- [ ] C1. Under `--no-aide`, the Aide step's line says it was skipped by `--no-aide` and how to start the Aide later; the existing setup tests and the one covering this line are green.
- [ ] C2. A mode-free `cland verify` at the reviewed head is green.
