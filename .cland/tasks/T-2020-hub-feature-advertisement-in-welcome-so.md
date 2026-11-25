---
id: T-2020
kind: task
title: Hub feature advertisement in welcome, so setup refuses paid offers against a hub that doesn't enforce expected terms
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1757
branch: t/T-2020-hub-feature-advertisement-in-welcome-so
created: 2026-11-20T00:30:37.837Z
updated: 2026-11-25T06:19:15.578Z
closed: 2026-11-25T06:19:15.578Z
---

## Summary

T-1858 makes host.prepare and login.add validate the paid terms the human agreed to, and gives pool config writes a compare-and-set. A newer setup talking to an older running hub, for example during a restart, can't tell whether the hub enforces these fields, because the hub advertises only `PROTOCOL_VERSION` and no per-feature capabilities. Older hubs ignore the fields, so setup's client re-read is the only protection in that window (T-1858 scope decision, 2026-11-20).

## What to build

The hub lists the features it enforces in `welcome`, for example `paidTermsAdmission`. Setup refuses a paid offer against a hub that doesn't list it, naming the reason and suggesting a hub restart. Clients that don't read the field are unaffected.

## Acceptance criteria

- [x] C1. `welcome` lists the enforced features, and the list is covered by the wire compatibility fixtures (test).
  - done: impl-2020 · 2026-11-25T03:43:47.248Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2020-final · 2026-11-25T04:58:56.980Z · commit 2a689d59e80d9c501d63fa0d8306058d62dd5b85
- [x] C2. Setup refuses a paid host or login offer against a hub whose `welcome` doesn't list paid-terms admission, and starts nothing (test).
  - done: impl-2020 · 2026-11-25T02:18:56.602Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2020-final · 2026-11-25T04:58:56.980Z · commit 2a689d59e80d9c501d63fa0d8306058d62dd5b85

## Comments

### impl-2020 · 2026-11-25T01:40:03.889Z

Contract census (searched welcome, ClientFeature, probeHub and askHubFrame, plus setupHub and expectedTerms paths, including raw readers, fixtures and every test tier):
qa/briefs/E-417-stage-2.md
shared/socket-client.ts
.agents/skills/onboarding/SKILL.md
.agents/skills/onboarding/TOUR.md
.agents/skills/onboarding/WELCOME.md
qa/briefs/E-412-stage-3.md
qa/briefs/E-1532.md
docs/hub/identity-and-delivery.md
qa/briefs/E-1532-stage-6.md
docs/hub/web-edge.md
docs/hub/the-tracker.md
shared/wire/index.ts
qa/briefs/E-414-stage-1.md
web/src/events-feed.ts
qa/briefs/E-418.md
hub/src/spoke/tools.ts
qa/briefs/E-1536.md
docs/hub/negotiated-connection-snapshot.md
hub/src/spoke/spoke.ts
qa/briefs/E-1537-stage-3.md
docs/hub-extraction.md
docs/hub/the-projects-hub.md
docs/hub/modules.md
hub/src/spoke/hub-client.ts
qa/briefs/E-1532-stage-2.md
docs/evidence/T-702-assertion-inventory.md
docs/hub/asks-and-the-inbox.md
docs/evidence/T-911-startup-recovery.md
qa/briefs/E-419.md
web/src/connection.ts
docs/evidence/T-1676-spoke-consumer.md
qa/briefs/E-1537.md
docs/agents/qa-demo-recording.md
qa/briefs/E-419-stage-3.md
docs/hub/running.md
qa/briefs/E-1537-stage-1.md
qa/briefs/E-1531.md
qa/briefs/E-1537-stage-2.md
nvim/lua/cland/hub.lua
docs/agents/tests.md
qa/briefs/E-412-stage-1.md
qa/briefs/E-1532-stage-3.md
qa/briefs/E-414-stage-2.md
qa/briefs/E-1537-stage-5.md
docs/evidence/T-709-timeout-integration.md
qa/briefs/E-1531-stage-2.md
qa/briefs/E-412-stage-2.md
qa/briefs/E-1532-stage-4.md
qa/briefs/E-419-stage-4.md
qa/briefs/E-414-stage-3.md
qa/briefs/E-419-stage-2.md
docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md
qa/briefs/E-417-stage-1.md
qa/briefs/E-414.md
qa/briefs/E-416-stage-3.md
qa/briefs/E-416-stage-1.md
docs/agents/tests/hub-test-session-events.test.ts.md
web/README.md
hub/src/hub/dispatch.ts
qa/briefs/E-1536-stage-4.md
docs/agents/tests/hub-test-telegram-cards.test.ts.md
hub/src/hub/core.ts
qa/briefs/E-415.md
nvim/test/fixtures/protocol-frames/artifacts.json
qa/briefs/E-416-stage-2.md
nvim/test/fixtures/protocol-frames/inbox-actions.json
qa/briefs/E-1533-stage-1.md
nvim/test/fixtures/protocol-frames/crew.json
qa/briefs/E-418-stage-2.md
hub/src/hub/web-edge.ts
nvim/test/fixtures/protocol-frames/hosts.json
web/test/harness.ts
nvim/test/fixtures/protocol-frames/launcher-component.json
qa/briefs/E-413.md
nvim/test/fixtures/protocol-frames/item-prefixes.json
qa/briefs/E-617.md
nvim/test/fixtures/protocol-frames/needs-you.json
web/test/asks.test.ts
qa/briefs/E-418-stage-1.md
nvim/test/fixtures/protocol-frames/agents-filters.json
qa/briefs/E-1536-stage-1.md
qa/briefs/E-1536-stage-3.md
nvim/test/fixtures/protocol-frames/explorer.json
qa/briefs/E-413-stage-1.md
qa/briefs/E-1313.md
docs/spec/v0.1.4.md
docs/brand/launch-claims-audit-T-783.md
qa/briefs/E-1531-stage-3.md
web/test/passkeys.test.ts
nvim/test/fixtures/protocol-frames/explorer-component.json
qa/briefs/E-1533-stage-3.md
nvim/test/fixtures/protocol-frames/shell.json
web/test/signin.test.ts
qa/briefs/E-616.md
qa/briefs/E-611.md
web/test/setup-signin.test.ts
qa/briefs/E-413-stage-2.md
qa/briefs/E-1536-stage-2.md
qa/briefs/E-415-stage-3.md
web/test/accounts.test.ts
nvim/test/fixtures/protocol-frames/shell-component.json
web/test/sessions.test.ts
nvim/test/fixtures/protocol-frames/declined-ask-component.json
hub/src/evidence-publish.ts
nvim/test/fixtures/protocol-frames/inbox-requests.json
web/test/connection.test.ts
nvim/test/fixtures/protocol-frames/panel-placement-component.json
nvim/test/fixtures/protocol-frames/human-marks-component.json
web/test/message-users.test.ts
nvim/test/fixtures/protocol-frames/message-users.json
web/test/phone-asks.test.ts
nvim/test/fixtures/protocol-frames/progress-counts-component.json
nvim/test/fixtures/protocol-frames/items.json
docs/agents/tests/hub-test-tracker-component.test.ts.md
nvim/test/fixtures/protocol-frames/vboard.json
docs/agents/tests/nvim-test-startup-budget.test.ts.md
nvim/test/fixtures/protocol-frames/events-quiet.json
hub/src/executor/droplet/spend-hubs.ts
nvim/test/fixtures/protocol-frames/sessions.json
nvim/test/fixtures/protocol-frames/remote-via.json
web/test/remotes.test.ts
docs/agents/tests/hub-test-spoke-lazy-tools.test.ts.md
nvim/test/fixtures/protocol-frames/thread.json
docs/agents/tests/hub-test-web-auth.test.ts.md
nvim/test/fixtures/protocol-frames/plan-component.json
docs/agents/tests/hub-test-cli-session-credential.test.ts.md
nvim/test/fixtures/protocol-frames.json
docs/agents/tests/hub-test-spoke-unix-edge.test.ts.md
hub/src/protocol.ts
nvim/test/startup-budget.test.ts
nvim/test/startup-budget-support.ts
.agents/skills/implement/CHANGES/T-1608-baseline.md
docs/agents/tests/hub-test-spoke-import-graph.test.ts.md
nvim/test/stub-hub.ts
hub/src/setup/hub.ts
docs/agents/tests/hub-test-claude-code-schedule.test.ts.md
hub/src/doctor/release.ts
hub/src/doctor/users.ts
hub/src/cli/auth.ts
hub/src/doctor/hosts.ts
hub/src/doctor/project.ts
hub/src/doctor/remotes.ts
hub/src/cli/login-terminal.ts
hub/src/cli/task.ts
hub/src/cli/push.ts
hub/src/cli/socket-client.ts
hub/src/cli/demo.ts
hub/src/cli/inbox.ts
hub/src/cli/merge.ts
hub/src/cli/account.ts
hub/src/cli/worktree.ts
hub/src/cli/publish.ts
hub/src/cli/web.ts
hub/src/cli/executor.ts
hub/src/cli/release.ts
hub/src/cli/login.ts
hub/src/cli/hook.ts
hub/src/cli/artifact.ts
hub/src/cli/config.ts
docs/agents/tests/hub-test-host-survival-native.test.ts.md
hub/src/cli/host.ts
hub/src/cli/session.ts
hub/src/cli/suite.ts
hub/src/cli/remote.ts
hub/src/cli/models.ts
hub/src/cli/task-import.ts
hub/src/cli/role.ts
hub/src/cli/subscriptions.ts
hub/src/cli/hub.ts
docs/agents/tests/hub-test-claude-code-sessions.test.ts.md
docs/agents/tests/hub-test-gateway-state.test.ts.md
hub/src/cli/rule.ts
docs/agents/tests/hub-test-pairing-approval.test.ts.md
hub/src/cli/crew.ts
docs/agents/tests/hub-test-request-guard-component.test.ts.md
docs/agents/tests/hub-test-edges-component.test.ts.md
docs/agents/tests/hub-test-verify-submission.test.ts.md
docs/agents/tests/hub-test-launch-files.test.ts.md
docs/agents/tests/hub-test-spoke-footprint.test.ts.md
docs/agents/tests/hub-test-config-set.test.ts.md
docs/agents/tests/hub-test-web-tunnel-guide.test.ts.md
docs/agents/tests/hub-test-claude-component-fixture.test.ts.md
docs/agents/tests/hub-test-session-credential-io.test.ts.md
hub/test/prune-crash-case.ts
hub/test/durations.json
hub/test/login-terminal.test.ts
hub/test/cli-session-credential.test.ts
hub/test/web-auth.test.ts
hub/test/qa-demo-policy.test.ts
hub/test/hosts-state.test.ts
hub/test/web-artifacts.test.ts
hub/test/account-coalescing.test.ts
hub/test/web-authority.test.ts
hub/test/web-area-state.test.ts
hub/test/wire-conformance.ts
hub/test/tool-arguments-spoke.test.ts
hub/test/tracker-component.test.ts
hub/test/setup-hosts.test.ts
hub/test/spoke-unix-edge.test.ts
hub/test/hygiene.test.ts
hub/test/fixture-socket-lifecycle.test.ts
hub/test/startup-deadline-component.test.ts
hub/test/auth-mode.test.ts
hub/test/progress.test.ts
hub/test/test-admission.test.ts
hub/test/telegram-card-web-fixture.ts
hub/test/suite-admission-close.test.ts
hub/test/admission-exchange.ts
hub/test/spoke-footprint.test.ts
hub/test/host-secret-admission.test.ts
hub/test/session-brief-component.test.ts
hub/test/web-cookie-secure.test.ts
hub/test/session-brief.test.ts
hub/test/telegram-pairing.test.ts
hub/test/cli.test.ts
hub/test/session-credential-io.test.ts
hub/test/subscriptions.test.ts
hub/test/harness-framing.test.ts
hub/test/item-summary-scale.test.ts
hub/test/validation-support.ts
hub/test/host-clone-integration.test.ts
hub/test/resilience-component.test.ts
hub/test/verify-submission.test.ts
hub/test/claude-component-fixture.ts
hub/test/gateway-state.test.ts
hub/test/config-set.test.ts
hub/test/hub-lock-readers.test.ts
hub/test/answer-users.test.ts
hub/test/names.test.ts
hub/test/cover-quiet.test.ts
hub/test/session-async-processes.test.ts
hub/test/adapter-composition.test.ts
hub/test/web-frame-client.ts
hub/test/store-and-forward.test.ts
hub/test/web-signin.test.ts
hub/test/artifact-lifecycle.test.ts
hub/test/suite-admission.test.ts
hub/test/request-guard-component.test.ts
hub/test/setup-signin.test.ts
hub/test/web-upload.test.ts
hub/test/startup-smoke.test.ts
hub/test/fake-harness.test.ts
hub/test/login-list.test.ts
hub/test/executor-droplet-component.test.ts
hub/test/project-clock.test.ts
hub/test/hub-cards.test.ts
hub/test/import-github.test.ts
hub/test/remote-discovery-host.test.ts
hub/test/topics.test.ts
hub/test/connection-resync.test.ts
hub/test/tracker.test.ts
hub/test/fakes/legacy-remote-hub.ts
hub/test/heartbeat.test.ts
hub/test/inbox-workload.test.ts
hub/test/harness.ts
hub/test/account-cli.test.ts
hub/test/topics-component.test.ts
hub/test/run-suite.ts
hub/test/web-edge.test.ts
hub/test/session-async-processes-lifecycle.test.ts
hub/test/verify-all.test.ts
hub/test/permissions.test.ts
hub/test/doctor-users.test.ts
hub/test/login-add-component.test.ts
hub/test/secrets.test.ts
hub/test/spoke-readiness.test.ts
hub/test/tracker-native-boundary.test.ts
hub/test/claude-component-fixture.test.ts
hub/test/inbox-archive-workload.ts
hub/test/claude-code-schedule.test.ts
hub/test/pairing-approval.test.ts
hub/test/topic-withdraw.test.ts
hub/test/scenarios/hub-lifecycle.test.ts
hub/test/daemon.test.ts
hub/test/gateway.test.ts
hub/test/fixtures/tracker-snapshot/items.json
hub/test/name-reservation.test.ts
hub/test/connection-resume.test.ts
hub/test/edges-component.test.ts
hub/test/connection-snapshot.test.ts
hub/test/spoke-lazy-tools.test.ts
hub/test/host-survival-native.test.ts
hub/test/mod-bridge.test.ts
hub/test/edges.test.ts
hub/test/doctor-hosts.test.ts
hub/test/roles-component.test.ts
hub/test/web-tunnel-guide.test.ts
hub/test/artifact-user.test.ts
hub/test/session-events.test.ts
hub/test/remote-discovery-cli.test.ts
hub/test/spoke-artifact-budget.test.ts
hub/test/telegram-liveness.test.ts
hub/test/claude-code-sessions.test.ts
hub/test/user-invites.test.ts

Migration: hub protocol and shared/wire Welcome gain optional enforcedFeatures; dispatch advertises for both human/UI and spoke welcome paths. shared socket client gains a read-only welcome feature reader, leaving probeHub API unchanged. SetupHub/hosts consumes it and refuses unknown/absent support before paid offers. Neovim Lua, web connection, spoke client, CLI hook/login-terminal, harness raw readers and startup probes use selected existing welcome fields and ignore additive keys, so unaffected. Existing old-shape stub welcomes remain unchanged, proving older hubs remain readable; setup-hosts adds a real stub-socket regression refusing paid effects. connection-snapshot exact fixture updated; wire-conformance compile assertion covers mirrored Welcome. No welcome persistence readers or frozen help fixture changes; no usage exports changed. QA briefs and skills describing framing remain valid because negotiated features is unchanged.

### rev-35 · 2026-11-25T01:47:31.321Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2020-source-1
commit: 089ce8c0a445e3276e3e909d0e4dd774e07358ce
scope: full
findings: [{"severity":"high","text":"Fresh paid agents-pool configuration/placement/reload precedes the capability guard; default min_hosts=1 can activate paid work on an unsupported hub.","file":"hub/src/setup/steps/hosts.ts","line":134},{"severity":"medium","text":"Separate probe and fresh-discovery action sockets allow a hub restart to bypass the capability decision; the actual effect connection's welcome is not gated.","file":"hub/src/setup/hub.ts","line":41},{"severity":"medium","text":"New legacy-socket callback lacks a pre-acquisition whole-case owner/separate setup bound joining its setup/body before positive resource/root cleanup.","file":"hub/test/setup-hosts.test.ts","line":47}]
finding_counts: {"high":1,"medium":2,"low":0}

A-23110: H1 fresh paid pool activation before finishPool guard; M2 no enforcement proof on actual paid action connection across discovery/restart; M3 new legacy socket callback lacks encompassing acquisition/body/positive-close owner. Lead7a153824 confirms all three without exclusions. Preserve additive welcome/wire fixtures and empty/unrelated/unreadable negative controls, supported paid terms/readbacks and zero effects/prompts. C1 source path present but runtime unverified; C2 failed. Hold positively released for consolidated correction/fresh committed review; no configured verification at this not-clear head.

Criteria: C2 failed (Fresh min_hosts=1 pool effects precede the check; later action sockets can reach an unsupported restarted hub; new socket regression lacks whole-case ownership.).

### impl-2020 · 2026-11-25T01:51:30.555Z

Review correction consumer extension: new shared/hub-features.ts owns paid feature list, welcome advertisement parser, required-feature checker and HubFeatureUnavailable refusal. shared/socket-client.askHubFrame adds an optional final requiredFeatures parameter (all existing callers retain default []). setupHub.preparePool derives paid admission from expectedTerms; host config.set and nonlocal placeRole require enforcement; reload gains optional paidTerms boolean (default false), selected true only by hosts. Existing setup remotes/discord callers remain ordinary reloads. terminalLogin consumes expectedTerms on its login.add input and checks the same connection welcome before request/native admission; login.signin and unpinned legacy login callers unchanged. Search of reload, configure, placeRole, terminalLogin, expectedTerms, askHubFrame covers setup/CLI plus their T1/T2/T3 test importers; native terminal tests remain configured verification coverage, not a local run. No old wire fields removed. Legacy fixture adds optional dynamic enforcement advertisement; omitted option preserves literal previous welcome. Fresh-pool regression failed 14 !== 0 before earlier guard; corrected focused run 132/132 passed (macOS, local Node 24.21). A failed intermediate run from a missing PAID_TERMS_FEATURES import was corrected and superseded, not counted as proof; initial terminal controls also exposed a missing process.env argument to fixtureEnvironment, corrected before green.

### rev-35 · 2026-11-25T01:59:28.739Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2020-source-2
commit: c76f0a19792563fc3f75bb29ed3afd35f0e1094e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23133: H1/M2/M3 resolved. Pre-offer/fresh-pool guard precedes paid activation; shared checker gates actual request-channel welcome for prepare/config/place/paid-reload/terminal-login. Supported/unsupported and consent-restart controls retain zero-effect/final receipt assertions. Owned residueControl socket cases retain setup/body/resource/root/guard order with positive close receipts. Additive welcome and wire fixtures retained; optional APIs/default ordinary reloads/old-shape fixtures remain compatible. Consumer extension and pinned host-agent closure checked. Reported local132/132/typecheck/lint is not configured proof; C1/C2 runtime pending exact-head controls/importers. Hold positively released; use Coordinator verify window.

### rev-35 · 2026-11-25T02:15:34.684Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2020-evidence-1
commit: c76f0a19792563fc3f75bb29ed3afd35f0e1094e
scope: evidence
findings: [{"severity":"medium","text":"T-2020 replaces setup paragraph9 without its frozen approved-replacement record; both migration contract identities fail on exact current moved paragraph9 assertion. Configured run exits1 in T1; later phases unexecuted.","file":"hub/test/implement-skill.test.ts","line":73}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23160: exact retained assertions/phase outcomes audited. Preserve red receipt and source2 behavior protections. C1 remains unverified. Positive evidence hold release for Coordinator05407263's exact replacement-fixture correction and authorized targeted checks; request narrow committed review before any new verify window.

Criteria: C2 failed (526d08fa/A-23155 fails both frozen setup-paragraph migration assertions in T1; approved replacement consumer migration missing, T2/T3/Web unexecuted.).

### impl-2020 · 2026-11-25T02:16:21.403Z

Frozen consumer correction authorized by Coordinator 05407263 and hold released by Reviewer ba9efe89: implement-merge-replacements.json now records position9 destination setup, previous exact historical source, text exact current paragraph. No assertion/test/doc/runtime protection relaxed. Local macOS Node24.21: implement-skill, setup-flow, setup-hub, nvim-frame-consumers, nvim-frame-refresh 44/44 pass. Failed run526d08fa/A-23155 retained (T0 green, T1 red, T2/T3/Web unexecuted); no configured retry before fresh fixture-only review and verify window.

### rev-41 · 2026-11-25T02:20:11.031Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2020-source3
commit: 646c3d469eb1a2499f657b68dd5fee050a67e9a5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow fixture correction source clear; no findings. Exact historical previous bytes, complete current setup paragraph, destination/setup move mapping and unique positions checked at the pinned head. Existing migration/enforcement assertions are unchanged; Git confirms only the six-line approved-replacement record differs from source2 c76f0a197. A-23133's unchanged behavior review carries forward. Standards/Spec and source scope: A-23165, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23165-t-2020-fixture-correction-source-clear-at-646c3d469.md. Retain failed configured run526d08fa/A-23155 and A-23160; C1/C2 remain unverified until new same-head configured evidence. Local44/44/static results are lead-reported macOS Node24.21 evidence, not a configured pass. No Reviewer tests or edits.

### rev-41 · 2026-11-25T03:38:46.960Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-2020-evidence2
commit: 646c3d469eb1a2499f657b68dd5fee050a67e9a5
scope: evidence
findings: [{"severity":"medium","text":"Right-secret welcome exact deepEqual omits the new enforcedFeatures advertisement; run5d44d06a fails with actual paidTermsAdmission field added. This direct consumer was not migrated.","file":"hub/test/daemon.test.ts","line":345}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Literal A-23229:52594 assertion `Expected values to be strictly deep-equal` adds enforcedFeatures:['paidTermsAdmission']; stack daemon.test.ts:345. Exact case `a wrong secret is refused on the WebSocket and on the Unix socket; the right one is welcomed` has paired fail finish42726. C1 failed; C2 remains unverified. T0/T1/T2 exit0, selected T3 exit1, Web/T4 unexecuted; prior setup/migration/paid-action receipts retained as partial positives, not passing-round proof. Exact head/tree checked. Linux x64 droplet c-8 fra1 Node24.21/Neovim0.12.5, two workers;browser null, nine prerequisite skips, cache unknown; advisories report-only. A-23230: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23230-t-2020-evidence-not-clear-missed-daemon-welcome-expectation.md. Hold positively released for Coordinator0920a3ca's exact consumer migration and complete per-file welcome yes/no census/checks, preserving all auth and previous-wire assertions. Fresh committed source review before next verification window; no Reviewer execution or retry.

Criteria: C1 failed (A-23229 daemon welcome exact-shape assertion fails at345: actual enforcedFeatures includes paidTermsAdmission, expected whole welcome omits it; selected T3 exits1.).

### impl-2020 · 2026-11-25T03:42:04.173Z

Second missed consumer corrected under Coordinator0920a3ca and Reviewer c9130236 hold release: daemon.test.ts expected welcome now includes enforcedFeatures:['paidTermsAdmission']; exact wrong-secret and all other auth assertions unchanged. Comprehensive per-file checked exact-shape yes/no census A-23231: three runtime whole-welcome comparisons (daemon corrected, connection-snapshot already migrated, harness-framing injected old frame intentionally retained), plus aligned compile wire equality. Stub producers, selected-field readers, raw JSON and Neovim tuple inputs assessed. Local macOS Node24.21: T2 harness-framing+connection-snapshot25/25 pass; absolute24.21 daemon T3 full-file19/19 pass under native slot, start load2.56. Prior5d44d06a/A-23229 stays red (T0/T1/T2 green, T3red1, Web unexecuted); no configured resubmission before narrow review/window.

### rev-41 · 2026-11-25T03:44:47.891Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2020-source4
commit: 2a689d59e80d9c501d63fa0d8306058d62dd5b85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow source correction clear; no findings. Exactly one expected-welcome line adds literal enforcedFeatures:['paidTermsAdmission']; all auth/unauthorized/close/subsequent state assertions remain. A-23231 checked yes/no census and pinned searches/spot-checks distinguish migrated daemon/snapshot whole-current-welcome assertions from preserved injected previous-wire framing and selected-field/stub/frozen-input consumers. Source2 behavior A-23133/source3 fixture A-23165 unchanged. Standards/Spec A-23232: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23232-t-2020-daemon-expectation-correction-source-clear-at-2a689d59e.md. Reported corrected-head local T2 25/25, native-slot daemon19/19 and static exits0 are not configured proof. Both failed rounds A-23155/A-23229 and their partial positives remain retained; C1/C2 unverified pending exact-new-head passing configured receipts. No Reviewer execution. Follow Coordinator's verification window.

### rev-41 · 2026-11-25T04:58:56.980Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2020-final
commit: 2a689d59e80d9c501d63fa0d8306058d62dd5b85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Runa388759e/A-23269 finished/passed at unchanged source-reviewed head and source-matching treef09883c5; structured complete exit0 T0/T1/T2/T3/Web receipts independently checked. C1 welcome snapshot/native daemon exact/auth and previous minimal framing controls pass (13/19/12 base cases/files), mirrored wire compile checks pass; frozen setup migration5/5 passes. C2 all18 exact new paid-offer/fresh-pool/effect-channel/restart/empty-unrelated-unavailable controls have paired base+5/5 and all90 load file finishes; setup-hosts52 base cases/file pass. Setup-flow21/setup-hub7/native terminal4 pass. Supported socket controls prove attempted fixture requests, not real paid cloud operations. C1/C2 verified. Both earlier failed rounds A-23155/A-23229 and partials retained. Fallback all T2/259 selected T3 once/Web complete; other T3 batch/integrated evidence,T4 unexecuted. Linux x64 c-8fra1 Node24.21/Neovim0.12.5, two workers, Chrome for Testing156.0.8078.4 Headless Shell1248;12 prerequisite skips/cache unknown/report-only advisories. A-23270: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23270-t-2020-final-review-clear-at-2a689d59e.md. No Reviewer execution or real-browser QA claimed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T06:19:15.578Z

Merged b6dbb527d8891c61cc322f308cebb2dc20792547 onto dev.
