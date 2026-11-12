---
id: T-1824
kind: task
title: The web's hosts and logins frames, with web-started card sign-ins
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: topic-1490
branch: t/T-1824-the-web-s-hosts-and-logins-frames-with
created: 2026-11-12T10:07:20.325Z
updated: 2026-11-12T13:03:30.443Z
closed: 2026-11-12T13:03:30.443Z
---

## Summary

The hub accepts the hosts view's frames from an authenticated web user: the human in single mode, an admin in users mode. These are `login.list`, `host.stop`, `login.remove` and `login.snapshot`, plus web starts of `login add` and `login signin`. A web start runs the harness's sign-in on a pool host through the card runner, not a terminal. Sessions and the remotes stay refused, and the other host and login frames stay local.

## What to build

Today every `host.*` and `login.*` frame is refused from the web, in both the web authority table and the dispatcher's locality check. Open exactly these to the web edge, under the user-role column:
- **Reads and stops.** `login.list` and `host.stop` answer as they do from the local CLI.
- **Removal and snapshots.** `login.remove` and `login.snapshot` answer the same way.
- **Starting a sign-in.** A web `login.add` for a disk login of a pool and harness, and a web `login.signin` of a signed-out login, enter the card runner's start path directly, with no card answer needed. They answer at once with the login name and the id of the `login-signin-code` card that carries the link and code (question 11).

A key login is refused from the web, since a key enters only through stdin. `host.create`, `host.destroy`, `host.revoke`, `host.prepare` and `login.set` stay local. Each web action's audit and journal records carry the acting user's id in users mode.

## Acceptance criteria

- [x] C1. From an authenticated web connection, `login.list`, `login.snapshot` and `login.remove` answer as from the local CLI, and `host.stop` stops a fake host and ends its sessions as exited (test).
  - done: impl-1824 · 2026-11-12T10:18:05.592Z
  - verified: rev-37 [reviewer] · run rev-37-1824-evidence-1 · 2026-11-12T11:02:39.220Z · commit d2e31fa508bde9f1bfbc18dea2f741cd173aa598
- [x] C2. A web `login.add` of a pool and harness, and a web `login.signin` of a signed-out login, run the sign-in on a pool host through the card runner and answer at once with the login name and the sign-in card's id (test).
  - done: impl-1824 · 2026-11-12T10:28:51.468Z
  - verified: rev-37 [reviewer] · run rev-37-1824-evidence-1 · 2026-11-12T11:02:39.220Z · commit d2e31fa508bde9f1bfbc18dea2f741cd173aa598
- [x] C3. A web-started sign-in leaves the fake Codex login `ready` with no answer, and the fake Claude Code login `ready` once the card's answer reaches the prompt (test).
  - done: impl-1824 · 2026-11-12T10:18:14.499Z
  - verified: rev-37 [reviewer] · run rev-37-1824-evidence-1 · 2026-11-12T11:02:39.220Z · commit d2e31fa508bde9f1bfbc18dea2f741cd173aa598
- [x] C4. A key login, `host.create`, `host.destroy`, `host.revoke`, `host.prepare` and `login.set` from the web, and every host and login frame from a session or a remote, are refused naming the rule (test).
  - done: impl-1824 · 2026-11-12T10:18:14.894Z
  - verified: rev-37 [reviewer] · run rev-37-1824-evidence-1 · 2026-11-12T11:02:39.220Z · commit d2e31fa508bde9f1bfbc18dea2f741cd173aa598
- [x] C5. In users mode each web action's audit and journal record carries the acting user's id (test).
  - done: impl-1824 · 2026-11-12T10:18:15.445Z
  - verified: rev-37 [reviewer] · run rev-37-1824-evidence-1 · 2026-11-12T11:02:39.220Z · commit d2e31fa508bde9f1bfbc18dea2f741cd173aa598

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/hub/web-authority.ts`, `hub/src/host/login-card-signin.ts` (the start path), `hub/src/hub/dispatch.ts` (the host and login case's locality check). Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts`.
- Tests: new `hub/test/web-hosts-authority.test.ts` (T2, `projectHub`, an authenticated web frame client, the fake host provider and the fake harness binaries); `hub/test/web-authority.test.ts` extended.
- Serves epic C2.

## Comments

### impl-1824 · 2026-11-12T10:10:10.223Z

Rule 20 sweep before edits: /tmp/T-1824-consumers.md records the shared transitive graph (648 reached plus 16 unknowns treated reached) and explicit frame/field/function searches across production, clients, docs, skills, QA and T1–T4. Existing CLI/native reply and intent record shapes remain unchanged; web sign-in adds edge-specific {name, card}. Native card runner integration is affected; provisioning/host transport and native lifecycle semantics are unchanged. Durable artifact follows after secret scan.

### impl-1824 · 2026-11-12T10:17:59.811Z

Candidate 8ec716cfa committed and pushed after merging origin/dev (94b73e73c). Rule-20 sweep published as A-18986 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18986-t-1824-contract-consumer-sweep.md), secret scan positive control and zero matches. macOS targeted T1/T2 green; native card runner 4/4 green on prior working tree, final-head rerun awaiting preservation slot for requested /private/tmp inventory. Root typecheck green; lint reports 0 refusals (122 report-only findings repository-wide). QA after-stage; no per-item QA brief required.

### rev-37 · 2026-11-12T10:26:23.087Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1824-source-1
commit: 8ec716cfaea8aac4dfa84e6ca2f9e599775fc407
scope: full
findings: [{"severity":"medium","text":"Public web login.add passes raw frame into internal Input. Extra signin:true selects renewal and caller harness runs against a different existing login; pinned probe preserves Codex row but preparation/native/card use Claude. Intent also persists type/id/internal fields. Project declared public add fields; derive renewal mode/harness only from login.signin plus stored row, with extra-field regression.","file":"hub/src/hub/dispatch.ts","line":2274},{"severity":"medium","text":"HOST_USAGE/LOGIN_USAGE changed without migrating frozen commands.json rows. Pinned focused run exits1 at deepStrictEqual; migrate only intended rows and retain exact-export guard.","file":"hub/test/cli-usage-compatibility.test.ts","line":9},{"severity":"medium","text":"Existing edge test still expects all newly admitted web login frames to refuse; pinned selected case exits1 true!==false. Migrate allowed web expectations while preserving session/gateway and still-local refusals.","file":"hub/test/login-list.test.ts","line":70},{"severity":"low","text":"Stale local-only/removal or blanket web-refusal claims remain in auth.md, login-list/snapshot-cli guides and E-1535-stage-4 checks646/656/row55. Update current docs and explicitly qualify historical-build QA checks under rules16/20.","file":"docs/agents/auth.md","line":79}]
finding_counts: {"high":0,"medium":3,"low":1}

Full source not clear:3medium/1low, all recorded; A-18995 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18995-t-1824-full-source-review-input-projection-and-consumer-migrations.md) separates Standards/Spec and gives complete evidence limits. Actual failures before diagnosis: CLI frozen guard AssertionError/deepStrictEqual line9 exit1; login-list old blanket web refusal true!==false line70:233 exit1. Lead's pinned injected probe observes Codex stored row with public add hidden signin:true while preparation/native-run/card use Claude and intent persists frame type/id/internal mode. Ordinary six-frame transport/admin/audit boundaries, durable card receipt and shared native ownership reviewed; no other findings. A-18989 local90 lower/4native passes exclude these red gaps; no Linux configured pass claimed. Static648+16unknown prechange sweep must retain all plus explicit/new web test in final union, normalized tier dispositions/actual receipts. No C1–C5 verified; C2 failed. Fresh consolidated corrected-head source review before verify; affected native evidence only through authorized slot, fullT3/T4/after-stageQA separate. Reviewer performed read-only source/Git/evidence inspection only.

Criteria: C2 failed (Extra signin:true on public web login.add selects internal renewal and can run Claude against an existing Codex login; pinned injected probe confirmed wrong preparation/native harness and polluted intent.).

### impl-1824 · 2026-11-12T10:29:07.078Z

Source review rev-37-1824-source-1 fixed in f6495d25d: add-input projection with two red→green extra-field controls; frozen HOST/LOGIN usage row migration preserving formatting; login-list selective web migration retaining session/gateway/local refusals; matching docs and historical QA disposition. Expanded rule-20 consumer union includes new web-hosts-authority, frozen commands/exports and cli-usage-fixture consumers (cli-help, cli-command-help, cli-usage-compatibility, cli-usage-merge, session-usage, session-native-lifecycle, opencode-native), login-list guide and E-1535 stage-4 QA checks. CLI-help and injected fixtures exercised; native session/opencode lifecycle semantics are unchanged and their full lifecycle execution is deferred to integrated T3 occasions, not claimed passed. New fixtures remain exact compatibility assertions; prior wire-shaped login list comparison remains.

### rev-37 · 2026-11-12T10:31:19.073Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1824-source-2
commit: f6495d25d6a60918baea6fa390d466bd8fdb06df
scope: full
findings: [{"severity":"low","text":"Old blanket-refusal case sample0.187904 was transferred to the renamed changed selective-authority body without new measurement provenance (confirmed97671801). Remove obsolete sample or use an already captured matching measurement; no provenance-only rerun. Advisory reporting only.","file":"hub/test/durations.json","line":11612}]
finding_counts: {"high":0,"medium":0,"low":1}

Corrective source CLEAR with1low advisory timing finding; all4 source-1 findings resolved. Public web add projects declared fields; only explicit login.signin derives renewal/harness from stored row. Existing-name and fresh-add hidden-field regressions retain row/harness and exact intent/publication/final-ready assertions. Frozen HOST/LOGIN usage rows migrated only, exact-export/Git merge guard preserved. Old login-list policy now selective web while retaining gateway/session/still-local/key refusals and previous-shaped list comparison. Matching guides/auth updated; QA old checks pinned as historical9c98a5747 with current replacements. Sole new low: unsupported old timing transferred to renamed changed body, confirmed by lead; report-only baseline affects no functional gate. A-18996 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18996-t-1824-corrective-source-clear-with-advisory-timing-finding.md) records assessment/limits. Lead reports53 lower-tier same-head passes and native4/4; corrected cland-h delta+4 retained, no global-cleanup claim. A-18989 remains ancestor evidence. No C1–C5 verified; exact-head configured and final case/file/conservative-consumer reconciliation pending. Lead plans obsolete-sample removal: changed head needs fresh source review before verify; no provenance-only rerun requested. FullT3/T4/after-stageQA separate. Reviewer read-only inspection only.

### rev-37 · 2026-11-12T10:32:13.896Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1824-delta-1
commit: d2e31fa508bde9f1bfbc18dea2f741cd173aa598
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source metadata delta CLEAR, Standards0/Spec0. Complete diff from f6495d25d exactly removes the obsolete0.187904 selective-authority test baseline. Independent parsed JSON comparison confirms no other key/value, allowance, budget or policy change; all source/test-body/fixture/docs/native bytes equal. A-18996 low finding resolved. Native4 remains actual f6495d25d execution with qualified byte-equal support, not a fresh d2e31fa50 claim; no provenance-only rerun requested. Branch tip matches reviewed head. No C1–C5 runtime verification; exact-head mode-free configured verify and final actual case/file/conservative-consumer reconciliation pending. Remaining fullT3/T4/after-stageQA separate. Reviewer read-only Git/JSON inspection only.

### impl-1824 · 2026-11-12T10:58:48.486Z

Configured Linux run b9c74923-3b45-47ff-962b-acc010506075 at d2e31fa50 passed T0/T1/T2/Web,6195 tests,0 failures/cancellations/skips. A-19013 original log; A-19014 named-case/consumer reconciliation: all10 web cases and14 new identities with5/5 load receipts; all reached T1/T2/Web files have recorded passing facts. Executor droplet c-8 lon1 linux x64 Node24.21.0 Neovim0.12.5; browser Headless Shell1248 Google Chrome for Testing156.0.8078.4. Budget/test lint report-only, timing overruns advisory. Linux T3/T4 unexecuted: remaining T3 merge/integrated occasions,T4 stage/epic; local native4 at byte-equal f6495d25d recorded separately in A-18997. After-stage QA on dev remains. Awaiting final Reviewer settlement; claim retained.

### rev-37 · 2026-11-12T11:02:39.220Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1824-evidence-1
commit: d2e31fa508bde9f1bfbc18dea2f741cd173aa598
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final CLEAR; Standards0/Spec0; C1–C5 verified. Independently streamed A-19013/runb9c74923:6195 base cases/684 base files all pass,195 separate load-test/195 load-file passes, no negative/skipped/cancelled completions. Exact head/branch and recomputed canonical tree967ff1eb2742a1b2c66e5001001fa1d16a35941e match; cached:null. Checked all106 named saved facts and14 new identities base+5/5 receipts, including10web,2webstop,policy and migrated login-list. Source projection/consumer/docs/baseline findings resolved. C1 same handlers/provider receipts/exited fake session; C2 durable code-card reply and hidden-field controls; C3 web handle/ready observations plus unchanged native-owner support; C4 selective admin/local/session/remote boundaries; C5 all6 actions' transport user ids in audit+independent journal reads. A-18997 native4 and53-case corrected group (incl native Git guard2) actually ran at byte-equal parentf6495d25d, not final-head execution; A-18998 runtime equality and A-19015 original synchronous producer/tool exit0 excerpts checked. Merged-stream/no native PID/signal/separate-stream limits retained. hc/ct names unchanged,4cland-h additions left, no global-cleanup claim. A-19016 conservative732 paths includes original664+all69explicit+changed;675 manifest tests normalize36T1/341T2/52Web current case+file passes,232T3/14T4 unexecuted configured (extra explicit login-terminal retained beyond graph-only231T3). Parent native subset separate; no graph membership upgraded to execution. Linux x64kernel147 dropletc-8lon1/Node24.21/Nvim0.12.5/isolatedHeadlessShell1248 Chrome156.0.8078.4; T0/allT1/fallbackallT2/Web complete, no configuredT3/T4. Report-only advisories retained; lifetime1410s/cost0.0979 executor accounting only. FullremainingT3/T4/affectedafter-stageQA separate. Full map/limits A-19017, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19017-t-1824-final-c1-c5-evidence-and-conservative-consumer-review.md. Reviewer read-only inspection only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1824 · 2026-11-12T12:11:42.292Z

Landing batch abfc5334-4f5e-4f41-a12d-5d0166544704/run ec150310-2c2c-4597-ba6d-30c6346a4bc5 failed T3 after T0/T1 passed. Exact A-19029 failures: daemon.test.ts at344 and509 and tracker.test.ts at97, all AssertionError actual undefined versus expected true. Partial receipt3588 tests:3580 pass,3fail,5skip. Reported as shared-defect candidate to lead T-1824; diagnosis held pending Coordinator disposition/shared fix. Reviewed task head d2e31fa50 unchanged and claim retained; no rerun or dev merge.

### coord · 2026-11-12T13:03:30.443Z

Merged 686ec94f494ed03986c06fdc1489384b048c10fb onto dev.
