# nvim

The Neovim side of cland: the standalone start and the Lua UI (spec `docs/spec/v0.md`, sections 4.1 and 5; ADR 0005): the workbench shell (#25) around the topic threads of #23. Later tickets fill what is a placeholder today: the items panel's tree, the item view and the board (#36), the inbox (#33), the Agents log (#34), the session launcher (#28), the picker's items and artifacts.

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

- **The top bar** is the tabline: the project, the centre view's title, the Coordinator chip (the live session holding the role and its state; a red "no coordinator" when none). The hub's word wins: `coordinator` in `hub.status`, and the `role.vacant` and `role.filled` events (#29), which change the chip at once, the "needs you" count (0 until the inbox, #33) and the live sessions with the waiting and down counts. The chips are clickable.
- **The status line** (global) always starts with the centre view's context, then the hub's state (`connected`, `reconnecting`, `starting`, …), the sessions by state, the active preset and the latest notice. cland's notices go there, never to the message area: `vim.notify` is replaced.
- **The centre** shows one view at a time: a topic thread with its composer, a session terminal, or a placeholder for the item view, the board, the Agents log and the inbox full width. `␣␣` returns to the previous one.
- **Panels.** Items on the left (from `task.list`: a state glyph, the id, the title, the claim). On the right one of: the inbox (a placeholder), sessions (name, role, harness, model, the state with `(heuristic)` when the adapter's capability table says so, the claimed item) and topics (`topic.list`). Topics can also dock above the right panel. Opening the workbench shows General with the sessions panel.
- **Session terminals** only attach: the terminal runs the command `session.attach` returns (`claude attach <id>`), never the harness. Closing the terminal or quitting ends the attach client, not the session. A session terminal is never below three rows.
- **`:restart`** writes the layout and the attached sessions to `stdpath('state')/restart/<project hash>.json` (ExitPre, `v:exitreason` "restart"). The new instance reads them back (`v:startreason` "restart"), builds the shell again over the Vim session `:restart` sources (SessionLoadPost; `'sessionoptions'` is only `curdir`, so no terminal is re-run from it), and runs the attach commands again.
- **Hub data** comes from `topic.list`, `topic.history`, `session.list`, `hub.status` (sessions nobody launched) and `task.list` on every connect and every 5 s (`CLAND_REFRESH_MS`), and from the `message`, `delivery`, `session.state`, `session.role`, `role.vacant` and `role.filled` events. Every change renders once, in the next main-loop tick (`state.changed()`), whatever the burst.

### Keys

Space is the leader (`␣`); `␣?` shows the keys in Neovim.

| Key | Where | What it does |
| --- | --- | --- |
| `␣i` | Normal mode, anywhere | Toggle the items panel (left). |
| `␣n` `␣s` `␣t` | anywhere | Inbox, sessions or topics in the right panel. Pressing the active key hides the panel. |
| `␣T` | anywhere | Topics docked above the right panel, which shows the inbox (the Watch layout). Again: undock. |
| `␣N` `␣b` | anywhere | The inbox full width, the board in the centre. Again: back. |
| `␣g` `␣c` | anywhere | General; the composer of the current thread, in Insert mode. |
| `␣␣` | anywhere | The previous centre view; twice returns, like `CTRL-^`. |
| `gi` `gt` `gs` | any panel or view | The item, topic or session of the reference under the cursor (`T-12`, a topic's title, a session's name), else of the row, else of the centre view. A session's item is the one it claims, an item's session the one claiming it, a topic's session its Coordinator. `gs` shows the session in Normal mode. |
| `␣p` | anywhere | The picker over topics and sessions: type to filter (fuzzy), `Tab` and `S-Tab` switch the kind, `↵` opens (a session attaches in Terminal mode), `Esc` closes. |
| `↵` | panels | Open the row in the centre: a session attaches in Terminal mode, a topic opens its thread, an item its view. |
| `Enter` `Shift+Enter` | composer | Send; newline (`Alt+Enter` too). A message the hub refuses comes back, ahead of anything typed since. |
| `C-\ C-n` | session terminal | Leave Terminal mode; until then every key goes to the session. |

### Commands

| Command | What it does |
| --- | --- |
| `:Cland preset charting`, `watch`, `steady` | Examples of the three stages, never modes. charting: items beside General, the right panel hidden. watch: items, General, topics docked above the inbox. steady: the board and the inbox. Everything still toggles afterwards. |
| `:Cland view thread <topic>`, `session <name>`, `item <id>`, `board`, `log`, `inbox` | A centre view. |
| `:Cland panel items`, `inbox`, `sessions`, `topics`, `dock` | The panel keys as a command. |
| `:Cland refresh`, `:Cland help` | Ask the hub again; the keys. |

## The pinned Neovim

| File | What it is |
| --- | --- |
| `NVIM_VERSION` | The release tag cland runs on, the one place it is set (`v0.12.5`). |
| `NVIM_SHA256SUMS` | The sha256 of each release tarball cland accepts (macOS and Linux, arm64 and x86_64), copied from the release's asset digests. |
| `bin/nvim-path.ts` | Prints the binary's path. It downloads the official tarball for this machine into `.cache/nvim/<tag>/` at the repository root (ignored by git) when missing, checks it against the pinned digest, unpacks it, and clears the macOS quarantine attributes. `CLAND_NVIM` names a binary to use instead. |
| `bin/cland-nvim` | The launcher above. |

## The ADR 0005 mitigations

In `init.lua`, and in the shell:

- **Shift+Enter in terminals.** Terminal mode maps `<S-CR>` to the kitty CSI-u sequence `ESC[13;2u`, so a harness sees Shift+Enter.
- **Pastes.** `'termpastefilter'` is `BS,ESC,DEL`, so pasted TABs survive.
- **Scrollback.** `'scrollback'` is 10,000, set before any terminal exists.
- **No hit-enter prompt.** `'cmdheight'` is 1, `'shortmess'` gains `aIcCFsWS`, and cland's notices are one line in the status line or its own buffers, never in the message area (`vim.notify` is replaced).
- **UI updates through `vim.schedule`.** Every hub frame is handled in the main loop, never in a libuv callback, and lands while the human types: Insert mode in the composer is kept.
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
| `lua/cland/views.lua` | One topic view per topic, and the placeholder views (item, board, Agents log, inbox full width). |
| `lua/cland/sessions.lua` | Session terminals: the attach command from `session.attach`, one request in flight per session, re-attaching after a restart. |
| `lua/cland/picker.lua` | The floating picker over topics and sessions. |
| `lua/cland/motions.lua` | `gi`, `gt`, `gs`: the reference under the cursor, the row, or the view, then the dispatch. |
| `lua/cland/restart.lua` | The restart snapshot file. |
| `lua/cland/topic_view.lua` | One topic's thread and composer, wired to the client (history merged on every connect). |
| `lua/cland/thread.lua` | The thread buffer: sender, role and local time on each message's header. The human's own messages show their delivery stage right-aligned (`⌁ queued`, `✓ delivered`, `✓✓ injected`), changed in place on `delivery` events. A one-line notice under the messages tells about the hub connection or a failed send. A cursor away from the tail stays where it is. |
| `lua/cland/composer.lua` | The composer, a prompt buffer. Enter sends, Shift+Enter (or Alt+Enter) inserts a newline. The text is kept until the hub accepts it and put back on a refusal. |
| `lua/cland/hl.lua` | The design's colours and glyphs: delivery stages, session states, item states. |

## Tests

```sh
npm run test:nvim          # from the repository root; `npm test` runs it after the hub's tests
```

Every test starts the real client headless as `nvim --clean -u nvim/init.lua --headless --listen <socket>`, under `NVIM_APPNAME=cland`, attaches a 160x45 UI over msgpack-RPC (`test/rpc.ts`), drives it with `nvim_input` and reads the screen back with `screenstring()` (`test/harness.ts`). When a test runs `:restart`, the harness follows the UI's `restart` event to the new server, as a terminal UI does.

- `test/client.test.ts` runs against a real hub (`cland hub start`) in a temporary project and connects real spokes over MCP: sending, delivery stages, Shift+Enter in the composer, the stdio transport, a clean configuration, autostart (also over a stale `hub.json`), following a hub restart.
- `test/shell.test.ts` runs against `test/stub-hub.ts`, a stub hub on stdio with scripted topics, sessions (states, capability tables, attach commands) and items, which emits events on command through a control socket: the top bar, every panel key, the session view and `␣␣`, the picker, `gi`/`gt`/`gs`, the presets, an event while typing, a burst of events without a hit-enter prompt, Shift+Enter and a tabbed paste reaching a session (`test/fakes/keylog.ts` logs the bytes its tty reads), refused sends, and a real `:restart` re-attaching the session terminal.
- `test/nvim-path.test.ts`: the resolver from a path with a space, `#` and `%`.

The binary comes from `CLAND_NVIM`, else the cache, else a download as above. When none of these works, for example offline with an empty cache, the client tests are skipped with the reason.
