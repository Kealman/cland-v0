## Accounts and limits

### Registry and naming an account

The user-level registry is `$XDG_CONFIG_HOME/cland/accounts.toml` when
`XDG_CONFIG_HOME` is absolute, otherwise `~/.config/cland/accounts.toml`.
It holds account names, harnesses and paths only. Sign in once with each
harness's own command; cland never reads the files in an account directory.

```toml
[accounts.codex-b]
harness = "codex"
home = "~/.codex-b"                # CODEX_HOME

[accounts.oc-b]
harness = "opencode"
data_home = "~/.local/share/oc-b"   # XDG_DATA_HOME
# Or use db = "/absolute/path/opencode.db" for OPENCODE_DB, never both.

[accounts.claude-b]
harness = "claude-code"
config_dir = "~/.claude-b"         # CLAUDE_CONFIG_DIR
```

Names contain lowercase letters, digits and hyphens and begin with a letter
or digit. Each entry has `harness` and at most one path key belonging to it.
`~` expands to the user's home; every path must then be absolute. An entry
without a path names the harness default selected by the hub's environment;
at most one such entry per harness is allowed. Unknown keys, including
`token` and `api_key`, are refused. A missing registry means no accounts.

Pin a role in `.cland/roles.toml`:

```toml
[reviewer.launch]
harness = "codex"
account = "codex-b"
```

`account` is one registry name, never a list. `account = ""` or an absent key
uses the harness default. The role's account applies only to its configured
harness. `cland session launch rev-x --role reviewer --account codex-b`
overrides the role's account and chooses the account's harness unless
`--harness` was given. An explicit conflicting harness is refused.
With no effective account, Claude Code and Codex use the hub's existing environment; OpenCode uses cland's separate per-user database (below).
Both registry and role edits apply to the next launch without a restart.

### Processes and the saved environment

Every process an adapter starts or queries for a session, its attach command
and its idle limit polls use the selected account's environment.

The shared executor credential deny-list applies after account overlays to child
environments and before saved account entries become attach shell command text.
`DIGITALOCEAN_TOKEN` is excluded from both; account path selection and quoting
remain intact. The [scoped argv audit](../executor-argv-audit.md) records the
fake-token reproduction and current-source checks. It does not identify the
historical npm process that exposed the credential.

| Harness | Registry path and process environment |
| --- | --- |
| Claude Code | `config_dir` → `CLAUDE_CONFIG_DIR`, for launch, relaunch (`--bg --resume`), `stop`, `agents --json` and named-account attach. Each directory owns its background supervisor, login, project trust and MCP state. |
| Codex | `home` → `CODEX_HOME`, for the app-server, version probe and attach. |
| OpenCode | `data_home` → `XDG_DATA_HOME`, or `db` → `OPENCODE_DB`, for the server and attach. The server drops inherited `OPENCODE_DB` and `XDG_DATA_HOME` before applying the saved selection. With no account, `OPENCODE_DB` points to cland's separate per-user database (below). |

Named Claude accounts remove `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and
`CLAUDE_CODE_OAUTH_TOKEN`; default sessions retain the hub's environment.
A default Claude launch also saves its effective directory (the hub's
`CLAUDE_CONFIG_DIR`, else `~/.claude`); default attach remains `claude attach <id>`.
The process table saves the account name and resolved environment. Relaunches,
hub-restart resumes and pool handoffs keep it even after registry or role edits;
a pool member on a different account is not reused. A running session stays
on its account. `cland session list --json` shows `account` (null when unpinned),
and the expanded session row places a named account after the model, for example
`Codex · gpt-6.1-sol · codex-b`. `session-launched` and `session-usage` journal
records include the account.

An unknown name refuses the launch and lists known names. A malformed registry
refuses named launches; unpinned launches still work. A missing directory refuses
with its path and sign-in command (`CODEX_HOME=<dir> codex login`,
`OPENCODE_DB=<dir>/opencode/opencode.db opencode auth login --standalone`, or `CLAUDE_CONFIG_DIR=<dir> claude auth login`).
For `db`, its parent directory must exist. Trust a new Claude directory once by
running `CLAUDE_CONFIG_DIR=<dir> claude` in the project. Failed launches name the
account, directory and remedy and are never retried automatically.

### Listing models

`cland models claude-code|codex|opencode [--account <name>] [--refresh] [--json]`
is open to every role's shell. The hub probes with the launch account environment,
using cland's own OpenCode database for an unpinned account. OpenCode uses the
server catalog, retrying its initially empty list for up to 10 seconds; Codex
uses a short-lived app-server's `model/list`. Claude Code returns the static
aliases `default`, `sonnet`, `opus` and `haiku`, labelled as static.

Text prints one id per line, marks the default, and names the source and age.
JSON returns `{harness, account, models: [{id, default}], source, probedAt}`
(`account` is null without a selection). The durable hub cache lasts 24 hours
per harness and account; `--refresh` probes again. A failed probe preserves the
cached list and its original age, or fails with the probe error when no cache
exists. An unavailable executable uses doctor's not-installed diagnosis.
In the launcher, C-n/C-p on the model field cycles the same hub catalog for the
selected harness and its role's account; an empty model keeps the launch default.

### Listing accounts and reading limits

`cland account list [--json]` reads the registry through the hub and is open
to every role's shell. JSON returns `{registry, error?, accounts}`; each
account has `name`, `harness`, `path` (null for a harness default), `variable`,
`windows`, `at` (the ISO reading time, or null), and `source` (null without a
reading). Text shows the windows, reset times, age and source session, for
example `codex-b  codex  /home/user/.codex-b  wk 19% ↻Sun, 04:03 · 2m ago (session rev-x)`.
A registered account with no reading shows `no reading yet`; OpenCode shows
`no limit data`, with `windows: []`, `at: null` and `source: null` in JSON.
Account listing is a CLI/frame operation, not a spoke tool.

Limits come from running sessions at no extra cost: Codex's
`account/rateLimits/read` and sparse `account/rateLimits/updated` notifications
(including `rateLimitsByLimitId` buckets), and Claude Code's `session.measure`
forwarded by the cland mod as `mod-measure` only when `rateLimits` changed.
The mod forwards `{at, rateLimits: [{kind, percentUsed, resetsAt}]}`, never
context or cost. Claude's status line has no per-model weekly window.
OpenCode supplies no limits; cland never reads tokens or calls usage endpoints.

Each window is `{id, label, usedPercent, resetsAt, windowMins?, severity?, scope?}`.
Resets are ISO times (Codex's epoch seconds are converted); optional duration,
severity and per-model scope are retained when supplied. Missing windows are
absent, never invented as 0%. Codex labels 300-minute windows `5h`, 10080-minute
windows `wk`, and other durations in hours or days; other Codex buckets use
their limit name. Claude labels `five_hour` as `5h`, `seven_day` as `wk`, and
retains other kinds. The hub assigns no severity or colours.

The hub stores `{account, harness, windows, at, source}` readings in `hub.db`
meta under `account-limits`. Keys are account names, or `default:<harness>`
for unpinned sessions; default entries with readings also appear in the list.
The newest reading by `at` wins across sessions, and restart retains its
original timestamp. `source` is `{kind: "session", session}` for these readings;
`{kind: "poll"}` identifies an idle harness poll. Updates share the existing
one-second usage coalescer, with no extra timer. Reading updates send UI subscribers
`{type: "account", account: <the list view>}` at most once a second per account;
limited marks and their lifts publish immediately.
Equal windows and source refresh age silently. A changed reading also writes
one `account-limits` journal record with `account`, `harness`, `windows`, `at`
and `source`, so the build's weekly spend can be read from the journal.

### Limited marks and launch refusals

A hard limit hit marks the account `limited: {since, reason, session, resetsAt}`
in account views and `account` events. Classification uses machine-readable
fields only: Claude Code's `StopFailure.error == "rate_limit"`, Codex's
`error.codexErrorInfo == "usageLimitExceeded"` on `error` or a failed
`turn/completed`, and OpenCode's `session.execution.failed.error.type ==
"provider.quota"`. Claude `overloaded` and `server_error`, Codex
`rateLimitExceeded`, and OpenCode `provider.rate-limit` make no mark.
Reaching 100% in a reading alone makes no mark.

Marks persist in `hub.db` meta under `account-limited`. Claude and Codex use
the latest full window's future reset; expired cached windows leave a new
hit held `until cleared` while the after-hit poll learns its reset; when several windows are full, the latest
reset keeps the account blocked until all have reset. An after-hit poll can
supply or confirm it. OpenCode has no reset: its mark says `until cleared`.
The hub journals `account-limited` and posts one warn notice in Agents, the
inbox and to the Coordinator, then calls `poll(account)` once under the
polling floor below. A repeated hit while the mark holds adds neither a
notice nor a poll. With a running Codex session the poll uses its live
app-server's `account/rateLimits/read`, without starting another process.

New launches, explicit relaunches and retained pool handoffs on that account
are refused before process creation, whether the account was explicit or
pinned to the role. The typed result has `code: "account-limited"`, `account`
and `resetsAt` (ISO or null), with text naming the account and local and ISO
reset time, or `until cleared`, and suggesting `--account`. The hub never
fails over, rotates accounts, picks another account or moves or stops running
sessions. Re-finding a live session after a hub restart remains allowed.
Only the Coordinator turns a refusal into an `ask` for the human, after reading
`cland account list`. It names the limited account and reset (or `until cleared`)
and lists the harness's other accounts with each window's current used share
and reset; unavailable data stays `no reading yet` or `no limit data`. The choices
are this launch on account X (`--account X`), the role pinned to X (edit
`[<role>.launch] account` in `.cland/roles.toml`, commit on `dev`, then `cland push`),
or waiting for the reset. Under D24 the stand-in answers this ask. A Lead reports
the account and reset to `lead T-<n>` in the item topic; it climbs to the Coordinator.
The Lead neither asks the human nor names a replacement account. The hub asks
nothing itself, and no session is instructed to switch accounts.

A timer lifts a mark at its reset, also checked at every launch. The human or
Coordinator may run `cland account clear <name>` to lift it immediately.
The Coordinator clears an OpenCode account after the human says its limit has
passed, or clears when the human asks.
Other roles receive an inline `forbidden` refusal for `account.clear`.
Clearing is a CLI/frame operation, not an MCP tool. A lift journals
`account-limit-lifted` with `by: "reset"` or `by: "hand"` and sends an account
event to remove the workbench's red limited line.

### Polling rules

Claude's session-state fallback runs `claude agents --json` at most once per
30 seconds per effective config directory, with one call in flight and one
schedule shared by watch, launch discovery and startup resume. Only directories
with watched live sessions are queried; idle directories are never queried.
The last attempt and snapshot persist across restarts. A logged-out directory
latches once, with one event and one human notice naming the sign-in command;
no polling or retry storm runs while latched. `claude auth status` and
`claude doctor` never run on a timer. See the [Claude Code adapter](adapters-and-sessions.md#the-claude-code-adapter)
for the latch's recovery conditions.

Idle accounts (no running session by registry name or `default:<harness>`) are
polled at hub start and on a timer, at most once every 15 minutes. Last attempt,
completion time and failure backoff persist in `hub.db` meta under
`account-polls`, so frequent restarts cannot increase the polling rate.
Opening the sessions panel sends `account.poll` once per opening;
`cland account list --refresh` sends the same frame. These explicit refreshes
and the `poll(account)` limit-hit entry point use a five-minute minimum and
return the cached reading when it is younger. An after-hit read waits for
that minimum or failure backoff to expire; its pending request survives a
hub restart, and duplicate hits share the one read. Limit-hit polling may
read a running account; other triggers skip it. OpenCode is never polled.

The hub runs `claude -p "/usage" --output-format stream-json --verbose` with
`CLAUDE_CONFIG_DIR`, or a short-lived `codex app-server` with `CODEX_HOME` over
stdio. The Codex client sends `initialize`, then `account/rateLimits/read`
with `excludeResetCreditDetails: true`, and ends the process. Claude's
`usage_report.rate_limits.limits` supplies `session` (`5h`), `weekly_all`
(`wk`) and `weekly_scoped` (`wk <group>`, with scope and severity retained).
A newer session push wins over a delayed poll, including equal timestamps.
Polls run in disposable scratch directories under `.cland/run/accounts/`,
with no `CLAND_*` variables or inherited Claude auth variables. They never
run `agents --json`, `auth status` or `doctor` to read idle limits, never read
credential stores, and never call a provider endpoint from cland.

Each account has at most one poll in flight, with at most two across the hub.
A process has a 30-second bound; timeout and shutdown kill its process group.
Non-zero exits, a 429 or rate-limited answer, timeouts and unparsable readings
double the normal floor to 30, then 60 minutes (capped). Explicit refreshes
also respect this backoff. Success restores 15 minutes. Floors are measured
from completion, with the attempt saved before launch for crash recovery.
A signed-out answer sets `signedOut: true` on the account view, shows
`signed out` in the CLI and follows the same backoff; a successful reading
clears it. `account-polled` journals `{account, harness, ms, ok}` and
`account-poll-failed` journals `{account, reason}` with a fixed one-line reason,
never the harness's output. Tests may shorten timings with
`CLAND_TEST_ACCOUNT_POLL_FLOOR_MS`, `CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS` and
`CLAND_TEST_ACCOUNT_POLL_BOUND_MS`; these never reach the harness process.

### Terms and account choice

The providers' terms prohibit rotating accounts or using multiple accounts to
get past limits; Anthropic's also prohibit third parties holding Claude.ai tokens.
The project's [accounts policy (§3.13)](../spec/v0.1.2.md#313-accounts-and-limits)
sets this boundary. cland reads no token or
credential store, calls no provider usage endpoint itself, and reads limits
through the harness. It never rotates, fails over or chooses another account:
the human makes and authorizes any account choice.

