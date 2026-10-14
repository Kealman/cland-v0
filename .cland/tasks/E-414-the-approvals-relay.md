---
id: E-414
kind: epic
title: The approvals relay
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-14T15:59:14.627Z
updated: 2026-10-14T15:59:14.627Z
---

## Summary

Command approvals get one record in the hub, and the hub answers them for the human where the harness's protocol allows it: the Codex app-server and OpenCode's permission API. Claude Code's approvals stay in its TUI and their records are marked "answer in Neovim"; the first answer from any client wins, and every client, Neovim included, sees the outcome.

## Goal

The human approves a command where they are, in the inbox of either client, and never has to attach a Codex or OpenCode session to do it. Today all three adapters declare `approvalRelay: 'none'`: the hub shows `waiting for approval` with the command, and the inbox's approval row only carries the session's attach command. The harnesses allow more. A Codex app-server sends each approval request to every client it serves, the first answer wins, and `serverRequest/resolved` reports it. OpenCode's server takes a reply on its permission endpoint (`once`, `always` or `reject`, with a message), and any attached TUI clears its dialog.

## Contents

- **§3.8 Approving a command from the browser.**
  - **The Codex relay.** The Codex adapter, already a client of each session's app-server, answers its approval requests (`item/commandExecution/requestApproval` and `item/fileChange/requestApproval`) with the human's decision, and closes the record when `serverRequest/resolved` says another client answered.
  - **The OpenCode relay.** The OpenCode adapter answers `permission.asked` through `POST /api/session/{id}/permission/{requestID}/reply` with `once`, `always` or `reject` and the note, and closes the record on `permission.replied`.
  - **Claude Code.** Its approvals stay in the TUI until its supervisor exposes them: the record says so, and the web marks such rows "answer in Neovim".
  - **The capability.** `approvalRelay` becomes reliable for the Codex and OpenCode adapters and stays `none` for Claude Code.
- **§3.4 One gate for answers.** An approval has one record in the hub: the session, the harness, the command or the file change in full, the choices the harness offers, since when, and its state. The first answer from any client wins, and every client sees the outcome. An answer given in the harness's own TUI closes the record with that outcome too.
- **The clients.** The records ride in the snapshot and the deltas of {E01}. The Neovim inbox shows the same records: a relayed approval's row offers its choices on keys and folds with its outcome, and a Claude Code row keeps Enter to attach. The web's approval cards in the inbox, the thread and the session's drawer are {E06}'s and {E07}'s, built on these records.

Not in this epic: the web's cards ({E06}, {E07}) and the phone's rows ({E08}); a terminal in the browser for the approvals that stay in Claude Code's TUI (0.2.x); plan approval, which keeps its own path (v0.1 §3.10).

Choices where the spec is silent:

- **The choices.** Approve once; Always for this command, the harness's own wider grant (Codex's grant for the session, OpenCode's `always`); Deny with a note. The note goes to the harness where its protocol carries one (OpenCode's message) and into the session's topic as the human's message otherwise.
- **No answer by default.** The hub never answers on a timer or by default: a record waits until a client or the harness's TUI answers it, or until the harness withdraws the request.
- **Losing the race.** A second answer is refused with who answered and when, and the client folds its card to that outcome.
- **Restarts.** Records are rebuilt from the harnesses when the adapters reconnect: a Codex app-server replays pending requests to a client that attaches, and OpenCode's snapshot lists pending permissions. No approval is lost to a hub restart.
- **The fakes.** Both already raise approvals: the fake Codex app-server sends `item/commandExecution/requestApproval`, `item/fileChange/requestApproval` and `serverRequest/resolved`, and the fake OpenCode server sends `permission.asked` and takes the reply on its endpoint. The tests drive the relays through them, extending a fake only where an answer path is missing.
- **The CLI.** `cland inbox` prints the approvals with their state, choices and outcome; answering stays with the clients.
- **This project's crew** runs its Codex roles with `approval = "never"`, so the demos launch their Codex sessions with approvals on (`approval = "on-request"`).

## Tracer-bullet order

1. **One approval record.** The hub's record built from the adapters' state, in the snapshot and the deltas, with Claude Code's marked as staying in the TUI, and `cland inbox` printing it. Demo: a fake Claude Code session waiting for approval appears once to a frame client, marked to answer in Neovim, and Neovim's inbox row still attaches it.
2. **The Codex relay.** The adapter answers the app-server's approval requests through the gate and closes the record on `serverRequest/resolved`. Demo: a frame client approves a fake Codex session's command once, the fake runs it, and every client reads the record folded with "approved once by the human".
3. **The OpenCode relay.** The adapter answers `permission.asked` through the reply endpoint and closes the record on `permission.replied`. Demo: a frame client denies a fake OpenCode permission with a note, and the fake receives `reject` with that note.
4. **The first answer wins.** Concurrent answers, answers given in the harness's TUI, and records rebuilt after a hub restart. Demo: two frame clients approve and deny the same request in one tick; exactly one outcome is recorded, and both clients read it.
5. **Neovim's inbox.** The relayed approval's choices on Neovim's inbox keys, the folded outcome, the capability table and the docs. Demo: in the headless workbench the approval row of a fake Codex session approves on its key, and a frame client reads the outcome.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, frame clients holding the web's cookie and a headless Neovim workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass). The web's cards are checked in the demos of {E06} and {E07} and in the integrated pass of {E09}.

In a scratch project with the fake harnesses, QA launches a fake Codex session with approvals on, a fake OpenCode session and a fake Claude Code session, each made to ask for approval of a command. A frame client reads three records in the snapshot: the Codex and OpenCode ones with their choices, the Claude Code one marked to answer in Neovim. QA approves the Codex command once and reads that the fake ran it; it denies the OpenCode permission with a note and reads the note in the fake's reply. Two frame clients answer a fourth request at once: one wins, the other is refused naming the winner, and both read the same outcome. QA answers a fifth request through the fake's own TUI path and reads the record closed with that outcome. QA restarts the hub with a request pending and reads its record rebuilt. In the headless Neovim workbench the inbox shows the same records and approves a sixth request on its key. `cland inbox` prints the approvals with their outcomes.

- [ ] C1. An approval has one record in the hub with the session, the harness, the command or change in full, the choices and its state, carried in the snapshot and the deltas.
- [ ] C2. Codex app-server approvals and OpenCode permission requests are answered through the hub with Approve once, Always for this command or Deny with a note, and an answer in the harness's own TUI closes the record.
- [ ] C3. Claude Code's approvals stay in its TUI, and their records say so, so that the web marks them "answer in Neovim".
- [ ] C4. The first answer from any client wins, a later one is refused naming who answered and when, and every client sees the outcome.
- [ ] C5. Nothing answers an approval on a timer or by default, and pending records survive a hub restart.
- [ ] C6. Neovim's inbox shows the same records and answers a relayed approval on its keys.
- [ ] C7. `hub/README.md`, `nvim/README.md` and the adapters' capability table describe the relay and the gate.

## Dogfooding

In this project the crew's Codex roles run with approvals off and the Claude Code roles keep theirs in the TUI, so the relay meets few live approvals. The Coordinator launches one Codex or OpenCode session with approvals on for a real task, and the human answers its approvals from Neovim's inbox, and from the browser once {E06} lands.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the harnesses' protocols as the research read them (`docs/research/web-terminal.md` §1.2 to §1.5; `docs/research/opencode-v2.md`, the permission reply); then the boards' approval card (P23).
- **Tests.** The relays are proved against the fake app-server and the fake OpenCode server at the frame seam; the real harnesses are the Implementer's and QA's manual checks, never part of `npm test`.
- **Risks.** The Codex app-server and OpenCode's HTTP API are both labelled experimental: the adapters check the request shapes they rely on and fall back to `approvalRelay: 'none'` with a warn-level event when a shape changes. A denial must never reach the harness as consent.
- **Size.** About three sessions on the v0 scale.
- **Order.** Third in the hub lane: it waits for {E02}, and {E09} waits for it. The approval cards of {E06} and {E07} answer through it without an edge; the hub lane is expected to land it before the web lane reaches them, and otherwise the Coordinator orders those slices after it.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.4, §3.6 (approvals bound to a TUI on the phone) and §3.8.
- Map M-399 and the tickets this epic absorbs: Q-400 (W12), Q-403 (the harnesses' approval paths), Q-406 (approvals marked on the phone), Q-407 (the relay), Q-408 (one gate).
- Research: `research/web-terminal` (`docs/research/web-terminal.md` §1 and §5); `research/opencode-v2` (`docs/research/opencode-v2.md`, the permission API); `research/web-prior-art` (`docs/research/web-prior-art.md` §7.2: one gate, no timers, a denial that is a denial).
- Mockups: `docs/design/web/Sessions.dc.html` (P23, the approval card), `PhoneHome.dc.html` (a Claude Code approval marked "answer in Neovim").
- Code: `hub/src/adapters/contract.ts` (`approvalRelay`), `hub/src/adapters/codex.ts` (the server requests), `hub/src/adapters/opencode.ts` (`permission.asked`).
- GLOSSARY: Adapter, Harness, Ask.
