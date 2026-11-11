---
id: T-1791
kind: task
title: Signing in from a card
state: open
status: in progress
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
updated: 2026-11-11T18:46:01.495Z
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
  - failed: rev-35 [reviewer] · 2026-11-11T18:46:01.494Z · note Timeout/stop closure validation and all-writer drainage are incomplete; new-login uncertainty must retain mounted creating resources with the approved named outcome.
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
