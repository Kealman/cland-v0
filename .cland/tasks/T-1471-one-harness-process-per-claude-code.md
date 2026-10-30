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
updated: 2026-10-30T08:23:12.356Z
---

## Summary

A relaunch that follows a TERM leaves the daemon's job alive or respawns it. Both processes share the same settings and CLAND_SESSION_ID, so two "coord" processes join one session: the last bridge wins, and the hooks and poll mix both. This happened at 06:23 and again at 07:34; two twins are live now. Stop the old job explicitly, and bind spokes, hooks and bridges to a fresh per-launch id in a new settings file, so the old job's processes are refused.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. `session resume --relaunch` on a Claude Code row runs `claude stop <previous harnessId>` even when the recorded pid is gone or the row is `exited`.
  - done: impl-1471 · 2026-10-30T08:22:45.708Z
- [x] C2. Each launch writes its own settings and MCP files with a new launch id; a spoke, hook or bridge carrying an earlier launch id is refused with "belongs to an earlier launch".
  - done: impl-1471 · 2026-10-30T08:22:45.807Z
- [x] C3. A second spoke whose hooks carry a different harness session id than the row logs `duplicate-harness` and posts one Agents notice naming both job ids and pids.
  - done: impl-1471 · 2026-10-30T08:22:45.910Z

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
