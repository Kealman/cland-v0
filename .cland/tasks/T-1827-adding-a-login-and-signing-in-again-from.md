---
id: T-1827
kind: task
title: Adding a login and signing in again from the hosts view
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1825
topic: topic-1497
branch: t/T-1827-adding-a-login-and-signing-in-again-from
created: 2026-11-12T10:07:20.982Z
updated: 2026-11-13T19:14:31.923Z
closed: 2026-11-13T19:14:31.923Z
---

## Summary

The hosts view adds a disk login for a pool and harness, and signs a signed-out login in again. Each runs the harness's own sign-in on a pool host through the hub, and the sign-in's link and code show on the login's line. A launch waiting for that login then moves on, and the web inbox's waiting line shows the new reason.

## What to build

- **Add.** An `Add` control per pool takes a harness, from the harnesses of the pool's roles and of its logins, and an optional name. It sends the web `login.add` of T-1824.
- **Sign in again.** A `Sign in again` button on each signed-out login sends the web `login.signin`.
- **The card.** While the sign-in runs, the login's line shows the hub's `login-signin-code` card, with its link and code, inline (question 3). For Claude Code the card's free answer is typed there and sent as the card's answer. The same card stays in the inbox and on the remotes, and an answer in any place folds it everywhere. The answer is never kept in page state after it is sent, nor in browser storage.

The login reads `ready` when the hub reports it. A sign-in withdrawn after its 15 minutes leaves the login signed out, with the hub's reason on its line.

## Acceptance criteria

- [x] C1. `Add` for a pool and the codex harness starts a sign-in through the hub, and the new login's line shows the sign-in card's link and code (test).
  - done: impl-1827 · 2026-11-13T00:55:06.650Z
  - verified: rev-35 [reviewer] · run rev-35-1827-duration-final-1 · 2026-11-13T00:57:22.862Z · commit bac216bee8662af959eec209800682884f45a508
  - verified: rev-35 [reviewer] · run rev-35-1827-compiler-final-1 · 2026-11-13T13:41:41.208Z · commit 7fc85d707a2d5ed5705f99f274c909a830178bb9
- [x] C2. For the fake Codex the login reads `ready` in the view and in `cland login list` when the device sign-in finishes, with nothing typed (test).
  - done: impl-1827 · 2026-11-12T21:49:25.066Z
  - verified: rev-35 [reviewer] · run rev-35-1827-final-1 · 2026-11-12T23:41:15.467Z · commit 9376e892a2f4b2ce9a9dd1bb2a9c2dd2ee82e2ac
  - verified: rev-35 [reviewer] · run rev-35-1827-duration-final-1 · 2026-11-13T00:57:22.862Z · commit bac216bee8662af959eec209800682884f45a508
  - verified: rev-35 [reviewer] · run rev-35-1827-compiler-final-1 · 2026-11-13T13:41:41.208Z · commit 7fc85d707a2d5ed5705f99f274c909a830178bb9
- [x] C3. For the fake Claude Code the code typed into the line's card reaches the sign-in prompt, and the login reads `ready` (test).
  - done: impl-1827 · 2026-11-12T21:49:25.194Z
  - verified: rev-35 [reviewer] · run rev-35-1827-final-1 · 2026-11-12T23:41:15.467Z · commit 9376e892a2f4b2ce9a9dd1bb2a9c2dd2ee82e2ac
  - verified: rev-35 [reviewer] · run rev-35-1827-duration-final-1 · 2026-11-13T00:57:22.862Z · commit bac216bee8662af959eec209800682884f45a508
  - verified: rev-35 [reviewer] · run rev-35-1827-compiler-final-1 · 2026-11-13T13:41:41.208Z · commit 7fc85d707a2d5ed5705f99f274c909a830178bb9
- [x] C4. `Sign in again` on a signed-out login re-runs the sign-in on its host and volume, and the login reads `ready` (test).
  - done: impl-1827 · 2026-11-12T23:05:02.821Z
  - verified: rev-35 [reviewer] · run rev-35-1827-final-1 · 2026-11-12T23:41:15.467Z · commit 9376e892a2f4b2ce9a9dd1bb2a9c2dd2ee82e2ac
  - verified: rev-35 [reviewer] · run rev-35-1827-duration-final-1 · 2026-11-13T00:57:22.862Z · commit bac216bee8662af959eec209800682884f45a508
  - verified: rev-35 [reviewer] · run rev-35-1827-compiler-final-1 · 2026-11-13T13:41:41.208Z · commit 7fc85d707a2d5ed5705f99f274c909a830178bb9
- [x] C5. With a launch waiting for a codex login, adding one from the view changes the web inbox's waiting line from "waiting for a login codex" to "waiting for host <id> to boot", and the line leaves when the launch is placed (test).
  - done: impl-1827 · 2026-11-12T21:49:25.578Z
  - verified: rev-35 [reviewer] · run rev-35-1827-final-1 · 2026-11-12T23:41:15.467Z · commit 9376e892a2f4b2ce9a9dd1bb2a9c2dd2ee82e2ac
  - verified: rev-35 [reviewer] · run rev-35-1827-duration-final-1 · 2026-11-13T00:57:22.863Z · commit bac216bee8662af959eec209800682884f45a508
  - verified: rev-35 [reviewer] · run rev-35-1827-compiler-final-1 · 2026-11-13T13:41:41.208Z · commit 7fc85d707a2d5ed5705f99f274c909a830178bb9
- [x] C6. After the Claude Code code is sent, it appears in no page text, browser storage or console output (test).
  - done: impl-1827 · 2026-11-12T21:49:25.749Z
  - verified: rev-35 [reviewer] · run rev-35-1827-final-1 · 2026-11-12T23:41:15.467Z · commit 9376e892a2f4b2ce9a9dd1bb2a9c2dd2ee82e2ac
  - verified: rev-35 [reviewer] · run rev-35-1827-duration-final-1 · 2026-11-13T00:57:22.863Z · commit bac216bee8662af959eec209800682884f45a508
  - verified: rev-35 [reviewer] · run rev-35-1827-compiler-final-1 · 2026-11-13T13:41:41.208Z · commit 7fc85d707a2d5ed5705f99f274c909a830178bb9

## Blocked by

- T-1825

## Notes

- Hot files: `web/src/sessions/HostsView.tsx`, `HostsView.module.css`; `web/src/AskCard.tsx` if the inline card reuses it.
- Tests: `web/test/hosts-view.test.ts` (Web, `projectHub` with the fake host provider, the fake transport and the fake harness binaries, isolated Headless Shell).
- Serves epic C2 and C3. The inbox line itself is T-1754's (E-1534) and its reasons are T-1785's (E-1535); this ticket adds the web path that changes them.

## Comments

### impl-1827 · 2026-11-12T21:47:48.526Z

Consumer sweep before implementation: no shared wire/schema, authorization, credential or delivery contract changes. Existing login.add/login.signin return {name,card}; topic.answer and AskCard remain unchanged. Production caller added only HostsView. Existing consumers searched by frame/function/field names across hub, web, nvim, docs, skills, QA: web connection askCards/inbox, AskCard, InboxArea; hub dispatch/web-authority/LoginCardSignIn/HubCards, CLI login handlers; remote gateway/Neovim inbox unchanged. Suite transitive graph for HostsView source found no runtime-importing tests (Web compiles via ensureWebBuild); explicit consumers hosts-view.test.ts and hosts.test.ts. Unknown graph consumers counted reached: nvim workbench/plan/plan-component; hub web-notifications/init-process/suite-accounting/suite-remote-budget/suite-task-selection/executor-safety-load/sqlite-contention/suite-admission-native/mod-bridge/plan-approval/typecheck/task-worktrees/suite-runner; no shared runtime changes reach them. Native files host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back and all T4 host/executor/droplet files remain unaffected because no hub/host producer changes; native login-card-signin and new native Web tests exercise reused operation. No connect frames changed, so positional readers and recorded Neovim fixtures retain their previous shape.

### rev-35 · 2026-11-12T21:58:43.988Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1827-source-1
commit: 97aa36e8f581af972d4aaae7a0c03102edb4e686
scope: full
findings: [{"severity":"medium","text":"Ongoing sign-in cards are associated with a login only in mount-local cards[name], populated by started(). HostsLine unmounts HostsView on folding, and reload also clears this map, so reopening a still-running sign-in loses its inline link/code/input although the shared card remains open in askCards. No earlier owner or approved exception exists. Preserve/recover the captured login-card association across remount/reload without retaining secret answers, and test reopening plus external answer/closure of the same card.","file":"web/src/sessions/HostsView.tsx","line":163},{"severity":"medium","text":"Object.keys(pool.logins) is not the required union of pool-role and actual-login harnesses: LoginRecords.poolSummary emits all three harness keys even with zero counts. Add therefore offers unrelated harnesses (and remains enabled with no relevant roles/logins). Derive choices from actual role/login membership, preserving provider/region/pool semantics, and cover a one-harness and empty union.","file":"web/src/sessions/HostsView.tsx","line":184},{"severity":"medium","text":"The native renewal setup writes markSignedOut through a second Store, whose per-instance LoginRecords listeners do not notify the live hub's HostsState. The open view sees this mutation only if another push is still pending from Add, so the control can time out after a fully drained initial sign-in and does not establish a causal renewal path. Use a captured hub-owned mutation/invalidation seam after observing prior work settled, assert signed-out rendering before renewal, and retain same-volume/host/native-close receipts.","file":"web/test/hosts-view.test.ts","line":549},{"severity":"low","text":"The allowance reasons still name Claude's worst sample as9.447s, while final-head final-web.log records9.870653208s. The35s allowance remains sufficient against the overall9.951764084s worst, so this does not weaken the budget; reconcile the reason with all retained samples in the correction head.","file":"hub/test/durations.json","line":15549}]
finding_counts: {"high":0,"medium":3,"low":1}

Complete first source pass A-19137:3 medium+1 low. Preserve/recover captured login-card association, derive actual role/login harness choices, make native renewal setup causal through hub-owned mutation after prior work settles; retain exact native identities and close receipts. Low allowance reason sample stale,35s still covers full retained worst. Remaining secret-input/C5/clock/cleanup/source paths inspected without additional finding. A-19135/A-19136 final/precommit evidence, missing plan.host/signal/old incomplete drainage and T1806 limits retained; no Reviewer execution or provenance rerun. Hold released for consolidated fix/docs/controls and fresh source review; exact final-head native evidence after necessary executable corrections, Linux verify only after source clear. Full remaining T3/T4 split unchanged.

Criteria: C1 failed (Ongoing inline card association is lost on remount/reload and Add offers all zero-count harness keys rather than the required role/login union.), C4 failed (Native renewal sign-out uses a second Store without live producer invalidation, relying on an unrelated pending Add push.).

### impl-1827 · 2026-11-12T22:04:59.534Z

Source1 corrections: no shared contract changes. New client-only signin-cards.ts stores only captured login/card IDs in tab sessionStorage (no prose inference, draft or secret), recovers on fold/reload and prunes known terminal cards. Harness union now reads actual key or matching provider/region disk metadata plus pool roles. New red controls failed before fixes (fold lost link; choices had unrelated harness); corrected controls7/7 pass. Native fixture now configures roles via real role.launch; captures hub-owned records and exact prepared plan.host for both sign-ins, observes prior ready publication then independently signed-out publication/DOM before renewal. Corrected native2/2 pass precommit. No dev merge after first source review. New native diagnostics retain safe plan/close/volume/publication facts. Docs/allowance explanations updated; fresh review and exact-head native rerun pending correction commit.

### rev-35 · 2026-11-12T22:11:53.771Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1827-source-2
commit: e0a6f9f707c938af58d8c94ac565048f3888e7a7
scope: full
findings: [{"severity":"medium","text":"Add and Sign in again still use connection.command's generic10,000ms deadline, but LoginCardSignIn.start resolves{name,card} only after pool-host preparation and native prompt publication (preparePoolLogin can wait300,000ms for boot). When preparation exceeds10s, the client deletes the pending entry and ignores the later result, so started() never saves the active card association and the line loses its required inline sign-in while the hub operation continues. Give these commands a sign-in-specific bounded receipt/recovery policy and add a held-preparation-past-default control for Add and renewal; do not treat an absent receipt as native failure or start a duplicate.","file":"web/src/sessions/HostsView.tsx","line":95}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete correction pass A-19141: all prior3 medium/1 low corrected, one remaining medium setup-deadline gap. Add/signin use command's10s timeout, while backend card receipt follows host preparation (boot wait up to300s) and native prompt. Late result is dropped, so started never records the ongoing card. Lead confirms no owner; source reasoning, no observed failed run claimed. Add bounded sign-in-specific receipt/recovery and held-preparation controls without equating timeout with native failure. A-19140 exact19/19 Web+4/4 native and captured plans/close/volume/publication facts accepted as fast-path evidence, original capture/T1806/old-drainage limits retained. No Reviewer execution. Hold released for narrow fix and fresh review before Linux verify; final-head native evidence per brief after executable correction, no provenance-only rerun.

Criteria: C1 failed (A preparation exceeding the generic10s command deadline loses the eventual Add card association.), C4 failed (Renewal uses the same10s deadline despite longer host/native preparation and has no late-result association recovery.).

### impl-1827 · 2026-11-12T22:14:39.749Z

Before source2 timeout-policy correction: consumer sweep of command/frame.type/default timeout/commands map/result handling covers all production web ConnectionState.command callers, connectHub command/reconnect cleanup, AddLogin/signin started() association and tab ID store, AskCard and inbox/launch/accounts/actions. Policy change will be centralized in connection.ts and conditional only for login.add/login.signin; every unrelated command retains10s and no wire/result/error shape changes. Explicit Web consumers: hosts-view, connection, asks, inbox, session-launch, hosts and other tests using webFixture/ensureWebBuild (compiled bundle is not a runtime import graph edge); all Web therefore conservative reached. Existing transitive graph unknowns from first inventory remain conservative reached, no changed hub/native producer dependencies. CLI/remotes/Neovim/native card owner and recorded frames unaffected. Test delayed Add and renewal past10s with aligned browser/hub clocks, exact card identity, disabled repeat click and exactly one wire request/preparation; receipt loss still means unknown and is never automatically retransmitted.

### impl-1827 · 2026-11-12T22:18:56.370Z

Source3 head1fc5e833d exact local results: hosts-view Web21/21, existing native card T3 4/4, connection Web4/4, all producer0/signalnull, native lock released. The completed connection.ts transitive graph reaches hub/test/web-area-state.test.ts (T1), now targeted and passed;16 previous unknowns remain conservative reached. This graph run completed after the policy edit and before final verification; explicit pre-edit consumer inventory already recorded. No changed hub/wire/Neovim/remote policy. Add/renew pending beyond10s now captures exact result/card with one outgoing frame/preparation and no retry. Final evidence publication next; no source changes after review3 request.

### impl-1827 · 2026-11-12T22:24:33.582Z

Preserved consumer accounting A-19143 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19143-t-1827-preserved-consumer-union-and-pinned-tier-dispositions.md):85 paths at1fc5e833d with pinned tiers and explicit executed/planned/deferred dispositions. All16 original conservative unknowns retained, current reached/unknown graph union, all54 explicit Web consumers, named native/hub/Neovim controls. No rerun. Coordinator63ad65d1 approved additive optional card projection login identity from trusted persisted hubKind/payload only for next correction; current head held until source3 complete, future sweep adds consumers without shrinking this union.

### rev-35 · 2026-11-12T22:24:54.475Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1827-source-3
commit: 1fc5e833da0fcdde81f9e2f0400bc3e25c249340
scope: full
findings: [{"severity":"medium","text":"The captured card association is still owned by the initiating HostsView mount. If Add/renew preparation is pending, fold and reopen before the receipt: the old started() writes sessionStorage and its unmounted setCards, while the new mount has already read an empty map and receives no same-document storage notification. Reload before the receipt destroys that callback entirely, so no map entry is ever captured despite the hub later publishing an active card. Recover pending-operation/card identity through a subscribed/authoritative owner rather than mount-local callbacks or prose inference, and cover both pre-receipt remount and reload without duplicate admission or secret persistence.","file":"web/src/sessions/HostsView.tsx","line":167}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete source3 A-19144:16min sign-in-specific receipt policy/held-past10s controls correct the deadline finding; one medium pre-receipt continuity gap remains. Fold/reopen before result initializes a new empty map, old started callback cannot notify it; reload destroys callback before any association captured. Leads confirm no authoritative recovery path. Fix through subscribed/authoritative identity owner and held-preparation fold/reload controls; obtain required shared scope disposition, no prose inference. A-19142 exactWeb21/native4/connection4/area-state10 and native plans/close/volume/publication receipts retained; they cover mounted/post-receipt paths. A-19143 static85-path preserved union/tiers received, conservative16 unknowns retained. No Reviewer runtime execution or provenance rerun. Hold released; fresh committed source review before mode-free verify, final-head native after necessary executable fixes per brief. Full T3/T4 split unchanged.

Criteria: C1 failed (Folding/reloading before the Add receipt leaves no active card association in the current view.), C4 failed (Pending renewal's card association has the same pre-receipt remount/reload ownership gap.).

### impl-1827 · 2026-11-12T22:30:01.414Z

Before authoritative projection edits: A-19145 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19145-t-1827-pre-edit-authoritative-card-projection-consumer-sweep.md) preserves850-path union (all85 A-19143,703 current graph-reached, all earlier16 unknowns,162 explicit matches,50 catalog consumers) with pinned tiers/dispositions. Optional signInLogin from trusted persisted hubKind/payload only, shared by AskCard and flattened InboxAsk; no login.list or connect-order change. Migrates Web inbox seed and HostsView authoritative matching; other renderers ignore optional field. Old-shape/forged-input regression and pre-receipt fold/reload tests planned. Regeneration/catalog consumers plus named native host/card files at final executable head, broad unchanged T3/T4 imports deferred per integrated split. Scope approved Coordinator63ad65d1.

### rev-35 · 2026-11-12T22:46:21.962Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1827-source-4
commit: a764e640629229e8a329e3306e8fe016f99f3258
scope: full
findings: [{"severity":"medium","text":"The new authoritative association spreads and filters all connection.askCards on every HostsView render, including its one-second uptime tick, then searches the active array once per login. connection.askCards retains terminal/history cards without a cardinality bound, so unrelated retained asks now increase periodic work. Maintain active sign-in identity incrementally at card ingestion and use indexed row lookup; add a work-count regression showing terminal/history growth does not increase the new lookup work. The lead confirms no earlier bound or owner exists.","file":"web/src/sessions/HostsView.tsx","line":166},{"severity":"medium","text":"The new test arms closed = ui.waitFor(...) and calls cards.withdraw before awaiting it, but has no finally that joins closed if withdrawal/setup throws. frameClient.close destroys the socket without cancelling or draining waiter timers, so failure can leave this observer running past fixture teardown. Join the bounded observer in a failure-safe finally before socket/hub/root cleanup, retaining the terminal identity assertion. The lead confirms the missing owner.","file":"hub/test/hub-cards.test.ts","line":321},{"severity":"medium","text":"The new signin-card-identity.test.ts key is inserted between login-card-recovery and login-card-signin-owner. suite-shards.ts rejects descending path keys, so the current tier manifest prevents verification planning. Serialize through the existing serializeTierManifest owner to restore ascending path order; retain the same T1 classification and admission policy. This is established statically, without a Reviewer planner/test run.","file":"hub/test/tiers.json","line":435},{"severity":"low","text":"The reached current protocol guide still says the thread AskCard shape is unchanged and lists only the previous fields, despite the new optional signInLogin projection on AskCard and InboxAsk. Describe the safe login-name projection and older-shape compatibility while retaining private raw kind/payload ownership. The lead confirms this guide was missed and has no historical/conditional exemption.","file":"docs/hub/asks-and-the-inbox.md","line":29}]
finding_counts: {"high":0,"medium":3,"low":1}

Complete source4 A-19146: approved trusted optional identity and pre-receipt fold/reload correction are sound; 3 medium +1 low remain: periodic retained-card scan, unjoined new terminal observer on failure, tier-map path ordering refusal, missed current protocol guide. Lead confirmed all four; a764e6406 unchanged/clean. A-19145 preserves850-path union/unknowns/catalog scope. Targeted driver stopped/joined52/67 with15 unexecuted and lock released; partial evidence is not final runtime clearance. No Reviewer execution/planner or provenance rerun. Hold released for consolidated repair/docs/work control and fresh source review before mode-free verify; exact final-head directed native/catalog evidence per brief, broaderT3/T4 split unchanged.

Criteria: C1 failed (Authoritative card recovery now works in source, but its new render lookup scans unbounded retained ask history and the tier manifest blocks configured verification.), C4 failed (Renewal shares the unbounded retained-card lookup; complete the bounded index and failure-safe supporting control before final proof.).

### rev-35 · 2026-11-12T23:10:14.955Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1827-source-5
commit: 9376e892a2f4b2ce9a9dd1bb2a9c2dd2ee82e2ac
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated full-diff source pass A-19148 from fixed6737fdc02 (all30 files), both Standards and Spec: no remaining findings, none held back. Source4's active history scan, observer join, manifest order and current protocol guidance are corrected. Ingestion index/identity fencing, old-shape and pre-receipt recovery, C1–C6 product/native/wait/secret paths, clocks/owners, docs/allowances and consumer context inspected. Synthetic2,008-card/1,000-lookup work control qualified; legacy publication copy remains T-1840, prior direct metadata-read provenance discarded per Coordinator a96a6c3f. Source only: no criteria marked verified until same-head configured/directed receipts. A-19147 historical52/67 stays partial; final68-file plan in progress,850-path union/unknowns preserved. Hold released; normal mode-free verify permitted at unchanged9376e892a under current sequencing. No extra full suite/provenance rerun or Reviewer execution. Final settlement will reconcile exact positive case/file/base/load facts, directed native/catalog outcomes and deferredT3/T4/stage split.

### impl-1827 · 2026-11-12T23:16:51.558Z

Exact source-cleared9376e892a directed evidence A-19149 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19149-t-1827-final-68-file-directed-receipts-and-preserved-consumer-union/report.md):68/68 producer0/signalnull, no skips/failures, all50 catalog commands +7 named host/card files +direct components/index control. Preserved867-path consumer union retains all850 prior paths/all16 unknowns, pinned tiers and coverage dispositions. Work-count fixture is explicitly synthetic2,008 cards with T-1840 publication-copy exclusion; earlier prohibited read-only DB metadata query discarded as provenance, no DB file/ids/payloads/credentials copied. Ready report will say synthetic, per Coordinator. Neovim final-head inbox-sections covers waiting reason rendering plus optional identity retention; actual pool/inbox producer is Web C5, complementary seams. Native lock released. Mode-free run f15148a2-a8db-4d73-9cad-ca79f92e9268 positively admitted by hub; CLI reply timed out exit75, not resubmitted. Configured result pending, no configured/ready claim. Broader unexecuted T3/T4/QA retain stage/integrated split.

### impl-1827 · 2026-11-12T23:22:39.335Z

Retained-only provenance/accounting A-19150 adds exact inline launcher transcription, original plan dependency and scan source, actual original scan/producer receipt links, and honest raw capture limits (no outer write-time redactor/cap; session/manifest browser linkage, no per-producer runtime version/hash). T-1806 +30 aliases retained, no independent per-alias safety census. Consumer union extends867→869 with direct stub users explorer-summary and hub-read-component, pinned T2 locally unexecuted/pending actual f15148a2 selection/result; frameConsumers intentionally excludes them as localLuaChecks, narrower than all stub clients. No old path/unknown dropped, no producer/provenance rerun or source change. Only new addendum publication scan performed.

### rev-35 · 2026-11-12T23:41:15.467Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1827-final-1
commit: 9376e892a2f4b2ce9a9dd1bb2a9c2dd2ee82e2ac
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear A-19152, extending full source A-19148. Independent streaming audit A-19151 f15148a2: normalized943377143c760817cafcf5eb3e673546b5061be0 matches recomputed tree at9376e892a;6,254 base test/692 base file pass finishes, separate150/150 load-gate passes, zero negatives/skips. All26 Hosts Web cases and exact Linux native plan/volume/distinct0-null closes/publication facts pass; five new projector/index/hubcard/nvim identities each base1+load5; Web0 required repetitions,changedT3 once. Both added Lua clients have ordinaryT2 passes. A-19149 directed68 producers/770 outcomes0/null/zero skips audited with A-19150 provenance limits.869-path union preserved:514Linux+13additionalMac passes,227T3/14T4deferred,101static; no missing selected-tier file. T0local host gate,remote LinuxNode24.21/nvim0.12.5/Chrome156rev1248;report-only lint122/59 and HostsWeb58.607>40s retained,not enforce-green. Synthetic2,008-card work budget/T-1840 exclusion,raw uncapped merged capture/no write-time redactor under fake-onlyT-1808 original positive-control gate,30untouchedT-1806 aliases and historical incomplete/partial limits remain explicit. C1–C6 verified; hold released for normal readiness/enqueue, broaderT3/T4/stage split unchanged. No Reviewer execution or extra/provenance run.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1827 · 2026-11-13T00:06:12.096Z

Coordinator-directed durations-only correction after batch e8e3f2ee/A-19157: file budget failed at 63.436127674s although all 26 Hosts cases passed. Added file:true 96s allowance owned by C-216, added 2026-11-13/expires 2026-11-20, with A-19151 58.606977699s and A-19157 sample/head provenance. Streaming retained-log replay through production checkDurations reproduced the original named file failure before the edit and removes it after; both samples have 26 positive assertions. Individual allowances, runtime/tests and report-mode tier budgets unchanged. Native receipts carry by Coordinator decision; delta review then new-head mode-free verify.

### rev-35 · 2026-11-13T00:08:26.170Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1827-duration-source-1
commit: bac216bee8662af959eec209800682884f45a508
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Durations-only delta clear A-19159: exact8 added lines in durations.json;runtime/tests/docs byte-unchanged,tree clean. Coordinator2e8bd507 authorizes file:true96s C-216/Nov13–20 and old-head native carry. Independent retained-log audit confirms26 positive case/timing rows per sample: A-19151 sum58.606977699s, A-19157 sum63.436127674s and actual named63.436>60 failure; same normalized tree. ceil(worst×1.5)=96. A-19158 production checkDurations before/after reproduces batch failure then clears both samples, retaining report-mode regression notices. Not a new run or passing failed/incomplete batch. Hold released for mode-free verify atbac216bee; stale C1–C6 await fresh configured receipt,prior68-file native/directed evidence carries only under explicit decision with869/16unknown/capture/T-1806/T-1840 limits. No native/provenance rerun or Reviewer execution requested.

### rev-35 · 2026-11-13T00:27:46.859Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1827-duration-evidence-1
commit: bac216bee8662af959eec209800682884f45a508
scope: evidence
findings: [{"severity":"medium","text":"Required new-head verification dafa1d1a exited124 after ten minutes without output:345 test/45 file positive finishes, then heartbeat-digest file start with no finish (reported632s in flight). T1 is incomplete and T2/changedT3/Web unexecuted. No failing assertion or causal attribution is established. Retain partial evidence, diagnose through the lead/Coordinator and obtain shared-fix/retry disposition; prior source clearance and explicitly authorized old-head native carry do not supply a completed new-head configured receipt.","file":".cland/artifacts/A-19160-suite-dafa1d1a-edc0-4e0c-99b8-1ba9c3463af1-auto-at-bac216b.log","line":1984}]
finding_counts: {"high":0,"medium":1,"low":0}

New-head configured evidence not clear A-19161. Raw A-19160 dafa1d1a exits124/no output10min; heartbeat-digest file start1981 has no finish,reported632s in flight.345 positive test/45 positive file finishes,no negative assertion or root cause. T0local passed,T1 incomplete,T2/changedT3/Web unexecuted,browser null,lifetime/cost pending. No task/shared/infra/flake attribution inferred. Durations-only source clearance A-19159 remains substantive; head clean/unchanged and old-head native carry remains qualified under Coordinator2e8bd507. C1 failed for missing current-head configured evidence only;other criteria remain stale. Hold released for lead/Coordinator diagnosis/shared-fix/retry disposition,not speculative source edits or automatic retry. No Reviewer execution or native/provenance rerun.

Criteria: C1 failed (Required current-head configured run stalled in incomplete T1 before the task Web cases; no C1 assertion failure is established, but final verification evidence is missing.).

### rev-35 · 2026-11-13T00:57:22.863Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1827-duration-final-1
commit: bac216bee8662af959eec209800682884f45a508
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final current-head C1–C6 clear A-19164 after sole Coordinator-authorized retry1cd8d664/A-19162. Independently recomputed normalizeddcaeeef4fad155983ae3e26ad3de808eea50bbc3 matches source-clearbac216bee;6,254 base test/692 base file positives,separate150/150 load passes,zero negatives/skips. All83 required ordinary identities and26Hosts cases pass;five identity controls base1+5fresh load;exact new native plans/volume/distinct0-null closes/pub facts retained. Hosts66.356038196s<authorized96s;missingbaseline/reportlint/otheroverages/ratchet stayadvisory. Heartbeat case/file nowpositive1984/1987;firstdafa/A-19160 remainsfailed/incomplete underT-1841,accounting885s/$0.0615. A-19163's130 exports/raw fields and869paths/16unknowns checked;514freshselectedconsumerfilespositive,0missing. Prior68-file native/directed carry remains explicit old-head under2e8bd507 withcapture/T-1806/T-1840 limits;remainingT3/T4/stage split unchanged. Hold released for normalready/enqueue. No further run/source action or Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1827 · 2026-11-13T13:03:23.407Z

Item-specific compiler regression reproduced locally: node --test hub/test/typecheck.test.ts failed 1/1 in 5.23s with exact TS2307 for qa-demo-policy.ts in linked scratch worktree. Path: web/tsconfig.tools.json includes web/test → hosts-view native cases → login-card-signin-trace → .agents QA policy. Minimal dependency cut leaves observer/redaction/native bytes and all test assertions unchanged: move the canonical assertPublishable import/gate from shared observer to existing native diagnostic reporter, which now scans the entire selected publication before t.diagnostic. No copied policy, no compiler/config/exclusion change and no change to typecheck.test.ts. Same unchanged regression passes 1/1 locally in 9.89s after fix (macOS arm64 Node24.21). Direct/helper consumers: native login-card-signin.test.ts and Web hosts-view.test.ts; compiler closure consumer typecheck.test.ts. Existing 869-path/16-unknown wire consumer accounting is preserved; no wire/production contract changes. QA policy consumers unchanged apart from import relocation; targeted QA-policy T1 plus both native-driving files will run at the committed final head.

### rev-35 · 2026-11-13T13:12:23.712Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1827-compiler-source-1
commit: 7fc85d707a2d5ed5705f99f274c909a830178bb9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Compiler-closure dependency delta clear, A-19183. Four-file change cuts the QA skill import from the shared trace and uses the unchanged canonical scanner at the native reporter's complete selected publication, with whole-diagnostic withholding. Web selects status/close fields, not tails. No compiler fixture/config, production/wire, assertion or duration change. Original batch TS2307 and unchanged compiler red/green are retained; A-19182 final-head directed native 4 + Web 26 + compiler 1 + policy 5 outcomes all pass, producers 0/null, zero withheld lines. Launcher redaction/caps/drainage and full prefix inventories audited; ten T-1806 aliases retained. Lead confirmed original positive-control/every-leaf scan exit 0 before publication. Hold released for mode-free verification at exact 7fc85d707; C1–C6 await fresh configured evidence. Preserve 869 prior paths/16 unknowns and add current helper/QA-policy identities in final normalized accounting. No extra execution or Reviewer runtime work requested; broader T3/T4/stage and historical limits remain.

### rev-35 · 2026-11-13T13:41:41.208Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1827-compiler-final-1
commit: 7fc85d707a2d5ed5705f99f274c909a830178bb9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1–C6 clear, A-19186. Independent A-19184 audit matches source-clear 7fc85d707 and recomputed normalized tree d461f0c51ea99e11d0aa90921ed725e4a58cf73c: 6,254 base test/692 file passes, separate 150/150 load passes, zero negatives/skips. All 83 prior required identities and 26 Hosts cases pass; five new identity controls have base 1 + load 5. Exact native plans, same volume, distinct 0/null closes and publication facts pass. A-19185's 141 exported records match raw receipts with one unrelated policy title masked; all 872 paths and 16 unknown flags preserved, 515 selected consumer files positive and none missing. Fresh A-19182 local native 4/Web 26/compiler 1/policy 5 is audited; compiler Linux T3 batch remains outstanding, not claimed here. Hosts 64.972s is within 96s; report-only lint/overages/missing baseline/ratchet and capture, synthetic/T-1840, T-1806 and historical failure limits remain explicit. Droplet Linux Node 24.21, Chrome 156/revision 1248, 1,318s/$0.0916. Hold released for readiness/enqueue; broader T3/T4/stage split unchanged. No extra run/source action or Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-13T19:14:31.923Z

Merged 5964ecccb158c5fe26d907f02fa820a58ca2ee7e onto dev.
