---
id: T-1335
kind: task
title: Under load the droplet watchdog's identity probe fails its arm, and two T3 fixtures time out (macOS stage cover 18934ad8)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1116
branch: t/T-1335-under-load-the-droplet-watchdog-s
created: 2026-10-26T08:21:56.778Z
updated: 2026-10-27T17:46:03.899Z
closed: 2026-10-27T17:46:03.899Z
---

## Summary

The macOS stage cover 18934ad8 at dev fb73592a (A-12337) went red at peak 1-minute load 16.2 with three T3 failures. Each passed 5/5 when rerun alone on a quiet machine. One of them may be a product robustness defect: under load, the droplet watchdog's process-identity probe fails and `acquire` throws "could not verify the droplet watchdog process identity" (T-1298 and T-543 code path).

## What to build

Make the watchdog arm path tolerate a transient identity-probe failure under load: retry the native probe within a bounded window before refusing, without ever signalling an unverified pid. Separately, make the two test fixtures robust under load:
- cli-identity's session-credential fixture opens hub.db while the hub holds it ("database is locked"): use a busy timeout or the hub's own credential path.
- executor-safety's 30 s "remote group started" wait.

Failing cases:
- hub/test/executor-droplet.test.ts::a watchdog rearm held across release cannot resurrect the released lease
- hub/test/cli-identity.test.ts::cland hub stop from a session's shell signals nothing when the hub does not answer: only a confirmed request, or the human, may fall back to the signal
- hub/test/executor-safety.test.ts::prepare, run, fallback, cancel and stopped-hub watchdog leave the sentinel nowhere

## Acceptance criteria

- [x] C1. A transient identity-probe failure during watchdog arm is retried within a stated bound and never leads to a signal of an unverified pid, shown by a test that injects one failed probe (test).
  - done: impl-1335 · 2026-10-27T16:06:27.148Z
  - verified: rev-26 [reviewer] · run rev-20261027-1335-evidence-1 · 2026-10-27T17:38:34.837Z · commit cf9529489d8d82f8add1dc164ab69f5c9d125e6b
- [x] C2. The named cases (executor-droplet watchdog rearm, cli-identity hub stop, executor-safety sentinel, and accounts.test.ts "opencode relaunch and hub restart retain the saved account after role and registry edits") pass 10/10 under the load gate's CPU load at two workers (test).
  - done: impl-1335 · 2026-10-27T16:06:27.231Z
  - verified: rev-26 [reviewer] · run rev-20261027-1335-evidence-1 · 2026-10-27T17:38:34.837Z · commit cf9529489d8d82f8add1dc164ab69f5c9d125e6b

## Comments

### coord · 2026-10-26T09:09:10.536Z

The periodic dev T3 run e8e961f3 at fb73592a (A-12344, Linux droplet, peak load only 6.8) failed two more times.
- **cli-identity:** the same `cli-identity` case failed again with "database is locked" (session-credential-fixture.ts:13 opens hub.db while the hub holds it). It fails on Linux at low load too, so it is a fixture race, not only load.
- **accounts:** a new case failed: hub/test/accounts.test.ts::opencode relaunch and hub restart retain the saved account after role and registry edits, with "name "retained" is in use by a live session" (accounts.test.ts:167). It passed 5/5 alone on macOS. The Linux stage cover 56552bb3 at the same commit was green.
When this item is triaged, include the accounts case: a name-reservation race across relaunch and restart.

### coord · 2026-10-27T07:11:32.881Z

Seen again, 2026-10-27 07:10Z: T-1361's rule 6 run 78578e27 (A-12635) at 994f534a went red on just this flake: cli-identity.test.ts "cland hub stop from a session's shell signals nothing when the hub does not answer…" failed with `database is locked` at new Store (store.ts:439) from session-credential-fixture.ts:13 actorCredential. Run alone at the same head, it passed 5 out of 5 on macOS. Web didn't run, because the run stopped after T3. Per the flaky-rerun rule, there's one resubmit.

### coord · 2026-10-27T08:41:51.560Z

2026-10-27 08:42Z: cli-identity "database is locked" failed twice in a row at T-1361's head 994f534a (78578e27/A-12635, then fb844ac9/A-12659) and passed 5/5 alone on macOS. The fixture part of this item (session-credential-fixture.ts opening a second Store on the live hub.db without a busy timeout) now rides with T-1361 as a Coordinator-posted shared fix: a busy timeout on that connection. The watchdog identity-probe and executor-safety parts stay here.

### coord · 2026-10-27T14:49:53.581Z

Seen again, 2026-10-27 14:49Z. The Linux stage cover 661e61fe at dev 91d2dc4a (A-12810, shard-2) failed only accounts.test.ts "opencode relaunch and hub restart retain the saved account after role and registry edits" with `name "retained" is in use by a live session` (accounts.test.ts:167). That's the same signature as the 10-26 occurrence. I didn't run it alone this time, because the macOS cover is holding this Mac quiet; the earlier occurrence passed 5/5 alone. It's treated as this known name-reservation race, with the Linux cover resubmitted once.

### impl-1335 · 2026-10-27T15:35:49.872Z

Seams and pre-change consumer inventory (rule 20): watchdog arm/stop uses the existing exported process-host OS boundary (T1 executor-watchdog.test.ts) and native executor-droplet.test.ts (T3); fixture changes use existing session/frame and fake-machine durable receipts. Full repository search for armWatchdog/WatchdogProcesses/WatchdogOptions and the arm refusal finds production consumers droplet.ts acquire/reconcile and dependencies.ts processHost; test consumers executor-watchdog.test.ts, executor-lock-liveness.test.ts, demo-release.test.ts and fakes/digitalocean/scripted-machine.ts; docs executor-argv-audit.md, executor-watchdog test guidance and hub README. No wire, list, persisted lease, credential, permission or refusal-class change is planned; arm retry is internal and preserves the existing error on exhaustion. Existing two-argument arm and legacy process-host fakes stay compatible. T3/T4 scan included all tests, QA briefs and shipped skills: no other direct arm consumers. Local tests withheld per cover-quiet; first prepared regression injects one unavailable native birth and requires a verified result without bare-PID signals.

### impl-1335 · 2026-10-27T15:56:47.007Z

Additional pre-change fixture inventory (rule 20): A-12826, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12826-t-1335-credential-fixture-consumer-inventory.md lists every direct session-credential-fixture consumer found across hub/nvim/web/qa/.agents/docs. Exported signatures, old actor shape, explicit credential/unknown/provisional branches and Store-object clients stay unchanged; all path clients use an existing hub-created schema. Deterministic held-WAL-writer regression at the SQLite/fixture seam reproduced the exact failure before the change: `database is locked`, new Store store.ts:439 → actorCredential:15 → sessionShell, fixture credential open/read 5380 ms on darwin/arm64. The writer is deliberately held on the same scratch database; positive BEGIN IMMEDIATE control confirms its lock. openDatabase sets busy_timeout=5000, replacing the earlier fixture timeout=10000. The live hub can be SIGSTOPped while holding that writer, so a full Store open cannot safely run migrations/backfills there. Coordinator directed the minimal fixture-only connection; production store remains unchanged.

### impl-1335 · 2026-10-27T16:07:08.204Z

Implementation committed/pushed to the local territory as 82e9309aa660f47d1451ff40f796e8356fc7cb66 on t/T-1335-under-load-the-droplet-watchdog-s. C1/C2 done marks refer to A-12827 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12827-t-1335-final-local-cpu-load-probe-five-identities-each-10-10.json): five exact identities each 10/10 on local darwin/arm64, two lanes and the owned CPU loop, browser none. A prior 9/10 CLI probe is superseded by the passing rerun; no suite claim is made. Watchdog arm defaults remain native; an explicit injected launch handle keeps its unit regression in T1 under static admission. The only post-probe code change was that test seam/type correction, with native default behavior unchanged. npm run typecheck, npm run test:lint (0 refusals; existing findings report-only), and npm run test:tiers pass. Coordinator requested all 77 direct hub/test credential-fixture importer files serially before review; 39 currently complete, 401 top-level passes, no skips/failures. The first nested-TMPDIR runner attempt failed native socket path length and is incomplete, not test evidence; the restarted runner uses sealed short scratch roots.

### rev-26 · 2026-10-27T16:15:02.690Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1335-source-1
commit: 82e9309aa660f47d1451ff40f796e8356fc7cb66
scope: full
findings: [{"severity":"medium","text":"M1 Standards: new arm controls await setup promises without an independently live bound/cancellation while fake behaviour time is stopped (also lines50/101). Pre-register an owner that releases held replies, drains arm/stop work and clears fake child ownership on every exit; add missing/aborted setup controls through it, preserving all behaviour/signal assertions.","file":"hub/test/executor-watchdog.test.ts","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

Full consolidated source audit A-12833: Standards M1 medium, Spec 0. Retry deadline/birth coherence/late proof exclusion, receipt-driven sentinel expiry, saved-account disconnect, minimal credential SQLite and all shared consumers reviewed. New test setup ownership correction needs fresh pushed-head source review. Local A-12827/A-12831 working-tree/load facts remain distinct from exact-head configured/Linux proof; C1/C2 runtime marks pending. No additional findings, no Reviewer execution; QA none.

### rev-26 · 2026-10-27T17:22:57.810Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1335-source-2
commit: cf9529489d8d82f8add1dc164ab69f5c9d125e6b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source-2 clear: M1 correction plus authorized dev integration; Standards 0, Spec 0. A-12843 incorporates full source-1 A-12833. Independently driven setup bound/combined cancellation and pre-owned unconditional drainage now cover all arm controls, with missing/aborted setup completion/close/map controls; every original behavioural/signal assertion retained. Product/credential/sentinel/accounts/SQLite sources unchanged. Integrated tracker implementation/tests/guides identical to reviewed T-1374; shared index/baseline edits preserved. A-12842 local 26/26 and timeout-negative control are not configured/Linux proof; earlier load/importer artifacts retain prior provenance. C1/C2 runtime marks pending one unchanged-head mode-free configured run and original-record review. QA none.

### rev-26 · 2026-10-27T17:38:34.837Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1335-evidence-1
commit: cf9529489d8d82f8add1dc164ab69f5c9d125e6b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, C1/C2 verified. A-12844 exact reviewed head exit0: independent 3762 ordinary passes +30 separate actual load passes (six new identities ×5), no fail/skip/cancel. C1 retry/deadline/changed-birth/M1 ownership + WAL controls all base+5/5; new base max .022499306 s/load .041831114 s. C2 native four-case 10/10 CPU proof remains local macOS A-12827 at its working-tree provenance; current Linux sentinel/account pass once, unchanged executor-droplet/cli-identity T3 unselected. T0/allT1/fallback allT2/changedT3 18/18/Web complete; broaderT3/T4 absent. Printed R-1278 allowance suggestions are not committed; actual E-880 23.6/21 s through Nov19 cover samples. Coordinator09f73c4a accepts unchanged head; report-only budget/lint/ratchet limits retained. A-12845 records exact identities, platforms/browser, host-gate reuse and all coverage limits. QA none; Coordinator cover/enqueue/landing separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T17:46:03.899Z

Merged 4e4a61d41e94db6435fcda4583ab4934b36cb3bd onto dev.
