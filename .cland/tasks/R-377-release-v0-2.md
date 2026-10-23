---
id: R-377
kind: release
version: 0.2.0
title: "Release: v0.2"
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-14T08:32:48.485Z
updated: 2026-10-23T22:17:58.755Z
---

## Goal

v0.2 brings the web workbench: everything the Neovim workbench shows and does, in the browser, more convenient and without the limits of a console interface, with the hub as the single source of truth. Neovim stays as the alternative: it is good for a fast start, for setting up the process and for driving the harnesses; once a project's work has settled and scaled, the human moves to the browser to watch, plan and steer.

## Notes

Scope by `docs/spec/v0.2.md` (complete 2026-10-14, charted by the map M-399; the cut Q-409 in §4): nine epics, E-412 to E-420, beside three the human added on the way: E-789 and E-795 (asked in General on 2026-10-18) and E-1006, the human's P1 of 2026-10-20 16:55Z on the Neovim workbench's slow start. Version 0.2.0 is R-377's recorded version. The build started on 2026-10-20 at 16:40Z on the human's «стартуй», relayed by the stand-in cland-impl, and ran under the Coordinator `coord`. The stand-in answered for the human under D24 at night. Implementers and Reviewers ran on Codex gpt-6.1-sol. QA ran as one session, qa-676, on Codex gpt-6-astra, the computer-use model for real-browser briefs (T-1011), and it recorded every stage and epic verdict. The Coordinator ran on Claude Code, claude-opus-5-5. Two lanes ran in parallel, the hub lane (E-412, E-413, E-414) and the web lane (E-415 to E-419). Every epic ran in stages. Each stage closed on a Linux droplet cover, a macOS cover and an after-stage QA run. Each epic closed on a Definition-of-done demo on a droplet demo lease, with a full epic suite. The hub's merge queue batched and covered every landing: 131 items under R-377 landed on `dev` from 2026-10-20 to 2026-10-23, beside 33 landings of items filed in the categories. The suite gained its Web phase in Chrome Headless Shell. At E-419's third stage the macOS cover ran 42 Web files and 216 tests in 97.7 s.

The goal: the human watches, plans and steers the crew from the browser, on the desktop and on the phone, with the hub as the single source of truth, and Neovim stays as the alternative client of the same protocol.

What the human can now do, by epic:

- **E-412 The web edge and the protocol extension.** `cland web` prints a one-time link and opens the browser. The link signs the browser in with a 30-day HttpOnly, SameSite=Strict cookie named per project, and the cookie survives hub restarts. The web edge is its own listener on a stable loopback port recorded in `hub.json`. It checks Host and Origin on every upgrade, accepts only a client hello and never hands a browser the hub's secret. `cland web --qr` prints the link as a QR code once `[web]` names a tunnel or the local network, and `cland doctor` warns about plain HTTP. Cookie sessions are listed and revoked from the CLI. A browser connects with one snapshot: about 0.6 MB on a 1,050-item copy of the live tracker, where the prototype needed 1.15 MB from eleven reads. After that it receives numbered deltas, resumes to exactly the missed ones after a drop, and takes a fresh snapshot after a hub restart. Threads page by message number, and artifact files are served under capability URLs, HTML with a sandbox policy. The web cannot stop or reload the hub, release, sync, push, publish or create artifacts from paths: these stay in the CLI and Neovim. QA clear: qa-2026-10-21-3 (A-8442).
- **E-413 Hub-computed fields and read marks.** The hub computes once, for both clients, the item summaries and roll-ups, the card's facts, unread counts, the merged session rows and the events filter. The human's last looks and read marks live in the hub, so a topic read in Neovim reads as read in every browser. Closed tasks load on demand, so the snapshot stays under its cap as the tracker grows (T-1081). A run of agent messages carries a fold line built from facts. Declining an ask is an answer with the value `declined` and a reason, and the topic stays open. QA clear: qa-dod-2026-10-22-1 (A-9187).
- **E-414 The approvals relay.** Every command approval has one record in the hub. Codex app-server approvals and OpenCode permission requests are answered from the web or Neovim's inbox with Approve once, Always for this command, or Deny with an optional note. Claude Code's approvals stay in its TUI and are marked "answer in Neovim", and so is an approval too large to show in full. The first answer from any client wins; a later one is refused, naming who answered and when. Nothing answers on a timer, and pending approvals survive a hub restart. QA clear: qa-dod-2026-10-23-1 (A-9882).
- **E-415 The web workspace and the shell.** The `web/` workspace builds the workbench with React 19, Vite and strict TypeScript. It uses no UI library, styles everything through the tokens, and self-hosts its two fonts. The shell has a rail of seven areas (Inbox, Items, Sessions, Topics, Events, Artifacts, Accounts), which collapses to icons. The top strip holds the release switcher, the palette, the Coordinator, the needs-you pill and the hub's dot, and the tab title carries the needs-you count. ⌘\ splits the main area, and the drawer opens on the right. The palette opens on ⌘K, and `?` lists the keys. Every key matches by physical code, so the Russian layout works. Folds are remembered per browser. QA clear: qa-dod-2026-10-21-1 (A-8600).
- **E-416 Items in the web.** The Items area brings Neovim's explorer to the browser: the tree with its roll-ups and folded roots, and the card in the drawer from the snapshot's facts. `s` scopes, `m` and `M` send to General or the item's topic, and Board, Graph and Plan are views that keep the scope, the filter and the selection. The Plan view shows what changed since the human's last look, and `a` approves a waiting plan. Criteria are edited on the card. Nothing ranks or moves with the mouse. QA clear: qa-dod-2026-10-22-1 (A-9196).
- **E-417 Topics, threads and the inbox.** The human steers the build from the browser. Topics are grouped, with General and Agents set apart. Threads render Markdown, role colours, verdicts and artifact chips, and history loads in pages. Folded agent runs open in place. HTML artifacts show inline in a sandboxed iframe. An ask is one record shown as an inbox row and a thread card with the same keys, and it folds to its outcome in both places. The composer offers Message, Decision and Question with the addressee chip. Queued messages can be withdrawn, and drafts survive a reload. The inbox has its four sections, a drawer and an archive. The Events view filters, groups by day and keeps the last look. Notifications fire while the page is open, for now-layer items only, with "needs you" and "finished" switches. QA clear: qa-dod-2026-10-23-1 (A-10043).
- **E-418 Sessions, artifacts and accounts in the web.** The Sessions area shows the crew in Yours, Waiting, Busy, Idle and Stopped, from the hub's merged rows. The verify line opens the queue view with the slots, the waiters and recent runs. Stop, Resume, Archive and Capabilities work from a row or the session's page, with Stop and Archive confirmed. Launch a session and New Aide work from the header. The session's drawer shows its recent thread, its pending approval and a composer. The Accounts area lists every account's windows, resets and the age of each reading; the notification switches and this browser's sign-in sit beside the profile. The Artifacts area opens notes, pages and files. There is no Attach in 0.2.0. QA clear: qa-dod-2026-10-23-1 (A-10054).
- **E-419 The phone and notifications.** Below 640 px a bottom bar of Inbox, Topics, Sessions, Events and More replaces the rail. The inbox is home, and More opens Items, Artifacts and Accounts read-only. An ask opens as a bottom sheet over the keyboard. Decline needs a reason, and nothing answers on a swipe, the scrim or Escape. A topic opens full screen, with a touch composer that sends only on Send. Session rows are two lines, and their actions live on the session's page. When the socket drops, a strip says since when and when the next retry runs. Answers and Send are disabled, nothing is queued, and the client resumes on reconnect. Plans waiting for approval and TUI-bound approvals show on the phone but are not answerable there. The page installs as an app. `cland web --qr` signs a phone in, and the phone is notified through a service worker over HTTPS through the human's own tunnel, as the tunnel guide in `web/README.md` describes. Its stages closed in order: the bottom bar and inbox home, asks, threads, the composer and install, sessions and the disconnected state, and notifications with the guide. QA clear: qa-dod-2026-10-23-1 (A-10275). Full Chrome for Testing 156 confirmed installability on loopback and a real notification through the service worker. The human's own phone and tunnel are dogfooding.
- **E-789 Panels by choice in the Neovim workbench.** Items, Inbox, Sessions and Topics each open on either side from the palette, keeping their keys and live updates. `gm` moves a panel to the other side. The layout survives a restart, and "Reset panel layout" restores the default sides and widths. QA clear: qa-2026-10-20-3 (A-8083).
- **E-795 Rendered Markdown artifacts in the Neovim workbench.** A Markdown artifact opens as a rendered read-only view built from the thread's Markdown, with tables laid out and a key that toggles the raw editable buffer. A 20,000-line note opens at once and never blocks input. The view follows new versions of the artifact, and every surface that opens a Markdown artifact renders it. QA clear: qa-2026-10-21-2 (A-8244).
- **E-1006 Fast Neovim workbench start (P1).** The workbench took minutes to start, and one failed start reached 8.4 GB in Neovim. On the human's Mac with the live tracker (1,036 items) it now starts in under 3 s: «Ну он запустился меньше чем за 3с». Neovim's read loop no longer re-copies its buffer (T-1037). Startup replies are bounded (T-1038), and the explorer loads open items first. An idle workbench sends no requests. A smoke test fails when startup or the first payload exceeds its budget on a 1,000-item tracker. Tracker writes no longer leave `.conflict` captures, and old captures are pruned after 7 days (T-1009, T-452). QA clear: qa-2026-10-22-1 (A-8778).
- **Also on `dev`, directly under R-377.** The hub starts serving without stalls: no per-item explorer recompute at start (T-1104), and no 16 s silent gap when a droplet lease needs recovery (T-1152). `hub.stop` reaches stopped while a droplet create is in flight (T-1151). A test run can no longer flip `core.bare` in the live repository (T-973), and the sealed child-launch guard is back (T-971). The role clauses were trimmed to make room for v0.2's lines (T-975), and skill provenance no longer forces merge conflicts (T-1145).
- **E-420 Release v0.2.0 from the item.** The root `package.json` and the lockfile move to 0.2.0 (T-1185). `web/README.md` and `hub/README.md` describe the web workbench as built, from a fresh clone to a signed-in browser (T-1186). Its QA demo runs the integrated pass across the lanes: one approval gate across a desktop context, a phone context and Neovim, read marks agreeing across clients, and the phone resuming after a hub restart. The demo then takes the dry run, and its verdict is recorded on E-420.

The demos found these, and each was fixed before the release:
- T-1093: stale wording about closed pages in `nvim/README.md`, from E-413's first fields run, which was not clear;
- T-1095 and T-1097: the Items help dialog's last rows could not be reached in a real Chrome window or at 1024×600;
- T-1159: `hub/README.md`'s approval section still called the relays pending;
- T-1160 and T-1164: `web/README.md` still described Artifacts, the thread keys and the snapshot client as stand-ins;
- T-1182: a Web test measured the narrow Sessions row before the phone layout switched, which made E-419's first stage run not clear;
- T-1031: the web-auth test failed without a built bundle when run alone.

Stage covers found T-1179 (since T-971, a fixture-worker test failed in every local macOS run because its sealed child dropped the suite lease) and T-1183 (13 Web tests paused the page clock at the time they installed it, which failed under load). Implementers fixed T-1157 (the Topics Retry flake) inside T-1141. A stage cover also found T-1102: the web opened the unversioned release R-1100 as the current one, and now opens R-377.

Decisions of the run:
- The human, 2026-10-20 16:54Z (ask 310190bf, A-7719): approved E-415's plan, with no development bridge and the listed dependencies. These are React, Vite, oxlint, and playwright-core with Chrome Headless Shell for tests only. The two fonts are vendored under OFL and the QR encoder under MIT. The Web phase is its own tier outside T0–T3, run in a task's own verify and in every periodic, stage and release run. In the same ask: four Neovim panels became placeable, with Events, Artifacts, Accounts and Verification left to Ideas; Markdown artifacts open rendered with a raw toggle; and the web cookie is named per project, since cookies are not isolated by port.
- The human, 2026-10-20: QA also tests the web in the human's real browser through computer use, in a dedicated cland profile (T-1011).
- Coordinator, 2026-10-20 (T-981): the web edge refuses every frame by default unless its table allows it. The hub's stop and reload, release, sync, push, publish, config and crew changes, the executor frames and artifacts from paths stay in the CLI and Neovim.
- Stand-in under D24, 2026-10-22 (ask 9a81a158): an approval record carries the command, its directory, the reason and the change, capped at 64 KB. Only the human answers approvals, and the deny note is optional. Only a human Question leaves a topic waiting. Coordinator refinement, 23:30Z: an approval that does not fit the cap is answered in the harness's TUI.
- The human, 2026-10-22: rule batches A-8634 and A-9063 became rule 18 (crew sessions never drive the human's browser or desktop), rule 19 (land a capability and restart before anything depends on it) and an edit of rule 15. E-778 moved to the new release R-1100 "Public launch".
- Coordinator, at E-419's cut (2026-10-23): on the phone, Events is read-only and unfiltered (tap filters are T-1177), the disconnected strip is phone-only, the composer has no attach, and an ask card opens the ask sheet.

Deferred to 0.2.x (spec §4): a harness terminal in the browser, so no Attach either; direct edits with the mouse (drag to rank, move between epics); a home page over several projects; push notifications with the page closed; Neovim adopting the snapshot and the deltas; a read-only view for another person.

Known issues, in Bugs (C-325) and Follow-ups (C-326):
- T-1184: the merge queue dropped a batch member as "task branch changed during preparation" though its head had not moved, which cost one extra batch cover;
- T-1181: cland should provision, for every project and launched Claude Code session, the hook that refuses an `rm` with a computed target, since that prompt stalls sessions; this project carries its own copy (16c563e0);
- T-1162: a Codex approval answered in the TUI while the hub's answer is in flight can record the hub's choice;
- T-1158: Mermaid diagrams open as source in the web, since rendering needs a new dependency or a hub route;
- T-1177: tap filters for Events on the phone;
- the Web phase's test infrastructure: T-1148 (an empty quarantine receipt crashes the runner and hides the Web failure), T-1098 (the periodic culprit search cannot bisect Web files), T-1083 (two Web fixtures overwrite one failure trace), T-1070 (`tests.md` lacks the palette test);
- T-1086: `cland demo status` reports a lease active before `demo exec` accepts it.
- T-1189 (needs the human's approval): `npm audit` reports zod 4.5.4, pinned in `hub/package.json` (high, GHSA-mrhx-c7xc-m3w5), and ip-address 10.7.3 (moderate);
- T-1187: `cland hub reload` acknowledges `[web]` changes that the running web edge ignores until a restart, which `hub/README.md` now says;
- T-1188: `cland release --help` exits 1.

In all, 40 items are open in Bugs and 15 in Follow-ups. Most of the rest are crew-side test, executor and harness items.

The retrospective artifact of the run follows the release and will be linked from R-377.

## Epics

| Key | Id | Title | Blocked by |
| --- | --- | --- | --- |
| E01 | E-412 | The web edge and the protocol extension | none |
| E02 | E-413 | Hub-computed fields and read marks | E-412 |
| E03 | E-414 | The approvals relay | E-413 |
| E04 | E-415 | The web workspace and the shell | none |
| E05 | E-416 | Items in the web | E-412, E-415 |
| E06 | E-417 | Topics, threads and the inbox | E-413, E-416 |
| E07 | E-418 | Sessions, artifacts and accounts in the web | E-416 |
| E08 | E-419 | The phone and notifications | E-417 |
| E09 | E-420 | Release v0.2.0 from the item | E-414, E-418, E-419 |

The build starts after v0.1.3 ships, led by the cland-impl session as v0.1.2 was: the hub lane (E-412, E-413, E-414) and the web lane (E-415 to E-419) run in parallel, E-420 releases from this item, and the blocking edges are on the epics (spec v0.2 §4).

## Comments

### human · 2026-10-14T16:52:46.528Z

Handover to the implementation session (cland-impl), 2026-10-14: v0.2 "the web workbench" is planned; you lead the build as for v0.1.2, starting after v0.1.3 ships; questions only the human can answer go to the inbox as asks and wait.

Spec: docs/spec/v0.2.md (complete: §3.1 two clients of one protocol, §3.2 the shell, §3.3 the live model, §3.4 threads and actions, §3.5 editing parity with Neovim, §3.6 notifications and the phone, §3.7 serving and security, §3.8 scope, §4 the release); GLOSSARY: Web workbench, Rail, Drawer, Snapshot, Delta. Epics under this item, labelled epic, v0.2, ready-for-agent: hub lane E-412 The web edge and the protocol extension → E-413 Hub-computed fields and read marks → E-414 The approvals relay; web lane E-415 The web workspace and the shell (no blockers; starts on the prototype's bridge until E-412 lands; the human approves its plan by hand: ask, and launch nothing under it until task plan show reads approved) → E-416 Items in the web (also after E-412) → E-417 Topics, threads and the inbox (also after E-413) → E-418 Sessions, artifacts and accounts in the web and E-419 The phone and notifications (after E-417) → E-420 Release v0.2.0 from the item (after E-414, E-418, E-419). About 50 sessions; crew as v0.1.2.

References, never merged: research branches research/web-client-surface, research/web-prior-art, research/web-stack (its probe holds a working web edge and a Playwright harness), research/web-terminal (eight protocol reservations, in spec §3.3); the prototype branch prototype/web-shell (a read-only React shell against the live hub with a bridge; a built worktree at ../web-shell); the mockups in docs/design/web/ (nine boards with renders and a README; the canvas https://claude.ai/artifact/Cqc3KRR8tXG1yd395B6vf6 on the human's current account). The web phase of the suite is its own shard on node:test with playwright-core; the web never sees the hub's secret; no hex colours outside the tokens; keys by physical code; no allow-scripts with allow-same-origin.

Rules that stay: as on R-294's handover (English artifacts; sub-agents never use the hub; the Fable co-author line; only cland release pushes to GitHub; the frame protocol first, fake harnesses second, Playwright third; no routing around refusals; cland verify for suites). Dogfooding: the web edge and the snapshot serve the shell first; the human steers from the browser once Topics and the inbox land; the phone layouts are tried on the human's phone through their tunnel. Definition of done: every epic's demo run by QA on dev with a clear verdict, the web phase included; v0.2.0 released from this item; a retrospective artifact; no human acceptance pass. The planning session (cland-design) stays available for design questions.
