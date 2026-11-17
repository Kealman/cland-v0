## cland doctor

With `[release] web_bundle = true`, `release gh` asks the running hub for a
metadata-only executable lookup on the hub's own PATH. A missing `gh` warns:
install it on that PATH and restart the hub. This check runs no `gh`, auth or
network command; the existing caller-side `gh`/`gh auth` checks for a GitHub
remote remain separate. Disabled/default `web_bundle` adds no release lookup.
An offline hub or an older reply without `releaseTools` stays unknown with
start/restart guidance. `hub.status` includes `{releaseTools:{gh:boolean}}` only
when requested with `releaseTools:true`; ordinary status replies stay unchanged.
Executable lookup follows POSIX child-process PATH rules: an unset PATH uses
`/usr/bin:/bin`; empty and relative entries resolve from the release's working
directory, including when the hub started elsewhere. The shared synchronous and
asynchronous resolver use the same candidate list for doctor, setup and Git
maintenance. Absolute PATH entries keep their existing selection.

A role on an unconfigured pool adds `host <role> placement` with `warn` and
`role <role>: pool <pool> is not configured`, even when no pools exist. The fix
configures that pool's provider or moves the role to `local`, then reloads.
This check reads only config and roles, writes nothing and calls no provider.

The `sign-in mode` row reads `[auth] mode` from project config (default `single`).
Single mode is `ok` and needs no user-list request. In users mode the running
hub's `user.list` supplies active and invited counts and total admins with the
active admin count: `users; 1 active, 1 invited; 2 admins (1 active)`.
No active admin warns with `cland user invite <name>`. Without hub discovery or
a live hub PID, counts say `hub not running`, with `cland hub start`; remote
discovery uses its forwarded socket without a local PID probe. A refused or
unusable reply says `running hub doesn't report users mode`, with
`cland hub reload`. Counts are never guessed from config or an offline database.
If the request times out, counts say `unavailable (hub did not answer)` with
`cland hub reload`; a timeout does not establish that the hub stopped.
Text and `--json` contain only this metadata, never identity names, invite links,
passkey or password material. The JSON envelope and existing check rows remain
unchanged; this is one additional `{name, verdict, detail, fix?}` check.

For configured host pools, doctor adds `host <provider> token`, `host <pool> image`,
`host <pool> <harness> logins`, `host login <name>`, host reachability and `host spend`
checks in the same text/JSON report. Token presence and its 12-character fingerprint
come from the running hub's resolved store/environment; doctor never reads the provider token or
calls a provider. An absent DigitalOcean token names `cland secret set digitalocean.token`
and `cland hub stop && cland hub start`. Image checks read the local
pool image record and use preparation's key and changed-part comparison; missing,
stale or unreadable records name `cland host prepare <pool>`.

`host.status.freeLogins` supplies indexed regional eligible login counts for the
harnesses of roles placed on each configured pool. Reusable keys/shared disks
count once, and exclusive counts are not capped by `max_hosts`. The separate
admission `capacity` is not a count. Removed pools retain host/spend reporting but
get no free-login rows. An older hub without counts prints `free login count
unavailable` and names restart commands. `host.status` also supplies current host inventory and
today's settled plus live host spend. Zero free logins names `cland login add <harness>
--pool <pool>`; signed-out metadata from `login.list` names `cland login signin <name>`.
Unreachable hosts name `cland host destroy <id>`; other non-ready states name
`cland host stop <id>`. An observed outage includes its start; an older hub without
that field prints `outage since unknown`. Spend warns at 80 percent of
`[hosts] daily_spend_usd` and names `cland config set hosts.daily_spend_usd <n>`;
unknown spend stays unknown. Warnings do not change the exit code. With no running
hub the hub-backed checks say `hub not running`, fixed by `cland hub start`;
local image checks remain available. With no pool and no role pointing at a missing
pool there is one `ok` row,
`hosts: no host pool`. Older hubs refusing provider diagnostics produce a status
unavailable warning with restart commands, never a fabricated token result.

Doctor requires only the harnesses used by `.cland/roles.toml`: each role's launch harness (omitted roles or harness keys take the built-in defaults), plus every named account's harness. Other missing or signed-out harnesses have informational `ok` rows; a signed-out row still names its login command. Without a project or `roles.toml`, no particular harness is required, but a machine with none installed gets one failure, `cland needs at least one harness`, with installers. `gh` and its login are checked only when the root has a remote named `github`; otherwise a single `ok` row says `not needed: no github remote`. The exported `harnessesInUse` in `src/roles/harnesses.ts` supplies the same requirements to setup's installer and login steps.

Hub lifecycle readers classify the lock’s hostname, boot id and PID namespace before local PID probes or socket requests. `hub start` refuses a fresh foreign holder and names its hostname, PID and heartbeat age; only a heartbeat older than 60 seconds allows guarded takeover. Missing/invalid heartbeat stays held. `hub status` and doctor describe a lapsed foreign holder as startable; status JSON adds `foreign`, `hostname`, `heartbeatAgeMs` (null when unknown) and `startable` on that path. `hub stop` refuses every foreign holder, including a lapsed one, and retains discovery and lock without local signals. The orphan sweep excludes foreign holder PIDs from local reservation matching. Offline `task migrate` takes the hub-aware synchronous lock in the CLI, renews its heartbeat every 10 seconds through completion and cleanup, and revalidates ownership before publishing files or index updates. Lost ownership fences further publication; renewal stops before lock release. It shares the startup freshness rule; generic asynchronous locks remain host-unaware. Mixed hub versions on a shared volume are unsupported.

`cland doctor [dir]` checks the machine and the project (`dir`, else the one around the current directory) and prints one line per check: `ok`, `warn` or `fail`, what it found, and for a `warn` or `fail` the fix after `— fix:`. The text is plain, to paste into an item comment; the verdict is coloured only on a terminal (never with `NO_COLOR`). `--json` prints `{root, version, checks: [{name, verdict, detail, fix?}], summary: {ok, warn, fail}}`. The exit code is 1 when any check fails, else 0: a warning never fails it. It starts nothing; the hub is asked `hub.status`, `remote.status`, `host.providers`, `host.status` and `login.list` over its Unix socket. Remote token presence uses the existing private-file resolver (including tightening file permissions), never a platform check. Every probe runs with a deadline (20 s for a tool, 3 s for the `ps` that tells whether the hub lock's holder is still the process that took it; `CLAND_DOCTOR_PROBE_TIMEOUT_MS` overrides both, for tests) in its own process group: past the deadline the whole group is killed and its pipes closed. The probe waits for the child and native handles to close before returning. If the child still has not closed one second after SIGKILL (also applied on a spawn error), the report returns an explicit `cleanup incomplete` failure rather than waiting indefinitely; termination is unconfirmed in that case. A `ps` that does not answer in time counts as "cannot tell", and the live lock holder is kept.

| Check | `ok` when | Otherwise |
| --- | --- | --- |
| `claude-code`, `codex`, `opencode` | The executable (the adapter's `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, else `claude`, `codex`, `opencode` on the PATH or in installer folders) answers `--version`, or no role uses it. Each installed row shows `<version> at <bin>` and an informational `tested with` note from `src/doctor/ranges.ts`. | Required but missing, failed or unreadable version: `fail`. Versions have no range verdict or upgrade fix; OpenCode's row notes that cland speaks its v2 API, for every major. |
| `claude-code auth` | `claude auth status --json` says `"loggedIn": true`. | `fail`, `claude auth login`. |
| `codex auth` | `codex login status` exits 0 (`Logged in using …`). | `fail`, `codex login`. |
| `opencode auth` | `opencode auth list --standalone --format json` lists providers with a `type: "credential"` connection in cland's database and the default OpenCode store; compare provider ids, excluding `env` connections (`--standalone`: a private server for the call, the background service is not started). | None: `warn` (the free default needs no login); credentials present only in the default store: `warn` naming missing providers and cland's standalone login. An unreadable store is an incomplete check. Unused harness checks remain informational. |
| `gh`, `gh auth` | No `github` remote (one informational row), or `gh --version` and `gh auth status` exit 0. | `fail`: install gh, `gh auth login`. |
| `neovim` | `CLAND_NVIM`, else the pinned build in the launcher's cache (`nvim/bin/nvim-path.ts`), prints `NVIM <nvim/NVIM_VERSION>`. | Not downloaded: `fail`, run `cland open` (its launcher downloads and verifies it). `CLAND_NVIM` at another version: `warn`. |
| `project` | Only when `.cland/` is missing: then the project checks below are this one `fail`, `cland init`. | |
| `territory` | `origin` is the local bare territory, it holds `main` and `dev`, `HEAD` is on `dev`, and the protection hook is current and executable; a non-Git folder needs none. | `fail` names missing or damaged state; run `cland init` (restore a changed `origin` to `.cland/territory.git` first). |
| `hub` | `hub.json` names a live pid that holds `.cland/hub.lock` and answers `hub.status` on the socket, at this cland's version. | No hub (no file, a stale file): `warn`, `cland hub start`. A lock holder without `hub.json`, an invalid file, a hub that does not answer: `fail`. A stale file (its pid gone, or not the lock's holder) while a live process holds the lock: `fail` naming the holder, `kill <holder>`, then `rm .cland/hub.json` and `cland hub start` (`cland hub start` alone would refuse). Another version: `warn`, restart it. |
| `<messenger> token` | The resolved token is present (12-character SHA-256 fingerprint), or absent while configuration-disabled. File values are overridden by `CLAND_TELEGRAM_TOKEN` / `CLAND_DISCORD_TOKEN`; no value is printed. | Enabled with no token: `warn`, `cland secret set <messenger>.token`, then `cland hub reload`. Invalid secrets: a fixed `fail` diagnostic without contents. |
| `<messenger> enabled`, `<messenger> connection`, `<messenger> pairing` | Enabled is read from `[remote.telegram]` / `[remote.discord]` (built-in defaults when config is absent); connection and paired name/numeric ids come from the running hub. Configuration-disabled and disconnected is informational. | No hub: `warn`, `hub not running`, `cland hub start`. Unsupported/unreachable local status: `warn`, update/restart the hub. Enabled but disconnected: `warn`. |
| `<messenger> stopped` | Only emitted for a stopped remote (`connection: disabled`). | `warn`, with the shared General cause/fix: new token for Telegram 401 or Discord 4004 (`cland secret set <messenger>.token`, then `cland hub reload`); Message Content toggle for Discord 4014; unblock the bot for 403; stop the other token consumer for lasting Telegram 409; then reload. Older hubs without a structured cause retain their redacted reason and a generic repair/reload fix. |
| `web network` | A loopback bind or HTTPS tunnel is configured. | `warn` for a network bind without `[web] origin`: cookie in clear, no phone notifications/install; configure the tunnel or return to loopback. |
| `web edge` | The independent browser listener is available. | `warn` with its port and bind failure reason; free the port or change `[web] port`, then restart. Spoke/Unix-socket service continues. |
| `hub.json` | Valid (socket, port, secret, pid, version; optional webPort), or absent while no hub runs. | Missing while a hub holds the lock, or invalid: `fail`. Stale: `warn`. |
| `secret` | `.cland/secret` is 64 hex digits, mode 0600, the one `hub.json` carries. | Absent before the first start: `warn`; loose mode: `fail`, `chmod 600 .cland/secret`. |
| `roles.toml`, `config.toml` | Parse (`roles.toml` as the hub reads it, `config.toml` as `cland update` does). | `fail` with smol-toml's error and its line and column. Absent: `warn`. |
| `skills manifest` | `.agents/skills/.cland-manifest.json` is valid (validated as `cland update` does: the mark, the names, the paths) and each skill it lists is a folder holding its `SKILL.md` (cland's own repository, the skills' source, needs none). | `fail`, `cland update`. |
| `skills` | `.claude/skills` is a symlink resolving to `.agents/skills`, or the project's own folder whose entry per cland skill is a folder, or a link to one, holding `SKILL.md` (a regular file, or a link to a folder without it, fails). | Missing or broken: `fail`, `cland update` (a link pointing elsewhere: `rm .claude/skills` first). A link of the project's own elsewhere: `warn`. |
| `claude hooks` | `.claude/settings.json` holds the managed hook (`cland hook <event> # managed by cland <version>`) for every adapter event, at this version. | Missing: `fail`; another version: `warn`; both `cland update`. |
| `cland mod` | `hub/mod/cland/hooks/hooks.json` ships with this cland. | `fail`, reinstall cland. |
| `docs/agents`, `AGENTS.md` | The three files exist (a file without the mark is the project's own and fine); `AGENTS.md` has the managed block, at this version. | `fail` (another version: `warn`), `cland update`. |

Remote checks make no platform or paid call; `cland remote test <messenger>` is the explicit token check. Doctor reads the current file/environment and config; status describes the running hub's loaded clients, so changed inputs take effect there after `cland hub reload`. `RemoteStatusRow.stopCause` is optional (`token`, `message-content`, `blocked`, `other-consumer`, `interactions-endpoint`, `gateway-refused`, `identify-budget`), alongside the unchanged `reason`. The cause persists additively in `remote_status.stop_cause` and clears when the gateway restarts the client. General and doctor share `src/remote/notices.ts` wording rather than parsing provider errors. The built-in Discord client supplies application, REST authentication and fatal gateway causes.

`probeHarness` in `src/doctor/toolchain.ts` exports the binary, parsed version and login checks for both doctor and setup, with injectable executable lookup and command replies. T1 coverage is in `test/doctor-harness-probe.test.ts`. The fakes answer the same surfaces in the CLI tests (`test/doctor-cli.test.ts`): `claude --version` and `auth status` (`FAKE_CLAUDE_VERSION`, `FAKE_CLAUDE_LOGGED_OUT`), `codex login status` (`FAKE_CODEX_LOGGED_OUT`), `opencode auth list` (`FAKE_OPENCODE_NO_AUTH`), and the fake `gh`'s `--version` and `auth status` (`FAKE_GH_LOGGED_OUT`).


<!-- Implementation guidance moved from the implement skill. -->

For browser tests, follow `docs/agents/tests.md#web-phase` and `web/README.md#browser-tests`: use the isolated Headless Shell fixture, keep CSP enabled and observe teardown. `npm install` prepares the pinned shell; targeted browser files require a current bundle. The hub web-auth file builds its bundle through the shared helper before standalone tests; suites build before any installation-bundle reader in `hub/test/run-suite.ts`’s `installedBundleReaders` list, including real doctor CLI tests on shards without Web or an available browser. Targeted standalone doctor CLI runs require a current build. Task verification adds changed T3/T4 files and tiers.json mapped T4 read-path guards once for duration sampling (shared duration procedure in docs/agents/tests.md), plus Web outside T0–T2; merge batches add it after T1 for web/ candidate diffs. A machine-unavailable Web receipt is not passing browser evidence; see that section.
