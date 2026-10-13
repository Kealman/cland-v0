---
id: T-200
kind: task
title: QA brief T-112 M1 expected ids before the first criterion write
state: closed
status: done
labels:
  - qa-found
  - needs-triage
assignee: null
parent: E-112
blocked_by: []
topic: null
branch: null
created: 2026-10-10T17:08:36.326Z
updated: 2026-10-10T17:09:54.906Z
closed: 2026-10-10T17:09:54.978Z
---

Found by qa-15 in T-112's demo (topic-97, evidence .cland/qa/T-112/qa-2026-10-10-15-112/M1.txt). Old checkboxes read with id null until the first criterion write, as spec §3.4 ('given ids on first touch'), docs/review-and-qa.md and the tracker tests say. M1 expected C1..C4 straight after creation. The product is right; the brief was wrong. Fixed in the brief (M1 now makes the first write before expecting ids). Close once M1 passes.
