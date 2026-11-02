---
id: T-1572
kind: task
title: Remote pairings belong to a user
state: open
status: in progress
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
updated: 2026-11-02T05:54:54.391Z
---

## Summary

In users mode a pairing belongs to one user. An admin approves the code from Neovim or `cland remote approve <messenger> <code> --user <name>`, a new pairing of the same user and messenger replaces the old one, and input from a paired chat arrives as that user. This ticket is the expand step: storage, approval, inbound identity and the journal. Outbound fan-out follows in L16 and L17. Single mode keeps one pairing per messenger.

Hot files: `hub/src/remote/state.ts` (a new per-user pairings table; `remote_pairings` stays for single mode), `hub/src/remote/pairing.ts`, `hub/src/remote/telegram-inbound.ts`, `hub/src/remote/discord-inbound.ts`, `hub/src/remote/gateway.ts` (trusted per-input user beside the ingress), `hub/src/hub/dispatch.ts` [Host] (`pairing.approve`), `hub/src/cli/remote.ts`, `nvim/lua/cland/pairing_card.lua`, `hub/src/hub/web-authority.ts` [Host] (unchanged rule, new field).

## Acceptance criteria

- [x] C1. In users mode `cland remote approve <messenger> <code> --user <name>` pairs that chat with that user, and the approval without `--user` is refused with a message naming the flag.
  - done: impl-1572 · 2026-11-02T05:43:46.454Z
- [x] C2. The Neovim pairing card asks for the user in users mode and approves the pairing for the chosen user.
  - done: impl-1572 · 2026-11-02T05:43:47.725Z
- [ ] C3. Two users pair two Telegram chats, and each chat's messages and answers arrive in the hub as its own user.
  - failed: rev-35 [reviewer] · 2026-11-02T05:47:53.175Z · note Native Telegram answer regression accepts a plain-message fallback instead of observing answerTo for the exact ask.
- [x] C4. A new pairing of one user and messenger replaces only that user's old pairing.
  - done: impl-1572 · 2026-11-02T05:43:49.851Z
- [x] C5. The pairing's journal record carries the paired user's id and the approving user's id, and never the code.
  - done: impl-1572 · 2026-11-02T05:43:50.489Z
- [ ] C6. The gateway's authority table and its refusals are unchanged, and the user of a remote input comes only from its pairing, never from the frame.
  - failed: rev-35 [reviewer] · 2026-11-02T05:47:53.174Z · note Discord media can reacquire a reassigned project owner after download; DiscordCards reads omit trusted identity and fail users-mode role admission.
- [x] C7. In single mode pairing, replacement and inbound tests pass unchanged.
  - done: impl-1572 · 2026-11-02T05:43:52.083Z
- [x] C8. `cland auth reset` keeps the first user's pairing per messenger and revokes the other users' pairings through T-1558's reset step (A-15078 A3), proven by a test.
  - done: impl-1572 · 2026-11-02T05:43:53.067Z

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
