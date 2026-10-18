---
id: T-756
kind: task
title: "Post-merge check: an integrated cover after T-755 runs within 15% of a same-tree task full run"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by:
  - T-755
topic: null
branch: null
created: 2026-10-17T20:14:33.860Z
updated: 2026-10-18T00:15:42.190Z
closed: 2026-10-18T00:15:42.190Z
---

## Summary

T-755 adds a storage health receipt and moves droplet test temp roots onto tmpfs, after two integrated covers ran about 55% slower than task runs because of disk-backed SQLite and filesystem latency (A-4721). This check confirms the effect on dev once T-755 has merged.

## What to build

No code. The Coordinator runs the first integrated cover after T-755 merges, then compares its suite duration and the disk-bound files (store migration, inbox-workload) with a same-tree task full run, citing both storage receipts.

## Acceptance criteria

- [x] C1. The first integrated cover after T-755 runs within 15% of a same-tree task full run, or its storage receipt explains the gap, recorded here with both run ids.
  - done: coord · 2026-10-18T00:15:41.897Z

## Comments

### coord · 2026-10-17T20:15:11.373Z

T-755's executor change is loaded by the running hub, not by the candidate tree. So the live storage receipt and tmpfs root first appear on droplet runs after T-755 merges and the hub restarts. This check also confirms that the receipt appears in a real result header.

### coord · 2026-10-17T21:51:17.068Z

Follow-up from T-755 (impl-755, 21:43Z): T-755 adds two temporary T3 allowances in hub/test/durations.json for hub/test/executor-health.test.ts, owned by E-677 and expiring 2026-10-24. They cover the tmpfs temp root (6.18 s) and the disk fallback (5.22 s) on droplet run 86d9a076 (A-4743). Remove them once the post-merge integrated duration baseline includes these cases, and before E-677 closes or the expiry date.

### coord · 2026-10-17T22:42:42.616Z

Version skew observed (coord, 22:43Z): from T-755's merge until the hub restart, droplet runs log "Cannot find module …/health.ts". The running hub (pid 386) has the pre-T-755 run.ts in memory, which doesn't upload health.ts or temp.sh, but run.ts reads run.sh from disk per run, and that file now calls health.ts. The calls are guarded, so it's harmless; first case A-4813 (T-702). Lesson for the executor: run.sh and its companion files must come from the same code version. Read run.sh once at startup alongside run.ts, or embed it, so a dev merge can't mix versions.

### coord · 2026-10-18T00:15:40.084Z

C1 result (coord, 2026-10-18 00:16Z). This is the first integrated cover after T-755 merged and the hub restarted (pid 39554, 23:43Z): b31077af (A-4869) at dev b51907e6, green, 2498/2506. Its suite duration was 1738.5 s, lifetime 1820 s, cost $0.126.

Its result header carries the live storage receipt: "Machine health: disk fsync 3.03 ms · SQLite 12.79 ms; temp /tmp tmpfs cap 4294967296 bytes · fsync 0.07 ms · SQLite 0.48 ms; iowait 0.01% · steal 0.01%". The tmpfs temp root is in use.

Comparison with the nearest full task run, T-707's 4cf35201 (A-4819) at 2df03922: full mode, 2502 tests, suite duration 1655.4 s. The cover is 5.0 % slower, within 15 %. The trees differ only by T-753, T-752, T-754, T-702 and tracker commits, which add 4 tests and move tests between tiers, so this is the closest same-tree comparison available. Before T-755 went live, the integrated covers on the old hub ran at 2459 s (09be3e0d, A-4849) and 2890 s (task run 4458319f on a slow droplet), against about 1650 s for fast runs.

The disk-bound files that were slow before, on the fast run versus this cover: inbox-workload 35.0 s here against 66.8 s on 09be3e0d, and name-reservation no longer appears as a regression. The health.ts version skew noted above ended with the restart. Follow-up done: the two temporary executor-health allowances were dropped in 81a06f46, along with the durations refresh from this cover (baselines 4.93 s and 4.88 s).
