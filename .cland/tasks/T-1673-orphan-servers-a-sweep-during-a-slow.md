---
id: T-1673
kind: task
title: orphan-servers 'a sweep during a slow launch' found its OpenCode server still alive right after sessions.stop on a Linux dev-t3 run
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1386
branch: t/T-1673-orphan-servers-a-sweep-during-a-slow
created: 2026-11-04T10:12:59.157Z
updated: 2026-11-05T03:23:16.333Z
closed: 2026-11-05T03:23:16.333Z
---

## Summary

The periodic dev T3 run b2955dfd at e15ecc71 (log A-16549, Linux x64 c-8 nyc1, peak load 6.1), after T-1607 landed, failed `hub/test/orphan-servers.test.ts` "a sweep during a slow launch preserves its server before the process row is published" at line 428. The failing check is `assert.equal(pidAlive(candidate.process.pid), false)` right after `await project.sessions.stop('impl')`: `true !== false` after 5.72 s.

The case passed in A-16454, A-16491, A-16515, A-16527 and the T-1607 batch A-16530. coord ran it 5/5 alone on macOS at 6a3d5b68 (tracker-only after e15ecc71). The test file has been unchanged since 2026-10-23. T-1607 changed the session stop path (adopted-worker settlement), so a rare regression where `sessions.stop` resolves before the local OpenCode server has died is not ruled out.

## What to build

Determine whether `sessions.stop` can resolve while a local OpenCode server is still alive. If it can, make stop resolve only after confirmed death. If the test itself races, make it wait for the server's death through the product's own exit observation; never through a weaker assertion.

## Acceptance criteria

- [x] C1. The cause is named with a deterministic reproduction, or 20/20 Linux runs under load show no recurrence (evidence).
  - done: impl-1673 · 2026-11-05T02:04:54.767Z
  - verified: rev-35 [reviewer] · run rev-35-1673-final-1 · 2026-11-05T02:49:30.282Z · commit 08213b1de173badfa7252a0ab7ec626b2216a242
- [x] C2. After `sessions.stop` resolves for a local OpenCode session, its server PID is dead (test, unchanged assertion).
  - done: impl-1673 · 2026-11-05T02:13:20.708Z
  - verified: rev-35 [reviewer] · run rev-35-1673-final-1 · 2026-11-05T02:49:30.282Z · commit 08213b1de173badfa7252a0ab7ec626b2216a242

## Comments

### coord · 2026-11-04T10:16:48.551Z

The hub's own failing-file rerun 8c83ee46 (log A-16550, Linux x64 c-8 nyc1, at the same head e15ecc71) passed the whole `orphan-servers.test.ts` file: 17 passed, 1 skipped, 0 failed. Together with coord's 5/5 on macOS, this classifies the failure as intermittent under load; it stays open for cause.

### coord · 2026-11-05T00:40:50.841Z

Recurrence 2 (coord, 2026-11-05 00:41Z): periodic dev T3 run 94141cff at e22d02c7 (log A-16739, Linux droplet, after T-1678 and T-1610 landed) failed the same test at line 428: `true !== false` after 5.81 s, so the OpenCode server pid was still alive right after `sessions.stop('impl')`. No other failures in that run. The same shape as A-16549 twice now suggests a missing wait for server death in the stop path, or in the test's check, rather than random load. T-1678's stop convergence is now on dev, so the stop path is a good place to start looking.

### coord · 2026-11-05T00:46:15.674Z

The hub's failing-file rerun 8803a762 at the same head e22d02c7 (log A-16740, Linux droplet c-8 sfo2, peak load 1.8) passed the whole orphan-servers file: 17 passed, 1 skipped. This is the same pattern as recurrence 1: red under full-suite load (peak 6.0), green alone. It stays intermittent under load, with a likely missing wait for death; planned for E-1532 stage 5 once T-1666 lands.

### impl-1673 · 2026-11-05T02:00:32.100Z

Consumer sweep before edits: startServer is called only by OpenCodeAdapter.#launch (Codex has unrelated private #startServer). Host/HostSpawned, Sessions, protocol and persisted records stay unchanged. Searched hub/test and nvim/test for hostControl, hostForLaunch/Process, spread localHost/testHost, spawn/exited and observer patterns: 37 files including opencode-host, opencode-remote-cleanup, recording Host contracts, launch-files, lifecycle-serialization, host-supervisor and remote tests. All unaffected by an additive internal startServer result field; local synthetic OpenCode successful launches in opencode-host already supply an exit promise and resolve it on stop, except rollback-only held tests which retain LaunchFiles ownership. Remote hosts retain existing stop/settlement semantics. No wire shape/schema changes or Sessions edits planned. Named cause: parseProcessTable drops Z/X and endProcess can return true on that snapshot, before libuv reaps a local child; LaunchFiles waits for child.exited on rollback but commit discards that receipt for successful OpenCode launches.

### impl-1673 · 2026-11-05T02:03:43.817Z

Deterministic red before fix: node --test --test-name-pattern='stop joins the launched' hub/test/opencode-host.test.ts at base source, new held receipt test, failed true !== false at 72.7ms (stop had completed while child.exited held). After fix: receipt/deadline fake-clock cases and explicitly recovered local server case green; 12/12 opencode-host tests. Existing 5000ms boundedSettlement deadline confirmed with Coordinator; expiry rejects cleanup-incomplete, late positive receipt allows retry. Native original file remains unedited. First full-file run 18/18 green but excluded from preservation/timing evidence due to other session lock overlap; five clean subsequent repetitions in progress. No new tests >=3s on macOS. Hub typecheck and npm run test:lint pass (report-only existing diagnostics preserved).

### rev-35 · 2026-11-05T02:10:10.857Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1673-source-1
commit: 77caf1a87ab091973cf790a2d7fed6e812ad4e8e
scope: full
findings: [{"severity":"medium","text":"Keep local exit supervision while captured child receipt is incomplete. After bounded stop join expires, local poll/stream negative liveness can unwatch and publish exited before reap; no other settlement owner gates it. Route captured local exits through retained settlement and prove timeout->negative poll->positive receipt publication.","file":"hub/src/adapters/opencode.ts","line":804},{"severity":"low","text":"Register held-receipt release and adapter drain in beforeDirectories before spawn. Raw after(close) plus finally entered only after spawn cannot clean an accepted setup failure before scratch removal.","file":"hub/test/opencode-host.test.ts","line":107},{"severity":"low","text":"Update the per-test guide for successful launch reap join, deadline retention/retry, watched negative-liveness and recovered no-handle controls; current guide describes only old rollback receipts.","file":"docs/agents/tests/hub-test-opencode-host.test.ts.md"}]
finding_counts: {"high":0,"medium":1,"low":2}

Full initial source not clear:1medium+2lows, confirmed523634a6/a5d75a34/e96083ad. A-16750 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16750-t-1673-first-source-findings-reap-timeout-supervision-and-fixture-ownership.md. Coreexplicitjoincausetracevalid/soleinternalstartServerconsumer/Hostwireunchanged;timeoutlocalpollownerincomplete,fixturefailurecleanup/guideupdatesneeded. A16748local12/types/lintssupplemental,nativepreservationinprogress/overlapexcluded,no configuredLinux/Web/QA. C2failed,C1unverified. Fresh08213b1desourcerequestarrivedbeforepublication;thisverdictis77cafonly,freshfullreviewfollows. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

Criteria: C2 failed (Local poll/stream can retire an unreaped launched child after the stop receipt deadline; watched-row red reproduced.).

### rev-35 · 2026-11-05T02:12:27.362Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1673-source-2
commit: 08213b1de173badfa7252a0ab7ec626b2216a242
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full repaired source clear,no findings. A16750medium+2lowsresolved:capturedlocalpoll/stream exitsretain#settleExit owner,joinboundednativechildreceipt beforeunwatch/publication,timeoutownerretry retained;watchednegative-livenesscontrol+positivecallback/retry covered. beforeDirectories release+adapterclose registeredprespawn;pertestguideupdated. ExplicitHoststopthenreapjoin causaltrace/soleinternalstartServerconsumer/Sessionsserializedno-skip checked;remote/recoverednohandlepathsunchanged,noHostwire/schema/role/dependency/authority change. A-16751 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16751-t-1673-full-repaired-source-clear-retained-local-reap-settlement.md. ReportedlocalMacNode24.21T2 12/types/T0lint0 supplement;finalhead5native+12preservationstillpending,overlap/mixedoldreceipts excluded. C1/C2unverified;finishauthorizedtargetedchecks thenexact-headmodefreeverify,changedheadfreshreview. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

### impl-1673 · 2026-11-05T02:21:43.275Z

Final-head targeted validation complete, head 08213b1de (full repaired source clear A-16751). Durable raw logs/provenance: A-16753. Local macOS arm64 Node 24.21.0, no browser: original unedited orphan-servers 5/5 serial preservation-locked file runs, each 18 passed/0 failed/0 skipped; unchanged slow-launch PID-dead assertion passes each. Twelve required unedited native files all pass (201 tests, zero failures/skips); serial command exits 0. opencode-host 12/12; hub typecheck/T0 test lint (0 refusals; existing report-only diagnostics) and state-path/Host boundary tests pass. Exploratory overlap/mixed-source samples excluded. No Linux under-load pass claimed; C1 uses deterministic red/green T2 receipt and watched-timeout regressions. Preservation lock released; mode-free verify submitted at reviewed head.

### rev-35 · 2026-11-05T02:49:30.282Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1673-final-1
commit: 08213b1de173badfa7252a0ab7ec626b2216a242
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear,C1/C2verified,no findings. A-16760 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16760-t-1673-final-clear-retained-reap-completion-and-unchanged-native-pid-assertion.md. A16758/46cea269exit0/5115passzeroothers; actualopencode-host12/12base+3newcases5/5loads,closure4/docs4/inventory6pass. C1sourcecause+originalA16759directredexit1true!=false/watchedred1!=0(childstatusunrecorded)qualified; currentpositiveheld/deadlinewatch/retrygreen. C2A16753five18/18originalorphanfiles unchangedPIDassertion and12uneditednativefiles201pass/hashmatch. A16759exactfailfastserialcommands+observedwrappers90068/92331exit0 support inferred17childcompletions,notseparatewaitstatusclaims;earlierexploratoryoverlap/mixedexcluded. LocalMacarm64Node24.21/noBrowser distinct fromconfiguredLinuxx64ams3Node24.21/Nvim.12.5Headless1248Chrome156.0.8078.4. T0/allT1/fallbackallT2/Webcomplete,T3batchdeferred/T4none,QAseparate. Runner0d1850a0exactlyreproducedread-onlyMerkleprojectionfromcheckoutb59c013d;skips[]reportmissing0;1274s/$0.0885resourceaccounting. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-05T03:23:16.333Z

Merged f20511a22572f6abe5fc2faf01c5f3100f8d9aa3 onto dev.
