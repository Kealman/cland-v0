---
id: T-820
kind: task
title: Executor reconcile logs 'lease recovery deferred' every 10 minutes on a healthy hub
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-709
branch: t/T-820-executor-reconcile-logs-lease-recovery
created: 2026-10-18T20:24:17.977Z
updated: 2026-10-20T10:10:40.888Z
closed: 2026-10-20T10:10:40.888Z
---

## Summary

Since restart #13 (2026-10-18 19:10Z), the serving hub has logged `executor-reconcile-failed: lease recovery deferred` every 10 minutes: 5 times in the first hour, and still going on pid 79176. No droplet is lost and spend is correct, but the recurring failure means some lease state can never be recovered or retired. T-813 fixed the lock leak and the CPU churn, not this.

## Acceptance criteria

- [x] C1. The cause is named: the lease records the reconcile keeps deferring and why they can't complete. A regression test reproduces the repeating deferral from a matching ledger or lease state.
  - done: impl-820 · 2026-10-20T09:46:40.864Z
  - verified: rev-32 [reviewer] · run rev-20261020-820-source · 2026-10-20T09:58:41.284Z · commit 351a5f790a4231093e1dd43d0ceab4b1e6031749
  - verified: rev-32 [reviewer] · run rev-20261020-820-final · 2026-10-20T10:06:14.177Z · commit 351a5f790a4231093e1dd43d0ceab4b1e6031749
- [x] C2. Reconcile either completes those leases or retires them with one journal line naming them; on an unchanged state it logs no further `lease recovery deferred` lines.
  - done: impl-820 · 2026-10-20T09:46:43.047Z
  - verified: rev-32 [reviewer] · run rev-20261020-820-final · 2026-10-20T10:06:14.177Z · commit 351a5f790a4231093e1dd43d0ceab4b1e6031749

## Comments

### coord · 2026-10-19T06:23:22.785Z

Another case, 2026-10-19 06:19Z: the E-612 demo lease 5e95a88a (droplet 610424870) stayed "releasing" in the hub after `cland demo stop`, with the watchdog alive and deadline 07:28Z. DigitalOcean had already deleted it: `doctl compute droplet get` returned 404 at 06:22:53Z. The hub doesn't confirm a provider-side deletion it can observe, so QA verdicts that wait on a "destroyed" comment stall. C1/C2 should cover confirming a lease released when the provider reports the droplet gone.

### impl-820 · 2026-10-20T09:46:10.712Z

Cause reproduced with a minimized A-7125-shaped legacy ledger: terminal leases are already settled but each old reconcile iteration acquires/migrates/publishes spend again. Sixteen records with fake 1s ledger-publication latency produce `lease recovery deferred` on both consecutive sweeps and prevent the later releasing lease from reaching its provider 404. New regression went red, then green with batched settlement plus a lock-free settled-history check. Dispatch had only the ten-minute sweep timer; a second red/green component regression now proves automatic release/slot/spend confirmation within six minutes (normally first minute), without a repeated stop. Fake providers and scratch state only. npm run check passes; targeted spend (11), demo release (9) and lock/liveness (6) tests pass.

### rev-32 · 2026-10-20T09:58:41.284Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-820-source
commit: 351a5f790a4231093e1dd43d0ceab4b1e6031749
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No findings. Reviewed the eight-file diff from merge base with 71b9b8f7 to 351a5f790a4231093e1dd43d0ceab4b1e6031749. The new T1 regressions use scratch files, fake process identity/provider/clock and no real process launch; the T2 regression uses the scripted provider and waits for verification I/O before checking persisted release and spend. Shutdown still clears the timer and joins the shared recovery promise. README and agent test docs match minute recovery versus ten-minute sweeps.

## Spec

No findings. C1 cause and reproducer are present: retained terminal history previously paid repeated locked ledger publications; the regression models sixteen settled leases with fake one-second publication costs and two consecutive sweeps. Batch settlement revalidates pending costs under the lock and retains final legacy costs. C2 is implemented: one-minute nonoverlapping recovery retries can observe a late 404, complete release/accounting through the existing one-time lease release event, and stop repeated unchanged-state deferrals. A-7274 supplies implementation diagnosis and targeted red/green descriptions.

Source clear only, at 351a5f790a4231093e1dd43d0ceab4b1e6031749. C1 verified by diagnosis/source and regression inspection; C2's runtime recovery outcome awaits the post-source same-head mode-free verification receipt. No reviewer test or suite execution. Reported supplemental runs were macOS/local T0 and 30 targeted T1/T2 tests at c28bbb72; replacement head changes docs only. Lint diagnostics were report-only. These targeted runs are not a task suite receipt.

Totals: Standards 0; Spec 0.

Criteria: C1 verified.

### rev-32 · 2026-10-20T10:06:14.177Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-820-final
commit: 351a5f790a4231093e1dd43d0ceab4b1e6031749
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at unchanged 351a5f790a4231093e1dd43d0ceab4b1e6031749, following full source verdict rev-20261020-820-source (A-7311). No findings.

Retained A-7346 / run ff8e7174-a053-4cb0-97be-cf8ddf918d61 is a fresh mode-free task run at this exact head, exit 0: 1949/1949 reported passes; T1 exit 0 (40s), T2 exit 0 (257s). Fallback selection ran all T2 in hub and Neovim. Linux x64 6.8.0-142-generic on droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5. Host typecheck receipt at 30919f7f236fa5dc8d134b5faa2f4b806b635593 was reused, not repeated remotely. Census and duration/T3 ratchet diagnostics were report-only; refusal policy remained enforced.

The log contains ordinary pass receipts and separate 5/5 passed load gates for all three new identities: settled legacy lease history, batch interrupted-release settlement, and automatic late-404 demo release. This establishes the runtime parts of C1/C2 alongside the reviewed source. Mark all criteria verified.

This is task T0–T2 evidence, not a T3/T4 or all-tier pass. T3 remains deferred to periodic dev/integrated occasions under queue policy; no Reviewer execution or new run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:10:40.888Z

Merged af7882abb08972dfb0af43ce9a37595bf07d1d3b onto dev.
