---
id: Q-16
kind: question
title: "Research: QA of a terminal IDE with gpt 6 astra computer use"
state: closed
labels:
  - wayfinder:research
assignee: Kealman
parent: M-1
blocked_by:
  - T-6
topic: null
branch: null
created: 2026-10-07T14:52:37Z
updated: 2026-10-08T13:17:15.596Z
github:
  repo: Kealman/cland-v0
  number: 16
  url: https://github.com/Kealman/cland-v0/issues/16
---

## Question

How can gpt 6 astra (computer use, through `/codex:rescue`) do QA against a terminal IDE? Investigate:

- How astra can see and drive a TUI: a terminal inside a virtual display, tmux capture, terminal screenshots, a web terminal.
- What `/codex:rescue` needs from the environment.
- What cland must provide to be testable: deterministic launch, fixtures, a way to script sessions, observable state.
- How QA verdicts get recorded.

Primary sources: Codex and computer-use docs, the codex plugin installed in this repo. The answer is a recommended QA setup to try.

## Comments

### Kealman · 2026-10-07T17:32:46Z

<!-- github-comment: 6043276639 -->

## Resolution

**Bottom line.** gpt 6 astra cannot get a native terminal window through `/codex:rescue`. Computer use hard-blocks terminal apps for safety. And in this chain no approval can be granted at all, so other desktop apps and new browser origins are refused too.

astra can still QA a terminal UI three ways, each verified with `nvim --clean`:
1. A single headless Neovim process that dumps its screen grid as text. Needs no grant; works even in a read-only run.
2. tmux plus `capture-pane`. Needs `[sandbox_workspace_write] network_access = true`.
3. A ttyd web terminal on `127.0.0.1:47614`, driven in Chrome. Needs a saved "allow" for that origin. Keys go in one at a time, and rows are read from the accessibility tree.

**Recommended setup to try:**
- Make text-mode QA the default lane, through a `cland --headless --qa` entry point. That entry point needs a stdio link to the hub, because the Unix socket from ADR 0003 is blocked in the sandbox.
- Add tmux for real-TUI cases, and ttyd only for visual cases.
- Record each run as a verdict on the item (clear / not clear, as a structured comment), plus one `runs.jsonl` line per case.

**Findings**

1. **What computer use is.** One MCP server, `cua_repl`, from the bundled plugin `unified-computer-use`, run by the ChatGPT desktop app's node. It has two surfaces:
   - macOS apps, through the "Codex Computer Use" helper;
   - browsers: Chrome through the ChatGPT for Chrome extension, or the in-app browser, which exists only inside the ChatGPT app.

   The "browser viewport" from #6 was the user's Chrome new-tab page.
2. **Terminals are hard-blocked.** Terminal, iTerm2, kitty, WezTerm, Warp and Ghostty all return "Computer Use is not allowed to use the app '…' for safety reasons."
   - The list is compiled into the signed helper, and OpenAI documents that computer use "can't automate terminal apps".
   - No config key, environment variable or macOS permission lifts it. Even `computer_use.macos.bundle_ids` still goes through the normal approval flow.
3. **Nothing can be approved during a rescue run.** The companion starts threads with `approvalPolicy: "never"`.
   - Under that policy Codex itself declines every MCP elicitation (`codex-mcp/src/elicitation.rs`).
   - On top of that, the plugin client answers any server request with -32601.
   - Results: Zed and Finder fail with "not approved", `http://127.0.0.1:47613` fails with `user_declined`, and the in-app browser reports "Browser is not available: iab".
4. **`cua_repl` runs outside the shell sandbox.** Codex spawns stdio MCP servers without Seatbelt. Only the app policy and the approval layer limit it.
5. **The shell sandbox refuses Unix-socket servers while network is off.**
   - tmux and `nvim --listen` fail with "Operation not permitted" in read-only runs, and in `--write` runs too, even inside the workspace.
   - With `network_access = true` both work: `capture-pane` showed `qa-ok`.
   - Also: Codex's command policy refuses `rm -f`, and `pgrep` cannot list processes.
6. **The headless Neovim dump is the best default.** It feeds keys with `nvim_input` and reads the grid with `screenstring()`, and works in the default read-only run. The dump includes floats and `:terminal` contents. It is the most deterministic and the cheapest surface.
7. **The web terminal works with one saved approval.** With `[origins] allowed` in `~/.codex/browser/config.toml`, Chrome opens ttyd without a prompt.
   - With `?rendererType=dom&screenReaderMode=true` the rows are readable in the accessibility tree.
   - In that mode xterm.js ignores `typeText` input; per-key `pressKey` works.
   - Neovim has no restricted mode (`-Z` was removed), so a ttyd started outside the sandbox hands astra an unsandboxed shell. Keep it on loopback, with `-O`, one origin, and a short life.
8. **Rescue mechanics.**
   - A foreground run is capped by Claude Code's Bash timeout (2 min by default, 10 at most). Long QA runs need `--background`, then `/codex:status` and `/codex:result`.
   - Results live in the companion job record and in the rollout `~/.codex/sessions/.../rollout-*-<thread>.jsonl`, which holds every call, output and screenshot.
   - Pass the brief as a repo file through a one-line task.
9. **What cland must provide.**
   - a deterministic `cland --qa` launch: fixed `NVIM_APPNAME`, grid size and env;
   - stub harnesses and seeded fixtures;
   - a socket-free scripting entry point with a Lua QA API and an exit-code verdict;
   - a JSON state snapshot;
   - a `:ClandQaDump` hook;
   - a ttyd launcher on port 47614.
10. **Permissions.**
    - Grant 1, the origin `http://127.0.0.1:47614`, is narrow: keep it.
    - Grant 2, `network_access = true`, widens every `--write` Codex run, sol reviews included: revert it after tmux QA runs.
    - Accessibility and Screen Recording are not needed; they matter only for desktop apps.
11. **Probes.** Eight runs through `/codex:rescue` (P1–P8). P7 was refused by the Claude Code auto-mode classifier and never reached Codex. Exact prompts and outputs are in Appendix A.

Full findings with sources: `docs/research/qa-astra.md` on branch `research/qa-astra` (https://github.com/Kealman/cland-v0/tree/research/qa-astra).
