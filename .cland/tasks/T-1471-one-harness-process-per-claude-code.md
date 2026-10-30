---
id: T-1471
kind: task
title: One harness process per Claude Code launch
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: topic-1223
branch: t/T-1471-one-harness-process-per-claude-code
created: 2026-10-30T07:50:17.744Z
updated: 2026-10-30T17:09:23.493Z
---

## Summary

A relaunch that follows a TERM leaves the daemon's job alive or respawns it. Both processes share the same settings and CLAND_SESSION_ID, so two "coord" processes join one session: the last bridge wins, and the hooks and poll mix both. This happened at 06:23 and again at 07:34; two twins are live now. Stop the old job explicitly, and bind spokes, hooks and bridges to a fresh per-launch id in a new settings file, so the old job's processes are refused.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. `session resume --relaunch` on a Claude Code row runs `claude stop <previous harnessId>` even when the recorded pid is gone or the row is `exited`.
  - done: impl-1471 · 2026-10-30T15:43:51.179Z
- [x] C2. Each launch writes its own settings and MCP files with a new launch id; a spoke, hook or bridge carrying an earlier launch id is refused with "belongs to an earlier launch".
  - done: impl-1471 · 2026-10-30T15:43:51.294Z
- [x] C3. A second spoke whose hooks carry a different harness session id than the row logs `duplicate-harness` and posts one Agents notice naming both job ids and pids.
  - done: impl-1471 · 2026-10-30T15:43:51.407Z

## Comments

### impl-1471 · 2026-10-30T07:57:21.764Z

Consumer inventory before changing launch identity: Hello/isHello (protocol.ts), HubCore.hello and its connected-spoke join path, spoke.ts env-to-hello, ClaudeCodeAdapter settings/MCP/native resume and stop, Sessions.signal/bridge, mod register.ts configuration fallback. Existing --launch field remains; new optional Hello.launchId and CLAND_LAUNCH_ID distinguish generations. Legacy rows without a persisted generation retain session-id attribution. Native job mismatch detection must distinguish /clear from two positively listed jobs. Tests/fixtures searched across hub/test, nvim/test, web/test, qa, docs and skills by CLAND_SESSION_ID, launchToken, session.signal, session.bridge, harnessId and sessionRunDirectory; hook arguments/settings assertions and native session fixtures require coverage.

### rev-26 · 2026-10-30T08:12:11.899Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1471-source-1
commit: 37ddc96af4135b42c76d550208cdc8617980f1b3
scope: full
findings: [{"severity":"medium","text":"M1: SESSION_USAGE frozen fixture not migrated; retain unchanged compatibility/help red-green and update only owning fixture bytes.","file":"hub/src/cli/usage.ts","line":29},{"severity":"high","text":"M2: omitted launch bypasses hook/bridge generation guard; hello checks before credential normalization. Require current generation on resolved generated identity, retaining omission only on legacy rows.","file":"hub/src/adapters/sessions.ts","line":1594},{"severity":"high","text":"M3: gone/exited PID lets failed/nonzero native stop proceed to relaunch. Fence --bg until positive captured-job stop/absence, retaining ownership on failed/unknown.","file":"hub/src/adapters/claude-code.ts","line":776},{"severity":"medium","text":"M4: unavailable duplicate inspection is null and authorizes foreign identity; deferred checks are untracked/incompletely fenced. Distinguish positive same-job/duplicate/unknown and own/join/revalidate against newer hook and lifecycle state.","file":"hub/src/adapters/sessions.ts","line":1625},{"severity":"high","text":"M5: rotation does not fence already admitted spokes/bridge; private unwatch retains bridge and inject keys only stable sessionId. Revoke or per-use fence stale generations and prove old disconnected/traffic/tool authority safety.","file":"hub/src/adapters/claude-code.ts","line":550}]
finding_counts: {"high":3,"medium":2,"low":0}

A-14176 consolidated full audit: Standards M1/M4; Spec M2/M3/M5. Preserve native stop/order/one-job, old-wire and exact notice assertions; add omitted generation, failed/held stop/query and admitted-generation rotation controls. Local A-14168 remains summarized macOS evidence only; no configured suite. Fix together then fresh pushed-head source review before verify. No Reviewer execution.

Criteria: C1 failed (Native stop failure after PID disappearance can still release supervision and launch replacement.), C2 failed (Missing-generation and credential-normalization paths bypass refusal; existing old-generation connections remain admitted after rotation.), C3 failed (Unknown/delayed duplicate inspections can adopt foreign identity or publish stale facts without tracked lifecycle ownership.).

### impl-1471 · 2026-10-30T08:21:08.693Z

Source review M1–M5 remediation expands the consumer inventory: owning frozen SESSION_USAGE row in hub/test/fixtures/cli-usage/commands.json (unchanged cli-help/cli-usage-compatibility guards retained); resolved HubCore hello identity, internal Connection generation/isCurrent/sendTo and synchronous rotation; AdapterHost launchGeneration callback and native bridge per-use ownership; typed NativeJobInspection duplicate/same-job/unavailable outcomes consumed only by Sessions and explicit test fixtures. Sessions owns deferred inspections, captures generation/job/PID/row status/native id/hook revision, invalidates on lifecycle reservation, and joins them during close before Store disposal. Hook request documentation now describes generation rather than stable id. No persisted process-row/wire shape removed; launchId remains additive and truly legacy rows retain omitted-field behavior. Matching docs and skill guidance updated.

### rev-26 · 2026-10-30T08:25:32.589Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1471-source-2
commit: 3907c78ec00986c0a603936c0d71349eb9672a8c
scope: full
findings: [{"severity":"high","text":"M3 freshness remains: refresh=true joins a pre-existing agentsFlight at line358, so a pre-stop empty snapshot can settle failed-stop absence and permit duplicate replacement. Require a query invoked after failed-stop settlement and retain held stale-snapshot negative control.","file":"hub/src/adapters/claude-code.ts","line":804}]
finding_counts: {"high":1,"medium":0,"low":0}

A-14192 consolidated replacement audit: M1/M2/M4/M5 resolved at source; one high M3 freshness issue remains. C1 failed; C2/C3 source present with runtime pending. Preserve new generation/rotation/inspection and native stop assertions, add post-stop query control then fresh exact pushed-head review before configured verification. Local A-14186/A-14188 limits retained; no Reviewer execution.

Criteria: C1 failed (Pre-stop shared query can authorize replacement after failed stop without fresh captured-job absence.).

### rev-26 · 2026-10-30T08:29:20.444Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1471-source-3
commit: b889d71aa9b38a643b22bfec9cc9e5962b7bc83b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14196 source3 clear: remaining M3 resolved by draining pre-stop flight, rechecking authority and admitting only a post-stop query for absence. Held-empty-snapshot test preserves refusal/no-bg and two-query assertions; prior M1/M2/M4/M5 retained. C1-C3 final runtime verification pending exact-head configured evidence. Local A-14195 and prior-head receipts remain separately labeled. No Reviewer execution; future T-1469 merge must use transportClock also for new #hookSignal frame.at fallback, then delta review.

### rev-26 · 2026-10-30T08:57:32.003Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1471-evidence-1
commit: b889d71aa9b38a643b22bfec9cc9e5962b7bc83b
scope: evidence
findings: [{"severity":"medium","text":"Configured b103e729/A-14211 exits124 with18 ordinary failures across schedule, roles-session-refresh and session-usage, plus stalled schedule file. T2 incomplete; nativeT3/selectedT4/Web unexecuted. Reproduce owning consumer contracts without weakening assertions, then fresh source review before corrected-head verification.","file":"hub/test/claude-code-schedule.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14212 original evidence audit not clear:3555 ordinarypass/18fail +115 separate loadpass =3688 completed; total3670 passing includes load. Historical source3 clear remains source-only. No runtime criteria verified. Actual test failures/stall distinct from report-only warnings; unexecuted projections not measurements. Preserve all exact native/generation/usage assertions. Honor Coordinator workload/restart hold; no same-head retry or full-all requested. Any correction needs exact-head source review first.

Criteria: C1 failed (Configured relaunch/lifecycle consumers fail and native Linux T3 is unexecuted; runtime evidence is incomplete.).

### impl-1471 · 2026-10-30T09:26:26.073Z

Expanded production-path audit after failed b103e729 (source-only results unless noted): (1) launch, fresh resume and pool restart: Sessions #launchNew/#spawnLaunch -> Claude spawn -> sole #launch/#sessionFlags; always new generation in persisted owner/current metadata, immutable settings/MCP, hook --launch and mod settings. (2) explicit relaunch and account-selected relaunch: Claude resume(relaunch) -> same #launch/#sessionFlags after positive stop/absence; account overlay cannot replace explicit launch files. (3) startup/plain resume: no process creation/settings rewrite; preserves current generation or absent metadata for legacy jobs; persisted legacy restart/adoption control passes. (4) native/auto-update re-exec: hub schedules none; generated CLI/settings disable auto-update, and native replacement retains immutable launch files/MCP generation. Found/fixed mod partial-env bug: settings generation now wins before legacy env session-id; mod control red/green proves bridge/hook argv. (5) session retry: #retry/#inject -> current admitted bridge, no process/rotation. (6) account refresh/restart: account usage poller creates isolated -p /usage subprocess, removes all CLAND variables, never joins as a session; account-pinned session restart is path2. Additional consumer migration: native accounts authentication hook reads generation from recorded settings; T3 header/native assertions retained. New optional adapter relaunchStopsProcess preserves generic/fake outer-stop counts and held authorization boundaries rather than branching by harness name. The sole freshness mechanism will be T-1474 #hookRevision/#activity + DirectorySchedule observationRevision/observedLaunches after Coordinator-authorized dev merge; no next review/verify on temporary parallel counter.

### impl-1471 · 2026-10-30T15:43:21.796Z

Merged authorized origin/dev after T-1474 landing in d12ee878b; corrected/pushed integrated head4c3ece4dbc54ca8ee30dc9ed7314b1934e6950f3. Sole native freshness owner is T-1474 #hookRevision/#activity with DirectorySchedule.observationRevision/observedLaunches; pending identity is a marker on that same activity record, and no #hookRevisions map remains. Ordinary hooks preserve independent verified PID acquisition. Sessions #frameRevisions only sequences its deferred frame/lifecycle admissions. Added red-first stateless positive-inspection release and adapter-owned unconfirmed-stop row/role/claim retention controls. ResumeOptions.stopped is an optional local callback, not wire data; only relaunchStopsProcess adapters use it, and it persists positive stop then returns the latest row before replacement. Generic/fake adapters retain dev stop count and held-stop boundary; Codex/OpenCode unaffected. Production path audit A-14222 retained: launch/fresh/pool/account relaunch all use sole #launch/#sessionFlags; plain/startup resume preserves saved generation or legacy absence; native re-exec uses retained files and corrected settings-before-legacy-env mod fallback; retry spawns nothing; account usage probes strip CLAND fields. Native account auth-hook consumer and newly landed schedule consumers migrated to their recorded generation. All existing native PID/job/role/claim/message assertions retained. Next review goes directly to rev-26, then ready-for-verify-all to Coordinator; no duplicate self-submitted run.

### rev-26 · 2026-10-30T15:53:08.067Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1471-source-4
commit: 4c3ece4dbc54ca8ee30dc9ed7314b1934e6950f3
scope: delta
findings: [{"severity":"medium","text":"M1: Three new component regressions (also stateless-hook case and claude-code-sessions.test.ts uncertain-stop case) acquire hubs/UI through raw fixture/open; second legacy hub/bridge likewise unowned before acquisition. The copied receipt race does not join timed-out work. Use shared pre-registered setup/observation/disposal owners with separate setup bound and removal barrier; preserve semantic assertions and cover omitted/aborted setup (rules 9/12).","file":"hub/test/claude-code-schedule.test.ts","line":1009}]
finding_counts: {"high":0,"medium":1,"low":0}

Integrated source review at 4c3ece4db: Standards M1 remains in three new tests; Spec production integration has no additional blocker identified. Single native freshness owner retained, positive stop receipt preserves unknown-stop supervision, generation/revocation and post-stop query fixes retained. C1–C3 runtime pending; prior A-14211 stays failed. Local/native pre-commit limits retained. See source4 audit artifact. Exact corrected-head source review precedes Coordinator verify all; no duplicate task submission.

### impl-1471 · 2026-10-30T16:00:26.323Z

Source4 M1 correction in progress: shared claudeComponentOwner composes pacingOwner+dispatcherUi before acquisition, bounds hub/welcome/subscription setup, tracks late clients/spokes and frame/native-poll observations, and guards root removal until drainage. Omitted/aborted readiness controls preserve actual stopped-hub + retained-root + admitted-observation completion receipts. Production source unchanged from 4c3ece4db. dispatcherUi gains only an optional process-observer argument; default and all existing 3-argument consumers remain unchanged (sessionDispatcherUi wrapper, CLI/role/tracker/release/merge/heartbeat/permissions component callers); invented-PID Claude fixtures explicitly disable native PID discovery. New helper clients: schedule legacy/stateless cases and sessions uncertain-stop case. No wire/client contract change.

### rev-26 · 2026-10-30T16:06:28.263Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1471-source-5
commit: 283e84a748f8627f4cbba236d87f354f741d2a25
scope: delta
findings: [{"severity":"medium","text":"Remaining M1: held writer is admitted before release/join cleanup is installed; welcome assertion outside try/finally can strand released.promise while owner.dispose joins it. Pre-register release+join before writer admission, handle already-aborted signal, and immediately catch/own remove() before waiting for guard entry. Preserve root-retention/drain assertions (rules9/12).","file":"hub/test/claude-component-fixture.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Source5 ownership migration reviewed: production unchanged; three semantic cases now use shared pre-owned acquisition/observation/removal composition. New helper controls retain a failure-path cleanup gap (remaining M1), detailed in source5 audit. Metadata/tier/consumer compatibility correct; no additional Spec blocker identified. Local helper2/sessions20/schedule46 qualify only their reported Darwin occasion. C1–C3 runtime pending; prior failed configured receipt remains failed. Corrected-head source review precedes Coordinator verify all.

### rev-26 · 2026-10-30T16:12:38.051Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1471-source-6
commit: 3bc380c2e008f1fc4e13b3e119ff3b7410a2e15d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source6 delta clear: remaining M1 resolved by shared cleanup emergency release/join registered before owner/writer, already-aborted handling, immediately caught setup/removal promises with original assertions retained. Only control test/guide changed; production and all prior semantic controls unchanged. No Reviewer execution; A-14556 intermediate/local and final request receipts retain exact-head limits. C1–C3 runtime-unverified; b103e729/A-14211 remains failed. Lead may report ready for Coordinator verify all at frozen3bc380c2e; no duplicate task submission.
