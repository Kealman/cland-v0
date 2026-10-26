---
id: E-1309
kind: epic
title: The Telegram remote
state: open
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1308
topic: null
branch: null
created: 2026-10-25T14:11:59.394Z
updated: 2026-10-26T23:17:16.962Z
---

## Goal

The human pairs a private Telegram chat with the project's bot and follows General from the phone in both directions: agents' messages arrive under an "author · kind" header as Rich Messages, the human's text reaches the Coordinator and is confirmed with 👌 and 👀, the commands answer in a layout made for a phone screen, and an outage ends in a short catch-up instead of a replay or a silent loss. The human tried every part of this on the phone in the prototype and accepted it (Q-1292). This epic builds it on the gateway and the pairing of the first two epics, against a fake Bot API.

## Contents

- **The Bot API client** (spec §3.7). Plain `fetch` on Node 24 with hand-written types; the token validated and put into a URL only inside the client; HTTP timeouts of 30 seconds or more, since the server absorbs up to 8 seconds of flood wait; an API-root override for the fake, as `CLAND_DIGITALOCEAN_API` is for the DigitalOcean fake. Demo: against the fake Bot API, `getMe` and a send succeed, and a forced error carries no token.
- **Polling, store-then-confirm and dedupe** (§3.7, §3.9). `getUpdates` with a 30 to 50 second timeout, an HTTP timeout above it, and an explicit `allowed_updates` (messages, edited messages, callback queries, the bot's membership). The offset is confirmed only after an update is handled and stored; updates are deduplicated by update id and by chat and message id, and the bot's own messages are dropped. While offline the gateway polls with a zero timeout. Demo: an update the fake delivers twice is handled once, and a hub killed mid-update handles it after the restart.
- **Pairing on Telegram** (§3.2). Start in an unpaired chat gives the code, the sender's id and the approve command; `/start` in the paired chat names the project; `cland remote status` prints the bot's `t.me/<bot>` link. An update from another chat, sender or update type is dropped before any work, downloads included. A bot the human blocked learns it from its membership update and a 403, stops sending and reports it. Demo: the fake plays a stranger and the human, and only the approved human's messages count.
- **The mirror out** (§3.4). General with the "author · kind" header; the human's workbench messages under "you" and Discord's under "you (Discord)"; nothing the human sent from this chat, no answers and no asks to the human sent as messages. A Rich Message by default (GitHub Flavored Markdown with tables and lists, up to 32768 characters, entity detection off); plain text with an entities array the gateway computes when `format = "entities"` and after any rejection; never MarkdownV2; link previews off. The plain path splits at 4096 code points and before the 101st styled entity, at block boundaries and never inside an entity, with parts numbered "n/m"; a conversion error falls back to plain text and never drops a message. Progress notes and hub notices arrive silently. Demo: an agent's report with a heading, a table and code arrives rich; a rejected Rich Message arrives as plain text with entities; a long plain-format message arrives in numbered parts; a progress note arrives without a notification.
- **The mirror in** (§3.4). Free text becomes the human's `message` in General to the Coordinator with `via = "telegram"`; `/decision <text>` and `/question <text>` send the other kinds; mentions resolve as in the workbench, and `@aide` is no mention; a reply to a mirrored message goes to its topic as a reply; the human's own formatting is dropped. 👌 follows once General has the message, and 👀 once the addressee's session has it. Demo: a reply to an agent's message lands in that topic, and the two reactions arrive in order.
- **Mute** (§3.4). `/mute` silences the General stream while cards and notices still arrive; `/unmute` posts one line, "N messages arrived while muted"; `[remote] mute_default` sets the state a new pairing starts in. Demo: three General messages during mute are counted on unmute.
- **Commands and their layout** (§3.10). `/status`, `/inbox`, `/mute`, `/unmute`, `/decision`, `/question`, `/cancel`, `/help`, and `/start` in a paired chat; the menu registered for private chats only when it differs from what Telegram holds. A reply opens with a title line, then groups separated by blank lines under bold labels (Hub, Coordinator, Sessions, Queues, Release, This chat), one fact per line, the sessions as bullets and the gateway's numbers last as small text; `/help` is short headed sections with the commands as a bullet list and the trust lines last; replies go as text with entities. Demo: `/status` and `/help` render in that layout, and a second hub start registers no menu.
- **Pacing** (§3.7, §3.9). One queue per chat with one request in flight, about a message a second, cards first; a 429 holds the whole bot for its `retry_after`, at most 5 minutes; no limit beyond the documented ones is hard-coded. Demo: a burst of 20 General messages on a fake that answers one 429 arrives complete and in order after the wait.
- **Catch-up, liveness and telling the human** (§3.9). After an outage the chat gets what Telegram kept, each late message marked with the time it was written ("written on Telegram at 13:20; the hub was down until 13:24"), then one gap line, "N General messages missed since 13:20", only when N is above 0. A poll that has not returned within its timeout plus 15 seconds restarts the loop, and the remote shows as connected only after a recent successful exchange. The poller lease rides out a 409 at start for up to 60 seconds, and a lasting 409 shows as "another consumer of the token" in General and `cland remote status`. After 3 minutes offline the hub writes one line to General ("Telegram remote offline since 13:20: <reason>") and one on recovery. A 401 or a 403 stops only this remote, with the cause and the fix in General. Demo: a 10-second fake outage with three General posts ends in one gap line; a four-minute one also writes the offline and recovery lines; a 401 stops the remote with its fix while the hub serves on.

Not in this epic: cards, notices and approvals, with the cards' part of the catch-up ("Remote cards and approvals"); photos, files and voice ("Media, the upload frame and speech"); setup's step, doctor's lines and the Remotes row ("Setup, doctor, onboarding and the workbenches").

## Order

1. **Client, polling and pairing.** Demo: on the fake Bot API a stranger gets a code, `cland remote approve telegram <code>` pairs the human, one General message arrives with its header, and one sent from the chat reaches the Coordinator.
2. **Rendering and splitting.** Demo: rich by default, the entities fallback after a rejection, numbered parts on the plain path.
3. **The mirror in, the reactions and mute.** Demo: replies routed to their topics, 👌 then 👀, the unmute count.
4. **Commands and pacing.** Demo: the phone layout of `/status` and `/help`, the menu written only on change, a burst through a 429.
5. **Catch-up, liveness and failure.** Demo: short and long outages, a stalled poll, a lasting 409 and a 401.

## Definition of done

QA runs the demo below on `dev` against the fake Bot API in the suite, playing the human and a stranger through the fake's control API, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The live run with the human on the sandbox bots is not part of this epic: it happens once, before the release, in "Release v0.3.0 from the item".

In a scratch project with a made-up token, QA enables Telegram, plays a stranger who gets a code and at most two replies, and pairs the human with `cland remote approve telegram <code>`. It posts an agent's report with a heading, a table and code, a long message under `format = "entities"`, a progress note and a message the fake rejects as a Rich Message, and reads each on the fake. As the human it writes free text, a `/decision`, a reply to an agent's message and a message with bold text, and reads them in General with their `via`, the reactions and the dropped formatting. It mutes and unmutes around three General messages, runs every command and reads the replies' layout, and floods 20 messages against a 429. It then takes the remote offline for 10 seconds and for four minutes, stalls a poll, answers a poll with a lasting 409 and finally with a 401, reading the chat, General and `cland remote status` at each step while the hub keeps serving.

- [ ] C1. The client uses plain `fetch` with an API-root override, validates the token before any URL is built, and no error, log line or artifact carries the token.
- [ ] C2. Updates are handled and stored before the offset advances, deduplicated by update id and by chat and message id, and only the paired chat and sender count.
- [ ] C3. Start gives a code with the sender's id and the approve command, a stranger gets at most two replies, and a blocked bot stops sending and reports it.
- [ ] C4. General arrives with the "author · kind" header as Rich Messages, falls back to plain text with entities after a rejection, splits on the plain path into numbered parts, and never sends back what the human wrote in the chat.
- [ ] C5. The human's text reaches General as their message with `via`, `/decision` and `/question` send their kinds, a reply goes to its message's topic, formatting is dropped, and 👌 and 👀 follow.
- [ ] C6. Progress notes and hub notices arrive silently, `/mute` silences only the General stream, and `/unmute` reports how many messages arrived meanwhile.
- [ ] C7. Every Telegram command answers as spec §3.10 says, laid out for a phone screen, and the menu is registered only when it differs.
- [ ] C8. One request is in flight per chat, and a 429 holds the whole bot for its `retry_after`, at most 5 minutes, with nothing lost or reordered.
- [ ] C9. After an outage the chat gets late messages marked with their time and one gap line above 0, and General gets an offline line after 3 minutes and a recovery line.
- [ ] C10. A stalled poll restarts after its timeout plus 15 seconds, a lasting 409 shows as another consumer of the token, and a 401 or 403 stops only this remote with its cause and fix in General.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. No new runtime dependency and no Telegram library: grammY's errors carry the token-bearing URL.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (`hub/test/harness.ts`), and a fake Bot API in `hub/test/fakes/` the second, with a control API that plays the human. The fake models what the prototype met: Rich Message rejections, a 429 with `retry_after`, a 409, a stalled long poll, the bot's membership updates and duplicate updates. No test needs a real platform, token or key, so the suite runs on droplets as it is.
- **Secrets.** The token goes into a URL only inside the client, and the file URL that embeds it never leaves the hub. A token never appears in argv, a frame, a log line, an error, a journal record or an artifact. Real tokens never go to droplets.
- **Telegram.** Never MarkdownV2. One poller per token, and a conflict is reported, never settled by stopping another process. No limit beyond the documented ones is hard-coded.
- **Risks.** After a plain hub restart the gap line is almost always 0, since nothing posts to General while the hub is down (Q-1292), so the demo makes outages while the hub runs. A 50-second long poll hid recovery in the prototype, hence the zero-timeout poll while offline.
- **The prototype.** `prototype/telegram-remote` at 33bf2b2e is never merged. The build may read its code and take what fits, but follows the spec (Q-1297).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** Third in the hub lane: follows "Pairing, secrets and configuration". "Remote cards and approvals" follows it.

## References

- Spec: `docs/spec/v0.3.md` §3.2 (pairing), §3.4 (the mirror), §3.7 (Telegram), §3.9 (delivery, catch-up and failure), §3.10 (commands), §3.12 (hygiene) and §4.
- Items: R-1278; the map M-1286, round-1 decisions 2, 3, 6, 10, 14 and 15; Q-1287 (the Bot API facts); Q-1292 (the human's acceptance on the phone, the restart and outage checks on the fake); Q-1293 (the replies' layout and the "you (Discord)" mark); Q-1294 §10; Q-1296 §1 to §10.
- Prototype, on `prototype/telegram-remote` at 33bf2b2e: `hub/src/remote/README.md`, `hub/src/remote/telegram-gateway.ts`, `hub/src/remote/telegram-api.ts`, `hub/src/remote/markdown.ts`, `hub/src/remote/replies.ts`; `hub/src/remote/discord/fake-discord.ts` as the model of a fake platform with a control API that plays the human.
- Research: `docs/research/telegram-remote.md` on `research/telegram-remote` (2a81ecc9), 38 rules; `docs/research/messenger-bridges.md` on `research/messenger-bridges` (ffee79d8).
- Code: `hub/src/executor/droplet/api.ts` and `hub/test/fakes/digitalocean/fake-api.ts` (a platform client and its fake).
- GLOSSARY: Remote, Gateway, Gap line and Outbox (added for v0.3); General.

## Plan

```yaml
stages:
  - name: telegram remote
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1340
        - T-1341
        - T-1342
        - T-1346
      - - T-1343
        - T-1347
        - T-1345
      - - T-1344
      - - T-1349
        - T-1348
```
