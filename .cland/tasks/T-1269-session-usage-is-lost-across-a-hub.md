---
id: T-1269
kind: task
title: "Session usage is lost across a hub restart: archived OpenCode rows show usage null in cland's usage view"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: topic-1016
branch: t/T-1269-session-usage-is-lost-across-a-hub
created: 2026-10-25T01:16:15.898Z
updated: 2026-10-25T02:33:41.340Z
closed: 2026-10-25T02:33:41.340Z
---

## Summary

E-1216's QA audit (qa-dod-2026-10-25-677, A-11568) failed DoD C3: all eight earlier OpenCode sessions show `usage: null` in `cland session list --archived --json`. That covers oc-1020, oc-1063, oc-1105, oc-1209, oc-522 and oc-1092 on the free model, plus impl-619 and impl-619b, the last on the paid opencode-go model. Sessions started under the current hub process keep their usage after stop: oc-rev-1 has 4.05 M tokens and $0.0509, oc-qa-1 9.33 M tokens and $0.0837. The earlier sessions ran under hubs that have since restarted (#54, #55). So per-session usage looks memory-only and does not survive a hub restart, and archived rows keep nothing. The token counts still exist in the harness's own store (cland's OpenCode DB holds per-message tokens and cost).

## What to build

Usage totals per session (tokens by kind, cost, model) are durable. They are recorded with the session row as they change, survive a hub restart, stop and archive, and are shown for archived rows in the usage view and in `session list --archived`. Before changing the stored session shape, list every consumer of session usage (rule 20): the web usage panel, Neovim, CLI text/JSON, the heartbeat, spend accounting. Check whether Codex and Claude Code rows lose usage the same way, and fix them with the same mechanism.

## Acceptance criteria

- [x] C1. A session's usage totals survive a hub restart: after a restart, the session row shows the same totals it had before the restart (test).
  - done: oc-1269 · 2026-10-25T01:31:55.725Z
  - verified: rev-32 [reviewer] · run rev-20261025-1269-final · 2026-10-25T01:52:49.456Z · commit 42b5f1f06171bc27ce304ee22d0982622a0127af
- [x] C2. A stopped and archived session still shows its last totals in `session list --archived --json` and in the usage view's data source (test).
  - done: oc-1269 · 2026-10-25T01:31:55.919Z
  - verified: rev-32 [reviewer] · run rev-20261025-1269-final · 2026-10-25T01:52:49.456Z · commit 42b5f1f06171bc27ce304ee22d0982622a0127af
- [x] C3. Every harness adapter that reports usage (OpenCode, Codex, Claude Code) is covered by the same persistence path, or the item records why one is unaffected (test).
  - done: oc-1269 · 2026-10-25T01:36:42.073Z
  - verified: rev-32 [reviewer] · run rev-20261025-1269-source3 · 2026-10-25T01:37:54.261Z · commit 42b5f1f06171bc27ce304ee22d0982622a0127af
  - verified: rev-32 [reviewer] · run rev-20261025-1269-final · 2026-10-25T01:52:49.456Z · commit 42b5f1f06171bc27ce304ee22d0982622a0127af

## Comments

### oc-1269 · 2026-10-25T01:23:29.406Z

Rule 20 consumer list for the stored session usage shape (a new harness_processes.usage JSON column plus HarnessProcess.usage, with the public HarnessProcessView/SessionRow usage field unchanged).

Production readers: hub/src/adapters/sessions.ts (view, list/listRows), hub/src/hub/core.ts (sessionRows, publishUsage/#recordUsage and the session-usage journal record), hub/src/adapters/processes.ts (row round-trip). Client and view consumers: web/src/connection.ts (session.usage event and archived session.list load), web/src/sessions/SessionRow.tsx, SessionPage.tsx, SessionDrawer.tsx, SessionLaunch.tsx, web/src/ItemsPlan.tsx (cost); nvim/lua/cland/init.lua and state.set_session_usage (session.usage event), nvim/lua/cland/panels.lua (usage_text, live rows only), nvim/lua/cland/item_view.lua (claiming session cost), nvim/lua/cland/hub.lua and explorer.lua (event allowlists); shared/wire/index.ts SessionUsage/SessionListRows (unchanged shape). CLI: cland session list --archived --json returns the view verbatim; the text line does not print usage today. Journal/spend: the documented cland hub journal --kind session-usage jq aggregation (hub/README.md) reads final records, not the row. Heartbeat: no usage read (hub/src/hub/core.ts heartbeatDigest). QA/briefs: no fixture asserts a stored usage column; existing tests that seed an old harness_processes table (hub/test/session-archive.test.ts, hub/test/accounts-registry.test.ts) exercise the additive migration.

Compatibility: the column is additive, old rows read as usage null, and the public view omits usage exactly as before when no report exists. The three adapters share the same persistence path (Sessions.#usageChanged and the process-table change listener); Claude Code and OpenCode seed a restarted launch's in-memory sum from the row, while Codex keeps its thread total authoritative.

### rev-32 · 2026-10-25T01:29:29.026Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261025-1269-source
commit: f5446505606299d2c6be38ae0c769d581bc20d12
scope: full
findings: [{"severity":"medium","text":"M1: Usage is persisted only when the publication timer fires (or another process-row change occurs), but close clears pending usage timers at lines1842–1843 without checkpointing them. A fresh usage report can already be visible in session.list and then disappear after an immediate clean hub stop/restart. Persist received totals independently of delayed publication or flush the latest readings before adapter/storage shutdown; add a pre-publication restart control.","file":"hub/src/adapters/sessions.ts","line":590},{"severity":"medium","text":"M2: The whole adapter usage object overrides stored usage even when it is only a Codex rate-limit report. After restart Codex begins with tokens=null; a limits read yields non-null usage with no total, and recordUsage at line591 replaces the saved totals with it. Retain stored token/cost data until an authoritative token total arrives, including stop/archive. Migrate session-native-lifecycle.test.ts:242–244, which currently expects the lost total, and add a partial-report control.","file":"hub/src/adapters/sessions.ts","line":521},{"severity":"medium","text":"M3: Same-conversation Claude/OpenCode relaunches can erase the new persisted usage. Their resume relaunch calls (claude-code.ts:814, opencode.ts:727) construct launch arguments without usage; after a hub restart the adapter maps are empty, so put(process) stores null and the next delta starts from zero. Preserve the current row's totals for the retained session/conversation and test relaunch plus a subsequent delta; keep genuinely new launches empty.","file":"hub/src/adapters/sessions.ts","line":1381},{"severity":"low","text":"L1: SESSION_USAGE now says session list shows each session's last reported usage totals, but cli/session.ts:16–17 still omits usage in text output. The inventory correctly notes JSON is the usage-bearing form. Qualify the help claim with --json (and matching frozen fixture) or implement the promised text output.","file":"hub/src/cli/usage.ts"}]
finding_counts: {"high":0,"medium":3,"low":1}

# T-1269 full source review

Head f5446505606299d2c6be38ae0c769d581bc20d12, tree2673d9295dad78e5ffea5aed53dd50b952e780fc, sole parent/merge base4decf43e2a44fff25b25b1c60e8de277240929eb. Pinned comparison git diff4decf43e...f5446505:13files113insertions/19deletions, one commit. git diff --check clean. Reviewer read-only source review of Standards/Spec in-session; no tests, probes, edits or delegation. rev-32 acquired the earliest hold; later overlapping reviewers released without verdicts.

## Standards

L1 (low), hub/src/cli/usage.ts SESSION_USAGE: help now promises each listed session's usage totals, while hub/src/cli/session.ts:16–17 text formatting still has no usage. JSON passes the full response through. Qualify the help claim with --json and update its frozen fixture, or ship the text behavior; the consumer inventory already records the difference. Rule16 requires shipped help to match behavior.

The additive nullable JSON column and old-row migration are otherwise straightforward. Old rows remain null, not invented zeros; public SessionUsage/HarnessProcessView/SessionRow wire shapes are unchanged. recordUsage does not notify row listeners recursively. Component tests use real process-table persistence, fake adapters/clock and sockets at T2, with observed usage frames before restart; the old-table fixture preserves absent-usage compatibility. Per-file guides/index and README remove the old memory-only claim. No novel abstraction/code-smell finding is warranted.

The consumer inventory covers the main production/client/CLI/journal/heartbeat/spend paths, but misses a behavior expectation that needs migration: the T3 native Codex restart test explicitly expects undefined totals after restart (session-native-lifecycle.test.ts:242–244). Its reported pass currently preserves the failure described in M2. Rule20's every-tier consumer audit must include this expectation. The new per-flavour fake test proves generic row persistence; it does not execute Claude/OpenCode delta seeding or Codex partial-report/relaunch behavior.

## Spec

M1 (medium), hub/src/adapters/sessions.ts:590–592 and1842–1843. Usage is written only when the delayed publication fires, unless an unrelated row change checkpoints it. close cancels those timers without saving their latest adapter readings. A report already visible through session.list can therefore be lost when the hub cleanly stops before the one-second publication window. The new test always waits for publish first, so it cannot catch this boundary. Separate persistence from the coalesced publication or safely checkpoint all pending latest readings before adapter/storage shutdown. Add a receipt-backed pre-publication restart control; keep the existing publication/coalescing assertions.

M2 (medium), sessions.ts:521/591, codex.ts:1029–1042. On reconnect the Codex live entry begins with tokens=null; its account/rateLimits/read can supply a non-null usage object containing rate limits but no total. The whole-object adapter-authoritative view immediately hides p.usage.total and recordUsage then replaces the durable snapshot with the partial object. A later stop/archive keeps the loss. Persisted token/cost data must survive partial rate-limit reports until an authoritative thread token total replaces it, without adding cumulative Codex totals. The existing T3 assertion expecting undefined at session-native-lifecycle.test.ts:242–244 must migrate, retaining its journal/no-replay assertions and adding the durable-total checks.

M3 (medium), sessions.ts:1381–1382 with claude-code.ts:814 and opencode.ts:727. After a hub restart has emptied adapter memory, resume --relaunch of the same stopped conversation builds a replacement launch process without p.usage. ProcessTable.put serializes absent usage as null, losing the retained stable session's totals; the next Claude/OpenCode delta consequently seeds from no saved total and starts over. Preserve the current same-session/conversation checkpoint across relaunch and prove first subsequent delta continues it. Keep genuinely new launch/name-reuse behavior starting empty. The generic fake resume spreads the whole process and does not cover these production constructors.

These are source-established control-flow findings, not reviewer reproductions. All three criteria have uncovered failure cases: C1 pre-publication restart, C2 partial-report totals retained through stop/archive, C3 production adapter continuation semantics. The normal published-row persistence and null migration are present but insufficient for clear.

## Evidence limits and disposition

Claimant reports local session-usage/archive/native-lifecycle/computed-sessions/connection/CLI tests and typecheck passed; no same-head configured verification exists. No timings, platform/executor provenance or raw command captures were attached to the initial request. Preserve available original invocation/output/exit/native timing records with their actual committed or dirty-tree attribution; do not rerun merely to reconstruct output. Future corrections need a fresh committed/pushed source request before mode-free verification.

Record not clear at f5446505; findings M1–M3 medium plus L1 low, fail C1/C2/C3 with specific uncovered boundaries. Complete source finding set above; no shared-defect classification, final evidence or QA claim. Standards1low; Spec3medium.
Durable review: A-11572.

Criteria: C1 failed (A clean restart before delayed usage publication discards the received latest totals.), C2 failed (Codex rate-limit-only reconnect reports erase saved token totals, including stopped/archived views.), C3 failed (Claude/OpenCode same-conversation relaunch drops saved usage and resets the next delta after a hub restart.).

### oc-1269 · 2026-10-25T01:32:02.232Z

Fixes for M1-M3 and L1 at head 109bd69c (branch pushed; git fetch --no-auto-maintenance origin dev + git merge-tree --write-tree HEAD origin/dev exits 0 with no conflict after dev moved to fa47be73).

M1: #usageChanged now checkpoints the merged usage on the process row immediately, before the coalescer timer; the timer only publishes. close() cancelling pending timers can no longer drop a report that session.list already showed. The new per-flavour restart test feeds usage and stops the hub without advancing the FakeClock, first asserting no session.usage frame was published, then re-reading the row after restart.
M2: a shared #reportedUsage helper returns the adapter object, but when the adapter has no total and the row has one, it keeps the stored total, last counts, raw tokens and model while taking the live rate limits. Only a report that carries a total replaces them. Regression: the T2 Codex case in session-usage.test.ts (rate-limit-only after restart, then stop+archive, then a fresh launch where a total report replaces a smaller stored total) and the migrated T3 real-daemon Codex restart case in session-native-lifecycle.test.ts (expects the stored total, keeps no-replay and one-final assertions).
M3: a same-conversation relaunch keeps the stopped row's usage when the adapter's relaunched process has none; #freshResume still launches empty. Production proof added to the T3 OpenCode contract: stop, relaunch returns the same totals, and the next native step adds to them (total grows rather than resetting); the fixture's role-clause turn and message turn give the pre-stop figure.
L1: session list help now says --json also carries each session's last reported usage totals, and the cli-usage fixture is updated byte-for-byte.

Local evidence, this head, macOS, executors not used: hub/test/session-usage.test.ts PASS (7/7, T2); hub/test/session-archive.test.ts PASS (14/14, T2, legacy row usage null); hub/test/session-native-lifecycle.test.ts PASS (9/9, T3 real-process); hub/test/opencode-adapter.test.ts PASS (20/20, T3 real-binary contract); hub/test/computed-sessions.test.ts PASS; hub/test/connection-snapshot.test.ts PASS; hub/test/cli-usage-compatibility.test.ts + hub/test/cli-help.test.ts PASS; npm run typecheck PASS. No mode-free cland verify has run at this head; it follows a clear source verdict.

### rev-32 · 2026-10-25T01:33:41.401Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261025-1269-source2
commit: 109bd69c0230a4298ca5fc64176bdba4d5dfd495
scope: full
findings: [{"severity":"medium","text":"M3 remains unproven: this relaunch uses the same projectHub/OpenCodeAdapter instance, and stop retains its #usage map. Consequently the new checks also pass when the persisted carry-forward fix is removed. Cross an actual hub/adapter restart before relaunch so usage memory is empty, then assert retained session/conversation totals and the exact next native step's token/cost sum, not merely a larger total; retain existing end-to-end assertions.","file":"hub/test/opencode-adapter.test.ts","line":424}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1269 corrected full source review

Reviewed109bd69c0230a4298ca5fc64176bdba4d5dfd495, treeca3e3860ee017498e917b5d18c7dedc823e2ec08, sole parentf5446505606299d2c6be38ae0c769d581bc20d12. No dev integration. Correction diff10files128insertions/29deletions; git diff --check exit0. Standards/Spec read in-session without delegation, source edits, tests or probes. Full corrected-source scope carries the prior complete audit A-11572.

## Standards

L1 resolved: SESSION_USAGE and its frozen command fixture now explicitly qualify usage totals with --json, matching the unchanged plain-text formatter. README and per-file guides describe immediate checkpoints, retained partial-report totals and same-conversation relaunch. Old nullable process-column migration and unchanged public wire shapes remain intact. No additional standards finding.

New M1 test setup uses a frozen FakeClock and does not advance the publication timer; it observes list totals then reopens the actual database with empty fake adapter usage maps. Existing publication/coalescing tests stay intact. The M2 component test checks partial rate limits, preserved total/model/raw tokens and final archived totals; a later authoritative total replaces rather than adds. The T3 Codex consumer is migrated from undefined to retained totals, preserving no-replay and one-final assertions.

## Spec

M1 resolved in source: #usageChanged records the merged reading synchronously before checking/scheduling the coalescer, so close cancelling publication timers cannot discard the just-received reading. Row-change checkpoints still precede lifecycle publication.

M2 resolved in source: #reportedUsage shares the adapter/stored fallback across view, row checkpoints and usage callbacks. A partial adapter report keeps stored total/last/model/tokens while taking live limits; an adapter object with a total remains authoritative. Native Codex restart/final journal assertions now expect retained total. Unknown old usage remains null and no totals are invented from rate limits.

M3 production correction at sessions.ts:1394–1406 looks appropriate: for relaunch, absent adapter process usage is restored from the current stopped row before put and watch, so the restarted Claude/OpenCode delta accumulator can seed from it. #freshResume remains a separate new-conversation path.

M3 remains medium at hub/test/opencode-adapter.test.ts:424. The added production contract stops and resumes within the SAME projectHub/adapter instance. OpenCodeAdapter.stop removes watchers but deliberately retains #usage. Consequently again.usage and the next step's growth also pass with the old broken persisted carry-forward path: nothing in this test empties memory. Its total > old check additionally fails to prove the exact step sum/cost. Cross an actual hub/adapter restart before same-conversation relaunch, observe retained session/conversation identity and saved totals, and assert the exact expected next step token/cost sum. Keep the original delivery/state/PID/server cleanup assertions. A failed pre-fix control at this exact boundary is needed; no new broad harness or timeout relaxation is implied. Claude's shared path should remain explicitly accounted for in the inventory/test seam.

## Evidence and disposition

Claimant reports macOS local 7/7 session-usage,14/14 archive,9/9 native-lifecycle,20/20 OpenCode plus computed/snapshot/CLI/typecheck passes. Those summaries do not establish the missing empty-memory relaunch boundary; no configured verification has run. No raw original invocation/output/exit/timing artifact was supplied with this replacement request. Retain available originals with actual source/platform attribution and missing-record limits, without reruns for transcription.

Complete corrected-head finding set is M3 only, medium. Record not clear/C3 failed; C1/C2 corrections appear addressed in source but run-dependent final proof remains pending. Commit/push the corrected regression/docs and request fresh source review before mode-free verify. Standards0; Spec1medium.
Durable review: A-11573.

Criteria: C3 failed (Same-instance OpenCode relaunch test retains adapter usage memory and misses the post-restart carry-forward failure.).

### oc-1269 · 2026-10-25T01:36:50.325Z

M3's contract proof revised at head 42b5f1f0 (branch pushed; git fetch --no-auto-maintenance origin dev, merge-tree --write-tree HEAD origin/dev exit 0).

The relaunch proof now crosses a real daemon/adapter restart: one native step before 'hub stop' leaves the stored total, the second daemon reads it with empty adapter memory (asserted equal to the pre-stop usage), then session.stop + resume --relaunch of the same conversation returns exactly those totals and identities/attach. The next native step must add its exact 19 tokens and $0.25 to the carried total; the test asserts both exact figures plus the existing injection/reply/SSE-busy assertions. It subscribes the first UI so the pre-restart reply frame is observable.

Red/green control, same head, macOS, no executor: with the sessions.ts carry-forward spread removed, 'node --experimental-strip-types --test --test-name-pattern="after a hub restart" hub/test/opencode-adapter.test.ts' exits 1 with 'actual: undefined' at the relaunch usage deepEqual (42b5f1f0's parent code path); with the spread restored it exits 0. Full hub/test/opencode-adapter.test.ts: 20/20 PASS (36.97 s). npm run typecheck PASS. The earlier 109bd69c run's same-instance relaunch assertions are removed as the reviewer directed. No cland verify at 42b5f1f0 yet.

### rev-32 · 2026-10-25T01:37:54.261Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1269-source3
commit: 42b5f1f06171bc27ce304ee22d0982622a0127af
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1269 corrected source review

Reviewed42b5f1f06171bc27ce304ee22d0982622a0127af, treefde193195139e2c9832673d9423de2a1e91c6bf7, sole parent109bd69c0230a4298ca5fc64176bdba4d5dfd495. No dev integration. Correction changes only the OpenCode contract and its guide; production remains the source-reviewed109bd69c tree. git diff --check clean. Full corrected-source scope carries A-11572/A-11573; Standards/Spec read personally, no reviewer tests, edits or delegation.

## Standards

No findings. The insufficient same-instance assertion block is replaced by extending the existing real-daemon restart contract at its established T3 lifecycle seam. The first UI subscribes before the pre-restart step, then observes the reply and usage; the old daemon is stopped before the replacement starts on the same disposable root. New totals are observed through bounded status reads with exact positive values, then asserted. Existing server-survival/identity/attach/journal/delivery/injection/reply/SSE busy and fixture cleanup remain. No additional process fixture, timeout relaxation or broad test harness is introduced. The per-file guide explains why adapter memory must be empty and the exact regression control. M1/M2 fixtures and JSON-qualified help remain as reviewed in A-11573.

## Spec

All source findings are resolved. M1 persists merged usage synchronously before publication timer ownership; M2 keeps stored total/last/tokens/model through partial rate-limit reports and replaces with authoritative totals; L1 help correctly confines usage claims to JSON.

M3 now crosses an actual daemon/adapter restart before relaunch. The pre-restart native step reports19tokens and$0.25; the restarted daemon first returns precisely the stored usage while re-finding the same still-running PID/server/conversation. After session.stop and same-conversation resume --relaunch, the returned usage is asserted equal to the stored checkpoint. A subsequent admitted/injected message and native reply must yield exactly prior total+19tokens and prior cost+$0.25. Thus retained in-memory usage can no longer mask removal of sessions.ts's carry-forward branch. The guide and claimant describe the corresponding mutation failure (actual undefined at relaunch equality).

Shared contract C3 is source-established: all three reporting adapters feed the Sessions/process-table checkpoint path; nullable migration and unchanged public wire shape retain older clients/rows. Claude and OpenCode delta adders seed from p.usage after restart; both same-conversation relaunch constructors pass through the shared Sessions carry-forward before watch. Codex authoritative totals replace rather than add and partial-only reports preserve the prior token evidence. Generic per-flavour component persistence tests plus production OpenCode empty-memory continuation and migrated native Codex reconnect controls cover these distinct boundaries; no separate Claude constructor fix is required. Explicit fresh/new launches stay separate and do not inherit a prior conversation's total.

## Evidence limits and disposition

Claimant reports macOS local red control by removing only the carry-forward spread (exit1, actual undefined) and restored pass, full OpenCode file20/20 (reported36.97s) and typecheck pass. These remain claimant implementation records, with no original raw stdout/native timing artifact attached; the reviewer did not reproduce them or infer exact wall-time boundaries. Earlier local7/7 usage,14/14 archive,9/9 native-lifecycle and client/CLI summaries are similarly supplemental, not configured same-head evidence. Preserve available original command/output/exit/timing records with actual source attribution and explicit missing-record limits, without transcription reruns.

Clear source at42b5f1f0, findings[]. Verify C3's shared-path source criterion only; C1/C2 runtime verification remains pending the same-head configured mode-free task receipt, including actual generated new T2 load-gate identities and changed native OpenCode/Codex T3 cases. No full T3/T4, QA, native provider or old pre-migration usage recovery claim. Standards0; Spec0.
Durable review: A-11574.

Criteria: C3 verified.

### rev-32 · 2026-10-25T01:52:49.456Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1269-final
commit: 42b5f1f06171bc27ce304ee22d0982622a0127af
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1269 final same-head evidence review

Head42b5f1f06171bc27ce304ee22d0982622a0127af, treefde193195139e2c9832673d9423de2a1e91c6bf7, unchanged branch tip. Current clear source verdict rev-20261025-1269-source3/A-11574. task.view confirms configured mode-free run89c9bfa4-3c4c-455e-9de0-90b9c56b5f05 passed at this exact head, A-11575. Read-only review; no reviewer tests or source changes.

## Standards

No findings. Native suite progress records independently yield3135 ordinary test passes and440 ordinary passing file records, plus10 separately scoped passing load-gate tests/files; no failures, cancellations or skips. The ten repetitions are not included in the ordinary total. Runtime executor: Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-bca52f5a, Node24.21.0, Neovim0.12.5,2workers (Web's internal shard4). Machine lifetime767s/$0.0533 is not suite wall time.

Completed actual scope: host T0 npm run check25.372s, all T1, shared-contract fallback all hub/Neovim T2, two changed T3 files once (OpenCode adapter20/20 plus native lifecycle9/9), mapped T4 inbox verifier guard once, full Web. Remaining T3/T4 were not run; T4 repetitions explicitly skipped. No all-T3/T4 cover, native provider or QA claim. Browser: isolated Chrome Headless Shell156.0.8078.4/Playwright1248. Host macOS gate tree78b027e0ee55416c5d90471fd060b0cc7b986d63 is separate reused host evidence, not a Linux typecheck repetition.

Phase envelopes69/374/58/7/158s differ from internal runner walls63.67/369.96/53.89/2.32/153.50s. Changed T3 added53.828s excludes machine wait and is distinct from summed per-test observations. Report-only warnings remain: lint133/60, Web above40s, existing would-fail budgets. Final T3 ratchet2209.786s equals its base. The existing OpenCode restart identity measured8.089645585s; the log prints a12.135s E-1216 allowance stanza, but no such entry exists in the reviewed durations.json and no source change is claimed. Treat this as printed run guidance, not an installed worktree allowance or enforce-mode performance clearance.

## Spec

C1/C2 direct generic cases pass in the real persisted process-table component fixture:
- 'each reporting harness keeps its totals on the session row across restart, stop and archive': base0.214901674s, plus five distinct load-gate pass records0.346374199/0.263874675/0.353808296/0.331562804/0.307788111s; log10843 confirms5/5. Its reviewed assertions cover immediate pre-publication checkpoint, all three flavours, restarted row totals, stopped/archived processes and rows, and final journal totals.
- 'a rate-limit-only report after a restart keeps stored totals until a new total replaces them': base0.125187925s, five load-gate passes0.295112725/0.222462318/0.315056750/0.238115840/0.303806591s; log10839 confirms5/5. Its assertions preserve stored total/model/raw tokens through partial limits and stop/archive, then replace authoritative totals rather than adding.
- Legacy migration 'migration retains old stopped rows without reading the journal, and name reuse clears archive metadata' passed0.004282483s, retaining null for an old row without usage.

C3 native distinct behavior also passes: 'the first publication after hub restart is recorded again without replaying history'4.352968739s (Codex retained total, no replay, one final); 'after a hub restart, resume re-finds the OpenCode server and session through the process table and the event stream goes on'8.089645585s (empty adapter memory, saved totals, same-conversation relaunch, exact next19tokens/$0.25). The source-reviewed shared Sessions path and Claude delta seeding remain covered by generic per-flavour controls and unchanged adapter contract tests. No inference that a generic fake executes native parser code. Mapped T4 '100-frame verifier delivery bursts never scan retained message history' passed1.304029885s once.

Together A-11574 source and A-11575 runtime establish C1/C2/C3. Initial local summaries/mutation remain supplemental with the previously recorded raw-record limits; they are not substituted for this exact-head receipt. Old pre-column rows remain unknown/null; no historical lost-usage backfill is claimed.

Disposition: clear final evidence at42b5f1f0, verify all C1/C2/C3, findings[]. Standards0; Spec0.
Durable review: A-11576.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-25T02:28:10.247Z

Rule 6 pre-merge full suite (hub storage change): Coordinator `verify all` 6490f059 at 42b5f1f0 from a detached worktree, Linux droplet c-8 lon1. Exit 0, 4407 passed, 8 skipped, 0 failed; T0–T3 and Web completed (A-11577). The final evidence review covers the earlier mode-free verify 89c9bfa4 at the same head. Enqueued.

### coord · 2026-10-25T02:33:41.340Z

Merged bc9e8d5e86c59db1961d4158d1aaa37aefa40155 onto dev.
