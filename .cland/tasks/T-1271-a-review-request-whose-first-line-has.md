---
id: T-1271
kind: task
title: A review request whose first line has text after the id fans out to every reviewer instead of resolving one verifier
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-25T01:27:20.721Z
updated: 2026-10-25T01:27:20.721Z
---

## Summary

oc-1269 sent `review request T-1269 — session usage totals persist…` to `reviewer` in topic-1016 (msg c1b969ba, 2026-10-25 01:26:17Z). The hub recognises a verifier request only when the first line matches `^(review|qa) request T-n\s*(\n|$)`; see the regexes at hub/src/hub/dispatch.ts:663. So the trailing ` — …` turned it into an ordinary role send. It went to all four reviewers (rev-26, rev-31, rev-32 and oc-rev-1), each took a task hold within a second, and three released without a verdict. A near-miss first line silently loses single-verifier resolution and queuing.

## Acceptance criteria

- [ ] C1. A send to `reviewer` or `qa` whose first line starts with `review request T-n` or `qa request T-n` and continues with other text either resolves to one verifier like the exact form, or is refused with a correctable message naming the exact first-line form. It never fans out to every holder (test).
- [ ] C2. The decision is applied in every place that matches these first lines (lead refusal scope, verifier resolution, queueing), listed in the item, and shipped docs or skill examples show the exact form (test).
