---
id: E-417
kind: epic
title: Topics, threads and the inbox
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-413
  - E-416
topic: topic-866
branch: null
created: 2026-10-14T15:59:24.765Z
updated: 2026-10-23T12:24:01.509Z
---

## Summary

Topics, threads and the inbox come to the browser: threads with Markdown, role colours and folded runs, ask and approval cards that share one record with the inbox, the composer, the events view and notifications while the page is open. From this epic on the human can steer the build from the browser.

## Goal

The human reads every thread, answers every ask and every approval the hub can relay, writes to any session or the Coordinator, and learns what happened, all in the browser and with Neovim's keys. Today the web has none of it: the Q-405 prototype showed topics and threads read-only, asks as cards without buttons and the inbox without actions, and its unread counts only grew because it never marked anything read.

## Contents

- **§3.2 The Topics area.** The topics in groups: what waits for the human first; then the standing topics General and Agents, set apart with their own look; then the topics opened under items; then the closed ones, folded.
- **§3.4 and v0.1 §3.14 The thread.** The message block (P12): a header with the sender, the role in its colour, the addressees, the kind, the time and the delivery stage, over a Markdown body; the role colour as a 3 px bar in its own gutter; the human's band; watch-layer messages dimmed; verdicts with their criteria marks; artifact chips; item ids as links that never wrap at the hyphen. History arrives in pages by message number.
- **§3.4 Folded runs** open in place and keep their anchor line, never in the drawer. The fold line is the hub's, built from facts: who, how many messages, the latest step and the age. Asks, verdicts, answers and anything to or from the human never fold.
- **§3.4 An ask lives in two places with one state.** The inbox row and the card in the thread show the same record from the hub and answer with the same keys: options 1 to 9 (a click or the key answers at once) and a free answer. Declining is an answer with a reason, on its own key and never on Escape. Once answered, the card folds to one line with the option, who answered and when, in the thread for good and in the inbox until the human leaves it; then it goes to the inbox archive. The first answer from any client wins, and every client sees the outcome.
- **§3.4 Approvals as cards** (P23): the command in full with Approve once, Always for this command and Deny with a note, answered through the gate of E-414; an approval that stays in the harness's TUI is marked "answer in Neovim" and has no buttons.
- **§3.4 Artifacts inline.** An HTML artifact at 240 px in a sandboxed iframe that never has `allow-scripts` with `allow-same-origin` and never navigates the top, under a header with Open full and Open in a pane (P15); a file or folder artifact is a chip.
- **§3.4 The composer.** The kind as Message, Decision or Question and the addressee as a chip (the Coordinator by default in an item's topic, `@` naming a session), with `~` attaching an artifact (P16). Enter sends a one-line message, Shift+Enter breaks the line, and ⌘Enter always sends. A message to a busy session is queued and shown in the thread as queued, with a Withdraw that puts the text back into the composer. ⌘K in the composer still opens the palette. The draft is kept per topic in the browser and survives a disconnection and a reload, with Send disabled while disconnected. The addressing rules are Neovim's (v0.1.2 §3.8).
- **v0.1.2 §3.7 The inbox, in the web.** The now layer in its four sections (asks and approvals, plan approvals, requests, messages), newest first, five a section with a fold that names the oldest wait, every row with its age, each header a name and a count. The selected row unfolds in place with real buttons; `r` replies, `d` declines a request or marks a message read, Enter opens; `A` shows the archive; the events line and the archive line close the list. The drawer follows the selected row with its topic's thread, scrolled to the row's message, and a one-line reply (P17 to P19). A waiting plan opens the Plan view.
- **v0.1.2 §3.7 The events view, in the web.** Rows newest first in day groups with day rules, at most the newest 200 that match the filter, older ones on demand, and a day that folds; the filter by kind, warnings and subject through the hub's filter; bookkeeping dimmed and equal events merged with ×N; Enter opening the subject. Opening the view sets the human's last look in the hub, and the inbox's events line counts what is new since.
- **§3.6 Notifications while the page is open.** Only for items of the now layer, and never while the human is looking at the page; separate switches for "needs you" and "finished"; a notification names the session, the item and what it waits on, and a click opens the inbox row.
- **§3.6 What counts as read** is held in the hub per human; the web sends its read marks by the rule below.

Not in this epic: the phone's layouts of all this (E-419); the session's drawer, which reuses this thread (E-418); the switches' places beside the profile and in More (E-418, E-419); push with the page closed (0.2.x).

Choices where the spec is silent:

- **Decline's key.** `d` on an ask, in the thread and in the inbox, turns the free answer into a reason field and its button into a red Decline that stays disabled until a reason is typed; Answer instead turns it back. This is P37 applied to the desktop.
- **Read.** The web marks a topic read up to the last message on screen once its thread has been in view, with the page visible, for one second, and whenever the human answers or writes in it.
- **Withdraw.** The protocol has no withdraw today. This epic adds one for a queued message not yet injected: the message leaves with the stage `withdrawn` and its text returns to the composer, and once the turn has started Withdraw is gone. Neovim shows a withdrawn message as it shows a dropped one.
- **The human's kinds.** `topic.send` gains the kind for the human's messages: a Decision and a Question carry their kind in the header, and a Question leaves the topic waiting for its addressee.
- **"Needs you" and "finished".** "Needs you" fires when a row enters the inbox; "finished" fires when a task of the now layer reaches done, and its click opens the item's card.
- **The switches and the permission.** The switches are per browser, since the permission belongs to a device and an origin. This epic offers them as palette actions until E-418 places them beside the profile. The permission is asked when the first switch is turned on, which is a user gesture. A row raises at most one notification (its `tag`), and "looking at the page" means visible and focused.
- **Long runs.** An open run keeps its anchor line pinned at the top of the thread while it is open.
- **The approval card** answers through the gate of E-414; where a harness has no relay, the card is shown marked and without buttons.

## Tracer-bullet order

1. **Topics and the thread.** The Topics area in its groups and a thread with the message block, Markdown, role colours, the human's band, verdicts, artifact chips, pages by message number and folded runs opening in place, with the read marks. Demo: a thread of 300 messages opens at its end and pages back without a gap, a folded run opens in place with its anchor kept, and the topic's unread count drops to zero in Neovim too.
2. **Ask cards in the thread and the inbox.** The ask card with options on 1 to 9, the free answer, decline with a reason on `d`, the folded outcome in both places, and one record across clients. Demo: an ask answered with `2` in one browser context folds in a second context's inbox and thread within a second, and Escape on another ask leaves it open.
3. **The inbox.** The four sections with their rows, ages and folds, the selected row unfolded, `r`, `d`, Enter, the archive, the drawer with the row's thread, and the answered row kept folded until the human leaves the inbox. Demo: an ask, a plan approval, a request and a message show in their sections with their ages, and the answered ask stays folded until the inbox is left, then shows in the archive.
4. **The composer.** The kinds, the addressee chip, `~`, the keys, queued messages with Withdraw, drafts per topic, Send disabled while disconnected, and the hub's withdraw and kinds. Demo: a message to a busy fake session shows as queued, Withdraw returns its text to the composer, and a draft survives a reload.
5. **Approvals and artifacts inline.** The approval card on the records of E-414, the mark "answer in Neovim", and HTML artifacts at 240 px in a sandboxed iframe with Open full and Open in a pane. Demo: a fake Codex approval approved once from the inbox folds with its outcome in Neovim's inbox, and an HTML artifact's iframe has `sandbox="allow-scripts"` and nothing more.
6. **Events and notifications.** The events view with its filters, day groups, the 200-row cap and the last-look line; notifications with the page hidden, the two switches, and the click to the row. Demo: with the page hidden, a new ask raises one notification naming the session, the item and the question, and its click opens the inbox row; with "needs you" off, none is raised.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, headless Chromium (two browser contexts with their own cookies; keys sent with their physical codes) and a headless Neovim workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project with the fake harnesses, QA opens the web at 1440x900 in two browser contexts. The Topics area lists the waiting topics first, General and Agents apart, then the item topics and the closed ones folded. A thread shows Markdown, role colours, the human's band, a verdict with its criteria marks, and a folded run that opens in place with its anchor kept; scrolling to the end marks the topic read, and Neovim shows it read. A fake Implementer's ask appears as a card in the thread and as a row in the inbox; QA answers it with `2` in the first context, and the second context's card and row fold to the outcome. QA presses Escape on a second ask and reads it still open, then declines it with a reason on `d`; the fake receives `declined` with the reason, and the topic stays open. The inbox shows a plan approval, a request and a message in their sections with their ages; the answered ask stays folded until QA leaves the inbox, then shows in the archive. QA writes with each kind, sends with Enter and with ⌘Enter, breaks a line with Shift+Enter, queues a message to a busy fake session and withdraws it, and reloads with a draft that survives. A fake Codex approval is approved once from the inbox card, and a fake Claude Code approval shows marked "answer in Neovim" with no buttons. An HTML artifact renders inline at 240 px in an iframe whose `sandbox` is `allow-scripts` alone. The events view filters to warnings, groups by day, stops at 200 rows and sets the last look, which the headless Neovim workbench then reads. With the page hidden and `Notification` stubbed, a new ask raises one notification naming the session, the item and the question; with the page visible, none is raised.

- [ ] C1. The Topics area lists the topics in their four groups with the standing ones apart, and a thread shows the message block of P12 with Markdown, role colours, the human's band, verdicts, artifact chips and history in pages.
- [ ] C2. Folded runs show the hub's fold line and open in place with their anchor kept, never in the drawer; asks, verdicts, answers and messages to or from the human never fold.
- [ ] C3. An ask is one record shown as an inbox row and a thread card with the same keys (1 to 9, a free answer, decline with a reason on its own key, never on Escape); an answered ask folds to one line with its outcome in both places, in the inbox until the human leaves it, and the first answer from any client wins.
- [ ] C4. Approval cards answer relayed approvals with Approve once, Always for this command and Deny with a note, and approvals that stay in a harness's TUI are marked "answer in Neovim".
- [ ] C5. The composer offers Message, Decision and Question with the addressee chip; Enter, Shift+Enter and ⌘Enter behave as §3.4 says; queued messages show Withdraw; drafts survive a disconnection and a reload, and Send is disabled while disconnected.
- [ ] C6. The inbox shows the four sections of v0.1.2 §3.7 with ages, the selected row unfolded, `r`, `d`, the archive and the drawer with the row's thread; the events view filters, groups by day, caps at 200 rows and sets the human's last look in the hub.
- [ ] C7. HTML artifacts show inline at 240 px in a sandboxed iframe never given `allow-same-origin`, and files and folders are chips.
- [ ] C8. Notifications fire with the page open only for now-layer items and never while the human looks at the page, with separate "needs you" and "finished" switches, naming the session, the item and what it waits on, and a click opens the inbox row.

## Dogfooding

The human steers the rest of the build from the browser once this epic's thread and inbox slices land (spec §4): the Coordinator's asks are answered from the web's inbox, the human writes to the Coordinator from the composer, and Neovim stays open for the harnesses' TUIs.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the prototype's thread, topics and inbox (`web/src/thread/`, `topics/` and `inbox/` on `prototype/web-shell`); then the boards Thread, Inbox and PhoneAsk. Where the desktop boards lag the spec (no Decline on the Thread and Inbox boards, the fold line of P13), the spec wins, as the design README lists.
- **Prior art.** Never strand an approval in one thread, never decide on a timer, never let a denial read as consent, never lock navigation with a modal, and show every action as pending, then applied or failed (`docs/research/web-prior-art.md` §7.2 and §7.3).
- **Risks.** Agents' Markdown is rendered into the page: no raw HTML from a message ever reaches the DOM, and links open outside the page. A flood of notifications is what the switches and the now-layer rule prevent.
- **Size.** About eight sessions on the v0 scale, the largest web epic.
- **Order.** Third in the web lane: it waits for E-413 and E-416, and E-419 waits for it. Its approval cards answer through E-414 without an edge; the hub lane is expected to land E-414 first, and otherwise the Coordinator orders that slice after it.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.2, §3.4 and §3.6; `docs/spec/v0.1.2.md` §3.7 and §3.8; `docs/spec/v0.1.md` §3.5, §3.6 and §3.14.
- Map M-399 and the tickets this epic absorbs: Q-401 (threads, approvals and notifications in prior art), Q-404 (the Thread and Inbox boards, P10 to P19), Q-406 (declining and the answered row), Q-408 (the final shape of threads, approvals and the composer).
- Research: `research/web-prior-art` (`docs/research/web-prior-art.md` §7.2, §7.3 and §8); `research/web-stack` (`docs/research/web-stack.md` §4.2, notifications).
- Prototype: `prototype/web-shell` (`web/src/thread/Thread.tsx`, `thread/markdown.tsx`, `topics/TopicsArea.tsx`, `inbox/InboxArea.tsx`, `events/EventsArea.tsx`).
- Mockups: `docs/design/web/Thread.dc.html` (P10 to P16), `Inbox.dc.html` (P17 to P19), `PhoneAsk.dc.html` (P37, P38); `screens/v02-thread.png`, `v02-inbox.png`.
- GLOSSARY: Topic, General, Agents topic, Ask, Request, Events view, Layer.

## Plan

```yaml
stages:
  - name: thread groundwork
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1115
        - T-1118
      - - T-1116
      - - T-1117
  - name: message block, runs and asks
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1119
        - T-1120
        - T-1121
        - T-1122
  - name: inbox and composer
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1123
        - T-1124
        - T-1125
        - T-1126
      - - T-1161
  - name: events, notifications and approvals
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1127
        - T-1128
        - T-1129
      - - T-1164
      - - T-1179
```

## Comments

### coord · 2026-10-22T15:17:41.506Z

Decision on ask 9a81a158 (stand-in under D24, 15:17Z), per spec §3.4: only a human Question leaves the topic waiting for its addressee; a human Message or Decision does not (T-1117).

### qa-676 · 2026-10-22T23:07:34.497Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s1-2026-10-23-1
commit: 4411dcc99173b864850ac0988a11334d87262614
stage: thread groundwork
stage_hash: 4be0921642b00ed4966caef8a699129ac052aa364447a72765ad071a3ff41a37
findings: [{"severity":"low","text":"E417S1-02 names an old test title; current area-module test passed and retained source proves the same required behavior.","file":"qa/briefs/E-417-stage-1.md"},{"severity":"low","text":"E417S1-21 retained CUA unknown-key errors for slash/question. Documented locator press Shift+/ opened help; API encoding errors only, no product failure."}]
finding_counts: {"high":0,"medium":0,"low":2}

# E-417 stage QA — clear

Run `qa-s1-2026-10-23-1`; commit `4411dcc99173b864850ac0988a11334d87262614`. Every scoped case passed.

| Case | Result | Command and observation |
| --- | --- | --- |
| E417S1-00 | PASS | [QA shell; p1] HEAD=dev=S clean, all four planned members merged, markers/files present, system TMPDIR; init config 1/1/1, environment dropped 37 names and zero credential-prefix count, helpers checked. |
| E417S1-01 | PASS | [sealed W] Web build exit 0, source stamp 7415b6d4 matches request, bundle assets present, clean tree. |
| E417S1-02 | PASS | [test W] keymap 2/2 and key-contexts 3/3, zero skips/failures, 3 clean fixture censuses. Brief title stand-in areas is renamed area modules…unimplemented session actions; source lines 46–78 confirm selection/drawer, absent unimplemented actions, Sessions17 help and palette assertions at S. |
| E417S1-03 | PASS | [test W] Six Web regression files serial: shell9, palette11, folds6, area-slots4, items8, plan4 all pass; zero skips/failures; every fixture census clean; required palette physical-code test present. |
| E417S1-04 | PASS | [test/sealed W] Parser 7/7, all required names; hostile text preserved with only item token, zero link tokens; unclosed js fence ends at message end. |
| E417S1-05 | PASS | [sealed W] HTML guard clean0, planted innerHTML and dangerouslySetInnerHTML refused at exact line1 exit1, plants moved out, guard0 and clean tree. |
| E417S1-06 | PASS | [test W] Eight named hub files serial, 111/111, zero skips/failures; every required kinds, question wait, withdrawal fence/refusal, Store-reopen and authenticated web withdrawal test passed. |
| E417S1-07 | PASS | [test W] Neovim thread24/24 and selected protocol drift1/1; required withdrawn glyph/colour case passed, no skips; T-1117 merge contains all five expected Neovim paths. |
| E417S1-08 | PASS | [test W] Topics9/9, area-state8/8, connection4/4; all required paging, anchors, live/reconnect and visible/hidden read-mark cases passed; zero skips; ten Web fixture censuses clean. |
| E417S1-09 | PASS | [sealed W] Full typecheck and tier lint exit0; all four web guard lines and seven required tier classifications present. |
| E417S1-10 | PASS | [QA shell] One keyboard listener in keyboard.ts only; preferences in interface-state, separate reload guard only; no HTML sinks; no dependency changes, only T-1116 typecheck scripts. |
| E417S1-11 | PASS | [p1] Hub/status0 with web port; detached S1; item T-5, seven topics seeded; driver ready all nine calls accepted, no errors; 300/300 unique messages; expected topic status/unread values. |
| E417S1-12 | PASS | [p1] Five kinds persisted and streamed exactly once; only Question changes status, later Message retains wait; invalid kind rejected and unrecorded; one matching journal transition; S1 alive. |
| E417S1-13 | PASS | [p1] Queued busy-session message withdrawn with text returned; injected/repeated/agent/other-sender calls refused; withdrawn text never reaches fake, next turn executes once; fresh history and live S1 agree. |
| E417S1-14 | PASS | [p1 Headless Shell] Full two-context walkthrough exit0: expected groups/keys/help; 300 unique ordered messages with anchors kept, live301 without reread; cross-client unread5→0 after visible second (996ms report-only), hidden3 unchanged then0; hostile text literal/no off-origin, stages correct, fold reload isolated; browser census4→0. |
| E417S1-15 | PASS | [docs] All22 markers present; surrounding web/hub/Neovim/test docs match contexts, parser safety, kinds/withdrawal, paging/read marks and observed behavior. |
| E417S1-16 | PASS | [sealed W] Committed stage brief qa lint exit0 at tested build. |
| E417S1-18 | PASS | [p1] Session/hub stop exit0; census of 30 fixture PIDs found none alive; no S1 replacement needed. |
| E417S1-21 | PASS | Computer use: Chrome cland QA anonymous Offline; exact source stamps and empty hub diff; four empty default-fold groups, 18 matching keys, last row visible, Escape/j/j/k/1 work; Inbox restored and QA tab closed. Two browser key-name errors retained; documented locator.press Shift+/ succeeded. |
| E417S1-17 | PASS | Linux A-9478/A-9479/A-9480 and macOS A-9485 green at S; plan cover complete. |

## Findings

Low — E417S1-02: the brief names the former stand-in-area test. `node --test web/test/key-contexts.test.ts` passed the renamed area-module test at S; retained source confirms the same behavior. Low — E417S1-21: CUA rejected two key encodings as unknown key names; the documented locator `press("Shift+/")` opened help. Original errors and successful evidence retained; no product failure or permission bypass.

## Shared stage cover receipts

Both Coordinator-owned full stage runs tested commit `4411dcc99173b864850ac0988a11334d87262614`, verification tree `95303fe6e1ec65315487e5c6c1231ae0f4fa8cd6`.

- Linux droplet run `4786647f-b5e0-4c6e-921c-d716fb816ce3`: exit 0; 3823 passed, 8 skipped, zero failures. Merged log A-9478; shard logs A-9479/A-9480. T1–T4 plus Web ran, Web 17 files/47 top-level tests. Two c-8 lon1 machines: cland-v0-c72db40c, admission-to-remote-finish 1100.90 s, collection 35.06 s, lifetime 1086 s, $0.0754; cland-v0-a263d360, 982.90 s, collection 20.44 s, lifetime 966 s, $0.0671. Actual overall admission-through-collection wall 1136.23 s, total $0.1425. T-1155 T4 100-frame verifier case passed with 201/200/100 pending reads (A-9480); its earlier targeted receipt A-9469 is supporting evidence only.
- macOS local run `c6c2ee05-f2b4-444e-b6a4-9e8bfefb6d27`, A-9485: exit 0; 3831/3831 passed, zero failures or skips. Darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5, two workers. T1–T4 plus Web ran (17 Web files/47 top-level tests, 93 including nested cases). Actual runner phase walls T1 30.71 s, T2 178.75 s, T3 915.61 s, T4 46.45 s, Web 33.68 s. Job queued 22:44:42.036Z, finished 23:05:12.908Z: 1230.872 s queued-to-finish, including admission/host-gate overhead, not pure test wall. Local monetary cost not reported; no droplet lifetime applies.

T4 base phase ran on both; T4 repetitions were explicitly skipped. Duration budgets and ratchet diagnostics are report-only, not enforced budget passes; projections are not measured walls. No QA full suite was submitted. Fresh plan reads show the applicable stage cover complete on both platforms. No epic criterion marks.

All fixture cleanup and earlier detailed observations remain in report-before-covers.md and original captures. Final HEAD/dev still equal S; detached tree clean apart from the allowed node_modules symlink. Stage verdict only; no criterion marks.

Evidence A-9488: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9488-e-417-stage-qa-clear-at-4411dcc9-final-cases-and-both-stage-covers/report.md

### qa-676 · 2026-10-23T03:28:04.891Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s2-2026-10-23-1
commit: e2b22f2f92e4fc234c53b8b6568b261ac3cc7af9
stage: message block, runs and asks
stage_hash: 688b9bc61121f300ab849dbe389f1cc1120689a665b16f88dca21893bcc5b8e6
findings: [{"severity":"low","text":"E417S2-11 k11/context reads confirm stale HTML-chip wording, plain-message wording at 214, all-Inbox stand-in wording at 248, and missing run/ask key-table rows at 534–545. Contradict passing E417S2-02–08. All required documentation markers pass; brief classifies these as low. Existing fix T-1161, stage 3.","file":"web/README.md","line":155}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Surface | Result | Command and observation |
| --- | --- | --- | --- |
| E417S2-00 | hub-api | PASS | k00: clean detached HEAD=dev=S; 4/4 printed stage items merged, paths limited as prescribed; system TMPDIR. Setup dropped 37 inherited names, credential prefix count 0; probe parses. |
| E417S2-01 | hub-api | PASS | npm run build --workspace web: exit 0, bundle/assets present, clean tree. |
| E417S2-02 | hub-api | PASS | nt messages.test.ts: 5/5 pass, all five required names; census 5 clean. |
| E417S2-03 | hub-api | PASS | nt thread-runs.test.ts: 5/5 pass including anchored paging, sticky anchor, protected messages, live growth and read marks; census 5 clean. |
| E417S2-04 | hub-api | PASS | nt thread-artifacts.test.ts: 5/5 pass, 240 px script-only sandbox, blocked parent access/navigation, full/pane opening, unavailable chip and moved folder; census 5 clean. |
| E417S2-05 | hub-api | PASS | nt asks.test.ts: 9/9 pass including two-context thread/Inbox outcome, physical option key, decline, first-answer winner and read mark, offline/draft recovery; census 9 clean. |
| E417S2-06 | hub-api | PASS | nt topics/folds/area-slots/key-contexts/palette/shell/connection/artifacts: 9+6+4+3+11+9+4+7=53/53 pass, all clean censuses. T-1157 Retry case passed first attempt; no rerun. |
| E417S2-07 | hub-api | PASS | nt web-keymap/web-markdown/web-area-state: 18/18 pass. k07 bindings and help labels present; no Escape ask/toggle binding. |
| E417S2-08 | hub-api | PASS | k08 independent probe: 1/1 pass, no step errors, seeded facts true. All six hostile strings literal, zero elements/execution; frame exactly allow-scripts, 240 px, read/cookie/navigation SecurityError, popup null, no dialogs/popups. Ask Escape open, empty decline disabled, Answer instead restored; physical 2 delivered Right once, both contexts answered/no controls; B 8 ms, competing answer refused. Census before 3/after 0. |
| E417S2-09 | hub-api | PASS | k09: typecheck and tiers exit 0; all four HTML/colour/token/hooks guards, 23 text tokens, four Web classifications present. |
| E417S2-10 | hub-api | PASS | k10: only central keyboard listener; storage interface-state plus reload guard; no HTML sinks or forbidden sandbox attributes; new-tab links have noopener noreferrer; no dependency changes. |
| E417S2-11 | hub-api | PASS | k11: all 16 required doc markers present once. Confirmed T-1161 low contradictions at README lines 155/214/248 and missing run/ask key-table rows. |
| E417S2-12 | hub-api | PASS | cland qa lint: exit 0, brief lint passes at tested build. |
| E417S2-13 | hub-api | PASS | Both stage covers green at S: Linux A-9785, macOS A-9791; plan cover missing=[], full details below. |
| E417S2-14 | hub-api | PASS | k14: every Web log has >=1 clean census, T1 has 0/0; clean tree; scratch /private/tmp/qa-e417s2-vbR2M5 removed. Final HEAD/dev unchanged. |

Low finding: T-1161, web/README.md:155, :214, :248 and key table :534–545. `k11` and retained surrounding text contradict implemented inline HTML, P12 message block and Inbox ask cards; run/ask key rows absent. The committed brief and Coordinator request classify these as low; E417S2-11 passes. No product or probe failures.

Build e2b22f2f92e4fc234c53b8b6568b261ac3cc7af9. Stage message block, runs and asks; run qa-s2-2026-10-23-1. Local macOS arm64 / Node v24.21.0 / isolated Chrome Headless Shell. 95 named tests plus one independent probe pass without skips or retries. No real browser or live-edge mutation. All scratch process censuses clean; scratch root removed. Timing budgets are report-only, no stage speed claim; independent probe B observed 8 ms, bounded receipt-based proof is the named asks test. CPU sample retained. No epic criterion marks.

Original command blocks and per-row scripts, logs and observations are retained alongside this report. Final cover receipts are retained; every scoped row passed.

Both Coordinator-owned stage covers are green at e2b22f2f92e4fc234c53b8b6568b261ac3cc7af9, verification tree 0505c6e99e6db0dcfc63eff1eaef3f5064c0a67f. Final plan missing=[], 4/4 members merged; final detached HEAD=dev=S and tree clean.

- Linux droplet b0527eff-4f31-4a02-a1d7-d78c4183972c, merged A-9785, shards A-9786/A-9787: 3932 pass, 0 fail, 8 skip; T1–T4 and Web completed, linux x64, 2 workers. Shard 1 cland-v0-6ebbbff3, c-8 lon1: admission through remote finish 1023.82 s, collection 24.61 s, lifetime 1014 s, $0.0704. Shard 2 cland-v0-62447b0c, c-8 lon1: 953.82 s, collection 25.74 s, lifetime 945 s, $0.0656. Actual overall admission-through-collection wall 1048.69 s; total cost $0.1360.
- macOS local b077691f-cc33-4fac-9ebe-014012f95fb6, A-9791: 3940/3940 pass, 0 fail/skip; T1–T4 and Web completed, darwin arm64, 2 workers. No droplet lifetime applies; overall macOS wall/cost not supplied in this receipt, not substituted with projections.
- T4 base files ran, T4 repetitions explicitly skipped on both. Duration budgets and lint report-only; projections are not actual walls. No extra QA full suite. No suite failure or retry for this stage run.

After-stage verdict only; no epic criterion marks. All 15 scoped rows PASS. Real browser out of scope per committed brief. Cleanup complete, detached worktree retained until verdict only.

Durable evidence A-9793: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9793-e-417-stage-message-block-runs-and-asks-15-pass-at-e2b22f2f-both-covers-green/report.md

### qa-676 · 2026-10-23T07:33:36.089Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s3-2026-10-23-1
commit: f2899a3e3f587d22351626d7e0b03b490e912834
stage: inbox and composer
stage_hash: 9c7e7b08ca8d20677a57ee8fcc0dcb77fe6a52311683019a52792bdfc907d19a
findings: [{"severity":"low","text":"E417S3-11: thread key table omits r / Reply to Inbox sender; lines 53–54, 642 and 661–662 retain broad stand-in/snapshot/drawer wording contrary to the implemented Inbox thread/reply drawer. k11 and numbered context retained; all required T-1161 markers pass. Brief classifies surrounding docs contradictions as low. Filed T-1164 (XS, stage 4).","file":"web/README.md","line":209}]
finding_counts: {"high":0,"medium":0,"low":1}

# E-417 stage inbox and composer — clear

Run qa-s3-2026-10-23-1; tested commit f2899a3e3f587d22351626d7e0b03b490e912834. All 15 scoped checks PASS.

| Case | Result | Command and observation |
| --- | --- | --- |
| E417S3-00 | PASS | [QA shell] k00: HEAD=dev=S; 5/5 stage items merged; paths and files match; clean detached tree; system TMPDIR; 37 dropped names and zero credential prefixes; probe parses |
| E417S3-01 | PASS | [sealed W] npm run build: exit 0, bundle/assets present and tree clean |
| E417S3-02 | PASS | [test W] nt inbox.test.ts: 16/16 required named tests pass, no skips; 16 clean fixture censuses; sections, drawer reply, leave rules, archive, approvals and events footer |
| E417S3-03 | PASS | [test W] nt composer.test.ts: 8/8 required named tests pass, no skips; 8 clean fixture censuses; kinds, recipients, physical keys, artifacts, drafts and refusal recovery |
| E417S3-04 | PASS | [test W] nt withdraw.test.ts: 8/8 pass, 5 clean censuses; restoration, race/refusal, reload and one-recipient injection removes Withdraw while broadcast stays queued |
| E417S3-05 | PASS | [test W] nt topic-withdraw,topics-component,human-routing,store: 6+41 pass without skips; all required delivery, kind and reopen assertions passed |
| E417S3-06 | PASS | [test W] ten Web files serial: 9+5+4+3+11+9+6+9+4+5=65 passed without skips, all clean fixture censuses; T-1157 Retry test passed first attempt |
| E417S3-07 | PASS | [test W; QA shell] web-keymap 2/2; k07 all bindings and help labels present, Escape0, Neovim leave rule and withdrawable fallback match |
| E417S3-08 | PASS | [sealed W] k08 independent Headless Shell probe 1/1, no step errors; all kinds, withdrawal, partial-injection, leave-area, leave-pane and archive facts match; fixture census 4 to 0 |
| E417S3-09 | PASS | [sealed W] k09 full typecheck and tier lint exit0; all four colour/token/HTML/hooks guards pass and four required classifications present |
| E417S3-10 | PASS | [QA shell] k10 single keyboard listener, guarded preference/draft storage and separate reload guard only; no raw HTML sinks or dependency changes |
| E417S3-11 | PASS | [docs] k11 plus context reads: all18 required markers; 3 forbidden T-1161 phrases absent; low stale drawer/palette and missing thread-r docs reported to Coordinator |
| E417S3-12 | PASS | [sealed W] cland qa lint committed E-417-stage-3.md exit0 |
| E417S3-13 | PASS | [QA shell; cited Coordinator covers] plan complete at fa60a3c7; Linux fe20dee1/A-9893 3971pass8skip0fail and macOS eb92db13/A-9897 3979pass0skip0fail at S; T1-T4+Web actual, budgets report-only; HEAD/dev unchanged clean |
| E417S3-14 | PASS | [QA shell] k14 all 67 Web fixture censuses clean; T1/T2 logs0/0; tree clean and HEAD/dev=S; scratch root removed, worktree retained until verdict |

## Findings

Low — E417S3-11, web/README.md:209–220: thread table lacks r / Reply to Inbox sender, despite keymap.ts:16/:122 and prose at :294. Commands k11 and numbered context read retain absence and implemented binding; Inbox tests prove reply.

Low — E417S3-11, web/README.md:53–54, :642, :661–662: broad stand-in wording, other drawers described as ID/title, snapshot described as future and drawer/pane as stand-in. The implemented Inbox drawer renders its thread/reply; current snapshot model is documented at :178–185/:328–329 and exercised by the named tests. Events remains a stand-in and is outside scope; that specific wording is not a finding. The brief expressly classifies these surrounding-text contradictions as low; all 18 required markers and T-1161's three absence conditions pass. Filed by Coordinator as T-1164 (E-417, XS, stage 4).

QA capture note: E417S3-14's recorder method accidentally says 72 censuses. Raw logs total 67, all clean. Original line retained with census-count-correction.txt; no product/probe rerun. A supplementary source lookup named nonexistent palette-model.ts; it was a read-only lookup, not a scoped check or product result. No product edits or deviations from the brief's execution steps.

Independent E417S3-08 facts: seeded item/topic/both fake workers true; Message/Decision open with no wait, Question waits for qa-coord, response opens it. Withdrawal returns exact old text before new text; withdrawn input never injected. Partial broadcast remains queued but loses Withdraw once qa-other is injected; refusal names qa-other/injected; single message injected with zero buttons. Folded asks remain inside the Inbox visit and disappear on area exit/non-Inbox pane focus, clearing selection; both archive rows retain human outcomes and archive toggles off. All eight expected fact records present, zero step errors.

No epic criterion marks. After-stage verdict only. Both covers are green and the final plan reports complete; detached HEAD and refs/heads/dev still equal S with no changed paths. All original commands, logs, structured facts and recorder lines retained here.


## Execution and cover evidence

Local named tests: macOS arm64, Node v24.21.0, isolated Chrome Headless Shell. 146 named tests and one independent probe passed with zero failures/skips/retries. 67 Web fixture censuses clean; scratch root removed. Full build, typecheck, tier lint and brief lint pass. No real browser; no product fixes. System TMPDIR retained, full fixtureEnvironment after overlays, 37 inherited names dropped, zero credential-prefix count. Queue checked before every test file. No QA full suite. Local monetary cost is not reported and no droplet lifetime applies.

Both Coordinator-owned stage covers tested f2899a3e3f587d22351626d7e0b03b490e912834, tree fa60a3c72ccd068c66a42b273a2e8852444b3f73.

- Linux droplet fe20dee1-73c6-43fb-baac-cbdf84ea74f1: merged A-9893, shard logs A-9894/A-9895, coverage A-9896. 3971 pass, 0 fail, 8 skips; T1–T4 plus Web ran, Web 29 files/132 top-level tests. Two workers, linux x64. Shard 1 cland-v0-1778c772, c-8 lon1: admission-through-remote-finish 1124.48 s, collection 36.38 s, lifetime 1112 s, $0.0772, disk fsync 2.95 ms. Shard 2 cland-v0-815c6141: 924.48 s, collection 22.28 s, lifetime 913 s, $0.0634, disk fsync 2.63 ms. Actual overall admission-through-collection wall 1161.12 s, total $0.1406. Typecheck ran at the host gate and was not repeated on shards.
- macOS local eb92db13-177d-4187-8a85-4a93aff53332: A-9897. 3979/3979 pass, zero failures/skips; T1–T4 plus Web ran, Web 29 files/132 top-level tests. Darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5, two workers. Typecheck local. Overall macOS wall/cost not supplied in the receipt; no projection substituted. Measured per-phase runner walls below.
- Both covers run T4 base files only and explicitly skip T4 repetitions. Duration budgets, lint and T3 ratchet report-only; this is not an enforced budget pass. No missing receipt is treated as zero. No cover rerun was needed.

macOS phase runner walls in T1/T2/T3/T4/Web order: suite duration 30.77s, suite duration 182.47s, suite duration 950.26s, suite duration 50.01s, suite duration 64.83s.

Final plan: `# inbox and composer: open; stage cover complete (Linux droplet, macOS); tree fa60a3c72ccd068c66a42b273a2e8852444b3f73`. Open is expected before this verdict; 5/5 stage members merged. No epic criterion marks.

Durable evidence A-9899: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9899-e-417-inbox-and-composer-15-pass-at-f2899a3e-both-stage-covers-green/report.md

### qa-676 · 2026-10-23T12:24:01.509Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s4-2026-10-23-3
commit: 46d15efdb94b80e53281dda37bb0e6a76d25c7e3
stage: events, notifications and approvals
stage_hash: a6a830037531c55610136d3c6d9075089be80cd1d7f13fcacdc9e614b6195781
findings: [{"severity":"low","text":"E417S4-11 k11/context read retains 'facts that do not yet have UI' for web-area-state although scoped area-slots, Sessions and Accounts checks render those facts. Required markers and T-1164 absence conditions pass; brief classifies surrounding docs contradiction as low. Filed T-1180 (Follow-ups, XS, qa-found).","file":"web/README.md","line":446}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Surface | Result | Command and observation |
| --- | --- | --- | --- |
| E417S4-00 | hub-api | PASS | k00: clean detached HEAD=dev=46d15efd; 5/5 stage members merged including T-1179; all required files and original member paths; only durations.json and tracker changed since superseded S. Setup dropped 37 names, 0 credential prefixes; system TMPDIR; probe parses. |
| E417S4-01 | hub-api | PASS | local macOS at 46d15efd: quiet; sealed npm run build exit 0, production bundle and assets present, tree clean. |
| E417S4-02 | hub-api | PASS | local macOS at 46d15efd: nt events.test.ts 11/11 required named cases pass, no skips or failures; 11 clean fixture censuses. |
| E417S4-03 | hub-api | PASS | local macOS at 46d15efd: notifications.test.ts 8/8 and web-notifications.test.ts 4/4 required tests; no failures/skips, 8 clean Web censuses; Profile persistence, exact click focus, suppression and pure policy match. |
| E417S4-04 | hub-api | PASS | local macOS at 46d15efd: inbox.test.ts 22/22 named cases pass; full approval subjects, optional denial, recent-thread fencing, TUI, failure recovery and races; no skips/failures; 22 clean fixture censuses. |
| E417S4-05 | hub-api | PASS | local macOS at 46d15efd: approval-records.test.ts and codex-native.test.ts serial 47/47 required cases pass, no skips/failures; human-only authority, one winner, native subject/choice/note boundaries and replay/failure recovery. |
| E417S4-06 | hub-api | PASS | local macOS at 46d15efd: 12 neighboring Web files serial, 86/86 pass first attempt, zero failures/skips; every fixture census clean. T-1157 Retry case passed first attempt; no retry. |
| E417S4-07 | hub-api | PASS | local macOS at 46d15efd: web-keymap 2/2; k07 all Events/approval/note bindings/help match, no Escape answering action; Profile switches present, palette actions absent; thread r binding present. |
| E417S4-08 | hub-api | PASS | local macOS at 46d15efd: independent k08 Headless Shell probe 1/1; all 12 fact records match, zero step errors. Events 12/all, warnings2/tasks6 and one marks write; exact notification click focus; optional denial/Escape no-answer; TUI0buttons; peer always wins race. Clean fixture census. |
| E417S4-09 | hub-api | PASS | local macOS at 46d15efd: full typecheck and tier lint exit 0; no diagnostics; all four colour/token/HTML/hooks guard outputs, 23 text tokens, and required 3 Web/1 T1 classifications match. |
| E417S4-10 | hub-api | PASS | k10 at 46d15efd: central keyboard listener only; guarded preference storage and reload guard; no raw HTML, new dependencies, service worker or PushManager; one Notification constructor with expected storage/focus listeners. |
| E417S4-11 | hub-api | PASS | k11 plus full required docs context: 24 markers present, four T-1164 stale phrases and three superseded placement phrases absent. Low T-1180 web/README.md:446 remains contrary to rendered area checks; PASS per brief, no new docs findings. |
| E417S4-12 | hub-api | PASS | sealed cland qa lint qa/briefs/E-417-stage-4.md at 46d15efd: passes at the build, exit 0. |
| E417S4-13 | hub-api | PASS | Cited Coordinator stage covers at 46d15efd: Linux f38a4e61 A-10019 (4008 pass, 8 skip), macOS 118722aa A-10017 (4016 pass, 0 skip), both 0 fail and T1-T4+Web. Plan cover complete tree d0d37dc2; clean HEAD=dev=S. Linux actual wall 1405.90s, cost $0.1691; shards retained, macOS measured phase walls retained. |
| E417S4-14 | hub-api | PASS | k14: all 105 Web fixture censuses clean; T1/T2 logs 0/0; clean detached tree and HEAD=dev=S; scratch prefix checked. Remove scratch after evidence; worktree retained until verdict. |

Low finding — E417S4-11, web/README.md:446, T-1180 (Follow-ups, XS, qa-found). `k11` prints “facts that do not yet have UI” in the web-area-state test paragraph. The test covers Sessions/Accounts/artifact state, and the scoped area-slots, Sessions and Accounts checks render those areas and their facts. All 24 required markers pass, four T-1164 stale phrases and three superseded Profile-placement phrases are absent. The brief explicitly classifies surrounding documentation contradictions as low and keeps the row PASS. T-1180 was already filed; no additional finding or product edit.

Stage: **events, notifications and approvals**. Run **qa-s4-2026-10-23-3**, tested commit **46d15efdb94b80e53281dda37bb0e6a76d25c7e3**, verification tree **d0d37dc242a19dc1daa6ccdf98e4efdb714ab046**. All 15 scoped rows PASS. No epic criterion marks: this is an after-stage verdict only. Printed plan shows 5/5 merged members: T-1127, T-1128, T-1129, T-1164 and request-added T-1179. T-1142/T-1178 remain nonmembers on the build as the brief explains.

Local checks ran afresh at this S. 180 named tests and one independent Headless Shell probe passed on their first attempt, with no failures/skips/retries. T-1157's Retry case passed first attempt. All 105 fixture censuses end `after 0; scratch hub stopped`. Full build, full typecheck, tier lint and brief lint passed. Four web guards passed, including 23 contrast-checked text tokens, raw-HTML rejection and conditional-hook fixture rejection. Mac arm64, Node v24.21.0, installed isolated Chrome Headless Shell; monetary cost not measured/applicable, no droplet lifetime for local cases. This is not a real-browser or OS notification claim: Notification, visibility and focus are stubbed per brief.

The independent probe produced all 12 expected fact records and zero `step` errors. Events: 12 exact rows, warning count 2, task count 6, matching filter/list/subscription facts, shared push=marks.get at 2026-10-23T12:00:00.149Z, previous boundary retained, exactly one mark write, footer clears. Notification: named ask notice once, exact secondary-pane row mounted and focused while animation paused, palette dismissed, window.focus once; looking suppresses another notice; finished task notice has the exact title/body/tag. Approvals: complete subject, one once answer and attributed archive; Escape leaves denial pending with zero answers; empty and nonempty denial notes behave as specified; Claude TUI has no buttons; held page race loses to Neovim's always answer with only that one native answer and zero alerts.

Isolation: clean detached worktree, scratch HOME/XDG/Git, full fixtureEnvironment after overlays, 37 removed inherited names and zero credential-prefix count; system TMPDIR retained. No tests/probe/build during macOS cover-quiet, and queue checked before every file. No real browser, real harness or provider call. Scratch /private/tmp/qa-e417s4-e74mCj removed after captures. Worktree retained only until verdict. Final detached HEAD and refs/heads/dev equal S; zero changed paths.

Both Coordinator-owned stage covers at S are green. No QA full suite was submitted.

- **Linux droplet f38a4e61-aeeb-4470-a3e1-48b95903bef3:** merged A-10019, shard logs A-10020/A-10021. Full T1–T4 plus Web ran; 4016 tests, 4008 passed, zero failed, 8 skipped. Web 31 files/161 top-level tests. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, two workers; typecheck at the host gate, not repeated on shards. Shard 1 cland-v0-6d47a8ad, c-8 lon1: admission through remote finish 1382.76 s, collection 22.73 s, lifetime 1364 s, cost $0.0947, disk fsync 17.67 ms. Shard 2 cland-v0-b1b51402: admission through remote finish 1074.76 s, collection 40.52 s, lifetime 1071 s, cost $0.0744, disk fsync 6.52 ms. Actual total admission-through-collection wall **1405.90 s**, total cost **$0.1691**.
- **macOS local 118722aa-0f26-4ac3-ab77-f66a319c6381:** A-10017, full T1–T4 plus Web ran; **4016/4016 passed**, no failures/skips. Darwin arm64, Node v24.21.0, Neovim v0.12.5, two workers, local typecheck. Measured per-phase runner walls T1 31.52 s, T2 186.76 s, T3 950.70 s, T4 47.18 s, Web 77.77 s. Overall macOS wall/cost not supplied as such; no projection substituted. No droplet lifetime applies.

T-1179's corrected SIGTERM worker test passes in both integrated runs: macOS 999.55675 ms, Linux 2652.637915 ms. Both new held-slot regression identities pass 5/5 load-gate repetitions on both platforms. Linux remote-fixture owner timeout, SIGTERM, watchdog-SIGKILL and watchdog-teardown all pass. These are cited cover evidence, not extra QA executions.

T4 base files ran, repeated T4 soak skipped as each receipt states. Existing duration budgets, lint and T3 ratchet are report-only; projected walls are not measured walls. New-identity duration admission uses the committed E-880 allowances: remote owner 11 s, lifecycle worker 7 s, dated 2026-10-23 and expiring 2026-10-30. The covers passed with these allowances; this is not evidence of meeting the previous 5 s limit. The allowance diff and rationale are retained in build-diff.txt. No test assertions or wait bounds changed in that commit.

Final plan line: `# events, notifications and approvals: open; stage cover complete (Linux droplet, macOS); tree d0d37dc242a19dc1daa6ccdf98e4efdb714ab046`. Open is expected before the verdict; all five items are merged.

Historical evidence remains separate: A-9983/A-9987 cover the abandoned e2721ab5 pass with failed macOS cover; A-10014 is the static-only superseded 1f199894 run. None substitutes for this run's tests. This fresh request superseded the duration-gate failure at 1f199894; all local behavior and final gate were executed afresh. Existing rule proposal about retaining failed receipts and naming unrun phases was logged by Coordinator. No brief deviations in this run.


Durable evidence A-10025: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10025-e-417-events-notifications-and-approvals-15-pass-at-46d15efd/report.md
