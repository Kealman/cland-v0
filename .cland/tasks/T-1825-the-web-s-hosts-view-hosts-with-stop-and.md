---
id: T-1825
kind: task
title: "The web's hosts view: hosts with `Stop`, and the logins"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1820
  - T-1824
topic: topic-1494
branch: t/T-1825-the-web-s-hosts-view-hosts-with-stop-and
created: 2026-11-12T10:07:20.571Z
updated: 2026-11-12T20:11:40.183Z
closed: 2026-11-12T20:11:40.183Z
---

## Summary

Opening the Hosts row in the web opens the hosts view inside the Sessions area (spec §3.9, assumed). It lists each pool's hosts with a `Stop` behind a confirmation, and the logins with harness, account, state, host and last sign-in.

## What to build

The folded-open Hosts row of T-1820 becomes the hosts view, on desktop and phone:
- **Hosts.** Each pool's hosts with their facts, as in the host list, and a `Stop` button. Stop asks for confirmation naming the host and the number of its sessions, which end as exited, and goes through `host.stop`. Confirm and Cancel follow the session actions' pattern.
- **Logins.** The logins from `login.list`: name, harness, account, kind, state, host and last sign-in. The list is refreshed when the hub pushes a change to the pool's login counts or the host list, so a login bound, released or signed out updates in place. A signed-out login reads in the warning token.

The hub's refusals show on the line they concern. Explanations go in tooltips. No key binding is added.

## Acceptance criteria

- [x] C1. With two fake hosts and two logins, the hosts view lists each host with its facts and each login with harness, account, state, host and last sign-in, matching `cland login list` (test).
  - done: impl-1825 · 2026-11-12T18:16:55.258Z
  - verified: rev-37 [reviewer] · run rev-37-1825-evidence-1 · 2026-11-12T18:53:17.421Z · commit 61d2e9bb9f371a7ae70790a38507064876e74a7e
- [x] C2. `Stop` on a host asks for confirmation naming the host and its session count, and Confirm stops it through the hub: the host leaves the view and its sessions read exited (test).
  - done: impl-1825 · 2026-11-12T18:27:40.576Z
  - verified: rev-37 [reviewer] · run rev-37-1825-evidence-1 · 2026-11-12T18:53:17.421Z · commit 61d2e9bb9f371a7ae70790a38507064876e74a7e
- [x] C3. Cancel, or closing the view, stops nothing (test).
  - done: impl-1825 · 2026-11-12T18:16:55.829Z
  - verified: rev-37 [reviewer] · run rev-37-1825-evidence-1 · 2026-11-12T18:53:17.421Z · commit 61d2e9bb9f371a7ae70790a38507064876e74a7e
- [x] C4. A login bound, released or signed out updates its line in the open view within one second (test).
  - done: impl-1825 · 2026-11-12T18:27:40.799Z
  - verified: rev-37 [reviewer] · run rev-37-1825-evidence-1 · 2026-11-12T18:53:17.421Z · commit 61d2e9bb9f371a7ae70790a38507064876e74a7e
- [x] C5. At phone width the view fits with no horizontal scroll, the typecheck's colour and contrast checks pass, and the hooks check finds no key listener outside the key map (test).
  - done: impl-1825 · 2026-11-12T18:16:56.396Z
  - verified: rev-37 [reviewer] · run rev-37-1825-evidence-1 · 2026-11-12T18:53:17.421Z · commit 61d2e9bb9f371a7ae70790a38507064876e74a7e

## Blocked by

- T-1820
- T-1824

## Notes

- Hot files: `web/src/sessions/HostsView.tsx` and `HostsView.module.css` (new), `web/src/sessions/HostsLine.tsx`, `web/src/sessions/SessionsArea.tsx`.
- Tests: new `web/test/hosts-view.test.ts` (Web, `projectHub` with the fake host provider, the fake transport and the fake harness binaries, isolated Headless Shell).
- Serves epic C2.

## Comments

### impl-1825 · 2026-11-12T18:14:41.574Z

Consumer/reach inventory: HostsLine is consumed by SessionsArea pane (web/src/sessions/SessionsArea.tsx); Fold owns existing visibility/keyboard dispatch; connection.ts consumes hosts.state and optional sessions snapshot hosts. Existing public contracts reused unchanged: login.list metadata and host.stop through connection.command and web-authority.ts. Web consumers: hosts.test.ts (including previous snapshot), new hosts-view.test.ts. No change to shared/wire, hub production, connect sequence, fakes, recorded Neovim fixtures, shipped skill examples, QA startup probes or persisted records. Native host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop and login-write-back implementations are unaffected; this diff changes no imported dependency of their native paths. Existing T3/T4 remain for stage/merge occasions. Test seam is the assigned Web/projectHub/isolated Headless Shell boundary; no native harness process added.

### rev-37 · 2026-11-12T18:21:47.086Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1825-source-1
commit: 205428c5cee507ea62645379872f43590c2e9796
scope: full
findings: [{"severity":"medium","text":"Equal-total binding changes leave login rows stale: refresh depends on pools identity, while HostsState suppresses unchanged aggregates; scripted pushes bypass this boundary.","file":"web/src/sessions/HostsView.tsx","line":63},{"severity":"medium","text":"Resolved host.stop incomplete outcomes are discarded; state:'destroying' and the native deletion-not-confirmed reason never appear on the affected row.","file":"web/src/sessions/HostsView.tsx","line":25}]
finding_counts: {"high":0,"medium":2,"low":0}

Source review not clear. Medium: HostsView.tsx:63 refreshes only on aggregate pools identity; equal-total binding swaps emit no frame, leaving login rows stale (lead red: durable equal-total binding swap rendered: not within 1000 ms). Medium: HostsView.tsx:25 drops resolved host.stop destroying/incomplete results and native reason; actual handler reproduction retains deletion not confirmed while row alert times out. The scripted second-Store/push test bypasses C4's producer boundary (rule 9). C1/C3/C5 remain run-dependent and unverified. Complete source analysis published in the topic artifact; no Reviewer executions.

Criteria: C4 failed (Equal-total live binding swap is suppressed by aggregate publication; current tests inject the frame that production omits.), C2 failed (Resolved incomplete host.stop deletion is silently discarded instead of shown on the affected host line.).

### impl-1825 · 2026-11-12T18:21:52.917Z

Pre-change rule-20 sweep for login metadata invalidation: shared production transitive import graph selected 645 tests (221 T3/T4), plus 16 unknowns conservatively reached; complete named set, tiers and unknown reasons are in A-19096 at .cland/artifacts/A-19096-t-1825-transitive-hostsstate-consumer-sweep.json. Direct frame/function consumers: hub/src/hub/core.ts and daemon.ts, hub/src/host/hosts-state.ts, web/src/connection.ts, nvim/lua/cland/client.lua; protocol/shared/wire types; hub/test/hosts-state.test.ts, connection-snapshot, daemon, edges-component, request-guard-component, tracker-component, tracker; nvim/test/hosts and sessions; web/test/hosts and hosts-view; wire-conformance; qa/briefs/E-1537-stage-1.md; docs/agents/tests/web-test-hosts.test.ts.md. Native host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop and login-write-back are reached transitively through projectHub/host fixtures; no lifecycle/authority change planned. Planned change preserves exact frame shape, connect order and rows, only allowing a coalesced equal-total replacement after a positive login-record mutation. Consumers already apply replacement state; migration unnecessary. Existing old-snapshot web regression remains. Full T3 stays merge-queue evidence and T4 the stage occasion under the assigned evidence split.

### impl-1825 · 2026-11-12T18:29:35.219Z

Evidence correction to the A-19096 consumer sweep: 645 selected paths include 227 T3 and 13 T4 (240 native-tier paths), plus16 unknown rows counted reached. Earlier221 counted only string-valued tier entries and omitted19 object-valued T3 manifest entries. Exact selected path list is unchanged. Clock label correction: the live-record binding-swap case explicitly advances production timer scheduling by1000ms with FakeClock; its real1000ms observer is armed before mutation and includes that explicit advance plus publication/read/render. This is deterministic coalescing coverage and bounded delivery/render after advance, not a measured real-time coalescing+network latency. No head change or native rerun.

### rev-37 · 2026-11-12T18:29:49.658Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1825-source-2
commit: 61d2e9bb9f371a7ae70790a38507064876e74a7e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source pass clear: both source-1 findings resolved. HostsState coalesces positive login invalidations despite equal aggregate projections; actual live-record swap regression preserves final DOM. HostRow retains native non-destroyed Stop state/reason and displays pushed host state; real incomplete-provider control added. Shared frame shape/order and previous-wire regressions unchanged. A-19096 normalized inventory is 645 selected +16 unknown; 227 selected T3 +13 T4, not earlier 221. FakeClock control advances producer scheduling and bounds the real observer; not a measured coalescing/network latency. A-19101 provides partial exact-head macOS targeted 41/41 across five files; full configured evidence remains pending. No criteria verified by this source-only verdict.

### rev-37 · 2026-11-12T18:53:17.421Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1825-evidence-1
commit: 61d2e9bb9f371a7ae70790a38507064876e74a7e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear: run 9c8eb774/A-19109 matches source-cleared 61d2e9bb9 and independently recomputed canonical tree afdfcfcd62bd062c08095ea4c476ddfa4d866ca4. T0/all T1/fallback all T2/Web exit0; 6217 base test +688 base file passes, zero negative finishes. All five exact new Hosts Web names and file finish pass; confirmed/incomplete Stop, Cancel/fold preservation, live equal-total swap, desktop/phone metadata/warning/overflow and T0 guards establish C1–C5. Whole-file Web CPU-load10/10 is separate report-only evidence. Conservative661 union: every23 T1/337 T2/54 Web path has case+file pass;233 T3/14 T4 have no configured receipts, separately deferred with targeted exact-head Mac41/41 support A-19101/A-19103. FakeClock advances coalescing explicitly; bounded render is not measured real-time network latency. Linux droplet Node24.21/Nvim0.12.5, HeadlessShell1248/CfT156.0.8078.4; cache:null/skips[]. Report-only advisories, retained known temp aliases, native provenance limits and after-stage QA split recorded in final artifact.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-12T20:11:40.183Z

Merged dc4cd638f4371bf7e84df3234aef963bcc509f44 onto dev.
