---
id: Q-405
kind: question
title: A clickable React prototype of the shell against the live hub, read-only
state: open
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-399
blocked_by:
  - Q-400
  - Q-404
topic: null
branch: null
created: 2026-10-14T13:03:50.469Z
updated: 2026-10-14T15:15:44.926Z
---

## Question

Does the shell feel right in a browser against the live hub? A throwaway React prototype on prototype/web-shell (a web/ workspace started from the stack research): the rail, a main area with the explorer tree and the card from the hub's real items, a thread read-only, the inbox, live updates over a WebSocket bridge to the hub's frames (the bridge throwaway if the hub lacks it), keyboard navigation and the palette; measured: first paint, update latency, bundle size. The human tries it and reacts.

## Comments

### human · 2026-10-14T15:15:44.926Z

Prototype built and pushed: branch `prototype/web-shell` at `d352d4b1` (to `origin`, the local territory; throwaway, never merged). Read-only against the live hub. The full write-up is `web/PROTOTYPE.md` on the branch. Not closing: the human tries it first.

**Run it.** The hub keeps running from the main checkout and nothing in that checkout changes; the bridge reads `.cland/hub.json` there and opens the hub's Unix socket as a client (`client: "web-proto"` in the log), sending reads only.

```sh
git -C /Users/evgeniyivanov/Projects/cland/v0 worktree add --detach /Users/evgeniyivanov/Projects/cland/web-shell prototype/web-shell
cd /Users/evgeniyivanov/Projects/cland/web-shell
npm install                      # hub and web workspaces, ~125 packages
npm run build --workspace web    # web/dist, under a second
node web/proto/bridge.ts --root /Users/evgeniyivanov/Projects/cland/v0
```

Open the printed one-time link (`http://127.0.0.1:7405/auth?token=…`, ten minutes); it sets a cookie, reloads keep working. Enter in the bridge prints a new link, `stats` its memory, Ctrl-C stops it. Tests without a browser: `node --test web/proto/*.test.ts` (14 pass in 0.3 s). Afterwards: `git -C /Users/evgeniyivanov/Projects/cland/v0 worktree remove /Users/evgeniyivanov/Projects/cland/web-shell`.

**Works.** The bridge (`web/proto/bridge.ts`, the Q-402 web edge's shape): loopback, strict CSP, one-time link → HttpOnly SameSite=Strict cookie per port, exact Origin and Host checks, `/ws` relay to one page, the secret added by the bridge, never sent to the page. Read-only: 12 frame types pass (`subscribe`, `hub.status`, `topic.list`, `topic.history`, `session.list`, `role.list`, `inbox.list`, `task.list`, `task.view`, `task.plan` show, `account.list`, `events.list`); everything else, `task.plan` other than show, `hub.status` with `flushLogs` and any `as` are answered `read-only` by the bridge and never reach the hub; a banner says so. The shell on the Main board's tokens (top strip, rail of seven areas with counts, collapse to icons, drawer). Items › Tree from the 410 real items: release root with epics done/total, cells or a proportional bar past 16, in-progress/review/qa counts, stage, lead; epics unfold into stage labels and "done" in closing order; tasks with claim or holder, latest verdict with round, verified/total; Direct tasks, Categories (top three, N more), Unscheduled, Other releases; `D`, `A`, folds in localStorage, cursor kept by key across frames; Board, Graph, Plan say "not in this prototype". The card follows the cursor: path, summary by the v0.1.2 §3.9 rule (the TS port matches the Lua on all 410 bodies), facts, progress or criteria with marks, plan, latest verdict boxed with its reason, branch and verify, relations, dates, decision, agents' text folded. Topics in groups (waiting, standing set apart, items, other, closed folded) with a read-only thread: role colours, the human's band, delivery stages, folded runs per day, asks as cards without buttons, answered asks on one line, pages of 50. Inbox on the now layer in four sections (five rows, fold naming the oldest wait, the selected row unfolded), drawer with the row's thread, events line, archive. Sessions: accounts block, verify line opening into the queue, groups yours/waiting/busy/idle/stopped, foldable and remembered, drawer with the session's messages among agents. Minimal Events. Every pushed frame type applied to one model with hub.lua's per-read journal. Keys by `KeyboardEvent.code` (checked with the Russian layout): `1`–`7`, `j`/`k`, `l`/`h`, Enter, Esc, `D`, `A`, `za`, `?`, ⌘K palette (areas, items by number or title, `/` topics, `@` sessions).

**Stubbed.** Every write (composer, quick message `m`/`M`, ask answers, approvals, decline and read marks, launch/stop/resume/archive, pin/mute); Artifacts and Accounts areas; Board, Graph, Plan; scope `s`, split panes, `gi`/`gt`/`gs`; inline HTML artifacts; Events filters and paging; phone layout, notifications, PWA; several browsers at once.

**Measured** (M4, Chrome Headless Shell 156 via playwright-core 1.64.1, 1440×900; the live hub with a suite run holding the queue; three runs):
- First paint 244–264 ms (FCP 292–312 ms); on reload 12–32 ms.
- First full tree (410 items): 1.70–2.05 s; on reload 1.59–2.60 s. The browser's own share after the last answer is 20–46 ms; the rest is the hub. The 11 connect reads finish together at 1.4–2.1 s on its one loop; alone `task.list` takes 52–65 ms but `hub.status` 0.29–1.57 s (308 KB of its 336 KB is `suites`, 314 records), and the tree needs `hub.status` for the ladder. 1.15 MB read per connect (`task.list` 539 KB, 46 % of it verdicts).
- Update latency, a hub frame to the screen (281 frames over 251 s): median 2.5 ms, p90 6.2 ms, max 39 ms (bridge→page 0.5 ms median, model+render+paint 2.0 ms); `task` frames 9.5 ms median (the explorer rebuilds from 410 items).
- Traffic: 244 of the 281 pushed frames were `verification.queue`, about one a second, the whole queue (2 KB) each time; `task` frames 9.8 KB on average, 8.5 KB of it the all-items `layers` map.
- Bundle: JS 359 KB (108 KB gzip), CSS 34 KB (6.9 KB gzip), built in under a second.
- Bridge memory: idle RSS 96 MB (heap 13 MB); after a load 110–120 MB (heap 18–33 MB); after a 4-minute watch 66–100 MB. Node 24 with a `.ts` entry is 73 MB by itself.

**Open points for the spec.**
- Q-407: (1) the snapshot should carry the tracker's ladder and leave `hub.status`'s 314-record `suites` to a page; (2) one snapshot composed in one tick instead of 11 reads that queue on the hub's loop, with a size budget (1.15 MB today); (3) `task.list` carries every verdict (841, 46 %) where the tree needs the latest per kind and its round; (4) `verification.queue` once a second while a run holds the queue: send it on changes of holder or waiters, clients age the times; (5) `task` frames carry all items' layers, send only the changed ones; (6) without `seq` every client re-implements hub.lua's per-read journal and the topic watermark rule; (7) read marks: a read-only web never sends `topic.read`, so unread only grows (Agents 14,927); the spec has to say what counts as read in a browser, held in the hub; (8) the events' last look disagreed between Neovim (`ui.json`) and the web (localStorage) at once: hub-held is needed; (9) the read-only allowlist is 12 frames with 3 argument checks, the cheap form of the web edge's allowlist; (10) a card costs a `task.view` (52 KB for T-347) and each epic row a `task.plan show` for its stages' state, which the summary, the verdict reason and stage state on `ItemSummary` (W10) would remove; (11) a bridge outside the hub on the Unix socket worked unchanged for 0.5 ms a frame: a fallback if the in-hub edge slips.
- Q-408: folded runs read well, but a run lists up to 11 participants (show three and a count); an answered ask folds to one line and its answer message is not shown again (a choice to confirm); one ask, one state across the inbox row and the thread card; approvals still have no frame (W12); item ids in messages as links into the explorer are cheap and worth keeping.
- Q-409: bundle 359/108 KB; self-host Golos Text and JetBrains Mono (Google Fonts need two CSP exceptions and the network); the strict CSP blocks Playwright's `waitForFunction`, so test helpers poll through `page.evaluate` and keep the CSP on; the web duplicates ~850 lines of explorer and summary logic from Lua, guarded here by a differential test against the Lua (0.17 s for 410 bodies) until W10; `account.list` answered an empty registry on this hub, so the account meters were not exercised with real data.

Choices where the spec is silent are marked `// choice:` in the code and listed in `web/PROTOTYPE.md`.
