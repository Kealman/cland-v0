---
id: T-707
kind: task
title: "The T3 scenario set: ten named end-to-end flows, each one file with one real hub and at most 120 s"
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-691
  - T-692
  - T-693
  - T-695
  - T-700
  - T-706
  - T-679
topic: null
branch: null
created: 2026-10-16T19:59:37.743Z
updated: 2026-10-17T21:48:43.044Z
---

## Summary

Once rules are proven in T1 and T2, T3 must still prove the seams end to end with real processes, in a set small enough to run once per merge batch (memo §4 option b, §5.1 T3 row, §5.5 step 3). Most scenarios already exist as tests: `tracer`, `daemon`, `startup-smoke`, `crew-launch`, `merge-gate`, `release`, `executor-run`'s lifecycle case, `hook-bridge`, the Neovim client's real-hub proofs. This ticket names the set and gives each scenario one file. The contract files (T-691 to T-693) are the per-harness complement and are not scenarios.

## What to build

`hub/test/scenarios/` holds one file per scenario, tagged `{ "tier": "T3", "scenario": "<name>" }`. Each runs against one real hub at a time (a spawned hub where the flow is about the process, `projectHub` otherwise), runs at most 120 s, and has a header naming the flow and the T1/T2 files that cover its rules. Tests are moved from their current files, not rewritten.

| # | Scenario | Moved from |
|---|---|---|
| 1 | Hub lifecycle: start, discovery, stop grace, restart, orphan sweep | `daemon.test.ts` |
| 2 | Startup smoke | `startup-smoke.test.ts` |
| 3 | Crew launch per harness: Coordinator launches a Claude Code, a Codex and an OpenCode session; each gets its clause; one message round-trips | `crew-launch.test.ts`, trimmed |
| 4 | Ticket flow: claim, review, verify, merge through the verdict gate | `merge-gate.test.ts`, core |
| 5 | Stage close with QA | `stage-qa.test.ts`, core |
| 6 | Release: atomic push and sync against a bare GitHub repo | `release.test.ts`, core |
| 7 | Droplet verify on the HTTP fake provider and process machines: acquire, run, collect, release, watchdog | `executor-run.test.ts` |
| 8 | Hook bridge and mod lifecycle | `hook-bridge.test.ts` |
| 9 | Neovim attach and main views against a real hub | `nvim/test/client.test.ts` and the explorer, thread and plan real-hub proofs |
| 10 | Message tracer: spoke to hub to spoke with channel-event metadata | `tracer.test.ts` |

`HUB_SMOKE` and `NVIM_SMOKE` (`hub/src/suite-selection.ts`) point at scenarios 1, 2, 9 and 10. `docs/agents/tests.md` lists the set and the rule for adding a scenario: a new flow across processes, with its rules already covered in T1/T2.

## Acceptance criteria

- [ ] C1. `tiers.json` names exactly the ten scenarios, each one file under `hub/test/scenarios/` or `nvim/test/scenarios/`, with the header naming its flow and covering T1/T2 files.
- [ ] C2. Each scenario's manifest seconds are 120 s or less, and its spawn census row shows no hub process start beyond those its header names (the restarts of scenario 1, none where it uses `projectHub`).
- [ ] C3. An audit maps every moved test to its scenario step, with its assertions unchanged in meaning.
- [ ] C4. Each scenario passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
- [ ] C5. `docs/agents/tests.md` lists the scenario set, what each proves, and the rule for adding one.

## Blocked by

T-679 (scenario entries).
