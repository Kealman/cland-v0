---
id: T-1616
kind: task
title: The hub keeps its heartbeat fresh and stops when it loses the lock
state: open
status: ready
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1615
topic: topic-1342
branch: t/T-1616-the-hub-keeps-its-heartbeat-fresh-and
created: 2026-11-02T03:34:16.474Z
updated: 2026-11-02T15:44:56.523Z
---

## Summary

While it serves, the hub refreshes its lock's heartbeat on a timer under the break guard, by replacing the file whole. A hub that finds its lock naming another token has lost it, and it stops through its normal shutdown. A failed write is logged and retried, and never stops the hub by itself.

Hot files: `hub/src/hub/daemon.ts`, `hub/src/hub/lock.ts`, `hub/src/hub/agents-topic.ts` (one log kind, if surfaced)

## Acceptance criteria

- [x] C1. While serving, the hub rewrites its lock's heartbeat every interval under the break guard, replacing the file whole, so a reader never finds the lock absent or half written (test).
  - done: impl-1616 · 2026-11-02T15:20:23.216Z
  - verified: rev-35 [reviewer] · run rev-35-1616-final-1 · 2026-11-02T15:44:56.091Z · commit 812250c09f3af62ab18e3f9549d3e37d94f94ea2
- [x] C2. With time driven by the hub's clock, a foreign contender stays refused across several lapse periods while the holder lives (test).
  - done: impl-1616 · 2026-11-02T15:20:23.345Z
  - verified: rev-35 [reviewer] · run rev-35-1616-final-1 · 2026-11-02T15:44:56.091Z · commit 812250c09f3af62ab18e3f9549d3e37d94f94ea2
- [x] C3. When its lock names another token, the hub logs `hub-lock-lost` and stops through its normal shutdown, removing no lock it does not own (test).
  - done: impl-1616 · 2026-11-02T15:20:23.456Z
  - verified: rev-35 [reviewer] · run rev-35-1616-final-1 · 2026-11-02T15:44:56.092Z · commit 812250c09f3af62ab18e3f9549d3e37d94f94ea2
- [x] C4. A failed heartbeat write is logged, retried at the next beat, and never stops the hub by itself (test).
  - done: impl-1616 · 2026-11-02T15:20:23.688Z
  - verified: rev-35 [reviewer] · run rev-35-1616-final-1 · 2026-11-02T15:44:56.092Z · commit 812250c09f3af62ab18e3f9549d3e37d94f94ea2
- [x] C5. A hub stop clears the heartbeat timer and removes the lock as today (test).
  - done: impl-1616 · 2026-11-02T15:20:23.811Z
  - verified: rev-35 [reviewer] · run rev-35-1616-final-1 · 2026-11-02T15:44:56.092Z · commit 812250c09f3af62ab18e3f9549d3e37d94f94ea2
- [x] C6. `daemon.test.ts` and `startup-cleanup.test.ts` pass with no test edited.
  - done: impl-1616 · 2026-11-02T15:20:23.924Z
  - verified: rev-35 [reviewer] · run rev-35-1616-final-1 · 2026-11-02T15:44:56.092Z · commit 812250c09f3af62ab18e3f9549d3e37d94f94ea2

## Notes

Shared files: see Hot files

## Comments

### impl-1616 · 2026-11-02T15:15:41.051Z

Rule 20 inventory before edits: acquireLock/HubLock consumers in daemon, executor/spend, territory, suite/termination lock modules and hub tests; heartbeat will be an optional method on the synchronous handle and enabled only with HubLockOptions. Persisted LockHolder shape unchanged from T-1615. readLock/liveHolder/process identity readers, fixture process tables, startup cleanup and native restart fixtures remain compatible. New daemon scheduler uses hub clock and normal stop; generic async locks unchanged. No wire/frame/client schema changes.

### impl-1616 · 2026-11-02T15:18:59.918Z

Expanded consumer inventory (rg field/function names across hub/src, hub/test, web, nvim, .agents, docs): production daemon.ts is sole new heartbeat caller. Generic acquisition consumers executor/droplet/{droplet,spend}.ts, territory.ts, suite-lock.ts, termination-owner.ts, tracker/offline-migrate.ts retain omitted HubLockOptions; orphans.ts retains read-only ownership behavior. Existing regressions orphan-sweep-lock, territory-lock, executor-lock-liveness, executor-safety, suite-close-component, suite-runner, executor-admission-lock and hub-lock-identity remain unchanged; no frame shape changed. Docs/skill identity guide updated to point to new heartbeat seam. Startup/daemon/native-to-embedded restart fixtures preserve T-1615 identity behavior.

### rev-35 · 2026-11-02T15:21:33.805Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1616-source-1
commit: 812250c09f3af62ab18e3f9549d3e37d94f94ea2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1616 full source review at 812250c09f3af62ab18e3f9549d3e37d94f94ea2, against origin/dev merge-base. Live claimant impl-1616; request dd6382c6-8397-4104-9b14-f420eab9a387.

Standards: no findings. Reviewed complete branch diff plus acquire/release/break-guard helpers, daemon startup and normal shutdown, hub clock wiring, generic synchronous and asynchronous lock consumers, persisted-record readers and consumer inventory. Optional heartbeat is exposed only when HubLockOptions are supplied; generic lock records and async acquisition are unchanged. README, identity guide, indexed new per-test guide, tier manifest and kept skill change record agree with shipped behavior. No command or role permission changes.

Spec: no findings. The heartbeat acquires the existing break guard, confirms the admitted holder, writes a private complete file and renames it over the current lock; the old main record remains published until replacement. Time comes from the hub clock. A positively read different token returns lost ownership; missing/malformed/unreadable ownership throws a retryable failure instead. Scheduler logs failed beats and schedules another; confirmed replacement logs hub-lock-lost and invokes existing normal stop. Stop clears the timer before ownership teardown; release retains its existing ownership check and never removes the successor.

Test source: four T2 embedded-hub cases use disposable sealed fixtures and injected clock. They observe guarded rename and a prior open descriptor, complete persisted timestamps across 210 seconds with foreign refusal, positive replacement followed by normal stopped receipt and successor preservation, controlled write failure plus successful next beat, and malformed ownership followed by recovery. Stop/no-recreation checks retain final filesystem assertions. Existing daemon/startup-cleanup/Telegram restart tests are unchanged. No native process added to new test and no browser.

C1–C6 are run-dependent and remain unverified until post-source-clear exact-head queued results plus required native preservation receipts. Local reports (A-15881 and request) are targeted supplementary evidence, not a queued suite pass. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T15:44:56.092Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1616-final-1
commit: 812250c09f3af62ab18e3f9549d3e37d94f94ea2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1616 final evidence review at 812250c09f3af62ab18e3f9549d3e37d94f94ea2. Scope: evidence. Source remains clear under rev-35-1616-source-1 / A-15885; branch tip unchanged.

Standards: no findings. Spec: no findings. C1–C6 verified.

Actual recorded outcomes independently streamed from A-15888:
- Four named hub-lock-heartbeat cases pass: guarded whole-file replacement and foreign refusal across 210 seconds (C1/C2), replacement-token log plus normal shutdown preserving successor (C3), write failure logging and next-beat successful retry without stopping (C4), and unreadable ownership preserved without false loss. Final stop/removal/no-recreation assertions in these tests establish C5.
- hub-lock-identity 27 pass and startup-cleanup 4 pass, plus executor-spend 20 passing unchanged controls.
- A-15884 supplies independently checked raw named native daemon 18, Telegram/Discord polling restart 9, startup-cleanup 4, all passing with recorded command exit 0 on local macOS arm64 Node v24.21.0, no browser. Preservation ran at committed reviewed head, source tree 28368758527a624c180bcd0cf6a31d8ecf315e94 (matches Git tree). Source review established preservation files unedited. Queued startup plus local daemon fulfill C6; native Telegram supplies required restart preservation.

Run 464e3025-4eaf-45a7-89f1-edb321ae460f / A-15888: exit 0, 4793 pass, zero fail/cancel/skip/todo. T0/T1/fallback all T2/Web completed. T3 deferred to merge batch; T4 unexecuted. No Linux native daemon/Telegram execution claimed, and no full merge-batch coverage claim.

Queued provenance: recorded runner tree 0ae1356a86edd16b7521e7d2e8ec6d3b0c663bd8, uncached droplet c-8 sfo2, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing 156.0.8078.4. Host typecheck used runner tree and was not repeated remotely. Budget/lint/ratchet/skip-reason advisories report-only; skips [] and missing reason count 0. Executor lifetime 1285 s and $0.0893 are billing facts, not suite wall time. No projections counted as executions.

Local heartbeat/identity/typecheck/lint were reported at identical pre-commit source tree; primary heartbeat/identity evidence is the queued exact-head execution above. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
