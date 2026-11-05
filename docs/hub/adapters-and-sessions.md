## Adapters and sessions

An adapter launches one kind of harness, tells the hub what each session is doing, and hands it messages (spec 4.3). Claude Code, OpenCode and Codex have one.

A turn that fails is reported separately from the session's idle state. OpenCode's `session.execution.failed`, Codex's `turn/completed` with an error (or failed status), and Claude Code's `StopFailure` make a journalled `turn-failed` notice in Agents and a record in the events view: `<name> [Role]: its turn failed: <first line of the error>`. Sessions whose hub messages fed the turn (including steers) receive a hub note too; human messages are covered by Agents and the events view. The harness stays running. Failures the adapter misses while its event stream is disconnected cannot be reported. OpenCode drops uncertain sender attribution on stream loss and tracks new deliveries after reconnect. Codex associates only accepted admissions, including ones acknowledged after completion. Claude Code uses the hooks' `prompt_id` to reconcile a failure that arrives before its start hook, keeping at most 64 recent prompt records; missing or evicted identities still produce the public notice, without guessing a sender.

Codex's confirmed `Selected model is at capacity.` failure retries after 30, 60 and 120 seconds, at most three times, while the hub remains running. Each admitted retry posts an Agents `redelivered` notice. The adapter reads the failed turn's native input from `thread/read`, retaining launch text, hub envelopes and steers; a single hub tool output keeps its native shape, while multiple input items are joined as text in their recorded order. New work, a role or item reassignment, stop, archive or hub shutdown cancels the pending replay. Ownership and the native turn are checked again after readback, immediately before submission. Exhaustion sends one terminal report to the item lead for verifier work, or the Coordinator for a claimant or unknown item, plus the original agent senders, with recipients deduplicated. A failed Coordinator leaves the terminal notice in Agents and addresses the Aides; terminal reports never wake the failed session itself. Missing/unreadable input, a lost native connection or an ambiguous replay admission stops recovery and reports the reason once. Backoff is transient across hub restarts. Other failures retain the ordinary notice and sender report without automatic replay; uncertain original admissions still require the human's explicit `session.retry`.

### The contract

`src/adapters/contract.ts`. Mandatory:

| Member | What it does |
| --- | --- |
| `spawn({name, role, model, cwd})` | Launches the harness with the spoke's MCP configuration injected at launch; resolves with the process-table row. Nothing is written into the project. |
| `attachCommand(process)` | The command, as a string, that attaches a terminal to the live session; the harness's own. |
| `inject(process, message, topic)` | Hands the message to the session as a turn. Resolves when the harness confirmed the turn (stage `injected`). Rejects when there is no way in or no confirmation in time: the message then stays `delivered`, the hub logs `inject-unconfirmed` and retries at the session's next transition to `idle`, when its in-session connection comes back, or when the adapter's own connection to the session comes back (`host.reconnected`, state change or not). Rejects with `InjectUncertain` when the request reached the harness and its answer never came: the delivery is `uncertain` and only `session.retry` sends it again. |
| the state stream | Push signals from inside the session go to the hub as `session.signal` frames and the adapter's `interpret` turns them into states. The adapter's own poll and its liveness check report through its host. |
| `stop(process)`, `resume(process, {relaunch})` | Stop through the harness; a stop that cannot confirm the process gone fails and leaves it watched. Re-find a process after a hub restart by the harness's own ids (a pid alone never: it may have been reused), or start it again on its own conversation (`relaunch`). The session layer stops a process that still runs before a relaunch, keeping the row's role, unless the adapter explicitly owns that stop through `relaunchStopsProcess` (Claude Code). Claude Code also invokes `claude stop <previous harnessId>` for a stopped/exited row or a missing PID before launching its replacement: `cland session resume <name> --relaunch` always ends with a new harness process on the same conversation, and without `--relaunch` a live session is only re-found. |
| `close()` | End supervision at hub shutdown; returns `void` or a promise that the session layer awaits before closing its process table. Claude cancels transient CLI calls with SIGKILL and drains their `execFile` callbacks, clearing native command deadlines. The session layer rejects resume results arriving after closure, including identity probes, before restarting supervision or publishing a process row. Established harness sessions continue running. |

The capability table declares the optional capabilities (`history`, `usage`, `setModel`, `approvalRelay`) and each state signal as `reliable`, `heuristic` or `none`. What is `none` is never emulated. `session.list` returns every adapter's table.

A failed launch that returned a process keeps its identity in durable pending-stop ownership, watches it until verified exit, and retries its ownership-verified stop on restart. The recovery receipt and quarantine of any accepted row commit in one process-table transaction; Before calling stop, the receipt durably records stop intent with the original pid and start identity. If the completion write fails, recovery inspects that identity: gone or reused means settle without signalling the replacement; a matching live original takes the ownership-verified stop path; unreadable identity remains pending. Recovery starts a new adapter watch only after verifying the original identity alive; gone or reused identities dispose supervision by session id through `adapter.unwatch`, without signals. Row removal and its checkpoint share one process-table transaction. Guarded role rollback and its checkpoint share one Store transaction, so a later human assignment cannot be undone by receipt replay. The receipt persists completion of verified stop, row removal and guarded role rollback separately. Recovery resumes the first unfinished stage and never signals a process after stop was verified, even if its pid has since been reused; cleanup clears the receipt only after all stages finish. `session.list.pendingStops` shows this recovery separately from accepted process rows; it never reports the failed launch running or replaces another name owner. Codex and OpenCode failures before returning a process hand pending file rollback to the same durable receipt. It records each child as pid plus start identity and each file undo as removal, truncation, content/mode restoration or removal of an owned empty directory. Startup re-verifies those children through the shared termination helper before touching their files, checkpoints each completed undo, and keeps launches and resumes of that session fenced until all cleanup settles. A failed recovery-child checkpoint restores both local and retained receipt state, so repeated write failure cannot expose uncommitted birth proof to a later stop. An unknown start identity remains pending while the child lives. A failed relaunch retains its prior conversation row and role for another explicit resume after cleanup.

A failed launch whose row was published still has a terminal transition: verified cleanup commits the final `session.state` fact and closes exact and subscriber-owned subscriptions through the shared terminal path before removing the row. Publication ownership is kept in the recovery receipt, so an interrupted terminal write retries after restart; a launch that never published a row cannot close a conflicting name owner's subscriptions. Verified cleanup still ends subscriptions owned by its proven early identities. Authoritative identity publication follows the row commit, including a commit whose observer throws; an unpublished row failure preserves the prior claimant identity and lead routing.

An unfinalized launch identity is fenced against rename and role changes (assignment, clearing and either side of a handover), from its early hello until successful acceptance or completed failed-launch settlement. A refusal names the pending launch. The hub gives each launch a distinct credential, passed to the spoke as `CLAND_LAUNCH_TOKEN` and carried in its hello. The credential is a bearer secret, held only by the spawned process and its own spoke, never logged or passed in command arguments. The hub trusts each adapter to report the identity of its own spawned process. Within that trust model, an identity presenting the valid token belongs to the launch; sharing a token with another session or an adapter reporting another process is outside the model. The identity checks below are defence in depth. Only a matching credential proves an early hello belongs to that launch; a foreign owner reconnecting under the launch's name keeps its own role and mutation rights, including an uncredentialed `UNKNOWN_SESSION`. Launch provenance and first-role grants are keyed by credential; the fence accepts only stable ids. A credentialed anonymous hello receives a unique internal stable id before its role is granted. The returned adapter identity adds to the proven identities rather than replacing an early one, and publication records that identity in the authoritative session store. The recovery receipt retains all proven ids and the anonymous binding; cleanup immediately freezes reconnects to those committed identities, and each rollback has its own atomic checkpoint. Acceptance retires the first-role grant; a later hello uses the current human assignment, including a change or clear made while spawn awaited. An unconsumed first-hello credential retains only the published stable id until a successful hello or terminal transition consumes it, outside the pending fence. Core validates a new hello, including its launch name and authoritative identity binding, before registering ownership proof; an existing spoke join adds no proof and consumes no grant. At launch admission the hub snapshots its existing stable identities, including durable aliases and process rows. Neither a credentialed hello nor an adapter return can prove one of those identities, whatever name it holds later. Proof also checks the current identities: an unrelated identity first recorded during spawn cannot become a rollback target. A rejected foreign adapter identity receives a separate cleanup identity, preserving the foreign process row, terminal facts and verifier holds. Every resolved proof candidate must also be a stable id, including the candidate chosen for an anonymous hello during the PID probe. A credential cannot make an existing foreign live or offline identity a rollback target. Refused anonymous hellos leave no anonymous binding in the proof set or cleanup receipt. Foreign hellos cannot consume the launch's first-role grant or become rollback targets. Quarantined rows do not publish ordinary process changes; their final fact waits for verified exit. Cleanup and rollback resolve ownership by the proven stable session id, including recovery of a previously renamed identity. A later human grant is allowed after settlement and survives recovery retries.

### Session state

`idle`, `busy`, `waiting for human`, `waiting for approval`, `unknown` (spec 4.2). Only adapters set it; the model's `status` tool sets the status line and never the state. Presence (`who`, `hub.status`) carries it, and subscribed clients get `session.state`. A session no adapter launched is `unknown`, and so is a launched one whose process died or was stopped.

- A push signal (a hook, the mod) carries the time it happened; one older than the last push applied is dropped, so out-of-order hooks never move a session back. For a hook that time is when its `cland hook` process started (the harness fires the event by starting it; the process may take hundreds of milliseconds more to run), for the mod the event's own time. The hub's receipt order is not used: two hook processes started in one order often arrive in the other.
- A signal or a bridge names its launch (`--launch`, the cland session id the launch gave the hooks and the mod). One from an earlier launch under the same name is ignored (`signal-other-launch` in the log) or refused: it never changes the row of the process that replaced it. A signal never revives a row that is not `running`; only resume does.
- A retry asked for while an inject of the same message is still waiting for its confirmation (an `idle`, a bridge that connected) is made when that inject gives up, if the message still waits. A rename takes the session's `delivered` messages along, so their retry and confirmation find them. At a launch, the bridges that connected early are registered before the early signals are replayed.
- A polled signal counts only while no push came for `CLAND_PUSH_TRUST_MS` (15 s), or while nothing is known yet. For Claude Code, after any accepted hook/mod state signal, a polled `busy` never changes state: background shells and agents also make `claude agents --json` report busy. A launch with no pushed state still accepts polled busy. Idle, waiting, unknown and liveness polling retain their existing behaviour; this exception does not change other adapters.

#### Held-delivery rechecks

Every accepted idle observation flushes queued deliveries and starts acknowledged
work whose durable `injectionStarted` receipt is false, including when state
remains idle. Attempted, unconfirmed work retains its busy-to-idle or reconnect
retry trigger and capped backoff; a bare idle observation cannot replay it. While
captured never-attempted deliveries remain queued or delivered, Sessions rechecks
them every 60 seconds
using its transport clock. `human-hold-recheck` records session identity, current
state, source and `ageMs` (null when no observation exists). This supervision also
covers agent reports; existing injection backoff and uncertain-delivery fences
still apply. It stops on terminal delivery, stopped/archived sessions or hub close.

Human busy gating at both socket delivery and adapter injection uses one policy.
A poll-only busy episode older than five minutes no longer holds human input;
repeated busy polls do not renew that episode. Accepted push state replaces its
provenance, so pushed busy remains authoritative. This does not change displayed
state or heartbeat gating. Bare cores without Sessions retain ordinary busy gating.
Recovery seeds supervision from retained acknowledged work after native discovery,
including an alive process whose native listing is unavailable, and excludes
already-attempted work from the new idle/timer path. Every Sessions
state writer records matching provenance; crew reuse starts a fresh busy episode.
No new setting, command, wire field or role permission is required.


Isolated fixtures can pass a complete `transportClock` through `serveProject` and
`projectSessions` for hook/poll/injection timestamps, using the same clock for
the adapter schedule. Omission retains native `realClock`, separately from core
policy time; this is an in-process dependency seam, not a configuration setting.

### The process table

`harness_processes` in `hub.db`: name, harness, role, model, cwd, pid, the harness's handle (Claude Code's background id, Codex's app-server socket), cland's session id (the spoke's `CLAND_SESSION_ID`), the harness's own conversation id where it chose one (Codex: the thread id), start time, the pid's process start time (`ps -o lstart=`, as the hub lock keeps it), `running` | `exited` | `stopped`, the latest reported usage totals (JSON, null when none), and the Lead’s node or item whose task worktree the session was launched in (`item`, else null).

The additive `pid_identity` column (`pidIdentity` on internal adapter process records and recovery children) records Linux boot id plus `/proc/<pid>/stat` start ticks, or macOS's microsecond `kinfo_proc` start timeval. macOS reads the observed 64-bit kinfo layout through the OS-shipped `/usr/bin/perl` syscall boundary; no compiler or addon is needed. Missing `/proc`, Perl, native permission or an unsupported ABI leaves identity unknown. Ownership facts come from an authoritative ps snapshot bracketed by stable native birth reads. Once a row has native proof, `system-processes.ts` `endProcess` rechecks that proof before signalling, so a replacement birth is refused (`signal-refused` in the log) and is not taken for the session on resume. Legacy rows have the one-time migration window below.

The legacy `pid_started` timestamp stays readable. On the first stop/resume of a row without native proof, a live coherent observation whose whole-second start matches the stored stamp upgrades that row to precise ownership; the upgrade commits before a signal. Restored failed-launch children and local worker leases use the same matching, persisted upgrade. Same-second reuse before that first observation retains the previous risk for one migration window; precise rows never upgrade again. A mismatched start or unreadable identity cannot authorize a signal or count as observed process exit. Such a live row or failed-launch receipt stays supervised/pending. Public session views keep their existing shape. Process-tree descendants, local verification workers and fixture cleanup retain and recheck the same native identity; cleanup preserves a live writer's directory when proof is unavailable. Hub and compatibility locks retain their conservative whole-second liveness semantics because those checks do not signal processes. At its start the hub resumes every `running` row. A process found alive under its ids is watched again. Otherwise the row turns `exited`, the state `unknown`, and the log gets `harness-exited`. The watch also catches a process that dies while the hub runs.

A final native Linux stat state `Z` (zombie) or `X` (dead), or macOS
`extern_proc.p_stat` `SZOMB`, establishes exit for liveness and cleanup without
providing signal ownership. It supersedes an older running ps row only when its listed branch is also
confirmed gone. An exited ancestor of a surviving or unverified descendant stays
as an unknown-birth ancestry row: stop and cleanup refuse that uncertain branch.
A live row at the final probe still requires matching birth proof. A parent may still need to
reap the PID: explicit OS reaping checks continue to wait for kill(0) ESRCH.
A descendant with unavailable birth can also disappear between the ownership
snapshot and final read. For those unknown rows, termination requires kill(0)
ESRCH for the stale branch and every listed descendant. ENOENT or ESRCH from
reading stat alone proves nothing. A present or unverified survivor still blocks
termination and receives no signal; the remaining managed tree still stops.

Linux native-identity failures name the boot-id read/validation or stat
read/PID/start-tick step and its errno where available. Refusal logs,
Claude stop errors and fixture cleanup retain this diagnostic without exposing
raw stat or command contents. A diagnostic never grants signal or exit proof.

### The Claude Code adapter

See [Accounts and limits](accounts-and-limits.md#accounts-and-limits) for the registry, process environment, polling and launch refusals.

On every launch and relaunch, the adapter reads `.claude/settings.json` and `.claude/settings.local.json` in the session's working directory (the project root or the item's task worktree). Only when neither file sets `worktree.bgIsolation` does `--settings` supply `{"worktree":{"bgIsolation":"none"}}`. Unreadable or malformed files count as not setting the key. Inline settings outrank every settings file, so passing this fallback unconditionally would defeat a human's local override. Neither file is written.

`cland init` and `cland update` install one managed Bash `PreToolUse` hook calling
`cland hook literal-rm`; launches and relaunches inject the same synchronous guard
through private `--settings`. It refuses the prototype's command-substitution,
backtick, named-variable and xargs rm/rmdir patterns with exit 2 and a literal-path
retry, preventing Claude Code's statically-unresolvable-target approval stall even
under bypass permissions. Literal paths, `git rm` and here-document bodies pass.
This conservative pattern check is not a shell parser or a security boundary.
Project hooks need `cland` on PATH and stand aside when `CLAND_SESSION_NAME` is
set, since the launch injected its own guard. Missing/malformed payloads pass;
no hub connection is made. Updating keeps user hooks and settings.local.json;
invalid project settings are reported as kept, so they need repair before update
can install the guard. Existing sessions receive it on relaunch.

The adapter stages its private MCP and settings files with launch-owned rollback.
A failed launch removes new files and empty directories it created, or restores
the previous private file bytes and modes on relaunch. Existing shell credentials
and peer-session files remain owned by their sessions. A started background
harness must stop successfully before rollback; a stop failure keeps its files
with the watched process.

| | Surface (Claude Code 2.1.294) |
| --- | --- |
| spawn | Uses the saved account’s `CLAUDE_CONFIG_DIR`; named accounts remove `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`. `claude --bg --session-id <uuid> --name <name> [--model m] [--effort e] --mcp-config <private-file> --settings <private-file> --plugin-dir hub/mod/cland`, in the session's cwd. The MCP config starts `bin/cland-spoke.ts` with `CLAND_HUB_FILE`, `CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_ROLE`, `CLAND_DELIVERY=adapter`. The settings add the hooks below (signals are `async`; Bash `PreToolUse` runs the synchronous literal-rm guard; with a task worktree also the synchronous `WorktreeCreate` refusal, Task branches and worktrees) and an `env` the mod reads (`CLAND_SESSION_NAME`, `CLAND_SESSION_ID`, `CLAND_LAUNCH_TOKEN`, `CLAND_HUB_FILE`, `CLAND_NODE`, `CLAND_CLI`). No secret goes on a command line: everything finds the hub through `hub.json`. `--bg` takes `--session-id` but picks its own id (its prefix is the background id); the hub records it as `harnessSessionId`. The workspace must be trusted once (`claude` in it, accept the prompt), or `--bg` refuses. |
| attach | `CLAUDE_CONFIG_DIR=<saved dir> claude attach <background id>` for a named account, `claude attach <background id>` for a default session; several clients can attach at once. |
| inject | The cland mod keeps `cland hook bridge` running, which receives `inject` frames for its session. It submits each one with `$.prompt.submit`, framed as the plugin's (a turn of its own once the session is idle). Only `turn-start` or `mod-turn-start` carrying that message's envelope confirms stage `injected`. The legacy `cland hook injected` acknowledgement remains accepted for compatibility, but proves submission acceptance only: after re-exec, submission may succeed without a model turn. Without the exact turn-start receipt within the confirmation window (60 seconds by default; the hub's `CLAND_INJECT_TIMEOUT_MS` overrides it), the hub logs `inject-unconfirmed` and retains stage `delivered`; reconnects retry but never confirm a message by themselves. The message reads as `<channel source="cland" from=… msg_id=… topic=…>text</channel>` plus one line naming the `send` tool as the way back. The session's inbox socket is not used, because its message format is undocumented. |
| state | Hooks, run as `cland hook <event> --session <name> --launch <cland session id> --hub-file <path>`: SessionStart → `idle` (and the model), UserPromptSubmit → `busy`, Stop and StopFailure → `idle`, PermissionRequest → `waiting for approval` (`waiting for human` for AskUserQuestion), PostToolUse → `busy`, Elicitation → `waiting for human`, Notification `idle_prompt` → `idle`. The mod adds `turn.start` → `busy` and `turn.complete` → `idle`, which also fires on an interrupt where Stop does not, with the turn's usage. The fallback is `claude agents --json`, at most once per 30 seconds per effective config directory, with one call in flight and one schedule shared by watch, launch discovery and startup resume. Each directory runs only while at least one of its sessions is watched; a registered idle directory is never queried. `CLAND_ADAPTER_POLL_MS` (5 s) controls the separate pid liveness tick, which runs no CLI. A launch returns with an unknown pid when the shared snapshot does not yet list it; the next scheduled poll records the pid. The last call time and snapshot live in hub.db meta, so a restart keeps the floor. `CLAND_CLAUDE_AGENTS_MS` shortens the interval for fake-harness tests. |
| signed out | `StopFailure.error == authentication_failed`, or an explicit `--bg` failure naming token expiry, latches the effective directory. One `claude-signed-out` journal record and one Agents notice name the account (when named), directory and `CLAUDE_CONFIG_DIR=<dir> claude auth login`. This replaces the generic human turn-failed notice for authentication failures; agent senders still receive `signed out: <directory>; see the Agents notice`, once per directory and sender while latched. Other turn failures keep their ordinary notices. The latch survives restart in hub.db meta. No polling, retry, `auth status` or `doctor` probes run while latched. Only a pushed successful SessionStart/Stop (never StopFailure) or a successful explicit launch lifts it; an explicit launch is allowed as a recovery attempt, with a warning in its result. A latched local resume makes no CLI call: a dead recorded pid exits, a live or unknown pid remains watched, with `state: unknown` and `stateReason: signed-out` in `session.list`. |
| stop, resume | Every command uses the row’s saved account environment and `CLAUDE_CONFIG_DIR`. `claude stop <id>`, then SIGTERM (only to the pid the table recorded, its start time checked) when the pid outlives it by `CLAND_STOP_GRACE_MS` (5 s); the process stays watched until its pid is gone, and a stop that cannot see it go fails with the row still `running`. Until a late pid arrives, stop uses the background id. Resume shares the scheduled `claude agents --json` snapshot and matches the session id or the background id; an entry that only shares the pid is another session, so the row turns `exited`. A relaunch is `claude --bg --resume <its session id>` with the same flags (the harness does not restore them). |

| Capability | |
| --- | --- |
| history | none: the transcript format is internal to Claude Code |
| usage | reliable: the mod's `turn.complete`, summed into `usage.total`, with the turn under `usage.last` |
| setModel | none |
| approvalRelay | none: approvals stay in the TUI; their records carry `answerIn: tui`, shown as `answer in Neovim` |
| busy, idle, waiting for approval | reliable (hooks, the mod) |
| waiting for human | heuristic (AskUserQuestion through PermissionRequest, Elicitation, `waitingFor`) |

Signals or a bridge that arrive while a launch is still running belong to the new process and are kept until its row is written. The real SessionStart hook does arrive before `claude --bg` and the first `agents --json` return.

### Deaf delivery supervision (T-1472)

A running harness with queued human input or acknowledged, uninjected input
older than five minutes shows `deaf` in session list, hub status and both
workbenches. Native PIDs must still be alive; adapter-owned sessions without a
PID use their running lifecycle receipt. Progress and deferred subscription
digests do not qualify. This advisory never blocks operations or relaunches a
session. Existing configuration needs no new setting.

Candidate selection runs on one coalesced timer per affected session, outside
delivery and view replies. The inbox consumes projected health events.
The episode and generated notice identities commit together and restore before
startup inbox projection. Restart does not republish an ongoing outage.
Each episode posts one Agents notice and one human inbox message, naming the
oldest held id and its stage: queued uses `cland session retry <name>`;
delivered uses `cland session resume <name> --relaunch`. A deaf Coordinator also posts
one General line to the named Aide holders. The next positive injection clears
the mark and inbox wait. Launch-pinned input stays provisional until its native
first-turn receipt supplies the new session identity; a previous pool holder
does not own that new input. The durable confirmation watermark excludes older
replays, including after hub restart, even if their exact delivery remains
unconfirmed. Reconnects do not reset the queue age or flood notices. Codex keeps
a fixed 120-second grace from the hub's serving receipt for app-server recovery;
the five-minute age threshold applies to every role and harness. Session retry
keeps its human-only, queued-input/uncertain eligibility; it does not grant an
automatic replay of uncertain input.

### The OpenCode adapter

See [Accounts and limits](accounts-and-limits.md#accounts-and-limits) for the registry, process environment, polling and launch refusals.

`src/adapters/opencode.ts`, with `opencode/client.ts` (the HTTP API and the event stream), `opencode/state.ts` (events to states) and `opencode/server.ts` (the session's server and its files). Launched with `"harness": "opencode"`.

The server process and its shell tools receive `CLAND_HUB_FILE`,
`CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_LAUNCH_TOKEN` when present,
and `CLAND_ROLE` when assigned. The generated cland MCP server environment
retains the same identity plus `CLAND_DELIVERY=adapter`. Shell CLI calls,
including verification submissions, therefore carry their session's identity.
See [The CLI in a session's shell](roles.md#the-cli-in-a-sessions-shell) for the current
environment-based identity trust boundary.

Without an account, each server uses `OPENCODE_DB=$XDG_DATA_HOME/cland/opencode/opencode.db`, or `~/.local/share/cland/opencode/opencode.db` when no absolute `XDG_DATA_HOME` is set. This database is shared by the user's cland projects and separate from OpenCode's background service: the service's boot sweep cannot resume a cland session. A registry account keeps its `data_home` (`<data_home>/opencode/opencode.db`) or explicit `db`. An account pointing at the user's default database shares the sweep hazard; `cland doctor` warns about it.

The process table saves the selected database environment, and each OpenCode `session-launched` journal record names its `database`. Resume, relaunch and pool handoff retain that selection after environment or registry changes. The server removes inherited `OPENCODE_DB` and `XDG_DATA_HOME` before applying it.

No login is needed for the free default `opencode/big-pickle` (confirmed on 2.0.24 with a fresh database and no credentials). Paid providers need credentials in cland's database. `cland doctor` names the database and prints its exact `OPENCODE_DB=… opencode auth login --standalone` line. Copy that line to apply the same absolute-XDG/HOME fallback as launch, including when `XDG_DATA_HOME` is relative.

An OpenCode Console login for Go or paid Zen in the default store is separate from cland's login. Doctor compares stored provider ids in the default XDG/HOME OpenCode database (ignoring inherited `OPENCODE_DB`) and cland's database, even when cland already has another provider's credentials. It names any missing providers in the auth check; a failed comparison is reported as incomplete. With no role using OpenCode, the check is informational. Doctor never exports or copies credentials. Connect the missing provider with the printed standalone login, then relaunch the session. Native `Model unavailable` launch and turn errors also name the selected database and its standalone login; they point out this possible credential cause without asserting that every unavailable model is an authentication problem. A named account's error uses its saved database selection.

For an account, set `OPENCODE_DB` to that account's database instead. `--standalone` keeps the login from starting OpenCode's background service. A login in the user's default OpenCode database is separate. Existing sessions launched on that default database stay there until relaunched fresh (`cland session resume <name> --fresh`); reattaching does not migrate them. Stop or fresh-launch those sessions before relying on the isolation from the background service.

The adapter speaks OpenCode's v2 API. Doctor reports every harness version for information only, including OpenCode 1.x and 3.x; behavioural API checks in the adapter report actual incompatibilities. A missing binary points to the [v2 installer](https://opencode.ai/v2/install). Before each cland release's dry run, `npm run check:opencode` compares the newest stable 2.x tag's ten wire operations and the adapter's event names with the tested tag, and prints the result for information. Differences exit 0 and belong in the release report; they do not stop a release. Only network or probe failures exit nonzero; record those failures in the report too. The check writes nothing to the repository. This opt-in network check is never part of `npm test`. The shipped release skill includes the preflight for cland's own releases.

Doctor reports warnings for each role configured on OpenCode: free model selection (including the default) may train on the code it sees, and OpenCode has no OS sandbox. Permission rules do not isolate host processes. These warnings never refuse a launch. The shipped role clauses keep a session in its item's worktree and forbid using `session_move` or `worktree_create` to leave it; request a handover from the item lead instead.

The adapter declares `launchPolicy: "rules, not a sandbox"`. OpenCode keeps its
own permission settings (v0.1.4 §3.5): cland ignores `approval`, `sandbox`,
`writable_roots`, `network` and `permissions`, whether inherited or explicitly
written in `roles.toml`. An explicit ignored choice produces one warning per role
in configuration validation and `cland role list`, which shows `guard: OpenCode's own`.
Claude Code and Codex retain their per-role inherited policy.

Only item worktree confinement (D8) contributes ordered `permissions` rules to
`POST /api/session`. Without an item, cland leaves session permissions unset.
V2 rules have `{action, resource, effect}` fields; the last matching rule wins.
The `edit` action covers edit, write and patch tools. These rules do not isolate
shell processes or provide network controls.

| Launch field | OpenCode behavior |
| --- | --- |
| item (D8) | Append external-directory denials outside the item's cwd, plus edit denials for canonical absolute paths and parent-relative paths outside it. These directory rules also restrict external reads. Internal relative paths retain native policy. |
| `effort` | Select the matching variant id from that model's `GET /api/model` entry. If absent or the catalog is unavailable, select no variant and warn in the launch record. |
| `provider/model#variant` | Send `{providerID: "provider", id: "model", variant: "variant"}`. An explicit variant wins over effort without a catalog lookup. |

Both the adapter's `harness-launched` log and the durable `session-launched`
journal record carry `policy.rules`, `policy.unsupported` (each field and reason)
and `policy.warnings`. Direct adapter requests record ignored policy fields as
unsupported. Code Mode's item-rule gap is recorded for item-bound sessions.
Retained native conversations keep their existing rules and model variant;
their launch record reads those rules back instead of claiming a new policy was applied.

`session.moved` is watched for item-bound sessions. A destination outside the
item's original cwd (including a sibling with the same prefix) produces a
warn-level lifecycle event for the supervising Lead, falling back to the
Coordinator, and a warning in the events view. Moves within the item and events
for other native sessions do not warn. Code Mode's `worktree_create` and
`session_move` request no permission, so the clause remains part of D8.

The cland MCP server keeps OpenCode's default CodeMode setting: the E-424 send experiment did not justify disabling it.

The `roleInstructions` adapter option is on by default; `CLAND_OPENCODE_ROLE_INSTRUCTIONS=0` on the hub (or `roleInstructions: false`) opts out and keeps the role clause in the prompt. When on, a hub role clause goes into the durable `cland-role` instruction entry, replacing the previous assignment or revocation. A bundled launch brief still arrives as a prompt. If the instruction PUT fails, the adapter must confirm deletion of the `cland-role` entry before falling back to the ordinary message path and logging `opencode-instructions-fallback`. A missing experimental route is not proof that a saved entry is gone: the only 404 that confirms absence is on a session this hub created and never wrote an entry to, so an older server still delivers the clause as a prompt for fresh sessions. A PUT that failed without a reply is treated as a possible write; only a PUT the server refused with 404 proves no write happened. A resumed session, one that ever accepted an entry, or one whose write reply was lost keeps delivery unconfirmed when the route cannot be cleared; any other deletion failure does the same, so it never acknowledges fallback while an old role instruction may remain. A saved session that already carries an entry keeps it if the hub later starts opted out: the prompt clause still arrives, and the next default-on launch replaces the entry. The default follows the human's 2026-10-24 decision after T-536's forced-compaction comparison.

Without an explicit model, launch polls `GET /api/model` every 200 ms: a cold catalog can list another provider before OpenCode Zen arrives. An eligible model from the known-good list (`opencode/big-pickle`) ends the wait immediately. Otherwise, a nonempty catalog must stay unchanged for 1 s before the usual free-model preference applies. The catalog wait has a 10 s budget, including HTTP requests and polling sleeps; at that deadline it uses the latest successful catalog's free choice, or the server's default when none qualifies. Empty catalogs and failed requests are retried within that budget. An explicit model or a restored session skips this wait.

| | Surface (OpenCode 2.0.24) |
| --- | --- |
| spawn | A standalone `opencode serve --hostname 127.0.0.1 --port <chosen-port>` per session, detached, in the session's cwd; readiness comes from authenticated `GET /api/session/active`, with logs used only to explain failures. The spoke is a local MCP server of a generated config passed as `OPENCODE_CONFIG` (`mcp.servers.cland: {type: local, command, environment}` with the same `CLAND_*` variables as Claude Code's), and the server gets a password of its own as `OPENCODE_PASSWORD`. Both live in `.cland/opencode/<name>/` (`opencode.json`, `password` mode 600, `serve.log`), which a `.gitignore` of its own (`*`) keeps out of the repository. Then `POST /api/session {title, model, location, permissions}`. The model is `<provider>/<id>` (`opencode/big-pickle`); without one, a free model of `GET /api/model` (zero input/output price, tools supported, enabled and active). The known-good preference list is `opencode/big-pickle`; if it is not offered free, use the first free OpenCode Zen model, else the first free model from another provider. Selection is deterministic and makes no launch-time probe request; a listed model that later fails is reported as a failed turn. The row keeps the server's pid, its url as `harnessId` and the `ses_…` id as `harnessSessionId`. The server starts its MCP servers when the session is created, so the spoke connects right after the launch. |
| attach | `OPENCODE_PASSWORD="$(cat <password file>)" opencode --server <url> --session <ses_…> <cwd>`: the OpenCode TUI as one more client of the session's server, in the session's directory. The password never appears on a command line. The directory matters: the server keeps one instance per directory its clients work in, and each instance starts the configured MCP servers, so a TUI in another directory would start a second spoke under the session's id, which replaces the spoke the session's tool calls go through (found in the T-42 run). Closing the TUI (or Neovim) leaves the server and the session running. |
| inject | `POST /api/session/{id}/prompt {text, delivery}` with the envelope as text: `steer` while the session runs a turn (it joins the turn at the next step boundary), `queue` otherwise. The reply is the durably admitted inbox item (`msg_…`), which confirms `injected`. A failed or timed-out request leaves the message `delivered` for the retry at the next `idle`. |
| state | `GET /api/event` (SSE), one subscription per server, re-opened with backoff while the session is watched; each time it opens, a snapshot (`GET /api/session/active`, `GET /api/session/{id}/permission`, `GET /api/session/{id}/form`), since the stream is live-only. `session.execution.started` → `busy`; `.succeeded`, `.failed`, `.interrupted` → `idle`; `permission.asked` → `waiting for approval` until `permission.replied`, with `approvalCommand` read from the permission's source tool part (`GET /api/session/{id}/message/{messageID}`): the shell command for a finished `shell` tool input, the tool name otherwise, the permission's `action` when the source is missing or unreadable (no other tool input leaves the adapter); `form.created` → `waiting for human` until `form.replied` or `form.cancelled`. A pending approval outranks a pending form, which outranks a running turn. States reach the hub with source `sse`. A stream that ends with its server, or a pid gone at the `CLAND_ADAPTER_POLL_MS` check, is `unknown`. |
| usage | `session.step.ended` (one per assistant message): `{model, inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens, cost}`, the model from `session.step.started`. |
| stop, resume | Stop is SIGTERM to the server (its start time checked first), which ends its MCP servers, the spoke among them. Resume finds the session when the pid is alive and the server answers `GET /api/session/{id}` with the recorded password; the state comes from the snapshot. A relaunch starts a new server on the same config and password, then reopens the same session (OpenCode keeps sessions in its own database) or offers a fresh launch when the recorded session no longer exists. |

| Capability | |
| --- | --- |
| history | none: the messages are readable (`GET /api/session/{id}/message`), but not read in v0 |
| usage | reliable: per message, from `session.step.ended`, summed into `usage.total`, with the step under `usage.last` |
| setModel | none: `POST /api/session/{id}/model` exists, but the contract has no setModel yet |
| approvalRelay | reliable: parent and child `permission.asked` requests become records of the parent cland session. The human answers through the gate: Approve once → `once`, Always for this command (OpenCode's wider grant) → `always`, Deny → `reject`. `POST /api/session/{id}/permission/{requestID}/reply` targets the native session that asked; the optional note travels as the reply's `message`. `permission.replied` closes the record with the native outcome, including replies from an attached TUI. Reply failures expose only a safe status/category; a not-found reply does not infer an outcome. Reconnect snapshots retain pending ids and close requests no longer pending as `answered in the harness`. Only the command or action/resources enter the subject; private permission metadata never enters a frame. Missing required fields or a subject exceeding the serialized 64 KiB UTF-8 cap keep that request TUI-only and log a warning; a truncated command never offers relay choices. |
| busy, idle | reliable: the server reports a turn's start and end |
| waiting for approval, waiting for human | heuristic: the server has no waiting status, so they are derived from a pending `permission.asked` or `form.created` |

`CLAND_OPENCODE_BIN` names the `opencode` executable. The server's environment drops `CLAND_*`, `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_PASSWORD`, `OPENCODE_DB` and `XDG_DATA_HOME` from the hub's own. The user's global OpenCode config still applies, merged with the generated one.

### The Codex adapter

See [Accounts and limits](accounts-and-limits.md#accounts-and-limits) for the registry, process environment, polling and launch refusals.

`src/adapters/codex.ts`, with `codex/app-server.ts` (the JSON-RPC client on the app-server's Unix socket). Launched with `"harness": "codex"`; `CLAND_CODEX_BIN` names the `codex` executable.

| | Surface (Codex 0.160.0) |
| --- | --- |
| spawn | `codex app-server --listen unix://<socket>` in the session's cwd, detached in its own process group (it outlives the hub; its output goes to `.cland/log/codex-<name>.log`). The socket is `.cland/run/cx-<id>.sock`, or `$TMPDIR/cland-run/cx-<id>.sock` when that path is too long for a Unix socket. Its environment is the hub's without its `CLAND_*` variables (`CLAND_CODEX_BIN` stays), plus `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE`, with the directory of the hub's own `node` first on `PATH`: the session's shell inherits them, so `cland task` run there acts as the session and `node` and `npm` are the hub's (Codex runs commands in a login shell, `zsh -lc`; a profile that puts another Node ahead of the inherited `PATH` would still win). The spoke is passed to the app-server only, as `-c mcp_servers.cland.*` overrides (`command`, `args`, `env.CLAND_HUB_FILE`, `env.CLAND_SESSION_ID`, `env.CLAND_SESSION_NAME`, `env.CLAND_ROLE`, `env.CLAND_DELIVERY=adapter`, `enabled`, `required`, `default_tools_approval_mode="approve"`); nothing is written to `~/.codex/config.toml`. Then `thread/start {cwd, model, approvalPolicy, permissions?}` (policy, below) and a first turn (`turn/start`, with the launch's `effort` when there is one: the app-server's schema takes it there, for this turn and the next ones) carrying the role's clause from `roles.toml` (with a line on how hub events arrive; a launch with no role carries that line alone): a thread without a turn has no rollout, and `thread/resume` (attach, a restarted hub) refuses it. Codex 0.153.4 or newer is required. |
| policy | From the role's `[<role>.launch]` (`roles.toml` above), in `thread/start` and in the `thread/resume` of a relaunch. `approvalPolicy` is the launch's `approval`, `never` when it gives none. `permissions` names the sandbox: `:read-only`, `:workspace` or `:danger-full-access` when that is all it is; otherwise the profile `cland`, which three more `-c` overrides on the app-server's command line define: `default_permissions="cland"`, `permissions.cland={extends, filesystem, network}` and `features.network_proxy`. `filesystem` marks each writable root `write`, and the git directories named above; `network` for `local` is `{enabled, allow_local_binding, unix_sockets}`, the sockets allowed under `.cland/`, the cwd and the temp dir and denied under `.cland/run/` and `$TMPDIR/cland-run/` (the app-servers' own). With no `sandbox` in the launch, `permissions` is left out and Codex's configuration decides. |
| attach | `codex resume --remote unix://<socket> --cd <cwd> <thread id>`. Never a `-c` or a `--profile`: either one puts the TUI in embedded mode, which has no external surface (spec 9). The first attach in a new folder asks to trust it. |
<!-- cland-allow-closed-wording: pending requests and until uptake describe runtime delivery state -->
| inject | Idle: `turn/start {threadId, input: [], toolOutput: {name: "hub_event", namespace: "cland", output: <envelope>}}`. During a turn: `turn/steer {threadId, expectedTurnId, input}` with the envelope as text. The JSON-RPC result confirms `injected`; an error answer, or a connection that was not there to send on (or whose write of the request failed), leaves the message `delivered` for the next `idle` or the next reconnect. A request that went out and got no answer within `CLAND_INJECT_TIMEOUT_MS`, or whose connection closed, failed or brought a frame that is not JSON before its answer, is ambiguous (the turn may have started): the delivery is `uncertain`, never replayed on its own. A steer the app-server refuses because the turn just ended (`no active turn to steer`) falls back to `turn/start`. **What `injected` guarantees for Codex:** the app-server accepted the message, as a turn of its own or into the running turn; accepted into a running turn means the turn takes it up at its next step, which may be a while into a long command. Measured with Codex 0.160.0 (11 steers sent 5 to 120 ms after a turn's final answer): an accepted steer was always taken up, the turn going on to answer it, and a steer that came after the turn's end was always refused; none was accepted and lost. The adapter does not rest on that alone. It holds an input as owed only after its request is accepted, preserving any uptake or completion that arrived before the reply. Pending or uncertain requests are never recovery obligations. An accepted input stays owed, with the shape it was admitted in, until the turn announces it among its inputs (`item/started` or `item/completed` with an input item carrying the envelope's `msg_id`). Measured with Codex 0.160.0 (T-68), the check reads two item types: text input (a steer, a `turn/start` with `input`) is a `userMessage` whose `content` holds the text; a `turn/start` with a `toolOutput` (every delivery into an idle thread) is a `functionCallOutput` with `name: "hub_event"`, `namespace: "cland"` and the envelope as `output`. When a turn ends well with an input still owed, the adapter reads the turn back (`thread/read {includeTurns: true}`) and hands over again with `turn/start` whatever is missing from that turn's inputs. It judges only what the record can show: an input owed as a tool output needs a `hub_event` item in the turn (it started that turn), and a steer needs some input item there (it may join a turn of either shape). When the record shows no such item, the turn is missing from it, or it cannot be read, nothing is delivered again: the journal and the log get one `harness-turn-unread` per readback (`session`, `turn`, `ids`, `error`; an input whose acceptance came after its turn ended is read back on its own, so one turn can have two). A message delivered once and unverified is the lesser harm; until T-68 the check read `userMessage` items only, so every delivery into an idle thread was run three times and reported lost. If a newer turn starts during readback, the recovery can join it; that accepted recovery remains owed in the actual turn until taken up. Recovery uses the same admission reconciliation as the original injection, including failures that precede the reply. After two accepted recovery attempts still missing from their turns, the adapter stops and reports failure, so recovery cannot loop or disappear silently. The log and the journal have `harness-redelivered` (`session`, `id`, original `turn`, `admittedTurn`, `intoActiveTurn`) and Agents a `redelivered` record; a redelivery that fails is `harness-redelivery-failed` and is reported as a failed turn is (Agents and the inbox), and the original sender is told. An unanswered recovery request is reported as ambiguous (it may have been accepted) in that failure and is never replayed automatically. A failed turn names the messages it held (`turn-failed`), steered ones included. Confirmed model-capacity failures use the bounded replay policy above; other failures tell their senders without automatic replay. A lost connection to a live app-server is reopened at the next poll and what waits for an inject is retried then. |
| state | `thread/status/changed` for the session's thread id (the app-server sends it to every connection; other threads, such as ephemeral helpers, are ignored): `idle` → `idle`, `active` → `busy`, `active [waitingOnApproval]` → `waiting for approval`, `active [waitingOnUserInput]` → `waiting for human`, `systemError` → `idle`, `notLoaded` → `unknown`. Source `app-server`. The pid is checked every `CLAND_ADAPTER_POLL_MS` (5 s), and a lost connection is reopened and resubscribed. |
| usage | `thread/tokenUsage/updated` (the thread's total and last normalised under `usage.total` and `usage.last`; the original report including context window stays under `usage.tokens`) and `account/rateLimits/read` after each turn, plus `account/rateLimits/updated` (`usage.rateLimits`). |
| stop, resume | Stop sends SIGTERM to the app-server (its MCP children end with it), then SIGKILL after 5 s, each only after checking the pid's start time. Resume needs the pid alive and the socket answering `thread/resume {threadId, excludeTurns: true}` for metadata and live state without hydrating turn history (or `thread/read` while the thread has no turn yet). An older server rejecting `excludeTurns` as an invalid parameter is retried without that field. Unix WebSocket replies have a 512 MiB client limit, including full-history replies from older servers; a larger reply leaves the process running with `state: unknown` and `stateReason: "payload limit"` in `session.list`, displayed as `[payload limit]` by the CLI. The reason clears after successful reattachment or stop. A relaunch starts a new app-server on the same socket and resumes the thread from its rollout. |

For a nonlocal Host, Codex uses the Host layout's run/log directories and
spoke entries. `harnessId` remains the host-side socket; launch, resume and
reconnect obtain a per-session forward before JSON-RPC connects. Stop releases
that forward after the agent confirms termination; adapter close joins ongoing
operations and releases its forwards while detached app-servers survive. Host
and forwarded socket paths, including the terminator, must fit 104 bytes.
Stop fences and joins admitted reconnect forward/client/subscription work before
releasing resources. Confirmed exits keep their forward owner until cancellation
succeeds; a failed cancellation is reported and retried. Version checks and process stop execute through the host agent. Policy construction performs no Host path lookup when the role/harness has no sandbox. Remote role
roots are relative to the host checkout and canonicalized by Host.realpath;
absolute role roots refuse as hub-machine paths. A remote layout missing runDirectory
refuses before consulting paths. Canonicalization failure
refuses with the host/path rather than substituting a hub path. Network-local
profiles use the host discovery/run directories, cwd and host `/tmp` realpath,
with app-server run sockets denied. Local policy and long-path fallback remain
unchanged.

Failed launch recovery records the admitted Host, including native handshake
failures that have no accepted process row. Cleanup on an unknown or revoked
Host stays pending with a host-named incomplete diagnostic; it never chooses
local cleanup. Local cleanup errors retain their native text; the host-named
cleanup-incomplete prefix applies only to nonlocal Hosts. `LaunchRecoveryPending.settled` accepts the additive `LaunchSettled`
callback (`void | Promise<void>`). Shared `launch-settlement.ts` bounds async
settlement to 5000 ms and retains one producer across concurrent retries and
timeouts. Synchronous callbacks run inline. FailedLaunches and Sessions await
async cleanup before deleting the recovery record or releasing the role; rejection
or timeout retains the record and reports its cause for deferred retry. Codex
settlement closes its native client and cancels its forward. Shutdown joins
admitted recovery work; a missing receipt remains incomplete.

Remote Claude keeps generation-owned MCP/settings outside generic LaunchFiles
undo. Its failed-launch LaunchSettled callback re-adopts the exact agent receipt,
joins the native tree, confirms native job stop/absence, releases the job, then
removes private files and forgets the agent receipt. A lost accepted result never
replays --bg. Only the agent client's typed CLAND_AGENT_ADMISSION_REFUSED outcome
proves non-admission; an untyped error, even with that text, stays supervised.

HarnessAdapter.settleFailedLaunch(process) is optional. For a file-backed pending
launch, Sessions invokes it only when its captured recovery observer is absent
after restart; adapters without the member keep their current behavior. Claude
rebuilds the same bounded single-flight callback from generation-scoped adapter
state. Missing/mismatched state or an unproved agent receipt holds the row and
role as cleanup-incomplete. A terminal hub checkpoint covers a restart after
native cleanup but before the pending-stop transaction finishes.

After clearPendingStop is durable, only opted-in adapters' unpublished and
unpreserved launches receive forget(sessionId) as acknowledgement. A small
durable index holds only outstanding acknowledgement intents, normally empty.
Forget failure is logged without reopening the row. Startup prunes an intent
only if its pending stop is absent, through a shared tracked computation yielding
after 32 entries; Claude then removes only its settled generation marker/cache,
with no Host/native/file operation. Published/preserved rows retain their normal
archive/prune lifecycle. No retained-history scan or liveness work is added.


| Capability | |
| --- | --- |
| history | none: `Thread.path` is unstable and the rollout format is not a stable interface |
| usage | reliable: token counts and the account's rate limits |
| setModel | none |
| approvalRelay | reliable: command and file-change requests become records keyed by `<sessionId>:<nativeRequestId>`. Only the human answers through `approval.answer`: Approve once → `accept`, Always for this command → `acceptForSession` (Codex's session grant), Deny → `decline` (the turn continues). Codex has no note field, so an optional deny note goes to the session's item topic or General as the human's message. Command subjects carry command, cwd and reason; file subjects carry the matching turn/item's paths and diffs from `thread/read {includeTurns: true}`. Complete subjects fit within 64 KiB of serialized UTF-8 with no other tool input; oversized subjects are TUI-only, and any clipped text is informational, never authorization to answer from the hub. `serverRequest/resolved` closes an externally answered record as answered in the harness; pending-request replays rebuild the same ids on reconnect. Missing or malformed required fields fall back to `answerIn: tui` with no choices and a warn-level `harness-approval-unsupported` event. Other requests stay in the TUI. With `approval = "never"`, the default, a launched session sends no command approvals |
| busy, idle, waiting for approval, waiting for human | reliable (`thread/status/changed`) |

What the real Codex showed in the first smoke (0.160.0, `gpt-5.6-luna`): `turn/start`'s result arrives before the turn's `thread/status/changed`, so the adapter counts an accepted turn as `busy`. The TUI does not render the `hub_event` tool output, only the model's `cland.send` call and its answer. With `default_tools_approval_mode="approve"`, the cland tools ran without a prompt.

### The frames and the CLI

| Request | Result `value` | Who |
| --- | --- | --- |
| `{"type":"session.launch","id":…,"name":…,"role"?,"model"?,"harness"?,"effort"?,"cwd"?,"item"?,"brief"?}` | `{"process":HarnessProcess}`; a role's launch defaults fill the rest. `brief`: text or an artifact id, carried once after the clause in the first input. With `item`: `{"process","claim","worktree","reason"?}` (Task branches and worktrees) | UI, CLI, spokes whose role grants `session.launch` (Coordinator, Lead within its subtree, Aide on the human's word) |
| `{"type":"session.list","id":…, "archived"?:true}` | `{"archived":count,"processes":[HarnessProcess…],"pendingStops":[…],"adapters":{"claude-code":Capabilities,"opencode":Capabilities,"codex":Capabilities},"coordinator","rows":[SessionRow…]}` | UI, CLI, spokes whose role grants the separate `session.list` read (every role by default) |
| `{"type":"session.attach","id":…,"session":…}` | `{"command":"claude attach 1a2b3c4d"}` | UI, CLI |
| `{"type":"session.archive","id":…, "session":…}` | `{"process":…}`; stopped/exited only | UI, human CLI, Coordinator |
| `{"type":"session.prune","id":…, "olderThan":"7d","dryRun"?:true}` | `{"names":[…],"dryRun":boolean}` | UI, human CLI, Coordinator |
| `{"type":"session.stop","id":…,"session":…}` | `{"process":…}` | UI, CLI (Coordinator, Lead within its subtree, Aide on the human's word) |
| `{"type":"session.resume","id":…,"session":…,"relaunch"?:true,"fresh"?:true}` | `{"found","reason"?,"process","role","claim","notes", "fresh"?:{"brief"}}` | UI, CLI (Coordinator, Aide on the human's word) |
| `{"type":"session.retry","id":…,"session":…,"message":"<message id>"}` | `{"retried":true}`; force human input queued over 60 s through busy, or replay `uncertain`; optional `message` selects one delivery, omission chooses the oldest eligible one | UI, CLI |
| `{"type":"session.signal","id":…,"session":…,"launch"?:…,"event":…,"at":…,"payload":{…}}` | `{"applied","state"?}` | `cland hook` |
| `{"type":"session.bridge","id":…,"session":…,"launch"?:…}` | `{"bridged":true}`, then `{"type":"inject","session","message","text"}` frames | `cland hook bridge` |

`session.archive` archives a stopped or exited process row; a running row is refused with "stop it first". `cland session archive <name>` does the same from the human's shell. Only the human and Coordinator have permission; other roles are refused. The Coordinator's `session.archive` tool is fixed at launch, so relaunch an existing Coordinator after updating.

Default `session.list` and `cland session list --json` exclude archived rows and return `archived: <count>`. `session.list` with `archived: true`, or `cland session list --archived` (also with `--json`), returns only archived rows. Archived rows leave `hub.status.harnesses`, live groups, counts and the palette. Their `session.process` event carries `archived: true` and the archive layer, including when pinned. The process view carries nullable `stoppedAt`, `archivedAt` and `archivedBy` (`hand` or `rule`). Existing stopped rows gain nullable columns without journal backfill; later stops record their time. New launches under reused names replace these marks. The journal retains earlier launches and stops and appends `session-archived` with session, sessionId, by and actor. Successful native or fresh resume clears either kind of mark and journals `session-unarchived`; failed resume keeps the archive.

Stopped or exited crew sessions archive automatically. Implementers use their launch item or claim; Reviewers and QA use their latest held item, remembered on the process row even after holds release. A closed or merged item starts the one-hour window from its indexed close time or merge receipt. Reopening cancels that clock. Otherwise the row uses its stop time and the 24-hour window; Leads, Coordinators and sessions without a role always use this rule. Aides never archive automatically.

The windows are read at hub start from `.cland/config.toml`:

```toml
[sessions]
archive_after_item = "1h"
archive_after_stop = "24h"
```

Durations are positive integers with `s`, `m`, `h` or `d`. The hub sweeps once at startup, then sleeps until the earliest eligible row’s archive deadline; with no eligible rows it leaves no archive timer. Process lifecycle changes and changes to a stopped row’s associated item close time coalesce into one sweep on the next event-loop tick. Unrelated item updates do not trigger a scan. A due row archives on that next tick (plus normal event-loop/I/O scheduling); a pending lifecycle operation or failed-launch recovery defers it until that operation or recovery settles. Delays beyond Node’s maximum timeout (about 24.8 days) use a capped wake-up and re-evaluate the deadline, never a 1 ms overflow loop. Every due row commits in one process-table transaction; each publishes one changed `session.process` and journals `session-archived` with `by: "rule"` and `rule: "item" | "stop"`. Legacy undated terminal rows receive the first sweep's time; cleanup never backfills from the journal. The `session.process` envelope includes the authoritative `archived` count, so the panel can update its header without fetching archived rows.

`cland session prune --older-than 7d` deletes only archived rows whose **stop** is older than seven days, along with their remembered presence/role, stored usage, claim/hold and pending bookkeeping. `--dry-run` lists the names without deleting; `--json` returns `{names, dryRun}`. Messages, topics, artifacts, tracker files and the journal remain. A real prune journals one `sessions-pruned` record listing the names and publishes `sessions.pruned` with their identities and the remaining archive count. The human's shell and Coordinator may prune; other roles are refused by the permission table. Relaunch an existing Coordinator after updating so its launch-fixed tool list includes `session.prune`.

`session.resume` returns `role` (the restored role or null), `claim` (the currently owned item id or null) and `notes[]` describing what did not return. An occupied exclusive role stays with its current holder; a closed or reassigned item stays unclaimed by the resumed session. Verifier holds are released at stop and never restored: the verifier must retake them. The role clause is delivered again on the resumed hello. A successful relaunch journals `session-resumed` with `relaunched: true`, the role, claim and notes.

Native resume requires a recorded harness conversation id and a successful adapter resume. When it cannot resume, the answer has `found: false`, `reason` and `fresh: {brief}`: the original brief text or artifact id, or null (`no brief recorded` on older rows). Only a new request with `fresh: true` starts an ordinary fresh launch. Both paths retain the cland identity, so a valid item claim stays owned without taking another session's claim. At launch the process table records the original brief (artifact ids stay ids), harness, model, effort, cwd and launch item; fresh launch uses those settings and resolves an artifact brief again. A running session must be stopped before launching it fresh. Cleanup still pending after an adapter failure is a frame error; a fresh launch waits for cleanup.

`HarnessProcess` is `{"name","harness","role","label","model","cwd","item","pid","harnessId","sessionId","harnessSessionId","startedAt","status","state","attach","usage"?}`; `hub.status` lists them as `harnesses`.

`usage.total` is the running total for that launched session; `usage.last` is its latest Claude Code turn,
OpenCode step (one assistant message), or Codex turn. Both use the same shape:
`{totalTokens, inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens, cost?}`.
`inputTokens` counts uncached input; cache reads and writes are separate. `totalTokens` includes all input
(including cache) plus output; reasoning is a subset of output and is not added again. Codex's own
`totalTokens` is authoritative; its input count is normalised by subtracting cached input. Token categories
not reported by a harness are zero (Codex has no cache-write count). `cost` is USD when the harness reports it,
including zero, and otherwise absent; the hub does not estimate it from model prices. `usage.model` names
the latest reported model, not a model for the whole accumulated total.

The sessions panel shows `usage.total.cost` when positive, otherwise `usage.total.totalTokens`; the item view's
cost is the claiming session's `usage.total.cost`, including zero, or unknown when unreported. Counts are absent
until a usage report arrives (Codex can report only rate limits at first). The last totals are kept on the
launch's process row, so `session.list --json`, `session.list --archived --json` and the workbench rows show
them after a restart, a stop and an archive. Claude Code and OpenCode sum the reports this hub received;
after a restart that in-memory sum is seeded from the row's stored totals, so a new turn or step continues
from there, while reports missed during the disconnection are not recoverable. A relaunch of the same
conversation keeps the stopped row's totals for the same reason. Codex supplies its thread's running total,
which survives with the thread and replaces the stored total on each report; a reconnect that has only read
rate limits keeps the stored total and model until a token report replaces them. A new launch under a reused
name starts a new total; a reconnect keeps the row's totals until the adapter reports again.

| Command | What it does |
| --- | --- |
| `cland session launch <name> [--role r] [--model m] [--harness claude-code\|opencode\|codex] [--effort e] [--cwd dir \| --item T-<n>] [--brief text\|A-<n>]` | Launches a session through the hub; with `--role`, the role's launch defaults fill what is not given. `--item` starts an Implementer in its task worktree, or a Lead on an open epic/release at the project root, with the node's claim. `--brief` starts its first turn on that text or artifact's content after the role clause. |
| `cland session list` / `attach <name>` / `stop <name>` / `retry <name> <message id>` | As the frames above. |
| `cland session resume <name> [--relaunch \| --fresh]` | Re-finds the process. `--relaunch` restarts a stopped/exited session on its harness conversation, preserving its name, role and valid item claim; a live process is stopped first. If the harness cannot resume, prints the reason and a `--fresh` hint, exits 1. `--fresh` launches a new harness conversation with its recorded brief and launch settings. |
| `cland hook <event> --session <name> [--launch <id>] --hub-file <path>` | Posts one signal, stamped with the process's start time (or the payload's `at`), with the harness's JSON payload from stdin. Only the fields the hub reads are kept, and a prompt is reduced to the message ids it carries. Signal handlers always exit 0; synchronous refusal handlers are listed separately. |
| `cland hook worktree-create --session <name> --worktree <path> [--launch <id>] --hub-file <path>` | Claude Code's `WorktreeCreate` hook in a session launched with an item: names the session's own worktree on stderr, tells the hub, exits 2. A synchronous refusal hook. |
| `cland worktree list` / `prune [--yes]` | Task branches and worktrees, under Local git territory. |
| `cland hook literal-rm` | Local Claude Code Bash `PreToolUse` guard: reads stdin, refuses computed rm/rmdir targets with stderr guidance and exit 2; literal paths, `git rm` and heredoc bodies pass. No hub or network needed. |
| `cland hook bridge --session <name> --hub-file <path>` | The mod's connection to the hub. It prints each `inject` frame as a JSON line, reconnects through `hub.json` after a hub restart, and ends with its parent. |

`CLAND_CLAUDE_BIN` names the `claude` executable, `CLAND_INJECT_TIMEOUT_MS` (60 s) how long an inject waits for its confirmation.


<!-- Implementation guidance moved from the implement skill. -->

For web composer file uploads, use the sealed HTTP/frame and isolated Headless
Shell seams in `docs/agents/tests/hub-test-web-upload.test.ts.md` and
`docs/agents/tests/web-test-uploads.test.ts.md`. Admit cookie/Host/Origin before
bytes, bound multipart wire and per-file sizes, and pass byte views beside the
web conversation’s artifact.upload frame. Transfer the private HTTP buffer through
trusted transport metadata; native callers keep a protective copy. Revocation and
edge close fence commit and join upload writers/rollback before returning. Register
request/control ownership before POST, bound exceptional drainage separately from
setup, and keep omitted/aborted setup controls. Keep existing artifacts optional for
old clients and restore failed file drafts in memory. No new role clause or key.

For OpenCode Console login diagnostics, use the injected auth-list seam in
`docs/agents/tests/hub-test-doctor-harness-probe.test.ts.md` and the scripted
native failure seam in `docs/agents/tests/hub-test-opencode-native.test.ts.md`.
Keep default-store and selected-database logins separate; report the printed
standalone login command without reading or copying the human's credentials.

For adapter shutdown, preserve both synchronous and promise-returning `close`
implementations. Drain transient native CLI callbacks before releasing storage;
use the scripted close/drain regression and held real-query resource check in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md` and
`docs/agents/tests/hub-test-scenarios-hook-bridge.test.ts.md`. Fence late resume
and identity-probe results before restarting supervision; use the held-result
matrix in `docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md`.
For Claude Code crash regressions, follow
`docs/agents/tests/hub-test-claude-code-adapter.test.ts.md`: advance the injected
clock inside the bounded exited-row wait; one advance is not an exit receipt.

For Claude poll authority, use the 37-second scripted regression in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`; cover both pushed
idle delivery and the no-push unknown launch.

For Claude delivery confirmation, require the exact envelope-bearing turn-start;
the legacy mod `injected` frame proves submission acceptance only. Use the
re-exec bridge regression in `docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`
and the fake-clock alarm routing in `docs/agents/tests/hub-test-inject-stalled.test.ts.md`.
The advisory `deaf` policy and recovery are described in the dedicated
"Deaf delivery supervision" section below. Codex's native app-server confirmation
and startup receipts remain in `docs/agents/tests/hub-test-codex-delivery.test.ts.md`.

For Web load-race checks, use `resizePage` and the positive receipt guidance in
`docs/agents/tests.md#web-load-race-guards`. New Web files have a separate
report-only ten-file-repetition check with two workers and owned CPU load after
ordinary Web timing, under the same machine lease. Verify retains the exact
count. Host admission carries `webRepetitionFiles` from the HEAD/fetched-dev
merge base; the runner does no Git lookup. An absent field is missing proof,
while `[]` means checked none new. Before restart #54 absent-field reports are
expected; the Coordinator records post-restart droplet counts as landing
evidence, not a pre-merge gate. Incomplete or skipped receipts are missing proof. Do not run this CPU
check as an unleased local probe. No role-clause expansion is needed.

For browser sign-in probes, follow `docs/agents/tests.md#browser-sign-in-fixtures`: `cland web` is human-only; use a disposable project and test client, with scratch browser opener stubs. Cookie sessions persist for 30 days from creation; `web --sessions` and `web --revoke <id>` are also human-only Unix-socket commands. Test clients use those frames on disposable projects, never the live session actor. `web.session` reads only the sign-in bound to the authenticated web socket, with no cookie or identity selector; `session.history` is a bounded human-client read across topics, separate from spoke `history`. Web launches refuse every own `cwd` field; local launches keep it. Web authority changes update the explicit deny-by-default policy and its protocol conformance test; use the same section for T1 policy and T2 web/Unix fixtures. In users mode local human connections default to the first user (the five named human writes may select an active user with `as.name`), while web identity comes only from the cookie session's persisted user_id (including uploads). Keep WebSessionResult.user optional for older hubs, audit userId optional in single mode, and web as refused. Profile displays the authenticated user's displayName. Human artifacts in users mode carry optional creatorUserId and the acting user's name as creator; artifact journal events carry userId. Agent artifacts and single-mode human artifacts omit creatorUserId. Preserve Host source reads and transport-owned upload bytes; use docs/agents/tests/hub-test-artifact-user.test.ts.md for attribution regressions. In users mode call `userAuthorityRefusal(users, transportUserId, frame)` before replay and actor resolution; it rereads the durable role each time. Reuse this seam for CLI acting-user and gateway integration, retaining each transport's restrictions. Plain authority rows default to admin; `{ web, roles }` rows supply explicit grants. Only admin ships; refusal code `forbidden` names the stored role and request. Single mode keeps the existing web refusal shapes. See `docs/agents/tests/hub-test-web-authority-unit.test.ts.md` for role-policy tests.

For approval records, use the sealed frame and recorded-client seams in `docs/agents/tests.md` (Approval record changes). Retain the existing inbox fields, the session-scoped native id, the 64 KiB subject allowlist and the explicit outcome; Claude Code's record stays TUI-only. For `approval.answer`, use the same doc's scripted fake adapter and authenticated web-cookie checks: only the human answers, Aides are refused, the first answer reserves `answering`, and delivery failure restores `pending` with a warning. Keep Deny intact and verify the native note or human message fallback; nothing answers by default. Neovim approval keys use the recorded-headless inbox seam in the same section: assert the outbound choice/note, live delta, attributed fold, race archive lookup and TUI-only no-send/attachment boundary.

For Codex long-thread reattachment, use the scripted native and Unix WebSocket seams in `docs/agents/tests/hub-test-codex-native.test.ts.md`: metadata-only resume, older-server compatibility, frame-limit classification and the CLI payload-limit reason. No harness process is needed.

For Codex provider-capacity replay, use the fake-clock/native-readback seam in
`docs/agents/tests/hub-test-codex-delivery.test.ts.md`: exact input, bounded
backoff, ownership cancellation and one terminal lead report. Preserve ordinary
failure notices and the explicit human retry for uncertain admissions.

For the Codex approval relay, use the scripted native frame seam and explicit fake-binary contract receipt in `docs/agents/tests.md` (Approval record changes). Prove native decisions and shared request ids, including replay, external resolution across readback/disconnect and malformed or oversized subject TUI fallback; file approval subjects come from the matching turn/item. The contract receipt must show that Deny continues without running the command.

For OpenCode relay changes, follow `docs/agents/tests.md` (The OpenCode relay) for scripted native reply, child/reconnect/shape checks and the targeted fake-binary Deny-with-note receipt, separate from mode-free task coverage.

For adapter Host boundary changes, run `hub/test/host-boundary.test.ts` (T1).
Its recursive discovery covers new adapter files. Keep each native exception
named with a reason, and prove forbidden calls with fixture sources; never plant
a bypass in the real adapters. See `docs/agents/tests/hub-test-host-boundary.test.ts.md`.

For external tracker saves, use `reindexedAfter` (or `removedAfter` for deletion)
from `hub/test/tracker-reindex.ts` before checking projections. Healthy native
watching has a 5 s safety stamp check; failed watching uses 500 ms. Receipt waits
allow 15 s for loaded hosts and keep final semantic assertions.

For Discord files and voice in either direction, use
`docs/agents/tests/hub-test-discord-inbound-media.test.ts.md` and
`docs/agents/tests/hub-test-discord-artifacts.test.ts.md`, and reuse Telegram's
paths: `artifact.upload`, `voiceNote`, `artifactPlan` and `artifactBody`. Inbound,
keep original MIME, name and bytes, admit voice by duration before any CDN
download, and refuse redirects, foreign hosts and credentials on CDN GETs; a
refreshed URL repeats every check of the first download. Outbound, queue ids and
captions, bind bytes through no-follow descriptors at delivery, and keep each
request within ten files of 20 MiB and 25 MiB encoded, multipart envelope
included; fakes check the whole encoded body, not only file sizes. Keep the
original enforced nonce and its deadline, an empty `allowed_mentions`, and old
JSON callers and persisted payloads.

## Claude lifecycle

For Claude Code launch identity changes, use the settings/environment,
sealed frame and native lifecycle seams linked in
`docs/agents/tests/hub-test-claude-code-sessions-lifecycle.test.ts.md`.
Keep stable session/conversation ids separate from `CLAND_LAUNCH_ID`. Relaunch
needs a native stop or captured-job absence from a query invoked after the failed
stop, including after PID exit; drain earlier shared queries before that proof.
Require generation after resolved admission identity, revoke existing
spokes/bridges at rotation, and preserve legacy rows without generation metadata.
Native inspection distinguishes duplicate, positively same job and unavailable;
only same-job proof permits `/clear`. Supplemental native fixture spokes, hooks
and bridges explicitly use `claudeLaunchIdentity` from
`hub/test/claude-launch-fixture.ts` to read their recorded immutable settings;
never infer a generation inside transport helpers or alter omitted/legacy
controls. Partial-settings fault injection targets the new generation directory. Join deferred checks on shutdown and fence
them against newer hooks, generation and lifecycle changes. Use the single
`#hookRevision`/`#activity` and directory observation owner for both retirement
and pending native-identity inspection; ordinary same-conversation hooks retain
independent verified PID acquisition. New component regressions compose the
shared pre-registered acquisition/observation owner through
`hub/test/claude-component-fixture.ts`; follow its
[setup cancellation and removal controls](../agents/tests/hub-test-claude-component-fixture.test.ts.md).
Bound full setup separately, join late clients/spokes and observations, and keep
a successful-drain guard on root removal. Existing role clauses
cover these boundaries; add no clause lines.

For Claude daemon retirement, use the fake-clock/native-CLI seam in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`. Only fresh successful
job observations retire a listed launch; retain known live PIDs behind missing
listings. Preserve re-exec grace and newer hook identity, pin terminal decisions to the admitted job, and fence native queries
against newer same-conversation hooks and watched launch/job replacement while
allowing verified late PID discovery. Recheck the captured job after native
identity probes before publishing a PID. Keep the `coordinator-retired` inbox kind compatible with generic message clients,
key its remedy by session and native job, and retain restart, reconnect and
failed-query controls. No role-clause or command changes are needed.

Init/update write local `gc.auto=0` and `maintenance.auto=false` for the common
project repository and existing territory; doctor reads and reports both keys.
Use the disposable init/update/doctor/native-fetch seams in
`docs/agents/tests/hub-test-init.test.ts.md` for changes to this policy. Ordinary
worktrees inherit common config unless explicit Git overrides supersede it.
Do not apply configuration to the live project as a test. Existing role clauses
cover this flow without adding permission lines.

See `docs/agents/interaction-scanner-baseline.md` for retained fallbacks and
`docs/agents/tests/hub-test-suite-selection.test.ts.md` for the regression seam.
Selection evidence must use a hosting hub containing the scanner fix.

## Claude fallback liveness fixtures

For synthetic Claude resume identities, follow the injected fallback observer
and positive-controlled spawn guard in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`.
Keep the native-default real-PID control in T3 as described in
`docs/agents/tests/hub-test-system-processes.test.ts.md`.

Hub acquisition opts into `HubLockOptions` with a captured hostname, boot id and
PID namespace. Keep generic locks unchanged. Use the injected acquisition/reader
seams in `docs/agents/tests/hub-test-hub-lock-identity.test.ts.md`; `projectHub`
captures the native lock identity by default so local CLI readers share its PID table. Identity-only foreign controls opt into explicit synthetic identity. Initial heartbeat persistence
does not prove periodic refresh. Stamp it after guard retries; malformed new
identity refuses with `InvalidLockIdentity`, including through `readLock`, and
never becomes legacy PID authority. Foreign holders and break-guard owners are
never probed by PID; only a heartbeat older than 60 s proves lapse. Legacy
records keep their prior rules; mixed versions on one volume are unsupported.
For periodic refresh and lost-lock shutdown, use
`docs/agents/tests/hub-test-hub-lock-heartbeat.test.ts.md`: drive time through the
hub clock, retain whole-file and foreign-refusal receipts, and observe normal
shutdown before checking the successor lock. A heartbeat write failure retries
without shutdown; only a confirmed replacement token proves ownership lost.
Lifecycle readers use `readForeignHolder`/`foreignHolderInfo` before PID or socket work; offline migration uses synchronous hub-aware acquisition while generic async locks remain host-unaware. For CLI/doctor/orphan preservation and the foreign-reader seam, use `docs/agents/tests/hub-test-hub-lock-readers.test.ts.md`. Stop refuses foreign holders even after lapse and retains their files. Capture native lock identity across every native-to-embedded restart. No role permission changes apply.

## Host agent protocol (T-1588)

For host agent operations use the authenticated Unix stream and native CLI seams
in `docs/agents/tests/hub-test-host-agent.test.ts.md`, plus the T1 dependency
boundary guide. Keep protocol version independent of cland version; persist birth
identity before native execution through the durable admission/bootstrap gate,
release only after the process checkpoint, and checkpoint exits before events. Kill/restart
proof observes native agent close and rechecks the surviving child identity.
Capture descendant births while PPID ancestry is intact and retain them across
detachment, root close and restart. A descendant that escaped before any capture
is outside both Hosts’ authority and is never signalled; host recycling clears it.
An exit missed during agent downtime keeps unknown authority and refuses stop
until host reboot/recycling; do not add a Node supervisor per launch. The agent
has no systemd dependency or launch-memory gate. No role grant changes.

The additive file/command operations share the local Host implementations under
`host/agent/`: `statDirectory {path}`, `realpath {path}`, `fileType {path}`,
`listFolder {path}`, `occupants {path,sessions:[{name,cwd}]}`, and `freePort {}`.
`readFile {path}` returns a base64 string with a 512 KiB decoded cap (regular
files only, including through symlinks); `writeFile {path,bytes,options?}` accepts
canonical base64 with the same cap and optional `mode`/`truncate`. Empty bytes
are required for truncate. `makeDirectory {path,mode?}` creates one directory;
`removePath {path,options?:{directory?:boolean}}` removes only that path or an
empty directory, without following symlinks. Mutations return null.
`run {command,args,cwd,env,timeoutMs?}` returns `{code,stdout,stderr,error?}`;
timeout uses the local Host owned-group SIGKILL and native-close boundary.
`worktreeAdd {root,path,branch,territory?,reuseOnly?,detached?}` returns
`{warning?}` with the shared root-install link/staleness policy;
`worktreeRemove {root,path}` refuses dirty worktrees. The hub-side beforeInstall
callback is not serializable and is absent from this wire operation. Existing
protocol 1 process operations and hello shapes remain unchanged. Responses over
the 1 MiB frame cap are errors. See the
[file-operation test guide](../agents/tests/hub-test-host-agent-files.test.ts.md).

## Per-host Git socket (T-1591)

For the Git listener and proxy, use the scratch bare-repository seam in
`docs/agents/tests/hub-test-host-git-daemon.test.ts.md`. Keep half-open sockets
on both ends, explicit receive policy, eight-daemon admission and native exit
receipts before removing scratch roots, including permission failure after bind.
Use the optional chmod operation seam to hold/fail setup while a native client
is admitted, then observe native close and socket removal before rejection.
Transport owns listener lifetime and
socket paths; territory hook and branch leases belong to their own module.
No CLI, dependency or role permission is added.

## Local Host process contract (T-1542)

Fake SSH tests use the real carrier with `sshBinaries(env)` from
`host/ssh-binaries.ts`; set both `CLAND_FAKE_HOSTS` (names) and
`CLAND_FAKE_HOST_ROOT` (scratch root) before overriding binaries. Use
`createFakeHost` and the subprocess seam in
`docs/agents/tests/hub-test-fake-ssh.test.ts.md`; loopback destination ports
are Unix mappings, and no stand-in opens TCP. The droplet executor still reads
these overrides ungated for its separate fixtures (migration: T-1626).
No new role permission applies.

For Host process operations, use the reusable factory contract described in
`docs/agents/tests/hub-test-host-local-contract.test.ts.md`. Preserve native birth
and legacy timestamp semantics through the existing identity/liveness/termination
functions. Resource samples sum resident bytes and ps CPU percentages across the
tree; they do not measure launch capacity or enforce a new gate. No new role
clause or permission applies.

## Host records and private bootstrap material (T-1590)

Use `Store.hosts`, `HostSecretStore` and `hostPaths` from `host/records.ts` for
host persistence and private paths. Registration takes a client key path and
known_hosts line; bootstrap transports deliver private secret bytes only on stdin.
The fake hook requires the comma-separated `CLAND_FAKE_HOSTS` list and absolute
`CLAND_FAKE_HOST_ROOT` together. Never remint revoked records during startup.
See `docs/agents/tests/hub-test-host-records.test.ts.md` for isolated coverage.
Admission and connection revocation stay with the host authority owner.

### Host-secret admission and revocation

A host secret is accepted on the Unix spoke edge and hub socket only. It never
represents a human user. A spoke must prove a credential bound to that host and a role-holding session.
Before process-row publication, the validated launch reservation supplies the
host and role; afterwards admission uses the running durable row. The proved
identity is passed intact into core admission, including anonymous first hellos;
a token for one session cannot join another live session. A host
client must carry that session's credential on every request, including hooks
and the mod bridge. `host/host-authority.ts` denies unknown and human-only frames
before user resolution, replay or dispatch; allowed requests still use session
permissions. Host clients cannot subscribe to human snapshots. The project
secret's existing edge admission is unchanged; host secrets do not admit TCP,
web or stdio clients.

`cland host revoke <id>` requires the human CLI or Neovim on a local connection
(and an active admin in users mode). It persists revocation, fences further
frames and closes that host's connections. Later host hellos name revocation
without exposing credentials. Restart never re-mints a revoked secret. Before cutting authority, revoke runs
the bounded [host generation settlement](../agents/host-agent.md#settlement-before-host-revocation)
and returns named leftovers or an explicit unknown inventory.

## Local Host files and polling (T-1543)

For remote row liveness and signals, use the recording registry Host and
projectHub frame seams in `docs/agents/tests/hub-test-session-host-routing.test.ts.md`.
Keep Linux boot/start proof matching at the registry boundary, timestamp upgrades
local-only, and unknown hosts fenced. Preserve the unedited local stop-races and
async-processes files. Remote pending-stop recovery does not require `pid_started`.
Remote Claude pending/replacement PID discovery also accepts Linux proof without
a legacy timestamp, bound to its captured native job and conversation; retain
stale owner, changed birth and close controls. For adopted remote Claude workers,
terminal PID observation owns one bounded native settlement before exit
publication. At most one stop and one absence query run within the stop deadline;
a generation marker permits one retry through re-adopt on the next hub start.
Unconfirmed settlement holds the running row and role with `state: unknown` and
`stateReason: cleanup-incomplete: <cause>`. Recurring liveness/discovery stay
CLI-free, including after a failed settlement. This is an event-driven cleanup
exception to subscription-auth polling suppression.

For Codex process routing, use the recording Host and scripted app-server seam in
`docs/agents/tests/hub-test-codex-host.test.ts.md`. Preserve one version check per
launch, the log path, final credential filtering, birth identity and Host stop.
Capture the launch Host once and retain its name on internal and returned rows.
Await Codex close in fixture cleanup; held probes coalesce, admitted lifecycle
work drains, and a late accepted launch retains ownership through rollback.
Keep the four existing Codex preservation files unedited. Sandbox roots and
socket policy paths use the captured session Host; preserve exact local profile
bytes using the fixture in `codex-sandbox-host.test.ts` (see its per-test guide).
Hub-local socket/file creation remains separate work; no role clause or CLI change applies.

For OpenCode lifecycle routing, use the recording Host and scripted transport in
`docs/agents/tests/hub-test-opencode-host.test.ts.md`; keep the existing adapter and
native test files unedited. The launch-policy fixture alone models native
spawn/exit receipts; its test bodies and assertions stay unchanged. Host spawn accepts optional
`logFile` (host-side append of both output streams) and returns required `exited`
with a native `{ code, signal }` receipt. Register its PID and receipt immediately
with `LaunchFiles.spawned`; rollback stops through the Host and joins completion
before file undo. After a positive stop acknowledgement, the captured native exit
receipt has a separate `LAUNCH_SETTLEMENT_MS` (5000 ms) bound; expiry reports
`cleanup-incomplete` and retains both the child and every file undo. The current
owner caches that expired wait and never repeats the acknowledged stop. Retries
can undo files only after that same captured native receipt resolves. Concurrent
rollback callers share one producer. The bound is injectable in the internal
LaunchFiles constructor for tests; restored journals retain the previous shape
and use their existing Host identity/closure proof instead of an inherited native
promise. Every Host implementation, including test Hosts, supplies its receipt.
`HostSpawnOptions.authorize` runs after async log preparation immediately before
native spawn; refusal closes the log without launching. Post-spawn log-close
failure is diagnostic and retains PID/exited ownership. Keep held resume/stream,
late accepted launch (durable recovery enabled), open-revocation and native
close-fault controls. Close joins operations and rolls back before releasing
files; fault injection owns a separate native cleanup receipt even on red.
No CLI, setting or role permission changes apply.

Process rows persist an owning `host`; opening an older database adds the column
in place with `local` as its default. Older adapter results and pending-stop
receipts without a host retain local semantics. Local session wire views omit
this storage field. Doctor and the orphan sweeper read only local rows, including
when a remote PID collides with a native PID; pre-column snapshots remain readable.

For tests, `CLAND_TEST_HOSTS=t1,t2` registers named test Hosts in project hubs;
in-process callers may pass `hosts` to Sessions, projectSessions or serveProject.
Without that environment or option only local exists. Each test Host operation
writes `test-host-operation` with `host` and `operation` to the hub logger.
Its identity operation returns synthetic `linux:` birth identities, liveness is
false, stop grants no authority, and spawn refuses with a test-host reason.
File and command operations also refuse without native work. An unregistered
host stays `unknown`, has no attach command, and refuses resume/stop before any
adapter operation. No CLI placement flag or role permission is added.
Native orphan fixtures seal after the last environment overlay; preserve explicit
scratch HOME, database and config inputs through `scratchAccountEnvironment`.

For sessions routing, use the recording local Host seam documented in
`docs/agents/tests/hub-test-session-host.test.ts.md`. AdapterHost lookup callbacks
are optional for older standalone adapter fixtures. Inject `hosts: [local]` into
Sessions rather than separate process probe functions. For default-adapter
environment wiring, `projectHub`/`serveProject` also accept `hosts`; see
`docs/agents/tests/hub-test-project-hub.test.ts.md`. Production lookups resolve hosts through the registry (T-1552)
and refuse unregistered hosts. Read rollback mode and size through Host.stat for every Host, and preserve
old pending-stop receipts. No CLI flag, setting or role permission changes.

Claude Code rows on a Host other than `local` run one `claude agents --json`
for each launch and at most one for an explicit restart resume. Discovery is
isolated by host and session and never writes the local directory schedule.
A relaunch drains any predecessor query before its fresh launch discovery.
Timers run only Host liveness with the recorded Linux birth identity; hooks and
the mod bridge supply state. A missing launch PID remains supervised as `running`
with an unknown PID, logs `harness-pid-unknown`, and receives no timer discovery
or PID probe. Explicit resume can discover it once. A claimed warm spare keeps
its PID. Explicit stop and native-identity hook reconciliation still use Host
commands. Local directory polling and its persisted schedule stay unchanged.
No CLI, setting or role permission changes apply.

Host transport readers import `TransportKind` and `parseTransportKind` from
`hub/src/host/transport-kind.ts`; no second kind allowlist. The interim config
validator checks only explicit pool transports. Startup classifies only
`hosts.<pool>.transport:` refusals as fatal; preserve unrelated host keys when
replacing the validator with pool parsing. Use the sealed scratch start/reload
cases in `docs/agents/tests/hub-test-transport-config.test.ts.md`.

For Claude Code Host routing, use the recording seam in
`docs/agents/tests/hub-test-claude-code-host.test.ts.md`. Preserve the unchanged
adapter, sessions, schedule, accounts and environment files as controls. New
fixtures inject the Host; old local synthetic process observers remain compatible.
Keep directory discovery timing and hub-side private launch files unchanged.
Bare-PID local Host liveness is an existence-only probe without a subprocess;
recorded proof keeps identity-aware liveness. Preserve the unedited native Lead
death/routing regression when changing that path.
Host.stop captures birth records before hub-side callbacks and rechecks authorize
before signals; callback payloads contain only plain process data. Keep the
owner logger, absent-process success, reused-birth refusal and shutdown drainage
cases in the shared Host contract. No CLI or role clause change applies.

Task launch creates a missing task branch in the territory under the territory
lock before calling the launch Host. Local publication requires an absent-ref
lease and a native new-ref receipt; an up-to-date result grants no ownership.
The Host fetches the captured commit without reading or writing FETCH_HEAD. On
local the base is the root task-base tip (including unpublished commits), pushed
into the territory; on a nonlocal Host the base is the territory task-base tip.
The local Host adds the linked worktree in the root repository; branch names,
paths and task-worktree journal fields retain their existing form. An existing
territory branch supplies its tip; a root-only branch keeps its local tip.
Failed add rolls back newly created refs only at their captured tips and without
a registered worktree. Territory config `branch.<name>.clandLaunchBase` records
launch-created refs: prune deletes those refs only while unchanged at that base,
retaining pushed commits and pre-existing territory branches. Calls that omit the
optional worktreeAdd territory source keep legacy local-ref behavior.
No command, setting exposed to the human, or role permission changes.
Use `docs/agents/tests/hub-test-territory-task-branch.test.ts.md` for the branch-first scratch fixture.

For task creation/prune Host routing, use the recording Host and native Git seam
in `docs/agents/tests/hub-test-worktree-host.test.ts.md`. Keep the four named
worktree regression files unedited. List and prune occupants, including the final
pre-Git check, come from Host.occupants; path identities come from
Host.statDirectory and Host.realpath. Keep the recording Host controls for
alias-only occupants and raced session/worktree identities. Territory owns policy and the lock; Host add
owns install warnings on creation and reuse, after its beforeInstall confinement
and authorization barrier. Keep held revocation and install-failure controls.
Legacy injected WorktreeGit overrides
use host/legacy-worktree-git.ts, keeping install handling outside TaskWorktrees.

For artifact source routing, use the recording Host/frame cases in
`docs/agents/tests/hub-test-artifact-host.test.ts.md`. Keep file type, folder
listing and bytes on the caller Host; human and hub-owned sources stay local.
Upload bytes remain frame-owned; stored attachment types use local. Preserve
legacy createArtifact callers and leave creator attribution to its own item.

For Host launch files, use the recording cases in
`docs/agents/tests/hub-test-launch-files.test.ts.md`. Journal writes with
LaunchFiles.write; rollback uses Host write/truncate/remove operations and retains
the previous durable journal format. Undo metadata uses Host.stat; existing files restore their bytes and permissions,
appended logs restore their size, and new files use Host removePath. The local
layout resolver preserves discovery/node/CLI/spoke inputs and derives run/log
paths beside discovery; freePort probes then releases IPv4 loopback, and local
forward/unforward preserve endpoints. Adapters resolve their launch paths from the selected Host layout. Claude writes
its private settings and MCP files through LaunchFiles; the layout's optional
modDir supplies --plugin-dir. The local Host supplies the historical installed
mod directory; a nonlocal Claude layout without modDir refuses launch. The SSH
Host uses a supplied installed host mod directory. SSH Claude launch/adoption
requires `claude-launch-adopt-v1`: the agent performs the one discovery and pins
the worker before granting stop authority. See [SSH Host](ssh-host.md). Codex uses layout run/log directories and
node/spoke/discovery entries, preserving the local long-socket fallback. Its
network-local sandbox denies the canonical Host run directory that contains the
app-server socket, alongside the local temporary socket fallback; discovery-only
standalone policy callers retain the legacy discovery-relative denial. OpenCode
uses layout discovery/node/spoke entries, Host password reads and freePort.
Its shared-ignore algorithm in adapters/opencode/ignore.ts uses Host atomic
create-only publish and append on both local and nonlocal Hosts, preserving
existing contents and repairing a missing wildcard. Keep session-launch and
session-stop-races controls unedited.

Use the reusable Host contract for directory identity/refusals, exact file bytes,
folder safety, worktree add/remove and alias containment. Keep shared install
diagnostics in host/worktree-install.ts. The local limitPolls flag preserves idle
polls; AccountPoller checks it again when queued work starts. Keep both existing
account-poller test files unedited. The T1 member inventory detects omitted Host
members, while source review checks assertion quality. No role clause is added.

### Host agent supervisor

Start the POSIX shell loop in its own session on Linux:
`setsid nohup sh hub/src/host/agent/supervisor.sh "$CLAND_HOST_RUN_DIR" node hub/bin/cland.ts host serve </dev/null >>supervisor.log 2>&1 &`.
Use absolute code paths and a private run directory; supply `CLAND_HOST_SECRET`
through the environment. The loop ignores SIGHUP and waits one second after
agent exit before restarting it. `CLAND_HOST_NODE` selects the Node runtime for
native-birth and version-selection helpers, defaulting to `node` on PATH; SSH
bootstrap supplies the layout's pinned runtime. The initial command can use an
exec wrapper, independently of that helper runtime. Version replacement starts
the standalone entrypoint through the selected Node runtime. Startup time adds
to the restart delay. The agent also
ignores SIGHUP; harnesses stay in their independent sessions and retain the
existing process-table identities across agent restart. A missed harness exit
still leaves authority unknown under the protocol's recovery rules.

Atomic `supervisor.lock` directory creation serializes starts. Its `pid` and
native `birth` files distinguish a live owner from a stale or incomplete receipt;
both cases refuse a second start. A stale lock needs explicit removal after the
owner's absence is established; the script never signals a PID from disk or
reclaims an ambiguous lock. `agent.pid` is an atomic 0600 JSON receipt containing
`pid` and `identity`, checkpointed before authenticated admission. It is an
observation receipt, not harness ownership. The fake-host-only `kill-agent`
control requires `CLAND_HOST_SECRET`, authenticates the named host's live
`agent.sock`, matches its hello PID to the receipt, then compares a fresh native
birth before SIGKILL. It refuses foreign, stale or malformed receipts. No kill RPC is added to the agent protocol.

OpenCode on an SSH Host starts its per-session server on host loopback. Readiness,
HTTP requests and SSE all use the Host's session forward through a hub-side Unix
socket; the stored `harnessId` remains the host-local URL for native attach.
The generated MCP configuration starts the spoke from the Host layout and reads
its private discovery file, whose host secret reaches `spoke.sock` over the carrier.
Identity-verified stop precedes forward cancellation. Failed launches use bounded,
single-flight `LaunchSettled` cleanup in memory; post-restart OpenCode forward
settlement is tracked by T-1671 and is not reconstructed from that callback.
Remote OpenCode normal-exit settlement also retains supervision while agent
identity cleanup, HTTP/SSE/snapshot drain and forward cancellation are pending.
Cancellation failure retries through PID supervision; the exit notice follows
successful settlement. Explicit stop drains the same client and watch work before
cancelling the forward.


A positive changed-boot lifecycle boundary records
`Sessions.retainHostGeneration(process, {cause: 'host-rebooted', bootId})` before
exit publication. It accepts every harness and exact pending failed-launch
owners, calls no adapter stop or Host operation, and retains the native generation
plus optional Claude launch id. Pending undo keeps its optional
`hostRebooted: {bootId, launchGeneration?}` fence through restart: native/file
recovery remains incomplete rather than signalling an old-boot row or discarding
host-local files outside the run directory. Lifecycle exit and role publication
belong to the reboot caller. Its indexed native-operation fence survives resource
receipt deletion and storage reopen; cleanup completion never restores authority
for a captured old birth. See [host settlement](../agents/host-agent.md#settlement-before-host-revocation).
