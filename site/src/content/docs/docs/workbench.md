---
title: The workbench
description: The terminal workbench's layout, panels, palette and keys, the stage presets, and how to attach to a session's harness terminal.
sidebar:
  order: 5
---

The workbench is where you watch and steer the crew from a terminal. It runs in cland's own pinned Neovim with a clean configuration: no Neovim experience is needed, and your own Neovim setup is never loaded.

```sh
cland           # anywhere inside a project
cland open      # the same; also takes a directory
```

Both start the project's hub if it is not running, then open the workbench on the project's root. Quitting the workbench leaves the hub and the crew running.

:::tip
Prefer a browser? The [web workbench](/docs/web-and-phone/) shows the same state, live, in any browser and on your phone. Use both at once.
:::

## Layout

```
 cland my-project │ Explorer        ● Coordinator · Claude Code · busy   ✓ needs you 0   sessions 4
 ITEMS ␣i    │ centre view                          │ TOPICS (dock) ␣T
             │ explorer · thread · session terminal ├──────────────────
             │ board · graph · plan · events · log  │ INBOX ␣n
             │                                      │ or SESSIONS ␣s
             ├──────────────────────────────────────┤ or TOPICS ␣t
             │ composer (threads)                   │
 <context> │ hub: connected │ sessions: 1 busy · 0 waiting · 3 idle │ key hints
```

- **The top bar** shows the project, the centre view, the Coordinator and its state (a red "no coordinator" when nobody holds the role), the **needs you** count and the live sessions.
- **The centre** shows one view at a time. `␣␣` returns to the previous one.
- **The left panel** is the items panel.
- **The right panel** is the inbox, the sessions or the topics. Topics can also dock above it.
- **The status line** shows the view's context, the hub's state, session counts, the latest notice and key hints.

Colours carry meaning everywhere: amber for what needs you, teal for work in progress, green for done, red for a failure or a dead session. Each role has its own colour in threads: you blue, the Coordinator teal, Implementers violet, Reviewers pink, QA sky.

## Keys you need first

Space is the leader key, written `␣`. `␣?` lists every key in the workbench.

| Key | What it does |
| --- | --- |
| `␣p` | The palette: search everything and run any action. |
| `␣g` | General, your thread with the Coordinator. |
| `␣n` | The inbox. `␣N` opens it full width. |
| `␣s` | The sessions panel. |
| `␣e` | The explorer. |
| `␣␣` | Back to the previous centre view. |
| `C-h` `C-j` `C-k` `C-l` | Move focus left, down, up, right, in every mode, terminals included. |
| `1`–`9`, `i` | On an ask: pick an option, or type a free answer. |
| `Enter`, `Shift+Enter` | In the composer: send, or a new line. |

## The explorer

The explorer is the default centre view: the current release as an outline, its epics and their tasks, with folded roots for the categories, the unscheduled items and other releases. A card on the right follows the cursor: the item's summary, status, progress, latest verdict, relations, branch and latest verification result.

| Key | What it does |
| --- | --- |
| `j` `k` | Next or previous item. |
| `l` `h` | Unfold or step into a node; fold or go to the parent. |
| `Enter` | Focus the card. `h` returns to the tree. |
| `s` | Scope the tree to this node. `␣␣` goes back. |
| `D` | Hide or show done items. |
| `A` | Show closed releases and closed root items. |
| `m` | Message the Coordinator in General about this item, with its context attached. |
| `M` | Message the Coordinator in the item's own topic, creating it if needed. |
| `zb` | Unfold the agents' text of the item. |

The explorer changes nothing by hand. To reorder, re-parent or plan items, select them (`V` for a range) and press `m`: the Coordinator receives your text plus one line per item and acts through the tracker.

## Panels

### Items panel, `␣i`

A vertical board of the current release: sections **in progress**, **review**, **qa**, **ready**, **planned**, each with a count. Backlog is folded; done is hidden and counted. The first unblocked planned task carries a teal **next** mark. Each row shows the status glyph, id, title, claim or verdict mark and the verified/total criteria.

| Glyph | Meaning |
| --- | --- |
| `○` | planned or backlog |
| `◐` | in progress |
| `◉` amber | review or qa |
| `◉` green | ready |
| `●` | done |
| `◌` | blocked |
| `✗` | last verdict not clear |
| `?` | open ask |

`1`–`6` switch filters (board, in work, needs you, done, map, all). `e` and `E` change the release in scope. `K`, `J` and `T` move an item before or after its sibling, or to the top: that is how you set priority.

### Sessions panel, `␣s`

The **Accounts** block comes first, with each account's usage windows ([Accounts and limits](/docs/accounts/)), then the verification queue line, then the sessions grouped as **yours** (your Aides), **waiting**, **busy** and **idle**. Stopped sessions fold under `more (N)`. The selected row expands to its harness, model, account, state and usage, and to the command a pending approval waits on.

| Key | What it does |
| --- | --- |
| `Enter` | Attach the session's terminal in the centre. |
| `C-v` | Attach it in a split beside the centre. |
| `l` | Launch a session. |
| `a` | Launch an Aide (`␣A` from anywhere). |
| `x` | Stop the session, after a confirmation. |
| `r` | Resume a stopped session on its harness conversation. |
| `d` | Archive a stopped session. `A` shows the archive. |
| `c` | Show what the harness adapter reports reliably. |

### Inbox, `␣n`

Only what needs you, in four sections: asks and approvals, plan approvals, requests to you, messages to you. Each row shows how long it has waited.

| Key | What it does |
| --- | --- |
| `1`–`9` | Answer the selected ask with that option. |
| `i` | Give a free answer. |
| `Enter` | Open the ask's topic, attach the session waiting on a command approval, or open a plan. |
| `r` | Reply to a request or message. |
| `d` | Decline a request, or mark a message read. |
| `A` | Show what left the inbox in the last seven days, and why. |

With nothing waiting it says `✓ nothing needs you`. The line below the sections counts new events since your last look; `e` opens the events view.

### Topics, `␣t`

Topics grouped as **needs you**, **open** and **closed**, with unread badges. `n` creates a topic, `c` closes one, `r` resolves its wait. `␣T` docks topics above the inbox.

## Centre views

| Key | View |
| --- | --- |
| `␣e` | Explorer and card. |
| `␣g` | General. Any topic opens from the topics panel or the palette. |
| `␣b` | Board: one column per status. |
| `␣G` | Task graph by blocking edges (experimental). |
| `gp` | The plan of the epic under the cursor. `a` approves it when approval is yours. |
| `␣E` | Events view: everything that happened, newest first, with filters. |
| `␣L` | The Agents log: agent-to-agent traffic. |
| `␣R` | The rulebook. `a` adds a rule. |
| `␣N` | The inbox full width. |

From any panel or view, `gi`, `gt` and `gs` jump to the item, topic or session under the cursor: an item's claiming session, a session's item, an item's topic.

## The palette

`␣p` opens one floating search over everything: actions, items, sessions, artifacts and topics. Every action shows its key, so the palette is also how you learn the keys. Prefixes narrow it to one kind:

| Prefix | Searches |
| --- | --- |
| `>` | actions |
| `#` | items |
| `@` | sessions |
| `~` | artifacts (`␣a` opens the palette here) |
| `/` | topics |

`Enter` runs or opens, `C-v` opens in a split, `Tab` switches kind, `Esc` closes. Answering an open ask is one action per option.

## Writing to the crew

The composer sits under a thread. `Enter` sends, `Shift+Enter` (or `Alt+Enter`) adds a line. A message goes to the Coordinator unless you mention someone: `@reviewer`, `@qa` or a session name. `␣P` opens a full buffer for a long prompt.

## Attaching to a session's terminal

Every session runs its harness's own TUI. `Enter` on a session row attaches to it in the centre, `C-v` in a split. You see exactly what the harness shows and can type into it.

- `C-\` leaves terminal mode. `Esc` always goes to the harness.
- `C-h` `C-j` `C-k` `C-l` move focus out of the terminal.
- Closing the terminal ends only the attach, never the session.

Approvals a harness asks for in its own TUI are answered there. A session waiting on one shows in the inbox and the sessions panel with the command it waits on; `Enter` attaches to it.

From a plain shell, print the attach command and run it yourself:

```sh
cland session attach impl-42
```

## Presets

Three presets set up the screen for a stage of work. They are starting points, not modes: toggle anything afterwards.

| Command | Layout |
| --- | --- |
| `:Cland preset charting` | Items beside General, the right panel hidden. For planning with the Aide or the Coordinator. |
| `:Cland preset watch` | Items, General, topics docked above the inbox. For following a build. |
| `:Cland preset steady` | The board and the inbox. For a crew that runs on its own. |

Panel sizes, the chosen release and the explorer's folds are saved per machine in `.cland/ui.json`.

## Terminal notes

- Shift+Enter must reach the terminal as its own key. `cland doctor` warns when a Ghostty `keybind = shift+enter=text:\n` line turns it into `C-j`, and about a tty erase character of `^H`.
- The `C-h` `C-j` `C-k` `C-l` chords use the English layout. Normal-mode letters work in other layouts once you name them in `config.toml`:

  ```toml
  [keys]
  layouts = ["ru"]
  ```
