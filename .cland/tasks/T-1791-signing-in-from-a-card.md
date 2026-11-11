---
id: T-1791
kind: task
title: Signing in from a card
state: open
status: review
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1775
  - T-1785
  - T-1790
  - T-1815
topic: topic-1480
branch: t/T-1791-signing-in-from-a-card
created: 2026-11-09T12:44:12.172Z
updated: 2026-11-11T20:14:05.066Z
---

## Summary

The web, Neovim and the remotes sign a login in through cards the hub raises. Answering "Create one" or "Sign in again" makes the hub run the harness's own sign-in on a pool host and raise a card with its link and code. For Claude Code, which prints a link and takes a pasted code, the card's free answer carries the code back to the sign-in prompt; Codex's device code needs nothing back. On success the hub snapshots the disk and marks the login `ready`, and every card folds.

## What to build

A sign-in run by the hub on the host, behind the sign-in runner seam T-1777 introduced:
- **Running it.** The run uses either an agent spawn with an input pipe and captured output, or the hub's own `ssh -tt`; the implementer chooses, and the review checks it.
- **The card.** Per-harness patterns read the link and code from the output, and the `login-signin-code` card carries them. For Claude Code its free answer is marked secret.
- **The answers.** T-1785's "Create one" creates the login as `login add` does and signs it in. T-1789's "Sign in again" signs in in place, as `login signin` does.
- **Limits.** A sign-in has 15 minutes on the hub clock, after which its card is withdrawn and the login is `signed-out`. No step runs a logout.

## Acceptance criteria

- [ ] C1. Answering "Create one" on the test messenger creates a login of that harness and pool and raises a card with the fake sign-in's link and code (test).
  - failed: rev-35 [reviewer] · 2026-11-11T18:46:01.494Z · note Uncertain Create one path lacks the approved captured login/host unknown-outcome notice/card cut; real native integration is separately pending.
- [ ] C2. For the fake Claude Code, the card's free answer reaches the sign-in prompt's input, and the login reads `ready` with one snapshot (test).
  - failed: rev-35 [reviewer] · 2026-11-11T18:46:01.494Z · note Malformed no-exit close can authorize cleanup, and fail-fast owner shutdown does not join every input/native writer.
- [ ] C3. For the fake Codex, the login reads `ready` when the device sign-in finishes, with no answer on the card (test).
- [ ] C4. Answering "Sign in again" re-runs the sign-in on the login's host and volume, and the sign-in card folds on both remotes (test).
- [ ] C5. The pasted code appears in no log line, journal record, history row or remote outcome line (test).
  - failed: rev-35 [reviewer] · 2026-11-11T18:46:01.494Z · note A first-seen code can enter serialized Gateway metadata in clear because no trusted pre-serialization secret-card classifier exists; pre-registered sentinel tests miss it.
- [ ] C6. A sign-in not finished within 15 minutes of hub-clock time withdraws its card and leaves the login `signed-out` with its volume kept (test).
  - failed: rev-35 [reviewer] · 2026-11-11T20:09:42.062Z · note Code card stays visibly open at hub-clock expiry while cancellation is held; immediate withdrawal must be independent of close-gated state/disk settlement.
- [ ] C7. On a messenger whose adapter can delete messages (the test messenger declares it), the human's message carrying the pasted Claude Code code is deleted after the hub reads it; where it cannot be deleted, the hub sends one line saying so (test).
  - failed: rev-35 [reviewer] · 2026-11-11T18:46:01.495Z · note Deletion/fallback has no durable captured-ingress obligation or independent recovery after acknowledgement; cleanup joins can short-circuit.

## Blocked by

- T-1775
- T-1785
- T-1790

## Notes

- Hot files: `hub/src/host/login-signin.ts` (the runner seam), `hub/src/host/login-card-signin.ts` (new), `hub/src/host/login-cards.ts`, and `hub/src/host/agent/server.ts` if the agent route is chosen.
- Tests: new `hub/test/login-card-signin.test.ts` (T3: a fake host's agent, the fake binaries, the test messenger).
- Serves epic C7. Sized M at the upper edge: if the runner seam needs its own agent operation, split it out as an S ticket before this one. See question 13 on the pasted code.

## Comments

### impl-1791 · 2026-11-11T18:15:01.142Z

Runner contract agreed in topic-1482; prerequisite T-1815 owns Host.signIn (stdin, bounded output, exact native close). Building injected card owner first as Coordinator directed. Rule-20 initial inventory: production suite-import-graph over all 943 hub/web/Neovim test roots reaches 769 plus 14 unknowns counted reached; explicit card-kind, runner-symbol, secret answer and native consumer searches also cover production, fixtures, QA briefs, docs and shipped skills. Full names/unknown reasons in the topic's runner-card boundary artifact. Existing CLI plans, client frames and LoginRecords/Binder/Snapshots owners stay shared. Pending shared policy decision: secret code registration currently rewrites native answer replays through gateway input redaction; proposed authenticated secret-answer exception plus receipt-bound remote deletion. Two injected T2 component cases green on macOS Node 24.21.0; no native or suite evidence yet.

### impl-1791 · 2026-11-11T18:24:03.274Z

Rule-20 sweep extension for Coordinator-approved identity/deletion policy (decisions in topic-1480): Gateway captures raw answer before redactFrame only in an ephemeral sixth Conversation.receive argument; Dispatcher validates a stored secret hub card before using it, and uses the existing native messageId for secret replay identity. TelegramPrompts moves secret checkpoints to chatId/messageId, retaining the previous nonsecret digest reader. All frame, diagnostic and persistence outputs stay redacted. Native-deletion effect follows the durable gateway.answer receipt and is keyed by captured RemoteIngress; optional Remote deleteMessage/secretAnswerNotice methods preserve previous adapter shapes. Consumers being migrated: gateway.ts, dispatch.ts, hub-cards.ts, daemon.ts, telegram-prompts.ts, Telegram/Discord adapters and API leaves, fakes/messenger.ts, hub-cards regression name/docs, new remote regression; production suite transitive scan will be rerun against this final path set. Existing socket/web/Neovim frames are unchanged.

### impl-1791 · 2026-11-11T18:36:36.532Z

Initial source review at pushed 304b57dfa, explicitly staged by Coordinator: injected runner only; all C1-C7 native/final marks remain incomplete. Final staged-path rule-20 graph covers 945 hub/web/Neovim roots: 680 reached plus 15 unknowns conservatively reached, full names/reasons and explicit production/QA/native consumers in the source-evidence artifact in topic-1480. Approved Dispatcher registration/extraction/shutdown scope is included: runLoginSignIn installed once after LoginCards defaults, one shared #prepareLogin with existing host pin, owner.stop before disk owners; daemon/server/harness forward the optional injection. Existing CLI extraction regressions passed 25/25. Native integration, T-1794 hook preservation, new native file, fresh delta review, local native slot and mode-free verification follow the Coordinator's authorized merge after T-1815 lands. No criteria or ready claim yet.

### rev-35 · 2026-11-11T18:46:01.495Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1791-source-1
commit: 304b57dfa64850338dd809d40a48bfe2fccdbad1
scope: full
findings: [{"severity":"medium","text":"Standards rule15 and Coordinator1d195095/430b5433, SpecC5: first-seen secret text/reason is still serialized in the Gateway frame. Capturing answerInput does not remove metadata.text/reason before JSON.stringify; remoteRedactor cannot hide a fresh arbitrary code before registration. The new replay tests pre-register the sentinel and mask this path. Lead2060c790 confirms no trusted pre-serialization classifier. Classify from the hub's stored secret-card identity, suppress those fields before serialization while still calling redactFrame, keep raw data only in the one-call argument, and independently revalidate in Dispatcher. Add non-preregistered first-delivery frame/memory-record scans and retain ordinary-handler/replay controls.","file":"hub/src/remote/gateway.ts","line":149},{"severity":"high","text":"Standards rule12 and SpecC2/C6/C7: LoginCardSignIn.idle/stop uses fail-fast Promise.all for admitted native/input work; Gateway.stop likewise uses Promise.all for #secretWork inside attempt. One rejection allows Dispatcher shutdown to proceed to release/snapshot owners or adapters/storage while another native/input/deletion writer is still held. Leadd1e2ef94 confirms no separate drainage owner. Attempt and observe every admitted join, including work added during settlement, before propagating failures or disposing dependencies; add held-second-writer plus first-failure shutdown regressions for both owners.","file":"hub/src/host/login-card-signin.ts","line":130},{"severity":"medium","text":"Standards rules9/25/26 and SpecC7: durable cleanup state stores only pending/done under a hashed inputId; captured native ingress exists only in Gateway memory, and the success reply is delivered before the cleanup effect is scheduled. A crash after answer/offset acknowledgement strands deletion/fallback with no independent recovery owner. Leadd1e2ef94 confirms. Persist exact captured ingress and cleanup obligation atomically before acknowledgement, without code text/hash, then use an indexed bounded startup/retry owner independent of native update replay. Keep deletion/keyed fallback idempotent and add crash/reopen/retry controls.","file":"hub/src/remote/secret-answer.ts","line":17},{"severity":"medium","text":"Standards rules9/25 and SpecC2/C6: the card owner validates only close state/admission, so null code plus null/empty signal can authorize complete(null) and disk cleanup without a native exit fact. Leadb99d2dbe confirms the boundary relies solely on the runner. Defensively validate concrete code or nonempty native signal (using the final shared T1815 receipt parser once integrated), interrupt on malformed facts and add injected malformed-close controls; an injected type assertion is not a receipt.","file":"hub/src/host/login-card-signin.ts","line":117},{"severity":"medium","text":"Standards rule23: all accepted intents are serialized in one JSON meta value, synchronously parsed/Object.entries-scanned on construction and fully parsed/rewritten on each mutation. Active-only does not enforce cardinality or work bounds. Leadb99d2dbe confirms no indexed bounded owner. Use indexed admission records and paged/checkpointed recovery off synchronous startup, sharing in-flight work; test retained/active-intent work-count bounds while preserving no native replay.","file":"hub/src/host/login-card-signin.ts","line":32},{"severity":"medium","text":"Standards rules15/28 and test-level policy: the new replay test expansions provide only hub fake process facts to projectHub, omitting explicit droplet/spend-lock fake processes. Leadb99d2dbe confirms no outer owner supplies them. Give both process seams explicit fake facts and the shared hub clock, as the injected renewal test already partly does; retain complete T2 isolation.","file":"hub/test/login-card-signin-remote.test.ts","line":24},{"severity":"medium","text":"Standards rule12: new projectHub cases register borrowed Store.close and explicit Gateway.stop as late raw t.after callbacks after tempProject's owned-root hook. Their writer/storage/root dependency order is not guaranteed, including setup/close rejection; injected renewal also has late borrowed Store close. Leadb99d2dbe confirms. Prearm shared staged owners at allocation, join Gateway/hub before Store and directory disposal, attempt all safe joins and retain roots on incomplete drainage; add adverse setup/failing-close controls.","file":"hub/test/login-card-signin-remote.test.ts","line":25},{"severity":"medium","text":"Standards rule17: renamed secret replay case moves the historical0.122044 sample from digest behavior onto the changed message-identity checker with no measured binding or approved migration. Leadb99d2dbe confirms. Remove the transplanted baseline rather than attribute old measurement to changed identity; let the normal verification producer establish a new sample.","file":"hub/test/durations.json","line":11528},{"severity":"medium","text":"Spec conservative-cut decision ee8fce50: unknown Create one outcomes retain creating row and mounted disk, but current generic withdrawal/notice and input-only intent cannot name the admitted login and host after hub death. Lead9f98b5c5 confirms correction needed. Capture those nonsecret identities durably before native admission; withdraw with 'sign-in outcome unknown' and emit one Agents line naming login/host on uncertainty/recovery. Keep disk untouched and add no cleanup/second fence; shared CLI/card recovery explicitly belongs to T1814. Add the approved retention/notice regression and conditional docs.","file":"hub/src/host/login-card-signin.ts","line":127},{"severity":"medium","text":"Standards rules16/20: current QA replay selectors/source guards still require the old digest case title and 'const digest = core.cards.answerDigest...' policy (also lines158/190/624). Inventory names this brief without a concrete migration. Lead1fb8c49e confirms no historical/pinned disposition covers them. Migrate current replay commands and source-policy checks to message identity/no-secret-hash, while explicitly preserving actual old-head receipts as historical; do not silently reinterpret past evidence.","file":"qa/briefs/E-1535-stage-1.md","line":396}]
finding_counts: {"high":1,"medium":9,"low":0}

A-18842 complete initial injected source1 NOT CLEAR:1high/9medium. Confirmed first-delivery cleartext frame bug (2060c790), fail-fast native/input/deletion joins, missing durable ingress cleanup recovery, no-exit close acceptance, unbounded intent JSON startup, missing T2 droplet facts and late borrowed Store/Gateway teardown, transplanted0.122044 baseline, unknown Create one named-cut gap, missed current QA selectors/source guards. Coordinator2ee94f81 initial injected review authorized; realT1815 binding/native file and T1794 hook integration future delta, not misreported as existing proof. ee8fce50 explicitly defers new-login recovery toT1814 but requires retained creating/mounted disk, named login/host unknown line/card; no second cleanup/fence. Approved dispatcher extraction/raw-sidechannel scope retained. A18823/36 are narrative/raw reach; honest producer excerpts/conservative normalized tier dispositions being preserved, not yet final evidence. No native/configured run or criteria verified; C3/C4 remain unverified for integration. Clean fixed head/read-only review; no Reviewer experiments. Hold released for consolidated fixes/fresh committed source review, no provenance-only reruns or unauthorized dev merge.

Criteria: C1 failed (Uncertain Create one path lacks the approved captured login/host unknown-outcome notice/card cut; real native integration is separately pending.), C2 failed (Malformed no-exit close can authorize cleanup, and fail-fast owner shutdown does not join every input/native writer.), C5 failed (A first-seen code can enter serialized Gateway metadata in clear because no trusted pre-serialization secret-card classifier exists; pre-registered sentinel tests miss it.), C6 failed (Timeout/stop closure validation and all-writer drainage are incomplete; new-login uncertainty must retain mounted creating resources with the approved named outcome.), C7 failed (Deletion/fallback has no durable captured-ingress obligation or independent recovery after acknowledgement; cleanup joins can short-circuit.).

### impl-1791 · 2026-11-11T19:59:26.862Z

Consolidated source2 pushed at cc99293493069b647a4185b7ed402bc86dd36420 (tree ede16dd5c26c7a27d11e16aec6af7f9dba4841e4), addressing all ten A-18842 source1 findings plus the approved card-specific outgoing link exception (decision f861d497). A-18873 contains exact-head retained producer streams/argv/code/signal,25 named new cases,287/287 targeted T2, named static checks, source1 finding dispositions and explicit staged/native limits. Test lint remains report-only122findings/59files/0refusals. Production publication scan positive control succeeded; all11 declared output files scanned,0matches. cf0af1975 T2/T1/static receipts are preserved as prior evidence; A-18843 remains honest earlier transcriptions, never promoted to exact-head evidence.

Rule20 supplement: production transitive graph covers all954 normalized manifest roots,776reached+14unknown(counted reached); union791 retains every prior broad Host candidate and explicit consumer. A-18873 consumers.md gives every root its local-executed/planned-native/deferred-tier disposition. Exact symbol/kind/field sweep lists producer login-card-signin.ts + shared parser/origin policy login-signin-output.ts; stored HubCards.signInLink reader; daemon lookup installation; Gateway/shared registry; scoped signin-link.ts; unchanged generic redaction/old caller fallback; owner/remote/recovery cases and docs. New parsed payload fields are additive internal stored metadata, no wire/client/permission/agent-leaf change. Existing Gateway/Dispatcher/Telegram raw-answer and QA replay migrations remain in A-18843 and source2 findings map. Unknown Create one retains the approved T-1814 cut. The shared #prepareLogin extraction remains unchanged (T-1817 separately filed). Await Coordinator-directed dev merge for T-1815/T-1794 integration, then delta source review and native/verify. No native file, browser, Linux verify, fullT3 or T4/QA receipt claimed; C1–C7 remain unmarked.

### rev-35 · 2026-11-11T20:09:42.062Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1791-source-2
commit: cc99293493069b647a4185b7ed402bc86dd36420
scope: full
findings: [{"severity":"medium","text":"Expiry deactivates input but leaves the code card visibly open until native cancellation settles; the new T2 at login-card-signin-owner.test.ts:163 asserts that wrong boundary. Coordinator aa785a51 requires immediate withdrawal with 'sign-in timed out; closing', then cancellation, while login/disk ownership stays unchanged until matching close. Add immediate-withdrawal, subsequent-input-refusal and held-close ownership controls.","file":"hub/src/host/login-card-signin.ts","line":106}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete source2 full pass: A-18879. All ten A-18842 source1 findings are addressed in source. Exact cc9929349/tree ede16dd5 clean; A-18873 independently checked 287/287 positive targeted T2 cases, all25 named controls, recorded native code0/signalnull/no truncation for five producers. Consumer table954 unique roots/conservative791 preserves prior paths. This is the approved injected stage only: real T1815/T1794 integration and directed native/configured evidence remain later; no new criterion verification or readiness. One medium timeout visibility finding remains under Coordinator aa785a51 and lead57643a2a. Full pass complete; release hold for correction, then fresh committed source review.

Criteria: C6 failed (Code card stays visibly open at hub-clock expiry while cancellation is held; immediate withdrawal must be independent of close-gated state/disk settlement.).

### impl-1791 · 2026-11-11T20:12:30.605Z

Source3 timeout correction pushed1920ed2d11aaa9f6ea08346a38cc600c7c982333/tree356e70fe044bc47cccfc9b10c9f0e32f38cdec97. Addresses A-18879's sole remaining medium under aa785a51: expiry disables input, immediately withdraws with exact 'sign-in timed out; closing', then native cancel; login state/disk ownership wait for matching close. T2 shown RED(open vs withdrawn), then exact-head25/25 owner/remote/recovery positive cases incl refusal/zero writes and unchanged exact row while held; typecheck/tier/closed-wording0, report-only lint122/59files/0refusals. A-18880 retains separate streams/argv/close facts and prior-head limits; publication positive control,3declared files0matches. Only5existing files changed; no new imports/test roots/contract consumers, so A-18873's954-root/791conservative sweep stays structurally applicable (not a source3 rerun claim). No dev merge or native/verify/criteria claim; requesting fresh source review at this injected head before authorized real-operation integration.

### rev-35 · 2026-11-11T20:14:05.066Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1791-source-3
commit: 1920ed2d11aaa9f6ea08346a38cc600c7c982333
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18881: initial injected-stage source3 CLEAR, zero standards/spec findings. Complete five-file correction resolves A-18879 under aa785a51: immediate persisted withdrawal with exact timeout reason before native cancel, refused later input/zero writes, unchanged complete login row/disk while close held, matching close permits signed-out+kept volume. Shared reference/README/per-test guide agree. All ten source1 findings remain addressed. A-18880 independently checked exact-head25/25 positive named T2 cases; five producers code0/signalnull/no spawn error/truncation; report-only lint122 findings/0refusals retained. Prior A-18873 broader287 and954-root/791 graph remain earlier-head support, not source3 execution. Head/tree1920ed2d1/356e70fe clean, one corrective commit/no dev merge. No new criterion verification, final readiness or native/configured evidence claim: Coordinator-authorized initial injected stage only. Release hold; await authorized T1815/T1794 integration, then fresh integrated-head source review before native/configured verification.
