---
id: T-1547
kind: task
title: Claude Code sessions through the Host
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1296
branch: t/T-1547-claude-code-sessions-through-the-host
created: 2026-10-31T23:47:41.550Z
updated: 2026-11-01T07:40:59.840Z
---

## Summary

Claude Code's `claude --bg` launch, its `claude agents --json` and `claude stop` commands, the read of the worktree's `.claude` settings, its pid and identity checks and its stop go through the session's Host. The schedule of `agents --json` stays as it is; ticket 15 changes it for rows on another host.

Hot files: `hub/src/adapters/claude-code.ts`

## Acceptance criteria

- [x] C1. `claude --bg`, `claude agents --json` and `claude stop` run through the Host's run with the same arguments, environment and working directory as today (test).
  - done: impl-1547 · 2026-11-01T07:28:10.926Z
- [x] C2. The session cwd's `.claude` settings files are read through the Host's readFile (test).
  - done: impl-1547 · 2026-11-01T07:28:11.047Z
- [x] C3. Pid checks, birth identities, resume liveness and stop of a Claude Code row use the Host's identity, alive and stop, and the adapter's own `process.kill` probe is gone.
  - done: impl-1547 · 2026-11-01T07:40:11.097Z
- [x] C4. A test with a recording Host shows every command, liveness check and stop of a Claude Code row reaching that Host (test).
  - done: impl-1547 · 2026-11-01T07:28:11.479Z
- [x] C5. The claude-code-adapter, claude-code-sessions, claude-code-schedule, claude-code-accounts and claude-code-environment test files pass with no test edited.
  - done: impl-1547 · 2026-11-01T07:28:11.589Z

## Comments

### impl-1547 · 2026-11-01T07:11:29.254Z

Consumer inventory before changes: ClaudeCodeAdapter is constructed by daemon.ts plus adapter fixtures in hub/test (claude-code-adapter, sessions, schedule, accounts, environment, permissions, ownership and native-lifecycle); AdapterHost optional hostForProcess/hostForLaunch already ships from Sessions. Legacy processStarted/processIdentity/pidAlive option consumers are standalone schedule fixtures and daemon adapter options. Host.run/alive/identity/stop contracts remain unchanged. LaunchFiles and generated private launch files stay hub-local per A-15078. Poll schedule stays unchanged; T-1555 owns per-Host discovery. New recording-Host tests will cover commands, cwd settings, resume/poll identity and stop.

### impl-1547 · 2026-11-01T07:19:34.398Z

Expanded contract consumers for Host.stop callback addition / absent-process shared fix: production endProcess users are adapters/{claude-code,codex,opencode,launch-files}, host/local, executor/local, fixture-processes, orphans, suite-command, termination-owner; test/fixture fakes are fixture-orphans, system-processes, system-process-probe, memory-producer, suite-timeouts, mod-bridge, session-async-processes and claude-code-sessions-lifecycle. docs/agents/tests/hub-test-measure-memory also describes termination. Search included field/function names across hub/src, hub/test, nvim/test, web/test, qa, skills and agent docs; no nvim/web/QA wire consumers. Callback payload is additive plain data; existing no-argument callbacks remain accepted, including fixture fakes invoking callbacks without payload. Only localHost opts into new payload forwarding; logger default is preserved. Shared contract includes declined-authority no-signal, parent/descendant captured births, absent-process idempotence and reused-birth refusal.

### impl-1547 · 2026-11-01T07:26:36.747Z

Exact ClaudeCodeAdapter/ClaudeCodeOptions import-and-name inventory: production adapters/index.ts and claude-code.ts (plus new local compatibility implementation); fixtures claude-code-sessions, claude-code-accounts, mod-bridge, claude-code-schedule, secrets-environment, claude-code-environment, adapter-native-boundary and human-hold, plus new claude-code-host; docs per-test claude-code-schedule, scenarios-hook-bridge, secrets-environment and new Host guide; duration metadata durations.json. Existing constructor/options remain compatible; new Host selection defaults to Sessions lookup, with the legacy synthetic local seam only for existing injected observers. No previous wire fields changed. The five C5 behavior files remain byte-identical.

### rev-35 · 2026-11-01T07:29:15.187Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1547-source-1
commit: d759653e33d6e65c4f3ef30285cca935186b6d31
scope: full
findings: [{"severity":"medium","text":"resume now awaits Host.alive/identity directly, but those flights are not in #commands, #nativeInspections or #pollFlight, the only work close joins. Hold the signed-out resume's Host.alive, call close: close can resolve while resume is still in flight, then resume continues and can return a running process after ownership was released. Track/join the new Host observations (and fence post-await resume continuation) through close; add a bounded held-resume/close regression, not only the poll-close case.","file":"hub/src/adapters/claude-code.ts","line":929}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: medium claude-code.ts:929 (and ordinary resume identity/alive waits) introduces Host async flights outside close's tracked sets. Hold signed-out resume alive, close can return first, then resume returns running after close. Track/join these observations and fence post-await continuation; add held-resume/close receipt test. Current new close test covers poll only. Other command/settings/identity/stop routing, shared callback capture/authorization and absent/reused policy match source expectations; unchanged C5 runtime evidence pending. No Reviewer execution.

Criteria: C3 failed (New asynchronous Host liveness/identity observations in resume are not owned by close; a held resume can outlive adapter shutdown.).

### rev-36 · 2026-11-01T07:34:34.731Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1547-source-2
commit: 6a0fbf5fbf42edb006a32e1a6c212ea24178ec01
scope: full
findings: [{"severity":"medium","text":"The outer closed-resume continuation discards a successful relaunch row without cleanup. Hold #launch's Host.identity after successful --bg, close, then release: inner #launch commits files/returns running row using unchecked resumed; outer throws, so no catch/stop/rollback owns that new process.","file":"hub/src/adapters/claude-code.ts","line":947}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium — claude-code.ts:947, inner commit around 539: new outer shutdown fence throws after a successful in-flight #launch returns, bypassing that launch's cleanup catch. If close occurs during relaunch's post---bg Host.identity, inner work commits files and returns its new row; outer resume rejects and close completes without stopping/recovering the acquired process. Source-derived, not runtime-reproduced. Add a bounded held post-launch identity/relaunch-close test proving new ownership cleanup or durable retention before close completes. Existing four new tests cover ordinary resumes only. Standards: one medium rule-12 lifecycle finding; Spec: no separate routing issue. C3 failed; runtime criteria otherwise unverified. A-15230 local macOS/Node24 targeted greens do not cover this boundary. Reviewer ran no tests/browser.

Criteria: C3 failed (Shutdown joins ordinary resume but can discard ownership of a successfully launched process during resume(relaunch:true); require cleanup or durable recovery settlement before close completes.).

### rev-36 · 2026-11-01T07:40:59.840Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1547-source-3
commit: 6274c92a616674d0c72a5e93419f497bcd735965
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear; Standards/spec no findings. Remaining relaunch shutdown issue resolved: inner launch catches closure before commit, retains accepted process/files through Host stop and rollback, admits only cleanup-specific stop/query after closure, and close rejects explicitly for retained unconfirmed cleanup. Two bounded held post-launch identity regressions prove successful cleanup/file removal versus incomplete-close/file retention; ordinary resume joins retained. Reviewed full new delta plus prior routing examination and updated docs/provenance. Five C5 files unedited. C1–C5 remain run-dependent/unverified pending same-head post-source verification. A-15235 reports targeted local macOS Node24 recording 9/9, C5 controls 6/20/46/8/19, typecheck/lint exit 0 with report-only advisories; not a full-suite claim. Reviewer ran no tests/browser.
