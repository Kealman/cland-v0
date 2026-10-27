---
id: E-1310
kind: epic
title: Remote cards and approvals
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1309
topic: topic-1124
branch: null
created: 2026-10-25T14:11:59.635Z
updated: 2026-10-27T22:56:36.812Z
closed: 2026-10-27T22:56:36.812Z
---

## Goal

Asks and command approvals reach the human's phone as remote cards with buttons, and the first answer from anywhere wins: every copy of a card, in every remote, turns into its outcome, and a stale or foreign press changes nothing. The other needs-you rows arrive as 📥 notices, their topic one reply away. The human accepted the prototype's cards, free answers, declines, outcome edits and a real Codex approval from the phone (Q-1292). This epic builds them on Telegram over the hub's one record per ask and approval; "The Discord remote" adds Discord's form of the same cards.

## Contents

- **Ask cards** (spec §3.5). A card names who asks and in which topic, then the question, one button per option (at most nine), "Other answer…" when the ask takes a free answer, and "Decline…". On Telegram it is plain text with entities, not a Rich Message, with one button per row, since the server silently drops buttons past 12 per row and 300 in all. Callback data stays within 64 bytes as an opaque key checked against the hub's record, and every press is answered at once. Demo: a nine-option ask arrives as a card with eleven buttons and is answered with a tap.
- **Approval cards** (§3.5, §3.1). A Codex or OpenCode approval names the session, the harness and the command or the files, truncated to a safe length with "full command in the workbench", with the choices the harness offers (once, always, deny) as coloured buttons. The answer goes through `approval.answer` with `via`, and the inbox row reads "approved via Telegram". No second confirmation for dangerous commands. Demo: a fake Codex approval approved from the card lets the command run, and a fake OpenCode one denied from the card stops it.
- **Notices** (§3.5). A plan waiting for approval (with the web link; plans are approved in the workbench only), a request for a review, a QA run or a handover, a message to the human in an item topic, and a Claude Code approval, answered in its harness's TUI, arrive marked 📥 without buttons. A reply to a notice goes to its topic, and the remote does not follow that thread: later messages there reach it only as cards and notices. Demo: a reply to an item-topic notice lands in that topic, and the agent's ordinary answer there is not mirrored.
- **One gate and the outcome** (§3.5). The first answer from any client or remote wins (v0.2 §3.3) and is stored in the hub before Telegram is acknowledged. Every copy of the card is then edited into its outcome without buttons: the choice or the reason, who, where and when. "Message is not modified" counts as success, a failed edit becomes an outcome reply, and a withdrawn or cancelled ask's card says so. Demo: an ask answered in Neovim edits its card to the outcome "via Neovim", and one withdrawn by its session says so.
- **Free answers and declines** (§3.5). "Other answer…" and "Decline…" each send a separate prompt with the reply field open (ForceReply); the next text, or a reply to the prompt, answers, and `/cancel` keeps the ask open. A card never carries ForceReply itself, because a message that ever did can never be edited. A typed reply to the card answers it too. Demo: "Other answer…" followed by text answers; "Decline…" followed by `/cancel` leaves the ask open; a typed reply to a card answers it.
- **Stale, foreign and late input** (§3.5). A press on a closed card gets "Already answered" and changes nothing; a press from anyone but the paired human is refused privately and changes nothing; a message that arrives late answers no ask by itself, and a reply answers only its own card while the ask is open. Demo: a press replayed after the answer changes nothing, and a late message stays a message.
- **Order and `/inbox`** (§3.5, §3.10). One inbox publication sends its cards oldest first, so the newest sits at the bottom; `/inbox` re-sends every open card at the bottom, or says "Nothing needs you". Demo: three asks arrive oldest first, and `/inbox` re-sends the two still open.
- **The cards' part of the catch-up** (§3.9). After an outage the chat gets the cards of open asks it never received and the outcome edits that did not go through. After an outage longer than 150 seconds, the life of a press, every open card is re-sent at the bottom ("a button pressed then may have been lost; press again") and its old copy is marked "↓ Re-sent below". The outbox drops the job of a card whose ask closed meanwhile. Demo: a four-minute fake outage, during which one ask is answered in the web and another is posted, ends with the edit, the new card and every open card re-sent.

Not in this epic: Discord's buttons and modals ("The Discord remote"); a voice reply to a card, which comes with transcripts ("Media, the upload frame and speech"); pairing rows, which never reach a remote; plan approval from a remote, which stays in the workbench.

## Order

1. **An ask card and its outcome.** Demo: one ask, one tap, the card edited to its outcome.
2. **One gate across the clients.** Demo: answers from Neovim and the web edit the card, and a withdrawn ask's card says so.
3. **Free answers, declines and stale input.** Demo: ForceReply answers, `/cancel`, "Already answered", a refused foreign press.
4. **Approval cards and notices.** Demo: a fake Codex approval from the card, a Claude Code approval and a plan as notices, a reply routed to an item topic.
5. **Order, `/inbox` and the catch-up.** Demo: oldest first, `/inbox`, and the four-minute outage.

## Definition of done

QA runs the demo below on `dev` against the fake Bot API in the suite, with fake Codex, OpenCode and Claude Code sessions, headless Neovim and headless Chromium, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The live run with the human on the sandbox bots is not part of this epic: it happens once, before the release, in "Release v0.3.0 from the item".

In a scratch project with the human paired on the fake, QA has a session ask a nine-option question with free answers allowed and answers it with a tap, then has three more asks posted and answers them with "Other answer…", "Decline…" with `/cancel`, and a typed reply to the card. It answers one ask in Neovim and one in the web and reads the outcome edits, replays a press on a closed card, presses as another account, and sends a late message. It approves a fake Codex approval and denies a fake OpenCode one from their cards and reads "approved via Telegram" in both inboxes, and reads a Claude Code approval, a waiting plan, a review request and an item-topic message as 📥 notices, replying to the last. It runs `/inbox`, then takes the remote offline for four minutes while one ask is answered in the web and another is posted, and reads the catch-up.

- [ ] C1. An ask arrives as a card naming who asks and where, with one button per option, "Other answer…" when free answers are allowed and "Decline…", one button per row, and keys checked against the hub's record.
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
- [ ] C2. A Codex or OpenCode approval arrives as a card with the truncated command and the harness's choices, and an answer from it is recorded with `via` and shown as "approved via Telegram".
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
- [ ] C3. Plans, requests, item-topic messages to the human and Claude Code approvals arrive as 📥 notices without buttons, and a reply to one goes to its topic without the remote following that thread.
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
- [ ] C4. The first answer from any client or remote wins and is stored before Telegram is acknowledged, and every copy of the card turns into its outcome without buttons, naming the choice or the reason, who, where and when.
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
- [ ] C5. "Other answer…" and "Decline…" send a ForceReply prompt, the next text or a reply to it answers, `/cancel` keeps the ask open, and a typed reply to the card answers it.
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
- [ ] C6. A press on a closed card gets "Already answered", a foreign press is refused privately, and a late message answers no ask.
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
- [ ] C7. Cards arrive oldest first, and `/inbox` re-sends every open card at the bottom or says "Nothing needs you".
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
- [ ] C8. After an outage the chat gets the cards it never received and the outcome edits that failed, and after more than 150 seconds every open card is re-sent with the old copy marked "↓ Re-sent below".
  - verified: qa-677 [qa] · run qa-dod-2026-10-27-677-1310 · 2026-10-27T22:56:01.696Z · commit 7ec62be14156a65b4c4b539d42bc95e3eeaa490e

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. No new runtime dependency.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (`hub/test/harness.ts`), the fake Bot API and the fake harnesses in `hub/test/fakes/` the second, Playwright the third for the web's inbox. The fake models press expiry after 150 seconds, edits refused as "message is not modified" and failed edits. No test needs a real platform, token or key, so the suite runs on droplets as it is.
- **Secrets.** A token never appears in argv, a frame, a log line, an error, a journal record or an artifact. Real tokens never go to droplets.
- **One record.** A card is a view of the hub's ask or approval (v0.2 §3.3 and §3.4). Button data is an opaque key, never trusted, and an answer is stored in the hub before Telegram is acknowledged. Declining is an answer with the value `declined` and a reason, as in the web.
- **Approvals.** Claude Code's stay in its TUI (v0.2 §3.8), shown as notices. Plan approval stays in the workbench.
- **The prototype.** `prototype/telegram-remote` at 33bf2b2e is never merged. The build may read its code and take what fits, but follows the spec (Q-1297).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** Fourth in the hub lane: follows "The Telegram remote". "Media, the upload frame and speech" follows it, and "The Discord remote" is blocked by it.

## References

- Spec: `docs/spec/v0.3.md` §3.5 (remote cards and notices), §3.1 (approvals and `via`), §3.9 (the catch-up order and the outbox) and §4; `docs/spec/v0.2.md` §3.3, §3.4 and §3.8 (one gate, declining, approvals per harness).
- Items: R-1278; the map M-1286, round-1 decision 9; Q-1294 §6 and §9; Q-1296 §1, §5, §10 and §11; Q-1292 (the cards the human accepted and a real Codex approval from the card); Q-1287 (keyboard and callback limits, the 150-second press).
- Prototype, on `prototype/telegram-remote` at 33bf2b2e: `hub/src/remote/telegram-gateway.ts` (cards, notices, the gate and the catch-up) and `hub/src/remote/sandbox-driver.ts` (asks, notices, a plan and a Codex approval posted on demand).
- Research: `docs/research/telegram-remote.md` on `research/telegram-remote` (2a81ecc9); `docs/research/messenger-bridges.md` on `research/messenger-bridges` (ffee79d8), where asks break on meaning.
- Code: `hub/src/hub/asks.ts`, `hub/src/hub/inbox.ts` (the approvals relay and its outcome's `via`), `shared/wire/index.ts`.
- GLOSSARY: Remote card (added for v0.3); Ask, Approval, Request.

## Plan

```yaml
stages:
  - name: an ask card and one gate
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1352
        - T-1353
        - T-1354
  - name: free answers, stale input, approvals and notices
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1355
        - T-1356
      - - T-1357
      - - T-1358
  - name: order, inbox and the catch-up
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1359
        - T-1360
```

## Comments

### coord · 2026-10-27T05:43:24.997Z

Plan and decisions (coord, 2026-10-27 05:5xZ). Tickets T-1352–T-1360. The plan has three stages instead of the five in the Order section, saving two Linux and macOS cover pairs; the demo order is kept within each stage. Every ticket touches telegram.ts, so landings go one at a time.
Decisions on the open questions in the draft:
1. A press on the bot's own card by someone other than the paired human gets one private answerCallbackQuery toast, with no hub request and no state change. §3.5 wins over §3.2's silence, as one narrow exception.
2. The plan notice carries the `[web] origin` link when one is set and none otherwise. It never carries a web credential link.
3. `/inbox` re-sends open notices too, oldest first, and "Nothing needs you" covers the whole inbox except pairing rows.
4. An old copy marked "↓ Re-sent below" loses its buttons, and later outcomes still edit every copy.
5. On an options-only ask, a typed reply counts only when it is an option number. Any other text gets a one-line note and the ask stays open.
6. Outcome times use hub-local HH:MM, the same format as the gap line.
The cards model lives in a module that knows nothing about a particular messenger, so E-1312 adds only Discord rendering and interaction.
Launch: stage 1 starts once E-1309 closes.

### qa-677 · 2026-10-27T22:56:01.696Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-27-677-1310
commit: 7ec62be14156a65b4c4b539d42bc95e3eeaa490e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface / executor | result | evidence |
| --- | --- | --- | --- |
| M1 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-cards.test.ts.log |
| M2 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-approvals.test.ts.log |
| M3 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-notices.test.ts.log |
| M4 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-cards.test.ts.log, hub_test_telegram-approvals.test.ts.log |
| M5 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-cards.test.ts.log |
| M6 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-cards.test.ts.log, hub_test_telegram-approvals.test.ts.log |
| M7 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-cards.test.ts.log, hub_test_telegram-approvals.test.ts.log, hub_test_telegram-notices.test.ts.log, hub_test_telegram-commands.test.ts.log |
| M8 | hub-api / local macOS | PASS | A-12931: hub_test_telegram-cards.test.ts.log, hub_test_telegram-approvals.test.ts.log, hub_test_telegram-catchup.test.ts.log |
| M9 | hub-api / local macOS | PASS | A-12931: site_test_remote-docs.test.ts.log, hub_test_remote-docs.test.ts.log |
| M10 | hub-api / local macOS | PASS (T-1357 waiver-qualified) | A-12931: C1-final.json; waiver-qualification.json; cover-summary.json |

Findings: none in scope. All C1–C8 verified in this run. Build 7ec62be14156a65b4c4b539d42bc95e3eeaa490e, clean detached checkout; freshness current:true.

Seven files ran serially on local darwin arm64 / Node v24.21.0: 120 passes, 0 failures/skips/cancellations, 115 distinct generated cases (the hub docs wrapper repeats five imported site cases). All 40 named requirements, including both generated typed-card cases, appear in passing output and pinned source. M2 checks durable via=telegram and rendered human via Telegram; M3 follows the recorded General routing decision for plan/TUI notice replies. Fake Bot API and fake harnesses only, sealed fixtureEnvironment + scratchGitEnvironment; no browser binary or real bot/account. No new full suite/load repetitions/demo lease; local lifetime and cost not applicable.

M10: all nine children closed done, all three stages closed. Eight ordinary final-review-head green verifies map to their dev landing via Item/Reviewed-by trailers and identical source deltas. T-1357 is explicitly waiver-qualified under Coordinator decision 6f1d3c54-083e-466f-88d3-def827e900cc: clear delta review at 12d65628ef2602db3679a66e7cb838cce01261fe, parent full green c35b5656/A-12790 at 3bf8db785f0806a048457b28f10647ca0226aaf2, original serial receipts A-12794 independently sum 87 files/983 passes, plus integrated stage-2 and last-stage covers containing landing 9fd28437. There is NO passed verify at T-1357's final reviewed head; it is not counted as an ordinary same-head green.

Historical last covers at c675faa34d7c1874d1aee14f2874814b11c276b5, tree 324a359b5fa6dfdd61761ffd2c78648c05060b20: Linux droplet 9f5adae6/A-12925, 5272 tests = 5263 passes +9 skips; macOS local 7872b156/A-12929, 5272 =5271 passes +1 skip; zero failures, native result0 and green cover records. Both include every landing and all 115 distinct scoped cases. T0/T1/T2/T3/base T4/Web complete; outer T4 repetitions skipped. Budgets, lint and ratchet report-only, not performance acceptance. Both Node24.21; Linux x64 CHS156.0.8078.4/build1248; historical macOS exact browser version unrecorded. Cover→pin changed only tracker, durations.json and brief; test blobs identical.

Historical Linux shards c-8 lon1: cland-v0-2752a8a5 admission-through-finish1711.15s, provider lifetime1686.064s, $0.11708778; cland-v0-4923fe2d 1350.15s, lifetime1322.053s, $0.09180924; total$0.20889701. These provider lifetimes/costs are not pure test wall time. No new droplet for QA.

Artifact A-12931: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12931-e-1310-dod-qa-clear-at-7ec62be1/report.md; complete exact-case output, source assertions, tracker/landing/cover receipts, ten recorder rows and publication scan. Verified copied evidence hashes before this verdict.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-27T22:56:36.812Z

Closed on QA clear qa-dod-2026-10-27-677-1310 (A-12931) at dev 7ec62be1: C1–C8 verified, M1–M10 PASS; T-1357 waiver-qualified in M10 under coord's decision 6f1d3c54. Last stage covers at c675faa3: 9f5adae6 (Linux, A-12925) and 7872b156 (macOS, A-12929). Children T-1352–T-1360 landed.
