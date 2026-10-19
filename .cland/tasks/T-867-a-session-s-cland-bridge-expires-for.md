---
id: T-867
kind: task
title: A session's cland bridge expires for good after a hub outage longer than 60 s, so the hub can never inject into it again
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: topic-586
branch: t/T-867-a-session-s-cland-bridge-expires-for
created: 2026-10-19T11:40:21.346Z
updated: 2026-10-19T13:05:00.860Z
closed: 2026-10-19T13:04:47.843Z
---

## Summary

A session's cland bridge gives up for good when the hub stays unavailable for longer than BRIDGE_GRACE_MS (60 s). After that the hub can never inject into that session again until the harness restarts. At restart #18 (2026-10-19) the hub was unready for about 3.7 min. Since then the Coordinator has received no deliveries, suite results, heartbeats or asks unless something else started a turn.

## Evidence

From cland-impl's diagnosis, 2026-10-19 11:40Z:
- .cland/log/hub.log has `bridge-closed` for coord at 10:17:58Z and no `bridge-connected` after it. Earlier restarts reconnected within 10–25 s.
- 107 `inject-unconfirmed` events for coord since 10:22Z, with "the cland mod of this session is not connected", the latest at 11:38Z.
- The journal shows coord with 71 `acked` and 0 `injected`.
- `cland hook bridge` (hub/src/cli/hook.ts) prints `bridge-expired` after the grace. The mod's bridge() (hub/mod/cland/hooks/register.ts) then returns for good, and only `session.start` spawns a new one.

The crew stood still for about an hour (10:25–11:23Z) because the Coordinator never saw landings.

## Acceptance criteria

- [x] C1. After the hub has been unavailable for longer than the grace period, the mod respawns its bridge once the hub serves again, without a harness restart. A component test keeps the hub down past the grace, brings it back, and shows a delivery injected into the session.
  - done: impl-867 · 2026-10-19T11:45:46.868Z
  - verified: rev-30 [reviewer] · run rev-20261019-867-final · 2026-10-19T12:08:13.331Z · commit a4956e4d97f4291c0329c13c83ae390866e2bd70
- [x] C2. When injects to a session stay unconfirmed for longer than a threshold, the hub raises one notice to the human (or to the Coordinator when another session is affected) naming the session. A test drives unconfirmed injects past the threshold.
  - done: impl-867 · 2026-10-19T11:45:47.486Z
  - verified: rev-30 [reviewer] · run rev-20261019-867-final · 2026-10-19T12:08:13.331Z · commit a4956e4d97f4291c0329c13c83ae390866e2bd70

## Comments

### impl-867 · 2026-10-19T11:45:33.024Z

Implementation complete at the documented seams. C1 red proof A-5983; C2 red proof A-5986. Mod now retries bridge-expired with its existing 1s delay. Sustained failed injects notify after 60s, once per session episode; confirmations cancel deadlines and recovery re-arms, stopped processes/closed Sessions clear timers. C1 uses real hub socket + production Claude bridge/inject/confirm with simulated harness/CLI process boundary. C2 exercises threshold, human/coordinator routing, dedupe, recovery and early confirmation. Targeted files passed separately: mod-bridge 0.364s, inject-stalled 0.901s, adapter-composition 0.934s, bridge-grace 0.083s. Root typecheck and test lint passed. QA policy scope none; requesting source review next, followed by mode-free verify only after clear source verdict.

### rev-30 · 2026-10-19T11:49:58.619Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-867-source
commit: a4956e4d97f4291c0329c13c83ae390866e2bd70
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-5994 records the Standards/Spec audit of repeated expiry recovery, real socket injection/confirmation, threshold routing, suppression and timer lifecycle. C1/C2 remain run-dependent and unverified pending the exact-head mode-free receipt. Host red/green evidence A-5983/A-5986/A-5990 inspected; no Reviewer tests run.

### impl-867 · 2026-10-19T11:50:15.310Z

Source review clear, findings []: rev-20261019-867-source, head a4956e4d97f4291c0329c13c83ae390866e2bd70, artifact A-5994. Mode-free verification admitted at this unchanged head: e1740005-ed79-445e-8c0f-017c71542266, queue position 1. Result routes to Reviewer and lead T-867 in topic-586. No dev merge after source review; waiting for hub result and Reviewer final verdict.

### impl-867 · 2026-10-19T12:07:57.466Z

Same-head mode-free verification e1740005-ed79-445e-8c0f-017c71542266 passed on a4956e4d97f4291c0329c13c83ae390866e2bd70: 1509 tests passed, 0 failed/cancelled/skipped. Artifact A-6012. Executor droplet, linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, c-8 lon1; lifetime 1030s, cost $0.0716. Task T0–T2 evidence complete; T3 in merge batch. Reviewer received the same result for final evidence verdict. No source/head changes since source-clear review.

### rev-30 · 2026-10-19T12:08:13.331Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-867-final
commit: a4956e4d97f4291c0329c13c83ae390866e2bd70
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6013 audits A-6012 / e1740005 at the unchanged source-reviewed head. Ordinary 1509/1509, zero fail/cancel/skip/TODO, all 433 load-gate groups 5/5, zero tier-mismatch rows. Repeated grace-expiry recovery and both stalled-injection policy cases complete ordinarily and in five repetitions. C1/C2 verified. Existing report-only findings retained; T3 remains merge-batch landing evidence. No claim of live harness upgrade, no Reviewer tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T13:04:47.843Z

Merged c65dccd64809b3c73c902f3152c635dee16c628e onto dev.

### coord · 2026-10-19T13:05:00.860Z

Live landing evidence: T-867 landed at c65dccd6. Coord's bridge had been closed since restart #18 (10:17:58Z). It logged `bridge-connected` at 13:04:49Z without a harness relaunch, and the hub began injecting coord's backlog right away (the first injected delivery was the 10:19Z T-665 drop notice).
