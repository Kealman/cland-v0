---
id: T-2036
kind: task
title: c-4 versus c-8 control cover with per-second load metrics (split from T-1897 C2; after T-1897 lands and the hub restarts)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by:
  - T-1897
  - T-2048
topic: topic-1690
branch: t/T-2036-c-4-versus-c-8-control-cover-with-per
created: 2026-11-20T17:40:44.218Z
updated: 2026-11-21T03:51:04.051Z
---

## Summary

The paired c-8 and c-4 control measurement that sizes the droplet (the human's 2026-10-17 decision), split from T-1897 C2 on 2026-11-20. It needs T-1897's per-second sampler to be in the running hub first: the hub uploads run.ts, run.sh and health.ts from its own tree, not the candidate's (rule 19). So it runs after T-1897 lands and the hub restarts.

Kind: measurement. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1897's original C2.

## Acceptance criteria

- [ ] C1. One c-4 workers-2 cover at a tree with a green c-8 cover is compared with it for wall time, reds and cost in an artifact (evidence).

## Comments

### impl-2036 · 2026-11-21T01:04:55.041Z

Read T-2036 and split-source T-1897 including its comments. Opened topic-1690. Preparing paired, unsharded c-8/c-4 workers-2 fresh controls at one clean head; requested Coordinator spend authorization ($0.30–$0.50 estimate, ~$0.56 at both caps), selection confirmation and first verify window before submission. No code/test changes expected; evidence-only review after measurement.

### impl-2036 · 2026-11-21T01:50:05.282Z

Coordinator approved pair spend up to ~$0.56 and owns submissions. c-8 reference run 66f497e2-27e2-4002-8bc1-bf82a907c48a admitted 2026-11-21 01:49Z from T-1901 head 895ad015203dd1656d03442f1d9c1512dfecfd6c, full verify all, workers 2, unsharded. Coordinator will submit c-4 at the same head after delivery. Offline bounded streaming extractor prepared and exercised against A-22289 and synthetic gap/null/malformed/duplicate/red controls. Measurement and C1 remain pending completed pair receipts.

### impl-2036 · 2026-11-21T03:48:23.359Z

c-4 control attempt bed4ce72-815f-463c-8001-3ef17cdf9c64 at pinned head895ad015203dd1656d03442f1d9c1512dfecfd6c failed before droplet execution: `all exit 1; dirty or changed worktree cannot be bundled for droplet` (A-22314). Host T0 exit0/60.359s only; machine tiers/Web unexecuted, platform and machine health unavailable. Not a performance sample, no cost inferred. Reported to Coordinator for attribution/retry decision, no resubmission. Green c-8 A-22307 and original failed c-4 receipt retained separately; C1 pending actual paired measurement.

### impl-2036 · 2026-11-21T03:50:49.170Z

Clean exact-head c-4 retry079f98c4-39f4-462b-a356-dd4b3d5af463 failed pre-execution: `all exit 1; prepared snapshot disk does not fit size c-4` (A-22315). Host T0 exit0/80.176s only; T1/T2/T3/Web unexecuted; machine/platform unavailable. Requested Coordinator-owned compatible image preparation before any further enqueue (rule19). No performance or cost inferred, no workaround/resubmission. Prior bed4ce72/A-22314 remains separately retained: Coordinator attributed it to concurrent dev merge during bundling. C1 remains incomplete.
