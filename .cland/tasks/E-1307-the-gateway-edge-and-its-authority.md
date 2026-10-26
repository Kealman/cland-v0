---
id: E-1307
kind: epic
title: The gateway edge and its authority
state: closed
criterion_seq: 9
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1074
branch: null
created: 2026-10-25T14:11:59.144Z
updated: 2026-10-26T09:06:38.240Z
closed: 2026-10-26T09:06:38.240Z
---

## Goal

The hub gains the gateway: an edge inside the hub process that will serve the Telegram and Discord remotes. It holds one conversation with the dispatcher as the identity `human`, may do no more than send, answer, approve and read what `/status` and `/inbox` need, records `via` on everything a remote does, keeps the remote's state in `hub.db`, queues its sends in a durable outbox, and confines a failure to one remote. The epic builds all of it against a test messenger in the suite, so the messenger epics only add their clients. The prototypes showed that such an edge keeps the hub's changes small, and that an ask's outcome lacked `via` (Q-1292).

## Contents

- **The in-process edge** (spec §3.1). The gateway receives the frames a client receives (messages, the inbox, asks, approvals, delivery stages) and sends a client's requests over one dispatcher conversation, as the identity `human`. No new protocol, socket or listener, and no hub secret; it starts and stops with the hub and runs one remote per active messenger. Demo: a test messenger behind the gateway receives a General message an agent posts, and its reply reaches the Coordinator as the human's message.
- **The remote's authority** (§3.1). A deny-by-default table checked before dispatch: `topic.send` into General or as a reply into the replied-to message's topic, `topic.answer`, `approval.answer`, and the reads `hub.status`, `task.list` and `inbox.list`. Everything else is refused with a reason: session launch or stop, release, push, sync, configuration, artifact actions and pairing approval. Demo: each allowed request works through the test messenger, and each refused one names its refusal.
- **`via`** (§3.1). `"telegram"` and `"discord"` join the values on messages, answers and approvals, and an ask's outcome records `via` as an approval's already does. Demo: an ask and a fake Codex approval answered through the test messenger read "via Telegram" in Neovim's and the web's inbox.
- **The remote's state in `hub.db`** (§3.1). The pairings, the waiting codes and the replies counted per stranger, the cursors, the poller lease, Discord's identify count, the outbox, and the map from chat messages to cland messages, topics and asks, with no separate state file. Discord ids are stored as TEXT, since they exceed JavaScript's safe integers and `node:sqlite` reads 64-bit integers back lossily. Demo: state written before a hub restart reads back unchanged after it, an id above 2^53 included.
- **The outbox** (§3.9). One durable queue per remote: an attempt record before each send; a resend only for what provably never left, with the proof supplied by the messenger's client (Discord's enforced nonce, Telegram's message map); merged edits; a job whose source closed dropped, such as the card of an answered ask; during an outage, General jobs marked missed and counted for the gap line instead of dropped; a job queued while the outbox drains sent in that drain; a `retry_after` wait capped at 5 minutes; reconnection backed off with jitter and a cap. Demo: while the test messenger refuses sends, three General messages are marked missed and counted, a card whose ask is answered meanwhile is dropped, nothing leaves twice after recovery, and a job queued mid-drain leaves in that drain.
- **The poller lease** (§3.9). A lease in `hub.db` with the pid and start time, so that one gateway per project consumes a token; a conflict at start is ridden out for up to 60 seconds and nothing is killed. Demo: a second gateway on the same `hub.db` waits for the lease and stops nothing.
- **Failure confined to one remote** (§3.1). A remote that throws at start or later disables only itself, with the reason in the log and in the remote's state; the hub, the web edge and the other remote serve on. Demo: a test messenger that throws at start leaves a second one and the web edge working.
- **The ADR 0003 amendment.** It names the gateway: an edge of the one frame protocol inside the hub process, connecting out only, with its own authority table.

Not in this epic: the Telegram and Discord clients ("The Telegram remote", "The Discord remote"); secrets, configuration and pairing ("Pairing, secrets and configuration"); what is mirrored and how it renders, with the echo rules ("The Telegram remote"); cards ("Remote cards and approvals"); `artifact.upload` ("Media, the upload frame and speech"); the offline and recovery lines in General, which come with the Telegram remote's liveness.

## Order

1. **The edge and its table.** The test messenger on the dispatcher, the allowed and the refused requests. Demo: a General message out and a reply in; every refused request named.
2. **`via` everywhere.** Messages, answers, approvals and ask outcomes. Demo: answers through the test messenger read "via Telegram" in both workbenches.
3. **State and the lease.** The tables, TEXT ids and the lease. Demo: the state survives a restart, and a second gateway waits on the lease.
4. **The outbox.** Attempts, provable resends, merged edits, missed jobs and the drain. Demo: the test messenger's outage described above.
5. **Failure and the ADR.** Isolation and the amendment. Demo: a remote that throws leaves the rest serving; the amendment is on `dev`.

## Definition of done

QA runs the demo below on `dev` through the hub's frame protocol, with the test messenger in the suite standing in for a messenger platform, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real platform, token or key is involved.

In a scratch project, QA starts the hub with two test messengers behind the gateway. It posts in General as an agent and reads the message at both, sends from one and reads it in General as the human's message with its `via`, and tries every refused request. It answers an ask and a fake Codex approval through the gateway and reads "via Telegram" in headless Neovim and headless Chromium. It restarts the hub and reads the state back, a Discord-sized id included. It makes one test messenger refuse sends while three General messages pass and an open card's ask is answered, then reads the missed count and the dropped card and checks that nothing leaves twice. It starts a second gateway on the same `hub.db`, and makes the other test messenger throw at start while the first and the web edge keep serving. Finally QA reads the ADR 0003 amendment.

- [ ] C1. The gateway runs inside the hub as the identity `human` on one dispatcher conversation, with no new socket, listener or hub secret, and starts and stops with the hub.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C2. A remote may only send into General or reply into the replied-to topic, answer, approve and read `hub.status`, `task.list` and `inbox.list`, and every other request, pairing approval included, is refused with a reason.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C3. Messages, answers, approvals and ask outcomes from a remote record `via`, and Neovim and the web show it.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C4. The remote's state lives in `hub.db` with no separate file and survives a hub restart unchanged, Discord ids above 2^53 included as TEXT.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C5. The outbox records an attempt before each send, resends only what provably never left, merges edits, drops jobs whose source closed, and counts General jobs missed during an outage.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C6. A job queued while the outbox drains leaves in that drain, a `retry_after` wait never exceeds 5 minutes, and reconnection backs off with jitter and a cap.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C7. A second gateway on the same `hub.db` waits on the poller lease for up to 60 seconds and stops nothing.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C8. A remote that fails at start or later disables only itself, and the hub, the web edge and the other remote serve on.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
- [ ] C9. ADR 0003 carries an amendment naming the gateway as an outbound-only edge of the one frame protocol with its own authority table.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1307 · 2026-10-26T09:05:22.500Z · commit a5d678520989ed9fc11ae0ddc211736e5a7f3dd3

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. No new runtime dependency.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fakes in `hub/test/fakes/` the second; here the fake is a test messenger behind the gateway. No test needs a real platform, token or key, so the suite runs on droplets as it is.
- **Secrets.** A token or key never appears in argv, a frame, a log line, an error, a journal record or an artifact. Real tokens never go to droplets.
- **The authority.** The table is deny by default and checked before dispatch, as the web's is (`hub/src/hub/web-authority.ts`), and never grows past spec §3.1. A remote's media are the hub's own act, never an artifact action of the remote.
- **ADRs.** 0003 (the hub is a per-project daemon): the gateway is an edge of the one frame protocol, and this epic amends the ADR. 0001 (roles are hub-held state): the gateway acts as the identity `human`, never as a session or a role.
- **The prototype.** `prototype/telegram-remote` at 33bf2b2e is never merged. The build may read its code and take what fits, but follows the spec (Q-1297).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** First in the hub lane. "Pairing, secrets and configuration" follows it.

## References

- Spec: `docs/spec/v0.3.md` §3.1 (the gateway edge and its authority), §3.9 (the outbox, one poller, failure), §3.12 (hygiene) and §4 (the cut).
- Items: R-1278; the map M-1286, round-1 decisions 4 and 5; Q-1294 §2, §5 and §6; Q-1296 §2, §6 and §11; Q-1292 (the in-process edge and the missing `via`); Q-1293 (TEXT ids and the send-queue race).
- Prototype, on `prototype/telegram-remote` at 33bf2b2e: `hub/src/remote/README.md`, `hub/src/remote/authority.ts`, `hub/src/remote/remote-store.ts`, and the hub changes marked `PROTOTYPE (Q-1292)` in `hub/src/hub/dispatch.ts`, `hub/src/hub/core.ts`, `hub/src/hub/daemon.ts` and `hub/src/protocol.ts`.
- Research: `docs/research/messenger-bridges.md` on `research/messenger-bridges` (ffee79d8), the failure classes and the patterns behind the outbox and the lease.
- Code: `hub/src/hub/web-edge.ts`, `hub/src/hub/web-authority.ts`, `hub/src/hub/dispatch.ts`, `hub/src/hub/core.ts`, `hub/src/hub/asks.ts`, `hub/src/hub/inbox.ts`, `hub/src/hub/store.ts`, `shared/wire/index.ts`; `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- GLOSSARY: Gateway, Remote and Outbox (added for v0.3); Hub, Ask, Approval.

## Plan

```yaml
stages:
  - name: gateway edge
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1321
      - - T-1327
      - - T-1322
      - - T-1323
        - T-1324
        - T-1325
      - - T-1326
```

## Comments

### qa-677 · 2026-10-26T09:05:22.500Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-26-677-1307
commit: a5d678520989ed9fc11ae0ddc211736e5a7f3dd3
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

QA clear at a5d678520989ed9fc11ae0ddc211736e5a7f3dd3; run qa-dod-2026-10-26-677-1307. All manual checks in qa/briefs/E-1307.md passed. Verified C1,C2,C3,C4,C5,C6,C7,C8,C9. No findings.

| Check | Result | Observation |
|---|---|---|
| M1 | PASS | 18/18; identity, conversation, lifecycle, authority and remote failure isolation |
| M2 | PASS | No new listener, socket or hub secret; existing dispatcher and lifecycle |
| M3 | PASS | 6/6 + 11/11 + 1/1 + 2/2; source attribution and prior outcome compatibility |
| M4 | PASS | 4/4 + 9/9; restart persistence, TEXT ids, gateway lease |
| M5 | PASS | 25/25 + 1/1; durable attempt/map, fencing, coalescing, source recheck and outage policy |
| M6 | PASS | All four named drain/rate-limit/reconnect cases passed |
| M7 | PASS | 9/9 plus gateway lease cases; wait, owner preservation, expiry and release |
| M8 | PASS | 3/3 plus stored/logged failure-reason redaction case |
| M9 | PASS | Outbound-only in-process edge; one protocol; human identity; authority table |
| M10 | PASS | 7/7 children closed done, clear review plus same-head green verify; landed; stage closed; both covers green and scoped names present |

Local clean detached checkout; macOS arm64 / Node v24.21.0. Eleven files ran serially once: 89 tests, 89 passes, 0 failures/skips/cancellations/todos. Native generated names and summaries checked independently of exit 0. M6 and the reused M7/M8 gateway evidence add no tests. Web built at the pin with matching source stamp; isolated Playwright chromium_headless_shell-1248, Google Chrome for Testing 156.0.8078.4, dedicated scratch profile, positive 4-to-0 browser cleanup censuses. No human browser or real platforms used.

M10 independently matched all seven child latest clear reviews to green same-source-head native verifies, equivalent squash landings and ancestry into the stage covers. Linux 56552bb3/A-12333 and macOS f6f259ee/A-12338 at fb73592a164a277fbd5cffb3bf390e268f47fd96 are green and contain all 89 scoped names. T0, T1-T4 base and Web completed; 14 T4 files base-only, outer repetitions skipped. Budget/ratchet/lint were report-only. Linux x64 6.8.0-142-generic, Node24.21.0, Nvim0.12.5, Headless Shell156.0.8078.4; two c-8 lon1 shards lifetimes1386781/1388978ms, total cost$0.19276104166666666. macOS arm64 27.0.0 local cover; historical exact browser binary unrecorded. No new full suite, performance measurement or wall-time claim.

Earlier macOS A-12337 remains failed: "database is locked"; "could not verify the droplet watchdog process identity"; "remote group started: not within 30000 ms" with nested fixture lifetime expiry. Coordinator classified these as load flakes and filed T-1335; no independent causal reproduction claimed. All three exact names pass in each later green cover.

Freshness current:true at pinned SHA; no demo lease. Recorder M1-M10, complete criterion-to-case mapping, commands and receipts, redacted diagnostics and publication scan: A-12342, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12342-e-1307-dod-qa-clear-at-a5d67852/report.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.
