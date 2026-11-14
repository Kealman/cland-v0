## cland setup

Run `cland setup [dir]` after `cland init`. It uses the current directory or the
explicit directory, refuses a discovered parent and HOME, and stops with
"run cland init first" when `.cland/` is absent.

When setup hands over to the workbench, it sets `CLAND_OPEN_SESSION=aide-1`
so the Aide's terminal opens in the centre once the hub lists it. `--attach`
attaches in the current terminal instead; `--no-aide` skips the handover.

Setup currently detects the project, then Claude Code, Codex and OpenCode, then
the installed harnesses' logins, then records the favourite harness and grants
project trust for every installed harness, then starts the hub, offers Telegram
remote setup and starts the Aide. Each line has `ok`,
`done`, `skip`,
`open` or `fail`, a detail and any fix. With no harness installed, all three
installers are `open`; with one installed, missing alternatives are `skip` with
an installer hint. A binary found only in an installer's folder explains that a
new shell is needed for PATH. A missing Claude Code or Codex login is `open`;
OpenCode's login is optional because its free model needs none.

For a missing harness in a terminal, setup shows its official user-level installer
before asking `Install <Harness> now? [y/N]`. A yes runs it in the same terminal,
then detects the harness again: found is `done`, still missing is `fail` with the
exit code and command to run by hand. A no is saved in `[setup] declined_installs`
in `.cland/config.toml`; later runs skip it with a `cland setup --install <harness>`
hint. `cland update` preserves this list and `cland config set setup.declined_installs`
accepts a list of harness ids (`claude-code`, `codex`, `opencode`).
`--install <harness>` clears its decline and runs the missing harness's installer
without asking, including without a terminal. A successful install rebuilds an
exact, unedited roles template for the installed set; edited files and a marked
favourite are preserved. Installer folders supplement setup's own PATH for later steps.

Without both stdin and stdout attached to a terminal, setup asks and launches
nothing. Installers and their associated writes need an explicit `--install`;
trust writes need `--yes`, and the favourite choice needs `--yes` or `--harness`.
`--json` disables questions and prints one object
with `root`, `version`, `interactive`, `steps`, `summary` and `next` on stdout;
narration and any explicitly requested installer's output go to stderr. It can
still install with `--install`, choose a favourite with `--harness` or `--yes`,
or write trust with `--yes`. `steps` uses doctor's `name`,
`verdict`, `detail` and optional `fix` fields. `next` is `cland setup` while work
is open or failed, otherwise `cland`. Exit codes are 0 when no step is open or
failed, 1 otherwise, and 130 for input cancellation at a question.

The favourite step offers installed harnesses in Claude Code, Codex, OpenCode
order, labels signed-out ones and asks no question when only one is installed.
`--harness <h>` selects an installed harness without a question; `--yes` takes
the first installed default. The choice marks `[aide.launch]` in `roles.toml`;
changing harness also clears its model and resets effort for that harness.
An already-marked installed favourite reports `ok` without a question unless
`--harness` selects another. Invalid roles are left untouched with repair guidance.

Trust asks no question in a terminal. It writes the real harness configuration
for this project's path: Claude Code's profile `.claude.json` under its lock,
and Codex's `config.toml` through a short-lived app-server whose process group
is ended afterwards. The launch profile and each account named by a role are
included. OpenCode has no trust gate. One `trust` line names the actual config
paths, says `done` after a write or `ok` when already trusted, and gives the
harness's own trust dialog as the manual fix after a failure. Without a terminal
and without `--yes`, missing trust stays `open` and no config is written.

`--yes` accepts harmless defaults, trust writes and hub startup, including with
`--json`. Installers need `--install`, logins and a new Aide need a terminal,
and accounts and Telegram keep their own default-No questions. Steps join the
single ordered list in `src/setup/runner.ts` through `SetupOptions`.
Action steps must detect again after acting and let that detection decide their
result. `src/setup/terminal.ts` runs a child with inherited terminal I/O (stdout
redirects to stderr for JSON reports), ignores
SIGINT and SIGQUIT in the parent while the child runs, restores its handlers,
and returns the child's exit code or 128 plus its signal number.

### Speech in setup

After the messenger offers and before the Aide, setup prints the configured
provider's `SPEECH_DATA_USE` line, also used by plain `cland remote status`.
Generated configuration selects ElevenLabs. A resolved file or environment key
prints `ok`; a missing key without a terminal prints `open` with
`cland secret set speech.elevenlabs_key`. In a terminal the missing key gets a
default-No offer even with `--yes`: decline is `skip`; acceptance uses the shared
secret CLI preflight and hidden reader, stores privately and prints `done`.
`command` and empty providers print one `ok` line and ask nothing. Setup makes no
provider call. Apply a stored key to a running hub with `cland hub reload`.

### Agent hosts in setup

After the remote and speech steps, before the Aide, setup offers “Set up agent
hosts?” with No as the default. `--yes` skips this optional step. Without a
terminal it writes nothing. An untouched project with no agents pool prints
`skip`; a partial pool prints `open`. The detail includes the exact missing
`cland config set` and `cland role launch <role> --pool agents` commands and
`cland hub reload`, preserving existing settings and placed roles.
A configured agents pool is `ok` only with a current local pool image and usable logins matching each placed
role's account selection and, for DigitalOcean, the token in the hub environment.
An older hub without role eligibility evidence leaves readiness open. Guidance
for an existing pool preserves its settings and placed roles; unreadable settings
leave `cland setup in a terminal` as the repair path rather than pool defaults.

On acceptance, setup reads only token presence and fingerprint from the hub's
environment. A missing token leaves `open`: set `DIGITALOCEAN_TOKEN` in that
environment and restart the hub. Setup never requests or stores that token.
It offers eligible roles individually, with Implementer preselected; Coordinator
and Aide stay local. A separate default-No confirmation names the size,
`min_hosts` and the recorded spec price ($0.0714/h without VAT for s-4vcpu-8gb,
2026-10-31). Declining leaves `open` with manual commands and writes nothing.
An unpriced size also stays `open`. Confirmation uses a recorded declaration,
never a provider catalog request; actual spend uses runtime provider declarations.
Price editing and price storage are outside this step.

Acceptance writes the pool defaults through `config.set`, persists role pools
through the existing `role.launch` setter, then reloads. Existing pool settings
are preserved. Setup then offers `cland host prepare agents` through the same
hub operation as that command, followed by `cland login add <harness> --pool agents`
in the terminal for each placed harness without an eligible login. Account-pinned
roles keep their account selection. Each offer defaults to No and names the paid
machine. The image question uses `verification.droplet.prepare_size`: the declared
builder prices are $0.25/h for c-8 and $0.50/h for c-16 (see Running); another size
stays `open` with the prepare command and starts nothing.

Image completion reports `prepared` or `current` from the hub receipt. Login
completion uses the existing CLI terminal owner and requires both native success
and a named ready-login receipt in the pool's provider and region. The hub assigns
the readable name; setup never scans retained inventory to choose one. It refreshes
account-aware eligibility before later offers, so a new pinned login can satisfy
an unpinned role. Declines print `skip` with the command; without a terminal,
these offers print `open` with commands and run nothing. A failed or abandoned
sign-in with an admitted name prints `open` with `cland login signin <name>`;
before admission it retains the add command. Setup continues to the
Aide. In JSON mode the login terminal's output goes to stderr.
Configured nonterminal pools retain these commands even under `--yes` or when
hub metadata reads fail. Doctor and setup share the same read-only image-key
comparison, including absent/stale/current states, without provider calls.

Immediately after a paid yes, setup re-reads the displayed pool and builder
terms. A change leaves the action `open`, naming the changed term and exact
command, and starts nothing. Interactive setup assumes one human owns the
project configuration during the run. The remaining gap between this re-read
and the hub effect, and shared admission pinning/CAS, are tracked in T-1858.

### Discord in setup

Setup offers Discord after Telegram, before speech and the Aide, default No even
with `--yes`. Create one application/bot per project: Install Link None, Public
Bot off, Message Content Intent on, Interactions Endpoint URL empty. The token
uses the shared hidden prompt/preflight/private writer as `discord.token`.
Setup reads the application with the native REST client and prints an invite
with its numeric id, `scope=bot&permissions=117824`. Each invalid setting is
named; enabling waits for a successful re-check. Declining that re-check leaves
setup open. Platform access requires network and a resolved token; tests use
an explicit loopback fake root.

The existing config-set/reload frames enable it, then setup waits at most ten
seconds for a connected status (native READY plus recent heartbeat ACK). It
pauses for `/cland pair` in the server channel and confirms the local inbox's
numeric identity/code through the shared pairing helper. A paired rerun is
`ok`, a decline `skip`; nonterminal untouched is `skip` and partial is `open`,
with Discord secret/config/reload/approval commands. No token enters a frame.

### Paired setup reruns during reconnect

For Discord and Telegram, a rerun with a resolved token, enabled config and a
loaded token/pairing waits up to ten seconds while remote status is disconnected,
including without a terminal. A connected receipt reports `ok`; a gateway still
down at the deadline reports `open`. Disabled or unloaded remotes do not wait.
Setup does not reload or approve a pairing during this check. Status reads use
the smaller of their normal three-second timeout and the remaining readiness
budget; late connected replies cannot produce `ok`. Cancellation joins an admitted
read before returning. Legacy injected clients that ignore the optional read
budget are still joined; their late success remains ineligible.

### Telegram in setup

After the hub and before the Aide, setup checks the resolved Telegram token,
`remote.telegram.enabled` and the hub's pairing. A configured, connected, paired remote
prints `ok` without a question. Otherwise a terminal offers Telegram with default
No, including under `--yes`. A decline prints `skip`, writes nothing and is
offered again on the next terminal run.

On yes, a missing token brings a few BotFather instructions: open `@BotFather`,
send `/newbot`, choose the project's bot name and username, and paste its token
at the hidden prompt. Setup uses the same raw, no-echo reader and private-file
preflight as `cland secret set telegram.token`; malformed input names the expected Telegram
format and repeats the hidden question. An existing resolved token is reused.
Environment overrides still win over the file. Reports show only fingerprints.

Setup enables the remote through the config-set path, then reloads a running
hub and checks its loaded remote status. Telegram activation requires a valid
resolved token and network access to Telegram; setup tests use injected fakes.
An enabled, connected remote with a retained pairing prints `done`. For an
unpaired remote, setup prints the bot's start link and pauses for Start, then
Enter. It reads this messenger's waiting inbox rows, offers a choice when several
wait, and confirms the selected identity with its name, numeric id and code.
This confirmation defaults to No even with `--yes`. Yes approves through the
local CLI connection and prints `done` with the paired name and id. No leaves
`open` with that row's exact `cland remote approve telegram <code>` command.
No waiting code offers one extra wait, then remains `open` with the bot link.
If the hub is stopped, start it and rerun setup to pair.

Without a terminal (including `--json`), setup asks nothing and changes no remote
settings. An untouched Telegram remote prints `skip` with
`cland secret set telegram.token`,
`cland config set remote.telegram.enabled true` and `cland hub reload`.
A token without enabling, or enabling without a token, prints `open` with the
missing commands. A configured, unpaired remote also names the approve command
and the bot link when the running hub knows it.
With `--no-aide` and no running hub, a terminal can store the token and enable the
managed config using the same validated atomic writer as config-set. It leaves
reload and pairing `open`; it starts no hub. If a hub already runs, it can reload
that hub. Custom unmarked configs and unsafe secret paths are left for repair.
Existing role clauses cover secret isolation and local setup; this adds no role
permission or clause line.

### Discord and speech in setup

After Telegram, setup offers Discord with default No even under `--yes`. It
reuses a resolved token or reads one through the hidden prompt. Before enabling,
it checks Public Bot off, Message Content on and an empty Interactions Endpoint
URL. It prints the application's invite (bot scope, permissions 117824), waits
up to ten seconds for connection, then pauses for `/cland pair` in the intended
server text channel. The human confirms the numeric identity locally; the
private code expires in 15 minutes. Nonterminal untouched/partial setup remains
`skip`/`open`, and approval never happens without confirmation.

Speech follows both messengers: setup prints the provider's data-use line. With
ElevenLabs selected and no resolved key, it offers hidden key input with default
No, even under `--yes`. A present key is `ok`; a nonterminal missing key is `open`
with `cland secret set speech.elevenlabs_key`. Command/off providers ask nothing.
A stored key needs `cland hub reload` before a running hub uses it.


<!-- Implementation guidance moved from the implement skill. -->

For detached droplet watchdog PID ownership, use the T1 OS/checkpoint seam in
`docs/agents/tests/hub-test-executor-watchdog.test.ts.md` and its native T3
launch/rearm controls. Arm retries unreadable proof for at most 10 seconds;
keep changed-birth refusal across retries and a late-reply deadline control.
Register arm-control disposal before launch, independently drive its setup-clock
bound, and retain missing/aborted setup controls that drain held replies and
arm/stop work through the same owner.
The sentinel lifecycle fixture expires both durable lease copies only after the
worker-start and hub-stop receipts. Saved-account fresh resume waits for the
stopped spoke's new journalled disconnect, not only native stop. Authorization
fixtures read existing credentials through a minimal SQLite connection, with no
schema/migration writer; retain the held-WAL-writer control in
`docs/agents/tests/hub-test-sqlite-contention.test.ts.md`.
Keep `pid`/UTC `startedUtc`, add native `pidIdentity`, and
persist a coherent one-time legacy upgrade before any signal. Retain same-second
reuse refusal, failed-proof/checkpoint controls and the release-during-probe case;
hold provider release across inspection and prove full lease writers retain the
durable upgrade and terminal state without a second legacy adoption. Register
held-writer disposal before launch, bound/abort setup separately, and drain the
underlying checkpoint as well as inspect's bounded reply before root removal.

For deferred remote media, retain the captured paired numeric identity across
native I/O and recheck it at upload and commit. Join fatal-media poll shutdown
before surfacing its stop cause to Gateway. Exercise owner handoff, held native
I/O revocation, file-preparation revocation and omitted/aborted setup controls
with pre-owned observers and exact close/completion receipts.

Fresh local launches keep a nonpersisted authority bound to the exact lease and
captured native leader birth. The signal fence can extend that authority only
through positively observed native ancestry, retaining captured child births
across leader exit so owned detached children in nested phase roots can drain.
Restore, copied/replaced leases, PID reuse and a group number alone grant none
of that authority; those targets still require the recovery cwd/birth fence.
Lease binding is rechecked after awaited scope proof and at the native signal
boundary. No generic temporary-directory grant is added. The original cancellation and
setup-failure cleanup controls and native no-inherited-authority cases must pass
alongside outside-group refusal and ordinary restart recovery.

Date observation cleanup still disposes native transports after a drain failure;
register `guardDirectoryRemoval` to retain the fixture root until writers settle.
Use `clockControl` for held-write probes so setup, abort, release and joining are
owned before launch, with separate bounded setup and effect observations.

## Setup reconnect readiness

## Setup and doctor readiness audit (T-1506)
