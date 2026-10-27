---
id: T-1363
kind: task
title: The web's Sessions area shows the Remotes row
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1362
topic: topic-1111
branch: t/T-1363-the-web-s-sessions-area-shows-the
created: 2026-10-27T05:46:50.067Z
updated: 2026-10-27T12:05:39.877Z
closed: 2026-10-27T12:05:39.877Z
---

## Summary

The web's Sessions area shows the same Remotes row as Neovim, fed by 02's frame, red at once on a failure.

## What to build

Spec §3.11 and v0.2 §3.2 and §3.6. The web edge passes the remote-state frame to browsers, and the web authority still refuses `remote.status`. The connection model keeps the latest frame.

Model a `RemotesLine` component on `VerifyLine` and place it in the Sessions area beside the accounts strip and the verification line, with a CSS Module and colours from `tokens.css` only. It lists facts per messenger and puts no explanation in the UI: the meaning of each field goes in its `title`, and the docs come in 08. While a remote is offline or stopped, its row uses the error token, and secondary text keeps 4.5:1 contrast. At phone width the row sits in the Sessions screen without horizontal scroll. Any key binding goes through `keymap.ts`. None is needed beyond the existing focus movement.

**External wait and shared files:** none · **Shared files:** web/src/sessions/SessionsArea.tsx, web/src/connection.ts, hub/src/hub/web-authority.ts

## Acceptance criteria

- [x] C1. Headless Chromium's Sessions area shows the Remotes row with connection, paired name, mute, outbox depth and last error, styled as an error within one second of a fake outage and plain on recovery (test).
  - done: impl-1363 · 2026-10-27T11:32:44.293Z
  - verified: rev-26 [reviewer] · run rev-20261027-1363-evidence-1 · 2026-10-27T11:56:20.219Z · commit c0d52d7acfa3fd2f423d265bd943a414ff83173a
- [x] C2. The browser receives the frame while a `remote.status` request from the web edge is still refused (test).
  - done: impl-1363 · 2026-10-27T11:32:44.411Z
  - verified: rev-26 [reviewer] · run rev-20261027-1363-evidence-1 · 2026-10-27T11:56:20.219Z · commit c0d52d7acfa3fd2f423d265bd943a414ff83173a
- [x] C3. At phone width the row renders inside the Sessions screen with no horizontal page scroll (test).
  - done: impl-1363 · 2026-10-27T11:32:44.503Z
  - verified: rev-26 [reviewer] · run rev-20261027-1363-evidence-1 · 2026-10-27T11:56:20.219Z · commit c0d52d7acfa3fd2f423d265bd943a414ff83173a

## Comments

### coord · 2026-10-27T09:50:32.656Z

Contract from T-1362 (coord, 2026-10-27 09:51Z): the web reads HubEvent {type:'remote.state', remotes: RemoteStateRow[]} and the optional SnapshotValues.sessions.remotes. A row has these fields: messenger, enabled, connection ('connected'|'offline'|'stopped'|'disabled'), offlineSince (string|null), pairedName (string|null), mute, outboxDepth, lastError (string|null, redacted), and an optional stopCause using doctor's cause enum. The shared wire type in shared/wire restates the shape. Build against the landed T-1362, and never against its unlanded branch.

### impl-1363 · 2026-10-27T10:58:12.715Z

Pre-change consumer inventory (rule 20): this item consumes the existing additive RemoteStateRow; no wire shape or permission expansion is planned. Production: hub protocol/core publisher, snapshot.sessions.remotes, dispatcher/model ring/visibility, web-edge serializer, web-authority remote.status refusal, shared/wire mirror; Neovim init/state/sessions already consumes it and is unaffected. New consumer: web/src/connection.ts -> SessionsArea/RemotesLine. Existing tests: hub remote-workbench, connection-snapshot, tracker[-component], daemon, edges-component, request-guard-component (T2/T3 as declared), nvim sessions/remotes; web connection/sessions/phone-sessions/verification/pairing. Shipped guidance: implement skill, hub README, docs/agents/pairing.md and remote-workbench/nvim-remotes guides. QA briefs E-1307/E-420 have no RemoteStateRow consumer; no startup probe or persisted reader consumes the safe projection (native remote status/storage shapes remain unchanged). Search covered hub/src, shared, web, nvim, hub/test, .agents, qa and docs/agents, including T3/T4. Keep a browser regression removing sessions.remotes and suppressing remote.state to emulate the previous hub.

### impl-1363 · 2026-10-27T11:30:55.382Z

TDD local macOS (Darwin/arm64, pinned isolated Chrome Headless Shell): baseline red at row.waitFor because Remotes was absent, after building the missing baseline web/dist. Desktop then green. Phone added next and failed "long paired names wrap within the row: false !== true" at 320px; CSS wrapping then made both cases green (1.054 s desktop / 0.519 s phone in that partial targeted run). Browser-owned socket proves remote.state arrives while remote.status returns cli-neovim-only. Current extra stopped/disable assertions passed stopped state but exposed a fixture setup issue: isolateVerification rewrote the unpinned config and removed its managed marker; fixed by declaring the fixture-local lockPath before rendering. Retesting that extension now. npm run typecheck passed, including token/contrast/source/hook checks; closed-item wording lint passed. These are targeted local receipts, not Linux task-suite evidence.

### rev-26 · 2026-10-27T11:35:03.935Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1363-source-1
commit: f0a8ac748a9715dc66201c1b2d3a4601272fa01c
scope: full
findings: [{"severity":"medium","text":"M1 Standards: REMOTE_USAGE now claims Neovim and web Sessions but its owning frozen commands.json row remains unchanged; retain unchanged guard red/green receipts and correct only that row.","file":"hub/src/cli/usage.ts","line":67}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated full audit A-12726: Standards M1 only, no additional Spec finding. State replacement/old-wire, token CSS/wrapping, native fake outage/recovery and browser authority/phone assertions inspected. A-12725 is a local targeted summary only; C1-C3 configured runtime verification pending. Commit/push correction and request fresh source review before verification.

### impl-1363 · 2026-10-27T11:35:20.739Z

Addressed source-review M1 in 6995114423bf390491413e41aa361ac49706a57c: only the owning REMOTE_USAGE frozen row changed. Original red/green outputs and exit receipts retained in A-12727 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12727-t-1363-help-guard-red-and-green-receipts). Local Darwin arm64 unchanged cli-usage-compatibility: exit 1, 1 failure -> exit 0, 1/1; unchanged cli-help: exit 1, full + remote help failure -> exit 0, 5/5. Captures contain only declared logs/receipt/README, scanned for Telegram token and bearer patterns with positive controls. No guard source or broader golden update, no new dev merge after first review, no configured verification run yet.

### rev-26 · 2026-10-27T11:35:47.990Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1363-source-2
commit: 6995114423bf390491413e41aa361ac49706a57c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, Standards/Spec no remaining findings, A-12728 retaining A-12726's full audit. Direct-child delta is only REMOTE_USAGE's frozen row; original unchanged guard red/green logs and native exits inspected in A-12727. C1-C3 configured runtime marks remain pending. One unchanged-head mode-free task verify may proceed; final settlement requires original same-head execution/timing and Web repetition facts.

### rev-26 · 2026-10-27T11:36:29.579Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1363-admission-1
commit: 6995114423bf390491413e41aa361ac49706a57c
scope: evidence
findings: [{"severity":"medium","text":"M2 Standards: new web/test/remotes.test.ts has no explicit tier classification; verify-tiers refused before execution. Add its lexical Web entry and preserve unchanged guard receipts before new source review.","file":"hub/test/tiers.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-12729 records original pre-admission refusal 87bbdc53 and exact-head map inspection. No run, timings or C1-C3 runtime proof exists. I missed explicit Web classification in source review; M1 remains resolved. Correct the manifest and request fresh source clearance before resubmission.

### rev-26 · 2026-10-27T11:37:23.066Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1363-source-3
commit: a8078cb8cd69a8b07ec881a8294763ee0ba8175c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, A-12731 retaining A-12726/A-12728 full audit. Sole delta adds the lexical Web manifest entry, M2 resolved; A-12730 records original pre-admission refusal and unchanged static guard success. M1 remains resolved. No configured runtime occurred at prior refusal; C1-C3 verification pending. One unchanged-head mode-free verification may now proceed.

### rev-26 · 2026-10-27T11:38:18.938Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1363-admission-2
commit: a8078cb8cd69a8b07ec881a8294763ee0ba8175c
scope: evidence
findings: [{"severity":"medium","text":"M3 Standards: added raw browser watchdog exceeds frozen wall-clock-wait allowance 0; verify-test-lint refused before execution. Use the established bounded receipt seam, retaining one-second bound/assertions/context cleanup without raising allowances.","file":"web/test/remotes.test.ts","line":47}]
finding_counts: {"high":0,"medium":1,"low":0}

Original pre-admission refusal 96c54773 recorded in A-12732. No runtime job or criterion/timing proof exists. M1/M2 resolved; M3 correction requires fresh source review before resubmission. Lead proposes within() with context-owned native cleanup and unchanged authority/state assertions; preserve actual lint/browser receipts.

### rev-26 · 2026-10-27T11:41:11.614Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1363-source-4
commit: c0d52d7acfa3fd2f423d265bd943a414ff83173a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-12736 retaining original full audit. M1/M2/M3 resolved; raw timer replaced with established strict receipt bound and local positive-receipt guard corrected with fresh disabled browser frame before anchored detachment/final count. Original complete admission red/green, tier/browser/typecheck outputs in A-12735 inspected; no guards/allowances weakened. Both prior submissions remain pre-execution refusals. One unchanged-head mode-free verification may proceed; C1-C3 runtime marks pending.

### rev-26 · 2026-10-27T11:56:20.219Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1363-evidence-1
commit: c0d52d7acfa3fd2f423d265bd943a414ff83173a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, C1–C3 verified. Original run a8f5b988/A-12748 exit 0 matches source-4 head. Independently deduplicated 3681 ordinary passes + 5 separate T1 load passes. Exact desktop/phone cases pass 2.426631850/1.564561814 s with native outage/recovery, actual browser state + management refusal, 320px bounds and prior-hub assertions. New T1 state compatibility case passes .001258506 s + exact 5/5 load. Original report-only Web whole-file 10/10 repetitions is separate from per-case load records. T0/all T1/fallback all T2/Web complete; no T3/T4. Linux c-8 lon1 / pinned HS156.0.8078.4 v1248; host typecheck reused, not remote. Lint/duration/ratchet report-only warnings retained. A-12750 records platform/timing/coverage limits and prior preflight-only refusals. QA none; Coordinator integrated cover/enqueue/landing separate.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-27T12:05:39.877Z

Merged aeb91bc866f4ea1a69efa7ffc5e2ada61bf320d2 onto dev.
