---
id: T-255
kind: task
title: "Per-model task performance: track how each task went by the model that did it, to route tokens across many models"
state: open
status: backlog
labels:
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T06:08:23.359Z
updated: 2026-10-12T06:08:23.359Z
---

Observation from the human (2026-10-12 morning, after v0.1.1), relayed by the stand-in cland-impl.

The goal is to distribute tokens across many models, including the open Chinese ones, so cland must assess how well each model handles tasks of each kind. The run retrospective and the tracker should carry, per task, the model that did it and how the task went.

Candidate proxies: review rounds and QA rounds relative to task complexity; maybe time to clear, suite failures caused, rework after merge. Others to be found.

Starting point: the data already exists in the journal (verdict runs per item, launch records with harness and model), so the first step is an extraction, not new instrumentation.

Shape to be grilled with the human in v0.1.2.
