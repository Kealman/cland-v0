# QA of a terminal IDE with gpt 6 astra computer use

Research for wayfinder ticket [#16](https://github.com/Kealman/cland-v0/issues/16), made on 2026-10-07.

- **Question.** How can gpt 6 astra, run through `/codex:rescue`, do QA against a terminal IDE (cland, on Neovim)? What does the chain need, what must cland provide, and how are QA verdicts recorded?
- **Environment.**
  - macOS 27.0.1 on arm64.
  - Claude Code plugin `openai-codex/codex` 1.0.6.
  - Codex CLI 0.160.0: the standalone install, logged in with ChatGPT.
  - ChatGPT desktop app 26.901.51231 (bundle id `com.openai.codex`). It ships the computer-use runtime. Codex merged into this app on 2026-07-09 ([changelog](https://learn.chatgpt.com/docs/changelog): "Codex is now part of the ChatGPT desktop app on macOS and Windows.").
  - The helper app "Codex Computer Use" 26.831.1000926 (`com.openai.sky.CUAService`, display name "ChatGPT Computer Use").
  - Bundled Codex plugins: `unified-computer-use`, `browser` and `chrome` 26.901.51231, and `computer-use` 1.0.1000926.
  - Neovim 0.11.2 and tmux 3.5a. ttyd 1.7.7 was installed for this research.
- **Path shorthands.**
  - `PLUGIN` = `/Users/evgeniyivanov/.claude/plugins/cache/openai-codex/codex/1.0.6`
  - `BUNDLED` = `~/.codex/plugins/cache/openai-bundled`
  - `CUA_NODE` = `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules`
  - `CU_APP` = `~/.codex/computer-use/Codex Computer Use.app`
  - `STATE` = `~/.claude/plugins/data/codex-openai-codex/state`
  - OpenAI's Codex docs now live at `learn.chatgpt.com/docs`, and `developers.openai.com/codex/*` redirects there.
- **Evidence labels.**
  - **P1–P8** are probes of gpt-6-astra through the sanctioned chain: the `codex:codex-rescue` agent calls `codex-companion.mjs task`. [Appendix A](#appendix-a-probes) has every prompt and output.
  - **S0** is the smoke test of ticket #6.
  - **L1–L5** are local experiments run without Codex ([Appendix B](#appendix-b-local-experiments)).
  - The computer-use helper is closed source. Claims read from its binary with `strings` say so; they show which strings exist, not how they are used.
- **Not read.** The session's permission classifier blocked reading `~/.codex/config.toml` and `~/.codex/browser/config.toml` as possible credentials. Statements about those files come from the code that reads them, from the official config reference, and from the coordinator's description of the two grants it applied.

## Bottom line

- **astra's computer use is one MCP server, `cua_repl`, with two surfaces.**
  - The computer surface drives macOS apps through the "Codex Computer Use" helper.
  - The browser surface drives Chrome through the ChatGPT for Chrome extension, or the in-app browser when running inside the ChatGPT app.
  - The ChatGPT desktop app supplies the runtime; the Codex CLI does not.
  - A correction to ticket #6: its dark "browser viewport" was the user's Chrome new-tab page, read through the extension (S0 rollout). It does not mean computer use sees only a browser.
- **No setting gives astra a native terminal window.** Terminal, iTerm2, kitty, WezTerm, Warp and Ghostty all fail with "Computer Use is not allowed to use the app '…' for safety reasons." (P1).
  - The block list is compiled into the signed helper.
  - OpenAI documents the rule: the feature "can't automate terminal apps or ChatGPT itself, since automating them could bypass ChatGPT security policies" ([Computer Use](https://learn.chatgpt.com/docs/computer-use)).
  - No config key, environment variable or macOS permission lifts it. The per-app key `computer_use.macos.bundle_ids` still "requires … the normal approval flow".
- **Nothing that needs approval can happen during a `/codex:rescue` run.**
  - The companion starts threads with `approvalPolicy: "never"`, and under that policy Codex itself declines every MCP elicitation.
  - The plugin's client would also reject any forwarded request.
  - Desktop apps therefore fail with "Computer Use was not approved to use Zed" (P1).
  - New browser origins fail with "The user declined permission for this action" (P2).
  - The in-app browser does not exist outside the ChatGPT app: "Browser is not available: iab" (P2).
- **astra can still QA a terminal UI. Three paths work, each verified with plain `nvim --clean`:**
  1. **Headless Neovim screen dump, no grant needed.** One `nvim --headless` process feeds keys and prints its screen grid as text. It works in the default read-only run (P3).
  2. **tmux around the real TUI, needs grant 2.** `send-keys` and `capture-pane -p` work after `[sandbox_workspace_write] network_access = true`. Without it, the sandbox refuses every Unix-socket server, even inside the workspace (P4 versus P8). `nvim --listen` behaves the same way.
  3. **A web terminal in Chrome, needs grant 1.** ttyd on `127.0.0.1:47614` works after a saved "allow" for that one origin (P5, P6).
     - Keys must be sent one at a time with `pressKey`, because xterm.js ignores `typeText` input in screen-reader mode.
     - With `?screenReaderMode=true` the terminal rows appear as text in the accessibility tree, and `qa-ok` showed up both there and in the screenshot (P6).
- **Recommended setup (to try, not decided):**
  - **Default:** text-mode QA, driven by astra with shell commands. A cland QA entry point runs a case script in a headless instance and dumps the screen grid plus session state; tmux covers real-TUI cases.
  - **Visual pass:** the ttyd-in-Chrome path, only for cases that need pixels.
  - **Coordination logic:** checks against the hub state.
  - **Recording:** each run ends in a verdict (clear or not clear) posted as a structured comment on the item, plus one `runs.jsonl` line per case, following BCAS's QA journal and the glossary's Verdict.
  - **Hub link:** ADR 0003 puts a Unix socket between the UI and the hub, so a socket-free QA transport is a cland requirement.
  - **Grants:** keep grant 1. Turn grant 2 on only for tmux runs, because it opens network and sockets to every `--write` Codex run.

## 1. What astra's computer use is

### 1.1 One MCP server, supplied by the ChatGPT app

- **Where `cua_repl` comes from.** It is the MCP server of the bundled plugin `unified-computer-use`, described as "App-managed browser automation runtime." (`BUNDLED/unified-computer-use/26.901.51231/.codex-plugin/plugin.json`). Its `.mcp.json`:
  - starts `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node …/scripts/launch.mjs`;
  - exposes only `js` and `js_reset` (`output_token_limit` 25000 for `js`);
  - sets `CUA_REPL_ENABLED_SURFACES=browser,computer`, `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab`, `SKY_CUA_SERVICE_PATH=~/.codex/computer-use/Codex Computer Use.app` and `CODEX_CLI_PATH=/Applications/ChatGPT.app/Contents/Resources/codex`.
  - Source: `BUNDLED/unified-computer-use/26.901.51231/.mcp.json`.
- **How it starts.** `launch.mjs` runs the app's `node_repl` with a banner that calls `setupCUA({ browser, computer })` from `@oai/cua/tinyskyAlt`. It registers `@oai/browser-desktop/service` for the browser surface and `@oai/sky/service` for the computer surface (`…/scripts/launch.mjs`, `…/resources/banner.js`). The tool description the model sees reads "Control native apps or browsers on the user's computer by reading or operating UI. Prefer purpose-built skills, connectors, APIs, or CLIs when available." (`…/resources/js-tool-description.md`).
- **What it depends on.**
  - The ChatGPT desktop app must be installed: its node and its modules are used (`CUA_NODE/@oai/cua` 0.2.4, `@oai/sky` 0.6.26, `@oai/browser-desktop` 0.1.1). OpenAI says "Computer Use requires the ChatGPT desktop app." ([use case](https://learn.chatgpt.com/use-cases/use-your-computer-with-codex)).
  - The app need not be running: every probe saw `"ChatGPT","id":"com.openai.codex","isRunning":false` while computer use answered (P1, P2, P5).
  - An OpenAI engineer describes the same arrangement: "On macOS, the plugin has a standalone MCP launcher that the CLI can use once the desktop app's Computer Use runtime is installed." ([openai/codex#44470](https://github.com/openai/codex/issues/44470)).
- **The API.** The first `cua.getState()` returns the API documentation (S0, P1):
  - `cua.getState`, `getApp`, `listApps`, `getBrowser`, `createBrowserTab`, `getTab`, `listBrowsers`, `listTabs`;
  - targets offer `getAXState`, `getScreenshot`, `click`, `typeText`, `pressKey`, `paste`, `scroll`, `drag`, `selectText`, `setValue`;
  - tabs add `goto`, `back`, `forward`, `reload` and `close`;
  - a browser's type is `iab`, `extension` or `cdp`.
  - The full text is in the S0 rollout `~/.codex/sessions/2026/10/07/rollout-2026-10-07T18-30-57-01a11734-2a9a-7ce2-9725-ba026c72e7fa.jsonl`.
- **The model is suited to this.** OpenAI's model page calls gpt-6-astra "Our most capable model for the most demanding work", suited to "complex reasoning, coding, computer use, research, and document creation", and lists "Computer use" among its tools ([gpt-6-astra](https://developers.openai.com/api/docs/models/gpt-6-astra)). The Codex computer-use page advises: "For difficult tasks that depend on screenshots or visual judgment, choose GPT-6 Astra" ([Computer Use](https://learn.chatgpt.com/docs/computer-use)). Every probe ran as `gpt-6-astra` at effort `high` (rollout `turn_context`).

### 1.2 The computer surface: macOS apps, behind an app policy

- **The policy request.** Before using an app, the client sends `ComputerUseIPCAppPolicyRequest` over the helper's IPC (`CodexComputerUseIPC-5`). The reply carries `decision: "allowed" | "denied" | "forbidden"`, plus `risk`, `warningSubtitle` and `allowPersistentApproval` (`CUA_NODE/@oai/sky/dist/project/cua/sky_js/src/targets/mac/client.js`, `client.d.ts`).
- **What each decision does** (`…/targets/mac/computer-use-policy.js`):
  - `forbidden` throws "Computer Use is not allowed to use the app '<bundle id>' for safety reasons."
  - `denied` throws "Computer Use is blocked from using the app '<bundle id>' by your organization's policy."
  - `allowed` asks through an MCP elicitation, "Allow Computer Use to use "<name>"?" (`codex_approval_kind: "mcp_tool_call"`, `persist: ["session","always"]` when persistent approval is allowed). Anything but accept throws "Computer Use was not approved to use <name>". A reply marked `source: "computer-use-persisted-state"` counts as a saved "Always allow".
- **The forbidden list is compiled into the signed helper** (`CU_APP/Contents/MacOS/SkyComputerUseService`, read with `strings`). One contiguous block of bundle ids holds:
  - password managers: 1Password, Bitwarden, Dashlane, LastPass, NordPass, Proton Pass;
  - terminals: `com.apple.Terminal`, `com.googlecode.iterm2`, `dev.warp.Warp-Stable`, `net.kovidgoyal.kitty`, `com.github.wez.wezterm`, `com.mitchellh.ghostty`, `com.raphaelamorim.rio`, `dev.commandline.waveterm`;
  - OpenAI's own apps (`com.openai.codex*`, `com.openai.chat.*`, `com.openai.atlas*`);
  - browsers other than Chrome: Safari, Comet, Brave, Edge, Opera, Vivaldi, Arc, Dia, Chromium;
  - system security processes.

  A second block holds `org.alacritty`, `co.zeit.hyper` and `org.tabby`. The decision each block feeds is inferred from the strings, not read from code. P1 confirms `forbidden` for the six installed terminals. Alacritty is not installed, so P1 got "Invalid app: org.alacritty".
- **The official rule matches.** "The feature can't automate terminal apps or ChatGPT itself, since automating them could bypass ChatGPT security policies." ([Computer Use, safety guidance](https://learn.chatgpt.com/docs/computer-use#safety-guidance)).
- **No user setting lifts a forbidden app.**
  - The documented per-app keys are `computer_use.default_app_access` ("Fallback native-app access policy for Computer Use … local configuration cannot relax managed restrictions") and `computer_use.macos.bundle_ids` ([config reference](https://learn.chatgpt.com/docs/config-file/config-reference)). Of a bundle-id entry, the reference says: "`allow` overrides only this policy source's default and still requires any other policy source and the normal approval flow to allow the app."
  - Managed requirements can only restrict: switch computer use off (`features.computer_use = false`, `allow_browser_and_computer_use = false`) or deny apps.
  - The helper's strings show how requirements arrive: a `CodexAppServerComputerUsePolicyProvider` reads the app-server method `configRequirements/read` (fields `featureRequirements`, `allowBrowserAndComputerUse`, `allowPersistentApproval`, `defaultAppAccess`), with the message "Computer Use is disabled by your configuration." That is the separate `denied` path, not `forbidden`.
  - The open-source side matches:
    - The method is defined at [`app-server-protocol/src/protocol/common.rs` L1437-1441](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/app-server-protocol/src/protocol/common.rs#L1437-L1441). Its response carries `allowBrowserAndComputerUse` and `computerUse { allowLockedComputerUse, allowPersistentApproval, defaultAppAccess, macos.bundleIds, windows }` ([`v2/config.rs` L411-459, L502-511](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/app-server-protocol/src/protocol/v2/config.rs#L411-L459)).
    - Requirements come from `/etc/codex/requirements.toml`, macOS managed preferences (`com.openai.codex`, key `requirements_toml_base64`) or the enterprise cloud bundle ([`config/src/loader/mod.rs` L107-121](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/config/src/loader/mod.rs#L107-L121), [`loader/macos.rs` L27-29](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/config/src/loader/macos.rs#L27-L29)).
    - The user-side `[computer_use]` table (`default_app_access`, `macos.bundle_ids`) is in [`config/src/computer_use.rs` L9-35](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/config/src/computer_use.rs#L9-L35).
    - The Rust code only serializes these values to the helper. A search of `codex-rs` at the tag finds no consumer of the `computer_use` settings, so enforcement happens in the closed-source helper.
  - Nothing in the plugin JavaScript, in `~/.codex/plugins`, in the helper's strings or in the Codex source ties `forbidden` to a key or an environment variable.
  - The per-app key was deliberately not tried against a terminal. The documented rule says it cannot work, and trying it would mean routing around a stated safety boundary.
- **macOS permissions.**
  - OpenAI: "On macOS, grant Screen Recording and Accessibility permissions when prompted" and "open System Settings > Privacy & Security and check Screen Recording and Accessibility for Codex Computer Use" ([Computer Use](https://learn.chatgpt.com/docs/computer-use)). The appshots page names the pane "Screen & System Audio Recording" ([Appshots](https://learn.chatgpt.com/docs/appshots)).
  - The helper's strings say the same: "The user has not finished granting Accessibility and Screen Recording permissions in the ChatGPT Computer Use window."
  - These rights matter only for desktop apps. The policy check runs before any action (`withComputerUsePolicy` calls `getAppPolicy` first), so granting them cannot unblock a terminal, and no probe needed them.
- **The approval layer stops everything else in this chain.** In P1, Zed and Finder (both `allowed`) failed in about 12 ms with "Computer Use was not approved to use Zed" and "… Finder". No human was asked. In the ChatGPT app, the same prompt offers "Always allow / Cancel / Allow" ([Computer Use](https://learn.chatgpt.com/docs/computer-use)).

### 1.3 The browser surface: Chrome via the extension, with an origin check

- **Two backends.**
  - `chrome`: the ChatGPT for Chrome extension, with its native host at `BUNDLED/chrome/26.901.51231/extension-host/macos/arm64/ChatGPT for Chrome`.
  - `iab`: the in-app browser. The browser plugin presents it as the tool for "local web targets such as localhost, 127.0.0.1, ::1, file:// URLs" (`BUNDLED/browser/26.901.51231/.codex-plugin/plugin.json`), and OpenAI's docs say "the built-in browser for localhost" ([Chrome extension](https://learn.chatgpt.com/docs/chrome-extension)).
- **In the rescue chain only Chrome exists.** `listBrowsers()` returns one browser, `{"name":"Chrome","type":"extension"}` (P1), and `createBrowserTab("iab", …)` fails with "Browser is not available: iab" (P2). OpenAI's docs agree: "Browser isn't available in Codex CLI or the Codex IDE extension." ([Browser](https://learn.chatgpt.com/docs/browser)).
- **The smoke test's "browser viewport".** It was the user's existing Chrome tab `chrome://newtab/`, read with `cua.getTab('1158676208', {browser:'1'})` (S0 rollout).
- **The origin check.** Each visit to a new origin runs `browser-origin-access` (`BUNDLED/browser/26.901.51231/scripts/browser-service.mjs`, function `JA` and class `Rs`). In order:
  1. A network policy can deny. It comes from managed requirements and the user's default permission profile: `default_permissions` plus `[permissions.<name>.network]` domains.
  2. A saved decision answers without asking. Saved decisions live in the global store `~/.codex/browser/config.toml` (`[origins]` with `allowed`/`denied` arrays of origin patterns, or `approval_mode = "never_ask"` for every site) and in the per-thread store `~/.codex/browser/sessions/<id>.toml`. In code, `eM()` maps the global store to `"browser/config.toml"`, and `maybeAutoAnswerBrowserUseRequest` returns `{decision:"approve", scope:"global", source:"browser-use-persisted-state"}` when an `origins.allowed` pattern matches.
  3. Otherwise it sends an MCP elicitation, "Allow <browser> to access <origin>?" (`tool_name: "access_browser_origin"`).
- **Local hosts skip only the remote site-safety lookup.** `localhost`, `127.0.0.1` and `::1` skip `…/aura/site_status` (function `Zv`), but they still need approval.
- **The UI equivalent.** The ChatGPT app offers "Allow once … Allow for this site … Allow for all sites … Decline", and "Settings > Computer Use, then select Manage next to your browser to manage an allowlist and blocklist for domains" ([Chrome extension](https://learn.chatgpt.com/docs/chrome-extension)).
- **P2, before the grant.** The elicitation was declined at once: "Reason: The user declined permission for this action." (reason `user_declined`, decision source `user_decision`). The page server logged no request from Chrome (L4).
- **P5, after grant 1.** With `http://127.0.0.1:47614` added to `origins.allowed`, `createBrowserTab("chrome", "http://127.0.0.1:47614/…")` opened the page with no prompt. ttyd logged `WS /ws - 127.0.0.1, clients: 1` and `started process` (L4 log).
- **The refusal text forbids workarounds.** "The agent must not attempt to achieve the same outcome via workaround, indirect execution, raw CDP or browser commands, alternate browser surfaces, or policy circumvention." (P2; `browser-service.mjs`). The grant used here is the documented saved-decision path, not a workaround.
- **Typing into a web terminal is a foreseen action.** The browser confirmation policy lists "[16] Enter model-generated code into tools/OS (terminal/editor/devtools)" among the actions that need only pre-approval in the initial prompt (`BUNDLED/browser/26.901.51231/docs/confirmations.md`). The hard block covers native terminal apps.
- **The network proxy does not cover the browser.** It "does not filter web search, app or connector tool calls, MCP server connections, browser or Computer Use activity" ([approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)).

### 1.4 Sandbox, approvals and where things run

- **How the companion starts threads.** Every task thread starts with `approvalPolicy: "never"` and `sandbox: "read-only"`; `--write` switches to `"workspace-write"` (`PLUGIN/scripts/lib/codex.mjs` L62-83, `PLUGIN/scripts/codex-companion.mjs` L491). Task threads are persisted (`ephemeral: false`, `codex.mjs` L1117).
- **What the rollouts confirm.**
  - P1–P3 and P5–P6: `read-only`, network `restricted`.
  - P4: `workspace-write`, `network_access: false`.
  - P8: `workspace-write`, `network_access: true`, profile network `enabled`.
  - With `--write`, the writable roots are the worktree, `/tmp` and `$TMPDIR`.
- **Every approval is refused, twice over.**
  - **Codex declines first.** Under `never`, Codex core declines every MCP elicitation before any reviewer or client sees it: `if elicitation_is_rejected_by_policy(approval_policy) { return Ok(ElicitationResponse { action: Decline, content: None, meta: None }) }`, with `AskForApproval::Never => true` ([`codex-mcp/src/elicitation.rs` L451-457, L551-558](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/codex-mcp/src/elicitation.rs#L451-L457)).
    - That decline carries no `approvals_reviewer` marker, which is why the browser code reports it as `user_declined`.
    - The config reference says the same: "When `true`, MCP elicitation prompts are allowed to surface instead of being auto-rejected." (`approval_policy.granular.mcp_elicitations`, [config reference](https://learn.chatgpt.com/docs/config-file/config-reference)).
  - **The plugin would decline too.** Under `on-request` the elicitation would reach the client as `mcpServer/elicitation/request`. The plugin answers every server request with JSON-RPC error -32601 "Unsupported server request: <method>" (`PLUGIN/scripts/lib/app-server.mjs` L156-160; the broker uses the same client, `PLUGIN/scripts/app-server-broker.mjs` L68). Codex maps such an error to Decline ([`app-server/src/bespoke_event_handling.rs` L1772-1779](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/app-server/src/bespoke_event_handling.rs#L1772-L1779)).
  - **Auto-review does not help.** `approvals_reviewer = "auto_review"` is routed only under `on-request` or granular policies ([`ext/guardian-reviewer/src/routing.rs` L54-62](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/ext/guardian-reviewer/src/routing.rs#L54-L62); the docs: "Who reviews eligible approval prompts under `on-request` or granular approval policies").
  - **The one exception is outside the chain.** With `danger-full-access`, empty-form elicitations are accepted automatically ([`elicitation.rs` L420-426](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/codex-mcp/src/elicitation.rs#L420-L426)). The companion offers only `read-only` and `workspace-write`, so `/codex:rescue` never gets there.
- **The shell sandbox.**
  - Read-only: tmux cannot create its socket, and Neovim cannot create its temp dir or server socket (P3).
  - Workspace-write with network off: file writes work, but Unix-socket servers are refused even inside the workspace (P4).
  - Network on (P8): both work.
  - The docs describe the switch: "the default `workspace-write` sandbox mode keeps network access turned off unless you enable it in your configuration: `[sandbox_workspace_write] network_access = true`" ([approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)).
  - The macOS Seatbelt policy shows why sockets follow that switch:
    - The base policy starts "closed-by-default (deny default)" and has no network rule ([`sandboxing/src/seatbelt_base_policy.sbpl` L7-8](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/sandboxing/src/seatbelt_base_policy.sbpl#L7-L8)).
    - Unix-socket rules such as `(allow network-bind (local unix-socket))` are emitted only from an allowlist or an allow-all setting ([`sandboxing/src/seatbelt.rs` L270-303](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/sandboxing/src/seatbelt.rs#L270-L303)).
    - With network off and no allowlist, the dynamic section is empty (L319-383), so binding or connecting to a Unix socket fails with EPERM even where file writes succeed.
    - With network enabled and no proxy, the policy adds `(allow network-outbound)\n(allow network-inbound)` (L372-380). It never emits a blanket `network-bind`, yet P8 shows that listening on a Unix socket works with network on. Which rule permits it was not traced.
    - A narrower switch exists: a permission profile can allow specific socket paths while network stays off (`[permissions.<name>.network] unix_sockets = { "<path>" = "allow" }`, [`config/src/permissions_toml.rs` L330-342](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/config/src/permissions_toml.rs#L330-L342)). Whether a companion-started thread picks such a profile up was not tested (Appendix C).
  - Two more quirks (P4):
    - `pgrep` cannot list processes ("sysmond service not found").
    - Codex's command check refuses forced `rm` with "rm -f style commands are not permitted. Use a safer approach" (`DangerousCommandMatch::ForcedRm`, [`core/src/exec_policy.rs` L1110-1117](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core/src/exec_policy.rs#L1110-L1117); detector in [`shell-command/src/command_safety/is_dangerous_command.rs` L123-135](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/shell-command/src/command_safety/is_dangerous_command.rs#L123-L135)). Under `on-request` it would become an approval request; under `never` it becomes a refusal.
- **Computer use is not limited by the shell sandbox.**
  - Codex spawns local stdio MCP servers directly, with no Seatbelt wrapper ([`rmcp-client/src/stdio_server_launcher.rs` L263-292](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/rmcp-client/src/stdio_server_launcher.rs#L263-L292)). The sandbox wraps only `exec_command` and shell commands.
  - So `cua_repl` and the helper run with the user's full privileges. In read-only threads they listed apps, ran policy checks and drove Chrome (P1, P2, P5, P6).
  - OpenAI says the same from the other side: "File reads, file edits, and shell commands still follow the sandbox and approval settings for the task." ([Computer Use](https://learn.chatgpt.com/docs/computer-use)).
  - What limits computer use is the app policy and the approval layer.

## 2. Candidate QA surfaces for a terminal IDE

### 2a. Desktop terminal apps and other desktop apps

- **Native terminals: impossible.** All six installed terminals get "forbidden" (P1). The decision is compiled into the helper, and the docs exclude terminal apps by design (section 1.2).
- **Desktop apps with a built-in terminal (Zed, VS Code): not usable here, and not recommended.** The policy treats them as ordinary apps, so they need approval, and approval is impossible in the rescue chain (P1). A saved "Always allow" from the ChatGPT app might satisfy the check (the `computer-use-persisted-state` path; not tested). Even so, driving an editor's terminal through computer use would defeat the reason terminals are blocked.
- **AppleScript or System Events: not recommended.** The computer-use skill says not to use "AppleScript, `osascript`, JXA, System Events, CGEvent synthesis" unless the user asks for it (`BUNDLED/computer-use/1.0.1000926/.codex-plugin/computer-use-node-repl.md`). It would also need Accessibility and Automation rights for the process running Codex, and it would route around the terminal block. Not tested.

### 2b. A web terminal served locally, opened in Chrome

- **What ttyd needs on macOS.** `brew install ttyd` pours the 1.7.7 bottle plus json-c, libevent, libuv, libwebsockets and openssl@3. No sudo is needed when the Homebrew prefix belongs to the user, as `/opt/homebrew` does here (L4). The flags that matter (`ttyd --help`, L4):
  - `-i 127.0.0.1`: bind to loopback only;
  - `-W`: let clients type (ttyd is read-only by default);
  - `-O`: reject WebSocket connections from other origins;
  - `-m N`: cap the number of clients;
  - `-t key=value`: client options.
- **Client options.** ttyd 1.7.7 accepts `rendererType` = `dom`, `canvas` or `webgl`, and passes any other key to xterm.js `terminal.options`. Options come from `-t` or from the URL query ([`html/src/components/terminal/xterm/index.ts`](https://github.com/tsl0922/ttyd/blob/1.7.7/html/src/components/terminal/xterm/index.ts), `applyPreferences` and `parseOptsFromUrlQuery`).
- **Reaching `http://127.0.0.1:<port>` from the browser surface.** Without a saved origin approval it fails (P2). With grant 1 it opens (P5).
- **Reading the terminal.** With `?rendererType=dom&screenReaderMode=true`, the accessibility tree lists every terminal row as text, for example `22 text ~ … NVIM v0.11.2` and `53 text [No Name] … 0,0-1 All` (P5, P6).
- **Typing into it.**
  - `typeText(':echo "qa-ok"')` did not reach Neovim; only Return arrived, announced as `^M` (P5).
  - The cause: xterm.js ignores `insertText` input events while screen-reader mode is on. Its `_inputEvent` handles them only when `!this.optionsService.rawOptions.screenReaderMode` ([xterm.js 5.5.0 `src/browser/Terminal.ts` L1172-1176](https://github.com/xtermjs/xterm.js/blob/5.5.0/src/browser/Terminal.ts#L1172-L1176); ttyd 1.7.7 depends on `@xterm/xterm` `^5.4.0`, `html/package.json`).
  - Sending one key at a time with `pressKey` works: the screenshot showed `qa-ok` on the bottom line, and a second accessibility read showed row `54 text qa-ok`. The first read, taken right away, still showed `:` (P6).
- **A pitfall seen in P6.** With `-m 1`, navigating the same tab again was refused while the old socket was still open ("refuse to serve WS client due to the --max-clients option"; the page showed "Press ⏎ to Reconnect"). So the `typeText` test with screen-reader mode off stayed inconclusive. Use a fresh ttyd per case or allow two clients.
- **Safety.**
  - Neovim has no restricted mode. `-Z` was removed ([neovim PR #11996](https://github.com/neovim/neovim/pull/11996), cited in `runtime/doc/dev_vimpatch.txt`), and `nvim -Z` fails with `Unknown option argument: "-Z"` (L4).
  - Whoever types into a web terminal that hosts Neovim therefore has a general shell (`:!`, `:terminal`, `:lua os.execute()`). A ttyd started outside the Codex sandbox hands astra an unsandboxed shell, which is the capability the terminal block withholds.
  - Mitigations: bind to 127.0.0.1, `-O`, a fixed port, a short lifetime, and an approval for that one origin only.
  - Better: let astra start ttyd inside its own sandbox, so the IDE and everything it spawns stay sandboxed. That needs grant 2 and was not tested (Appendix C).
- **Determinism and cost.** Each step needs an accessibility read or a screenshot, so it costs time and model tokens. Accessibility reads can lag the screen (P6), and pixels depend on the window size: the probe terminal was about 180×50 cells.

### 2c. Text-only QA through the shell (tmux, `script`, `expect`)

- **Locally, tmux works.** `new-session -d -x 80 -y 12 'nvim --clean'`, then `send-keys ':echo "qa-ok"' Enter`, then `capture-pane -p` returned the Neovim screen with `qa-ok` on the last line (L1).
- **In astra's sandbox, tmux needs grant 2.**
  - Read-only run: `error creating /private/tmp/tmux-501/astra-qa (Operation not permitted)` (P3).
  - `--write` with network off, socket inside the workspace: `error creating …/.tmp/astra-qa.sock (Operation not permitted)` (P4).
  - `--write` with network on: `new-session` returns `exit=0`, and `capture-pane -p` prints the 12-row screen ending in `[No Name] … 0,0-1 All` and `qa-ok`. The default socket directory works too (P8).
- **`exec_command` runs commands in a PTY.** Its description: "Runs a command in a PTY, returning output or a session ID for ongoing interaction"; `write_stdin` types into that session (tool list in the S0 rollout). astra can therefore start a TUI without tmux, but it gets a raw output stream, not a screen. A terminal-emulator library (for example pyte or `@xterm/headless`) would have to be installed beforehand. Not tested.
- **`script` and `expect`** exist on macOS (`/usr/bin/script`, `/usr/bin/expect`). They also give streams, not screens.
- **Pixels without computer use.** `capture-pane -e` keeps colours as escape sequences. The charmbracelet/freeze README shows "`tmux capture-pane -pet 1 | freeze -c full`" and PNG, SVG and WebP output ([charmbracelet/freeze](https://github.com/charmbracelet/freeze); `brew install charmbracelet/tap/freeze`). astra could open the image with its `view_image` tool. Not tested.

### 2d. A headless Neovim UI as the screen

- **One process, no socket: works in the default read-only run.**
  - `nvim --headless --clean -S screendump.lua` feeds `:echo "qa-ok"<CR>` with `nvim_input()`, then prints every grid row with `screenstring()` (P3; identical to L2; script in Appendix B).
  - The sandbox adds only log noise: "Failed to start server: operation not permitted: /tmp/nvim.20409.0".
  - `screenstring()` is "mainly to be used for testing" (`runtime/doc/builtin.txt`). A headless instance has an 80×24 grid (L3).
  - The dump includes floating windows with their borders and the contents of `:terminal` buffers (L5). Those are the pieces cland's chat panel and harness panes would use.
- **An RPC socket (`--listen`, then `--remote-send` and `--remote-expr`).** It works locally (L3). In the sandbox it needs grant 2: without it, `nvim: Failed to --listen: operation not permitted` (P4); with it, `servername=…/.tmp/nv.sock` (P8).
- **`nvim --embed` plus `nvim_ui_attach`, the full UI protocol.**
  - What it is: `--embed` "Waits for the client ("embedder") to call nvim_ui_attach() before sourcing startup files" (`runtime/doc/starting.txt`). `nvim_ui_attach` is the "Entry point of all UI clients" (`runtime/doc/api.txt`). The `ext_linegrid` option emits one `grid_line` event per updated line (`runtime/doc/ui.txt`, `ui-linegrid`).
  - Why it helps: a client applying those events holds an exact cell grid with highlights. It runs over stdio, so it needs no socket.
  - Precedent: Neovim's own functional tests do this ([`test/functional/ui/screen.lua` at v0.12.5](https://github.com/neovim/neovim/blob/v0.12.5/test/functional/ui/screen.lua): `Screen:attach`, `Screen:expect`, `ext_linegrid` on by default).
  - Status: not exercised here.
- **What a grid dump misses.** It does not see the terminal layer: key encoding (for example Shift+Enter), escape-sequence behaviour in a real emulator, or anything the host terminal draws. tmux and the web terminal cover that layer.

### 2e. Harness-level QA without a screen

- **The state to assert on already exists.** Ticket #3 found that each harness exposes session state that does not come from the model:
  - Codex app-server `thread/status/changed`;
  - OpenCode SSE events plus `GET /api/session/active`;
  - Claude Code hooks plus `claude agents --json`.
  - Source: `docs/research/harness-surfaces.md` on branch `research/harness-surfaces`, summarised in the map's "Decisions so far".
- **How a case would run.** cland's hub is to own that state (map Notes: "from a reliable source, not from the model's self-report"). A QA case drives sessions through the hub and asserts on state changes, topic statuses and asks, with no screen. This is the cheapest and most deterministic layer, and the only one that checks coordination logic rather than rendering.
- **What it needs in the sandbox, after ADR 0003.**
  - ADR 0003, which landed on `main` during this research, fixes the shape: the hub is a per-project daemon separate from the Neovim UI, "The Neovim UI talks to the hub over a Unix socket", and "The hub binds 127.0.0.1 and a Unix socket only" (`docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`).
  - Inside astra's sandbox with network off, a process can neither bind a Unix socket (observed in P4) nor connect to one (the Seatbelt rules in 1.4 deny `network-outbound` to Unix sockets). A real cland (UI plus hub) therefore cannot run inside a default QA session.
  - Starting the hub outside the sandbox does not help, because the sandboxed UI still cannot connect to its socket.
  - So either the QA session gets grant 2 (or a narrower socket allowlist), or cland offers a QA transport with no socket. One example: `cland --headless --qa` spawns the hub as a child process and speaks the same JSON-line frames over its stdin and stdout.

## 3. What `/codex:rescue` needs from the environment

- **Invocation.**
  - The user runs `/codex:rescue [--background|--wait] --fresh --model gpt-6-astra <task>`.
  - The rescue agent then runs one Bash command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task [--write] --model gpt-6-astra '<task text>'`. That command line was observed in the process list during P3.
  - `--resume` becomes `--resume-last`, and `--fresh` adds nothing (`PLUGIN/agents/codex-rescue.md`).
  - Without either flag, `/codex:rescue` first looks for a resumable thread and asks the user (`PLUGIN/commands/rescue.md`), so QA runs should always say `--fresh`, or `--resume` on purpose.
- **Write or read-only.**
  - The rescue agent adds `--write` "unless the user explicitly asks for read-only behavior or only wants review, diagnosis, or research without edits" (`PLUGIN/agents/codex-rescue.md`, `PLUGIN/skills/codex-cli-runtime/SKILL.md`).
  - `--write` selects `workspace-write`; otherwise the thread is `read-only` (`codex-companion.mjs` L491).
  - What each QA surface needs:

    | Surface | Read-only run | `--write`, network off (default) | `--write`, network on (grant 2) |
    | --- | --- | --- | --- |
    | headless Neovim dump (one process) | works (P3) | works | works |
    | evidence files in the workspace | blocked | works (P4) | works |
    | tmux, `nvim --listen`, local servers | blocked (P3) | blocked (P4) | works (P8) |
    | the browser through `cua_repl` | needs a saved origin approval (P2, P5), not the sandbox | same | same |

- **Approvals are impossible.** Approval policy `never`, Codex's auto-rejection of elicitations, and the plugin client's -32601 replies (section 1.4) add up to:
  - no desktop app can be approved;
  - no browser origin can be approved unless it was saved beforehand;
  - `exec_command`'s `sandbox_permissions: "require_escalated"` cannot be escalated;
  - `request_user_input` gets no answer.
  - A QA brief must therefore be self-contained, and every permission must be in place before the run.
- **How long a run may take.**
  - The companion sets no turn timeout, but a foreground rescue is one Bash command inside the rescue agent.
  - Claude Code gives a foreground command 2 minutes by default and at most 10. At the timeout the command moves to the background, but "a foreground subagent's moved command still stops when that subagent's run ends" ([tools reference](https://code.claude.com/docs/en/tools-reference); [env vars](https://code.claude.com/docs/en/env-vars): `BASH_DEFAULT_TIMEOUT_MS` 120000, `BASH_MAX_TIMEOUT_MS` 600000).
  - Longer QA runs should therefore use `--background`. The companion then starts a detached worker (`spawn(…, { detached: true })`, `codex-companion.mjs` L670-680). Check it with `/codex:status <job> [--wait]` (the wait defaults to 240 s, L69) and read it with `/codex:result <job>`.
  - The foreground probes took between 1 min 11 s and 3 min 23 s (Appendix A).
- **How results come back.**
  - The companion's stdout, returned verbatim by the rescue agent.
  - A job record and log under `STATE/<repo-basename>-<16 hex chars of sha256(path)>/jobs/task-*.json|.log` (`PLUGIN/scripts/lib/state.mjs`), holding status, `threadId`, `turnId`, `result.rawOutput` and `touchedFiles`.
  - The full transcript, `~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<threadId>.jsonl`. It contains `turn_context` (model, effort, approval and sandbox policy) and every `function_call`, including the JavaScript sent to `mcp__cua_repl.js`, with outputs and screenshots as base64 images. All of that was extracted for this report.
  - The rollout is the audit trail of a QA verdict, so a report should cite its `threadId`.
- **Passing a QA brief.**
  - The rescue agent forwards the task text but may "tighten" it with its prompting skill (`PLUGIN/agents/codex-rescue.md`). The companion accepts `--prompt-file` (`codex-companion.mjs` L644-645, L764), but the rescue agent does not offer it.
  - Better: put the brief in a file in the repo and send a one-line task: "Run the QA brief in `qa/briefs/<item>.md` exactly". astra can read the whole filesystem (profile root `read`), and its cwd is the session's working tree (`cwd` in every probe was the research worktree).
  - Keep the one-liner plain. In P4 the rescue agent's first Bash attempt was refused by the worktree guard, because a heredoc plus the word "gitignored" looked like an unverifiable git command (its note in Appendix A).
  - In P7, the Claude Code auto-mode classifier refused the forwarding call itself ("[Exfil Scouting]"). That task combined network-enabled sandbox checks with a TCP listener and scripts the agent had not read.
- **What the rescue agent strips or forbids.** It is a thin forwarder that makes exactly one `task` call. It must not inspect the repo, poll, fetch results or cancel jobs. It returns stdout verbatim, or nothing if Codex cannot be invoked. It strips `--background`, `--wait`, `--resume` and `--fresh`, and passes `--model` and `--effort` through (`PLUGIN/commands/rescue.md`, `PLUGIN/agents/codex-rescue.md`, `PLUGIN/skills/codex-cli-runtime/SKILL.md`).

## 4. What cland must provide to be testable

These are requirements inferred from sections 1-3, not decisions.

1. **A deterministic launch.** A QA entry point (for example `cland --qa`) that:
   - pins `NVIM_APPNAME=cland-qa`, which isolates config, data, state and cache completely (ticket #4 findings);
   - loads the IDE config from the repo and nothing from the user;
   - fixes the grid size (`&columns`/`&lines`, or tmux `-x`/`-y`) and pins `TERM`, `LANG` and `TZ`;
   - turns off animations, cursor blink and timers that redraw;
   - takes ports from the caller, with 47614 reserved for the web terminal (the approved origin).
2. **Fixtures.**
   - Stub harnesses: fake `claude`, `codex` and `opencode` executables that emit scripted output and state events. They make cases repeatable, cost no model quota, and run in a sandbox without network.
   - Seeded topics, units of work, sessions and roles, plus a small fixture repo.
3. **A scripting entry point that needs no socket.** `cland --headless --qa <case.lua>` runs one case in one process, which works even in a read-only rescue run (P3). ADR 0003 puts a Unix socket between the UI and the hub, so in QA mode that link needs a stdio transport (the hub as a child process, same frames). Otherwise every QA run needs grant 2. The entry point needs a small Lua QA API:
   - `keys()` over `nvim_input()`;
   - `wait_for(predicate, timeout)`;
   - `screen()` over `screenstring()`;
   - `state()`;
   - assertion helpers;
   - an exit code that is the verdict.
   An `--embed` client using `nvim_ui_attach` can come later, for assertions on highlights.
4. **Observable state.** A JSON snapshot of what the hub knows:
   - sessions with their state (idle, busy, waiting for the human, waiting for approval), taken from the harness, not the model;
   - roles, topics with their status, and open asks.
   It should be readable in process (the QA API) and as a file, so tmux and web-terminal runs can check it too.
5. **Screen capture hooks.**
   - A command (for example `:ClandQaDump <path>`) that writes the grid as text, and optionally highlights as JSON, in any run mode.
   - A stable layout: no random identifiers on screen, deterministic sort orders, and a fixed terminal size for visual runs.
6. **A web-terminal launcher for visual cases.** It starts ttyd as `ttyd -i 127.0.0.1 -p 47614 -W -O -t disableLeaveAlert=true <cland QA entry point>`, one instance per case, and stops it afterwards. A shared ttyd with `-m 1` refuses a page reload while the old socket is still open (P6). The launcher should run inside the QA session's sandbox once that is verified.
7. **An evidence location.** `.scratch/qa/<item>/<run>/` (ignored by git) for captures, screenshots and `runs.jsonl`.

## 5. How QA verdicts get recorded

- **BCAS precedent.**
  - Verification verdicts are exit codes recorded in `.scratch/<epic>/runs.jsonl`, and QA walks the dev stand with Computer Use (section 5 of `docs/research/bcas-hub.md` on branch `research/bcas-hub`).
  - BCAS's QA journal (`/Users/evgeniyivanov/Projects/BratvaInc/bcas/qa/README.md`) fixes the rest:
    - Cases have stable IDs such as `P-SHELL-001`, with preconditions, steps, a visible expected result, `since` and `regression`.
    - Dated outcomes go into `qa/runs.md` (date, build and source, scope, cases, result, evidence).
    - Each case gets PASS, finding or INCONCLUSIVE, with BLOCKED and NOT ACCEPTED also in use.
    - The report is posted on the assigned issue, with build, method, case results, finding links, screenshots and a scoped verdict.
    - Findings are filed as issues labelled `qa-found` and `needs-triage`, with screenshots attached by `gh issue comment --attach` (supported by the local gh 2.102.0: "Use `--attach` to upload an image or video").
    - The report records the method actually used, for example "Computer Use, screenshots inspected" or the Playwright fallback.
  - A BCAS reviewer posts nothing on GitHub; the coordinator relays (`docs/research/bcas-hub.md` §5).
- **The vocabulary is now fixed.** `GLOSSARY.md` on `main` defines a **Verdict** as "A structured comment on an item that records the result of a review or a QA run: clear or not clear, by which session and role, from which run". The QA role "exercises the running product and returns a verdict to the Coordinator". ADR 0002 makes the tracker one Markdown file per item, written through the hub, and lists "verdict records" among what it must hold (`docs/adr/0002-tracker-files-are-the-source-of-truth.md`).
- **Proposal, consistent with BCAS and with those terms.**
  - **Case catalogue:** `qa/cases/<AREA>-<NNN>.md` in the repo, in BCAS's format, with stable IDs.
  - **Run log:** one JSON line per case and run in `.scratch/qa/<item>/runs.jsonl`:

    ```json
    {"ts":"2026-10-07T17:00:00Z","item":"#123","run":"r1","case":"CHAT-001","build":"<sha>","surface":"headless-grid","method":"cland --headless --qa qa/cases/CHAT-001.lua","result":"PASS","exit_code":0,"evidence":[".scratch/qa/123/r1/CHAT-001.screen.txt"],"session":"astra","codex_thread":"<threadId>","companion_job":"<job id>"}
    ```

    `surface` is one of `headless-grid`, `tmux`, `web-terminal` or `hub-api`. A case `result` is one of PASS, FAIL, INCONCLUSIVE or BLOCKED.
  - **Verdict:** astra's final message carries it. The run's verdict is clear only when every case in scope passed; anything else is not clear, with the reasons.
    - **While cland is being built** (the tracker is GitHub Issues, `docs/agents/issue-tracker.md`), the Coordinator posts the verdict as a structured comment on the item's issue, headed `## QA verdict: clear` or `## QA verdict: not clear`. The comment names the session (astra, with its Codex thread ID), the role (QA) and the run (companion job and `runs.jsonl` run id). It also gives the build SHA, the surface and method, a case table, and evidence: text captures inline, images attached with `gh issue comment --attach`.
    - **In the product,** the same structure becomes a verdict record on the item's Markdown file, written through the hub (ADR 0002). The QA role's verdict goes back to the Coordinator (ADR 0001, glossary). A topic bound to the unit of work can show it.
  - **Findings:** each finding becomes a new item labelled `qa-found` and `needs-triage`, as in BCAS.
  - **Who writes:** the Coordinator, not astra. astra cannot reach GitHub from a network-off sandbox, and it cannot get approvals. If evidence files are needed, the run must be `--write`, with the files under `.scratch/qa/`.

## Comparison of surfaces

| Surface | Works through `/codex:rescue`? | Determinism | What cland must add | Cost per check |
| --- | --- | --- | --- | --- |
| Native terminal app through computer use | No. Forbidden for safety, and no setting lifts it (P1, docs) | – | Nothing helps | – |
| Desktop app with a built-in terminal (Zed, VS Code) | No. Approval is impossible in the chain (P1), and it defeats the terminal block | – | Not recommended | – |
| Web terminal (ttyd) in Chrome | Yes, with grant 1. Keys go one at a time; rows are readable in the accessibility tree (P5, P6) | Medium: pixels, lagging accessibility reads, window-dependent size | Web-terminal launcher, fixed port 47614, fixed size; ideally started in the sandbox | High: a screenshot or accessibility read plus model tokens per step |
| tmux plus `capture-pane` in astra's shell | Yes, with grant 2 and `--write` (P8); blocked otherwise (P3, P4) | High: a text grid of the real TUI | QA launch mode, fixed size and env, stub harnesses | Low |
| Headless Neovim grid dump (one process) | Yes, with no grant, even read-only (P3); for the real cland only if the UI-to-hub link avoids sockets (ADR 0003) | Highest: exact grid, no emulator in between | `cland --headless --qa`, a stdio hub transport, a Lua QA API, a state snapshot | Lowest |
| `--embed` plus `nvim_ui_attach` client | Plausible with no grant: stdio, no socket (not tested) | Highest, including highlights | A small UI client | Low |
| Hub or harness API | Yes, if run in process; sockets need grant 2 | Highest, for state | Hub QA entry point, fixtures | Lowest |

## Recommended QA setup to try

This is a recommendation backed by the evidence above, not a decision.

1. **Default lane: headless grid, no grant.**
   - cland ships `cland --headless --qa <case.lua>` with the QA API of section 4, stub harnesses and a state snapshot.
   - The hub is reached over stdio in this mode, because ADR 0003's Unix socket is blocked in a default sandbox.
   - The coordinator writes a brief file and runs `/codex:rescue --background --fresh --model gpt-6-astra "Run the QA brief in qa/briefs/<item>.md exactly"`, then `/codex:status` and `/codex:result`.
   - astra runs the cases with shell commands and returns the report.
   - Evidence: the P3 mechanics.
2. **Real-TUI lane: tmux, with grant 2, only when a case needs the terminal layer** (keys, escape sequences, the TUI itself).
   - astra starts `cland --qa` in tmux with a socket under `.tmp/`, drives it with `send-keys`, reads it with `capture-pane -p`, or `-e` for colours, and kills the server at the end.
   - Turn grant 2 on for these runs and off afterwards.
   - Evidence: P8.
3. **Visual lane: ttyd in Chrome, with grant 1, only for cases about appearance.**
   - The launcher starts ttyd on 127.0.0.1:47614 for one case.
   - astra opens `http://127.0.0.1:47614/?rendererType=dom&screenReaderMode=true`, types with one `pressKey` per key, reads rows from `getAXState()`, re-reading until the accessibility tree settles, and judges visuals from `getScreenshot()`.
   - Pre-approve terminal typing in the brief: confirmation category [16].
   - Evidence: P5 and P6.
4. **Coordination lane: hub state.** The same headless entry point asserts on session states, topic statuses and asks, with no screen.
5. **Recording:** section 5. astra returns the verdict, and the Coordinator posts it on the item, appends `runs.jsonl` and files findings.
6. **Follow-ups worth one probe each.**
   - ttyd started by astra inside its own sandbox (needs grant 2).
   - An `--embed` UI client.
   - freeze screenshots of `capture-pane -e` output, viewed with `view_image`.

### Permissions and settings

| Item | Status | Needed for | Advice |
| --- | --- | --- | --- |
| **Grant 1.** In `~/.codex/browser/config.toml`, `[origins] allowed` includes `"http://127.0.0.1:47614"`. Equivalents: "Allow for this site" in the app, or Settings > Computer Use > Manage (Chrome). | Applied by the coordinator with the user's approval (backup `~/.codex/browser/config.toml.bak-cland-20261007`); verified by P5 and P6 | The web-terminal lane only | **Keep.** It is narrow: one local origin. Keep port 47614 reserved for the QA web terminal, because any service listening there is reachable by any Chrome-driving agent without a prompt. |
| **Grant 2.** In `~/.codex/config.toml`, `[sandbox_workspace_write]` `network_access = true`. | Applied by the coordinator with the user's approval (backup `~/.codex/config.toml.bak-cland-20261007`); verified by P8 | tmux, `nvim --listen`, local servers in astra's sandbox | **Revert after QA runs, or enable only for them.** It widens every `--write` Codex run on this machine, including sol reviews and ChatGPT-app Codex tasks: outbound network plus socket servers. The default QA lane does not need it. A narrower option, a permission-profile `unix_sockets` allowlist, exists in the source but is untested. |
| macOS Accessibility and Screen Recording for "Codex Computer Use" | Not needed | Desktop-app computer use only | Granting them does not unblock terminals. |
| `computer_use.macos.bundle_ids` / `computer_use.default_app_access` | Not useful here | Pre-allowing desktop apps | `allow` "still requires … the normal approval flow", which the rescue chain cannot complete, and terminals stay forbidden. |
| Plugin change (approval policy) | Not proposed | – | The companion hard-codes `approvalPolicy: "never"` (`codex.mjs` L67). Changing the plugin is outside the sanctioned chain. |
| ttyd (Homebrew) | Installed during this research and left installed | The web-terminal lane | Remove with `brew uninstall ttyd libwebsockets json-c` if unwanted. The install also upgraded openssl@3, libevent and libuv. |

## Appendix A: probes

Every probe was sent with the Agent tool as `subagent_type: "codex:codex-rescue"`. The prompt below is the exact text given to that agent; Codex received the same text minus the routing flags (checked against each rollout's first user message). "Output" is Codex's final message (`result.rawOutput` in the job record), returned by the rescue agent verbatim. Three kinds of editing were applied:
- Long repeated blocks are shortened where marked `[…]`.
- For P3, P4 and P8, the answer's Markdown layout (one fenced block per step) is flattened to one entry per command. Commands, exit codes and output lines are unchanged.
- For P5 and P6, the code and results of each call are verbatim and only the surrounding layout is condensed.

The full text of every probe is in the rollout named for it.

### P1: app policy map (read-only)

- Job `task-muycec9y-5j474k`, thread `01a11744-eacc-7cf2-973e-fe9c4667e93d`, 2 min 01 s, `read-only`. Rollout: `~/.codex/sessions/2026/10/07/rollout-2026-10-07T18-49-15-01a11744-eacc-7cf2-973e-fe9c4667e93d.jsonl`.
- Prompt:

  ```text
  --fresh --model gpt-6-astra Read-only probe for a research ticket: do not edit any file and do not run shell commands. Use only the mcp__cua_repl js tool. Goal: map which macOS apps Computer Use may open, and which browsers it can drive. Steps: (1) As your first cua_repl call, alone, run `await cua.getState();` and report the browsers (id, name, type) and the app list exactly as returned. (2) Then, in SEPARATE cua_repl calls, one app per call and in this order, run `try { await cua.getApp(ID); nodeRepl.write("OK"); } catch (e) { nodeRepl.write("ERR: " + String((e && e.message) || e)); }` with ID = "com.apple.Terminal", "com.googlecode.iterm2", "org.alacritty", "net.kovidgoyal.kitty", "com.github.wez.wezterm", "dev.warp.Warp-Stable", "com.mitchellh.ghostty", "dev.zed.Zed", "com.apple.finder". Do not click, type, scroll, press keys or perform any other action in any app; if a getApp call succeeds, do not interact with that app and do not copy its window contents into your answer, just record OK. (3) Run `await cua.listBrowsers();` and report the result. Final answer: a table "app id -> verbatim result text" for step 2, plus the verbatim outputs of steps 1 and 3 (browsers part in full; app list in full).
  ```

- Output:

  ````text
  Step 1 — verbatim inventory output:

  ```json
  {"apps":[{"displayName":"Arc","id":"company.thebrowser.Browser","isRunning":true,"lastUsedDate":813024000,"useCount":50},{"displayName":"Ghostty","id":"com.mitchellh.ghostty","isRunning":true,"lastUsedDate":813024000,"useCount":341},{"displayName":"Zed","id":"dev.zed.Zed","isRunning":true,"lastUsedDate":813024000,"useCount":32},{"displayName":"Google Chrome","id":"com.google.Chrome","isRunning":true,"lastUsedDate":812678400,"useCount":90},{"displayName":"Finder","id":"com.apple.finder","isRunning":true},{"displayName":"TeamViewer","id":"com.teamviewer.TeamViewer","isRunning":true},{"displayName":"tldv","id":"io.tldv.desktop","isRunning":false,"lastUsedDate":812937600,"useCount":7},{"displayName":"System Settings","id":"com.apple.systempreferences","isRunning":false,"lastUsedDate":812851200,"useCount":2},{"displayName":"ChatGPT","id":"com.openai.codex","isRunning":false,"lastUsedDate":812592000,"useCount":3},{"displayName":"Visual Studio Code","id":"com.microsoft.VSCode","isRunning":false,"lastUsedDate":812592000,"useCount":2}],"browsers":[{"family":"chrome","id":"1","metadata":{"extensionInstanceId":"ed73ead1-23cb-400d-8418-7ce2348b11cf"},"name":"Chrome","type":"extension","tabs":[{"id":"1158676208","lastOpened":"2026-10-07T16:31:54.351Z","providerTabId":"[\"9a0e92d4-f7aa-4930-b86c-ba5dc1b0bb89\",\"1158676208\"]","title":"about:blank","url":"about:blank"}]}]}
  ```

  Step 2:

  | app id | verbatim result text |
  |---|---|
  | com.apple.Terminal | ERR: Computer Use is not allowed to use the app 'com.apple.Terminal' for safety reasons. |
  | com.googlecode.iterm2 | ERR: Computer Use is not allowed to use the app 'com.googlecode.iterm2' for safety reasons. |
  | org.alacritty | ERR: Invalid app: org.alacritty |
  | net.kovidgoyal.kitty | ERR: Computer Use is not allowed to use the app 'net.kovidgoyal.kitty' for safety reasons. |
  | com.github.wez.wezterm | ERR: Computer Use is not allowed to use the app 'com.github.wez.wezterm' for safety reasons. |
  | dev.warp.Warp-Stable | ERR: Computer Use is not allowed to use the app 'dev.warp.Warp-Stable' for safety reasons. |
  | com.mitchellh.ghostty | ERR: Computer Use is not allowed to use the app 'com.mitchellh.ghostty' for safety reasons. |
  | dev.zed.Zed | ERR: Computer Use was not approved to use Zed |
  | com.apple.finder | ERR: Computer Use was not approved to use Finder |

  Step 3 — verbatim output:

  ```json
  [{"family":"chrome","id":"1","metadata":{"extensionInstanceId":"ed73ead1-23cb-400d-8418-7ce2348b11cf"},"name":"Chrome","type":"extension"}]
  ```
  ````

- Rollout check: each `getApp` call returned in 8–17 ms. The two "not approved" errors came back without any prompt.

### P2: localhost page in the browser (read-only, before grant 1)

- Job `task-muyciuev-jufk3b`, thread `01a11748-1f4e-75c3-af15-be026fc480d5`, 1 min 11 s, `read-only`. Rollout: `…/rollout-2026-10-07T18-52-45-01a11748-1f4e-75c3-af15-be026fc480d5.jsonl`.
- Setup: `python3 -m http.server 47613 --bind 127.0.0.1` served a page containing `probe-token: astra-localhost-7f3c9` (L4).
- Prompt:

  ```text
  --fresh --model gpt-6-astra Read-only probe for a research ticket: do not edit any file and do not run shell commands. Use only the mcp__cua_repl js tool. A local web server is serving a small test page at http://127.0.0.1:47613/ (it was started on purpose for this probe). Steps: (1) As your first cua_repl call, alone, run `await cua.getState();`. (2) Try the in-app browser: `try { globalThis.t1 = await cua.createBrowserTab("iab", "http://127.0.0.1:47613/", { visible: true }); nodeRepl.write("OK"); } catch (e) { nodeRepl.write("ERR: " + String((e && e.message) || e)); }` and record the verbatim result. (3) If step 2 failed, open the same URL in Chrome: `try { globalThis.t2 = await cua.createBrowserTab("chrome", "http://127.0.0.1:47613/", { sessionName: "🧪 cland QA probe" }); nodeRepl.write("OK"); } catch (e) { nodeRepl.write("ERR: " + String((e && e.message) || e)); }` and record the verbatim result. (4) On the tab that opened, read the page title and all visible text from the accessibility state (it contains a line starting with "probe-token:"), then take exactly one screenshot with getScreenshot() and describe what it shows. (5) Close the tab you opened with close(). Final answer: every call you made with its verbatim result or error, the page title, the exact probe-token line, and the screenshot description.
  ```

- Output (companion stdout including its progress lines; the state JSON is the same as P1's and is shortened):

  ````text
  [codex] Starting Codex task thread.
  [codex] Thread ready (01a11748-1f4e-75c3-af15-be026fc480d5).
  [codex] Turn started (01a11748-21b8-72d0-bd97-7acc0561d740).
  [codex] Assistant message captured: I'll follow the probe steps using only `mcp__cua_repl`, record the results, and close the tab...
  [codex] Calling cua_repl/js.
  [codex] Tool cua_repl/js completed.
  [codex] Calling cua_repl/js.
  [codex] Tool cua_repl/js completed.
  [codex] Calling cua_repl/js.
  [codex] Tool cua_repl/js completed.
  [codex] Assistant message captured: The probe stopped after both browser-opening attempts failed. No tab opened, so the page titl...
  [codex] Turn completed.
  The probe stopped after both browser-opening attempts failed. No tab opened, so the page title, visible text, and `probe-token:` line were unavailable. No screenshot was taken, and there was no opened tab to close.

  1. Call:
  ```js
  await cua.getState();
  ```
  Verbatim state result (excluding the tool's API documentation):
  ```json
  {"apps":[…same as P1…],"browsers":[{"family":"chrome","id":"1",…,"name":"Chrome","type":"extension","tabs":[{"id":"1158676208",…,"title":"about:blank","url":"about:blank"}]}]}
  ```

  2. Call:
  ```js
  try { globalThis.t1 = await cua.createBrowserTab("iab", "http://127.0.0.1:47613/", { visible: true }); nodeRepl.write("OK"); } catch (e) { nodeRepl.write("ERR: " + String((e && e.message) || e)); }
  ```
  Verbatim result:
  ```text
  ERR: Browser is not available: iab
  ```

  3. Call:
  ```js
  try { globalThis.t2 = await cua.createBrowserTab("chrome", "http://127.0.0.1:47613/", { sessionName: "🧪 cland QA probe" }); nodeRepl.write("OK"); } catch (e) { nodeRepl.write("ERR: " + String((e && e.message) || e)); }
  ```
  Verbatim result:
  ```text
  ERR: Browser Use rejected this action due to browser security policy. Reason: The user declined permission for this action. Browser use cannot access http://127.0.0.1:47613 because the user denied permission for this request. The agent must not attempt to achieve the same outcome via workaround, indirect execution, raw CDP or browser commands, alternate browser surfaces, or policy circumvention. Proceed only with a materially safer alternative that does not require this blocked browser action; if none exists, stop and request user input.
  ```

  These were the only three calls. No files were edited and no shell commands were run.

  The browser's automatic approval review rejected opening the local URL, reporting that permission was denied. That rejection prevents completing the remaining steps in this run.
  ````

- The page server's log shows no request from Chrome; the only hit is the author's own `curl` (L4).

### P3: tmux and headless Neovim (read-only)

- Job `task-muycpogn-0zmts6`, thread `01a1174c-fcf0-72e1-856d-d08e3e711876`, 1 min 16 s, `read-only`. Rollout: `…/rollout-2026-10-07T18-58-04-01a1174c-fcf0-72e1-856d-d08e3e711876.jsonl`.
- Prompt:

  ```text
  --fresh --model gpt-6-astra Read-only probe for a research ticket: do not edit any repository file and do not use computer use (no mcp__cua_repl). Use only shell commands through exec_command, and run them exactly as written, one per exec_command call, reporting each command's exit code and verbatim output or error. (1) `tmux -V` (2) `echo "TMPDIR=$TMPDIR"; id -u; ls -ld /private/tmp/tmux-$(id -u) 2>&1` (3) `tmux -L astra-qa new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` (4) `tmux -L astra-qa send-keys -t qa ':echo "qa-ok"' Enter; echo "exit=$?"` (5) `sleep 1; tmux -L astra-qa capture-pane -p -t qa; echo "exit=$?"` (6) `tmux -L astra-qa kill-server; echo "exit=$?"` (7) `nvim --headless --clean -S /private/tmp/claude-501/-Users-evgeniyivanov-Projects-cland-v0/ecb185e4-0f31-44e5-9c73-0e8055aa05e4/scratchpad/screendump.lua; echo "exit=$?"` (that Lua file feeds `:echo "qa-ok"` into the headless Neovim and prints its screen grid; read it first if you want). If a step fails, still run the remaining steps. Final answer: a numbered list with each command, its exit code and its verbatim output (full capture-pane and screen-dump text), then one sentence on whether the sandbox blocked anything and with which error.
  ```

- Output (the repeated `ERR`/`WRN` log lines of step 7 are shortened):

  ````text
  1. `tmux -V` — exit 0
     tmux 3.5a
  2. `echo "TMPDIR=$TMPDIR"; id -u; ls -ld /private/tmp/tmux-$(id -u) 2>&1` — exit 0
     TMPDIR=/var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/
     501
     drwx------@ 5 evgeniyivanov  wheel  160 Oct  7 18:58 /private/tmp/tmux-501
  3. `tmux -L astra-qa new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` — exit 0
     error creating /private/tmp/tmux-501/astra-qa (Operation not permitted)
     exit=0
  4. `tmux -L astra-qa send-keys -t qa ':echo "qa-ok"' Enter; echo "exit=$?"` — exit 0
     error connecting to /private/tmp/tmux-501/astra-qa (No such file or directory)
     exit=1
  5. `sleep 1; tmux -L astra-qa capture-pane -p -t qa; echo "exit=$?"` — exit 0
     error connecting to /private/tmp/tmux-501/astra-qa (No such file or directory)
     exit=1
  6. `tmux -L astra-qa kill-server; echo "exit=$?"` — exit 0
     error connecting to /private/tmp/tmux-501/astra-qa (No such file or directory)
     exit=1
  7. `nvim --headless --clean -S …/scratchpad/screendump.lua; echo "exit=$?"` — exit 0
     ERR 2026-10-07T18:58:40.860 ?.20409    open_log_file:230: failed to open $NVIM_LOG_FILE (Undefined error: 0):
     WRN 2026-10-07T18:58:40.860 ?.20409    vim_mktempdir:3325: tempdir create failed: operation not permitted: /var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/nvim.evgeniyivanov/XXXXXX
     […same pattern for /tmp, ./ and $HOME…]
     WRN 2026-10-07T18:58:40.862 ?.20409    server_start:193: Failed to start server: operation not permitted: /tmp/nvim.20409.0
     :echo "qa-ok"qa-ok
     ~
     ~
     ~
     ~
     ~                                 NVIM v0.11.2
     ~
     ~                 Nvim is open source and freely distributable
     ~                           https://neovim.io/#chat
     ~
     ~                type  :help nvim<Enter>       if you are new!
     ~                type  :checkhealth<Enter>     to optimize Nvim
     ~                type  :q<Enter>               to exit
     ~                type  :help<Enter>            for help
     ~
     ~               type  :help news<Enter> to see changes in v0.11
     ~
     ~                        Help poor children in Uganda!
     ~                type  :help iccf<Enter>       for information
     ~
     ~
     ~
     [No Name]                                                     0,0-1          All
     qa-ok
     exit=0

  The sandbox blocked tmux socket creation and Neovim temporary-directory/server creation with `Operation not permitted` / `operation not permitted`; subsequent tmux commands reported `No such file or directory`, while the headless screen dump completed.
  ````

### P4: tmux and an RPC socket (`--write`, network off)

- Job `task-muycukpt-xqbcqk`, thread `01a11750-793f-7690-8f0f-96f2c13e102c`, 3 min 23 s, `workspace-write` with `network_access: false`. Rollout: `…/rollout-2026-10-07T19-01-52-01a11750-793f-7690-8f0f-96f2c13e102c.jsonl`.
- Prompt:

  ```text
  --fresh --model gpt-6-astra Write-capable probe for a research ticket (a workspace-write run is intended). Do not use computer use (no mcp__cua_repl). Write only under ./.tmp/ in the current workspace (it is gitignored) and remove what you create there at the end; do not edit any other file. Run these shell commands exactly as written, one per exec_command call, and report each command's exit code and verbatim output or error; if a step fails, continue with the next. (1) `mkdir -p .tmp && echo "pwd=$PWD"` (2) `tmux -L astra-qa new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` (3) `tmux -S "$PWD/.tmp/astra-qa.sock" new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` (4) `tmux -S "$PWD/.tmp/astra-qa.sock" send-keys -t qa ':echo "qa-ok"' Enter; echo "exit=$?"` (5) `sleep 1; tmux -S "$PWD/.tmp/astra-qa.sock" capture-pane -p -t qa; echo "exit=$?"` (6) `tmux -S "$PWD/.tmp/astra-qa.sock" kill-server; echo "exit=$?"` (7) `tmux -L astra-qa kill-server 2>&1; echo "exit=$?"` (8) `bash /private/tmp/claude-501/-Users-evgeniyivanov-Projects-cland-v0/ecb185e4-0f31-44e5-9c73-0e8055aa05e4/scratchpad/rpc-dump.sh "$PWD/.tmp"; echo "exit=$?"` (that script starts `nvim --headless --listen` on a socket in the given directory, sends `:echo "qa-ok"` with --remote-send, prints the screen grid with --remote-expr, then quits Neovim) (9) `rm -f .tmp/astra-qa.sock; ls -la .tmp; pgrep -fl 'astra-qa|nv-qa' || echo "no leftover processes"`. Final answer: a numbered list with each command, its exit code and verbatim output (full capture-pane and screen text), then one sentence on what the sandbox allowed and blocked.
  ```

- Output:

  ````text
  1. `mkdir -p .tmp && echo "pwd=$PWD"` — exit 0
     pwd=/Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8
  2. `tmux -L astra-qa new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` — exit 0
     error creating /private/tmp/tmux-501/astra-qa (Operation not permitted)
     exit=0
  3. `tmux -S "$PWD/.tmp/astra-qa.sock" new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` — exit 0
     error creating /Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8/.tmp/astra-qa.sock (Operation not permitted)
     exit=0
  4. `tmux -S "$PWD/.tmp/astra-qa.sock" send-keys -t qa ':echo "qa-ok"' Enter; echo "exit=$?"` — exit 0
     error connecting to /Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8/.tmp/astra-qa.sock (No such file or directory)
     exit=1
  5. `sleep 1; tmux -S "$PWD/.tmp/astra-qa.sock" capture-pane -p -t qa; echo "exit=$?"` — exit 0
     error connecting to /Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8/.tmp/astra-qa.sock (No such file or directory)
     exit=1
  6. `tmux -S "$PWD/.tmp/astra-qa.sock" kill-server; echo "exit=$?"` — exit 0
     error connecting to /Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8/.tmp/astra-qa.sock (No such file or directory)
     exit=1
  7. `tmux -L astra-qa kill-server 2>&1; echo "exit=$?"` — exit 0
     error connecting to /private/tmp/tmux-501/astra-qa (No such file or directory)
     exit=1
  8. `bash …/scratchpad/rpc-dump.sh "$PWD/.tmp"; echo "exit=$?"` — exit 0
     socket not created: /Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8/.tmp/nv-qa.sock
     nvim: Failed to --listen: operation not permitted: "/Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8/.tmp/nv-qa.sock"
     More info with "nvim -h"
     exit=1
  9. `rm -f .tmp/astra-qa.sock; ls -la .tmp; pgrep -fl 'astra-qa|nv-qa' || echo "no leftover processes"`
     Exit code: unavailable; execution rejected.
     exec_command failed: CreateProcess { message: "Rejected(\"`/bin/zsh -lc \\\"rm -f .tmp/astra-qa.sock; ls -la .tmp; pgrep -fl 'astra-qa|nv-qa' || echo \\\\\\\"no leftover processes\\\\\\\"\\\"` rejected: rm -f style commands are not permitted. Use a safer approach\")" }

  No pane or screen text was produced. Separate cleanup removed `nv-qa.log` and the empty `.tmp` directory; a separate process check failed with `pgrep: Cannot get process list`, so leftover processes could not be verified.

  The sandbox allowed ordinary file creation and cleanup under `.tmp`, blocked socket creation, and could not provide process enumeration; automatic approval review rejected command 9 because `rm -f` commands are prohibited.
  ````

- The rescue agent's note: "my first Bash attempt was refused by the worktree git-command guard before it ran, so nothing reached Codex. The prompt contains the word "gitignored", and the heredoc form I used was too complex for the guard to verify. I resent the same task text as a single plain `node ... task --write --model gpt-6-astra '<text>'` command".
- Side effect, cleaned up by the author: Neovim fell back to writing `.nvimlog` in the worktree root ("Failed to start server: operation not permitted: …/.tmp/nv-qa.sock").

### P5: ttyd in Chrome after grant 1, with `typeText` (read-only)

- Job `task-muyd2f61-p2rda7`, thread `01a11756-0f23-7212-bb1c-c98afb011a33`, 2 min 01 s, `read-only`. Rollout: `…/rollout-2026-10-07T19-07-58-01a11756-0f23-7212-bb1c-c98afb011a33.jsonl`.
- Setup: `ttyd -i 127.0.0.1 -p 47614 -W -O -m 1 -w <scratchpad> -t disableLeaveAlert=true -t titleFixed=cland-qa-ttyd nvim --clean`, started by the author. Grant 1 was in place.
- Prompt:

  ```text
  --fresh --model gpt-6-astra Read-only probe for a research ticket: do not edit any file and do not run shell commands. Use only the mcp__cua_repl js tool. A ttyd web terminal running `nvim --clean` is serving at http://127.0.0.1:47614/ (started on purpose for this probe, bound to 127.0.0.1 only). The user pre-approves, for this probe only: opening that URL in Chrome, clicking into the web terminal, and typing the Neovim commands `:echo "qa-ok"` and `:qa!`, each followed by Return. Steps: (1) As your first cua_repl call, alone, run `await cua.getState();`. (2) Run `try { globalThis.t = await cua.createBrowserTab("chrome", "http://127.0.0.1:47614/?rendererType=dom&screenReaderMode=true", { sessionName: "🧪 cland QA ttyd" }); nodeRepl.write("OK"); } catch (e) { nodeRepl.write("ERR: " + String((e && e.message) || e)); }` and record the verbatim result. (3) If the tab opened: take one screenshot with getScreenshot() and describe it, then read getAXState() and report whether the Neovim screen text (for example "[No Name]" or "NVIM v0.11.2") appears in the accessibility text. (4) Click inside the terminal area, type `:echo "qa-ok"` with typeText, then pressKey("Return"). (5) Take one screenshot and read getAXState() again; report whether "qa-ok" is visible on the bottom line of the screenshot and whether it appears in the accessibility text. (6) Type `:qa!` with typeText, pressKey("Return"), then close the tab with close(). Final answer: every call with its verbatim result or error, both screenshot descriptions, and verbatim excerpts of the accessibility text that show the Neovim screen (only those lines).
  ```

- Output (the state JSON is the same as P1's and is shortened):

  ````text
  The tab opened successfully. Neovim appeared in both the first screenshot and accessibility text. After `:echo "qa-ok"` and Return, **`qa-ok` appeared in neither captured result**. The quit command was sent and the tab closed; Neovim's exit was not confirmed.

  Only `mcp__cua_repl` was used. Below are all five calls and their results; tool-injected API documentation is omitted, and accessibility captures are excerpted.

  1. First call: `await cua.getState();` → {"apps":[…same as P1…],"browsers":[…Chrome, type "extension"…]}

  2. Open call, exactly as requested:
  ```text
  Browser tab: 1158676250, Title: "cland-qa-ttyd", URL: "http://127.0.0.1:47614/?rendererType=dom&screenReaderMode=true".
  0 AXWebArea cland-qa-ttyd, URL: 127.0.0.1:47614/?rendererType=dom&screenReaderMode=true
  	1 container
  		2 content list
  		3 text Too much output to announce, navigate to rows manually to read
  		4 text field (settable) Terminal input

  The focused UI element is 4 text field (settable) Terminal inputOK
  ```

  3. Initial screenshot and accessibility call: `await t.getScreenshot(); await t.getAXState({ disableDiffing: true });`
  Screenshot result: a dark Neovim welcome screen with `NVIM v0.11.2` centered, help instructions below, tildes down the left, and `[No Name]` in the bottom status bar. The command line beneath it is empty.
  ```text
  			22 text ~                                                                                     NVIM v0.11.2
  			24 text ~                                                                     Nvim is open source and freely distributable
  			25 text ~                                                                               https://neovim.io/#chat
  			53 text [No Name]                                                                                                                                                             0,0-1          All
  ```

  4. Click, echo, screenshot, and accessibility call: `nodeRepl.write(await t.click([400, 500])); nodeRepl.write(await t.typeText(':echo "qa-ok"')); nodeRepl.write(await t.pressKey("Return")); await t.getScreenshot(); await t.getAXState({ disableDiffing: true });`
  The three action return values were emitted verbatim as: undefinedundefinedundefined
  Screenshot result: the same Neovim welcome screen and `[No Name]` status bar. **No `qa-ok` is visible on the bottom line.**
  ```text
  			22 text ~                                                                                     NVIM v0.11.2
  			53 text [No Name]                                                                                                                                                             0,0-1          All
  		54 text ^M
  ```
  **`qa-ok` does not appear in the accessibility text.**

  5. Quit and close call: `nodeRepl.write(await t.typeText(':qa!')); nodeRepl.write(await t.pressKey("Return")); await t.getAXState(); nodeRepl.write(await t.close());`
  ```text
  Browser tab: 1158676250, Title: "cland-qa-ttyd", URL: "http://127.0.0.1:47614/?rendererType=dom&screenReaderMode=true".
  There has been no change in the accessibility tree.
  The focused UI element is 4 text field (settable) Terminal inputundefinedundefinedundefined
  ```

  No call reported an error.
  ````

- ttyd's log for the run: `WS   /ws - 127.0.0.1, clients: 1`, `started process, pid: 31281`, then `WS closed from 127.0.0.1, clients: 0` and `killing process, pid: 31281`.

### P6: ttyd in Chrome, one key at a time (read-only)

- Job `task-muyd8w7t-artigr`, thread `01a1175a-aaf4-7721-a825-e75a7eb6ac0c`, 3 min 21 s, `read-only`. Rollout: `…/rollout-2026-10-07T19-13-01-01a1175a-aaf4-7721-a825-e75a7eb6ac0c.jsonl`. Same ttyd as P5.
- Prompt:

  ```text
  --fresh --model gpt-6-astra Read-only probe for a research ticket: do not edit any file and do not run shell commands. Use only the mcp__cua_repl js tool. A ttyd web terminal running `nvim --clean` is serving at http://127.0.0.1:47614/ (started on purpose, bound to 127.0.0.1). The user pre-approves, for this probe only: opening that URL in Chrome, clicking into the web terminal, and entering the Neovim commands `:echo "qa-ok"`, `:echo "typed-ok"` and `:qa!`, each followed by Return. Background: in a previous run, typeText did not reach the terminal while xterm.js screenReaderMode was on; only Return arrived. Steps: (1) As your first cua_repl call, alone, run `await cua.getState();`. (2) Open `http://127.0.0.1:47614/?rendererType=dom&screenReaderMode=true` with `cua.createBrowserTab("chrome", url, { sessionName: "🧪 cland QA ttyd 2" })`, click inside the terminal, then enter `:echo "qa-ok"` by sending ONE KEY AT A TIME with pressKey (try the literal character first, for example pressKey(":"), and fall back to xdotool keysym names such as "colon", "quotedbl", "minus", "space" if a literal is rejected), then pressKey("Return"). Read getAXState({ disableDiffing: true }) and take one screenshot; report whether "qa-ok" is on the bottom line in each. (3) In the same tab, goto `http://127.0.0.1:47614/?rendererType=dom` (screen reader mode off), click inside the terminal, typeText(':echo "typed-ok"'), pressKey("Return"), take one screenshot and read getAXState({ disableDiffing: true }); report whether "typed-ok" is visible in the screenshot and whether any terminal row text appears in the accessibility text. (4) Enter `:qa!` and Return using whichever method worked, then close the tab. Final answer: every call with its verbatim result or error (omit tool-injected API documentation), both screenshot descriptions, and verbatim accessibility lines that show the bottom of the Neovim screen.
  ```

- Output (the state JSON and the unchanged `~` rows are shortened):

  ````text
  `pressKey` one character at a time worked with screen reader mode on. `qa-ok` appeared on the screenshot's bottom line and in a follow-up accessibility read; the initial accessibility read still showed `:`. Every literal key was accepted, so no keysym fallback ran.

  The screen reader mode off test was inconclusive: after navigation, ttyd displayed "Press ⏎ to Reconnect." The screenshot contained no `typed-ok`, and accessibility contained no terminal row text. I sent `:qa!` using individual keys, but cannot confirm Neovim received it while disconnected. The tab was closed. No files were edited or shell commands run.

  Call 1: `await cua.getState();` → {"apps":[…same as P1…],"browsers":[…]}
  Call 2: `var tab = await cua.createBrowserTab("chrome", "http://127.0.0.1:47614/?rendererType=dom&screenReaderMode=true", { sessionName: "🧪 cland QA ttyd 2" });`
  Browser tab: 1158676252, Title: "cland-qa-ttyd", URL: "http://127.0.0.1:47614/?rendererType=dom&screenReaderMode=true". […accessibility summary…]
  Call 3:
  ```javascript
  await tab.click(4);
  for (const key of ':echo "qa-ok"') {
    try {
      await tab.pressKey(key);
      nodeRepl.write('pressKey(' + JSON.stringify(key) + ') => undefined');
    } catch (error) {
      nodeRepl.write('pressKey(' + JSON.stringify(key) + ') => ' + String(error));
      const fallback = { ':': 'colon', '"': 'quotedbl', '-': 'minus', ' ': 'space' }[key];
      if (!fallback) throw error;
      await tab.pressKey(fallback);
      nodeRepl.write('pressKey(' + JSON.stringify(fallback) + ') => undefined');
    }
  }
  await tab.pressKey("Return");
  await tab.getAXState({ disableDiffing: true });
  await tab.getScreenshot();
  ```
  ```text
  			22 text ~                                                                                     NVIM v0.11.2
  			[…]
  			53 text [No Name]                                                                                                                                                             0,0-1          All
  			54 text :
  		4 text field (settable) Terminal input
  The focused UI element is 4 text field (settable) Terminal inputpressKey(":") => undefinedpressKey("e") => undefinedpressKey("c") => undefinedpressKey("h") => undefinedpressKey("o") => undefinedpressKey(" ") => undefinedpressKey("\"") => undefinedpressKey("q") => undefinedpressKey("a") => undefinedpressKey("-") => undefinedpressKey("o") => undefinedpressKey("k") => undefinedpressKey("\"") => undefined
  ```
  Screenshot 1: Neovim's dark welcome screen shows `NVIM v0.11.2` centrally, `~` rows down the left, and the `[No Name]` status line near the bottom. **`qa-ok` is visible at the far left of the bottom line.**
  Call 4 — additional accessibility read: `await tab.getAXState({ disableDiffing: true });`
  ```text
  			53 text [No Name]                                                                                                                                                             0,0-1          All
  			54 text qa-ok
  		55 text "qa-ok"qa-ok
  		4 text field (settable) Terminal input
  ```
  Call 5: `await tab.goto("http://127.0.0.1:47614/?rendererType=dom"); await tab.getAXState({ disableDiffing: true });`
  ```text
  Browser tab: 1158676252, Title: "ttyd - Terminal", URL: "http://127.0.0.1:47614/?rendererType=dom".
  1 AXWebArea ttyd - Terminal, URL: 127.0.0.1:47614/?rendererType=dom
  	2 container
  		3 text field (settable) Terminal input
  		4 text Press ⏎ to Reconnect
  ```
  Call 6: `await tab.click(3); …` → same "Press ⏎ to Reconnect".
  Call 7: `await tab.typeText(':echo "typed-ok"'); await tab.pressKey("Return"); await tab.getScreenshot(); …` → same; Screenshot 2: a blank dark terminal with a block cursor at the upper left and a centered light box reading "Press ⏎ to Reconnect." **`typed-ok` is not visible.**
  Call 8: individual keys `:`, `q`, `a`, `!`, `Return` → same "Press ⏎ to Reconnect".
  Call 9: `await tab.close();` → empty output; no error.
  ````

- ttyd's log explains the reconnect failure: `refuse to serve WS client due to the --max-clients option.` The author viewed screenshot 1 in the rollout: `qa-ok` is on the last line under the `[No Name]` status line.

### P7: sockets after grant 2, first attempt (not run)

- Prompt: the eleven-step `--write` probe (tmux on both socket paths, the `rpc-dump.sh` and `tcp-listen-check.sh 47616` scripts, pathlib cleanup).
- Output, from the rescue agent: "Not run. The one forwarding Bash call was denied by the Claude Code auto mode classifier, which gave the reason "[Exfil Scouting]". Codex was never invoked and none of the 11 probe commands ran."
- P8 dropped the TCP listener and the scripts. The TCP and ttyd-inside-the-sandbox checks stay unverified.

### P8: sockets after grant 2 (`--write`, network on)

- Job `task-muydaq24-jhrxhj`, thread `01a1175b-f859-7021-9ba6-ae32c1279daa`, 1 min 59 s, `workspace-write` with `network_access: true`. Rollout: `…/rollout-2026-10-07T19-14-26-01a1175b-f859-7021-9ba6-ae32c1279daa.jsonl`.
- Prompt:

  ```text
  --fresh --model gpt-6-astra Write-capable probe for a research ticket; a workspace-write run is intended. Purpose: check whether local terminal-multiplexer IPC (tmux and Neovim Unix-domain sockets inside the workspace) now works in this sandbox for TUI QA. Do not use computer use, do not open any network connection, and do not run any script file. Create files only under ./.tmp/ in the current workspace and remove them at the end with the Python one-liner in step 7. Do not edit any other file. Run these commands exactly as written, one per exec_command call, and report each command's exit code and verbatim output or error; if a step fails, continue. (1) `mkdir -p .tmp && echo "pwd=$PWD"` (2) `tmux -S "$PWD/.tmp/astra-qa.sock" new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` (3) `tmux -S "$PWD/.tmp/astra-qa.sock" send-keys -t qa ':echo "qa-ok"' Enter; sleep 1; tmux -S "$PWD/.tmp/astra-qa.sock" capture-pane -p -t qa; echo "exit=$?"` (4) `tmux -S "$PWD/.tmp/astra-qa.sock" kill-server; echo "exit=$?"` (5) `tmux -L astra-qa new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"; tmux -L astra-qa kill-server; echo "exit=$?"` (6) `nvim --headless --clean --listen "$PWD/.tmp/nv.sock" -c 'lua io.stdout:write("servername=" .. vim.v.servername .. "\n")' -c 'qa!'; echo "exit=$?"` (7) `python3 -c 'import pathlib; d=pathlib.Path(".tmp"); [p.unlink() for p in d.iterdir()] if d.exists() else None; d.rmdir() if d.exists() else None; print("cleaned")'`. Final answer: a numbered list with each command, its exit code and verbatim output (the full capture-pane text), then one sentence on what the sandbox allowed and blocked.
  ```

- Output:

  ````text
  1. `mkdir -p .tmp && echo "pwd=$PWD"` — exit 0
     pwd=/Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8
  2. `tmux -S "$PWD/.tmp/astra-qa.sock" new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"` — exit 0
     exit=0
  3. `tmux -S "$PWD/.tmp/astra-qa.sock" send-keys -t qa ':echo "qa-ok"' Enter; sleep 1; tmux -S "$PWD/.tmp/astra-qa.sock" capture-pane -p -t qa; echo "exit=$?"` — exit 0

     ~
     ~
     ~
     ~
     ~
     ~
     ~
     ~
     ~
     [No Name]                                                     0,0-1          All
     qa-ok
     exit=0
  4. `tmux -S "$PWD/.tmp/astra-qa.sock" kill-server; echo "exit=$?"` — exit 0
     exit=0
  5. `tmux -L astra-qa new-session -d -s qa -x 80 -y 12 'nvim --clean'; echo "exit=$?"; tmux -L astra-qa kill-server; echo "exit=$?"` — exit 0
     exit=0
     exit=0
  6. `nvim --headless --clean --listen "$PWD/.tmp/nv.sock" -c 'lua io.stdout:write("servername=" .. vim.v.servername .. "\n")' -c 'qa!'; echo "exit=$?"` — exit 0
     servername=/Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ac1d49127876959c8/.tmp/nv.sock
     exit=0
  7. `python3 -c '…'` — exit 0
     cleaned

  The sandbox allowed tmux socket IPC and TUI capture, the named tmux session, Neovim's workspace socket listener, and cleanup; none of these tested operations were blocked.
  ````

## Appendix B: local experiments

- **L1: tmux, local.** Command: `tmux -L qa-astra-local new-session -d -s qa -x 80 -y 12 'nvim --clean'`, then `send-keys -t qa ':echo "qa-ok"' Enter`, then `capture-pane -p -t qa`, then `kill-server`. The capture showed nine `~` rows, `[No Name] … 0,0-1 All` and `qa-ok`.
- **L2: headless one-process dump, local.** `nvim --headless --clean -S screendump.lua` printed the 80×24 grid with `qa-ok` on the last row, identical to P3. The script:

  ```lua
  -- Single-process QA sketch: feed keys into this headless Neovim, then print its screen grid to stdout.
  local function dump()
    local rows = {}
    for r = 1, vim.o.lines do
      local cells = {}
      for c = 1, vim.o.columns do
        cells[#cells + 1] = vim.fn.screenstring(r, c)
      end
      rows[#rows + 1] = (table.concat(cells):gsub('%s+$', ''))
    end
    io.stdout:write(table.concat(rows, '\n') .. '\n')
  end

  vim.api.nvim_input(':echo "qa-ok"<CR>')
  vim.defer_fn(function()
    dump()
    vim.cmd('qa!')
  end, 300)
  ```

- **L3: RPC socket, local.** The script `rpc-dump.sh`:
  1. starts `nvim --headless --clean --listen <dir>/nv-qa.sock`;
  2. sends `:echo "qa-ok"<CR>` with `--remote-send`;
  3. prints the grid with `--remote-expr 'join(map(range(1,&lines), {_,r -> join(map(range(1,&columns), {_,c -> screenstring(r,c)}),"")}), "\n")'`;
  4. quits.

  Output: the grid with `qa-ok`, then `80x24 mode=n` and `nvim exited`. The script `tcp-listen-check.sh 47616` printed `servername: 127.0.0.1:47616`. Both were run only locally; P7, which included them, did not run.
- **L4: ttyd and the probe servers.**
  - Install: `HOMEBREW_NO_AUTO_UPDATE=1 brew install ttyd` installed ttyd 1.7.7_13, json-c 0.19 and libwebsockets 5.0.0_1, and upgraded openssl@3 to 3.6.5, libevent to 2.1.13 and libuv to 1.53.0. No sudo.
  - Listening: `lsof` showed `TCP 127.0.0.1:47614 (LISTEN)` only. `curl http://127.0.0.1:47614/token` returned `{"token": ""}`.
  - `nvim --clean -Z` fails with `nvim: Unknown option argument: "-Z"`, so the first ttyd command, which used `-Z`, was replaced before any probe used it.
  - The page server for P2 logged a single request, the author's own `curl` at 18:46:33. Nothing came from Chrome.
- **L5: floats and terminals in the dump.** `floatdump.lua` opened `:terminal printf "term-ok\n"; sleep 5` plus a bordered floating window holding `float-ok`. The headless dump printed `term-ok` and the float with its `┌…┐` border at row 4, column 41.

## Appendix C: not verified

- **Which Seatbelt rule lets a process listen on a Unix socket once network is on.** The generated policy has no blanket `network-bind`; P8 shows the listen works anyway.
- **A stdio transport between the UI and the hub.** This is a requirement derived from ADR 0003 and P4, not something tested.
- **The narrower alternative to grant 2.** A permission-profile `unix_sockets` allowlist (`[permissions.<name>.network]` plus `default_permissions`) should allow tmux and Neovim sockets without network. Not tested; it is also unknown whether a companion-started `workspace-write` thread applies the profile.
- **Whether a TCP listener started by astra inside its sandbox works with grant 2,** and with it ttyd launched by astra. P7 was refused by the Claude Code classifier before reaching Codex.
- **`typeText` into ttyd with screen-reader mode off.** P6 was inconclusive because of `-m 1`.
- **The `--embed` plus `nvim_ui_attach` client.** Designed from the docs and Neovim's tests, not run.
- **freeze-rendered screenshots and `view_image`.** Not run.
- **Whether a saved "Always allow" for a desktop app (made in the ChatGPT app) is honoured in a headless rescue run.** The code path exists (`computer-use-persisted-state`). Not needed for terminal QA.
- **Which helper block maps to which decision.** The per-category mapping (forbidden versus high-risk) comes from `strings` and is inferred. The six installed terminals are confirmed `forbidden` (P1).
- **Whether `browser.capabilities.get("viewport")` is reachable from `cua_repl`.** It is documented in the browser plugin (`docs/capabilities/browser/viewport.md`) and would fix the web terminal's size. Not tested.
