---
id: T-958
kind: task
title: The claimant learns that ready waits on its own done marks
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:53:32.957Z
updated: 2026-10-20T09:53:58.056Z
---

## Summary

On 2026-10-20 around 00:07Z, three implementers (T-905, T-909, T-920) waited for ready with every criterion verified, but none had marked a criterion done. Nothing told them ready waits on the claimant's done marks.

## What to build

When the gate's only missing evidence for ready is claimant done marks, the hub tells the claimant. It sends one notice in the item topic naming the unmarked criteria and the command that marks them. It sends the notice again only if the set of unmarked criteria changes. The Implementer clause gains one line: mark every criterion done before requesting the final review. This comes from the residue of the rule batch (A-7281), which the human approved on 2026-10-20.

## Acceptance criteria

- [ ] C1. An item whose criteria are all verified but some not done, with clear verdicts, gets one notice to the claimant naming the criteria; no notice repeats while the set is unchanged.
- [ ] C2. The Implementer clause carries the done-marks line within its byte reserve.
