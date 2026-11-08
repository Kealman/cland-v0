---
id: T-1755
kind: task
title: "`cland host status` and `cland host stop`"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1738
  - T-1740
  - T-1742
  - T-1747
topic: topic-1446
branch: t/T-1755-cland-host-status-and-cland-host-stop
created: 2026-11-07T16:02:00.281Z
updated: 2026-11-08T16:53:19.604Z
closed: 2026-11-08T16:53:19.604Z
---

## Summary

`cland host status` (frame `host.status`) shows two levels:
- **Per pool:** the hosts, the slots in use against the total, and today's and the month's spend.
- **Per host:** id, size, region, uptime, sessions, the declared price per hour and its state, so a host marked `unreachable` reads so.

`cland host stop <id>` (frame `host.stop`) ends the host's sessions as exited and stops the host, which on DigitalOcean and the fake means destroying it; E-1535 adds login release first. Both frames are for the local human CLI or Neovim only, like the other `host.*` frames.

## What to build

The status view over provision records, the process table with T-1740's weights, and T-1742's per-pool totals, with `--json`. Spend is settled costs of the period plus the accrued cost of live hosts (uptime × price), not reservations; storage arrives with logins. `host stop` goes through the confirmed destroy path, and the scheduler treats a stopped host like a destroyed one. `cland host create` stays as a manual add through the same lease, watchdog and spend admission, counted toward `max_hosts`.

## Acceptance criteria

- [x] C1. `cland host status` shows, per pool, the number of hosts, the slots used of the total by weight, and today's and the month's spend from that pool's `hosts` ledger entries plus live hosts' accrued cost (test).
  - done: impl-1755 · 2026-11-08T15:21:32.640Z
  - verified: rev-35 [reviewer] · run rev-35-1755-final-1 · 2026-11-08T15:47:08.690Z · commit 9427dbcb58604b8ff1f8efc7f69a4cae46c51771
- [x] C2. Each host line shows id, size, region, uptime, sessions, price per hour and state, and a host recorded `unreachable` reads `unreachable` (test).
  - done: impl-1755 · 2026-11-08T15:15:58.173Z
  - verified: rev-35 [reviewer] · run rev-35-1755-final-1 · 2026-11-08T15:47:08.690Z · commit 9427dbcb58604b8ff1f8efc7f69a4cae46c51771
- [x] C3. `cland host stop <id>` ends that host's sessions as exited and destroys the host with confirmed reads (test).
  - done: impl-1755 · 2026-11-08T15:03:42.328Z
  - verified: rev-35 [reviewer] · run rev-35-1755-final-1 · 2026-11-08T15:47:08.691Z · commit 9427dbcb58604b8ff1f8efc7f69a4cae46c51771
- [x] C4. `cland host create` at `max_hosts` is refused naming `max_hosts` (test).
  - done: impl-1755 · 2026-11-08T15:03:42.704Z
  - verified: rev-35 [reviewer] · run rev-35-1755-final-1 · 2026-11-08T15:47:08.691Z · commit 9427dbcb58604b8ff1f8efc7f69a4cae46c51771
- [x] C5. `host.status` and `host.stop` from a session or a remote are refused, and `cland host --help` lists `status` and `stop` (test).
  - done: impl-1755 · 2026-11-08T15:15:58.442Z
  - verified: rev-35 [reviewer] · run rev-35-1755-final-1 · 2026-11-08T15:47:08.691Z · commit 9427dbcb58604b8ff1f8efc7f69a4cae46c51771

## Blocked by

- T-1738
- T-1740
- T-1742
- T-1747

## Notes

- Hot files: `hub/src/cli/host.ts`, `hub/src/cli/help.ts`, `hub/src/hub/dispatch.ts` (`host.status`, `host.stop`, the `host.create` limit), `hub/src/protocol.ts`, `hub/src/hub/web-authority.ts`.
- Tests: new `hub/test/host-status.test.ts` and `hub/test/host-stop.test.ts` (T2).
- Serves epic C8 and C4.

## Comments

### impl-1755 · 2026-11-08T14:53:50.859Z

Rule-20 sweep before edits: additive host.status/host.stop frames; retain host.list/host.destroy unchanged. Consumers: protocol validator and shared/wire re-exports; dispatch local authority and web-authority policy; CLI host/usage/help; host-contract, host-ssh-contract, host-create-entry/admission/ready, host-secret-admission, web-authority, host-destroy-native, provision-recovery, pool-scale, waiting-launch/restart, watchdog, spend, clock tests; docs host-providers/session-pool-placement/pool-scaling, implement skill and CHANGES, host-agent docs; QA E-1534 stages 1/2 and E-1533 briefs. Existing frames/records remain unchanged, so old clients and recorded Neovim frames remain unaffected. New status uses provision inventory, scheduler weights, and inspectHostSpend totals; stop aliases confirmed destroy owner. Existing max_hosts admission retained. Target seams explicitly specified by brief: T2 host.status/host.stop frame boundary plus CLI help.

### impl-1755 · 2026-11-08T15:00:28.713Z

Coordinator approved additive currentInventory() in provision-records.ts. Added #occupiedFailure shared by occupied(pool) and currentInventory; SQL keeps active rows and indexed unresolved failures, helper excludes positive non-acquisition. Regression first failed: currentInventory is not a function. Includes failed acquired/unregistered and non-acquired rows, checks exact ids and equality to occupied. Consumers of occupied/active/registered remain unchanged; new status uses currentInventory.

### impl-1755 · 2026-11-08T15:05:25.031Z

Review found missed rule-20 consumer: frozen help in hub/test/fixtures/cli-usage/commands.json and cli-help/cli-usage-compatibility tests. Expanding sweep to CLI help subcommand routing and frozen catalog; new head will migrate HOST_USAGE and status/stop subcommand help. Existing freeze comparison remains.

### rev-35 · 2026-11-08T15:09:12.142Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1755-source-1
commit: 52c19cd04983febd3e5972279910551e10d3df6e
scope: full
findings: [{"severity":"medium","text":"HOST_USAGE adds status/stop while the frozen commands.json HOST_USAGE still omits both. Existing cli-help.test.ts compares exported and rendered help byte-for-byte, so this branch fails its compatibility consumer. Migrate the frozen expected block through the existing procedure, preserving complete comparisons; author8cea0c11 confirms no exception.","file":"hub/src/cli/usage.ts","line":46},{"severity":"high","text":"hostStatus creates a fresh provider registry and reads declarations without populating them. DigitalOceanHostProvider starts unavailable until refreshDeclarations, so DO priceHourly is always null and live-host accrued spend is omitted, showing understated pool totals. Use the approved shared declaration/admission billing source with fake-API coverage; author5dbe5986 confirms no other guarantee.","file":"hub/src/host/status.ts","line":12},{"severity":"medium","text":"host.status awaits spend I/O before accessing provision storage, but bypasses the closed admission fence and tracked #poolPrepares/other shutdown drain. Generic later only sends a reply; storage can close while status resumes. Fence new status work after close and join admitted status operations before DB teardown, with a held-read shutdown regression; author5dbe5986 confirms no owner.","file":"hub/src/hub/dispatch.ts","line":2121},{"severity":"medium","text":"slotsUsed derives only running display rows from Sessions.list(), omitting pending-stop/retained unknown generations and placement promises that still occupy scheduler capacity. Status can show zero used while admission refuses the host as full. Use one shared Sessions/PoolRuntime accounting seam per the lead's policy rather than duplicating counts; authoraac43925 confirms running-only narrowing was not approved.","file":"hub/src/host/status.ts","line":18}]
finding_counts: {"high":1,"medium":3,"low":0}

A-17858 complete pin: Standards2medium (frozenhelp, unowned status shutdown); Spec1high price/liveaccrual+1medium occupiedcapacity. Confirmed8cea0c11/5dbe5986/aac43925; approvedsharedinventory/negativeauthority/max/confirmedstop paths otherwise inspected. C1/C2/C5failed, C3/C4runtime-unverified. Originalproducer provenance requested; A17853 narrative only,196candidate+6finalreported; nativepreservation explicitlypendingCoordinatororder. Tieredruntimeimportercoverage must reconcile before ready. Laterworkingtreecorrectionsoutsidepin. Combinefixesunderownerdecisions thenfreshcommittedreviewbeforeverify; no Reviewer execution/edit/delegation or extra unchanged/fullsuite/provenance-onlyrepeat/devmerge requested. FullafterstageQA separate.

Criteria: C1 failed (DO prices are never populated and live accrual is omitted; status slots omit admitted unresolved/promise capacity.), C2 failed (Fresh DO declarations stay unavailable, so the requested declared hourly price always reads unknown.), C5 failed (HOST_USAGE changed without frozen expected-byte migration; existing CLI help compatibility assertions fail.).

### impl-1755 · 2026-11-08T15:11:44.996Z

Rule-20 corrective sweep: new additive inspectHostSpendSnapshot(env,clock,project) shares one observed ledger with inspectHostSpend (old return shape unchanged); callers are host/status.ts and inspectHostSpend's wrapper, preserved by host-spend exact deep equals. Billing keyed by exact project+lease; unknown legacy price makes period totals unknown. New shared PoolRuntime.#used helper is called by reserve and usage; Sessions.hostUsage delegates; dispatch status consumes that capacity including promises/retained generations. Coordinator explicitly approved narrow reserve extraction and Sessions edit. Frozen commands.json, cli-help subcommand routes and help/usage compatibility/merge tests added to consumer list. Shutdown status work is owned by #poolPrepares and refuses closed admission.

### rev-35 · 2026-11-08T15:19:00.836Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1755-source-2
commit: ce3fe3ed6027e4a1aa4c11dde5fa3887f5e81c55
scope: full
findings: [{"severity":"medium","text":"The additive snapshot scopes billing rates to exact project+lease but leaves settled totals.pools global. hostStatus combines those global settled costs with only current-project inventory/live accrual, so another project's identically named pool inflates status totals. Scope snapshot totals when project is supplied while keeping inspectHostSpend's no-project global contract unchanged; author e72a3994 confirms no cross-project approval. Add a settled other-project same-pool control.","file":"hub/src/executor/droplet/spend.ts","line":320},{"severity":"medium","text":"Held-status test registers onCleanup(stop) before the gate-release/mock-restoration cleanup. FIFO resources make early setup failure await hub.close→held status before the gate can be released; body finally starts only after setup. Prearm a combined release/join/stop/restoration owner before trigger, cover setup in finally and test forced setup failure; author e782928f confirms no earlier gate owner.","file":"hub/test/host-status.test.ts","line":84}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17875 complete pass:1mediumStandards held-testFIFOcleanup deadlock +1mediumSpec cross-projectsettledtotals. Confirmede782928f/e72a3994. Prior four production/help findings substantially repaired: pinned billingrates/unknownlegacy, sharedcapacityusage, closedstatusdrain, frozenhelp. Preserve old inspectHostSpend globalcontract whileprojectsnapshot scoped; prearm combined gate release/join/stop/restoration andforcedsetupcontrol. Rawreviewmatrix140/138pass2helpfailA17869 distinct laterhelp12/12A17868; nativefour56pass headers0/null qualifiedcandidate; inventory71paths58T1T2/13T3requires executionmappingbefore ready. C1failed; remainingcriteriaunverified. Newcommittedrequestbeforeverify; no Reviewer execution/edit/delegation or extraunchanged/fullsuite/provenance-onlyrepeat/devmerge requested. FullafterstageQA separate.

Criteria: C1 failed (Status adds global same-name pool settled totals to project-local live inventory/accrual; additive snapshot needs project-scoped totals.).

### rev-35 · 2026-11-08T15:23:43.065Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1755-source-3
commit: 9427dbcb58604b8ff1f8efc7f69a4cae46c51771
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17880 source3 clear, Standards0/Spec0. Project snapshot settled totals now scoped while inspectHostSpend no-project/global shape retained; local2/global9 regression. Held-read test prearms idempotent gate release→join→close→finallyrestore before admission and wraps setup with forced-failure control. Prior billing/capacity/statusdrain/help repairs retained. Clean exact head/diffcheck0 confirmed; C1–C5runtime-unverified. Post-artifact supplement independently inspected A17879 raw14/14/status0signalnull (projectbilling+bothshutdowncases); A17878 supersedes static inventory with80 runtime paths incl dynamicimports,64T1T2/16T3. Coordinator-approved final native plan19 includes three brief-required files beyond directinventory; old56candidate native/nonfinal remainsqualified. Complete authorized final preservation under lockorder, map receipts/uncovered consumers, then exact-headmodefreeverify. No Reviewer execution/edit/delegation or extra broad/fullsuite/provenance-onlyrepeat/devmerge requested. FullafterstageQA separate.

### rev-35 · 2026-11-08T15:47:08.691Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1755-final-1
commit: 9427dbcb58604b8ff1f8efc7f69a4cae46c51771
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17893 final same-head evidence clear. Clean9427dbcb5 and independently rebuilt exportea2594d8726f739574c95831eff66050848de4f9 matchA17889/bca51654. C1–C5 actual pass outcomes inspected: scopedsettled/livepinnedbilling/unknownlegacy/sharedcapacity, bothstopoutcomes/max/authority/help, normal+forcedshutdown.15newbase+75/75loadpass(max0.904885547s), noallowance. Hub5601/5601,base5463/5463,fiveemptyfailurearrays,T0/allT1/fallbackallT2/mappedT4base/Web nativeuncachedLinuxx64Node24.21Nvim0.12.5green,zero fail/cancel/skip/todo;Shell1248/CfT156.0.8078.4. Independently reconciled64T1T2+16T3=80directimporters; native19/198A17888 covers16+3required,19status0signalnull, bounded500charlogs+labelledtoolsummary/discardedfullstreamlimits retained. A17891mappingconsistent. No configuredT3,widerT3batch/T4repsunrun;report-onlynotices retained. No Reviewer execution/edit/delegation/furtherunchangedprovenancerepeat/devmerge requested. FullafterstageQA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-08T16:53:19.604Z

Merged 100937ae691955eecf296d7a12d5ad8de3e2ccd7 onto dev.
