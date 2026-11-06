---
id: T-1704
kind: task
title: Native agent restart test sees "agent closed" while cleaning unfinished spawn and worktree preparations (one dev T3 occurrence after T-1698)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1533
blocked_by: []
regression_of: T-1698
found_by: droplet
topic: topic-1415
branch: t/T-1704-native-agent-restart-test-sees-agent
created: 2026-11-06T05:34:21.418Z
updated: 2026-11-06T22:28:21.128Z
closed: 2026-11-06T22:28:21.128Z
---

## Summary

Periodic dev T3 b9aa9e7d at dev 4df6c1ad (A-17027, Linux x64 droplet, peak load 7.6) failed `hub/test/host-prepared.test.ts:52` "native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness" after 2.46 s. The error was `Error: agent closed` at `hub/src/host/agent-client.ts:30`. It is the first failure of this test seen. T-1698 (e6a2a9f9) is the last change to `hub/src/host/agent/prepared.ts`: it added captured checkout receipts and the preparation and refresh paths. The same code tree passed in the stage 6 Linux cover 38e6c547 (72ba2260), so this is one occurrence and the cause is unknown.

The same run's other failure, host-relaunch-native C2 `push retry required`, belongs to T-1702.

## What to build

1. Reproduce it: run host-prepared.test.ts 10 times on macOS at a load of 12 or more, and 5 times in a Linux `docker run --init` run. Do it on dev, and on 36492afe from before T-1698, to see whether T-1698 introduced it.
2. Find what closes the agent connection during the restart cleanup, and whether a client request races the agent's planned restart.
3. Fix it in the product or in the test's observation of the restart, never by weakening an assertion.

## Acceptance criteria

- [x] C1. The cause of `agent closed` is named with a reproduction, or a differential of 10 macOS runs under load and 5 Linux runs shows no recurrence on either tree (evidence).
  - done: impl-1704 · 2026-11-06T20:59:36.101Z
  - verified: rev-35 [reviewer] · run rev-35-1704-final-1 · 2026-11-06T21:36:07.965Z · commit 26e59e7753745c35b20d55880de2be34e065603c
- [x] C2. When a cause is named: a deterministic test is red before the fix and green after, and host-prepared.test.ts passes 10/10 under load on macOS and 5/5 on Linux `--init` (evidence).
  - done: impl-1704 · 2026-11-06T21:34:16.639Z
  - verified: rev-35 [reviewer] · run rev-35-1704-final-1 · 2026-11-06T21:36:07.965Z · commit 26e59e7753745c35b20d55880de2be34e065603c

## Comments

### coord · 2026-11-06T05:37:45.440Z

The hub's failing-file rerun 54ea67cd (A-17028, Linux x64 c-8 nyc1, dev fa60199a, peak load 1.3) passed host-prepared.test.ts alone: 15 of 15 tests. Like T-1702, this points to a race that shows only under load, not a deterministic regression. The item stays in Bugs; promote it into E-1532 stage 6 if it recurs in the next stage covers.

### coord · 2026-11-06T18:52:48.959Z

coord: second occurrence.

E-1533 stage-1 Linux cover 2424aed9 at dev e19c3496 (A-17186; droplet c-8 sfo2, 2 shards, old image 250987220) failed shard-2 on `hub/test/host-prepared.test.ts` "native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness". It failed after 1.80 s with the same `Error: agent closed` at `hub/src/host/agent-client.ts:30:124`.

It was the only failure in that run: 7415 passed. The test is identical to the first occurrence (b9aa9e7d at 4df6c1ad, before stage 1). Stage 1 changes neither `hub/src/host/agent/prepared.ts` nor `agent-client.ts`.

Two occurrences in about 10 h on Linux. Promoted into E-1533 stage 2 as its own lane, so it is fixed before it reddens more covers.

### impl-1704 · 2026-11-06T20:39:40.415Z

Baseline exact reproduction on macOS arm64 Node 24.21.0, disposable archive of dev 8d6b5c628. Command node --test --test-reporter=tap hub/test/host-prepared.test.ts, sequential driver with 14 owned CPU children. Third file receipt: 14 pass/1 fail, native restart duration 2742.596041 ms, Error: agent closed at agent-client.ts:30:124; whole-child one-minute load sampled each second 16.4976–18.0190. Baseline halted after child 5 when host load sustained >20 for 30s; children 4/5 excluded from loaded evidence, batch incomplete. Burners closed before preservation lock release. No root-cause classification yet. Pre-T-1698 server.ts and host-prepared.test.ts are identical to dev, so the readiness boundary predates T-1698.

### impl-1704 · 2026-11-06T20:41:06.167Z

Consumer sweep before selecting test-observation fix: rg agent.pid / serveAgent / RefWatches / AgentClient.connect / applied.json / agentReady across hub, web, nvim, docs, shipped .agents skills and qa (all tiers included). Production server.ts publishes identity before watches.start/admission, documented in docs/hub/adapters-and-sessions.md. Production registry.ts/ssh-host.ts never read agent.pid: carrier readiness uses authenticated hello (#probe in transport/ssh.ts, bounded master readiness); SSH Host reacquires through its 500ms completion driver and settles unknown operations without replay. beforeReady reconnect is after successful probe. supervisor.sh owns its launched child/birth and never reads agent.pid; version handoff code-delivery.ts waits matching authenticated version and entry.ts writes applied.json after serveAgent returns. agent/restart.ts explicitly rejects persisted agent.pid authority. No production readiness reader misinterprets agent.pid. Test/fixture consumers: host-prepared native test alone calls one-shot connect immediately after pid receipt (affected); host-agent-restart uses eventually(hello), applied.json, or connects after already established readiness (unaffected); host-supervisor authenticates hello before inspecting/tampering pid; fake-host kill-agent compares receipt against authenticated hello and birth, no startup wait; host-push-facts.ts and its test only project diagnostic identity. QA E-1532 and stage-2/3/4 briefs authenticate hello / hub-ready before pid comparisons; they use pid for later cleanup/diagnostics, not readiness. Skill T-1659 change note is historical sweep evidence. Reply/record shape, refusal class and fake wire behavior remain unchanged, so no wire migration needed. Deterministic held-watch-startup test written with unchanged one-shot connect; red run waits preservation slot.

### impl-1704 · 2026-11-06T20:58:29.309Z

Cause confirmed: serveAgent checkpoints agent.pid before awaiting RefWatches.start and setting admitting=true. A client observing the identity file can connect to the live socket during this gap; server intentionally destroys that pre-admission connection, producing agent closed. Held-watch-startup regression reproduced exact error deterministically with unchanged one-shot helper (0/1,1836.739ms); bounded read-only hello observation passed (1/1,1304.641ms). Fix is in the test observation, not product: retry hello only on agent closed with named 10s setup bound, require exact observed PID, close mismatched client, propagate other errors, and keep all prepared mutation/cleanup assertions. Linux cland-t1704-linux (--init/docker-init, arm64 Linux7.0.12,Node24.21,4CPUs,network none,no burners): dev5/5x15 tests,36492afe5/5x15,fixed5/5x16. Native companion macOS serial receipts: host-agent-restart10/10,host-agent18/18,host-reboot-native1/1,host-relaunch-native1/1; all exit0/signalnull, under preservation lock. Remaining loaded macOS evidence awaits assigned slot; C2 not complete.

### rev-35 · 2026-11-06T21:02:39.356Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1704-source-1
commit: ad27a5eac0ab57c5b3fa038da16d85f62a6035a1
scope: full
findings: [{"severity":"medium","text":"The fixed outer watchdogs do not contain the new setup waits. The deterministic test caps all work at15s while its held-startup/readiness observations can each use CLAND_TEST_WAIT_MS; the native restart test caps20s while performing two10s identity waits plus two new configurable hello waits and Git/fixture work. An outer timeout can preempt valid admitted readiness under load. Derive named outer envelopes from the setup budgets plus bounded work/cleanup headroom, preserving every behavior assertion.","file":"hub/test/host-prepared.test.ts","line":70}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17228: cause and deterministic red/green supported by A-17225: pid checkpoint precedes watch startup/admission; only read-only hello is retried, exactPID/mutation/cleanup assertions preserved. One medium source finding:15s/20s outer watchdogs preempt the newly configurable setup waits; reconcile named setup/whole-test budgets and owning docs without changing behavioral bounds. Confirmed by Implementer633644fd. C1 positive evidence inspected; C2 loaded macOS10/10 and final configured evidence still pending, criteria not finally verified. Complete source pass; fresh corrected pin required before verify.

### rev-35 · 2026-11-06T21:04:28.209Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1704-source-2
commit: 136a954a63091dbb7a5a0ae658dc5485f95b5149
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17229: corrected cumulative source clear. Named observation budgets feed90s/140s default watchdog formulas with equivalent10s request caps and30s fixture/cleanup headroom; docs match. Resolves sole A-17228 finding. Read-only hello retry/exactPID, mutation calls and cleanup assertions unchanged; no product/wire changes. A-17225 stays predecessorad27 provenance, not current-head execution. C1/C2 final verification, loaded macOS10/10 at136a and exact-head configured run remain pending; obey Coordinator slot restrictions.

### impl-1704 · 2026-11-06T21:34:17.963Z

Carry record per Coordinator decision b32b9dae-ff36-4a2b-ab90-3be5c6063630: final allowance head26e59e7753745c35b20d55880de2be34e065603c differs from reviewed/verified/runtime136a954a63091dbb7a5a0ae658dc5485f95b5149 only by hub/test/durations.json|7 insertions,1file. Test,product and docs bytes are identical; git diff --name-only lists only that manifest. Runtime evidence at136a954a6,sources byte-identical at26e59e775: A-17247 fixed10qualifying loaded macOS runs,16/16each,load12.209–17.726;12fixedattemptsallpass,two retained/excludedbelow12. Dev10runs9pass/1exactagentclosed,before36492afe10runs5pass/5exactagentclosed,allbaselinefailuresretainnativecode1andexactcase/error. Driverexit1correctlyreflects6baselinefailures;capturedburnersjoinedbeforelockrelease. Green configuredverifyA-17242 run0f3ebbf7 also carries: T0/allT1/fallbackallT2/Web/changedT3once(16identities),hub5283pass,remainingT3deferredmerge;linuxx64droplet,ChromeForTesting156.0.8078.4 HeadlessShell1248,budget/lintreportmode,lifetime1040s,cost$0.0722. No new verify submitted. One unique allowancekey,9s=ceil1.5*max(loadedmacOS5.623951875s,Linuxverify0.949490745s),ownerC-216,expiry2026-11-13,all10qualifyingmacsamples+Linuxsampleinreason. npm run typecheck exit0 at26e59e775. Delta review requested; final ready awaits Reviewer settlement.

### rev-35 · 2026-11-06T21:36:07.965Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1704-final-1
commit: 26e59e7753745c35b20d55880de2be34e065603c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17249: final clear. Independently confirmed only one unique9s C216/Nov13 duration entry, all other manifest/source bytes unchanged; sizingceil1.5*worst5.623951875, typecheckA-17248 completed. Coordinatorb32b9dae carries runtime136a and greenA-17242 without new verify. Audited A-17247:10qualifying loaded fixedmacOS whole-file16/16pass, two additional below12 attempts retained/excluded; exact baseline failuresdev1/before5 and deterministic red/green establish cause. PriorLinux--init5fixed16/16 remainsad27 labelled with reviewed envelope-only successor limits; current136a configured all16pass. A-17242 hub5283/base5147, five empty failure arrays, projectionmatched, T0/T1/allT2/changedT3once/Web green; remainingT3deferred/T4unrun. C1/C2 verified; affected after-stageQA separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-06T21:36:32.827Z

coord: rule 6/7 carry, enqueued at 26e59e77.

- **Verify carries:** 0f3ebbf7 passed at the reviewed 136a954a (A-17242). `git diff --stat 136a954a 26e59e77` is `hub/test/durations.json` only, +7. That is one new allowance key, `host-prepared.test.ts::prepared restart observation waits through identity publication before agent admission`: 9 s, C-216, expires 2026-11-13, ceil(1.5 × 5.624 s worst loaded macOS sample). The key appears once.
- **Reviews:** delta review clear (rev-35-1704-final-1), after the full source review rev-35-1704-source-2. C1 and C2 are verified at 26e59e77.
- **Evidence:**
  - the cause is reproduced deterministically, red then green;
  - macOS loaded differential: dev 9/10, pre-T-1698 5/10, fixed 10/10;
  - Linux `--init` differential, A-17225/A-17247.
- **Outcome:** test-only fix; the readiness race predates T-1698. Merge batch T1+T3 on the integrated tree.

### coord · 2026-11-06T22:28:21.128Z

Merged f0e7e9284c25992fbe5ecfe1a4bf56dcf8db01a6 onto dev.
