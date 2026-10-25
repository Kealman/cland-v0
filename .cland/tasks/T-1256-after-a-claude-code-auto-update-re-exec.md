---
id: T-1256
kind: task
title: After a Claude Code auto-update re-exec the coordinator's bridge reconnects but its deliveries are acked and never run, with no alarm for an hour
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1028
branch: t/T-1256-after-a-claude-code-auto-update-re-exec
created: 2026-10-24T18:39:16.111Z
updated: 2026-10-25T11:41:44.169Z
closed: 2026-10-25T11:41:44.169Z
---

## Summary

At 17:28:20Z on 2026-10-24, Claude Code's fifth auto-update re-exec (2.1.309→2.1.310) restarted coord. hub.log shows bridge-closed at 17:28:20.215Z and bridge-connected at 17:28:23.776Z, and the role was refilled (T-1034). From then on every delivery to coord was acked but never ran as a turn. hub.log has no coord `inject-unconfirmed` between 17:28 and 18:28Z, so the hub kept believing it was delivering. The process exited at 18:28:20Z, exactly one hour later. cland-impl relaunched it at 18:35Z, and the 32 queued deliveries were injected at 18:38Z. Meanwhile impl-1255 waited 34 min for a coordinator-only verify resubmit, and the human's question waited too.

## Acceptance criteria

- [x] C1. A delivery the mod acknowledges but never turns into a model turn within the confirmation window is reported as `inject-unconfirmed`, including after a re-exec that reconnects the bridge, with a red test reproducing the re-exec shape (test).
  - done: impl-1256 · 2026-10-25T10:11:25.598Z
  - verified: rev-31 [reviewer] · run rev-20261025-1256-final · 2026-10-25T10:26:32.600Z · commit dab7fc8ce05f616bc08251c7d1a3325cb18b009e
- [x] C2. When the Coordinator has unconfirmed deliveries for more than 5 minutes, the hub posts a notice to the human in General and to the Aide or stand-in, naming the session and the recovery command (test).
  - done: impl-1256 · 2026-10-25T10:08:13.046Z
  - verified: rev-31 [reviewer] · run rev-20261025-1256-final · 2026-10-25T10:26:32.600Z · commit dab7fc8ce05f616bc08251c7d1a3325cb18b009e

## Comments

### impl-1256 · 2026-10-25T10:02:25.371Z

Clean inherited worktree. Triage A-11669 confirms sessions.ts bridge retry path. Pre-change contract audit: Claude mod hub/mod/cland/hooks/register.ts emits legacy `injected` after prompt.submit resolves, plus mod-turn-start carrying envelope; sessions.ts consumes both; ClaudeCodeAdapter.confirm settles pending inject; Codex/OpenCode confirm no-ops and own inject receipts remain unchanged. Production presentation consumers: Core delivery stages/history/store, Inbox inject-stalled event, Web/Neovim generic message/delivery displays. No reply/list shape change planned. Tests/fixtures: claude-code-schedule (T2 production adapter/scripted native seam), mod-bridge (T2 engine seam), fake-claude native fixture and claude-code-adapter (T3), fakes/harness (T1/T2 adapter accept semantics), inject-stalled (T2 alarms). QA E-417-stage-1 names inject-stalled tests but no changed textual expectation; other QA/skills/startup probes have no injected signal consumers found. Preserve old injected wire shape as accepted receipt, require turn-start envelope for Claude model confirmation; retain legacy-wire regression. Alarm uses existing inject-stalled shape with General topic and direct named Aide recipients, no new permission or role-clause lines. C1 seam: existing T2 Claude production-adapter frame/bridge fixture with fake clock and scripted CLI. C2 seam: T2 projectHub/frame fixture with fake adapter and fake clock. These are the existing agreed repository seams.

### impl-1256 · 2026-10-25T10:08:39.356Z

Source review requested on pushed head 6f9a30c0a82dcc1a15418c3df30b2e086f21b980; assigned Reviewer via hub. Durable evidence A-11680 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11680-t-1256-source-and-red-green-evidence.md. Local Darwin arm64 Node24: three touched T2 files 20+8+1 passing cases, typecheck passed at review head. Test lint reported 133 findings/60 files and 0 refusals in report mode; baseline comparison was not run, so this is not a claim of zero lint findings. Awaiting source verdict, then one mode-free verify. No per-item QA required (affected/after-stage policy).

### rev-34 · 2026-10-25T10:09:33.333Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1256-source
commit: 6f9a30c0a82dcc1a15418c3df30b2e086f21b980
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at 6f9a30c0. Standards: no findings. Spec: no findings. Legacy Claude injected frames remain accepted but no longer confirm a turn; exact turn-start confirmation, shared-clock timeout, preserved reconnect alarm deadlines and General/direct-Aide escalation are implemented with corresponding T2 regressions. Existing native fake-Claude emits the required turn-start signals. C1 and C2 remain unverified because both require runtime test evidence. No Reviewer test or browser execution; await successful configured verification at this exact head.

### rev-34 · 2026-10-25T10:10:21.433Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-T-1256-source-correction
commit: 6f9a30c0a82dcc1a15418c3df30b2e086f21b980
scope: full
findings: [{"severity":"medium","text":"M1: HOOK_USAGE changed without its frozen commands.json block; existing cli-usage-compatibility and root cli-help byte guards deterministically disagree. Update only the intended frozen block and preserve both guards.","file":"hub/src/cli/usage.ts","line":51}]
finding_counts: {"high":0,"medium":1,"low":0}

Correcting my earlier source-clear verdict: medium M1 at hub/src/cli/usage.ts:51. HOOK_USAGE differs from hub/test/fixtures/cli-usage/commands.json. hub/test/cli-usage-compatibility.test.ts:9 deep-compares every named export with that fixture; hub/test/cli-help.test.ts:31 compares root help with the same frozen bytes. This is a source-proven deterministic mismatch; no Reviewer execution claimed. Update only the intended fixture block and request fresh source review at the correction head. No additional Spec findings; runtime criteria remain unverified.

Criteria: C1 failed (M1: changed CLI help disagrees with its frozen fixture and existing compatibility/help guards (rule 16).).

### impl-1256 · 2026-10-25T10:11:15.841Z

Review correction M1 fixed in dab7fc8ce05f616bc08251c7d1a3325cb18b009e: only the frozen HOOK_USAGE command row changed, preserving separators, export composition, help template and all guards/assertions. Existing T1 cli-usage-compatibility case reproduced the stale fixture with `Expected values to be strictly deep-equal`, showing the two new hook-help lines absent from expected. After snapshot migration: that T1 case passed and all 3 cli-help T2 real sealed CLI cases passed locally (Darwin arm64 Node24). Production TypeScript remains identical to 6f9a30c0's passing root typecheck. Original verify a8e0e05e remains old-head evidence only. No new dev merge after first source review (rule 11).

### rev-31 · 2026-10-25T10:12:15.552Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1256-source2
commit: dab7fc8ce05f616bc08251c7d1a3325cb18b009e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1256 correction source review — CLEAR

Head dab7fc8ce05f616bc08251c7d1a3325cb18b009e, tree b8e492984bb2fb67a08bf127a7db058c7174a5c5. Direct parent is 6f9a30c0a82dcc1a15418c3df30b2e086f21b980. Claimant's named request is limited to the M1 correction; rev-31 took the free hold and carries rev-34's full source audit plus its later consolidated M1 not-clear correction. No competing hold or verdict.

## Standards

M1 resolved. The entire parent-to-child diff changes only hub/test/fixtures/cli-usage/commands.json. Parsed JSON key comparison finds HOOK_USAGE alone changed. Its decoded bytes now equal the production HOOK_USAGE literal, including the two intended Claude confirmation/escalation lines. All other command blocks, export composition, root help template and every guard/assertion remain byte-identical. No other finding. Read-only inspection only; Reviewer ran no tests, builds, probes, browser, Git mutation or fetch.

## Spec

No additional finding. Production, mod, fixtures and runtime tests are unchanged from the fully reviewed parent. Carry rev-34's accepted conclusions for legacy submission acceptance versus exact turn-envelope confirmation, adapter-clock deadlines, reconnect-preserved sustained alarms, General/direct-Aide escalation and existing native fake-Claude signals. This correction migrates the frozen help expectation to that behavior; it does not change delivery semantics or expand permissions.

## Evidence and criterion disposition

A-11680 remains implementation-time Darwin arm64/Node24.21 evidence with actual implementation-parent attribution (20+8+1 touched T2 cases, static/type checks), not a child-head runtime cover. The correction request reports existing T1 frozen compatibility red then green and sealed real CLI help 3/3 at the correction tree, Darwin arm64/Node24; original complete output/native timings should retain actual command/source attribution and unavailable-record limits. No Reviewer execution or transcription rerun claimed. Previous configured a8e0e05e-20e4-4cf4-84ec-70b08a07eebe targets 6f9a30c0 only and supplies no correction-head final verdict.

Source CLEAR, findings empty. Both C1/C2 remain runtime-unverified pending one successful ordinary mode-free configured result at this unchanged head. task.view currently shows C1 failed/not done from M1 and C2 done, despite the request saying both done; claimant must restore C1's done mark before final settlement. Preserve source head without another dev merge; then request final evidence review with exact generated case facts, phase/executor/browser/report-mode scope and original terminal receipt. Affected after-stage QA remains with E-1280, no per-item brief.
Durable review: A-11697.

### rev-31 · 2026-10-25T10:26:32.600Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1256-final
commit: dab7fc8ce05f616bc08251c7d1a3325cb18b009e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1256 final evidence — CLEAR

Reviewed unchanged dab7fc8ce05f616bc08251c7d1a3325cb18b009e/tree b8e492984bb2fb67a08bf127a7db058c7174a5c5. Carry original full audit by rev-34 and corrected source A-11697. Original mode-free df59099c-5b1b-48b5-a584-5a3e3a0be1d0/A-11718 is finished/passed at this exact head in task.view; C1/C2 claimant done marks are both present.

## Criteria

C1 verified. Exact ordinary `Claude re-exec bridge acknowledgement without a model turn remains unconfirmed` passes in 0.297914141s, plus 5/5 separate load repetitions (worst 0.417236327s). Source assertions first establish healthy exact-envelope confirmation, replace the spoke/bridge under the same launch identity, submit the retained legacy injected frame without a model turn, advance the confirmation window, require the exact persisted inject-unconfirmed message id, reject unrelated-turn confirmation, then require the late exact envelope's injected delivery receipt. This proves model-turn confirmation rather than submission acceptance or mere reconnect presence.

C2 verified. Exact ordinary `five minutes of unconfirmed Coordinator delivery alerts General and the named Aide despite reconnect` passes in 1.309335640s, plus 5/5 separate load repetitions (worst 1.529253776s). Its assertions retain exact failed-delivery receipts, reconnect at four minutes, no early escalation, observer-armed General and named-Aide delivery at five minutes, session/recovery command, one event and deduplication through further retries, followed by eventual injected-delivery recovery. Touched files complete 20/20 claude-code-schedule, 8/8 inject-stalled and 1/1 mod-bridge. Existing frozen-export and sealed real CLI help pass at the corrected head, closing M1 without relaxing assertions.

## Scope and provenance

Parsed unique terminal test progress, excluding file containers, reports 3117 ordinary passes and 25 additional load passes, no failures/cancellations/skips/todos. Of the load passes, ten belong to the two task cases above; fifteen belong to three inherited install-document controls. Do not attribute all 25 to new task identities or add them to the ordinary total. Five sequential repetitions use two load workers; no Web repetition is required (zero new files).

Executed host T0 exit0/27.127s; allT1 exit0/71s; fallback-all hub+Neovim T2 exit0/377s due shared adapter contract; selected T4 inbox-verifier-load exit0/7s; Web exit0/159s. The exact selected T4 `100-frame verifier delivery bursts never scan retained message history` passes once in 1.321297132s. T4 has no tier budget, no load repetitions; selected added wall 2.290s excludes machine wait. No T3 ran; remaining T3 is deferred to periodic/integrated occasions and absent configured batch tiers. Other T4 files did not run. This is not a full all-tier, real-provider re-exec or after-stage QA cover.

Remote executor c-8 lon1/cland-v0-91d165bb, Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, workers2, machine lifetime711s/cost$0.0494 (not suite wall). Prepare installs pinned Chrome Headless Shell156.0.8078.4/revision1248/linux64 at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248; isolated Web fixtures use that prerequisite, not a human browser. Host check is reused remotely under gate-tree key bced9449b030a0283c17b1ca84b1d4edb51ee0b5, not an alternate task commit or a repeated remote check.

Report-only limits remain explicit: 133 lint findings/60files, one missing install-claims duration baseline, seven listed budget overages, Web actual suite153.80s against40s, T3 ratchet2209.786s unchanged. These are not enforced-budget passes. Phase envelopes, native case timings, selected-phase wall and machine lifetime are separate measurements; projected tier values are not executed wall time.

## Disposition

Final CLEAR, C1/C2 verified across unchanged accepted source and original same-head executed evidence; findings empty. A-11680 and correction local receipts keep actual precommit/macOS and missing-record attribution, not relabelled as current Linux or stage coverage. Old a8e0e05e remains parent-head history only. No extra repeats, source changes or dev merge requested. Coordinator owns enqueue after the normal unchanged-head/fresh-conflict ready report; affected after-stage QA remains with E-1280. Reviewer performed read-only inspection only.
Durable final review: A-11722.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T11:41:44.168Z

Merged 5881ebcc36b1010ecb04e5808665fb24856ee926 onto dev.
