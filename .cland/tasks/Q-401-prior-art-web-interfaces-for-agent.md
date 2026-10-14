---
id: Q-401
kind: question
title: "Prior art: web interfaces for agent orchestration, threads with approvals, keyboard-first planning"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-399
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:49.377Z
updated: 2026-10-14T13:47:04.024Z
closed: 2026-10-14T13:47:04.024Z
---

## Question

Prior art for the web workbench: web interfaces that watch and steer many agents or long-running threads with approvals (Claude Code's web and desktop surfaces, Codex cloud, OpenCode's web in v1, Devin, Cursor background agents, GitHub Copilot's agent views), planning tools with keyboard-first web UIs (Linear, Height), and chat tools with threads and actions (Slack, Zulip). For each: how it shows many concurrent agents, how approvals and questions reach the human, threads and folding, live updates and reconnection, keyboard model, the phone. Copy and avoid lists for spec v0.2 §3.2, §3.4, §3.6. Deliver docs/research/web-prior-art.md on research/web-prior-art and the resolution comment here.

## Comments

### human · 2026-10-14T13:46:48.774Z

## Resolution

Research note `docs/research/web-prior-art.md` on branch `research/web-prior-art`, commit `13be1b44dc44fb7b7c497fb2abcb62da9ef24c4c`, pushed to `origin` (the local territory); research branches are never merged. Every source is cited with the date read (2026-10-14); a quote check found all 260 quoted fragments in the saved sources. No product was used hands-on: behaviour is documented, read in source, or reported first-hand.

Surveyed: Claude Code (claude.ai/code, the desktop Code tab, Projects, Remote Control, agent view), OpenAI Codex (cloud, app, mobile), OpenCode's v1 web UI and what v2 kept, Devin, Cursor cloud agents, GitHub Copilot (agents panel, mission control, CLI remote control), LangGraph Studio and Agent Inbox, AutoGen Studio, CrewAI AMP, Vibe Kanban, Google Jules, Linear, Height, Slack, Zulip, Discord, and the browser constraints that bear on the phone and the keys.

### The comparison in brief

- **Many agents:** every surface groups "needs you" first (agent view, Claude Projects' Overview, Devin's Working/Ready/Blocked/Inactive, Codex mobile's Priority view, Agent Inbox's Interrupted tab) and gives each row a live one-line summary and an age. cland's sessions panel and InboxNow already have this shape.
- **Approvals:** fast where aggregated and keyed (Agent Inbox; Devin's bell inbox; Copilot CLI remote control, first answer wins; the Codex app, Enter approves). The common failure is an approval stranded in one thread (Claude Projects, Jules, agent view's attach for permission prompts). Timers that decide for the human are common and trip users up (Jules auto-approves plans, CrewAI auto-responds, Vibe Kanban approvals time out, Claude Code on the web counted expired approvals as rejections until 2.1.280).
- **Long runs:** fold into a status line with counts and an expand (OpenCode v1 "Show steps", Claude desktop's three view modes, Devin's single-line status, Linear's ephemeral activities). Slack's designers found inline expansion loses the reader's place and moved threads to a side panel.
- **Live and reconnect:** snapshot plus sequence-numbered catch-up (Linear's lastSyncId, Zulip's last_event_id with a dropped queue and a reload). Reconnection is where products lose approvals (Codex iOS fix 2026-09-01, Cursor web stuck on "Agents populating…", Claude Code's growing event backlog fixed in 2.1.225). AutoGen Studio stops a run when its WebSocket closes.
- **Keys:** ⌘K palette with prefixes (GitHub's `#`, `@`, `>` line up with cland's), single letters, `g` sequences, `?` or ⌘/ for the list. Browser costs: reserved chords (Slack's Ctrl+T and Ctrl+Shift+T are desktop-app only), layout-dependent letters (Slack), ⌘K inside Markdown fields (GitHub moves its palette to ⌘⌥K there).
- **Phone:** everyone shows the needs-you list first and answers in place; nobody plans on a phone (Codex mobile, Cursor iOS, the Claude app, Linear's apps).
- **Hosted dashboards die or drift:** Height (shut 2025-09-24), Vibe Kanban's company (2026-04-10) and its relay, OpenCode v1's web loaded from app.opencode.ai, GitHub mission control hiding sessions for 14 hours.

### Copy and avoid, mapped to spec v0.2

**§3.2 The shell.** Copy: needs-you groups first with counts and an "N more" fold in every list; rows that say what they wait on and for how long; Space peeks the row into the drawer, ↑/↓ move the peek (Linear, agent view); palette prefixes compatible with GitHub's, preview of the highlighted item, keys shown per action; one key to the next thing needing the human (Codex ⌘⌥A, Zulip N); `?` with ⌘/ as alias; modifier-click splits the main area. Avoid: browser-reserved chords (⌘T, ⌘W, ⌘N, ⌘⇧T); letter keys bound to characters instead of `KeyboardEvent.code` (breaks the Russian layout, the web's `langmap`); Esc as a decision key (Codex declines on Esc); a dashboard with state of its own (lists come from the hub); irreversible layout switches and one-by-one list hygiene.

**§3.4 Threads and actions.** Copy: one card with explicit decisions and keys (options 1–9 plus a free answer; reject with a reason; edit where it makes sense); the card resolves in place into its outcome (Slack replace_original, Discord UPDATE_MESSAGE); the approved thing is in the card (command in full, diff, plan summary with expand); one gate in the hub, first answer wins, all clients see the result; folded runs show a live one-line summary (who, count, latest step, age) and a per-thread verbosity toggle; a visible, retractable queue for messages to a busy session; line comments on a diff or artifact bundled with the next message; child work as live chips; HTML artifacts sandboxed without `allow-same-origin` on the hub's origin. Avoid: approvals answerable only inside one thread; timers that decide; "respond" used as a denial (LangChain: it returns a successful tool result); modal approvals that lock navigation (Vibe Kanban #3247); clicks that silently do not take; expanding long runs in place so the reader loses their position.

**§3.6 Notifications and the phone.** Copy: needs-you count in the tab title and an app badge once installed (Badging API); notify only for the now layer and not while the human is looking, naming session, item and what it waits on, click opens the inbox row; separate switches for "needs you" and "finished"; at phone width the needs-you list is home, answers in place, a bottom tab bar replaces the rail; on return, catch up from the last delta, keep unsent text, Send disabled while disconnected. Avoid: notifications raised on the host instead of the browser (Vibe Kanban #2882) or only in a desktop app (Claude Projects); a vendor relay for remote access or the page; approvals lost across reconnects (pending asks and approvals belong in every snapshot); notification floods; assuming a LAN phone over plain HTTP can notify or install the page.

### Open questions for Q-408

1. **Approvals: one card, two places?** Does an ask or a command approval appear both as an inbox row and as a card in the item's thread view, with one hub state, the same keys (1–9, Enter, a decline key that is not Esc), collapsing in place into its outcome once any client answers? Does a command approval in the web offer only "once", or also "for this session" where the harness supports it?
2. **Threads: where does a folded agent run open, and what does its fold line say while it grows?** In place with the anchor kept (v0.1 §3.14 manual folds) or in the drawer (Slack's lesson)? Is the one-line summary built by the hub from facts or written by a model?
3. **Composer: which key sends, how is a message to a busy session queued and withdrawn, and what does ⌘K do with focus in the composer** (GitHub uses ⌘⌥K in Markdown fields, where ⌘K inserts a link)?

### Gaps and corrections

- The brief's premise is corrected: OpenCode v2 kept a web UI served by its server, reached through `opencode pair` (one-time links valid 5 minutes, 30-day cookies); only the `web` and `attach` commands went.
- **Risk for Q-406, Q-407 and Q-409:** the Notifications API, service workers, PWA installation and the Badging API need a secure context; `http://localhost` qualifies, a LAN address over plain HTTP does not, so a phone on the local network gets no notifications and no install. iOS gives web push and badges only to Home Screen web apps (16.4+).
- **For Q-407:** pins and mutes change what is "now" (v0.1 §3.5) but live in Neovim's `ui.json`, and v0.2 §3.1 keeps the web's interface state in the browser; Claude Code users report inconsistent groups across its clients (#97744).
- Not documented in what was read: claude.ai/code's keyboard map, the current Codex cloud task list on the web, cursor.com/agents' keys, the dashboards' keys and phone behaviour. Height's own pages were unreachable (connection reset, help centre 404, Wayback Machine offline); Height rests on a news item and a first-hand review. Agent Inbox (archived), CrewAI AMP and LangSmith Studio were read in docs and source only.

### human · 2026-10-14T13:47:04.024Z

Resolved: see the resolution comment; docs/research/web-prior-art.md on research/web-prior-art
