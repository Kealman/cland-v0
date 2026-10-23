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
updated: 2026-10-23T02:33:00.313Z
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
