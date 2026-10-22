---
id: T-1034
kind: task
title: A Claude Code auto-update re-exec looks like a harness death and revokes the Coordinator
state: closed
status: done
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
updated: 2026-10-22T06:23:26.035Z
closed: 2026-10-22T01:33:19.739Z
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
  - verified: rev-23 [reviewer] · run rev-20261022-1034-final · 2026-10-22T01:29:55.196Z · commit ada6e304df0cbccef19efe44e506afd19f7f5488
- [x] C2. A fake Claude session whose pid changes while its session id stays the same, followed by a hello within the grace window, keeps its row, role and claim, and no revocation event is posted (test).
  - done: impl-1034 · 2026-10-21T23:07:44.263Z
  - verified: rev-23 [reviewer] · run rev-20261022-1034-final · 2026-10-22T01:29:55.196Z · commit ada6e304df0cbccef19efe44e506afd19f7f5488
- [x] C3. A Coordinator vacancy longer than 10 minutes posts one notice in General with the relaunch commands, and posts nothing more while the role stays vacant (fake-clock test).
  - done: impl-1034 · 2026-10-21T23:18:06.470Z
  - verified: rev-23 [reviewer] · run rev-20261022-1034-final · 2026-10-22T01:29:55.196Z · commit ada6e304df0cbccef19efe44e506afd19f7f5488
- [x] C4. `hub/README.md#coordinator-session-procedure` describes the re-exec handling and the vacancy notice.
  - verified: rev-23 [reviewer] · run rev-20261021-1034-source-3 · 2026-10-21T23:08:42.829Z · commit 6bc0ca45d39a60a5b0aaca989795dcc91e2b1413
  - done: impl-1034 · 2026-10-21T23:18:17.251Z
  - verified: rev-23 [reviewer] · run rev-20261021-1034-source-4 · 2026-10-21T23:18:41.801Z · commit cee548ee1b48a32359b921c1862a213554da0743
  - verified: rev-23 [reviewer] · run rev-20261021-1034-task-evidence · 2026-10-21T23:28:07.240Z · commit cee548ee1b48a32359b921c1862a213554da0743
  - verified: rev-23 [reviewer] · run rev-20261022-1034-source-5 · 2026-10-22T00:40:57.223Z · commit ada6e304df0cbccef19efe44e506afd19f7f5488
  - verified: rev-23 [reviewer] · run rev-20261022-1034-task-evidence-2 · 2026-10-22T00:52:06.187Z · commit ada6e304df0cbccef19efe44e506afd19f7f5488
  - verified: rev-23 [reviewer] · run rev-20261022-1034-final · 2026-10-22T01:29:55.196Z · commit ada6e304df0cbccef19efe44e506afd19f7f5488

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

### rev-23 · 2026-10-21T23:03:06.755Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1034-source-2
commit: 18f090bbaa5ae772ddabbb4feac5d785e6916e01
scope: full
findings: [{"severity":"medium","text":"M4 Spec/C2: After awaiting processStarted, recheck the authoritative native identity as well as object/stop/close/liveness. A hook can set watched/table identity B during the probe for entry A; the continuation currently overwrites B with A and publishes the stale PID. Add a held-probe newer-hook regression with final native/PID/role/claim/no-revocation receipts, and isolate the hook test from discovery's independent identity adoption.","file":"hub/src/adapters/claude-code.ts","line":636}]
finding_counts: {"high":0,"medium":1,"low":0}

M1–M3 primary corrections inspected: late native publication/hook synchronization, bounded in-flight discovery settlement and fresh boundary read, durable restored vacancy deadline/dedup/refill cancellation. One new async identity race remains; no separate Standards finding. A-8779 exact staged-tree local targeted 12+26+6+6 passes/typecheck/lint retained with provenance; not configured/full evidence. A-8780/A-8777 capture limits explicitly noted. Detailed audit A-8781. Fresh source review before verification; Coordinator required full cover separate, QA none.

Criteria: C2 failed (A newer hook-native identity arriving during processStarted can be overwritten by the stale pre-await native entry, transferring ownership to the wrong conversation.).

### rev-23 · 2026-10-21T23:08:42.829Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1034-source-3
commit: 6bc0ca45d39a60a5b0aaca989795dcc91e2b1413
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M1–M4 resolved; full prior audit against 2a3f4858 retained. Per-directory discovery and post-start-probe identity fences preserve newer hook facts and defer current-poll death until fresh reconciliation. Hook-only known-PID identity change, held successful/unavailable probe and stale query snapshot regressions retain final native/PID/role/claim/no-stale-PID/no-revocation assertions. Genuine-death/conflicting-id tests preserved; durable restored vacancy monitoring and filtered/supervised env unchanged. No Standards/Spec findings. C4 procedure established. A-8782 exact staged-tree local 15/15 schedule and 6/6 native contract/typecheck/lint pass; A-8779 unchanged store/env evidence remains historical local. Detailed audit A-8783. C1–C3 final runtime marks await exact-head mode-free and Coordinator-required full pre-merge cover; QA none.

Criteria: C4 verified.

### rev-23 · 2026-10-21T23:16:05.640Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1034-evidence-red
commit: 6bc0ca45d39a60a5b0aaca989795dcc91e2b1413
scope: evidence
findings: [{"severity":"medium","text":"M5 compatibility/lifecycle: A-8786 has seven Error: database is not open failures from late socket disconnect -> #announceCoordinator -> #watchCoordinatorVacancy -> Store.setMeta after core/store close. Prevent terminally closed vacancy work/store writes/timer rearming; add a late-disconnect-after-close regression and preserve existing failing-file assertions.","file":"hub/src/hub/core.ts","line":2449}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8786 /4437665a overall exit1: T1 passes, T2 incomplete with seven identical owned shutdown-path errors across five files; no completed Neovim/Web/T3 evidence. Ordinary2006passes/7fails, plus65 scoped load passes; owned schedule15/store26 and13 new identities' distinct5/5 load summaries pass but do not establish full safety. Host gate reused, lint/duration/resource/ratchet report-only. No fabricated failure of the passing C1–C3 cases; final runtime marks remain pending corrected-head task and Coordinator full. C4 source mark retained; QA none. Detailed trace/receipts A-8787.

### rev-23 · 2026-10-21T23:18:41.801Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1034-source-4
commit: cee548ee1b48a32359b921c1862a213554da0743
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M5 resolved by terminal #closed guard before vacancy state/store/transition/timer work. T1 connected/already-vacant late disconnect after core+store close and T2 connected projectHub.stop retain no-throw/no-publication/zero-timer assertions; seven existing failures' assertions unchanged. Ordinary live vacancy behavior and M1–M4 native/env/recovery paths unchanged. No Standards/Spec findings; C4 procedure verified. A-8788 exact staged-tree local124 targeted passes/typecheck/lint retained, not configured/full proof; A-8786 stays failed historical evidence. Detailed audit A-8789. Fresh exact-head mode-free then Coordinator full cover required before C1–C3 final marks; QA none.

Criteria: C4 verified.

### impl-1034 · 2026-10-21T23:28:06.170Z

Mode-free task verification 488394cb-0c76-4d31-8761-0ea94874b595 passed at cee548ee1b48a32359b921c1862a213554da0743, Linux x64 c-8 lon1 droplet, Node 24.21.0: 2373/2373; T1, T2 (hub+Neovim fallback) and Web exit0. Host typecheck gate c153041 reused, not repeated remotely; lint/duration budgets report-only. Durable A-8790. Prior A-8786 is failed historical evidence from the fixed late-disconnect vacancy write. Current source clear A-8789; Reviewer final criterion settlement and Coordinator's separate full pre-merge cover still pending. Head remains fixed; Implementer will not merge.

### rev-23 · 2026-10-21T23:28:07.240Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1034-task-evidence
commit: cee548ee1b48a32359b921c1862a213554da0743
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-8790/488394cb same source-clear head exits0: T1/fallback all hub+Neovim T2/actual Web;2373 ordinary test passes,361 files,75 scoped load test/file passes. Schedule15/store27 and all seven formerly failing compatibility paths pass unchanged;15 new identities each have five distinct passing load finishes and explicit5/5. Max owned load0.575685653s. Host gate reused, lint/duration/resource/ratchet report-only;6 missing baselines. Task evidence clear; final C1–C3 marks/landing clearance await Coordinator-required same-head full cover including native Claude T3. C4 current; A-8786 failed history retained; QA none. Audit A-8791.

Criteria: C4 verified.

### impl-1034 · 2026-10-22T00:39:02.958Z

Corrected native-full lifecycle regression at pushed ada6e304 (tree9683a903): approved 1s default plus dedicated final-observation timer, verified same-native replacement, explicit test grace for native death consumers, and reconnect-before-missing default regression. C1–C4 remain implemented/done. Audit A-8810; original local red/green and targeted evidence A-8811 (45 distinct tests, local darwin/arm64, not configured/full cover). Prior failed full A-8807 remains historical red. Requesting fresh source review before exact-head mode-free verify; Coordinator full rerun remains required. QA none.

### rev-23 · 2026-10-22T00:40:42.961Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1034-full-red
commit: cee548ee1b48a32359b921c1862a213554da0743
scope: evidence
findings: [{"severity":"medium","text":"M6 compatibility: required full A-8807 fails five genuine-death/exit consumers because unconditional30s grace exceeds unchanged5s frame/poll and15s hold deadlines. Coordinator approved1s default plus independent expiry/fresh native proof and deterministic fixture timing, without weakening final assertions.","file":"hub/src/adapters/claude-code.ts","line":625}]
finding_counts: {"high":0,"medium":1,"low":0}

Historical full97dce9d7 atcee548ee exits1:T1/T2pass,T3fivefail,3443passes/5skips,no completed Neovim/Web cover. Actual errors comprise3frame5000ms timeouts,lead-routing polling5000ms andsession-holds polling15000ms. A-8790 remains task-only green; final C1–C3 unverified. Currentada6e304 correction reviewed separately perCoordinator8911c291. Detailed combined failure/source audit A-8812.

### rev-23 · 2026-10-22T00:40:57.223Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1034-source-5
commit: ada6e304df0cbccef19efe44e506afd19f7f5488
scope: full
findings: [{"severity":"low","text":"L1 evidence wording: A-8810 describes all five A-8807 failures as no-frame5000ms. Actual errors are three such frame waits, lead-routing polling5000ms and session-holds polling15000ms. Correct the retained audit wording without rerunning or changing source."}]
finding_counts: {"high":0,"medium":0,"low":1}

Coordinator8911c291 approval verified. M6 resolved: production1s default from first missing observation, dedicated expiry invoking fresh same-native discovery, verified adoption; timer cleanup on adoption/unwatch/close. Prior identity/stop/relaunch/terminal-close fences retained. Independent default death/reconnect-first/shutdown tests and explicit100ms native fixture grace preserve final assertions and existing wait bounds. No blocking Standards/Spec finding; one low retained-evidence wording correction. C4 updated procedure verified. A-8811 local45 distinct passes on2e24d3ef carried by independently checked runtime-equivalent finaldelta (nvim type assertions/README spelling only); final layers4/4,nvim typecheck/lint0, prior hub source-equivalent typecheck0. Not current configured/full proof; A-8807 failed history preserved. Fresh exact-head mode-free then Coordinator full/native cover required; C1–C3 final marks pending, QA none. Audit A-8812.

Criteria: C4 verified.

### rev-23 · 2026-10-22T00:52:06.187Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1034-task-evidence-2
commit: ada6e304df0cbccef19efe44e506afd19f7f5488
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-8814/523a9f19 matches source-clear ada6e304: T1/all-T2 hub+Neovim/actualWeb exit0,2376ordinary test/361file passes plus90 scoped load passes;18new identities each distinct explicit5/5 including production-default death/reconnect-first/shutdown. Schedule18/store27/project-clock4 pass. A-8813 independently inspected,L1 wording corrected. Host gate reused,lint/duration/resource/ratchet report-only;6missing baselines. Task evidence clear; C1–C3 final marks still await Coordinator full/native T3 rerun—A-8807 failures cannot be established fixed by task selection alone. C4 current;QA none. Audit A-8815.

Criteria: C4 verified.

### rev-23 · 2026-10-22T01:29:55.196Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1034-final
commit: ada6e304df0cbccef19efe44e506afd19f7f5488
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1–C4 verified. Required full A-8838/b225b10d exactly matches reviewed head and passes T1/T2/T3/Web: 3614 test passes, 542 file passes, eight unrelated platform/tool skips, no failure/cancellation. Independently matched all five A-8807 native failure identities to passing full receipts; fake-Claude crash/relaunch and owned updater/re-exec/default-grace/vacancy cases pass. A-8814/A-8815 retains 18 new identities 5/5 under load. Host gate reused remotely; report-only timing/lint/ratchet diagnostics and skip limits retained. QA none; no T4/live provider incident claim. Final audit A-8839; ready for Coordinator enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-22T01:33:19.739Z

Merged c820a77cad7863445a2386dc6ec9d15c5abd292b onto dev.

### coord · 2026-10-22T06:23:26.035Z

Live confirmation after landing: at about 06:23Z 2026-10-22, Claude Code auto-updated 2.1.307 → 2.1.308 and re-exec'd the Coordinator, changing pid 19548 to 68941. The hub kept the role. The coordinator clause came back on the new hello at 06:23:15Z, `session list` shows `coordinator: coord` on pid 68941, and nobody had to run `role set` or `session resume`. This is the first auto-update since the fix went live at restart #41 (dev c6ee6406); the three earlier ones (2026-10-20 21:33Z, 2026-10-21 03:32Z and 22:41Z) all revoked the role.
