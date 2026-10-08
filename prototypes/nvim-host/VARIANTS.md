> **Superseded** by [WORKBENCH.md](WORKBENCH.md): the second round builds the design canvas the human approved instead of these four variants.

# Chat screen variants (ticket #15, PROTOTYPE)

A throwaway UI prototype for [#15 "Prototype: the chat screen with topics"](https://github.com/Kealman/cland-v0/issues/15). It is built on the engine prototype of [#11](https://github.com/Kealman/cland-v0/issues/11): Neovim 0.12.5 as the host, ADR 0005. Never merge it.

**The question:** what should the main chat screen look like in the terminal? Where do the topic list, the thread, the composer, the sessions and the "needs you" signal go, and how should asks look?

Four layouts of the main screen are switchable at runtime. All four use the same fake, in-memory state.

The `screens/` folder has a preview of each layout: [A](screens/A-slack.png), [B](screens/B-inbox-first.png), [C](screens/C-session-centric.png) and [D](screens/D-tabs.png). Each is a render of a tmux capture of the real TUI at 200×50; D shows the ask float.

## Run

From the repo root:

```sh
git fetch origin prototype/chat-screen
git checkout prototype/chat-screen
prototypes/nvim-host/run.sh
```

To keep your current checkout, use a worktree instead of the checkout: `git worktree add ../cland-chat-screen prototype/chat-screen`, then `../cland-chat-screen/prototypes/nvim-host/run.sh`.

- **First run.** `run.sh` downloads the official Neovim 0.12.5 macOS arm64 build into `prototypes/nvim-host/.nvim/` (gitignored). It checks the download against the release digest. Later runs reuse it.
- **First variant.** `CLAND_VARIANT=inbox prototypes/nvim-host/run.sh` starts on a given variant: `slack`, `inbox`, `session` or `tabs`. The default is `slack`.
- **Terminal size.** The layouts were drawn at 200×50 and work down to about 160×45. Colours assume a dark terminal.
- **Nothing is real.** There is no hub and no harness. A session terminal prints a canned harness screen, then runs your `$SHELL` without rc files. Quitting Neovim forgets everything.

## Switch

- **Cycle.** `<Space>v` goes to the next variant and `<Space>V` to the previous one. `<C-\>v` does the same from Insert or Terminal mode.
- **Jump.** `:ClandVariant slack|inbox|session|tabs` (or `A` to `D`).
- **The pill.** The pink pill at the bottom centre names the current variant. It is prototype chrome, not part of any design.
- **State.** Every switch echoes a one-line summary of the state. `:ClandState` shows the full fake state; `:ClandState json` shows the raw table.
- **Keys.** `<Space>?` lists the keys of the current variant.

## Variants

| | Variant | Layout | Optimises for |
|---|---|---|---|
| A | `slack` | Topics on the left, grouped as needs you / open / closed, with unread badges. The thread and a multi-line composer in the centre. A sessions board on the right: name, role, harness, model, state and current item. A session's terminal replaces the thread on demand. | Everything at a glance: no hidden state. It costs about 80 columns of side panels. |
| B | `inbox-first` | A "needs you" queue across topics on top, one line each: open asks with their options and keys, approvals, topics waiting for you, a vacant Coordinator. Unread topics follow as a weaker section. The selected item's thread and the composer are below. The topic list exists only behind `<Space>t`. | The human's main loop: unblock the agents first, then read. There is no ambient view of topics or sessions. |
| C | `session-centric` | The active session's terminal fills the screen, with a narrow, compact thread strip on the right. The bottom bar shows the delivery stage of your last message (queued / delivered / injected), the active session's state and a needs-you count. Topics and sessions are reachable through pickers only. Picking a session moves the strip to its item's topic. | Working inside one harness while the chat stays in a corner. |
| D | `tabs` | One Neovim tab per topic. The tabline shows the status glyph, the title and the unread count. Inside each tab are a full-width thread and a composer. A persistent status bar shows every session's state and the Coordinator's state. An open ask pops up as a float with numbered options when you enter its tab. | One conversation at a time, with Neovim-native navigation: `gt` / `gT` and mouse clicks on tabs. |

## The fake data (the same in every variant)

- **Topics.**
  - **General** (open, 2 unread).
  - **Agents** (read-only, 5 unread). It holds session-start, handover, role-assigned, role-change (qa-1: Implementer → QA) and claim events, plus agent-to-agent messages.
  - **T-12** "UI socket replay after a hub restart" (waiting for you). It has an open ask with 3 options plus a free answer, and `A-7: diagram` shared by the Coordinator.
  - **T-15** "OpenCode waiting heuristic" (waiting for agent). The prompt artifact `A-9` is attached. Your last message is *delivered* but not yet *injected*, because the Coordinator is busy.
  - **T-21** "Glossary entries for artifacts" (closed).
  - An unbound topic created by the Coordinator, "Spoke reconnect: flaky test" (open, 1 unread).
- **Sessions.**
  - `coord`: Coordinator, Claude Code / fable, busy.
  - `impl-1`: Implementer, OpenCode / free model, idle.
  - `review-1`: Reviewer, Codex / gpt-6.1-sol, waiting for approval.
  - `qa-1`: QA, Codex / gpt-6-astra, idle.
- **Messages.** Each has the sender's name, a role badge (`C` `I` `R` `Q`, `you`) and a time. Messages from you and between agents also show their delivery stage: `… queued`, `✓ delivered`, `✓✓ injected`.

## Things to try in each variant

1. **Send a message** from the composer. Enter sends; Shift+Enter (or Alt+Enter) adds a line. The stage goes queued → delivered → injected, and a canned reply arrives after one second. `@impl-1` or `@reviewer` in the text addresses someone other than the Coordinator.
2. **Answer the ask** in T-12: `1` to `3`, or `4` for your own words, which then go through the composer. `<Space>a` jumps to the open ask from anywhere.
3. **Open an artifact:** Enter or `gf` on `A-7` or `A-9`.
4. **Fire an event elsewhere:** `<Space>x`, or `:ClandSim reply|ask|approval|vacant`. Watch where each layout tells you about it: a new ask in a new topic, an approval request, the Coordinator going away (its messages then stay *queued*), or a reply in a background topic.
5. **Read the Agents topic.** `r` on an agent's message replies to its sender.
6. **Open a session terminal:** from the board (A), the queue (B), the sessions picker `<Space>s` (all variants) or as a tab (D). `y` on an approval line pretends you approved it in the harness's own TUI.

## Questions for you

1. **Daily use.** Which layout would you use every day? Or which parts of which: "the queue from B over the columns of A" is a fine answer.
2. **The "needs you" signal.** Where must it live? The options here: a pinned group in the topic list (A), a dedicated queue (B), a counter in a bar (C, D), a status glyph in the tabline (D), or a float that interrupts you (D). Should it ever interrupt?
3. **Sessions.** Do they deserve a permanent column (A), a status bar (D), the whole screen (C), or only a picker (B)? Where should a session's terminal open: in place of the thread, as the main surface, or as a tab?
4. **Asks.** Inline options in the thread (A–C), one line in a queue with direct keys (B), or a float with numbered options (D)? How should the free answer work?
5. **What is missing?** Some candidates:
   - Stage marks on every message, only on the last one, or only when a message is stuck?
   - Unread counts next to the status glyphs: useful or noise?
   - In C, should the composer address the session on screen instead of the Coordinator?
   - Search, creating or renaming or closing topics, a topic's artifact list, the "no reply yet" hint (shown at the bottom of each thread here).

## Known gaps (on purpose)

- **Not implemented.** No Markdown rendering beyond highlights, no search, no topic create / rename / close, no approval relay, no persistence.
- **Approvals.** Approvals stay in the harness TUI in v0. The stand-in terminal only prints one.
- **Simulation.** The stage timings and the replies are canned.
- **Layout.** The layouts are not responsive below about 160 columns.

## Files

- **This prototype.**
  - `init.lua`.
  - `lua/cland_proto/`:
    - `state.lua` and `data.lua`: the fake state.
    - `chat.lua`: threads, composers, sending.
    - `sessions.lua`: the fake sessions and their stand-in terminals.
    - `ask.lua`, `artifacts.lua`, `picker.lua`.
    - `switcher.lua`: variants and the pill.
    - `app.lua`: keys, commands, statusline.
    - `variants/{slack,inbox,session,tabs}.lua`: one file per layout.
  - `bin/fake-harness`: the canned session screens.
  - `screens/`: the preview renders.
- **Reused from #11.** `run.sh` (unchanged, with the same download cache) and `probe.lua`, whose RPC helpers are adapted (`CP.state()`, `CP.layout()`).
- **Left as they were in #11.** `checks/`, `evidence/`, `CHECKLIST.md`, `tmux-sessions.conf` and the other stand-ins in `bin/`. They describe the engine prototype's layout and keys, which this branch replaced.
