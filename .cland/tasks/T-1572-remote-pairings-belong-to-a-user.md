---
id: T-1572
kind: task
title: Remote pairings belong to a user
state: open
status: ready
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1561
  - T-1562
topic: topic-1322
branch: t/T-1572-remote-pairings-belong-to-a-user
created: 2026-10-31T23:47:53.485Z
updated: 2026-11-02T07:55:15.846Z
---

## Summary

In users mode a pairing belongs to one user. An admin approves the code from Neovim or `cland remote approve <messenger> <code> --user <name>`, a new pairing of the same user and messenger replaces the old one, and input from a paired chat arrives as that user. This ticket is the expand step: storage, approval, inbound identity and the journal. Outbound fan-out follows in L16 and L17. Single mode keeps one pairing per messenger.

Hot files: `hub/src/remote/state.ts` (a new per-user pairings table; `remote_pairings` stays for single mode), `hub/src/remote/pairing.ts`, `hub/src/remote/telegram-inbound.ts`, `hub/src/remote/discord-inbound.ts`, `hub/src/remote/gateway.ts` (trusted per-input user beside the ingress), `hub/src/hub/dispatch.ts` [Host] (`pairing.approve`), `hub/src/cli/remote.ts`, `nvim/lua/cland/pairing_card.lua`, `hub/src/hub/web-authority.ts` [Host] (unchanged rule, new field).

## Acceptance criteria

- [x] C1. In users mode `cland remote approve <messenger> <code> --user <name>` pairs that chat with that user, and the approval without `--user` is refused with a message naming the flag.
  - done: impl-1572 · 2026-11-02T05:43:46.454Z
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.717Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
- [x] C2. The Neovim pairing card asks for the user in users mode and approves the pairing for the chosen user.
  - done: impl-1572 · 2026-11-02T05:43:47.725Z
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.717Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
- [x] C3. Two users pair two Telegram chats, and each chat's messages and answers arrive in the hub as its own user.
  - done: impl-1572 · 2026-11-02T06:01:21.933Z
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.718Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
- [x] C4. A new pairing of one user and messenger replaces only that user's old pairing.
  - done: impl-1572 · 2026-11-02T05:43:49.851Z
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.718Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
- [x] C5. The pairing's journal record carries the paired user's id and the approving user's id, and never the code.
  - done: impl-1572 · 2026-11-02T05:43:50.489Z
  - verified: rev-37 [reviewer] · run rev-37-1572-source-1 · 2026-11-02T06:06:10.836Z · commit 15f7c70d19bed4f497e633b50027273ffec2f396
  - verified: rev-37 [reviewer] · run rev-37-1572-source-2 · 2026-11-02T06:33:02.234Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.718Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-delta-1 · 2026-11-02T07:26:46.068Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
- [x] C6. The gateway's authority table and its refusals are unchanged, and the user of a remote input comes only from its pairing, never from the frame.
  - done: impl-1572 · 2026-11-02T06:28:09.002Z
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.718Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
- [x] C7. In single mode pairing, replacement and inbound tests pass unchanged.
  - done: impl-1572 · 2026-11-02T06:28:10.261Z
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.718Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
- [x] C8. `cland auth reset` keeps the first user's pairing per messenger and revokes the other users' pairings through T-1558's reset step (A-15078 A3), proven by a test.
  - done: impl-1572 · 2026-11-02T05:43:53.067Z
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-2 · 2026-11-02T06:55:15.718Z · commit b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
  - verified: rev-37 [reviewer] · run rev-37-1572-evidence-3 · 2026-11-02T07:55:15.261Z · commit 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1

## Comments

### impl-1572 · 2026-11-02T05:30:34.301Z

Consumer inventory (hub/src and hub/test, searched pairing.approve, remote_pairings, setPairing, pairing(), PairingCodes and RemoteIngress): production state/pairing, gateway/dispatch/protocol, CLI remote/usage/setup, inbox/daemon; Telegram polling/inbound/cards/prompts/media/outbox/gap, Discord inbound/commands/cards/outbox/catchup/messenger. Storage and native admission migrate; outbound publication remains single destination pending T-1573/T-1574. Tests: pairing-{service,codes,approval}, remote-{state,cli,workbench,neutral,docs-pairing}, gateway{,-state}, web-authority, setup-{remote,pairing}-component, doctor-remotes and Telegram/Discord transport, inbound, cards, media, recovery fixtures. Existing optional ingress and pairing frame shapes retain compatibility in single mode; users-mode native identity must resolve persisted pairing. Inventory saved in artifact next.

### impl-1572 · 2026-11-02T05:38:00.668Z

Decision by Coordinator, 2026-11-02 05:38Z, extends A-15078 A12 to unpair: users mode remote.unpair requires --user/name frame field; omission refuses and names paired users; removes only selected user's messenger binding. No --all. Single mode unchanged. Neovim row action names that row's user. Tests: owner-only removal, missing selector, session-shell refusal.

### rev-35 · 2026-11-02T05:47:53.175Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1572-source-1
commit: 97915e81449ee1ca915d86d8a7c602a661e95adf
scope: full
findings: [{"severity":"high","text":"Discord media can acquire a different project user after a download: #paired re-resolves only native chat/user, and post sends no captured Pairing identity (153–154). Unpair Alice and bind that same native identity to Bob while CDN/speech work is held; Gateway then resolves Bob and admits Alice's old input with Bob's role. Preserve/revalidate the admitted clandUserId through every await and pass the captured identity.","file":"hub/src/remote/discord-inbound.ts","line":98},{"severity":"medium","text":"Card requests without interaction omit both ingress and Pairing identity. The new gateway userAuthorityRefusal consequently refuses inbox.list in users mode, including the Other/Decline path at 165 and replay/history reads. Carry trusted pairing identity on these reads and cover real gateway/modal behavior.","file":"hub/src/remote/discord-cards.ts","line":73},{"severity":"medium","text":"Frozen REMOTE_USAGE still omits --user on approve/unpair while production usage adds it. The unchanged full deep-equality compatibility test and native aggregate/remote help assertions therefore disagree at this head. Migrate the independently authored expected block and keep full assertions.","file":"hub/test/fixtures/cli-usage/commands.json","line":71},{"severity":"medium","text":"The new answer receipt accepts any message from this user whose text differs from Hello, then asserts only from. A broken native reply route that posts plain '1' to General satisfies it. Match and assert answerTo === the exact ask.ask (and expected answer), retaining a bounded positive receipt.","file":"hub/test/telegram-inbound.test.ts","line":970},{"severity":"low","text":"The main pairing guide still describes clearing every messenger code and approve/unpair without a user selector, and Neovim README:107 still describes immediate approval. Update these matching docs for per-user code removal, required users-mode selection and the chooser (rule 16).","file":"docs/agents/pairing.md","line":37}]
finding_counts: {"high":1,"medium":3,"low":1}

Source not clear. High: discord-inbound.ts:98/153–154 permits old media input to acquire a new project owner after native pairing reassignment during an await. Medium: discord-cards.ts:73 drops identity on non-interaction inbox.list, breaking users-mode Other/Decline and replay reads; frozen commands.json:71 REMOTE_USAGE contradicts new approve/unpair help and unchanged full-byte tests; telegram-inbound.test.ts:970–977 does not assert the exact answer receipt. Low: docs/agents/pairing.md:37 and nvim/README.md:107 retain the superseded approval/unpair flow. Detailed counterexamples and standards/spec review: A-15591 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15591-t-1572-source-review-findings-at-97915e814.md). C6 and C3 failed; other criteria unverified. Read-only source pass, no reviewer tests; implementer's local targeted/typecheck/lint reports are not queued verification. Fix and request fresh source review before verification.

Criteria: C6 failed (Discord media can reacquire a reassigned project owner after download; DiscordCards reads omit trusted identity and fail users-mode role admission.), C3 failed (Native Telegram answer regression accepts a plain-message fallback instead of observing answerTo for the exact ask.).

### impl-1572 · 2026-11-02T05:54:54.391Z

A-15591 follow-up: red-first native CDN/gateway test reproduced old Alice input stored with Bob userId after reassignment; fixed #paired to consult the captured-owner context and media sends to carry the admitted Pairing. Red-first users-mode Other/Decline modal tests timed out before native type-9 receipt; fixed DiscordCards to supply pairing identity on every request and migrated its recording/held-frame fixture's fourth-argument forwarding. Other RemoteSend wrappers in discord-commands.test.ts and discord-pairing.test.ts remain single-mode-only controls and do not require user metadata. Telegram reply proof now matches exact answerTo and asserts answer text. Frozen help and docs updated. New controls now pass locally; final whole-file/help/typecheck/lint checks pending load below 10.

### rev-37 · 2026-11-02T06:06:10.836Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1572-source-1
commit: 15f7c70d19bed4f497e633b50027273ffec2f396
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source clear, Standards/Spec no findings; all A-15591 findings resolved. Media revalidates captured contextual owner through awaits and passes admitted Pairing; Gateway compares owner before trusted dispatch id. Cards supply pairing on every request incl ingress-free modal/replay reads; native regressions await modal and durable answer receipts. Telegram proof now matches exact answerTo/text. Frozen help and pairing/Neovim docs migrated with full assertions retained. Additive table, first-user reset retention, required approve/unpair user selector, unchanged gateway allowlist and optional wire compatibility reviewed. C5 id-only pairing journal source verified; C1–C4/C6–C8 await exact-head mode-free verification/named preservation and chooser receipts. A-15616 local macOS targeted/typecheck/lint supplemental only; no full/Linux/browser verification claimed. No Reviewer execution.

Criteria: C5 verified.

### rev-37 · 2026-11-02T06:24:40.078Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1572-evidence-1
commit: 15f7c70d19bed4f497e633b50027273ffec2f396
scope: evidence
findings: [{"severity":"medium","text":"Foreign mapped-card refusal requires paired, but pairingFor returns null for the foreign sender. Existing single-mode Telegram card and approval controls durably confirm the update without answerCallbackQuery (actual 0, expected 1). Preserve the native-only refusal without authorizing foreign hub input.","file":"hub/src/remote/telegram-polling.ts","line":100},{"severity":"medium","text":"Users-mode synthetic remote sends neither ingress nor trusted Pairing (fakes/messenger.ts:35), so upload fails 'User role (unknown) cannot request artifact.upload' before creator identity assertions. Migrate this contract consumer/setup while retaining missing-identity refusal and all identity/authority assertions.","file":"hub/test/artifact-user.test.ts","line":46}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear. A-15646 run 4b4c2f60-660c-4631-a954-ec3f10bdfd86 at exact reviewed head exits1: T0/T1 green, T2 native 4017 tests/4014 pass/3 fail; T3/Web unexecuted. Actual failures: artifact-user.test.ts:47 'User role (unknown) cannot request artifact.upload' (false !== true); telegram-approvals.test.ts:479 'foreign approval must get its private refusal' (0 !== 1); telegram-cards.test.ts:1454 'foreign mapped-card press must receive its private refusal' (0 !== 1). Linux x64 droplet, Node24.21.0, Neovim0.12.5; browser binary/version null, no cache; budget/lint/ratchet report-only. A-15648 contains source diagnosis and run limits. No Reviewer execution. C6/C7 fail; remaining run-dependent criteria unverified. Fixes require fresh exact-head source review before verification.

Criteria: C6 failed (Exact-head suite has changed Telegram foreign-card refusal behavior and an unmigrated users-mode gateway identity consumer.), C7 failed (Unchanged single-mode Telegram foreign approval/card tests fail: native private alert count is 0 instead of 1.).

### impl-1572 · 2026-11-02T06:25:37.973Z

Verification A-15646 / run 4b4c2f60 identified a consumer migration in T-1563's hub/test/artifact-user.test.ts: its users-mode synthetic messenger supplied neither native ingress nor Pairing, so the new intended admission refused it. Per Coordinator decision 94c5b704, the fixture now pairs the uploading user through the scratch native pairing/CLI approval path and uploads with native ingress/bytes; all original creator, persisted-index, audit, journal, single-mode, web and agent identity assertions remain. It additionally asserts an ingress-free users-mode gateway upload is refused with a message naming missing pairing, not an unknown role. Poller private foreign-card alert eligibility now requires validated native/mapped bot card facts, without requiring a paired sender. No hub authority is granted to that alert path.

### rev-37 · 2026-11-02T06:33:02.234Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1572-source-2
commit: b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards/Spec no findings, A-15659. A-15648 findings resolved: foreign mapped bot-card alerts no longer require paired sender and remain native-only; artifact-user pairs through scratch CLI and uploads native ingress/bytes, preserving all identity assertions and adding explicit missing-pairing refusal. Coordinator decision 94c5b704 confirmed. Both dispatcher paths share gatewayUserRefusal before existing shared role checker; transport refusal priority/table unchanged. Matching docs/kept skill and change record updated. C5 id-only pairing journal reread and source verified. A-15658 local macOS targeted/typecheck/lint and A-15657 exact-head headless Neovim6/6 are supplemental; no browser or Reviewer execution. Old-head Linux A-15646 remains failed. C1–C4/C6–C8 await exact-head queued verification/named preservation evidence. Source clear permits mode-free cland verify at this head; QA remains after-stage.

Criteria: C5 verified.

### rev-37 · 2026-11-02T06:55:15.718Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1572-evidence-2
commit: b366262ea6cbf34c1bdcb8656e6e8410fbc53c43
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; no findings, all C1–C8 verified. A-15681 exact-head run920f72bb-0246-44e5-b950-99f7f15be473 exits0,4713/4713, no fail/cancel/skip/todo. Independently streamed named finish outcomes: users approval/replacement/reset/journal, two native Telegram users' exact answers, native Neovim chooser/durable owner, Discord held-media reassignment and Other/Decline modal controls, paired artifact identity/missing-pairing refusal, gateway authority and unchanged single-mode/foreign-alert preservation all pass. Details A-15683 with per-file counts. Linux x64 droplet Node24.21.0 Neovim0.12.5 Headless Shell156.0.8078.4r1248; T0/T1/all-T2/Web and changed Neovim T3 once complete (3 top-level identities/6 incl subtests); remaining T3 deferred merge batch, no T4 executed. Uncached, lint122/59files and duration/ratchet advisories report-only. Canonical treee95d0ebce0084419ad67a78e07b17706969c2c16 independently matched reviewed commit using production metadata exclusions. No Reviewer tests/browser/edits. Old A-15646 remains failed; QA after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### rev-37 · 2026-11-02T07:26:46.068Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1572-delta-1
commit: 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Post-merge delta source clear; Standards/Spec no findings, A-15726. Coordinator-required merge confirmed. Store deterministically retains Users→HostRecords→RemoteState(db, users) before shared migrations, including per-user reset hook and both additive schemas. New existing-DB controls with/without hosts assert legacy column/pairing migration, sentinel preservation, reopen, reset revocation and host preservation. Dispatch retains trusted paired-user artifact path plus landed user-id withdrawal/role checks. README/kept skill retain both features/change record. Native Neovim navigation opens actual pairing card before exact full-code receipt and closes it before archive; original code/outcome assertions preserved. C5 id-only journal source refreshed. A-15724 local macOS207 targeted/typecheck/lint and A-15723 exact-head native Neovim6/6 supplemental only; old A-15681 applies to predecessor. C1–C4/C6–C8 await fresh exact-head queued evidence including host-records9 and pairing/ownership controls. No Reviewer tests/browser/edits; QA after-stage.

Criteria: C5 verified.

### rev-37 · 2026-11-02T07:55:15.261Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1572-evidence-3
commit: 3fb6f1f0a0aa7a430ed0ab87b181c1bcd2f431c1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Post-merge final evidence clear; no findings, all C1–C8 verified. A-15743 exact-head run51e8691c-1497-41d0-affd-e9d63ae8f54d exits0,4725/4725, zero fail/cancel/skip/todo. Independently streamed named finish receipts: host-records9 incl both preexisting-DB migration/reset/host preservation controls; pairing approval12/service5/CLI23, Telegram native exact users answers45, native Neovim chooser/card6incl subtests, media reassignment16/cards70, gateway20/artifact4, foreign approval23/cards62/remote state5, frozen CLI1 all pass. Merged ownership topic-withdraw7/unit7/web9 all pass. A-15745 maps each criterion and provenance. Linux x64 droplet Node24.21.0 Neovim0.12.5 Headless Shell156.0.8078.4r1248; T0/T1/all-T2/Web/changed Neovim T3 once complete,3 top-level identities; remaining T3 deferred, no T4/repetitions. Uncached, canonical treefff097bd1b51021019402797c7ea730d824bacc7. Lint122/59files/duration/budget/ratchet report-only; skip-reason report missing0. No Reviewer tests/browser/edits; QA after-stage. Previous-head receipts remain historical.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
