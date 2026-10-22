---
id: E-413
kind: epic
title: Hub-computed fields and read marks
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-412
topic: topic-804
branch: null
created: 2026-10-14T15:59:14.313Z
updated: 2026-10-22T04:23:52.615Z
---

## Summary

The hub computes once, for both clients, what Neovim computes in Lua today: unread counts, merged session rows, the explorer's roll-ups and summaries, the events filter and the card's facts, so that no client needs a request per card. The human's last look and read marks move into the hub, a run of agent messages gets a fold line built from facts, and declining an ask becomes an answer with a reason.

## Goal

Both clients show the same numbers and agree on what the human has seen, and the browser duplicates no client logic. Today a topic's unread count moves by counting `message` frames, a session row merges two reads, the explorer's tree, roll-ups and summary rule run in Lua (`explorer_summary.lua` alone is 333 lines), and the events' last look and the plans' marks live in Neovim's `ui.json`. The Q-405 prototype had to port about 850 lines of that logic to TypeScript; its unread counts only grew (the Agents topic reached 14,927), and its events' last look disagreed with Neovim's at once. A card costs a `task.view` (52 kB for T-347) and an epic row a `task.plan show`: Neovim sent 1,780 and 564 of them in the 61 hours Q-400 measured.

## Contents

- **§3.3 Computed once in the hub, for both clients.**
  - **Unread counts.** A topic's `unread` and `lastMessageAt` travel with every message delta, so no client counts frames.
  - **Merged session rows.** One sessions projection: the process row with presence, the role, the item with a verifier's hold and +N or a requested item dimmed (v0.1.2 §3.4), the state with its age and the command it waits on, the account and the usage.
  - **The explorer's roll-ups and the summary rule.** On each item summary: the summary with its provenance line by the v0.1.2 §3.9 rule; for a container, done/total, the status breakdown, the derived status, glyph and layer, the stage in work, the claims and holds of its tasks, the latest verdict of its subtree naming the item, and the last activity naming its source; for every item, a `blocked` flag; for every container, its `next` item.
  - **The events filter**, by kind, warnings and subject, held with a connection's subscription, so its first page and its live rows arrive filtered.
  - **The last look and the read marks per human** (§3.6): the events' last look, each plan's last look and the topics' read marks are held in the hub per human, not per client, so Neovim and every browser agree.
  - **The card's facts in the snapshot and the deltas:** the latest verdict's one-line reason, round and scope; the Decision block; each stage's state for an epic with a plan; the sections and size of the agents' text for its fold line. No client needs a `task.view` per card or a `task.plan show` per epic row; the full body and the comments come only when the human opens the agents' text.
- **§3.4 Threads and actions, the hub side.**
  - **The fold line.** A run of agent messages folds into one line that the hub builds from facts: who, how many messages, the latest step and the age; never written by a model.
  - **The answered ask.** An ask's record carries its outcome (the option or the free answer, who answered, when) into the thread for good and into the inbox's delta, so that a client folds it in place to one line.
  - **Declining.** Declining an ask is an answer with the value `declined` and a reason: the asker receives it as any answer, the topic stays open and may ask again, and there is no separate "ask me later".
  - **The inbox's leave rule, refined** (v0.1.2 §3.7): the hub reports an answered row with its outcome, and a client keeps it folded until the human leaves the inbox; then it goes to the archive, so rows never move under a finger.

Not in this epic: approvals (E-414); the web views that show these fields (E-416 to E-419); Neovim's own explorer and thread switching to the hub's fields and fold lines, which waits until Neovim adopts the extension in 0.2.x.

Choices where the spec is silent:

- **The rules move, guarded.** The summary rule and the roll-ups move from Lua into the hub in TypeScript, with a differential test against `explorer_summary.lua` and the Lua roll-ups on the live tracker's bodies; the Q-405 port's zero differences over 410 bodies is the bar. Neovim keeps its Lua until it adopts the extension in 0.2.x, under the same test.
- **Incremental.** The roll-ups are recomputed for the changed item's ancestors only, and a delta carries just the items whose fields changed.
- **Marks.** A mark only moves forward, and the latest from any client wins. Neovim moves its events' last look and its plans' marks from `ui.json` to the hub, reading and setting them through frames, with a one-time import of the values `ui.json` holds; `ui.json` keeps Neovim's interface state (filters, folds, the current release). Pins and mutes stay where they are, since the hub already applies them to every client's layers.
- **What counts as read** is the client's act, sent as `topic.read` up to a message number: Neovim keeps its rule (a thread in view), and the web's rule is E-417's. The hub keeps the highest mark per human.
- **The events filter** is sent with `subscribe` and on each change; a connection without one gets every row, as Neovim does today.
- **Runs.** A run is consecutive agent-to-agent messages with nothing between them that never folds (an ask, a verdict, an answer, anything to or from the human or an Aide), as v0.1 §3.14 says. The hub gives each run an id, its first message number, and sends its fold line with the history pages and in a delta each time the run grows. The fold line names the first three sessions and a count of the rest, the number of messages, the latest message's kind and first words, and its age.
- **Declining.** `topic.answer` takes `declined: true` with a non-empty reason; the asker's delivery reads `declined: <reason>`. Neovim shows a declined ask folded with its reason; declining from Neovim is not added in 0.2.0. The role clauses say how a session treats a declined ask: as a decision, never as consent.
- **The answered row's outcome** comes in the inbox's departure, `answered` or `declined`, with who and when; how long a client keeps the folded row is the client's.

## Tracer-bullet order

1. **Fields on the item summary.** The summary with its provenance, the roll-ups, `blocked` and `next`, the verdict's reason, the Decision block, the stage states and the fold line of the agents' text, in the snapshot and the deltas, with the differential test against the Lua. Demo: on a copy of the live tracker every item's summary and roll-ups in the hub equal the Lua's, and a frame client reads a card's summary, verdict reason and decision without a `task.view`.
2. **Unread counts and one sessions projection.** `unread` and `lastMessageAt` with every message delta, and the merged session rows. Demo: a frame client's unread count for a topic follows three new messages without counting frames, a verifier's row carries its hold with +N, and a waiting row its command.
3. **Marks per human and the events filter.** The events' last look, the plans' marks and the topics' read marks in the hub, Neovim moved onto them, and the filter on the subscription. Demo: opening the events view in the headless Neovim workbench sets the last look that a frame client then reads, and a subscription filtered to warnings receives only warning rows.
4. **The fold line and the answered ask.** Runs with their fold lines in the history pages and the deltas, and the answered ask's outcome in the thread and in the inbox's departure. Demo: four agent messages arrive as one fold line naming both sessions, four messages, the latest step and its age, and a fifth updates the same run without a re-read.
5. **Declining.** `declined` with a reason through `topic.answer`, delivered to the asker, the topic left open, and the clauses updated. Demo: a fake Implementer's ask declined with a reason receives `declined: <reason>`, and its topic stays open for its next ask.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, a frame client holding the web's cookie and a headless Neovim workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project holding a copy of the live tracker and the fake harnesses, QA runs the differential test of the summary and the roll-ups against the Lua and reads zero differences. A frame client takes the snapshot and reads a task's card facts (the summary with its provenance, the verdict's reason, the Decision block) and an epic's stage states without a `task.view` or a `task.plan show`. QA sends three messages into a topic and reads its unread count from the deltas, and reads a verifier's merged session row with its hold and +N. QA opens the events view in the headless Neovim workbench and reads the same last look from the frame client, then marks a topic read in the frame client and reads it read in Neovim. A subscription filtered to warnings receives only warnings. A fake Implementer and a fake Reviewer exchange four messages, and the frame client reads one fold line that a fifth message updates. The frame client answers one ask with an option and declines another with a reason: both fold with their outcomes in the thread and in the inbox's departures, the asker receives `declined: <reason>`, and the topic stays open.

- [ ] C1. Item summaries carry the summary with its provenance, the container roll-ups, `blocked` and `next`, the verdict's reason, the Decision block and the stage states, equal to the Lua's rules on a copy of the live tracker.
- [ ] C2. A topic's unread count and last message time come with every message delta, and sessions come as one merged projection.
- [ ] C3. The events' last look, each plan's last look and the topics' read marks are held in the hub per human, and Neovim and every browser read and set the same marks.
- [ ] C4. A subscription can carry the events filter, and its first page and live rows arrive filtered.
- [ ] C5. A run of agent messages comes with a fold line built from facts (who, how many, the latest step, the age) that follows the run as it grows.
- [ ] C6. An answered ask carries its outcome in the thread and in the inbox's departure, and declining is an answer with the value `declined` and a reason that the asker receives, with the topic left open.
- [ ] C7. `hub/README.md`, `nvim/README.md` and the role clauses describe the fields, the marks, the fold line and declining.

## Dogfooding

From this epic on Neovim and the browser agree on what the human has seen: the events' last look, the plans' marks and the topics' read marks are the same in both, and the web's card shows the summaries and roll-ups Neovim's explorer draws.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the Lua rules (`nvim/lua/cland/explorer_summary.lua`, `explorer.lua`, `explorer_card.lua`, and the thread's folds in `thread.lua`), which define the results; then the Q-405 port (`web/src/summary.ts`, `web/src/explorer.ts`, `web/proto/summary-lua.test.ts` on `prototype/web-shell`), a reference never merged.
- **ADRs.** 0002 (Tracker files are the source of truth): the computed fields are projections, never written into item files. 0007 (Events reach sessions as deliveries): a declined answer reaches the asker as a delivery.
- **Risks.** Computing the roll-ups on every tracker change must not cost the event loop: recomputation per subtree, measured on the live tracker. Moving the marks out of `ui.json` must not lose the human's current last look. A declined ask must never read as consent.
- **Size.** About four sessions on the v0 scale.
- **Order.** Second in the hub lane: it waits for E-412. E-414 waits for it, and so does E-417 in the web lane. E-416 reads this epic's fields without an edge, so this epic's first slice is the one to land early.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.3, §3.4 and §3.6; `docs/spec/v0.1.2.md` §3.4, §3.7, §3.8 and §3.9; `docs/spec/v0.1.md` §3.14.
- Map M-399 and the tickets this epic absorbs: Q-400 (W10 and W11), Q-405 (its open points on read marks, the last look and the card's reads), Q-406 (declining), Q-407 (the fields and the marks), Q-408 (the fold line and the answered ask).
- Research: `research/web-client-surface` (`docs/research/web-client-surface.md` §3.2, the table per web area, and §4, W10 and W11); `research/web-prior-art` (`docs/research/web-prior-art.md` §7.2: the fold line, and an answer that must not read as consent).
- Prototype: `prototype/web-shell` (`web/PROTOTYPE.md`; `web/src/summary.ts`, `web/src/explorer.ts`, `web/proto/summary-lua.test.ts`).
- Mockups: `docs/design/web/Thread.dc.html` (P13), `PhoneThread.dc.html` (P32), `PhoneAsk.dc.html` (P37, P38).
- GLOSSARY: Summary, Card, Explorer, Ask, Events view.

## Plan

```yaml
stages:
  - name: fields
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1052
        - T-1058
        - T-1081
        - T-1089
        - T-1091
        - T-1093
      - - T-1053
        - T-1055
  - name: marks and threads
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1054
      - - T-1056
      - - T-1057
        - T-1059
```

## Comments

### qa-676 · 2026-10-22T04:23:03.873Z

verdict: qa
result: not clear
by: qa-676 [qa]
run: qa-s1-2026-10-22-1
commit: a0ab98362a9c34e7cefd4660ca62d9c264a3fcbc
stage: fields
stage_hash: 367d6e0f0698d54efb688a5147c3ef148b59a907dd842b3b018cb8740d778a94
findings: [{"severity":"low","text":"E413S1-15 FAIL, in scope T-1081 C5. Reading lines 722–733 and 841–854 shows “Counts and container progress reflect the loaded summaries until this fetch completes” and a refresh of “the requested closed list”, contradicting authoritative full hub roll-ups and per-parent pages demonstrated by E413S1-10/14. Coordinator bcd68aa3 accepted the docs finding. No fix made.","file":"nvim/README.md","line":727},{"severity":"low","text":"E413S1-00 brief setup correction: init creates C-1..C-4; overlaying the committed tracker left 1096 files rather than exact 1092. Authorized decision 7b31ad72: stop scratch hubs, replace only p1/.cland/tasks with W committed copy, verify 1092, restart. Exact commands in setup-correction.sh; original capture preserved.","file":"qa/briefs/E-413-stage-1.md"},{"severity":"low","text":"E413S1-00 brief environment correction: original prefix count 1 named GH_PAGER only; no credential exposure established. Under 7b31ad72 every later scratch process uses the complete fixtureEnvironment result after overlays, scratch paths and final prefix removal; prelaunch count 0. run.mjs preserves PATH/SHELL/TERM/system TMPDIR. Both scratch hubs were restarted under it. Original env and output retained.","file":"qa/briefs/E-413-stage-1.md"},{"severity":"low","text":"E413S1-22 brief oracle correction, authorized 43149d5a: outgoing-send boundaries gave midAdvances 0; boundaries at result t and result none give 1. Expected model.advance seq73 lies after sending reset and before its reply. Same raw capture, no product rerun, both outputs retained.","file":"qa/briefs/E-413-stage-1.md"},{"severity":"low","text":"E413S1-28 brief cleanup probe is global: pgrep count 1 then immediate PID/name-only follow-up 0. All five fixture-owned census lines already reported after 0; scratch hub stopped. Decision 79502bbb accepts PASS with limitation. Coordinator reports other Web test sessions; attribution of the vanished match remains unproven. Use fixture-owned process checks.","file":"qa/briefs/E-413-stage-1.md"}]
finding_counts: {"high":0,"medium":0,"low":5}

| Case | Result | Observation / evidence |
| --- | --- | --- |
| E413S1-00 | PASS | p1 and p2] bash E413S1-00.sh via run.mjs (saved exact command); Exact detached S and seven merged items; clean. Authorized setup correction: exact committed 1092 files, sealed prefix count 0 after filtering GH_PAGER by key name only; scratch hubs restarted. [E413S1-00-output.txt](E413S1-00-output.txt) |
| E413S1-01 | PASS | 1/1 Lua differential; 1092 bodies plus 3 ancestor regressions, 0 differences; copied snapshot 119318 bytes. [E413S1-01-output.txt](E413S1-01-output.txt) |
| E413S1-02 | PASS | 107 open rows, complete ancestor chains and computed facts; 22/22 targeted tests. Original trailing wrapper extraction error retained separately after successful checks. [E413S1-02-output.txt](E413S1-02-output.txt) |
| E413S1-03 | PASS | T1057 edit published exactly T1057, E413, R377 with updated ancestors. [E413S1-03-output.txt](E413S1-03-output.txt) |
| E413S1-04 | PASS | 2/2 scale tests; macOS first hub.status 2358.5ms; startup replies 463777 bytes. [E413S1-04-output.txt](E413S1-04-output.txt) |
| E413S1-05 | PASS | All summary-field documentation needles present and consistent. [E413S1-05-output.txt](E413S1-05-output.txt) |
| E413S1-06 | PASS | Verdict reason/round/scope and decision arrive in snapshots/deltas and closed by-id read; no bodies/comments in snapshot. [E413S1-06-output.txt](E413S1-06-output.txt) |
| E413S1-07 | PASS | Two plan stages in order, totals 7 and 4; status mutation delivered updated histogram; settlement test passed. [E413S1-07-output.txt](E413S1-07-output.txt) |
| E413S1-08 | PASS | No body/comments; every open task has agents_text; E413 headings match file order and positive word count. [E413S1-08-output.txt](E413S1-08-output.txt) |
| E413S1-09 | PASS | All card-field documentation needles present and consistent. [E413S1-09-output.txt](E413S1-09-output.txt) |
| E413S1-10 | PASS | p1] bash E413S1-10.sh via run.mjs (saved exact command); 6/6 Neovim progress tests; stage total 7 with zero loaded closed stage members. [E413S1-10-output.txt](E413S1-10-output.txt) |
| E413S1-11 | PASS | Items snapshot 117094 bytes, first Neovim reply 109899 bytes <=122880; no closed rows, same item set, 1092 files. [E413S1-11-output.txt](E413S1-11-output.txt) |
| E413S1-12 | PASS | E482 closed pages 100+10, 110 unique closed tasks; owner rollup 110/110, fully closed subtree absent from snapshot. [E413S1-12-output.txt](E413S1-12-output.txt) |
| E413S1-13 | PASS | Held page close/reopen race: no duplicates, correct seven-row closed set, authoritative done count +1 then restored. [E413S1-13-output.txt](E413S1-13-output.txt) |
| E413S1-14 | PASS | 82/82 Neovim tests including copied tracker explorer/board/card and nested closed pages; zero skips. [E413S1-14-output.txt](E413S1-14-output.txt) |
| E413S1-15 | FAIL | FAIL: nvim/README.md:727–730 says progress reflects loaded summaries and a closed list is refreshed; contradicts full hub counts and per-parent pages in passing checks and lines 841–854. [E413S1-15-output.txt](E413S1-15-output.txt) |
| E413S1-16 | PASS | Linux droplet stage cover (cited)] bash E413S1-16.sh via run.mjs (saved exact command); Both stage covers complete at S; Linux first hub.status 8502.4ms <10000, startup test passes (duration gate report-only). [E413S1-16-output.txt](E413S1-16-output.txt) |
| E413S1-17 | PASS | Unread 1,2,3 with exact lastMessageAt; topic.read resets 0; 16/16 targeted tests. [E413S1-17-output.txt](E413S1-17-output.txt) |
| E413S1-18 | PASS | One reviewer row, newest T7 hold plus 1; T6 prior hold, QA probe status, removed on disconnect. [E413S1-18-output.txt](E413S1-18-output.txt) |
| E413S1-19 | PASS | One key, complete merged rows, no consecutive duplicates, one status delta, final null. [E413S1-19-output.txt](E413S1-19-output.txt) |
| E413S1-20 | PASS | Session/unread docs present and consistent. [E413S1-20-output.txt](E413S1-20-output.txt) |
| E413S1-21 | PASS | Warning-filtered page/live rows, one advance, inherited filter and explicit override pass. [E413S1-21-output.txt](E413S1-21-output.txt) |
| E413S1-22 | PASS | Authorized oracle correction: original send-boundary midAdvances 0; reply-boundary 1. Same connection, selected-topic event, contiguous sequence; no product rerun. [E413S1-22-output.txt](E413S1-22-output.txt) |
| E413S1-23 | PASS | test $W] bash E413S1-23.sh via run.mjs (saved exact command); Legacy connection sees two not-clear and two clear verdicts, zero advances; 19/19 tests. [E413S1-23-output.txt](E413S1-23-output.txt) |
| E413S1-24 | PASS | Events-filter docs present and consistent. [E413S1-24-output.txt](E413S1-24-output.txt) |
| E413S1-25 | PASS | Wire import lint and typecheck exit 0 with no diagnostics. [E413S1-25-output.txt](E413S1-25-output.txt) |
| E413S1-26 | PASS | R377 rollup 5/13 with 8 loaded epics, 7 mixed closed children; E412 pages 5+5+3, identities unique and not in snapshot. [E413S1-26-output.txt](E413S1-26-output.txt) |
| E413S1-27 | PASS | Copied tracker probe 1/1: 1092 items/107 open, 110014 bytes, 48.700625ms connection-to-render. Six budget tests pass including intentional negative cases. [E413S1-27-output.txt](E413S1-27-output.txt) |
| E413S1-28 | PASS | Build clean and 8/8 Web tests. Five fixture census lines after 0; global pgrep transient 1 then settled 0, PASS under decision 79502bbb with attribution limitation. [E413S1-28-output.txt](E413S1-28-output.txt) |
| E413S1-29 | PASS | 2/2 filtered QA tests under stdio/stub; parent-unfold greps 1/1; clean tree. [E413S1-29-output.txt](E413S1-29-output.txt) |

**Not clear — E413S1-15 failed.** All 30 scoped cases completed: 29 PASS, 1 FAIL. No blocked, inconclusive or skipped cases. No epic criterion marks (stage verdict only).

Findings (all low; the first is the product documentation defect, the others are brief corrections):

- **nvim/README.md:727** — E413S1-15 FAIL, in scope T-1081 C5. Reading lines 722–733 and 841–854 shows “Counts and container progress reflect the loaded summaries until this fetch completes” and a refresh of “the requested closed list”, contradicting authoritative full hub roll-ups and per-parent pages demonstrated by E413S1-10/14. Coordinator bcd68aa3 accepted the docs finding. No fix made.
- **qa/briefs/E-413-stage-1.md** — E413S1-00 brief setup correction: init creates C-1..C-4; overlaying the committed tracker left 1096 files rather than exact 1092. Authorized decision 7b31ad72: stop scratch hubs, replace only p1/.cland/tasks with W committed copy, verify 1092, restart. Exact commands in setup-correction.sh; original capture preserved.
- **qa/briefs/E-413-stage-1.md** — E413S1-00 brief environment correction: original prefix count 1 named GH_PAGER only; no credential exposure established. Under 7b31ad72 every later scratch process uses the complete fixtureEnvironment result after overlays, scratch paths and final prefix removal; prelaunch count 0. run.mjs preserves PATH/SHELL/TERM/system TMPDIR. Both scratch hubs were restarted under it. Original env and output retained.
- **qa/briefs/E-413-stage-1.md** — E413S1-22 brief oracle correction, authorized 43149d5a: outgoing-send boundaries gave midAdvances 0; boundaries at result t and result none give 1. Expected model.advance seq73 lies after sending reset and before its reply. Same raw capture, no product rerun, both outputs retained.
- **qa/briefs/E-413-stage-1.md** — E413S1-28 brief cleanup probe is global: pgrep count 1 then immediate PID/name-only follow-up 0. All five fixture-owned census lines already reported after 0; scratch hub stopped. Decision 79502bbb accepts PASS with limitation. Coordinator reports other Web test sessions; attribution of the vanished match remains unproven. Use fixture-owned process checks.

QA wrapper note, separate from product and brief findings: E413S1-02 extraction accidentally included the markdown tail after the command. All frame assertions and 22 tests completed successfully before the shell reported a command-substitution end-of-file error. The raw output remains retained; the generated wrapper tail was corrected for following scripts. No product check was rerun. E413S1-01 and the direct E413S1-27 probe use Node’s spec reporter (ℹ), so their original # counter grep printed no counts; reading the retained logs establishes 1/1 each, zero skips.

Build and method:

- Stage **fields**, E-413; run **qa-s1-2026-10-22-1**; full tested SHA **a0ab98362a9c34e7cefd4660ca62d9c264a3fcbc**. Clean detached HEAD and refs/heads/dev both equal S after all checks. Stage items: T-1052, T-1058, T-1081, T-1089, T-1091, T-1053, T-1055; all merged.
- Local macOS arm64, Node v24.21.0, pinned Neovim v0.12.5; isolated scratch HOME/XDG/Git and shared credential filtering. Every case checks the local suite queue. Commands, exact scripts, raw frames, output and queue reads are retained per case. No real browser, provider operation, product edit or new full suite.
- **165/165 targeted test assertions pass**, zero failures/skips, including the standalone copied-tracker startup probe. Wire import lint/typecheck and Web build pass. See targeted-test-counts.json. The copied tracker has 1092 items, 107 open; first reply 110014 bytes and connection-to-render 48.700625 ms in the direct probe. This is that probe’s measured interval, not whole-process startup or suite wall time. Negative budget tests intentionally exceed limits.
- E413S1-16 and final plan read report stage cover complete at verification tree **16bac2b00b8d629277a02b9914b68fe676d11564**. Both covers below are existing Coordinator receipts at S, not rerun by QA.

| Cover / log | Actual completion | Platform/executor | Hub run duration / queue | Lifetime / cost |
| --- | --- | --- | --- | --- |
| Linux 468f6bae-effb-415f-88a1-6eb48d11aba6, merged A-8883 | exit 0; 3690 tests, 3682 pass, 8 macOS skips, 0 fail | droplet, Linux x64 6.8.0-142-generic; 2 shards, 2 workers | 1053328 ms / 3989 ms | total $0.1344125 |
| shard-1, A-8884 | exit 0 | cland-v0-90e45f3d, c-8 lon1 | 939960 ms | 927449 ms / $0.06440618055555555; released |
| shard-2, A-8885 | exit 0 | cland-v0-e3ffcabd, c-8 lon1 | 1015960 ms | 1008091 ms / $0.07000631944444445; released |
| macOS 6143d5e7-df7b-4269-ad9f-07bd01409e12, A-8887 | exit 0; 3690/3690 pass, 0 skipped | local darwin arm64 27.0.0; 2 workers | 1211542 ms / 451 ms | local cost N/A |

All cover platforms use Node v24.21.0 and Neovim v0.12.5. Check/T1/T2/T3/T4 base/Web phases completed; extra T4 load repetitions were skipped. Lint, test duration budgets and T3 ratchet were report-only. Projected timing and tier share are not measured wall times. Hub runMs and provider lease lifetime are separate recorded clocks. Linux startup probe: first completed hub.status 8502.4 ms under the enforced 10000 ms case assertion; its whole test duration warning was report-only.

Cleanup: both scratch hubs stopped via their own CLI (pids 1478 and 2479); fc/drv/scratch process scans zero; scratch root removed with literal non-force rm -r. See cleanup.txt. Detached worktree removal follows the recorded verdict. No live hub or real HOME changes.

Rule proposal sent in topic-804: assertions should identify frames by stable item/topic/session identity rather than arrival position, since model-domain frames interleave. The boundary correction is retained separately from product failures.

All 30 cases are recorded once in project .cland/qa/runs.jsonl. Stage outcome remains not clear for E413S1-15; no epic criterion verification/failure marks requested.

Evidence artifact A-8893: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8893-e-413-stage-fields-at-a0ab9836-29-pass-docs-finding-e413s1-15/report.md
