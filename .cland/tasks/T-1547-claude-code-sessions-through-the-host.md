---
id: T-1547
kind: task
title: Claude Code sessions through the Host
state: open
status: ready
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
updated: 2026-11-01T09:41:40.795Z
---

## Summary

Claude Code's `claude --bg` launch, its `claude agents --json` and `claude stop` commands, the read of the worktree's `.claude` settings, its pid and identity checks and its stop go through the session's Host. The schedule of `agents --json` stays as it is; ticket 15 changes it for rows on another host.

Hot files: `hub/src/adapters/claude-code.ts`

## Acceptance criteria

- [x] C1. `claude --bg`, `claude agents --json` and `claude stop` run through the Host's run with the same arguments, environment and working directory as today (test).
  - verified: rev-36 [reviewer] · run rev-36-1547-final-1 · 2026-11-01T08:15:38.128Z · commit ea01ad9ac9347c89c89dc7e9dcf6434915128eca
  - done: impl-1547 · 2026-11-01T09:20:46.663Z
  - verified: rev-36 [reviewer] · run rev-36-1547-final-2 · 2026-11-01T09:41:40.310Z · commit fb893018e8a9ca6b8559cc91d201e7a98e0a999a
- [x] C2. The session cwd's `.claude` settings files are read through the Host's readFile (test).
  - verified: rev-36 [reviewer] · run rev-36-1547-final-1 · 2026-11-01T08:15:38.128Z · commit ea01ad9ac9347c89c89dc7e9dcf6434915128eca
  - done: impl-1547 · 2026-11-01T09:20:46.799Z
  - verified: rev-36 [reviewer] · run rev-36-1547-final-2 · 2026-11-01T09:41:40.310Z · commit fb893018e8a9ca6b8559cc91d201e7a98e0a999a
- [x] C3. Pid checks, birth identities, resume liveness and stop of a Claude Code row use the Host's identity, alive and stop, and the adapter's own `process.kill` probe is gone.
  - verified: rev-36 [reviewer] · run rev-36-1547-final-1 · 2026-11-01T08:15:38.128Z · commit ea01ad9ac9347c89c89dc7e9dcf6434915128eca
  - done: impl-1547 · 2026-11-01T09:20:47.749Z
  - verified: rev-36 [reviewer] · run rev-36-1547-final-2 · 2026-11-01T09:41:40.310Z · commit fb893018e8a9ca6b8559cc91d201e7a98e0a999a
- [x] C4. A test with a recording Host shows every command, liveness check and stop of a Claude Code row reaching that Host (test).
  - verified: rev-36 [reviewer] · run rev-36-1547-final-1 · 2026-11-01T08:15:38.128Z · commit ea01ad9ac9347c89c89dc7e9dcf6434915128eca
  - done: impl-1547 · 2026-11-01T09:20:48.279Z
  - verified: rev-36 [reviewer] · run rev-36-1547-final-2 · 2026-11-01T09:41:40.310Z · commit fb893018e8a9ca6b8559cc91d201e7a98e0a999a
- [x] C5. The claude-code-adapter, claude-code-sessions, claude-code-schedule, claude-code-accounts and claude-code-environment test files pass with no test edited.
  - verified: rev-36 [reviewer] · run rev-36-1547-final-1 · 2026-11-01T08:15:38.128Z · commit ea01ad9ac9347c89c89dc7e9dcf6434915128eca
  - done: impl-1547 · 2026-11-01T09:20:49.276Z
  - verified: rev-36 [reviewer] · run rev-36-1547-final-2 · 2026-11-01T09:41:40.310Z · commit fb893018e8a9ca6b8559cc91d201e7a98e0a999a

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

### rev-36 · 2026-11-01T07:54:05.584Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1547-evidence-1
commit: 6274c92a616674d0c72a5e93419f497bcd735965
scope: evidence
findings: [{"severity":"medium","text":"Composition fixture still mocks execFile, but production Host.run now uses spawn; fixture-claude escapes the injected edge and fails ENOENT. Migrate this contract consumer while retaining both hubs' environment wiring and fast/slow scheduling assertions.","file":"hub/test/project-hub.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear: A-15248 actual failure `AssertionError [ERR_ASSERTION]: fixture-claude --bg: spawn fixture-claude ENOENT` (line 22289). Medium project-hub.test.ts:14 still intercepts execFile while production Host.run invokes spawn; migrate the fixture to the Host command seam, retaining original two-project environment wiring and independent poll scheduling assertions, and add it to consumer inventory. C1 failed; other criteria unverified. Run28f980d3 at reviewed6274c92a: uncached Linux x64 droplet Node24.21.0, T0/T1 exit0, T2 exit1, later phases/Web unexecuted and browser receipt null. Advisory checks report-only. Failed run is not clear; fresh source review before new verification. Reviewer ran no tests/browser.

Criteria: C1 failed (Same-head task verification fails the unchanged project-hub command/environment composition consumer: fixture-claude --bg: spawn fixture-claude ENOENT; injection boundary was not migrated to Host.run.).

### impl-1547 · 2026-11-01T07:55:41.876Z

Verification consumer migration after A-15248: project-hub.test.ts retained an execFile mock and failed deterministically (`fixture-claude --bg: spawn fixture-claude ENOENT`) on Linux droplet and local macOS. Migrated its command edge to Host.run, preserving default production adapter construction, both injected environments/clocks and every original independent schedule assertion. Threaded optional readonly Host[] injection from projectHub -> serveProject -> projectSessions -> existing Sessions.hosts, as approved in A-15078. This is programmatic composition only; no wire/config/CLI shape changes. Existing callers omitting hosts retain the existing local default. Direct production consumers are hub/server.ts and hub/daemon.ts; test harness exports projectHub/nativeProjectHub/reuses callers. createHub/server keeps its existing default path, unaffected. Search covers function/type names across source, all test tiers, QA, skills and docs; all other call sites omit the additive option. project-hub.test.ts now passes with original assertions; five C5 files remain unedited.

### rev-36 · 2026-11-01T07:58:00.886Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1547-source-4
commit: ea01ad9ac9347c89c89dc7e9dcf6434915128eca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at ea01ad9ac9347c89c89dc7e9dcf6434915128eca. Standards/spec no findings. Reviewed complete new diff and retained prior routing/lifecycle review: project-hub migrates obsolete execFile mock to Host.run while preserving production default Claude construction, actual environments, both clocks/directories, every original schedule and frame-stop assertion. Optional readonly hosts passthrough preserves omitted defaults; consumer audit/docs/provenance updated. Adapter/termination source and five C5 controls unchanged. C1–C5 await fresh same-head post-source run. A-15250 targeted macOS Node24 project-hub1/project-probes2/Host9 plus typecheck/lint green is preliminary, not full-suite evidence; A-15248 remains failed. Reviewer ran no tests/browser.

### rev-36 · 2026-11-01T08:15:38.128Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1547-final-1
commit: ea01ad9ac9347c89c89dc7e9dcf6434915128eca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final task evidence clear at unchanged ea01ad9ac9347c89c89dc7e9dcf6434915128eca. Standards/spec no findings; all C1–C5 verified. A-15252 uncached Linux x64 droplet Node24.21.0 T0/T1/fallback T2/Web exit0,4565 pass; actual named recording9/project-hub1/schedule46/sessions10 top-level/environment11 top-level pass receipts checked (nested cases separate). Browser isolated chromium_headless_shell-1248 Chrome for Testing156.0.8078.4. T3/T4 absent, no all-tier claim. A-15253 exact-head post-source local macOS arm64 Node24.21.0 native exit0 with named adapter6/accounts8/Host-contract7 passes supplies omitted C5/shared-stop evidence; all five C5 files unedited. Prior failed A-15248 stays failed. Advisory budgets/lint/ratchet/skip checks report mode. Reviewer ran no tests/browser. Coordinator's separate full pre-merge suite remains its next gate, not claimed complete.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1547 · 2026-11-01T09:07:10.867Z

Shared Host.alive semantics inventory for the Lead-death fix: production naked-PID calls are ClaudeCodeAdapter.#pidAlive; proof-bearing rows flow from Sessions deaf startup/timer checks and both resume fallback branches. The standalone Claude compatibility Host already uses a raw injected/shared PID probe when no proof exists. Shared native Host contract covers full identity mismatch, legacy start, absent PID and stop; added explicit bare-PID live/absent assertions and a positive-controlled no-subprocess T2 case. Other fake Hosts supply their own synthetic facts. No wire reply/schema changed, no signal authority added. Unchanged lead-routing-process fails at ea01ad9ac and passes disposable dev d4c19797; replacing unnecessary local bare-PID identity subprocess work with shared signal-0 existence probe makes it pass unchanged.

### rev-36 · 2026-11-01T09:12:55.852Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1547-source-5
commit: 706bc39214f7fc58341de5594a5ec96f3e48d62d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear; Standards/spec no findings. Inspected bare-PID fix, authorized dev merge and T3 guard classification. localHost.alive uses shared signal0 pidAlive only when both recorded proof fields are absent; identity-bearing liveness and stop authority unchanged. Positive-controlled no-subprocess guard, native live/reaped assertions, docs/inventory and original unedited Lead-routing/C5 files inspected. Docs conflicts preserve Claude/artifact sections; dev fileType contract retained. A-15266 targeted macOS arm64 Node24.21.0 receipts are preliminary, not new-head verification; previous all290738e6 remains failed. C1–C5 pending new-head post-source run. Current rule6 confirmed: merge-batch T1–T3 supplies pre-merge suite, no routine separate all. Reviewer ran no tests/browser.

### rev-36 · 2026-11-01T09:21:19.784Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1547-source-6
commit: fb893018e8a9ca6b8559cc91d201e7a98e0a999a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear. Standards/spec no findings. Complete delta from source-clear706bc392 is one init-config.test.ts:177 expectation: T1 -> T1/T2/T3, matching shipped config and current rule6; all other assertions and Host/Lead/lifecycle implementation unchanged. A-15280 records exact reviewed shared-fix cherry-pick provenance and preliminary current-head macOS arm64 Node24 init-config17/17/typecheck exit0. No new full run claimed; A-15274 remains failed, later phases unexecuted. C1–C5 pending fresh same-head verification. Reviewer ran no tests/browser.

### rev-36 · 2026-11-01T09:41:40.310Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1547-final-2
commit: fb893018e8a9ca6b8559cc91d201e7a98e0a999a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final task evidence clear at unchanged fb893018e8a9ca6b8559cc91d201e7a98e0a999a; Standards/spec no findings; C1–C5 verified. A-15284 uncached Linux x64 droplet Node24.21.0 T0/T1/fallback T2/changed T3 guard/Web exit0,4570 pass. Actual records: init17, recording9, schedule46, sessions10/environment11 top-level, project-hub1, bare-PID guard1 all pass. Isolated chromium_headless_shell-1248 Chrome for Testing156.0.8078.4; remaining T3/T4 unexecuted, advisory checks report mode. A-15286 exact-head Darwin27 arm64 Node24.21.0 native exit0 and named adapter6/accounts8/Host-contract8/Lead-routing1 receipts close omitted C5/shared-stop/original regression proof. All five C5 files and Lead test unedited; prior failed runs stay failed. Reviewer ran no tests/browser. Current rule6 pre-merge T1–T3 batch remains next; no batch completion or full-T3 task claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
