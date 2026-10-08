# nvim

The Neovim side of cland: the standalone start and the Lua UI (spec `docs/spec/v0.md`, sections 4.1 and 5; ADR 0005). Today it shows the General topic of a project's hub: a thread and a composer (#23). The shell around it (top bar, panels, the other centre views) is #25.

## Starting it

```sh
nvim/bin/cland-nvim [project-dir] [nvim args…]
```

- **The project** is the given directory, else the current one. The client walks up to the nearest ancestor holding `.git` or `.cland/`, as the hub does.
- **The hub** is found through `.cland/hub.json`. When no hub runs, the client runs `cland hub start` once and connects when it answers. With `CLAND_HUB_TRANSPORT=stdio` the client spawns `cland hub serve --stdio` as its child instead and speaks the frames over its stdin and stdout. Quitting closes the child's stdin, which stops that hub.
- **The `cland` CLI** is run as `node hub/bin/cland.ts` from this repository; `CLAND_NODE` names another `node`.

The launcher runs `NVIM_APPNAME=cland nvim --clean -u nvim/init.lua`, in that order. `NVIM_APPNAME` renames every `stdpath()`; `--clean` then `-u` skips the user's init, `plugin/` and `pack/` directories and sources only cland's `init.lua`. `:scriptnames` lists the bundled runtime and `nvim/init.lua`, nothing else.

## The pinned Neovim

| File | What it is |
| --- | --- |
| `NVIM_VERSION` | The release tag cland runs on, the one place it is set (`v0.12.5`). |
| `NVIM_SHA256SUMS` | The sha256 of each release tarball cland accepts (macOS and Linux, arm64 and x86_64), copied from the release's asset digests. |
| `bin/nvim-path.ts` | Prints the binary's path. It downloads the official tarball for this machine into `.cache/nvim/<tag>/` at the repository root (ignored by git) when missing, checks it against the pinned digest, unpacks it, and clears the macOS quarantine attributes. `CLAND_NVIM` names a binary to use instead. |
| `bin/cland-nvim` | The launcher above. |

## The ADR 0005 mitigations

All in `init.lua`:

- **Shift+Enter in terminals.** Terminal mode maps `<S-CR>` to the kitty CSI-u sequence `ESC[13;2u`, so a harness sees Shift+Enter.
- **Pastes.** `'termpastefilter'` is `BS,ESC,DEL`, so pasted TABs survive.
- **Scrollback.** `'scrollback'` is 10,000, set before any terminal exists.
- **No hit-enter prompt.** `'cmdheight'` is 1, `'shortmess'` gains `aIcCFsWS`, and cland's notices are one line in its own buffers, never in the message area.
- **UI updates through `vim.schedule`.** Every hub frame is handled in the main loop, never in a libuv callback.

The other two consequences of ADR 0005, session terminals that only attach and no session tiled below three rows, come with the session views.

## Modules

| Path | What it is |
| --- | --- |
| `init.lua` | The entry point: the runtime path, the mitigations, then `require('cland').start()` on `VimEnter`. |
| `lua/cland/init.lua` | Finds the project root, creates the hub client and opens General. |
| `lua/cland/hub.lua` | The hub client: the Unix socket through `hub.json` (reconnecting with backoff, re-reading the file each time) or a stdio child; JSON lines; requests by id; `message`, `delivery`, `state` and `connected` handlers. It subscribes on every connect. |
| `lua/cland/topic_view.lua` | One topic on screen: a thread window and a composer split below it, wired to the client. History is merged on every connect. |
| `lua/cland/thread.lua` | The thread buffer: sender, role and local time on each message's header. The human's own messages show their delivery stage right-aligned (`⌁ queued`, `✓ delivered`, `✓✓ injected`), changed in place on `delivery` events. A one-line notice under the messages tells about the hub connection or a failed send. |
| `lua/cland/composer.lua` | The composer, a prompt buffer. Enter sends, Shift+Enter (or Alt+Enter) inserts a newline. A message that could not be sent is put back. |
| `lua/cland/hl.lua` | The highlight groups in the design's colours, as defaults; the stage glyphs. |

## Tests

```sh
npm run test:nvim          # from the repository root; `npm test` runs it after the hub's tests
```

`test/client.test.ts` starts a real hub with `cland hub start` in a temporary project. It starts the real client headless as `nvim --clean -u nvim/init.lua --headless --listen <socket>`, under `NVIM_APPNAME=cland`. It drives the client over msgpack-RPC (`test/rpc.ts`) with `nvim_input` and reads the screen back with `screenstring()`, and it connects real spokes over MCP. No internals are mocked.

The binary comes from `CLAND_NVIM`, else the cache, else a download as above. When none of these works, for example offline with an empty cache, the tests are skipped with the reason.
