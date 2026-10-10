---
id: T-206
kind: task
title: "QA brief T-116: three expectations disagree with the product (release chip, Unplanned band, live verify)"
state: closed
status: done
labels:
  - qa-found
  - needs-triage
assignee: null
parent: T-116
blocked_by: []
topic: null
branch: null
created: 2026-10-10T21:34:08.108Z
updated: 2026-10-10T21:36:43.412Z
---

Found by qa-16 in T-116's demo (topic-106). The product matches the spec; the brief was wrong.
- M0 expects the version 0.1.0 in the top chip. Spec §3.11 puts the release's name there, so the chip shows R.
- M6 expects X and Y in the unlinked tray, but the brief's fixture links X↔Y (and G). Linked unplanned nodes render in the Unplanned band, which is correct.
- M2 marks a criterion verified with `--as qa-x --role qa`. That is a human actor, and verify is refused for the human by design.
The Coordinator ruled at 21:34Z. Fix the brief text the next time it is used. Close once T-116's verdict lands.
