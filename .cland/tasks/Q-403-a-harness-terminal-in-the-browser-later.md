---
id: Q-403
kind: question
title: "A harness terminal in the browser, later: what the harnesses allow and what the protocol must not preclude"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-399
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:49.936Z
updated: 2026-10-14T13:47:23.153Z
closed: 2026-10-14T13:47:23.153Z
---

## Question

A harness terminal in the browser, for later (spec v0.2 §3.8 keeps it out of 0.2.0): what each harness allows today (Claude Code's --bg supervisor and attach, Codex app-server without a TUI, OpenCode v2 without attach), what a PTY bridge over the hub's WebSocket would need (xterm.js, resize, scrollback, who owns the PTY, security), and what the protocol extension of §3.3 must not preclude so that a terminal can be added without redesign. Deliver docs/research/web-terminal.md on research/web-terminal and the resolution comment here.

## Comments

### human · 2026-10-14T13:47:02.732Z

Research done: `docs/research/web-terminal.md` on branch `research/web-terminal`, commit 524b88f76fddc044c74c2fb3fd13606aeddec4c9 (pushed to the territory). The probes are in `docs/research/web-terminal/`. Facts and options only; the decisions stay with the human.

**Every harness already has a terminal path, and cland already uses it.** The contract's mandatory `attachCommand` gives each running session a shell command, and Neovim runs it in a terminal buffer. A browser terminal would run the same command in a PTY the hub owns, relayed to xterm.js over the WebSocket. No harness offers a terminal stream a browser could consume directly.

**Per harness:**

| | Claude Code 2.1.299 | Codex 0.162.1 | OpenCode 2.0.24 |
|---|---|---|---|
| Attach | `claude attach <id>`: a client of the session's one PTY, held by a per-session PTY host (`Bun.Terminal`) under the supervisor | `codex resume --remote unix://… --cd <cwd> <thread>`: a new TUI process, a client of the session's app-server (no TUI exists before) | `opencode --server <url> --session <id> <cwd>`: a new TUI process, a client of the session's `opencode serve` (v2 has no `attach` command) |
| PTY or protocol | Both, internal. The attach client sends a JSON line to `control.sock` and then receives raw bytes. The PTY host frames everything as a 4-byte length, a 1-byte kind and a payload | Protocol: JSON-RPC notifications; the only PTY is the TUI's own | Protocol: HTTP and events; the only PTY is the TUI's own |
| Several attachments | Yes, on one shared screen and input line (observed earlier: two clients live). On Windows a new attach kicks the others | Yes, each with its own composer and size. Approvals: first answer wins | Yes ("N connected TUIs"); a host reply clears TUI dialogs |
| Resize | One size for all: the last attach or resize wins | Per client | Per client |
| Scrollback | None: attached sessions always render full-screen. Scrolling is in the app (PgUp, wheel, Ctrl+O transcript mode). Each attach forces a repaint and restores the DEC modes | Alternate screen by default; `--no-alt-screen` (or `/tui` scrollback mode) is inline, with native scrollback | Full-screen TUI with mouse reporting for all motion; `opencode mini --replay` is inline |
| Footprint (P3) | not measured (needs a signed-in session) | TUI 59 MB, app-server 62 MB (sign-in screen) | TUI 180 MB; the server grew to 432 MB while it was attached |
| Browser surface of its own | Remote Control: a conversation view, routed through Anthropic's cloud, so excluded | Codex on mobile: a conversation view through a ChatGPT relay | A web UI served by the same server (password, 5-minute pairing links, 30-day cookies) |

**What the hub holds today.**
- The thread: messages up to 8 KiB, asks, artifacts, deliveries.
- The journal: metadata only, "never the text".
- Per session: state, `approvalCommand`, usage.
- No transcript: `history: 'none'` in all three adapters. The Codex adapter already receives every item notification and drops it.

**What a terminal adds beyond the thread:**
- the harness's own transcript;
- its dialogs: approvals (`approvalRelay: 'none'` everywhere; the inbox approval row only carries the attach command), questions and forms;
- slash commands and pickers;
- interrupts;
- typing as the user.

**What a PTY bridge needs:**
- **Client.** xterm.js 6.0.0 with the fit, web-links, unicode11, serialize, webgl and clipboard addons. `addon-attach` is unusable: no resize, no flow control. A custom Shift+Enter handler is needed: 6.0 sends CR, and the kitty keyboard protocol is only opt-in in the 6.1 beta. Mouse reporting is needed too.
- **Hub side.** node-pty 1.1.0. It would be the hub's first native dependency, with prebuilt binaries for macOS and Windows only. Under npm 11.19 install-script gating, its `spawn-helper` was not executable: `posix_spawnp failed.` (observed). Ten idle PTYs cost 125 KB and 4 file descriptors each.
- **Reconnection.** Acknowledgement-based flow control: xterm.js parses 5 to 35 MB/s, and a browser WebSocket has no receive backpressure (VS Code: 100,000 / 5,000 / 5,000). Reconnect by running attach again; every harness repaints. Add a 30 to 60 s grace period with a snapshot serialized from `@xterm/headless` (VS Code's model).
- **Resize.** Claude Code needs a rule for its shared size: latest wins is the simplest.
- **Security.**
  - Cookie entry plus an exact Origin check: same-site ignores ports, so another loopback dev server would carry the cookie.
  - The endpoint runs only the adapter's attach command for a known session, never a command the client chooses.
  - TLS off loopback.
  - Audit, idle close, a cap on open terminals.

**What the protocol extension (Q-407) must not preclude, R1 to R8:**
1. **Typed frames.** Text frames are JSON; binary frames are reserved for streams, with a small header.
2. **Streams beside the model.** They are opened, resized and closed by request, and never enter the sequence numbers, catch-up, snapshot or journal.
3. **Sequence numbers** count model deltas, not socket frames.
4. **A queued-output limit per connection.** It answers a "resync" on the model stream (needed for phones in 0.2.0 anyway) and gives terminal streams an acknowledgement window.
5. **Model frames go first.** Terminal data travels in small chunks, or on its own socket.
6. **The entry.** Routed by path; a cookie that any number of sockets can present, not a one-time token used up by one socket; an Origin check on every upgrade.
7. **Size limits per frame kind.**
8. **Feature negotiation.** A feature list in the hello and welcome, and an adapter capability `terminal: 'attach' | 'none'`.

The door costs a page of spec and a few lines in the WebSocket edge now. It gets expensive later only if 0.2.0 fixes text-only frames, per-frame sequence numbers or a one-socket login. Neovim is unaffected either way.

**Prior art.**
- **Process per connection** is the norm: ttyd, gotty, wetty and Kubernetes exec. Shared screens are left to multiplexers (gotty with tmux, Zellij web) or to the program itself (Claude Code's PTY host).
- **Flow control** is always application-level: acknowledgements or PAUSE and RESUME.
- **Stateful reconnection** needs a process that outlives the socket plus a snapshot (VS Code).
- **Read-only defaults and origin checks** are standard hardening.
- **The vendors' own browser and phone surfaces** show conversations, not terminals.

**Recommendation (the human decides):**
1. **When.** After 0.2.0, as a 0.2.x theme, on evidence of how often the human goes to Neovim for something only the TUI offers. It is tied to Q-408: with per-adapter approval relays the terminal can wait; without them, it is the one generic way to finish "approving a command" from the web.
2. **Now.** Put R1 to R8 into Q-407, and add the `terminal` capability field.
3. **Design.** One generic bridge: `attachCommand` in a hub-owned node-pty, with:
   - one attach process per browser terminal;
   - a socket per terminal under the same cookie and Origin check;
   - flow control by acknowledgement;
   - a grace period with a serialized snapshot;
   - desktop first, with a watch-only mode for phones.
4. **First harness: Claude Code.** Under the default roles, the Coordinator, the Lead and Aides run without `permissions = "skip"` and stop on TUI prompts and `AskUserQuestion`. Codex roles run with `approval = "never"`. Claude Code also forces the hard decision early: the shared size. Codex comes next almost free and is the easiest to test (an isolated app-server needs no account). OpenCode last; consider proxying its own web UI instead of a PTY.
5. **Keep in view.** A transcript view built from the adapters (Codex items, OpenCode messages, the mod's `$.session.messages()`) plus approval relays could make the terminal a rare escape hatch.

**Not closed:**
- No live cland session was attached: a Claude Code attach would resize the human's sessions.
- No Claude Code background session was started, so `claude attach`'s cost and the repaint after attach are unmeasured.
- The Codex TUI was seen only at its sign-in screen, so its output rate in a streaming turn is unknown.
- No bridge was built and no browser was driven.
- Open questions:
  - the resize rule;
  - whether `$.prompt.submit` touches a half-typed draft;
  - whether a hub PTY can make Claude Code copy through OSC 52;
  - whether a read-only attach still resizes the session;
  - whether OpenCode's web UI works behind the hub's origin;
  - whether `claude attach` refreshes tokens at start (the #95822 hazard from the account-limits research).

### human · 2026-10-14T13:47:23.153Z

Resolved: see the resolution comment; docs/research/web-terminal.md on research/web-terminal
