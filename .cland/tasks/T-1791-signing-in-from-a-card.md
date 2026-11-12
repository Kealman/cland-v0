---
id: T-1791
kind: task
title: Signing in from a card
state: closed
status: done
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
updated: 2026-11-12T00:13:15.440Z
closed: 2026-11-12T00:13:15.440Z
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

- [x] C1. Answering "Create one" on the test messenger creates a login of that harness and pool and raises a card with the fake sign-in's link and code (test).
  - done: impl-1791 · 2026-11-11T23:01:59.638Z
  - verified: rev-35 [reviewer] · run rev-35-1791-final-1 · 2026-11-11T23:33:06.712Z · commit 26b09338a1fe4424330154fd14c30cad991dd4c1
- [x] C2. For the fake Claude Code, the card's free answer reaches the sign-in prompt's input, and the login reads `ready` with one snapshot (test).
  - done: impl-1791 · 2026-11-11T22:24:48.088Z
  - verified: rev-35 [reviewer] · run rev-35-1791-final-1 · 2026-11-11T23:33:06.712Z · commit 26b09338a1fe4424330154fd14c30cad991dd4c1
- [x] C3. For the fake Codex, the login reads `ready` when the device sign-in finishes, with no answer on the card (test).
  - done: impl-1791 · 2026-11-11T22:24:48.218Z
  - verified: rev-35 [reviewer] · run rev-35-1791-final-1 · 2026-11-11T23:33:06.712Z · commit 26b09338a1fe4424330154fd14c30cad991dd4c1
- [x] C4. Answering "Sign in again" re-runs the sign-in on the login's host and volume, and the sign-in card folds on both remotes (test).
  - done: impl-1791 · 2026-11-11T22:24:48.567Z
  - verified: rev-35 [reviewer] · run rev-35-1791-final-1 · 2026-11-11T23:33:06.712Z · commit 26b09338a1fe4424330154fd14c30cad991dd4c1
- [x] C5. The pasted code appears in no log line, journal record, history row or remote outcome line (test).
  - done: impl-1791 · 2026-11-11T22:24:48.695Z
  - verified: rev-35 [reviewer] · run rev-35-1791-final-1 · 2026-11-11T23:33:06.712Z · commit 26b09338a1fe4424330154fd14c30cad991dd4c1
- [x] C6. A sign-in not finished within 15 minutes of hub-clock time withdraws its card and leaves the login `signed-out` with its volume kept (test).
  - done: impl-1791 · 2026-11-11T22:24:48.833Z
  - verified: rev-35 [reviewer] · run rev-35-1791-final-1 · 2026-11-11T23:33:06.712Z · commit 26b09338a1fe4424330154fd14c30cad991dd4c1
- [x] C7. On a messenger whose adapter can delete messages (the test messenger declares it), the human's message carrying the pasted Claude Code code is deleted after the hub reads it; where it cannot be deleted, the hub sends one line saying so (test).
  - done: impl-1791 · 2026-11-11T22:24:49.090Z
  - verified: rev-35 [reviewer] · run rev-35-1791-final-1 · 2026-11-11T23:33:06.712Z · commit 26b09338a1fe4424330154fd14c30cad991dd4c1

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

### impl-1791 · 2026-11-11T21:35:20.674Z

Coordinator1340938a authorized exactly one origin/dev merge; merged as e7b06978d (T1815/T1794 plus landed T1818). One dispatch conflict resolved by retaining #prepareLogin extraction and copying T1794's exact afterSignIn closure into its options, so CLI and cards share it. Before real binding: explicit incoming contract sweep includes Host.signIn/SignInInput/Output/Close/Run (host.ts, SSH Host/local absence, signin-client.ts), agent signin-types parseSignInClose/signInNotAdmitted and capability/stream/cancel/close consumers (agent server/protocol/process owner, shared client/owner/command/redactor tests, native host-agent-signin-op), login-signin/preparePoolLogin afterSignIn (Sessions.relaunchAfterSignIn and login-resignin-native/CLI extraction tests). Optional injected runner stays only as a component fixture override; default registration will call the selected Host.signIn with shared types and parser. No new operation, wire fields, credential policy, close parser or relaunch path. New default-binding T2 is RED at merged baseline (topic.answer false, expectedtrue). Native source file will cover real fake-host/fake-binary/test-messenger boundaries after reviewed head; graph extension retains previous791 union and counts every unknown, with generated-case dispositions rather than direct-import selection.

### impl-1791 · 2026-11-11T21:48:00.769Z

Integrated source4 pushed c228a844b1a8907594b03d6823de16c6fa8d64ef/tree71aa1485c4bf0c54fd43bf0e7fa11cefd9ff3664. Exactly one Coordinator-authorized dev merge e7b06978d; T1794 afterSignIn closure is unchanged in #prepareLogin. Default owner calls prepared Host.signIn and shared SignIn* types/parseSignInClose; optional runner remains fixture override. Additive internal preparePoolLogin.nativeHost captures the admitted object, never serialized to client; a same-display-name replacement trap proves no relookup. Existing terminal plan shape preserved. Rule20 extended961roots/806reached+13unknown; conservative820union retains all prior candidates; per-path dispositions in A-18892. Fixture-specific reach8nativefiles all included in directed15file set plus macOS caffeinate slice. Native card4cases written/UNEXECUTED per Coordinator's review-before-native order. Exact-head63/63 targetedT1/T2,26required names observed, typecheck/tier/closed-wording0, report-only lint122/59files/0refusals; A-18892 retains separate producer streams/close facts, initial TS2352 failure and its erased-type fix, earlier-head graph qualification, publication positive-control+8files0matches. No timing sample/allowance invented for unrun cases; add measured allowances with fresh review if needed after native sampling. Docs/skill metadata/current QA mapping updated. C1–C7 not marked until native/configured evidence; this is integrated intermediate source review, not final-ready request.

### rev-35 · 2026-11-11T21:55:55.008Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1791-source-4
commit: c228a844b1a8907594b03d6823de16c6fa8d64ef
scope: full
findings: [{"severity":"medium","text":"New bin/claude and bin/codex symlinks point to shell wrappers that exec sibling fake-*.ts, but those siblings are absent under bin; access()/bootstrap preserve lexical paths. Repair complete entrypoints/exact-path wrappers under shared isolation. Lead56a746c1 and Coordinator49f658c4 confirm. A18893 actual native4/4 fails at prompt/ready waits; it does not capture a specific MODULE_NOT_FOUND native exit.","file":"hub/test/host-create-fixture.ts","line":33},{"severity":"medium","text":"Native diagnostics capture admissions only after a code card/success is observed, so every actual pre-prompt failure yields native:[] and only a hub-log tail. Rule9/Coordinator49f658c4 require bounded secret-scanned native stderr and close observations even before prompt, through existing preparation/real Host boundaries. Preserve explicit unknown facts; do not replace the native operation under test.","file":"hub/test/login-card-signin.test.ts","line":19},{"severity":"medium","text":"Now-reached sign-in guidance and linked ssh-host.md:378 unconditionally prescribe the renewal interrupted-sign-in fence. New-login pending has no interrupt and its approved cut retains creating/mounted disk plus named unknown notice, with recovery in T1814. Lead952ab0be confirms no conditional disposition. Correct both passages to match the already-conditional login reference; add no second fence.","file":"docs/agents/host-agent.md","line":700},{"severity":"medium","text":"Output callback can publish an actionable code card while await run() is still pending; #codes input owner is installed only after the captured handle exists. signin-v1 intentionally arms output before start completion, so an early human answer can fail 'Sign-in no longer active'. Lead952ab0be confirms no ordering guarantee. Keep bounded output in memory, validate the captured handle/admission and prearm input ownership before publication; add a complete-prompt/held-start first-answer control.","file":"hub/src/host/login-card-signin.ts","line":127}]
finding_counts: {"high":0,"medium":4,"low":0}

A-18894 complete integrated source4 NOT CLEAR: Standards3medium/Spec1medium; four consolidated findings. One Coordinator1340938a dev merge, real captured Host binding/shared parser and exact T1794 afterSignIn closure otherwise preserved; imported T1815 contract byte-identical reviewed2b2add0f2. A18892 exact63/63 T1/T2 with all26 named controls checked, lint122 report-only/0refusals;961-root/820 conservative union retains prior paths and labels prior assertion-head graph. A18893 Coordinator diagnostic actual4tests/0pass/4fail, producer1/signalnull; exact errors prompt/ready/cancel 'not within15000ms', signed-out rows/native:[]; no invented module-error/native-exit claim. TMPDIR9887→9887 equal; private/tmp4 new cland-h roots retained T1806, no global-cleanup claim; slot released. Clean c228a844b/tree71aa1485. No criterion verified/final-ready; no Reviewer experiments. Complete pass releases hold for all four fixes, fresh committed review and authorized diagnostic/final native/configured sequence.

Criteria: C1 failed (New native fixture launchers omit sibling fake modules; Create one native cases fail before code cards, and pre-prompt diagnostics lack native close/stderr facts.), C2 failed (A complete prompt can publish its card before the captured run/input owner exists; an early first answer is refused instead of reaching stdin.), C3 failed (Exact-head native Codex case fails ready/snapshot wait at15000ms; no current native device-sign-in pass.), C6 failed (Exact-head native cancellation case fails before its prompt/close assertions; fixture and pre-prompt diagnostics require correction.).

### impl-1791 · 2026-11-11T22:25:02.661Z

Source5 at6f3f4d2a3/tree3409bb4d is in fresh review with A-18896. All4source4 findings fixed; native slot5 finally4/4green atf3afbody (actual0/null), prior slots1–4remainfailedA18893/A18895. Strict launcher uses canonical account containment + final explicit shared-builder overlays and no boot/CLAND_HOST metadata by85a8dc76; native authority staysAgentProcesses. Early prompt waits for captured handle/admission and prearms input before transaction publication; new held-start/first-answer regression. Native pre-prompt diagnostics retain actual bounded stderr/close with scan. Conditional fence guidance corrected in both reached docs. Exact-current64/64 T1/T2,27named controls/static0; report-only lint122/0refusals. Four unique C216allowances measuredfromgreenMac samples, Linuxprojectionnotpass, no baseline transfer. R20current961roots/806reached+13unknown/820conservativeunion retains prior explicit/raw/wire/native consumers; new trace/helper calls shared modules, no filter/parser copy. All7criteria implementation-done, finalreviewed15native+Macslice and mode-freeLinuxVerify stillpending; fullT3batch andT4stage/QA occasion split unchanged.

### rev-35 · 2026-11-11T22:29:03.502Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1791-source-5
commit: 6f3f4d2a3dd565afb84e54c9a6fd1d2c439585a7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18897 SOURCE CLEAR: Standards0/Spec0, all four A18894 findings resolved. Prompt waits for captured run/admission; input map/durable intent prearmed inside transaction before publication; held-start first-subscriber-answer regression checked. Exact fake module launchers use canonical owned account paths/final shared-builder overlays/shared OpenCode validation, no boot/native authority metadata per85a8dc76. Bounded real-Host pre-prompt diagnostics redact+scan; both reached fence guides conditional. T2 failure cleanup now drains synthetic held prepare. Four C216 allowances10/10/8/9 bound to actual green Mac samples with explicit unexecutedLinux projections; old timing data unchanged/no timeout calibration. A18896 current64/64,all27 named cases,five producers0/null/no truncation checked;lint122report-only/0refusals. Earlier f3af green4/4 supports unchanged native bodies but is not final-head directed evidence. Failed slots/4T1806 roots retained; no globalcleanup claim.961root/820union preserves prior,graph684+onecleanup qualification. Clean6f3f4d2a3/tree3409bb4d,noextra devmerge. No criteria newly verified/readiness: release hold for final exact-head directed15native+Mac inhibitor slice, mode-free configured verify and actual case/file/consumer reconciliation. RemainingT3batch/T4stage split unchanged; any head change needs fresh source review.

### rev-35 · 2026-11-11T22:58:16.023Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1791-evidence-1
commit: 6f3f4d2a3dd565afb84e54c9a6fd1d2c439585a7
scope: evidence
findings: [{"severity":"medium","text":"Configured5bcf2303 enforced failure actual1/expected0: this registered-owner consumer still counts all asks as zero and expects old terminal command hint at151; its guide also retains old outcome. Source-backed sequence is one reserved login/pre-native fixture failure → one distinct signed-out login-signin card, not duplicate wait-card creation. Coordinator4f0faf87/06dd8ca9 approves deterministic T2 preparation failure, original ask answered once/Signing in, one episode/card across retries/restart, one preparation/no native admission, separate no-owner hint control, guide/current QA mapping and other option1 consumer migration. Preserve exact guarantees and isolation rather than relax counts.","file":"hub/test/login-wait.test.ts","line":146}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18900 completed failed-evidence audit NOT CLEAR, one medium task-local missed consumer. Exact A18899 failure quoted/inspected, no flake/shared classification; Coordinator devperiodic supports task-local. T0/T1 passed; selected allT2 fallback failed/interrupted; changedT3/Web unexecuted. Streamed base5469pass/1fail test and587pass/1fail file finishes, separate275/275 load positives; no complete-coverage claim. Linuxx64 Node24.21 c8lon1 lifetime946s cost$0.0657. A18898 independent final-source5 native audit remains88 positive cases/16 producers0/null, inventory26T1806 roots/unchangedTMPDIR, no globalcleanup. Coordinator permits no native rerun if T2 fix leaves native paths unchanged; demonstrate condition in next review, do not relabel head. No criteria verified/readiness. Hold released for authorized T2/docs/consumer fix, fresh delta review then configured verify; no unchanged-head retry/Reviewer experiments.

Criteria: C1 failed (Configured Create one replay/restart consumer fails because registered-owner outcome/card semantics were not migrated; exact case login card option1 line146 actual1 expected0.).

### impl-1791 · 2026-11-11T23:00:54.513Z

Rule-20 consumer correction after A-18899/A-18900: login-wait.test.ts was reached in A-18896 but its option1 meaning was incorrectly left unmigrated. Exact failed assertion at146 counts every open ask (1!==0), and151 expects the superseded hint. Its installed-owner path now returns Signing in; failed preparation creates one distinct login-signin episode card. Migrating this T2 case and its per-file guide, preserving wait fold/replay/restart and no-native guarantees, adding standalone no-owner LoginCards hint control. Explicit option1/field/function sweep covers login-create/onAnswer, LoginCards/reconcile, Create one, command-hint text and selector: login-card-signin-owner/recovery/native already exercise installed owner; login-signed-out proves episode/card identity; hub-cards generic answer-once contract unchanged; docs/hub/logins current conditional owner/fallback mapping already correct; waiting-launches doc remains shared card/needsYou semantics; qa/briefs/E-1535-stage-3 current replay mapping updated while original seven-case historical catalog and fallback source guard preserved; durations.json old samples are retained unchanged, no baseline transfer. Other old QA/spec/release historical statements remain original-head receipts. No production, native, wire, skill or permission changes. Coordinator4f0faf87/06dd8ca9 approves T2/docs delta and carrying A-18898 native evidence without rerun. One fix head + delta source review before configured retry.

### rev-35 · 2026-11-11T23:04:39.199Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1791-delta-6
commit: 26b09338a1fe4424330154fd14c30cad991dd4c1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18902 source delta CLEAR: Standards0/Spec0. Exactly three T2/docs/QA paths, no runtime/native/fixture/runner/manifest/duration change or dev merge. A18900 resolved: registered Create one Signing in/one durable original ask answer, deterministic one failed prep, exact distinct signed-out episode/card across retry/restart, replay refusal, preparation1/native0. Separate no-owner terminal-hint control; other wait cases retained; current eight-case QA mapping explicit/historical7 preserved. A18901 actual8positive TAP, three producers0/null/errornull; receipt head plus clean hashes matchcurrent; stale uncommitted caption qualified, no finalconfigured proof. Byte equality satisfies Coordinator4f0faf87/06dd8ca9 no-native-rerun condition: A18898 accepted88-case carry at6f3f4d2a3, not relabelled as26b execution. Clean26b09338a/treeadd45685. No criteria verified/readiness. Hold released for new exact-head mode-free configured verify; A18899 stays failed, its Web/changedT3 unrun. Final actual case/file/consumer evidence pending; remaining T3/T4/QA split unchanged. No Reviewer experiments.

### rev-35 · 2026-11-11T23:33:06.712Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1791-final-1
commit: 26b09338a1fe4424330154fd14c30cad991dd4c1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18905 final CLEAR, Standards0/Spec0, C1–C7 verified. Reviewed26b09338a/treeadd45685 clean unchanged; independently reconstructed normalizedtreef4ab6e409 matches A18903 configureddb4a0b0a. T0/allT1/fallbackallT2/changed4T3files/all52Web pass:6182 base test+687 file positive finishes, separate280load test/file passes,zero negatives/skips/cancel. All27card/recovery cases base+5,all8wait casesbase;14T3identitiesbaseonce,4nativecardcases exactpositive. A18904 all7429finish facts matchrawlog;961rows preserved,required820union=556configuredfullfiles+11additionalnativecarry+239T3/14T4deferred,zero missingreachedT1/T2/Web. A18898 approved6f3native88positive/16producers0/null carried underCoordinator4f0faf87/06dd8ca9+byteequalA18902,notrelabelledorsummed; exactinhibitorsliceonly,26T1806rootsretained/no globalcleanup. Linuxx64 Node24.21/nvim0.12.5,c8lon1,2workers,lifetime1242s/$0.0862; pinnedHeadlessShell1248/Chrome156.0.8078.4. Lint122/59 and budgets/ratchet report-only, no clean-budget/fullT3 claim. Previous A18899/diagnosticreds stayhistoricalfailed. All source findings resolved; unknown-create retention/T1814 scope preserved. Holdreleased,no further run/source requested. RemainingT3landingbatch,broaderT4/afterstageQA separate; no Reviewer experiments.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-12T00:13:15.440Z

Merged 3cfbebfceed93e7b7c323050397537e6f440cad8 onto dev.
