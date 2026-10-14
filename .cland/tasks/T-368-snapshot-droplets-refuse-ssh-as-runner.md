---
id: T-368
kind: task
title: "Snapshot droplets refuse SSH as runner: cloud-init clean deletes T-344's per-boot key script"
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-344
topic: null
branch: null
created: 2026-10-14T00:17:12.661Z
updated: 2026-10-14T00:17:12.661Z
---

## Summary

A droplet created from a prepared snapshot refuses SSH as `runner` (Permission denied (publickey)), so every remote run fails at the 180 s readiness bound. T-344 installs the per-boot key-copy script before `cloud-init clean --logs`, which deletes it. The fake transport replaced `clean` with `true` and masked the failure.

## Evidence

- T-345's C9 run d5250fbe at 0f85b00d on 2026-10-14: c-8 droplet 608853624 from snapshot 249653351 never answered SSH as `runner` within 180 s. No suite ran, and the droplet was destroyed for $0.014.
- Diagnosis droplet 608855089 (smallest size, same snapshot): root SSH works and cloud-init finished without errors. `/home/runner/.ssh/authorized_keys` and `/var/lib/cloud/scripts/per-boot/cland-runner-keys.sh` are absent.
- T-344's real check (C7) covered prepare only. Acquire from a snapshot (C3) was tested against fakes alone.

## Fix

Fixed on T-345's branch as its own commit: install the per-boot script after `cloud-init clean`; make the fake transport model `clean` and root key injection; add a prepare → snapshot acquire regression test. Closed by T-345's merge.
