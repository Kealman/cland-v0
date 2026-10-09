# nvim

The Neovim side of cland: the standalone start and the Lua UI (spec `docs/spec/v0.md`, sections 4.1 and 5; ADR 0005): the workbench shell (#25) around the topic threads of #23. The session launcher and the sessions panel are #28; the items panel, the item view and the board are #36. The Agents log is #34, the inbox and the ask cards #33. Later tickets fill what is a placeholder today: the picker's artifacts.

## Starting it

```sh
cland                                   # on a terminal, anywhere inside a project: the same as `cland open`
cland open [dir] [nvim args…]
nvim/bin/cland-nvim [project-dir] [nvim args…]
```

- **`cland` / `cland open`** runs `cland hub start` (nothing happens when the hub runs already), then `nvim/bin/cland-nvim` on the project's root, and exits with Neovim's status (`hub/src/cli/open.ts`).
- **The project** is the given directory, else the current one. The launcher and the client walk up to the nearest ancestor holding `.git` or `.cland/`, as the hub does, so both work from any directory inside the project.
- **The hub** is found through `.cland/hub.json`. When no hub runs, or three connects in a row fail on the socket a stale `hub.json` names (a hub killed, a reboot), the client runs `cland hub start` once and connects when it answers. With `CLAND_HUB_TRANSPORT=stdio` the client spawns `cland hub serve --stdio` as its child instead and speaks the frames over its stdin and stdout. Quitting closes the child's stdin, which stops that hub.
- **The `cland` CLI** is run as `node hub/bin/cland.ts` from this repository; `CLAND_NODE` names another `node`, and `CLAND_COMMAND` (a JSON array) replaces the whole command (the tests' stub hub).

The launcher runs `NVIM_APPNAME=cland nvim --clean -u nvim/init.lua`, in that order. `NVIM_APPNAME` renames every `stdpath()`; `--clean` then `-u` skips the user's init, `plugin/` and `pack/` directories and sources only cland's `init.lua`. `:scriptnames` lists the bundled runtime and `nvim/init.lua`, nothing else.

## The shell

```
 cland <project> │ <centre view>        ● coord Coordinator · Claude Code · opus · busy   ✓ needs you 0   sessions 2
 ITEMS ␣i    │ centre view                        │ TOPICS (dock) ␣T
             │ thread · session · item · board ·  ├──────────────────
             │ Agents log · inbox full width (␣N) │ INBOX ␣n
             ├────────────────────────────────────┤ or SESSIONS ␣s
             │ composer (threads only)            │ or TOPICS ␣t
 MODE  <the centre view's context> │ hub: connected │ sessions: 1 busy · 0 waiting · 1 idle      key hints
```

- **The top bar** is the tabline: the project, the centre view's title, the Coordinator chip (the live session holding the role and its state; a red "no coordinator" when none). Sessions show as `name [Role]` everywhere (the panel, the picker, the session view's title and header, a thread message's header, an ask's asker in the inbox, a verdict's `by`), from the hub's `label` or the role's label, never the role's key. The hub's word wins: `coordinator` in `hub.status`, and the `role.vacant` and `role.filled` events (#29), which change the chip at once, the "needs you" count (the hub's `needsYou`: open asks, approvals and topics waiting without an ask) and the live sessions with the waiting and down counts. The chips are clickable.
- **The status line** (global) always starts with the centre view's context, then the hub's state (`connected`, `reconnecting`, `starting`, …), the sessions by state, the active preset and the latest notice. cland's notices go there, never to the message area: `vim.notify` is replaced.
- **The centre** shows one view at a time: a topic thread with its composer, a session terminal, the item view, the board, the Agents log, or the inbox full width. `␣␣` returns to the previous one.
- **The Agents log** (#34) is how Agents is read: `␣L`, `:Cland view log`, or Agents from the topics panel or the picker (never a thread with a composer: Agents is read-only). One row per entry, oldest first: the local time, then `sender [Role] → addressee [Role]` and the text for a message (further lines indented below it), or a kind glyph and the text for a lifecycle notice: `▶` session start, `■` stop, `✖` death, `◆` role assigned, `◇` revoked, `⇄` handover, `⚑` claim, `⚐` release, `⊘` mute (red), `⊙` unmute, `⛔` a refused tool call. It loads `topic.history` on every connect and adds a row on each `message` event for `agents`. `r` on a message opens a composer under the log, titled `↩ reply to <sender [Role]>`: what is sent there goes to Agents with `replyTo`, which the hub resolves to that sender; once the hub accepts it the composer closes. `r` on a notice says it has no sender to answer.
  - **Filters** (T-56): `f` asks for an item id or session name, with `Tab` completion from both. The header shows `AGENTS · T-12` or `AGENTS · impl-12`. It fetches the latest 200 matches from the hub's whole retained record, including older entries outside the unfiltered window, and admits only matching live entries. Item filters match notice details naming the item or its bound topic; session filters match the sender, addressees or session-bearing notice facts (`session`, `from`, `to`, `by`, `pair`), excluding metadata such as the harness or mute rule. Names match exactly, and message text is not searched. `F` clears the filter and reloads the unfiltered history. `L` in an item view or on a sessions-panel row opens Agents filtered to that item or session. Changing the filter closes any reply composer.

- **Panels.** Items on the left (below). On the right one of: the inbox (below), sessions (name, role, harness, model, the state with `(heuristic)` when the adapter's capability table says so, the claimed item) and topics (below). Topics can also dock above the right panel. Opening the workbench shows General with the sessions panel.
- **Topics** (spec 4.5, #32). The panel groups NEEDS YOU (topics waiting for the human, pinned on top, an amber `●`), OPEN (`●` open, `◐` waiting for an agent) and CLOSED (`○`), in the hub's order (activity) within each; Agents is the `≡` log. A row shows the bound item (`T-12`) unless the title says it, a red `▲` while the topic carries a warning (`no coordinator`), and the unread badge (amber when the topic needs the human); the header counts topics and unread messages. A thread in view is read (`topic.read`) and a `message` event raises the badge of a topic out of view. The thread header shows the binding, the warning and the status (`waiting for you`, `topic waiting for agent`, …); the status line names the binding and the status too. The "needs you" chip is the hub's count (asks, approvals and topics waiting for the human, #33).
- **The inbox** (spec 5, #33) in the right panel (`␣n`) or full width (`␣N`): ASKS (each with its topic or bound item, the asker and the time, the question, the numbered options, the free-answer hint), APPROVALS (sessions waiting for approval), WAITING FOR YOU (topics waiting for the human without an ask) and NOTIFICATIONS (`✓`/`✗` verdicts, `↔` role changes, `!` deaths, `○` long idles), in that order; the header and the top bar count what needs you. It comes from `inbox.list` and is replaced by every `inbox` event, so rows come and go without a prompt.
- **Asks in the thread** show as a card under the asker's header (`ask · ▲ waiting for you` on the right): the question, the numbered options and `1-9 answers · free answer: i`. Answered, it marks the chosen option (`✓ 2 …`) and the answer message follows right under it; a withdrawn or cancelled ask says so. `ask` events change the card in place. After every reconnect, once the history is merged, the thread asks `inbox.list` for the open asks: a card it cached as open that is not among them (closed while the client was away, its message older than the latest 200 the history returns) shows `closed` and takes no answer.
- **Sessions** (#28). The panel shows one row per session: the name with its role (`rev-1 [Reviewer]`, the hub's `label`), the claimed item (or `free`), then the harness, the model, the state with `(heuristic)` when the adapter's capability table says so, and the usage where the adapter reports it (`$1.80` or `12.3k tok`). A launched session whose process died shows `✗ … unknown · died` (the hub's log has `harness-exited`), one stopped `× … unknown · stopped`. The last launch or stop, or what the hub refused, is a notice atop the panel. The panel follows `session.state` and `session.role` events and the periodic refresh.
- **The launcher** (`␣l`, or `l` in the sessions panel, or `:Cland launch [name]`) is a floating form: name, role, harness (`claude-code` \| `codex` \| `opencode`), model, directory (the project root) and effort, one line each. Typing a role (or `C-n`/`C-p` on the role and harness lines) fills the harness, model and effort from the role's launch defaults (`role.list`, from `.cland/roles.toml`); a harness other than the role's clears the model and effort meant for the role's. `Tab`/`S-Tab` move between fields, `Enter` sends `session.launch` (empty fields are left to the hub), `Esc` cancels. What the hub refuses (a name in use, the Coordinator held, an unknown harness) shows under the fields and atop the panel; the form stays open to fix it. With no role the first `Enter` warns that the hub will refuse the session's spoke until one is assigned, and the second launches.
- **Session terminals** only attach: the terminal runs the command `session.attach` returns (`claude attach <id>`), never the harness. Closing the terminal or quitting ends the attach client, not the session. An attach client that ended (`TermClose`) leaves its finished terminal to be read until it is hidden; the session is no longer attached, and `↵` or `C-v` runs the attach command again. A session terminal is never below three rows.
- **`:restart`** writes the layout, the attached sessions and the sessions in `C-v` splits to `stdpath('state')/restart/<project hash>.json` (ExitPre, `v:exitreason` "restart"). The new instance reads them back (`v:startreason` "restart"), builds the shell again over the Vim session `:restart` sources (SessionLoadPost; `'sessionoptions'` is only `curdir`, so no terminal is re-run from it), and runs the attach commands again: a session in a `C-v` split comes back in a split beside the centre, the others in the centre or hidden as they were.
- **Items** (spec 5, #36), from `task.list` and the `task` event; nothing is stored, every status is derived (`lua/cland/items.lua`).
  - **The panel** (`␣i`) is a tree: each item under its `parent`, orphans at the root, ordered by id. An epic or a map shows its children's progress (`1/3`). A row: the status glyph, the id, the title, then right-aligned the claiming session (else the assignee) and the ask badge (amber, the number of open asks in the item's bound topic, from the inbox, #33). The glyphs: `●` closed (green), `◆` needs you (amber: an open ask, or the latest review or QA verdict not clear), `◐` claimed, `◑` assigned, `◌` an open blocker, `○` open. The header names the filter and its count.
  - **Filters**, `1`–`5` or `f` / `F` to cycle: **all** (the tree); **in work** (open, and claimed or assigned); **needs you**; **done** (closed); **map**, the wayfinder grouping of each map item's children under headers, ordered by id: *decided* (closed), *frontier* (open, no assignee, no claim, no open blocker), *in work by sub-agents* (claimed or assigned), *blocked* (an open blocker). A blocker the tracker does not know counts as open.
  - **The item view** (`↵` on a row or a card, `gi`, the picker, `:Cland view item T-<n>`): a title line with the id and the state; the title, the file and the body as Markdown text; the verdicts, the latest of each kind on top (`✗ review not clear · by rev-1 [Reviewer] · run r-2 · <time>`), the earlier ones below; the comments. The fields column sits beside them when the centre is at least 90 columns wide, above them otherwise: state, kind and labels, parent, assignee, claim, topic (`no topic yet` when unbound), branch, blocked by (each blocker's state), blocks (the items whose `blocked_by` names it), cost (from the claiming session's reported usage, `—` when unknown), file. The body and comments come from `task.view`, fetched again whenever the item changes, on every `task` event for it and after every reconnect (an edit while away may keep `updated`); a failed fetch is never current, and what was shown stays with a `not current` line. An indentation keeps at most half the width. `e` opens the item's file in a normal buffer in the centre (`:edit`); the hub's watcher re-indexes it on `:w`.
  - **The board** (`␣b`): six columns of cards, one card per item that is not an epic or a map: the id with the ask mark, the title, the claiming session (or `for <assignee>`), an open blocker, the verdict marks (`✓ review`, `✗ qa`). `↵` or `gi` opens the card's item.
  - **The board's rule.** A card's column is derived from the item's state, claim, assignee, labels and latest verdicts, never stored; the first match wins: closed → **done**; the latest review verdict `clear`, or the label `qa` → **qa**; the latest review verdict `not clear`, or the label `review` → **review**; claimed → **in progress**; assigned → **planned**; else → **backlog** (open, no assignee, no claim, no verdict).
- **Hub data** comes from `topic.list`, `topic.history`, `session.list`, `hub.status` (sessions nobody launched), `role.list` (the launch defaults), `task.list` and `inbox.list` on every connect and every 5 s (`CLAND_REFRESH_MS`), and from the `message`, `delivery`, `topic`, `ask`, `inbox`, `session.state`, `session.role`, `role.vacant`, `role.filled` and `task` events. While the items are on screen (the panel, the board, an item view) `task.list` is asked again every second besides the events, so the tree follows the files within a second; an item view asks `task.view` for its body and comments. Every change renders once, in the next main-loop tick (`state.changed()`), whatever the burst.

### Keys

Space is the leader (`␣`); `␣?` shows the keys in Neovim.

| Key | Where | What it does |
| --- | --- | --- |
| `␣i` | Normal mode, anywhere | Toggle the items panel (left). |
| `␣n` `␣s` `␣t` | anywhere | Inbox, sessions or topics in the right panel. Pressing the active key hides the panel. |
| `␣T` | anywhere | Topics docked above the right panel, which shows the inbox (the Watch layout). Again: undock. |
| `␣N` `␣b` `␣L` | anywhere | The inbox full width, the board, the Agents log in the centre. Again: back. |
| `␣a` | anywhere | The picker on artifacts (spec 5), which slice 2 brings: for now the status line says `artifacts: slice 2`. |
| `f` `F` | Agents log | Filter by an item id or session name (Tab completes both); clear the filter. |
| `L` | item view / sessions panel | Open Agents filtered to this item / the row’s session. |
| `r` | Agents log | Reply to the sender of the message under the cursor: a composer opens under the log (Enter sends, `q` in Normal mode cancels). |
| `␣g` `␣c` | anywhere | General; the composer of the current thread, in Insert mode. |
| `␣r` | anywhere | Resolve the topic in view (or under the cursor in the topics panel): its wait is cleared to open. |
| `1`–`5` `f` `F` | items panel | The filters all, in work, needs you, done, map; `f` and `F` cycle them. |
| `e` | item view | Open the item's file in a normal buffer; `:w` saves it and the hub re-indexes it. |
| `n` `c` `r` | topics panel | A new topic (asks for the title, then opens it); close the topic under the cursor; resolve it. |
| `1`–`9` | an ask in the inbox or its card in the thread | Answer with that option (`topic.answer`); the row leaves and the count drops. Elsewhere in a thread a digit is a count, as always. The maps are local to the thread and inbox buffers, so the items panel's `1`–`5` filters never meet them. |
| `i` | an ask in the inbox or its card in the thread | A free answer: the topic opens with its composer armed (`answer to: <question>` in its header), and Enter sends the text as the answer. Elsewhere in a thread `i` goes to the composer. |
| `↵` | inbox | An ask or a waiting topic opens the topic; an approval attaches the session in the centre (Terminal mode), where the harness asks; a notification opens its item, else its session. |
| `d` `D` | inbox | Dismiss the notification under the cursor; dismiss them all. Asks and approvals are not dismissed: `d` on them only says so in the status line. |
| `␣␣` | anywhere | The previous centre view; twice returns, like `CTRL-^`. |
| `gi` `gt` `gs` | any panel or view | The item, topic or session of the reference under the cursor (`T-12`, a topic's title, a session's name), else of the row (a board card too), else of the centre view. A session's item is the one it claims, an item's session the one claiming it, a topic's item the one it is bound to (and an item's topic its bound topic), a topic's session its Coordinator. `gs` shows the session in Normal mode. |
| `␣p` | anywhere | The picker over items, topics and sessions: type to filter (fuzzy; items by id, title and claiming session; topics by title, needs you first, each with its binding, warning, status and unread count), `Tab` and `S-Tab` switch the kind, `↵` opens (an item its view, a session attaches in Terminal mode), `Esc` closes. It opens on the kind used last. Sessions waiting for the human come first; the filter matches the name, the role and the harness. |
| `↵` | panels, board | Open the row in the centre: a session attaches in Terminal mode, a topic opens its thread, an item (or a board card) its view. |
| `␣l` | anywhere | The session launcher (above). |
| `l` `C-v` `x` `c` | sessions panel | Launch a session; attach the row's session in a vertical split beside the centre (Terminal mode; the centre view stays); stop it, after a line in the panel asks (`y` stops through `session.stop`, `n` or `Esc` keeps it); its adapter's capability table in a float (each state signal and optional capability as `reliable`, `heuristic` or `none`; `q` closes). |
| `Enter` `Shift+Enter` | composer | Send; newline (`Alt+Enter` too). A message the hub refuses comes back, ahead of anything typed since. `@reviewer`, `@qa`, … or `@<session>` in the text addresses them instead of the Coordinator. |
| `C-\ C-n` | session terminal | Leave Terminal mode; until then every key goes to the session. |

### Commands

| Command | What it does |
| --- | --- |
| `:Cland preset charting`, `watch`, `steady` | Examples of the three stages, never modes. charting: items beside General, the right panel hidden. watch: items, General, topics docked above the inbox. steady: the board and the inbox. Everything still toggles afterwards. |
| `:Cland view thread <topic>`, `session <name>`, `item <id>`, `board`, `log`, `inbox` | A centre view. |
| `:Cland panel items`, `inbox`, `sessions`, `topics`, `dock` | The panel keys as a command. |
| `:Cland launch [name]` | The session launcher, the name filled in. |
| `:Cland topic new <title>`, `close [id]`, `resolve [id]` | Create a topic and open it; close or resolve the topic in view (or the one named). |
| `:Cland refresh`, `:Cland help` | Ask the hub again; the keys. |

## The pinned Neovim

| File | What it is |
| --- | --- |
| `NVIM_VERSION` | The release tag cland runs on, the one place it is set (`v0.12.5`). |
| `NVIM_SHA256SUMS` | The sha256 of each release tarball cland accepts (macOS and Linux, arm64 and x86_64), copied from the release's asset digests. |
| `bin/nvim-path.ts` | Prints the binary's path. It downloads the official tarball for this machine into `.cache/nvim/<tag>/` at the repository root (ignored by git) when missing, checks it against the pinned digest, unpacks it, and clears the macOS quarantine attributes. Two resolvers share the download through `.download.lock` in the cache: created whole, naming its pid; one whose pid is dead, or that names no pid and is older than 5 s, is stale and broken under a guard (`.download.lock.break`) only if it still reads as found, so concurrent breakers never remove the lock one of them then took. `CLAND_NVIM` names a binary to use instead. |
| `bin/cland-nvim` | The launcher above. |

## The ADR 0005 mitigations

In `init.lua`, and in the shell:

- **Shift+Enter in terminals.** Terminal mode maps `<S-CR>` to the kitty CSI-u sequence `ESC[13;2u`, so a harness sees Shift+Enter.
- **Pastes.** `'termpastefilter'` is `BS,ESC,DEL`, so pasted TABs survive.
- **Scrollback.** `'scrollback'` is 10,000, set before any terminal exists.
- **No hit-enter prompt.** `'cmdheight'` is 1, `'shortmess'` gains `aIcCFsWS`, and cland's notices are one line in the status line or its own buffers, never in the message area (`vim.notify` is replaced).
- **UI updates through `vim.schedule`.** Every hub frame is handled in the main loop, never in a libuv callback, and lands while the human types: Insert mode in the composer is kept. A handler, a request's callback or a refresh timer that fails says so in one line on the status line (`cland: …`), never as an error in the message area; a hub text over several lines (an ask's question or options, a note) is split into buffer lines or flattened, never put in one line.
- **Sessions owned outside Neovim.** Session terminals only attach, `:restart` re-attaches them, and no session terminal is below three rows.

## Modules

| Path | What it is |
| --- | --- |
| `init.lua` | The entry point: the runtime path, the mitigations, the options the shell needs, then `require('cland').start()` on `VimEnter`. |
| `lua/cland/init.lua` | Finds the project root, creates the hub client, loads the hub's data on every connect and every few seconds, applies events to the state, wires the keys, `:Cland` and the autocommands, and restores a restart snapshot. |
| `lua/cland/hub.lua` | The hub client: the Unix socket through `hub.json` (reconnecting with backoff, re-reading the file each time, `cland hub start` when none answers) or a stdio child; JSON lines; requests by id; `message`, `delivery`, `session.state`, `session.role`, `role.vacant`, `role.filled`, `state` and `connected` handlers. It subscribes on every connect. |
| `lua/cland/state.lua` | The state: topics, sessions (launched and connected), capability tables, items, the centre view and its history, the open panels; `changed()` renders once in the next tick. |
| `lua/cland/layout.lua` | The windows: panels as top-level splits, the centre and its composer, the view switch and `␣␣`, the presets, the rebuild after a restart. |
| `lua/cland/bars.lua` | The top bar (tabline), the status line, the panel headers (winbars), with the bar-background twins of the highlight groups. |
| `lua/cland/panels.lua` | The items, sessions, topics and inbox panels: drawn from the state, each row knowing what it shows; `↵` opens it. |
| `lua/cland/views.lua` | One topic view per topic, the topic actions (create, close, resolve, read), the item view and the board through their modules, the Agents log through `agents_log.lua`, and the inbox full width through `inbox.lua`. |
| `lua/cland/items.lua` | The items' derived statuses (glyphs, needs you, in work, the map groups, the board columns, verdict marks, open blockers, what an item blocks), the `task` event, and the items panel (tree, filters, keys). |
| `lua/cland/item_view.lua` | The item view: the fields column, the body, the verdicts and comments from `task.view`; `e` edits the file. |
| `lua/cland/board.lua` | The board: six derived columns of cards; `↵` opens the card under the cursor. |
| `lua/cland/sessions.lua` | Session terminals: the attach command from `session.attach`, one request in flight per session, re-attaching after a restart. The panel's stop (`session.stop` after the confirmation line) and the capability table float. |
| `lua/cland/launcher.lua` | The session launcher form: the fields, the role's launch defaults, `session.launch` and its refusals. |
| `lua/cland/picker.lua` | The floating picker over items, topics and sessions. |
| `lua/cland/agents_log.lua` | The Agents log: the rows (time, `sender [Role] → addressee`, kind glyphs), kept current by `message` events, item/session filters with `f`/`F`/`L`, and `r`'s reply composer. |
| `lua/cland/inbox.lua` | The inbox: its sections (asks, approvals, waiting, notifications) in the right panel and full width, `1`–`9`, `i`, `↵`, `d` and `D` on its rows. |
| `lua/cland/ask_card.lua` | An ask as a card (the question, the numbered options, its state) and the `1`–`9` and `i` keys on a buffer's ask rows, shared by the thread and the inbox. |
| `lua/cland/motions.lua` | `gi`, `gt`, `gs`: the reference under the cursor, the row, or the view, then the dispatch. |
| `lua/cland/restart.lua` | The restart snapshot file. |
| `lua/cland/topic_view.lua` | One topic's thread and composer, wired to the client (history merged on every connect). |
| `lua/cland/thread.lua` | The thread buffer: `sender [Role]` (the role's label) and local time on each message's header. The human's own messages show their delivery stage right-aligned (`⌁ queued`, `✓ delivered`, `✓✓ injected`), changed in place on `delivery` events. A one-line notice under the messages tells about the hub connection or a failed send. A cursor away from the tail stays where it is. |
| `lua/cland/composer.lua` | The composer, a prompt buffer. Enter sends, Shift+Enter (or Alt+Enter) inserts a newline. The text is kept until the hub accepts it and put back on a refusal. |
| `lua/cland/hl.lua` | The design's colours and glyphs: delivery stages, session states, item states. |

## Tests

```sh
npm run test:nvim          # from the repository root; `npm test` runs it after the hub's tests
```

Every test starts the real client headless as `nvim --clean -u nvim/init.lua --headless --listen <socket>`, under `NVIM_APPNAME=cland`, attaches a 160x45 UI over msgpack-RPC (`test/rpc.ts`), drives it with `nvim_input` and reads the screen back with `screenstring()` (`test/harness.ts`). When a test runs `:restart`, the harness follows the UI's `restart` event to the new server, as a terminal UI does.

- `test/client.test.ts` runs against a real hub (`cland hub start`) in a temporary project and connects real spokes over MCP: sending, delivery stages, Shift+Enter in the composer, the stdio transport, a clean configuration, autostart (also over a stale `hub.json`), following a hub restart.
- `test/items.test.ts` runs against a real hub with item files written by hand (and a claim through `cland task claim`): the tree, the map grouping, the item view and the board; a hand-written file shows in the panel within a second; `e` opens the file and a save re-indexes it.
- `test/shell.test.ts` runs against `test/stub-hub.ts`, a stub hub on stdio with scripted topics, sessions (states, capability tables, attach commands) and items, which emits events on command through a control socket: the top bar, every panel key, the session view and `␣␣`, the picker, `gi`/`gt`/`gs`, the presets, the topics panel (groups, pinning, unread badges, the warning glyph, Enter, `n`/`c`/`r` and `:Cland topic`), the picker's topics kind, the thread header with the status and the binding, an event while typing, a burst of events without a hit-enter prompt (and four writes of 50 waves of every event kind, malformed ones among them, with Insert mode, the typed text and an empty message area kept), a coordinator `null` after a reconnect, an item view and an ask card made current again after a reconnect (also an ask older than the history the reconnect reads, closed through `inbox.list`), an attach client that ended attached again, a deeply indented list, multi-line asks, Shift+Enter and a tabbed paste reaching a session (`test/fakes/keylog.ts` logs the bytes its tty reads), refused sends, a real `:restart` re-attaching the session terminal and a `C-v` split, the sessions (#28): the launcher's frame with typed values and role defaults, refusals in the form and the panel, the roleless warning, `C-v`, `x` with its confirmation line and `session.stop`, `c`, `unknown` from an event and from a dead process, the picker's order and filters, and the items (#36) over a fixture set: the tree, each filter and the map grouping, the item view's fields column, verdicts and comments, the board's columns and a label moving a card, `gi`/`gt`/`gs` between items, topics and sessions both ways (a topic event binding an item followed), `task` events, and the picker's items kind, and the inbox and asks (#33): the sections in order with the top bar's count, `2` on an ask row, `i` arming the composer for a free answer, `d` and `D`, the ask card in the thread answered with `2`, the inbox full width.
- `test/sessions.test.ts` runs against a real hub with the three fake harnesses of `hub/test/fakes` first on the PATH: Claude Code, Codex and OpenCode sessions launched from the launcher, each in the panel with the model chosen and a live state, attached with Enter (each fake's attach client prints its own line in the terminal), a killed one `unknown · died` with `harness-exited` in the hub's log, and `x` `y` stopping one (`session-stopped`), and the Agents log (#34): rows with `sender [Role]`, kind glyphs, an event adding a row, `␣L`, `:Cland view log`, `r` preparing a reply with `replyTo`.
- `test/agents-filters.test.ts` runs headless Neovim against a real hub: item/session completion, history and live filters (including bound-topic notices and a metadata collision), clearing, and `L` from an item view or session row.
- `test/nvim-path.test.ts`: the resolver from a path with a space, `#` and `%`; a linked worktree using the main worktree's cache; two resolvers on an empty cache (one download); an empty lock taken over after the grace; two resolvers breaking the same dead holder's lock (one download, no lock removed from under its holder).

The binary comes from `CLAND_NVIM`, else the cache (a linked git worktree with none of its own uses the main worktree's, so a session working there with the network closed needs no download), else a download as above. When none of these works, for example offline with an empty cache, the client tests are skipped with the reason.
