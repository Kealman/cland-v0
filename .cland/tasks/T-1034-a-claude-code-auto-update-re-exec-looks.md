---
id: T-1034
kind: task
title: A Claude Code auto-update re-exec looks like a harness death and revokes the Coordinator
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-824
branch: t/T-1034-a-claude-code-auto-update-re-exec-looks
created: 2026-10-21T05:59:56.127Z
updated: 2026-10-21T23:01:33.368Z
---

## Summary

Claude Code updated itself mid-session twice (2.1.304→2.1.305 at 21:33Z on 2026-10-20, 2.1.305→2.1.306 at 03:32Z on 2026-10-21) and re-executed under a new pid. The hub took the old pid's exit as the harness's death and revoked coord's Coordinator role. The crew ran without a Coordinator for 5 h 20 m and then 2 h 25 m, because nothing relaunches after "harness exited".

## What to build

1. **Launch env.** Hub-launched Claude Code sessions run with `DISABLE_AUTOUPDATER=1` in their launch environment, so a hub-owned harness never updates under a live session. The human updates Claude Code between sessions.
2. **Re-exec, not death.** When the same harness session (same harness session id and transcript) says hello again under a new pid shortly after its old pid ended, the hub records the new pid and keeps the row, role and claims. It does not post "harness exited" and revoke. T-372 is the adjacent case of a relaunched row that stays exited.
3. **Coordinator vacancy alarm.** When the Coordinator role is vacant for more than 10 minutes, the hub posts one decision-kind notice in General naming the last holder and the relaunch commands (`cland session resume coord --relaunch`, `cland role set coord coordinator`).

Evidence: the hub's role revocation events for coord at 2026-10-20T21:33Z and 2026-10-21T03:32:28Z. cland-impl's diagnosis on 2026-10-21: the transcript ends cleanly with last-prompt/cost-state after the version change.

## Acceptance criteria

- [x] C1. A Claude Code session launched by the hub has `DISABLE_AUTOUPDATER=1` in its environment, after the credential filter (test with the fake harness).
  - done: impl-1034 · 2026-10-21T22:52:02.812Z
- [x] C2. A fake Claude session whose pid changes while its session id stays the same, followed by a hello within the grace window, keeps its row, role and claim, and no revocation event is posted (test).
  - done: impl-1034 · 2026-10-21T23:01:25.499Z
- [x] C3. A Coordinator vacancy longer than 10 minutes posts one notice in General with the relaunch commands, and posts nothing more while the role stays vacant (fake-clock test).
  - done: impl-1034 · 2026-10-21T23:01:25.582Z
- [x] C4. `hub/README.md#coordinator-session-procedure` describes the re-exec handling and the vacancy notice.
  - done: impl-1034 · 2026-10-21T22:52:02.966Z

## Comments

### coord · 2026-10-21T22:43:48.685Z

Third occurrence, 2026-10-21 22:41Z. coord's Claude Code harness re-exec'd: the instruction files were re-read at session start, under the same job 67b69498. The hub logged this sequence:
- 22:41:12.0Z coordinator-vacant, then bridge-closed.
- 22:41:15.1Z bridge-connected, and 22:41:15.2Z coordinator-filled.
- 22:41:16.5Z role-cleared and role-revoked, "its harness exited", then coordinator-vacant.
cland-impl restored the role at 22:41:56Z. The gap was about 40 s, so nothing was lost: no merges were pending, and the suites and QA kept running. The process watcher clears the role about a second after the reconnect, because it still tracks the old pid. T-1034's fix (treat a re-exec as a re-exec, keyed on the bridge or session identity rather than the pid) would have prevented it.

### impl-1034 · 2026-10-21T22:48:59.702Z

Test-first evidence (macOS/local, working tree): C1 scripted production Claude boundary failed with '0' !== '1'; C2 frame/MCP regression failed with actual 'exited' versus expected 'running' after the old PID vanished; C3 fake-clock protocol/core test failed 0 !== 1 after ten minutes. All three now pass targeted. Cause: Claude watcher finalized old-PID death before native-session discovery and only recorded a discovered PID when the old PID was null. Implementing bounded grace and verified same-native-session adoption; no role clause additions.

### rev-23 · 2026-10-21T22:55:21.844Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1034-source
commit: 86b6df7cd1ca20ac769943016494c6b8f3ec2935
scope: full
findings: [{"severity":"medium","text":"M1 Spec/C2: Late-discovered or hook-learned native session id is persisted only in the process table, not propagated into the watched object; poll PID adoption also omits native id. With distinct native/cland ids after an initially unknown PID, later same-native-session replacement fails the equality guard and exits after grace. Synchronize/persist current native identity and cover delayed discovery plus hook learning with distinct ids and final role/claim/PID/no-revocation receipts.","file":"hub/src/adapters/claude-code.ts","line":624},{"severity":"medium","text":"M2 Spec/C2: A directory with an external launch/resume agentsFlight is skipped, but the subsequent expired-grace loop still emits exited without consuming that native query. A replacement reconnecting inside grace can lose ownership while its discovery result is pending. Observe/process bounded relevant discovery before final exit; add a held-query crossing-boundary regression retaining stop/relaunch/close guards.","file":"hub/src/adapters/claude-code.ts","line":617},{"severity":"medium","text":"M3 Spec/C3: On store/core reopen with an absent remembered Coordinator, both coordinator() and #coordinator are null, so early return prevents arming any vacancy timer. The safeguard stays silent indefinitely unless a Coordinator first reconnects and leaves again. Recover vacancy monitoring for a known previous holder; prove store reopen, one notice and refill cancellation with FakeClock.","file":"hub/src/hub/core.ts","line":2415}]
finding_counts: {"high":0,"medium":3,"low":0}

Full ten-file Standards/Spec audit against 2a3f4858. No independent Standards finding; C1 filtered/supervised env and C4 procedure text inspected. Three medium Spec findings block source clearance, detailed in A-8769. Original A-8768 is local targeted summary, not queued/full proof; retain original stdout/commands/exits/head-tree/platform/timings without transcription reruns. No Reviewer runtime. Fresh source review at corrected head before mode-free verify; Coordinator full pre-merge cover separately required. QA none.

Criteria: C2 failed (Watcher misses late-learned distinct native identity and can finalize exit while relevant discovery is still in flight.), C3 failed (Reopened core with an absent remembered Coordinator never arms the ten-minute vacancy notice.).
