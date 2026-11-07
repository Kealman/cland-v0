## Roles

A session holds at most one role: Coordinator, Lead, Implementer, Reviewer, QA or Aide (spec 4.4, v0.1 §3.3). On a project's hub the role is the hub's state, not the session's (ADR 0001): the human assigns and revokes it, or a launch for the role grants it. A hub with no project (`createHub` in tests) takes a hello's role as declared and delivers no clause.

A Coordinator launches a Lead with `session.launch {"name":"lead-1","role":"lead","item":"T-12"}` (CLI: `cland session launch lead-1 --role lead --item T-12`). The node must be an open container named in `[tracker] levels` (epic or release by default; category and other additional root kinds are led by the Coordinator and cannot have Lead sessions). The hub runs the Lead at the project root, sets `process.item` to the node and takes its durable claim; no task branch or worktree is created. One Lead holds a node, and a Lead claims at most one node. Concurrent launches reserve the node before spawning, and a failed claim stops the new harness. An existing Lead claim must be released before replacement; stop alone retains the claim for resume. A Coordinator or human claim may yield to the launch. Human UI/CLI callers retain their unrestricted access; every agent caller must be the Coordinator, even when another role’s permission file grants `session.launch`, including a name already assigned the Lead role.

Lead scope is checked from the live container claim, stable session identity and current item ancestry on both spoke and CLI requests. Reparenting or releasing a claim changes admission immediately; launch, stop and merge recheck after asynchronous preparation and before mutation. A stopped session is managed according to every open claim or verifier hold it serves; when it has no holds, its launch item supplies the binding. Shared verifiers serving another subtree cannot be stopped by this Lead. Unbound launches/stops, other-node sessions and outside-subtree review/QA request lines are refused with the claimed level and node in the typed `forbidden` response and Agents notice. Releases, sync, push and unscheduled merges remain at the root; extra Lead grants cannot widen these boundaries. Use `item` on a verifier launch to bind its work; legacy Coordinator verifier launches with `cwd` still work. Existing projects apply the exact role-file edits in [T-178 handover](../agents/T-178-handover.md); `cland update` preserves project roles.

`@lead T-12` addresses the nearest lead on that node’s chain (skipping the sender’s own claims), and bare `@lead` addresses the Lead role. The epic row and item fields show `lead-1 [Lead]`; the sessions panel shows its node. Leads are non-exclusive at the role level, so different nodes may have separate Leads. Existing role files inherit the new built-in role when `[lead]` is absent; `init` writes the stanza in new projects. Lead defaults match the Coordinator’s launch defaults. Leads may launch Implementers, Reviewers and QA with an explicit `item` in their live claimed subtree, stop sessions through their own CLI shell, request review/QA and merge scheduled descendant tasks through the ordinary verdict and criteria gate. Leads hand over their claimed node with `role.handover`; planning follows the epic plan.

Aides work for the human alone and may run concurrently. The default crew clauses state that an Aide speaks for the human, decisions included: its messages are the human's instructions within the recipient's role. Existing projects add that line to the Coordinator, Implementer, Reviewer and QA clauses in `.cland/roles.toml`; cland leaves that file alone. Address them by session name: role tags (including `@aide`), `all` and globs exclude both live and offline Aides. Agents notices and asks do not reach them. `@lead T-n` may select an Aide through its item claim or inherited subtree ownership; otherwise it selects the nearest claiming Implementer, container Lead or the Coordinator. Aides may write to the human in any topic, edit the tracker in full through the eight §3.3 tools, and create or promote artifacts. On the human's word they launch, stop and resume sessions of any role, the Coordinator first of all, through `session.launch` or `cland session launch | stop | resume` in their shell. The Aide says what it will launch before doing it; during a build the Coordinator keeps the crew's staffing, so the Aide launches only when the human asks. These shell calls carry and audit the Aide's own identity. Aides with root Git write access may publish onboarding commits through `cland push` from their own shell, subject to the current launch-fixed `push` grant. The generated Codex workspace-write Aide has the Coordinator commit and publish instead and cannot commit at the project root, including with only a map; the human's ok covers the required Coordinator launch. They cannot ask, resolve, merge, hand over roles, release or sync; extra permission grants cannot override those role boundaries.

Existing projects receive these session grants through the v0.1.4 one-time migration. A running Aide needs a hub restart and relaunch to refresh its launch-fixed role tools.

When the human tells an Aide to take a task, `task.claim` returns its branch and worktree and moves the status to `in progress`. The Aide works in that path; a claim does not change a running harness's cwd. It becomes the item's lead, so human `@lead T-n` mentions and verifier reports addressed to `lead T-n` reach it. Commit and push the task branch to the local territory (`origin`), then set status `review` and report to the Coordinator by session name. Independent review and any required QA pass through the same merge gate; the Aide claimant cannot supply its own verdict, even after changing roles. The supervising Lead, Coordinator or human merges through the gate. Launch with `--item` takes an Implementer’s item or a Lead’s open epic or release; Reviewer/QA launches bind to the item and its worktree without taking the Implementer claim.

When a session becomes an Aide, pending broadcasts and explicit subscription notices from its previous role are dropped, including digest members. Deliveries addressed by name (or its claimed-item lead, including default events) survive; named progress bound to a discarded broadcast waits for the next direct delivery. Addressing provenance is recorded per delivery. Rows written before that provenance existed cannot establish a direct address and are dropped on an Aide transition, apart from the role clause.

### Reloading project configuration

Commands editing human-owned config or settings preserve untouched bytes and
validate the whole candidate with the consumer's startup or launch parser before
one atomic write; refusal leaves the file unchanged. Bootstrap, migration,
doctor and launch share one exported source for defaults and writable keys.
Test missing, explicit-default and legacy values separately.

`cland hub reload` and SIGHUP validate `.cland/config.toml` and `.cland/roles.toml`
and publish one last-good pair. A parse, validation or restart-required error in
either file retains both old snapshots, journals `config-reload-failed` with the
file and error, and makes the CLI exit nonzero. Successful reloads name the applied
settings. `cland hub status` shows the loaded time and the last commit touching
config.toml (`config.loadedAt` and `config.sourceCommit` in JSON; null without Git
history). Uncommitted edits may be loaded; the source commit identifies the file's
Git history, not a claim that those edits were committed.

The following settings apply live: `verification.executor`, `budget` (still capped
at one local run), `remote_budget`, `coordinator_suites`, `local_fallback`, `load_gate_workers`, `shards`, `cache_max_age_minutes`, `lifetime`,
`run_timeout`, `daily_spend_usd`, the `verification.droplet` table, `keys.layouts`,
and role definitions. Work that has started keeps its snapshot; anything that starts after the reload
uses the reloaded config. A queued job has not started. The scheduler persists the
snapshot at admission, including lease lifetime, spend policy and run timeout, so
a restart mid-run retains it. Explicit executor choices remain explicit; queued
requests using the default executor take the reloaded default. Reloading
capacity changes future queue admission without ending active runs. Leases already
issued retain their deadline; existing launched harnesses retain their launch
parameters. New launches use the loaded role defaults. Droplet cap reads now use
the loaded snapshot too: a config-only edit takes effect after reload, including
in `cland executor status`.

The `[remote]`, `[remote.telegram]`, `[remote.discord]` and `[speech]` sections
are rendered by init and added to managed configs by update, preserving configured
values. Defaults are `remote.mute_default = false`, Telegram `enabled = false`
and `format = "rich"` (`rich` or `entities`), Discord `enabled = false`, and speech
`provider = "elevenlabs"` (`elevenlabs`, `command` or empty/off), `model = "scribe_v2"`,
`language = ""` (detect), `max_seconds = 600` (positive integer), `command = []`
(the command provider's argv). All nine keys apply live through `config set`,
explicit reload or SIGHUP. Each reload resolves the project's secrets again;
a messenger is active only when enabled with a resolved nonempty token.

The default platform factory constructs Telegram's plain-fetch client and Discord's
REST/gateway client. Explicit `gatewayMessenger` and legacy `gatewayRemotes`
injection remain available. Tests use `testMessenger` or explicit loopback fake
Telegram and Discord roots with fabricated credentials.
A changed remote/speech
snapshot or resolved secret drains the configured gateway and creates its enabled
messengers again. An unchanged reload retains a healthy gateway; a gateway with
a disabled client is drained and recreated so the human can retry after fixing
the cause. Only enabled messengers with a resolved token are started. The reload result follows the
start/stop receipts and a second source-stamp check immediately before publication.
A source edited during platform preparation refuses with retry guidance and keeps
the previous config/roles snapshots. Secret or gateway application failures are
reported as remote configuration failures and preserve valid role admission. Pairing and outbox storage remain in `hub.db`. Telegram's native
client supplies token checks, explicit sends, private `/start` pairing and durable-offset
polling. Other accepted input awaits its registered mirror or command handler.
The messenger-neutral speech module (`hub/src/speech/index.ts`) supplies
`SpeechProvider.transcribe({ audio, mime, filename, languageHint?, durationSec?, signal })`
and `transcribeNote`. The wrapper defaults to one 90-second deadline, 30 seconds
per cloud attempt and at most two retries for rate-limited, unavailable or timeout;
backoff uses exponential jitter or Retry-After, bounded by the remaining deadline.
Cancellation reports timeout. Other kinds (not-configured, auth, bad-audio,
too-long, quota and command-failed) are terminal. Language codes and English names
normalize to lower-case ISO 639-1 where available.

`ElevenLabsProvider` accepts the resolved key, `[speech] model` and project-owned
redactor; callers pass that registry to the wrapper too. It uploads original bytes,
MIME and filename, with `tag_audio_events=false`, optional language hint and no
redirects. The default host is `https://api.elevenlabs.io`; the test override
`CLAND_ELEVENLABS_API_ROOT` admits only loopback HTTP with an explicit port and
no credentials, path, query or fragment. A missing key makes no request. The
provider module alone does not activate gateway transcription. The existing
`gatewayRemotes` fixture option retains its unconditional startup behavior.

`speechProvider(settings.speech, secrets, { env, redact })` selects ElevenLabs,
the command provider, or `null` when `provider = ""` (off). Resolved file secrets
are accepted; `ELEVENLABS_API_KEY`, including an empty override, wins. The factory
shares the project registry. `SPEECH_DATA_USE` supplies the provider-specific
privacy lines for status/setup consumers.

`CommandProvider` runs `[speech] command` as argv with `shell: false`, receives
original audio bytes on stdin, and returns trimmed UTF-8 stdout. The final child
environment strips remote/executor credentials and sets `CLAND_SPEECH_MIME` and
`CLAND_SPEECH_LANGUAGE` (empty means detect). Stdout over 1 MiB is command-failed;
stderr retains a bounded diagnostic tail redacted before display. Empty argv or
an absent executable is not-configured. Nonzero exit/signal is command-failed.
Commands opt out of retries, receive the whole note deadline (90 seconds by
default), and cancellation sends SIGTERM then SIGKILL after 100 ms, joining native
close before returning timeout. Each command owns a detached process group;
escalation signals that group, including descendants holding inherited pipes.
Cancellation settles only after native close and an ESRCH receipt for that group;
a direct-child close alone does not prove descendants have been reaped.
If native drainage is still incomplete two seconds after SIGKILL, the error
reports incomplete drainage with the native exit/signal instead of waiting
indefinitely. `resolveCommand(argv, env)` checks executable
files at absolute paths or on PATH without starting them, returning a path or
null for doctor. These provider exports alone do not activate gateway voice
handling; the voice caller supplies the configured language and shared redactor.

The role file retains its 500 ms auto-refresh and refresh before launches. A role
edit validates and publishes the entire pair; config-only edits wait for an
explicit reload or SIGHUP. A failed pair stays in force until a corrected role
edit or explicit reload succeeds. Running role clauses are delivered on the next
assignment or reconnect as before.

Startup settings require a restart: `project.name`, `tracker.levels`,
`tracker.fatal_stall`, `inbox.idle_minutes`, `plan.qa_default`, `sessions`, `artifacts`, `hygiene`, `visibility`, `web` (`bind`, `origin`, `port`, `dist`), and
`verification.lock_path`, `workers`, `test_timeout`, `stall_timeout`,
`coverage_max_age`. Their owners establish listeners, storage, policies, timers, compatibility
locks or candidate-runner settings at startup. Changing any of these refuses the
whole pair with a restart-required error naming the field. Candidate worktrees
retain their own worker and test limits, captured at suite submission.

An absent config file at startup uses built-in defaults. If config.toml is deleted
while the hub runs, reload and role refresh keep the last loaded config and accept
valid role edits. They report `config.toml missing; keeping the last loaded config`
as a warning. Absence never silently resets a running hub to defaults. An invalid
existing file still rejects the whole pair.

The human may reload through the CLI. The Coordinator's CLI also needs the
`hub.reload` grant in `[coordinator.permissions] tools`; `cland init` includes it
for new projects. Existing projects with an explicit tools list must add it.

### `.cland/roles.toml`

One table per role: `clause` (multi-line text), `skills` (list), `exclusive` (the Coordinator), `[<role>.launch]` with `harness`, `model` and `effort` (`""` is the harness's default) and how the launched session may act (`approval`, `sandbox`, `writable_roots`, `network`: below), and `[<role>.permissions]` `tools`, the permission list the hub enforces (see Permissions below; a role table without `tools` gets the built-in list). A role the file leaves out takes its default; an unknown role or a wrong type makes the file unreadable. The shipped mapping (when all three harnesses are installed):

| Role | Launch defaults | Permission policy | Skills |
| --- | --- | --- | --- |
| Coordinator (exclusive) | claude-code, `claude-fable-5-1`, effort `max` | `permissions = "auto"` | wayfinder, to-spec, to-tickets, triage, grilling, code-review, handover |
| Lead (one per node) | claude-code, `claude-fable-5-1`, effort `max` | `permissions = "auto"` | handover, merge |
| Implementer | opencode, a free model the server lists (`""`; pin one, e.g. `opencode/big-pickle`) | harness settings | implement, tdd, diagnosing-bugs |
| Reviewer | codex, `gpt-6.1-sol`, effort `high` | `never`; `read-only` | code-review |
| QA | codex, `gpt-6-astra`, effort `high` | `never`; `danger-full-access` | diagnosing-bugs |
| Aide (non-exclusive) | claude-code, the human's configured model (no `model` key; set one to override), effort `max` | `permissions = "auto"` | none |

`cland init` and a hub starting without `roles.toml` build the same template from installed executables: PATH, `CLAND_CLAUDE_BIN` / `CLAND_CODEX_BIN` / `CLAND_OPENCODE_BIN`, then `~/.local/bin` and `~/.opencode/bin`. An explicit override is authoritative. A role keeps its shipped harness when installed; otherwise it takes the first installed in Claude Code, Codex, OpenCode order. With none found, the shipped mapping is written and init reports the absence. Discovery never runs a harness or reads login secrets.

A role that moves gets `model = ""` and effort `max` on Claude Code, `high` on Codex, or empty on OpenCode. A role that stays keeps its shipped model and effort. Every generated Claude Code launch has `permissions = "auto"`; `skip` requires the human's explicit choice. Every generated Codex launch has `approval = "never"` and its role's sandbox: Reviewer `read-only`, Implementer and Aide `workspace-write`, QA, Coordinator and Lead `danger-full-access`. Coordinator and Lead need full access for cland's git refs, territory, network, hub sockets and session/worktree launches; QA retains the T-65 full-access policy. OpenCode launch tables contain no permissions, approval or sandbox keys.

The header records the canonical installed harness set, without machine paths. `isRolesTemplate(text)` in `src/roles/template.ts` checks exact bytes against the recorded build; edits, unknown stamps and older template versions return false. This lets setup conservatively recognise an untouched template. The parser's built-in fallback for omitted roles or keys remains the shipped mapping on every machine. Init/update preserve existing `roles.toml` and `crew.toml` byte for byte; new crew policy permits Aide sub-agents.

How a launched session may act is read from `[<role>.launch]` at each launch, and again at a relaunch (`session.resume` with `relaunch`). Policy belongs to the role: Codex and Claude Code inherit it even when the role's default harness is OpenCode (model and effort apply only to the role's default harness). The Codex adapter applies it as a sandbox (The Codex adapter, below). A launch on OpenCode ignores approval, sandbox and permissions and keeps OpenCode's own configuration (The OpenCode adapter, below). Claude Code uses its own permission settings and the `permissions` launch key.

| Key | Values | Meaning |
| --- | --- | --- |
| `approval` | `never`, `on-request`, `untrusted`; `""`: the adapter's default, which is `never` too (as with no role) | Whether the session stops to ask the human before a command its sandbox refuses. With `never` nothing waits on the human: the command fails and the session goes on. |
| `sandbox` | `read-only`, `workspace-write`, `danger-full-access`; `""`: the harness's own | What the session's commands may write: nothing; the session's cwd and the temp dir; or anything (no sandbox). |
| `writable_roots` | a list of directories, relative to the project root; needs `workspace-write` | More writable directories. One that holds a `.git` directory is writable with it, and with the session's own git directory when that lies there (a worktree's `.git/worktrees/<name>`): this is what lets a session in a worktree commit. |
| `network` | `none`, `local`, `full`; needs a sandbox | `local`: Unix sockets under the project's `.cland/`, the session's cwd and the temp dir, and loopback, so `cland` reaches the hub and tests start their own hubs; every other host is refused. `full`: the whole network. |
| `permissions` | `auto`, `skip`; `""`: the harness's own settings | Claude Code only: `auto` uses `--permission-mode auto`; `skip` uses `--dangerously-skip-permissions`. OpenCode and Codex ignore this key. |

A key the table leaves out takes the role's built-in value, key by key; only a written value overrides, and `""` asks for the harness's own setting. Generated and fallback Codex sandboxes agree for every role. T-1222 changes omitted sandbox keys for Implementer and Aide from full access to `workspace-write`, and for Coordinator and Lead from Codex's own setting to explicit `danger-full-access`. Explicit project settings and already-running sessions stay as they are; the new policy applies at launch or relaunch. Inherited roots apply only to `workspace-write`, and `danger-full-access` closes no network. A wrong value, `writable_roots` with a sandbox that is not `workspace-write`, or `network` or `writable_roots` with `sandbox = ""` makes the file unreadable. `cland role list` shows each role's values. `docs/review-and-qa.md` ("The Codex sandbox") describes the limits and historical measurements.

The workspace-write Implementer inherits `.git/objects`, `.git/refs`, `.git/logs`, `.git/worktrees`, `.cland/territory.git/objects`, `.cland/territory.git/refs`, `.cland/territory.git/logs` and `.cland/artifacts`. These permit task-worktree commits, fetches, local territory pushes and owned-artifact edits without opening either repository's hooks/config. A written `writable_roots` list replaces those defaults. Hub tools perform tracker/artifact record writes in the hub process. The workspace-write Aide has no extra roots; root-level commits cannot write `.git/index.lock` or `.git/COMMIT_EDITMSG`. QA changed to `workspace-write` inherits `[".cland/qa"]` unless a list is supplied. User config, npm caches and external Git metadata when the project root is itself linked need separate access; macOS ps/FSEvents restrictions are not lifted by roots.

Projects that prefer T-48's local-network profile can set the following keys in `[implementer.launch]` or `[qa.launch]`, keeping each role's inherited writable roots:

```toml
approval = "never"
sandbox = "workspace-write"
network = "local"
```

Write `network = "local"` explicitly: omitted keys inherit the current role defaults, whose network is full for Implementer and QA. The profile still supplies writable git directories and local sockets through the named Codex permissions profile; its limits and earlier measurements are in `docs/review-and-qa.md`.

The hub loads the file asynchronously before serving requests, then reads it on a 500 ms timer (`ROLES_REFRESH_MS`), without depending on filesystem watches. A saved edit becomes visible within 500 ms plus the async read and parse time; if a read was already in flight, allow that read to finish plus the next 500 ms tick and read. Slow or unavailable storage can delay refresh, but never blocks a permission check. Each check reads only the last successfully parsed snapshot. A refresh publishes a new map atomically; a check already using the previous map keeps it for that synchronous stretch. Handlers that await file preparation check the current snapshot again before publication, so a grant revoked during the wait refuses the resumed action. Read replay is invalidated when the snapshot changes, so a cached allowed answer cannot survive the refreshed grant. A file that does not parse is logged (`roles-unreadable`); a removed file is logged (`roles-missing`); both retain the last good snapshot for running sessions, permission checks and role listings. An unreadable startup file keeps the built-in snapshot. New role launches, fresh resumes and relaunches are refused while the roles file is in error; the refusal names the requested role, file and parser diagnostic (including the invalid policy key, value and accepted settings). Relaunch refuses before stopping the existing process. Correcting the file allows the next launch without restarting the hub. OpenCode-default policy keys remain ignored for OpenCode, but are validated when launching that role on Codex or Claude Code. The hub never rewrites an existing file. Launch, relaunch and human role assignment instead await the roles source’s `fresh()` (`ProjectConfiguration` in the serving hub, or `RolesFile`): an asynchronous stat, any older refresh already in flight, and a new read when the file changed. Parsing still publishes only changed valid text. These rare operations immediately see a saved launch-profile or clause edit; hot permission checks retain the bounded-refresh snapshot.

### Custom roles

`[custom.<name>]` defines an additional role, launched with `--role <name>` and
listed alongside the six built-ins in `role.list`, `who`, sessions and both
workbench launchers. The role's clause and usable skills arrive on launch and
reconnect. Built-in tables remain editable; a custom table with a built-in name
is a collision. Names follow the session-name grammar; `all`, `hub`, `human` and
`custom` are also reserved. Custom role names are reserved against session names.

A nonempty `clause` and `launch.harness` are required. Optional `skills` defaults
to `[]`, `exclusive` to false, and launch model/effort/account/native permission
settings to the harness defaults. Unknown custom fields fail with their complete
path. `[custom.<name>.permissions] tools` defaults to `[]`, with exact known
`tool` or `tool:scope` grants validated at load. A refused refresh keeps the last
good configuration. The [crew documentation](../../site/src/content/docs/docs/crew.md#add-a-custom-role)
has a complete docs-writer definition and launch example.

Custom grants are limited to `send:agents`, the reads/subscriptions/status grants
(`who`, `session.list`, `history`, `status`, `task.view`, `task.list`, `rule.list`,
`subscribe`, `unsubscribe`, `subscriptions`, `task.plan:show`),
`task.claim:own`, `task.comment:own`, `topic.create:own`, `task.edit:review`,
`task.criterion:done`, `artifact.create`, `artifact.keep`, `artifact.move`,
`artifact.archive` and `verify`. Only a live own claim permits done marks or a
status-only change to review. Verification admits that claimed task's worktree
and topic only, with the default mode and no occasion. Custom sessions can
request the built-in Reviewer, complete evidence review and reach the normal
hub-written ready status; the Coordinator lands the item through the same gate.

The dispatcher enforces this ceiling even on a supplied grant list: custom roles
cannot write review/QA verdicts or criterion verification, take verifier holds,
merge/release, manage roles or sessions, write rules, or gain human/Coordinator
authority. Built-in role-name routing stays separate; `lead T-n` skips custom
claims. Custom staffing is manual; `crew.toml` pools and hierarchy remain built-in.

### Assignment

- **The human** assigns with `role.set` (UI) or `cland role set <session> <role>`, and revokes with `role.clear` or `cland role clear <session>`. With a note or `move` the role moves from its holder (see Handover). A live session gets its clause at once (and what was queued for the role); a name not connected yet gets the role when a session takes the name. A role follows the name: a session that reconnects under it has it back.
- **A launch for a role** (`session.launch` with `role`) fills what it does not give from the role's launch defaults: the harness, and the model and effort when the harness is the role's. The launched session's hello is granted that role. Optional `cwd` selects its working directory (absolute or relative to the project root); without it, the project root is used. The directory must exist; otherwise the hub refuses the launch with code `invalid-cwd`.
- **`CLAND_ROLE`** is only a request: a hello whose name holds no role and that the hub did not launch for one is refused with `{"type":"error","code":"no-role","message":"no role: \"rev-1\" holds none … — assign one with `cland role set rev-1 <coordinator|implementer|reviewer|qa>`; the session connects on its next retry"}`. The spoke keeps retrying with its backoff and logs the refusal; once the human assigns the role it connects.
- **Coordinator is exclusive.** Assigning it, or launching for it, while another session holds it (live, or remembered within the queue's TTL) is refused, naming the holder: `role "coordinator" is held by coord [Coordinator] (live): one session holds it at a time — clear it first with `cland role clear coord``. It is checked on every hello too: a holder remembered past the TTL that comes back after another session took the role is refused it (`no-role`), its remembered role is cleared, the log says `role-superseded` and subscribers get its `session.role` (`role` null, `reason` `superseded: …`).
- **A launch reserves its role** in the store before anything is spawned (`role-reserved`), so a second launch for an exclusive role, or the human's assignment of it, is refused while the first is under way. A launch that fails gives back what it reserved, the grant of a spoke that said hello early included (`role-reservation-released`, `reason` `launch-failed`). The reservation is recorded in `hub.db` (`launch_reservations`) with the role and cleared once the launch's process row is written: a hub that dies in between gives the role back at its next start, before it reads any frame, when the name has no running process row and no live session (`reason` `interrupted`). The launch's first hello is granted the launch's role whatever the name held before.
- **A dead holder** (its harness exited, or `session.stop`) leaves its role vacant; the process table keeps the role, so a relaunch (`session.resume --relaunch`) takes it back. The human's assignment or revocation of a launched session is written to its row too, found by the session's id: a rename renames the row (an adapter's files kept by name follow it), and a resume writes back the role the row holds when it ends, never the one it started from. A stopped session's native relaunch reserves its role under the name admitted before native I/O. Success and failure settle that original reservation even if the Coordinator renames during the resume; role rollback resolves the current name through the stable session id.

### The clause

The hub scans `.agents/skills` asynchronously before accepting connections and on its 500 ms role-refresh cadence. Clause assembly reads the published inventory from memory. A usable skill is a directory (including a symlink to one) containing a `SKILL.md` file; missing or unreadable entries are omitted. Inventory changes need no `roles.toml` edit or restart and become visible after the next completed scan; already delivered clauses remain as delivered. `cland doctor` scans synchronously in its separate CLI process.

On assignment and on every hello of a session holding a role, the hub records the clause as a hub notice to the session (`from: "hub"`, no topic) and sends it as a `role` frame, ahead of what else waited:

```json
{"type":"role","id":"<message id>","role":"reviewer","clause":"You are a Reviewer: …","skills":["code-review"],"message":{"id":"<message id>","from":"hub","fromKind":"hub","via":"hub","to":["rev-1"],"text":"cland hub: you hold the role Reviewer in this project, shown to others as rev-1 [Reviewer]. …","ts":"…"}}
```

The spoke acks it like a `deliver` and logs it. A spoke that delivers itself shows the message's text as a channel event with `kind="role"` and `role` in its meta; in a launched session the adapter injects it as a turn (the session's first one), with the delivery pipeline's retries. A newer notice supersedes one still waiting (it is marked dropped). Revoking sends a notice with `"role":null` that tells the holder to stop acting in the role. The journal records each delivery: `role-clause` (session, role, reason `hello` | `assigned` | `assigned at launch`, message id) and `role-revoked`; the spoke's ack shows as `acked`.

An adapter whose new session needs a first turn (Codex: a thread has no rollout before one, so attach and resume would fail) declares `clauseAtSpawn` and gets the rendered clause in `spawn`: the first turn carries it, and the hub records that launch's first hello's delivery as injected (`reason` `assigned at launch (first turn)`) instead of injecting it again, also when the name already held the role. Every later hello delivers it as above.

### The frames, the events, the CLI

| Request | Result `value` | Who |
| --- | --- | --- |
| `{"type":"role.set","id":…,"session":…,"role":…}` | `{"session":RoleHolder}` | UI, CLI |
| `{"type":"role.clear","id":…,"session":…}` | `{"session":RoleHolder}` | UI, CLI |
| `{"type":"role.list","id":…}` | `{"roles":[{"role","label","exclusive","skills","launch","holders":[RoleHolder…]}…],"coordinator"}` | UI, CLI |
| `{"type":"role.set","id":…,"session":…,"role":…,"note"?:…,"move"?:true}` | `{"session":RoleHolder}`: the role moves from its holder (Handover) | UI, CLI |
| `{"type":"role.state","id":…,"role":…}` | `RoleState` (Handover) | UI, CLI |
| `{"type":"role.handover","id":…,"to":…,"note":…,"then"?:"implementer"}` | `{"session":RoleHolder}` | spokes whose role grants `role.handover` (Coordinator or Lead) |
| `{"type":"role.state","id":…,"role"?:…}` | `RoleState` of the caller's own role | spokes holding a role |

`RoleHolder` is `{"name","role","label","live"}`, where `label` is the name with its role, `rev-1 [Reviewer]`. `hub.status` and `session.list` carry `"coordinator"`: the live holder's name, or `null` for "no coordinator"; `hub.status` also carries `needsYou` (Asks and the inbox). Presence (`who`, `hub.status`) and `HarnessProcess` carry `label` beside `role`.

Events, after `subscribe`:

```json
{"type":"session.role","session":"rev-1","role":"reviewer","previous":null,"reason":"assigned","ts":"…"}
{"type":"role.vacant","role":"coordinator","ts":"…"}
{"type":"role.filled","role":"coordinator","session":"coord","ts":"…"}
```

`session.role` comes when a role is assigned, cleared (`role` null), granted at launch, handed over (`reason` `handover`, one event for each side), or vacated by its holder's death. `role.vacant` comes when no live session holds the Coordinator any more (cleared, disconnected, dead), right after the change that caused it; `role.filled` when one holds it again. At a hub's start there is no event: `hub.status` says it.

| Command | What it does |
| --- | --- |
| `cland role set <session> <role> [--note-file <file>] [--move]` | Assigns the role; prints `rev-1 [Reviewer]: role set` (`(offline)` when the session is not connected). `--note-file` (a Markdown note) or `--move` moves the Coordinator from its holder (Handover). |
| `cland role clear <session>` | Revokes the session's role. |
| `cland role launch <role> [--harness …] [--model …] [--effort …] [--account …] [--permissions …] [--pool …] [--json]` | Saves the role's launch settings in `.cland/roles.toml`, applying from its next launch. Requires at least one launch flag; `--model ""` and `--account ""` use the harness's default. `--json` prints the raw result. |
| `cland role list` | Each role with its launch defaults and holders, and the coordinator or `no coordinator`; `--json` for the raw value. |

### Handover

A role moves between sessions as hub state, never as a transcript (spec 4.4, ADR 0001, decision #10). The Coordinator hands its own role over with the spoke tool `role.handover {to, note, then?}` (Coordinator and Lead tables grant it); the human moves a role with `role.set` and a `note` or `move: true` (a plain `role.set` of a Coordinator someone holds is still refused).

<!-- cland-allow-closed-wording: pending questions and transfers are runtime handover state -->
- **A Lead hands over one node.** `role.handover {to, note, then?}` moves its live container claim with the original claim time. The receiver must be known and unclaimed, and cannot be the root Coordinator. Other Lead nodes, their notes and claims stay independent. Default subscriptions and `@lead T-n` routing follow the new claim immediately; explicit subscriptions remain with the sessions that created them. Pending question endpoints move with the role. Lead handover records belong to nodes and replay pending claim transfers on restart. Existing projects apply [T-180's exact role-file changes](../agents/T-180-handover.md).
- **The human moves a Lead node** with `role.set` naming `role: "lead"`, `item: "T-n"` and a note or `move: true`; the CLI equivalent is `cland role set next lead --item T-n --note-file note.md` (or `--move`). Naming the node avoids choosing among unrelated Leads. A plain Lead role assignment does not take a node claim.

- **The note** has four sections, each non-empty: goals now, work in flight, open decisions, waiting on. It is an object `{"goals_now","work_in_flight","open_decisions","waiting_on"}` or Markdown with those four headings (any level, any case). It is mandatory for `role.handover` and optional for the human. An omitted `note` or an object missing required fields returns `invalid_argument`; correct the fields and retry. A supplied Markdown note or empty section still returns the established diagnostic naming its missing sections: `{"ok":false,"error":"handover refused: the note has no \"waiting on\" section — …","code":"note-incomplete","missing":["waiting_on"]}`. The `handover` skill (`.agents/skills/handover`) drafts it.
- **The receiver** must be a session the hub knows for `role.handover`: live, or launched by the hub and running. It may hold another role (it is replaced: one role per session). The human may name any session, as with `role.set`. Coordinator exclusivity holds: a third session holding it refuses the move.
- **The move** is one store transaction: the previous holder loses the role (or becomes an Implementer with `then: "implementer"`), the receiver takes it, the role's record (the note, who moved it to whom, when, the chain of holders, and the tracker claims to move along) is written in `role_state` in `hub.db`, and both Agents notices are recorded; all of it lands or none does. The claims the previous holder held (by session id) live in the tracker's tables: right after the commit they are re-pointed to the receiver's session id from the record, which is then cleared; a hub that died in between does it at its next start (the move is idempotent). When the receiver is a name with no session yet (the human's `role.set --move` to it), the claims follow at that session's first hello. A transfer still pending when the role moves on again (that receiver never connected) is carried into the next move's record, so the first holder's claims follow the role to the end of the chain. `task view` shows the receiver. Everything runs in one synchronous step: no frame is read between the checks and the last event.
- **The receiver** gets its clause with the note in one `role` frame, `{"type":"role","role":"coordinator","clause":…,"skills":[…],"note":{…},"from":"coord","message":{…}}`; the message text is the clause, then `Handover note from coord:` and the note as Markdown. The note rides with every later clause delivery to that holder (its reconnects) until the role moves again. A spoke that delivers itself adds `handover_from` to the channel event's meta.
- **The previous holder** gets the revocation, `{"type":"role","role":null,"reason":"handover","to":"next",…}` (`cland hub: coord no longer holds the role Coordinator (handed over to next). Stop acting as Coordinator…`; meta `reason`, `handed_to`), and every later call is refused `forbidden` as a session with no role. It stays connected until its next reconnect, which is refused (no role), as for any revocation. With `then: "implementer"` it gets the Implementer clause instead, headed `you handed the role Coordinator over to next: stop acting as Coordinator.`
- **The Agents topic** gets two hub notices: `coord [Coordinator] handed the Coordinator role over to next, with a handover note:` and the note (`the human moved the Coordinator role from coord [Coordinator] to next, with no note.` when the human did), then `next [Coordinator] took over the Coordinator role from coord.`
- **Subscribers** get `session.role` for the previous holder and the receiver (`reason` `handover`), and `role.filled` for the new Coordinator; `hub.status.coordinator` names it. The audit log records the call (`args.to`, the note only as `noteChars`; the human's as `role.set`).

**The role's state** is pulled on demand: `role.state` (a spoke reads its own role's; the UI any role):

```json
{"role":"coordinator","label":"Coordinator","holders":[RoleHolder…],
 "note":{"sections":{…},"markdown":"## Goals now…","from":"coord","to":"next","at":"…"},
 "handover":{"from":"coord","to":"next","by":"coord","at":"…"},
 "waiting":[{"topic":{"id":"general","title":"General"},"status":"waiting for agent","reason":"status","pending":1,"last":"…"}],
 "asks":[],
 "claims":[{"item":"T-1","title":"…","session":"next","sessionId":"…","claimedAt":"…"}]}
```

For a Lead, `role.state` returns its own holder, node (`item`), note, waiting topics and claim. On the UI socket, add `session: "lead-2"` to `role.state` when multiple Leads exist. Reconnects and renames preserve the node's note; a handover on another node cannot replace it.

After the human hands a node to an offline successor, `session.launch` with that claimant's name, role and `item` adopts the existing claim and attaches its default subscriptions. The claim keeps its original time and handover note. A different name or role is refused, and a live session of that name must be stopped before launching it.

`waiting` lists the topics waiting for the role: first those whose status is `waiting for agent` (#32) and whose latest human message was delivered to the role's holders (`reason` `status`), else those where a message addressed to the role, or to one of its holders, the current ones and every one it passed through in its handovers, is newer than their last word in the topic (`reason` `addressed`, `pending` such messages). `asks` is empty until asks exist (#33). `claims` are the tracker claims held by the role's holders. `history` with a `topic` returns that topic's messages, so the new holder reads a waiting topic without the old session's transcript.

### Permissions

The hub checks every spoke tool call against the calling session's role, as the hub holds it at that moment (spec 4.4): a `role.set` or `role.clear` changes what the session may do on its very next call, with no reconnect. The table is `[<role>.permissions] tools` in `roles.toml`; the built-in one (`src/roles/permissions.ts`) is what the defaults write. A grant is `tool` (all of it) or `tool:scope` (only that part):

| Scope | Allows |
| --- | --- |
| `send:agents` | `send` to sessions (names, globs, roles, `all`) |
| `send:human` | `send` with no `to`: to the human (`send` alone grants both) |
| `task.edit:review` | the Implementer setting only `review` on its own live claimed item, with no other fields |
| `task.claim:own` | claiming or releasing only the session's own item |
| `task.comment:own` | plain comments (not verdicts) only on the session's own item |
| `task.comment:verdict` | verdict comments (`verdict`, `result`, `run`, or a text that reads back as a verdict header) on any item: a Reviewer only `review` verdicts, QA only `qa` verdicts |
| `topic.create:own` | a topic only bound to the session's own item (the item id trimmed first; ownership must be positive: a blank item, or one that cannot be looked up, is refused) |

**Mentions.** A session without `send:human`, but with some `send` grant, may still `send` to the human in a topic while the human's latest message in that topic was delivered to it, by its name (`@rev-1`) or its role (`@reviewer`): spec 4.5's mention pulls it in, Reviewer and QA included. The delivery is matched by the session id it was recorded for: another session that takes the name later inherits nothing. The topic is the `send`'s `topic` (General when absent). The grant ends with the human's next message there that addresses someone else; in any other topic the call is refused with `send:human`.

The session's own item is one it claims (the tracker's claim, held by session id) or whose `assignee` is it: when the hub writes an assignee (`task.create`, `task.edit`) it binds the item to that name's session id (table `assignees` in `hub.db`), so a rename, or another session taking the name, moves no ownership; an assignee the hub never bound (a hand edit, an import, a name with no session yet) is bound to the first session under that name that acts on the item. Names never change (spec 4.4): only the Coordinator renames, and the `rename` tool refuses any other role whatever `roles.toml` grants.

**Verdicts.** A `task.comment` whose text starts with a verdict header is a verdict: the hub parses the header into the verdict's fields and the tracker writes `by` from the caller (its name and the role the hub holds), never what the text says; a text that would still read as a verdict after its header is refused. A Reviewer records only `review` verdicts and QA only `qa` ones; the Coordinator and the human (the CLI) may record either, as a fallback.

An unknown tool or scope makes the file unreadable (the last good version stays in force). The defaults:

| Role | Tools |
| --- | --- |
| Coordinator | `send`, `ask`, `ask.forward`, `ask.answer`, `resolve`, `topic.create`, `task.create`, `task.plan`, `task.edit` (assigning included), `task.close`, `task.claim`, `task.link`, `task.rank`, `task.criterion`, `task.comment`, `session.launch`, `session.list`, `session.stop`, `session.resume`, `hub.stop` (the last three from its shell: The CLI in a session's shell), `role.handover`, `merge`, `release`, `sync` (release and sync from its shell only), `artifact.create`, `rename`, `who`, `history`, `status`, `task.view`, `task.list` |
| Implementer | `ask.forward`, `ask.answer`, `send:agents`, `topic.create:own`, `task.claim:own`, `task.comment:own`, `task.edit:review`, `task.criterion:done`, `task.plan:show`, `artifact.create`, `who`, `session.list`, `history`, `status`, `task.view`, `task.list` |
| Aide | `task.criterion` (done and manage), `task.create`, `task.edit` (any status), `task.close`, `task.link`, `task.comment`, `task.claim`, `task.view`, `task.list`, `artifact.create`, `artifact.promote`, `send` (session names or topics), `topic.create`, `history`, `who`, `session.list`, `status`, `session.launch`, `session.stop`, `session.resume` (sessions of any role, only on the human's word; the Coordinator keeps staffing during a build), `task.import`, `push` (from its own shell) |
| Reviewer, QA | `send:agents`, `task.hold`, `verification.decline`, `task.comment:verdict`, `task.criterion:verify`, `task.plan:show`, `artifact.create`, `who`, `session.list`, `history`, `status`, `task.view`, `task.list` |
| no role | nothing (such a session is refused at hello; one whose role is revoked while connected is refused every call) |

`session.list` is a separate read permission for every role, including Leads. It covers `cland session list`, `--json` and `--archived`; session lifecycle mutations keep their existing grants. Projects with explicit `[<role>.permissions] tools` lists add `"session.list"` to each role that should read launched sessions; a `"session.launch"` grant does not imply it. See [session permission guidance](../agents/session-permissions.md).

`merge` uses the verdict gate below. `role.state` is no table tool: a spoke reads only its own role's state. `task.import` belongs to the human or an Aide (including from its shell). The keepalive (`ping`) and acks are not tool calls. A hub with no project (no `roles.toml`) checks nothing. The UI and the CLI act as the human, whom the table does not restrict, with two limits. A client's hello comes over the Unix socket or stdio only: on a project's hub, one over the spokes' WebSocket is refused (`unauthorized`), so the bearer secret a spoke holds makes no human. A CLI `task.*` call acting as a session the hub knows (`as` carries its `sessionId`, which decides before any name: `cland task` in a launched session's shell always sends `$CLAND_SESSION_ID`, whatever `--as` says; or the human's `--as` names a session that holds or held that name) is that session's call: checked against the role the hub holds for it (never the frame's `role`), audited as it (`client: "cli"`), and its claims held by its session id.

The hub checks role/tool availability first (`forbidden` when absent), then validates arguments against the shared MCP tool table and declared conditional requirements, then checks argument-dependent scopes (for example, `task.plan set` needs `id` and `yaml`; `show` and `approve` need `id`, while `migrate` does not). Unknown fields, missing required fields and invalid enum values return `code: "invalid_argument"` with `ok: false`, `error` and `reason` naming the field and accepted values. Correct the arguments and retry. These validation failures are audited as errors and do not post refusal notices to Agents. The reply remains additive for callers reading `ok` and `reason`. The spoke retains its local MCP validation and preserves typed hub diagnostics; malformed MCP envelopes keep the SDK’s JSON-RPC error naming `arguments`.

Permission-dependent fields stay in the shared schema: `merge.override` accepts a string and the spoke forwards it to the hub's human-only gate. A session with merge access receives `forbidden` (`only the human may override verdicts`); a misspelled field such as `overide` remains `invalid_argument`. Declaring the field grants no override authority; tool availability still runs first.

Only a role or permission refusal returns `forbidden`: stop that action under rule 5, follow its reason or escalate. A refused call is answered with a typed result, which the spoke hands the model as the tool's result (`isError`), and the hub posts a notice into the Agents topic, which the UI shows there:

```json
{"type":"result","id":"…","ok":false,"error":"forbidden: task.comment (Reviewer may only comment verdicts)","code":"forbidden","permission":"task.comment","role":"reviewer","reason":"Reviewer may only comment verdicts"}
```

`rev-1 [Reviewer] tried task.close T-12: forbidden (Reviewer may not use task.close)` (a hub message in `agents`, `from: "hub"`, addressed to nobody). `permission` names what was missing: `send:human`, `task.comment:verdict`, or the tool itself.

### Asks up the lead chain (T-179)

An item question uses `send` with `kind: "question"`, `topic` naming the item's topic and `to: ["lead T-n"]`. A question delivered to the next lead becomes a durable ask card with `to` naming that agent. It waits for that agent, appears in topic history, and stays outside the human inbox and its `needsYou` count. Ordinary reports and questions to other peers keep their existing send behavior. Without an item, send a question to `coordinator` in General. Agents is a traffic record and does not host ask cards.

The receiving lead calls `ask.answer` with `{ask: "<delivered msg_id>", text: "<answer>"}`, or `ask.forward` with `{ask: "<delivered msg_id>"}`. Forwarding copies the exact question into the same topic, links the new ask through `replyTo` and the original card's `forwarded`, and routes above the receiving lead's claimed ancestor. Each call advances one level, including an epic Lead followed by a release Lead. The Coordinator's forward creates a human ask; only that root role may use `ask`, even with custom permission grants. Repeated forwards and actions by another session identity are refused. The recipient identity survives reconnects.

A forwarded question remains open until the upper answer arrives and the receiving lead returns the decision with `ask.answer`. For example: Implementer → epic Lead → Coordinator → human; human answer → Coordinator; Coordinator answers the incoming forwarded question → epic Lead; epic Lead answers the original → Implementer. Each answer carries `answerTo`/`answer_to`. A lead cannot answer a forwarded question while its upper ask is open. The topic's `waitingFor` lists the party currently awaited, and its status stays `waiting for agent` until a human ask opens, then returns to the next agent when the human answers. Closing the topic/item cancels every open link; resolving withdraws them.

The default Coordinator, Lead and Implementer permission lists include `ask.forward` and `ask.answer`. Projects with explicit `[<role>.permissions] tools` lists must add both grants for those roles. The tools also enforce the incoming recipient by stable session identity. Role handover moves the actionable ends of open agent asks with the role, durably in the same transaction; the original messages keep their historical sender and addressees. An unseen successor's provisional endpoints adopt its real session identity when it binds, including retained aliases, before rename or another handover. Renames refresh the waiting party and card. If reparenting takes a receiving lead outside the item's ancestry, its forward is refused and leaves the ask open. Named questions to Aides remain ordinary sends, since Aides do not answer or forward ask cards. Neovim shows agent cards as waiting on the named lead, preserves them when reconciling the human inbox, and offers human answer keys only on human asks.

### The CLI in a session's shell

The adapters put `$CLAND_SESSION_ID` and `$CLAND_SESSION_NAME` in a launched session's shell (Claude Code, Codex and OpenCode; `$CLAND_ROLE` too where there is a role). With either set, every frame the CLI sends carries the session as `as`, the hub takes the call as that session's (by the id first; an id or a name the hub does not know is a roleless session, refused everything that needs a role, never the human), and the audit records the session with `client: "cli"`. What the call may do:

| Command | In a session's shell |
| --- | --- |
| `cland task …` | The session's, checked against its role as its own `task.*` tools are (The tracker, below). |
| `cland session launch`, `stop`, `resume` (with `--relaunch` or `--fresh` too), `cland hub stop` | Decided by the permission table: `session.launch`, `session.stop`, `session.resume`, `hub.stop`. The Coordinator has all four by default: it launches the sessions, manages them from its shell and restarts the hub after a merge. A Lead may launch and stop within its live claimed subtree; the other roles are refused. From a session's shell `cland hub stop` signals the hub's process only after the hub accepted the request: refused, or unanswered, it exits 1 and signals nothing (the human's fallback to the signal stays). |
| `cland session list` (including `--json` and `--archived`) | Allowed by the separate `session.list` read grant, held by every role by default. It does not grant launch, stop, resume, archive or prune. |
| `cland inbox`, `cland role list`, `cland hub status`, `cland worktree list` | Allowed: reading the hub's state. |
| `cland topic answer`, `cland role set`, `cland role clear`, `cland session attach` and `retry`, `cland hub unmute`, `cland worktree prune`, and any other frame (the UI's `topic.send`, `inbox.read`, …) | The human's alone: refused. |

A refusal is the typed error of the table above, with the frame's type as `permission`, and it shows in Agents as any refusal does:

```json
{"type":"result","id":"…","ok":false,"error":"forbidden: topic.answer (only the human may do this; this call is impl-1 [Implementer]'s, by $CLAND_SESSION_ID)","code":"forbidden","permission":"topic.answer","role":"implementer","reason":"only the human may do this; this call is impl-1 [Implementer]'s, by $CLAND_SESSION_ID"}
```

A `roles.toml` written before these grants existed lacks `session.stop`, `session.resume` and `hub.stop` in `[coordinator.permissions] tools` (cland never rewrites the file): add them there, or the Coordinator's shell is refused them. The three are for the CLI only; the spoke has no such tools.

`cland hook` is the session's own plumbing (`session.signal`, `session.bridge`) and carries no actor. Without the variables every command is the human's, as before. What stays open: the CLI's identity is its environment, so a shell that unsets both variables is the human's, as any process holding the hub's socket and secret is.

### The audit log

Every tool call the hub answers, a spoke's (allowed or refused) or the human's through the UI or the CLI, is an `audit` event in the hub's log (`.cland/log/hub.log`) until the journal (#34) takes it over in this shape:

```json
{"ts":"…","event":"audit","session":"rev-1","sessionId":"…","role":"reviewer","tool":"task.close","args":{"item":"T-12"},"outcome":"forbidden","permission":"task.close","reason":"Reviewer may not use task.close"}
{"ts":"…","event":"audit","session":"human","sessionId":null,"role":"human","tool":"topic.send","args":{"to":["impl-1"],"topic":"general","textChars":42},"outcome":"ok","client":"ui"}
```

`outcome` is `ok`, `forbidden` or `error` (with `error`, what the tool answered). `args` keeps what the call was about (item ids, addressees, topic ids, names, flags; a CLI's `as`) and free text only as its length (`textChars`, `bodyChars`, `titleChars`, `commentChars`, a handover's `noteChars`): never a message's text. `session` is the name at call time, `role` the role the hub held then. The hooks' `session.signal` and `session.bridge` are plumbing, not audited. The decision #13 rule on sub-agents (they may not call hub tools through their parent's spoke) is not enforceable over one MCP connection: the audit is how a violation shows.

### Slow and repeated requests

The hub answers every frame on one event loop, so one slow handler holds up every client. Each frame's handling is timed, every stretch of it that runs on the loop: the first, and the synchronous work resumed after a `task.*` Git await or a `session.*` lifecycle await (a verdict's commit, a process-row publication, `"phase":"resumed"`) and the answer going out (`"phase":"answer"`). A stretch over 250 ms is logged as `{"event":"slow-request","tool":"task.list","client":"nvim","ms":812,"budgetMs":250}`. Time spent waiting for Git is not counted as blocking. Separately, receipt-to-answer latency over 5 s (including async waits) is logged as `slow-answer` with `tool`, `client`, `ms` and `budgetMs`; `hub.status` counts it in `requests.slowAnswers`, with the latest as `requests.lastSlowAnswer`. These never increment `requests.slow`. `client` is the UI's or the CLI's client name, or the spoke's session name. These are counted in `hub.status` (`requests.slow`, with the latest as `requests.lastSlow`) and shown by `cland hub status` on its `requests:` line. A `slow-request` means a handler did work that belongs off the request path. The time it measures is the time every other client waited.

A read (`task.list`, `task.view`, `session.list`, `topic.list`, `topic.history`, `inbox.list`, `role.list`, `role.state`, `hub.status`, `who`, `history`, `artifact.list`) that the same connection sends again within 250 ms of the answer to the same read gets that answer again instead of being handled, provided nothing changed in between. A change is any write frame on any connection, any hub or `task` event, or a spoke arriving or leaving. The answer is never older than the one the client would have had by asking a moment earlier, and a client always reads its own writes. The first repeat per connection and tool is logged as `too-fast`, and `requests.replayed` counts them all. Replayed answers are not audited. The Neovim workbench reads `task.list` only on connecting (the `task` events keep its items). It reads sessions and presence on connect and after its own launch or stop; `presence`, `session.process` and `session.usage` events keep the panel current between reads, without a timer.

`cland hub audit [--session <name>] [--since <ISO time | 30s, 15m, 2h, 1d>] [--json]` prints the records, oldest first: one line each (`ts  rev-1 [reviewer]  task.close  item=T-12  forbidden task.close (…)`), or one JSON object per line. `--session human` selects the human's calls.


<!-- Implementation guidance moved from the implement skill. -->

For web user management, Accounts uses the existing optional `web.session.user`
to show Users only to an admin in users mode; older hubs omitting user keep it hidden.
`user.add` and `user.list` admit authenticated web admins through the shared role
check and handler human guard; sessions remain refused. Single-mode web refusals
name users mode. Keep invite URLs only in minting results and transient component
state, never settings, logs or broadcasts. Use the sealed Accounts browser and
web-authority frame seams; CLI invite regressions remain unchanged.

Include a standalone `Head: <full-commit-sha>` line after the request line to pin
the pushed build at admission. The optional pending.head survives queue/restart.
Legacy requests without Head remain accepted with ordered retirement. Unrelated
verdicts do not settle pinned work; ancestry is computed asynchronously. No new
role clause lines or permissions are needed.


### Role host pool defaults

`[<role>.launch] pool = "agents"` records the role's host pool; an omitted key
resolves to `local`, including older files and generated templates. Pool names
use 1–64 ASCII letters, digits and hyphens and start with a letter or digit.
The parser checks syntax independently of `config.toml`; pool existence belongs
to launch admission. `cland role launch implementer --pool agents` saves the key
and `cland role list` and `roles-loaded` show the resolved pool. This setting
records placement intent; scheduler-based pool launch admission is separate.

Coordinator and Aide roles run only on `local`. A remote pool for either is
refused by the same policy used for explicit host placement, before a settings
write. Invalid file edits keep the last good roles and block new role launches
until corrected. Older hub role-list replies omit `pool`; the CLI displays
`local` for those replies.
