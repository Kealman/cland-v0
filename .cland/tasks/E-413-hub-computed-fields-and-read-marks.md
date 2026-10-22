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
updated: 2026-10-22T10:29:43.782Z
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
  - name: fixture refresh
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1090
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

### qa-676 · 2026-10-22T06:33:31.873Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s1-2026-10-22-2
commit: 918951c2ecd592394ef613e10ba7cdc6a00c8e82
stage: fields
stage_hash: e24f3f609a88d513e0350d92dc168c5947caaf27e929c2b8267e744fae570594
findings: [{"severity":"low","text":"E413S1-00 brief defect: setup copies *.md but diff -qr compares the whole committed directory, including .gitkeep. Original output “Only in .../.cland/tasks: .gitkeep” retained. Decision f90e8095 authorized copying that committed file, repeating only exact diff/count and starting hubs. Corrected diff empty, 1094 item files, no product change.","file":"qa/briefs/E-413-stage-1.md"},{"severity":"low","text":"E413S1-10 brief defect: literal expected total:7 is stale after T-1093 joined. Printed plan and snapshot show total:8 with loadedFieldsMembers:0; six Neovim progress tests pass. Decision 35a51fab authorizes the printed-plan count, also for other at-writing counts. Original output retained, no product rerun.","file":"qa/briefs/E-413-stage-1.md"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Result | Observation / evidence |
| --- | --- | --- |
| E413S1-00 | PASS | Exact S/dev, clean; 8 item merges. 1094 tracker files; exact directory diff empty after authorized .gitkeep correction; prefix count 0, scratch hubs correct. [E413S1-00-output.txt](E413S1-00-output.txt) |
| E413S1-01 | PASS | 1/1 Lua oracle; 1094 bodies +3 ancestor regressions, 0 differences; 118960-byte copied snapshot. [E413S1-01-output.txt](E413S1-01-output.txt) |
| E413S1-02 | PASS | 105 open rows, complete chains, no extra/closed rows, computed facts; E413 done 8/12; 33/33 tests. [E413S1-02-output.txt](E413S1-02-output.txt) |
| E413S1-03 | PASS | T1057 title edit publishes only T1057, E413 and R377 once each. [E413S1-03-output.txt](E413S1-03-output.txt) |
| E413S1-04 | PASS | 2/2 scale tests; local macOS first hub.status 2181.9ms, 463778 startup bytes and 99497 snapshot bytes. [E413S1-04-output.txt](E413S1-04-output.txt) |
| E413S1-05 | PASS | Summary documentation present and surrounding text consistent. [E413S1-05-output.txt](E413S1-05-output.txt) |
| E413S1-06 | PASS | Verdict reason/round/scope and Decision in pushed snapshots/deltas and closed by-id read; no body/comments. [E413S1-06-output.txt](E413S1-06-output.txt) |
| E413S1-07 | PASS | Stages fields total 8 and marks total 4 in plan order; status histogram delta correct. [E413S1-07-output.txt](E413S1-07-output.txt) |
| E413S1-08 | PASS | No full bodies/comments; all open tasks have agents_text, headings in order, E413 words 2395. [E413S1-08-output.txt](E413S1-08-output.txt) |
| E413S1-09 | PASS | Card fact documentation present and consistent. [E413S1-09-output.txt](E413S1-09-output.txt) |
| E413S1-10 | PASS | 6/6 Neovim progress tests; printed plan total 8 with 0 loaded members, authorized stale-number correction 35a51fab. [E413S1-10-output.txt](E413S1-10-output.txt) |
| E413S1-11 | PASS | 116728-byte items snapshot; first Neovim reply 109663 bytes <=122880; same item set, no closed subtree rows. [E413S1-11-output.txt](E413S1-11-output.txt) |
| E413S1-12 | PASS | Closed E482 pages 100+10, 110 unique children, owner rollup 110/110, subtree absent from snapshot. [E413S1-12-output.txt](E413S1-12-output.txt) |
| E413S1-13 | PASS | Close/reopen race: 8 unique closed identities; done count 989→990→989, T1053 planned and T1054 absent from fresh open snapshot. [E413S1-13-output.txt](E413S1-13-output.txt) |
| E413S1-14 | PASS | 82/82 Neovim tests including copied tracker closed pages, explorer/board/card; no skips. [E413S1-14-output.txt](E413S1-14-output.txt) |
| E413S1-15 | PASS | T1093 fixed prior failure: nvim README now states full hub rollups before closed pages load and per-parent refresh; all documentation matches. [E413S1-15-output.txt](E413S1-15-output.txt) |
| E413S1-16 | PASS | Current Linux A8963 and macOS A8967 green at S. Linux first hub.status 9736.3ms <10000. Pre-verdict plan displays old verdict tree; interpretation 47c49c56 confirmed in tracker.ts:1887, recheck after verdict. [E413S1-16-output.txt](E413S1-16-output.txt) |
| E413S1-17 | PASS | Unread counts 1,2,3 with exact timestamps, reset 0; 16/16 tests. [E413S1-17-output.txt](E413S1-17-output.txt) |
| E413S1-18 | PASS | One reviewer row, newest T7 hold plus 1, prior T6 hold; status QA probe, then removed. [E413S1-18-output.txt](E413S1-18-output.txt) |
| E413S1-19 | PASS | Five row frames; one key, complete rows, no duplicate, one status change, final null. [E413S1-19-output.txt](E413S1-19-output.txt) |
| E413S1-20 | PASS | Session/unread documentation present and consistent. [E413S1-20-output.txt](E413S1-20-output.txt) |
| E413S1-21 | PASS | Warnings-only page/live rows, one advance, inherited page filter and explicit override correct. [E413S1-21-output.txt](E413S1-21-output.txt) |
| E413S1-22 | PASS | Corrected committed oracle passes directly: midAdvances 1, one welcome/no close, selected topic only, contiguous sequence and reset. [E413S1-22-output.txt](E413S1-22-output.txt) |
| E413S1-23 | PASS | Legacy connection unchanged: 2 not-clear/2 clear/0 advances; 19/19 tests. [E413S1-23-output.txt](E413S1-23-output.txt) |
| E413S1-24 | PASS | Filter documentation present and consistent. [E413S1-24-output.txt](E413S1-24-output.txt) |
| E413S1-25 | PASS | Wire import lint and typecheck exit 0 without diagnostics. [E413S1-25-output.txt](E413S1-25-output.txt) |
| E413S1-26 | PASS | R377 rollup 5/13 before loading 5 closed epics; 7 mixed-kind page rows; E412 pages 5+5+3, no duplicates/overlap. [E413S1-26-output.txt](E413S1-26-output.txt) |
| E413S1-27 | PASS | Copied tracker probe 1/1: 1094/105 items, 109786-byte first reply, 40.984209ms connection-to-render; 6 budget tests pass including intended negatives. [E413S1-27-output.txt](E413S1-27-output.txt) |
| E413S1-28 | PASS | Build clean. Initial missing playwright-core attempt retained (5 top-level failures before browser). Authorized allowed symlink and retry: 8/8 pass, 5 fixture census lines after 0. No install/product edit. [E413S1-28-output.txt](E413S1-28-output.txt) |
| E413S1-29 | PASS | 2/2 LABELS/FOLLOWS tests under stdio and stub; parent-unfold checks 1/1; clean tree. [E413S1-29-output.txt](E413S1-29-output.txt) |

**Clear: all 30 scoped cases PASS.** Stage fields only; no epic criterion marks. The prior E413S1-15 product documentation defect is fixed.

Findings (low, brief defects only):

- E413S1-00 brief defect: setup copies *.md but diff -qr compares the whole committed directory, including .gitkeep. Original output “Only in .../.cland/tasks: .gitkeep” retained. Decision f90e8095 authorized copying that committed file, repeating only exact diff/count and starting hubs. Corrected diff empty, 1094 item files, no product change.
- E413S1-10 brief defect: literal expected total:7 is stale after T-1093 joined. Printed plan and snapshot show total:8 with loadedFieldsMembers:0; six Neovim progress tests pass. Decision 35a51fab authorizes the printed-plan count, also for other at-writing counts. Original output retained, no product rerun.

Execution evidence and limits:

- E413S1-28 initially stopped before browser launch with `Error: playwright-core is not installed; run npm install` at web/test/harness.ts:47; five top-level failures and no fixture census. The brief permits a root node_modules symlink when a tool cannot resolve parent modules. Decision **ffd68fd1** authorized that symlink and a tests/census-only retry under this run. The original log/output remain as E413S1-28-initial-dependency.*. The build passed once and was not repeated; no install or product edit. Retry: **8/8 pass, zero skips; five fixture census lines after 0, scratch hub stopped**. E413S1-28-retry-output.txt is the final result. Its shell exit 1 is the expected final `grep -c -v` finding zero bad census lines; the test exit is 0.
- Final targeted test outcomes: **176 pass, 0 fail, 0 skipped** across the named files and standalone startup probe. This excludes and explicitly retains the initial dependency attempt above; it does not relabel that attempt a pass. Node emitted its spec reporter (`ℹ`/`✔`); the brief’s `#` summary greps therefore print no counters, but each original log contains the actual counts and named passing tests. No tests were rerun to change reporter format. See targeted-test-counts.json.
- The corrected committed E413S1-22 interval passes directly: midAdvances 1; no extra oracle change this run. The corrected E413S1-28 fixture census replaces the old global process probe.
- E413S1-16 pre-verdict plan shows fields on old tree 16bac2b0 and missing Linux, because its latest stage verdict is the previous not-clear run at a0ab9836. Coordinator decision **47c49c56** instructs using the green receipts at this run’s S and rechecking after the new verdict. Read-only source confirms tracker.ts:1887 passes verdict.commit into #stageCover. Current tree **8993586bfaaf23fbfa0897972355710243faac43** already appears complete for marks and threads. Original plan output and source interpretation retained. No suite resubmitted. Post-verdict closure will be reported to the Coordinator.

Build: **918951c2ecd592394ef613e10ba7cdc6a00c8e82**, clean detached worktree; HEAD and refs/heads/dev equal S before and after. Run **qa-s1-2026-10-22-2**, affected/after-stage **fields**, eight merged items T-1052, T-1058, T-1081, T-1089, T-1091, T-1093, T-1053 and T-1055. Local tests ran on macOS arm64, Node v24.21.0, pinned Neovim v0.12.5; scratch HOME/XDG/Git and full fixtureEnvironment applied as committed brief, 37 inherited names unset and credential-prefix count 0 before scratch launch. System TMPDIR retained. Exported environment values were never printed or copied into this artifact.

Key measurements: copied tracker 1094 items /105 open; Lua oracle 0 differences across 1094 bodies +3 regression rows; snapshot 116728 bytes in p1 (oracle snapshot 118960); first Neovim reply 109663 bytes. The direct copied-tracker probe measured **40.984209 ms connection-to-render**, **109786-byte first payload**, below 3000 ms and 122880 bytes. This interval is not whole-process startup or suite wall time. All negative budget tests passed by detecting their intentional slow/oversized responses.

Existing Coordinator stage covers at S (not rerun by QA):

| Receipt | Actual result / phases | Platform / executor | Measured duration and recorded cost |
| --- | --- | --- | --- |
| db122ec9-4858-49aa-9194-7b6ccd8e6d8c — merged A-8963 | exit 0, 3697 pass /8 skip /0 fail; check, T1,T2,T3,T4 base, Web | Linux x64 6.8.0-142-generic, droplet, 2 shards/2 workers | **1165.83 s admission through collection**, total **$0.1452** (log precision) |
| shard-1 — A-8964 | exit 0 | cland-v0-761f8127, c-8 lon1 | 978.66 s admission→remote finish; collection 18.47 s; reported lifetime 961 s, cost $0.0667 |
| shard-2 — A-8965 | exit 0 | cland-v0-d272e0a6, c-8 lon1 | 1146.66 s admission→remote finish; collection 18.88 s; reported lifetime 1130 s, cost $0.0784 |
| e724f157-4e06-4e06-93f3-89d108b84996 — A-8967 | exit 0, 3705/3705 pass; check, T1,T2,T3,T4 base, Web | local macOS darwin arm64 27.0.0, 2 workers | 1250.286 s queue→finish from recorded timestamps (includes 0.23 s queue); no droplet cost |

Both platforms use Node v24.21.0 and Neovim v0.12.5. Extra T4 load repetitions were skipped; ten T4 files ran in the base phase. Lint, duration budgets and T3 ratchet are report-only; projections and tier-share figures are not measured wall time. Linux first completed hub.status **9736.3 ms** is below its case’s enforced 10000 ms assertion; startup-replies-scale passes though its whole-test duration warning is report-only. Local supporting first hub.status is 2181.9 ms. Receipt extracts, platform/result metadata and durable artifact IDs retained.

Cleanup completed: scratch hubs pids 58076 and 58833 stopped with their own CLI; fc/drv/scratch process scans 0; literal scratch root removed with non-force rm -r. Worktree remains clean for verdict and is removed afterwards. No real browser, live hub modification, provider operation or product fix.

All 30 checks recorded once via qa-record.sh into project runs.jsonl. No epic criterion verification/failure marks. Rule proposal in topic-804: exact-copy setup and assertions should enumerate the same file set, including committed dotfiles.

Evidence: A-8969, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8969-e-413-stage-fields-rerun-at-918951c2-30-pass-readme-fix-verified/report.md

### qa-676 · 2026-10-22T10:29:43.782Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s2-2026-10-22-1
commit: 7887f694ace91db414735b9af93ab20bedbc8c45
stage: marks and threads
stage_hash: 0875b1bedee7573454fbf54146412f87144c54f004a9a5d48467581eee01abf4
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Result | Observation |
| --- | --- | --- |
| E413S2-00 | PASS | HEAD/dev equal S; clean detached worktree. Printed stage has four merged members, one landing each. Exact committed tracker copy 1103/1103, diff empty; p1 snapshot 105 rows, no extra init category. Credential-prefix count 0 before process start. |
| E413S2-01 | PASS | Human marks tests 2/2 pass: shared forward-only events, plan receipts and topic reads; reopen persistence. |
| E413S2-02 | PASS | New E-1103/T-1104 and two distinct receipts. Newer R2 mark wins over later older write; unknown receipt refused. Passive peer receives exactly one marks delta; fresh snapshot agrees; topic reads remain 44 then 44. |
| E413S2-03 | PASS | First import merges forward and sets imported true; second import ignored. Old hub 48043 exited, new 52361. After restart snapshot/get retain R2 and readSeq 44. |
| E413S2-04 | PASS | Neovim marks 3/3 pass: shared events/topic reads, one-time legacy import with cleanup, and held-old-response ordering. |
| E413S2-05 | PASS | 42/42 Neovim/snapshot regression tests pass; recorded-protocol fixture drift test 1/1 passes against the real hub. |
| E413S2-06 | PASS | All 11 marks documentation markers present; surrounding hub/Neovim text agrees with observed monotonicity, durability and import. |
| E413S2-07 | PASS | Thread-run and store tests 8/8 pass, including factual fold line, same-id growth, boundaries, mid-run pages, verifier reassignment and reopen/backfill. |
| E413S2-08 | PASS | Four messages share one factual run, no intruders; age 3490 ms / 3s. Two-message page carries same full run. Passive peer receives steps 1–5 with one id and counts 1–5; fifth once, age 2 ms / 0s. Drivers have zero errors. |
| E413S2-09 | PASS | Verdict/human frames have no run id; following agent messages form distinct one-message runs. Final history matches; named day/Aide/ask/answer boundary test passes. |
| E413S2-10 | PASS | All seven thread-run documentation markers present; surrounding complete-run/delta/boundary text matches observations. |
| E413S2-11 | PASS | 45/45 ask/outcome/store tests pass, including option/free text outcomes, atomic departure, reopen persistence and delivery to asker. |
| E413S2-12 | PASS | Two scratch asks answered with allocated/option 2/human and trimmed multiline Wait for QA. / Then ship./qa-standin. Live cards and history retain exact outcome and answer id; both delivered, driver errors 0. |
| E413S2-13 | PASS | Each answered ask appears in exactly one inbox departure with identical outcome; waiting count 0, explicit list has no departures, archive has one equal row each. |
| E413S2-14 | PASS | All six answered-outcome documentation markers present; durable thread outcome and coalesced departure/archive text agrees. |
| E413S2-15 | PASS | All three named declining C1–C3 tests are ok in the 45-test receipt: forwarded delivery, invalid reason refusal and retained outcome. |
| E413S2-16 | PASS | Forwarded decline reaches original Implementer through Coordinator; missing/blank reasons and option-with-reason refused, ask still listed before valid answer. Original and forwarded outcome identical; next ask open, topic waiting for agent. |
| E413S2-17 | PASS | Live declined card, single declined departure and archive retain identical reason/by/time. All asks and answers have null run id. |
| E413S2-18 | PASS | Neovim declined-ask test 1/1 passes: one folded reason row on history/live, no answer keys or duplicate answer row. Recorded fixture drift receipt also passes. |
| E413S2-19 | PASS | 27/27 clause tests pass. All 12 default/project clauses contain decline-is-not-consent and fit ceiling 6528 bytes (max 6526). Six sentence copies per source; seven docs markers present. |
| E413S2-20 | PASS | Wire import lint exit 0; full typecheck exit 0, no diagnostics. |
| E413S2-21 | PASS | Both scratch hubs stopped. Census of 35 fixture-owned pids has no alive lines. No browser/GUI launched; clean build/dev retained. |

**Clear: all 22 scoped checks PASS.** Stage `marks and threads` only; no epic criterion marks. Findings: none.

Run **qa-s2-2026-10-22-1** at **7887f694ace91db414735b9af93ab20bedbc8c45**, clean detached worktree, dev unchanged before/after. Printed stage members are T-1054 (c6396710), T-1056 (3f13960a), T-1057 (55465447), T-1059 (826445ad), 4/4 merged. The plan also lists a later `fixture refresh` stage; it is outside this run. No stage member count was inferred from the brief's draft date.

129/129 targeted tests passed across 15 named files in eight TAP reports on local macOS arm64, Node v24.21.0, pinned Neovim v0.12.5. No failures, cancellations, skips or todo. Files ran sequentially with `--test-concurrency=1`, after the local verify queue was quiet. The one name-filtered fixture check reports exactly one test, not zero. These targeted tests and scratch protocol checks are not a new full-suite run. Wire import lint and typecheck pass; timings are not acceptance criteria here.

Live behavior was exercised only on two disposable Unix-socket hubs under /tmp/qa-e413s2-lfr1HC. p1 held the exact committed .cland/tasks directory, including .gitkeep, 1103 files with empty diff and no extra init categories; p2 held the empty fixture. cland init started no hub. Full fixtureEnvironment applied after overlays, 37 inherited names removed and credential-prefix count 0 before scratch process start; own HOME/XDG/Git configuration, synthesized fixture identity, system TMPDIR retained. No real browser, GUI, real harness account, live tracker mutation or provider operation. The scratch driver roles and their messages are test fixtures, not role changes in this QA session.

Protocol evidence is retained by request id, ask id and run id. Unknown plan receipt and invalid decline errors are the brief's expected negative checks, not permission workarounds. The decline's immutable status/reason/by/at tuple is identical through the original and forwarded asks, live card, single departure and archive. Ordinary and free answers preserve full text, option when applicable, answerer and timestamp. Neovim uses the recorded hub frames, and the real-hub fixture drift check passes.

No probe correction or product change was needed. E413S2-15's grep includes the three TAP Subtest headers and their three corresponding ok lines; all three named tests passed. The stage-1 setup corrections were applied from the outset. Full commands are in the per-case scripts and recorder notes; observations, raw frames, driver stdout/stderr, TAP and docs receipts are retained beside this report.

Cleanup: both scratch hubs stopped; old restart pid 48043 was observed exited before restart. Final fixture-owned census lists 35 pids and no alive line. Scratch process and frame-client metadata remain in fixture-pids.txt; no machine-wide process count used. Scratch deletion is recorded in cleanup.txt. Detached worktree is clean at S and removed after the accepted verdict; durable evidence remains.

Existing Coordinator stage covers at S (verification tree 49f40ab16197e914336f63b7a3999bf31b2c28a7) are cited, not rerun: Linux df7383e5-83bc-4b0e-821c-0ac075464999 / A-9079, macOS 309b6c7a-cbe2-4d28-b1da-02ed7484d9a9 / A-9083. Both completed check/typecheck and T1–T3, T4 base and Web. T4 repetitions were skipped; 10 T4 files ran in base phase. Linux has 3732 tests / 3724 pass / 8 platform skips / 0 fail; macOS 3732/3732 pass, no skips. Both Web phases have 11 files / 27 tests; this stage itself has no Web checks. Budget/lint/T3-ratchet findings are report-only, not timing passes.

Linux platform x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5. Shard 1 A-9080: cland-v0-b8140030, c-8 lon1, 1160.28 s admission-through-remote-finish, lifetime 1144 s, $0.0795. Shard 2 A-9081: cland-v0-2ae4caec, c-8 lon1, 988.27 s admission-through-remote-finish, lifetime 974 s, $0.0676. Total cost $0.1471; merged queued-to-finish wall 1182.817 s (09:47:40.879Z–10:07:23.696Z). macOS local darwin arm64, same Node/Neovim, workers 2, queued-to-finish wall 1228.221 s (09:47:48.056Z–10:08:16.277Z); cost not applicable. Projections are not measured wall times. Hub reports and accounting are copied as same-head supporting evidence; durable merged and shard logs remain in the cited artifacts.

Rule proposal sent to Coordinator: cross-surface outcome checks should compare one immutable outcome tuple by ask id across card, history, departure and archive, never correlate by arrival order.

Evidence: A-9086 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9086-e-413-marks-and-threads-at-7887f694-all-22-checks-pass/report.md
