---
id: T-813
kind: task
title: executor status RPC hangs while executor reconcile or lease recovery is deferred
state: open
status: in progress
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: t/T-813-executor-status-rpc-hangs-while-executor
created: 2026-10-18T16:28:28.718Z
updated: 2026-10-18T16:33:37.669Z
---

## Summary

Since about 16:23Z on 2026-10-18, `cland executor status` on the serving hub (pid 68650, after restart #11) has not answered within 30 s. Other RPCs (`verify queue`, `inbox`, `session list`, `hub status`) answer in under a second. The executor path seems to block the status RPC: a reconcile or lease recovery holding a lock, or a provider call with no deadline.

## Evidence

- Three tries in a row from 16:23Z: "the hub did not answer on .cland/hub.sock within 30000 ms". At 15:24Z, right after restart #11, the same command answered.
- Hub journal: 16:24:14Z `executor-reconcile-failed: lease recovery deferred`; 16:25:17Z `provider sweep deferred`; an executor sweep with leases 3, failures 2.
- The hub was at 95% CPU and load 11 after 11 lane launches between 16:14Z and 16:21Z. The droplets were fine: 2 cland c-8 for cover db7d5479, and no strays.
- Related: in T-810, impl-810 found that a fixture hub's stop takes about 120 s. It logs `stopping`, then `executor-reconcile-failed: lease recovery deferred` at +60 s. That may be the same blocking path.
- Candidate changes since restart #10: T-797 (executor safety), T-802 (spend accounting), T-609 (ledger path).

## Acceptance criteria

- [ ] C1. `cland executor status` answers within 2 s while a reconcile, lease recovery or provider sweep is in progress or deferred, and reports that state.
- [ ] C2. Every provider call and lock wait in the executor reconcile, lease-recovery and sweep paths has a deadline; a regression test with a provider that never answers proves the status RPC and hub stop still finish within their bounds.
- [ ] C3. The inspect tick does no work for a finished job whose report already failed permanently (for example, a forbidden artifact.create for a role-less session): #restoreRemoteResult skips it or records a terminal state, and #save writes nothing when the jobs are unchanged; a regression test with 6 such jobs shows zero suite-jobs writes over several ticks.
- [ ] C4. Finished jobs stop growing the suite-jobs meta blob: they are kept out of the snapshot that #save rewrites (separate rows or a bounded tail), so one save stays under 1 MB with 930 jobs in history.

## Comments

### coord · 2026-10-18T16:30:02.426Z

16:29Z findings:
- The lock owner in ~/.local/state/cland/spend.json.lock is the serving hub, pid 68650, with its own token. The lock and spend.json both have mtime 16:24:11Z; the lock was never released.
- The hub has been at about 98% CPU since. T-801 and T-777 verify admissions were refused after 60 s waiting on that lock.
- Likely trigger (impl-810, T-810): startFreshnessDaemon in the worktree-cli fixture calls serveProject without env isolation. Fixture hubs inherited the real DIGITALOCEAN_TOKEN (presence checked as a boolean only) and the global executor state. Each ran a startup sweep(true) and lease recovery against the real ledger, and Dispatcher.close awaits #dropletReady. A 50-attempt repro loop ran these at the same time as the live hub.
- Scope for this ticket: the live hub must never keep the ledger lock while spinning, and lock waits and provider calls need deadlines. The fixture isolation fix is T-810's.

### human · 2026-10-18T16:32:38.554Z

CPU profile of the serving hub pid 68650 (cland-impl, 2026-10-18 16:52Z, V8 inspector via SIGUSR1, 8 s at 0.5 ms sampling, 10100 samples; file scratchpad/prof9/profile-68650.txt in the stand-in session). Self time: idle 31.8%, suites.ts #save (line 240) 21.7%, store.ts setMeta (605) 11.8%, sqlite all/run/prepare/get ~16%, store.toMessage 2.1%. Inclusive, project code: #save 37.0%, #inspect (suites.ts 862) 28.0%, inbox.list (inbox.ts 211) 17.2%, #restoreRemoteResult (827) 9.4%, store.inboxMessages 9.3%, epicDemoFreshness 4.7%. Paused stack: idle in processTimers (not wedged, spinning on timers). Mechanism: #save does setMeta('suite-jobs', JSON.stringify(this.#jobs)) and the blob is 8,848,331 bytes for 930 jobs (486 finished droplet, 437 finished local). Six finished droplet jobs are unreported and keep failing their report with 'forbidden: artifact.create (a session with no role has no tools)': 97a70087 T-550, de3df9c9 T-556, 3df8e38c T-505, 4cff14eb T-559, 85b2c03a T-517, f2baa6f7 T-604. Each inspect tick re-runs #restoreRemoteResult on them (their receipt files exist), which sets state and calls #save, so the hub rewrites the 8.8 MB snapshot several times per tick, forever. Suggested fix: save only when something changed in #restoreRemoteResult (skip when job.state is already finished with the same receipt), stop retrying reports whose session has no role, and trim the snapshot (archive finished jobs out of the meta blob). The ledger lock ~/.local/state/cland/spend.json.lock held by pid 68650 since 16:24:11Z is a separate symptom under the same CPU starvation; executor status still times out at 30 s.
