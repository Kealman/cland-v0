---
id: T-1354
kind: task
title: "One gate across the clients: answers from Neovim and the web, withdrawn and cancelled asks, and closed cards dropped from the outbox"
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1353
topic: topic-1110
branch: t/T-1354-one-gate-across-the-clients-answers-from
created: 2026-10-27T05:43:01.228Z
updated: 2026-10-27T10:37:23.748Z
closed: 2026-10-27T10:37:23.748Z
---

## Summary

The first answer from any client or remote wins. When that answer comes from Neovim or the web, or the ask is withdrawn or cancelled, every copy of the card turns into that outcome. A card job whose ask closed before it left is dropped.

## What to build

The card follows the hub's record, not the remote's own press. On the ask's state change (its `ask` frame, or its inbox departure with the outcome), every mapped copy is edited:
- an ask answered elsewhere shows the choice or the decline reason, who, where ("via Neovim", "via web") and when;
- a withdrawn ask says so, naming its session;
- a cancelled ask says its topic or item closed.

`TelegramOutbox` wires the outbox's `sourceOpen` to the hub's record, so a queued card job for a closed ask is dropped. Edits of one card merge, and edits ride ahead of General like cards do. When a tap and a Neovim answer race, the hub's one gate (v0.2 §3.3) keeps exactly one outcome, and the card shows the winner. Spec §3.5; v0.2 §3.3.

## Acceptance criteria

- [x] C1. An ask answered by a Neovim client over the frame protocol edits its card to an outcome "via Neovim" with no buttons, and one declined from a web client shows the reason "via web" (test).
  - done: impl-1354 · 2026-10-27T10:07:15.508Z
  - verified: rev-26 [reviewer] · run rev-20261027-1354-evidence-1 · 2026-10-27T10:30:48.941Z · commit 9951d8ebcd2b5899a577f3c06febfdeb07c20963
- [x] C2. An ask withdrawn by its session edits its card to say it was withdrawn, and an ask whose topic closes edits its card to say it was cancelled (test).
  - done: impl-1354 · 2026-10-27T10:07:15.616Z
  - verified: rev-26 [reviewer] · run rev-20261027-1354-evidence-1 · 2026-10-27T10:30:48.941Z · commit 9951d8ebcd2b5899a577f3c06febfdeb07c20963
- [x] C3. An ask answered while its card job waits behind a 429 hold is never sent, and its job is marked dropped (test).
  - done: impl-1354 · 2026-10-27T10:07:15.703Z
  - verified: rev-26 [reviewer] · run rev-20261027-1354-evidence-1 · 2026-10-27T10:30:48.941Z · commit 9951d8ebcd2b5899a577f3c06febfdeb07c20963
- [x] C4. A tap and a Neovim answer racing on one ask store exactly one outcome, and every copy of the card shows that one (test).
  - done: impl-1354 · 2026-10-27T10:07:15.791Z
  - verified: rev-26 [reviewer] · run rev-20261027-1354-evidence-1 · 2026-10-27T10:30:48.941Z · commit 9951d8ebcd2b5899a577f3c06febfdeb07c20963

## Comments

### impl-1354 · 2026-10-27T09:58:02.446Z

Scope/seams confirmed by launch brief: frame protocol (Neovim Unix frame client; authenticated web WebSocket for web decline) and production TelegramRemote against hub/test/fakes/telegram. No browser or real platform. Existing wire shapes remain unchanged: AskCard.state/outcome and Inbox.departures already carry the required facts. Rule-20 source-policy inventory before editing: remote/outbox.ts sourceOpen caller and TelegramOutbox lane; TelegramRemote owns hub frame requests; TelegramCards enqueues card/edits; telegram-gap, inbound, commands and gateway factory use the same outbox but their non-card jobs remain eligible. Tests: telegram-*.test.ts, outbox.test.ts/outbox-gateway.test.ts, gateway*.test.ts, asks*.test.ts and inbox*.test.ts (including T3 polling-restart and inbox workload/soak); fake outbox-messenger; persisted remote-state readers and Telegram outbox receipts. Shared/wire, web and nvim ask/departure readers, QA briefs/startup probes, shipped implement/qa guidance were searched: no wire/reply/schema/row change is planned; they retain existing fields and old-client coverage in gateway.test.ts. Only card sends whose authoritative ask is closed will be dropped; edits and uncertain-send fences must remain intact.

### impl-1354 · 2026-10-27T10:07:36.536Z

Source review requested at 81c4eedcb9f4679fb8c7634bf95a960a51aa0e93 (reviewer role, resolved rev-26). Fresh fetch+merge origin/dev already up to date; pushed only origin; clean worktree. C1–C4 done. Final macOS arm64 Node v24.21.0 serial targeted sweep: 28 requested files, 262/262 pass, no fail/cancel/skip/todo; selected files span T1/T2/T3/T4 but do not claim complete tier coverage or duration-gate enforcement. npm run typecheck and closed-item wording lint pass. No browser, real platform or secret. A-12699 serial log, A-12700 typecheck, A-12701 exact criterion cases/red→green/limits. Source verdict pending; mode-free verification not run yet.

### rev-26 · 2026-10-27T10:10:00.418Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1354-source-1
commit: 81c4eedcb9f4679fb8c7634bf95a960a51aa0e93
scope: full
findings: [{"severity":"medium","text":"M1 Standards: authenticated web fixture leaves sign-in HTTP request/response unowned by registered cleanup and terminates its WebSocket without observing close/joining setup; pre-own abort/drain and bounded native close with missed/aborted setup controls before shared fixture disposal.","file":"hub/test/telegram-cards.test.ts","line":362}]
finding_counts: {"high":0,"medium":1,"low":0}

A-12703 records consolidated full source review. Standards M1 only; no additional Spec finding. Independently inspected 28-file/262-pass local targeted records A-12699 and typecheck A-12700; no configured/Linux/browser or enforced timing proof. Preserve C1-C4 assertions; fix M1 and request fresh pushed-head review before mode-free verification. No runtime criterion marks yet.

### impl-1354 · 2026-10-27T10:15:03.711Z

M1 fixed at 9951d8ebcd2b5899a577f3c06febfdeb07c20963; fresh source review requested. New web owner pre-registers before the hub owner and drains request/response/socket close plus setup observers. Missing-ready, HTTP-abort and WebSocket-abort controls retain native started/closed equality and no pending work. Removing drain awaiting fails the held close-observer assertion; restored control passes. At this head: macOS arm64 Node v24.21.0 card file 26/26 and full typecheck pass; lint/diff checks pass. Production source unchanged from source-1. Prior 28-file 262/262 sweep remains labelled at its original head. A-12706/A-12707/A-12708 contain corrected-head logs/evidence. No dev merge after source-1; no verification yet.

### rev-26 · 2026-10-27T10:15:49.338Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1354-source-2
commit: 9951d8ebcd2b5899a577f3c06febfdeb07c20963
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, Standards/Spec no remaining findings, A-12709. M1 resolved with pre-registered native web acquisition/close/drain owner, explicit pre-hub disposal and same-owner missing/aborted setup controls; C1-C4 assertions and unknown-send fences retained. Product source identical to81c4eedcb; original corrected-head26/26 local card/typecheck receipts inspected, prior262-pass sweep attributed to prior head. No configured runtime verification marks yet; one unchanged-head mode-free verify may proceed.

### rev-26 · 2026-10-27T10:30:48.941Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1354-evidence-1
commit: 9951d8ebcd2b5899a577f3c06febfdeb07c20963
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, C1-C4 verified, A-12711. Original mode-free 679d088e/A-12710 inspected independently: 3672 ordinary passes plus 140 separate load passes; all 14 owned new identities have base plus 5/5 load receipts (70 owned repetitions), max new base 0.183 s/load 0.456 s. Exact cross-client, withdrawn/cancelled, 429-drop, both race orders/all copies, late-map, uncertain fence, keyed-edit and fixture-close controls pass. T0/all T1/fallback all T2/Web complete on Linux droplet c-8 nyc1, pinned Headless Shell 156/v1248; T3/T4 unrun. Report-only budgets/lint and host-gate reuse preserved; no new allowance needed. Coordinator integrated cover and landing remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1354 · 2026-10-27T10:31:23.997Z

Final ready at unchanged 9951d8ebcd2b5899a577f3c06febfdeb07c20963. Corrected source and final evidence review clear; C1–C4 verified; task view ready. Run 679d088e/A-12710: Linux droplet, 3672 ordinary passes + 140 separate load passes. All 14 new item-owned identities passed base and 5/5 repeats; max ordinary 0.183s/load 0.456s; no new Linux >=3s allowance needed. T0/all T1/fallback all hub+Neovim T2/Web completed; T3/T4 unrun. Isolated Headless Shell 156.0.8078.4/v1248. Budgets/lint report-only; host typecheck reused, local candidate typecheck separate A-12707. A-12711 records exact independent audit/limits. Fresh origin/dev fetch b58c5629 and merge-tree conflict check exit0/tree cbca894f; clean worktree, no head change since source clearance. Ready report sent to Coordinator for integrated cover/enqueue/landing; claim retained.

### coord · 2026-10-27T10:37:23.748Z

Merged cc25a5d6c1100aa70ed472396b6f753e22d70b54 onto dev.
