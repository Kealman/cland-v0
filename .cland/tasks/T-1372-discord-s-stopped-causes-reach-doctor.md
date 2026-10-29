---
id: T-1372
kind: task
title: Discord's stopped causes reach doctor, and Discord shows in both workbenches
state: open
status: in progress
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1361
  - T-1362
  - T-1363
  - T-1364
  - T-1368
  - E-1312
topic: topic-1175
branch: t/T-1372-discord-s-stopped-causes-reach-doctor
created: 2026-10-27T05:46:51.767Z
updated: 2026-10-29T12:21:25.275Z
---

## Summary

The fake Discord gateway's 4004 and 4014 closes give doctor's lines and fixes. A Discord outage turns its Remotes row red in both workbenches. Messages, approvals, voice messages and pairing codes from Discord read with their marks and rows in Neovim and the web.

## What to build

Spec §3.11, §3.8 (close codes) and §3.2. E-1312's fatal closes record 01's structured causes (4004 → `token`, 4014 → `message-content`), and Discord's liveness feeds 02's offline transition. Doctor's Discord block also shows the paired guild, channel and user ids. Everything else is end-to-end checking of 02, 03, 04 and T-1322 through the fake Discord gateway and REST. The docs page's doctor table gains the Discord causes.

**External wait and shared files:** E-1312 (its voice messages also need E-1311) · **Shared files:** hub/src/remote/ (the Discord stop cause mapping), the remote-control docs page

## Acceptance criteria

- [x] C1. A 4004 and a 4014 close on the fake Discord gateway each give doctor's line with its fix (a new token; the Message Content toggle), and the fake records no request during the doctor run (test).
  - done: impl-1372 · 2026-10-29T10:43:59.387Z
  - verified: rev-26 [reviewer] · run rev-20261029-1372-evidence-2 · 2026-10-29T11:18:39.709Z · commit 86a5a30b08b85c9f6c4e175ae0100da29a5ec168
- [x] C2. A fake Discord outage turns the Discord Remotes row red in headless Neovim and headless Chromium within one second, and recovery clears it (test).
  - done: impl-1372 · 2026-10-29T10:43:59.609Z
  - verified: rev-26 [reviewer] · run rev-20261029-1372-evidence-2 · 2026-10-29T11:18:39.709Z · commit 86a5a30b08b85c9f6c4e175ae0100da29a5ec168
- [x] C3. A message, a voice message and a card approval from the fake Discord read "via Discord" (the voice message with its 🎤 mark) in both workbenches, and a waiting `/cland pair` code shows as a pairing row in both inboxes (test).
  - done: impl-1372 · 2026-10-29T10:44:01.764Z
  - verified: rev-26 [reviewer] · run rev-20261029-1372-evidence-2 · 2026-10-29T11:18:39.709Z · commit 86a5a30b08b85c9f6c4e175ae0100da29a5ec168
- [x] C4. The docs page's doctor causes name 4004 and 4014 with their fixes, and the page passes the docs check (test).
  - done: impl-1372 · 2026-10-29T10:44:01.993Z
  - verified: rev-26 [reviewer] · run rev-20261029-1372-evidence-2 · 2026-10-29T11:18:39.709Z · commit 86a5a30b08b85c9f6c4e175ae0100da29a5ec168

---

## Comments

### impl-1372 · 2026-10-29T10:38:40.071Z

Plan: use pre-agreed seams (production frames + fake Discord REST/gateway; headless Chromium and Neovim). Existing structured doctor causes and generic workbench rendering are present; inspect native-path coverage and add Discord regressions. No wire/schema/authority changes planned. Shared-contract consumer inventory will be recorded before any such change. Skill files frozen: propose workflow guidance in topic instead.

### impl-1372 · 2026-10-29T10:41:39.774Z

C2 red receipt: Neovim renders 'discord · offline' but never 'offline since'; native Discord status omits the existing optional offlineSince and outage lastError. Consumer inventory before filling those existing fields: hub/src/hub/daemon.ts (remote UI projection); web/src/sessions/RemotesLine.tsx; nvim/lua/cland/panels.lua (render facts/red, no migration); shared/wire/index.ts + hub/src/protocol.ts (already optional); Telegram producer unchanged. Tests: hub/test/remote-workbench.test.ts, web-area-state.test.ts, nvim/test/sessions.test.ts and protocol-frames fixture JSON (optional defaults unaffected), web/test/remotes.test.ts and nvim/test/remotes.test.ts (new native coverage); existing web previous-hub snapshot regression retained. Search included all tiers, shipped skills, qa, docs/agents and persisted consumers. No shape/removal/authority change, old omitted-field clients remain supported.

### rev-26 · 2026-10-29T10:46:48.658Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1372-source-1
commit: 656cb7fcf27fe8c5b6d8c0af1b8eac5f45971e04
scope: full
findings: [{"severity":"medium","text":"M1: hub assigned after awaited owner.run acquisition; exchange.close snapshots stop callbacks first, so cancellation can miss a late writer before Store/root drain. Pre-register shared startup/Store/observer ownership, catch/cancel/join approval/render receipts on trigger failure, add same-owner omitted/aborted setup controls with real stoppedhub/nativeclose/root-retention facts.","file":"hub/test/discord-workbench-fixture.ts","line":35}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source1 not clear: complete13-file diff fixedbase340d6ddaa/head656cb7fcf/tree58b93d567 reviewed. StandardsM1 shared fixture ownership only; no source product-behavior finding. Existing optional outage facts, numeric doctor guild/channel/user identity, native4004/4014 local-only cause/fix tests, one-second actual workbench outage/recovery and native text/voice/approval/pair rows/docs all inspected; old optional/legacy clients and text/Telegram behavior retained. A-13652 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13652-t-1372-full-source-review-1-not-clear.md). Reported local correction is outside reviewedhead. Consolidated audit complete; retain every native assertion and1s behavioralbound, shared pre-owned setup/disposal controls, then fresh exact-head source review before verification. No runtime criteria failed/verified from unrun cases, no Reviewer workload execution. A-13650 targeted local evidence not Linux/fullsuite/load proof; frozen skill proposal Coordinator-owned.

### rev-26 · 2026-10-29T10:48:07.305Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1372-source-2
commit: 86a5a30b08b85c9f6c4e175ae0100da29a5ec168
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source2 clear, sole parent656cb7fcf/treeac5897cfa; full13-file source1 carried and all3 correction diffs/shared owner inspected. M1 pre-registers pacingOwner acquisition/hubs/Store/observations and fake close before startup; same dispose gates rootremoval, joins latehubs before Store close. Readiness/approval receipt abort-aware/caught/exactid; omitted/aborted setup controls retain actual acquiredhubstopped/nativeclosed0handlers0connections0pending/closedStore/rootabsent facts. Original native4004/4014 doctornoREST/plainJSONfix/identity,1s actualNvim/Web outage/ACKrecovery/textvoiceapprovalpair and docs assertions unchanged; no product/bound/guard/default change. A-13654 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13654-t-1372-full-source-review-2-clear.md). A-13653 localdoctor16/Nvim4/Web3/typecheck not remote/Linux/load proof; no Reviewer execution/runtime criterion verification. Proceed unchanged-head configured mode-free run then original generated criterion/timing/scopedload/changedT3/Web evidence review and actual duration treatment if needed. No devmerge; frozen guidance Coordinator-owned; no per-item QA or Reviewerfullrun request.

### rev-26 · 2026-10-29T11:02:25.310Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1372-evidence-1
commit: 86a5a30b08b85c9f6c4e175ae0100da29a5ec168
scope: evidence
findings: [{"severity":"medium","text":"M2: original configured run fails existing resumable-history case4.310186616s, actual 'resumed checkpoint old copy edited: not within4000ms'(A-13658:19267). Shared-defect candidate awaiting Coordinator disposition; changedT3/Web unexecuted. No blind retry/bound change/unsanctioned merge.","file":"hub/test/discord-cards.test.ts","line":1072}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence1 not clear at unchanged sourceclear86a5a30b0/A-13654. Originalf7a19278/A-13658 autoexit1; independently3457ordinarypass/1fail plus65scopedloadpass, no unfinished started identity. T0/T1green,T2incomplete/red, changedNvimT3/Web/T4unrun, so C2/C3 required UI evidence absent; no runtime criteria verified or product criterion failure inferred. Actual doctor4004=.268491428s/4014=.193349589s, setupomitted=.179883626s/aborted=.141262164s, docsbase=.000596748s with scopedloadpasses; preserve positive partial receipts without claiming overallpass. A-13659 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13659-t-1372-evidence-review-1-not-clear.md). Linuxx64 c8nyc1, hosttypecheck382b10dc reused, no browser/T3runtimeproof; unrelatedbudgets/lint report-only. Source clear retained separately; lead reported to Coordinator and holds changes/retries. Any directed changedhead needs fresh source review. No Reviewer workload execution.

### impl-1372 · 2026-10-29T11:02:39.689Z

Coordinator authorizes one unchanged-head mode-free flaky rerun at 86a5a30b0. First red receipt A-13658 / f7a19278-20cc-429d-a29e-a93cecac215c: Discord resumable stop finishes frozen history before replay input and replacement cards; 'resumed checkpoint old copy edited: not within 4000 ms'. Coordinator diagnosed existing dev test frozen-clock reaction-lane dependency and filed T-1439 (regression of T-1413); if same identity fails second run, stop for shared fix. Source2 remains clear; evidence1 not clear/incomplete.

### rev-26 · 2026-10-29T11:18:39.709Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1372-evidence-2
commit: 86a5a30b08b85c9f6c4e175ae0100da29a5ec168
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Original-record evidence2 clear for current86a5a30b0/source2 only. Independently confirmed Coordinator1dbaf36a authorized single samehead retry759d7507/A-13662 exit0; priorfailedA-13658/A-13659/T-1439 remains separate, previoushistoryidentity now.237324093s is not a shared-fix claim. Independent4128ordinary+65scopedloadpasses, no fail/cancel/skip/unfinishedidentity. T0/allT1/allT2/changedNvimT3/Web complete. C1native4004=.234310845s/4014=.184182459s plainJSONfix/identity/noREST with5loadeach; C2/C3Nvim=.392346121s(child.274514122),Web1.737448207s actualnative1sred/ACKrecovery/textvoiceapprovalpair; C4docsguard.000504897s+5load/full9docs cases. Setupomitted/aborted.125867317/.086910510s+5load; no new>=3sallowance. A-13663 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13663-t-1372-evidence-review-2-clear-at-current-head.md). Linuxx64 c8lon1, CHS156.0.8078.4/v1248,Nvim.12.5,hosttypecheck382b10dc reused. ChangedT3two top-level/four generatedinclchildren once,addedwall1.938s excludesmachinewait;Web0newreps,remainingT3/T4unrun,budgetsreport-only. C1–C4verified here; no Reviewer execution. Coordinator d25de8d8 sequencingstillrequires T1371landingnotice→authorizedmerge/docsresolution→delta review/newmodefree, plus theirfull-all beforeenqueue. No ready/enqueue request; currentgreen cannot cover futurehead.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-26 · 2026-10-29T12:07:48.277Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1372-source-3
commit: d900f4387b69bdeead3d3090b1213f67a2c5026b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear, Standards/Spec zero findings. A-13680 records exact parents/tree and both-parent shared-doc inspection: both appended site docs tests preserved; setup and doctor/outage/fatal-code guidance retained. Nine task-owned code/test/guide paths byte-identical to source2; 22 other changed paths exactly dev, inherited T-1371 already reviewed/landed. C1–C4 remain stale; prior A-13662 green is first-parent only. A-13676 local receipts do not replace new-head runtime evidence. Proceed unchanged-head configured mode-free then original-record final evidence review; Coordinator 3f464263 full verify all for doctor/remotes.ts and remote/discord.ts remains separate before enqueue. Prior A-13658/T-1439 retained. Reviewer ran no workloads.

### rev-26 · 2026-10-29T12:21:25.275Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1372-evidence-3
commit: d900f4387b69bdeead3d3090b1213f67a2c5026b
scope: evidence
findings: [{"severity":"medium","text":"M3 evidence blocker: original A-13682:19373 recurs at T-1439 shared identity, 'resumed checkpoint old copy edited: not within 4000 ms', 4.299845646s; changed Neovim T3/Web unexecuted. Await Coordinator shared-fix instruction, no blind retry.","file":"hub/test/discord-cards.test.ts","line":1072}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13684 records original mode-free85ef2244 exit1: independently3471 ordinarypass/1fail plus70 separate scopedloadpasses, no unfinished started test identity. T0/T1 green, T2 red; changed NeovimT3/Web/T4 unrun. Native doctor4004 .297009664/4014 .219573729s, setupomitted .160024865/aborted .139850381s and docs .00061638s each +5 scopedloadpasses retained as partial positives. C1–C4 not refreshed; C2/C3 runtime absent, no product criterion failure inferred. Source3 A-13680 remains clear separately. Linuxx64 c8nyc1/Node24.21/Nvim.12.5, reused hosttypecheck29931ca4, no browser runtime proof, budgets report-only. Lead stops for Coordinator/T-1439; prior firstparentgreen and failures separate. Any directed changedhead needs delta review, successor modefree/final review; Coordinatorfullall beforeenqueue remains. No Reviewer workload.
