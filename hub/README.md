# Hub documentation

Subsystem reference and implementation guidance live in `docs/hub/`.
Add subsystem text to its file; keep this index as pointers.

- [Prerequisite and packaging reports](../docs/hub/prerequisite-and-packaging-reports.md)
- [Start a project with cland](../docs/hub/start-a-project-with-cland.md)
- [Web workspace](../docs/hub/web-workspace.md)
- [Modules](../docs/hub/modules.md)
- [Web edge](../docs/hub/web-edge.md)
- [Gateway authority](../docs/hub/gateway-authority.md)
- [Durable remote outbox](../docs/hub/durable-remote-outbox.md)
- [Connection events filter](../docs/hub/connection-events-filter.md)
- [Negotiated connection snapshot](../docs/hub/negotiated-connection-snapshot.md)
- [Human last looks and read marks](../docs/hub/human-last-looks-and-read-marks.md)
- [Identity and delivery](../docs/hub/identity-and-delivery.md)
- [Topics](../docs/hub/topics.md)
- [Thread runs and fold lines](../docs/hub/thread-runs-and-fold-lines.md)
- [Asks and the inbox](../docs/hub/asks-and-the-inbox.md), including internal hub cards and synchronous answer handlers; [login wait cards](../docs/hub/logins.md#login-wait-cards) share one prompt per pool/harness shortage
- [Roles](../docs/hub/roles.md)
- [Rulebook](../docs/hub/rulebook.md)
- [Project logins](../docs/hub/logins.md): terminal disk sign-in, daily and on-demand backup snapshots with per-login scheduling and pending-binding deferral, local human metadata listing, SQLite records, episode-based dead-login sign-out/card recovery and Coordinator notices without stopping running sessions, transitions, provisioning-time attachment for waiting launches and launch-time disk binding, exclusive writers, snapshot-cloned readers, idle exclusive-flag updates and OpenCode keys delivered only in pool-host spawn environments.
- [Host providers](../docs/hub/host-providers.md): validated pool configuration and pure weighted placement decisions, provider contracts, pool image keys and local human `cland host prepare [pool]`, `host create [pool]`, `host list` and `host destroy <id>`; pool settings apply on reload or `cland config set`, init creates no pools; fake hosts create to ready, DigitalOcean prepares with executor builder controls and requires E-1534 admission for production creation.
- [SSH transport](../docs/hub/ssh-transport.md)
- [Host revocation settlement](../docs/agents/host-agent.md#settlement-before-host-revocation): bounded pre-cut cleanup, changed-boot closure receipts and named unresolved generations.
- [SSH Host and native launch receipts](../docs/hub/ssh-host.md): changed-boot session exits with durable retirement and no native signals; fake-host agent admission requires a boot file on every platform, while ordinary Linux uses the kernel boot; root-first Claude stop and bounded descendant convergence; private terminal attach records and separate pinned SSH terminals; atomic publish, append and stat; OpenCode shared ignore and launch rollback; territory clone, socket proxy, branch leases, agent version delivery, named unknown native-push identity boundaries; capability-gated automatic task-ref pushes and restart-safe host worktrees.
- [Remote discovery](../docs/hub/remote-discovery.md)
- [The Agents record, the journal and hygiene](../docs/hub/the-agents-record-the-journal-and-hygiene.md)
- [Per-user state](../docs/hub/per-user-state.md)
- [Accounts and limits](../docs/hub/accounts-and-limits.md)
- [Lifecycle notes](../docs/hub/lifecycle-notes.md)
- [The cland CLI](../docs/hub/the-cland-cli.md)
- [Telegram voice transcripts](../docs/hub/telegram-voice-transcripts.md)
- [Project secrets](../docs/hub/project-secrets.md)
- [Remote commands](../docs/hub/remote-commands.md)
- [Config preservation](../docs/hub/cland-init-and-cland-update.md): managed settings, auth, init/update and setup writers retain host tables and unknown TOML fields.
- [cland setup](../docs/hub/cland-setup.md)
- [cland init and cland update](../docs/hub/cland-init-and-cland-update.md)
- [Prebuilt Web release assets](../docs/hub/prebuilt-web-release-assets.md)
- [cland doctor](../docs/hub/cland-doctor.md)
- [The project's hub](../docs/hub/the-projects-hub.md)
- [Adapters and sessions](../docs/hub/adapters-and-sessions.md): managed Claude Bash guard refuses computed and unquoted-glob rm/rmdir targets.
- [The tracker](../docs/hub/the-tracker.md)
- [Running](../docs/hub/running.md): executor API endpoint declarations and per-token request budgets.
- [Artifacts](../docs/hub/artifacts.md)
- [Coordinator account refusal procedure](../docs/hub/coordinator-account-refusal-procedure.md)
- [Coordinator session procedure](../docs/hub/coordinator-session-procedure.md)
- [Coordinator heartbeat procedure](../docs/hub/coordinator-heartbeat-procedure.md)
- [Coordinator subscription procedure](../docs/hub/coordinator-subscription-procedure.md)
- [Additive interaction selection (T-1454)](../docs/hub/additive-interaction-selection-t-1454.md)
- [Installed verification compiler capability](../docs/hub/installed-verification-compiler-capability.md)
- [Operator retry of queued input (T-1473)](../docs/hub/operator-retry-of-queued-input-t-1473.md)
- [Pinned verifier request heads](../docs/hub/pinned-verifier-request-heads.md)
- [Merge queue landing reports (T-1503)](../docs/hub/merge-queue-landing-reports-t-1503.md)
- [Standing duration allowance owners](../docs/hub/standing-duration-allowance-owners.md)
- [Setup and doctor remote readiness](../docs/hub/setup-and-doctor-remote-readiness.md)
- [Declining an accepted verifier request (T-1494)](../docs/hub/declining-an-accepted-verifier-request-t-1494.md)

Host verify and ready admission flush the leased agent publisher and require
matching worktree/territory HEADs. The scheduler owns a detached territory source
through queued execution and restart; see [publication admission](../docs/agents/host-agent.md#publication-admission).
Abandoned source preparations use a fresh run UUID on re-admission; bounded Git-lock
cleanup retains named leftovers in hub status until locks clear. This path uses
no PID/signal authority or Git maintenance.

Item sessions can relaunch on another registered host through the optional
`session.resume.host` frame field when their original host is down, gone or
rebooted. Available hosts retain their tasks. The destination takes the branch
lease and starts from the territory's pushed tip with a fresh native conversation;
cland identity and claim remain. A known settled native failure can retry with a
captured checkout receipt: refresh the same checkout or retain its checkout and
ref-watch obligations when moving onward. Unknown preparation remains fenced.
There is no CLI host flag. See
[host relaunch](../docs/agents/host-agent.md#relaunching-an-item-on-another-host).

Host Git receive-pack waits up to 30 seconds for a held territory lock with bounded backoff; expiry retains the named push-retry refusal. Lease rejection remains immediate when the update hook evaluates the ref. The native stalled-push cap starts after acquisition; upload-pack remains concurrent. See [territory locking](../docs/adr/0004-agents-work-on-a-local-git-territory.md).

Host checkout operations checkpoint ownership under short territory locks and join agent work outside them. Prune persists a `removing` fence before draining publishers, then revalidates the row, tip, leases and eligibility under a fresh lock; changed state is retained with `host-prune-changed`. Add/relaunch similarly prepare outside the lock between durable checkpoints. See [Host worktrees](../docs/hub/ssh-host.md#territory-clone-and-task-worktrees).

Host checkout checkpoint acquisition uses the existing bounded backoff for up to 32 seconds (the 30 second receive ownership cap plus 2 seconds), at both preflight and finalization. This joins an admitted receive rather than refusing immediately. A caller already holding that territory lock refuses as `host-worktree-lock-order` before any Host operation; it never waits on itself. Receive acquisition remains capped at 30 seconds.

Public cross-host relaunch admission uses the same checkout checkpoint policy before adapter drain: acquire with the bounded backoff, then refresh task eligibility, destination registration and exact row ownership before admission. Prune observes Host state first and refreshes row, tip, leases and synchronous item eligibility after those asynchronous observations, immediately before cleanup admission. An item reopened during an occupant query retains its branch and removing checkpoint.

Executor images support an optional `[verification] provision` repository script, run
as root before runner preparation. Snapshot keys include the running recipe and
committed hook digests; see [prepared snapshots](../docs/hub/running.md#controls-and-the-prepared-snapshot).

The shared image recipe accepts x86_64 or arm64 and optional pinned agent harnesses;
the executor uses the unchanged x86_64 base. See the prepared snapshot reference above.

Host image bootstrap: [host prelude and login-disk helper](../docs/agents/host-agent.md#host-bootstrap-and-login-disks) describes explicit user-data inputs, provider steps, the runner sudoers boundary and the authenticated Host login-disk operation.

Whole host code delivery at ready and version handoff uses `deliverRuntime` from
`src/host/code-delivery.ts`: sources, CLI, spoke, Claude mod and the hub lockfile
are verified in a sibling generation before the version symlink switches. Hosts
need Node/npm and registry access or a prefilled cache; dependency installation
uses `npm ci -w hub --omit=dev --ignore-scripts`. Fake registry hosts use the
installed hub tree. See [runtime delivery](../docs/agents/host-agent.md#whole-runtime-delivery-at-ready)
for reuse, old-reader retention and legacy-directory refusal.

Configured host pool names use 1–64 ASCII letters, digits and hyphens, beginning
with a letter or digit; see [pool images](../docs/hub/host-providers.md#pool-images).

Host spawn memory admission and fake-host controls: [host agent](../docs/agents/host-agent.md).

Host and verification accounting share the version-1 per-user spend ledger. Host
reservations and renewals obey both the shared daily cap and hosts sub-cap; UTC
settled totals are available per category and pool. See [spend accounting](../docs/hub/running.md#leases-cleanup-and-spend)
for the additive API and confirmed-absence settlement boundary.

- [Session pool placement](../docs/hub/session-pool-placement.md): role pool selection, capacity promises, explicit pins and session Host facts.
- [Host leases and renewal ownership](../docs/hub/host-leases.md)
- [Waiting launches](../docs/hub/waiting-launches.md): no-process replies, status records, cancellation and capacity wake-ups.
- [Detached host watchdog](../docs/hub/host-watchdog.md): lease-file expiry, confirmed provider release and spend receipts.

Waiting-launch restart ownership: [durable waits](../docs/hub/waiting-launches.md#restart-settlement).

- [Pool scale-up](../docs/hub/pool-scaling.md): minimum maintenance, waiting launches and live limits.

- [Pool idle stop](../docs/hub/pool-idle-stop.md): idle deadlines, billing floors and confirmed destruction.
- [Host restart recovery](../docs/hub/host-restart.md): provider reconciliation, restored renewal and watchdog ownership, and missing-host session exits.
- [Host status and explicit stop](../docs/hub/host-status-stop.md): weighted slots, UTC spend and confirmed deletion.

- [Pool boot failures and provider limits](../docs/hub/pool-failures.md): fixed boot gate, retry backoff and unknown acquisition ownership.
Host tunnel loss, unreachable state and confirmed teardown: [Host health](../docs/hub/host-health.md).

Host scheduler spend policy and daily warning: [host spend cap](../docs/hub/host-spend-cap.md).

DigitalOcean host creation uses [durable host admission](../docs/hub/digitalocean-host-admission.md):
a current pool image, the published host lease, an armed detached watchdog and
hosts spend reservation. The same path serves manual and automatic pool creation;
provider credentials and API access are required. SSH provisioning uses the
persisted provider identity, and pre-checkpoint watchdog recovery requires the
exact admitted lease tag and confirmed droplet/key absence reads.

Host login disks: [Logins](../docs/hub/logins.md#host-login-disk-api) records the Host operation and typed refusal contract.


Key login storage uses AES-256-GCM envelopes in ignored `.cland/auth/`, under the
32-byte base64 `[auth] key` in `.cland/secrets.toml`. The local input path supports
OpenCode in 0.4.x, reads stdin or a hidden prompt and sends metadata only. Store-key
rotation is refused while key files or rows exist. See
[logins](../docs/hub/logins.md#key-store) and
[project secrets](../docs/hub/project-secrets.md).

Host stop/destroy and lifecycle teardown release settled disk logins before
transport removal and provider deletion. Lost hosts wait for provider-confirmed
detachment before reuse. Retained login cleanup on an already destroyed host
preserves the terminal provision and settled spend while its release owner retries.
See [login release](../docs/hub/logins.md#releasing-host-disks).

Startup reconciles active login disks before pool scaling, retaining pending
native ownership and using confirmed detached/deleted provider receipts. Missing
original volumes record a retained signed-out reason; failed inventories retry
without changing logins. See [login reconciliation](../docs/hub/logins.md#releasing-host-disks).

Deleted-host session settlement runs before login-volume reconciliation; unreachable
SSH hosts use the lost-host snapshot fence without a new reconnect wait.

Pool demand placement uses regional login verdicts and waits for a login when
exclusive capacity is exhausted; minimum and login-add creation remain exempt.
See [login placement capacity](../docs/hub/logins.md#placement-capacity).

Login capacity and monthly storage reporting use indexed login metadata and provider-declared storage rates. `login list` text reads additive `host.status` pool capacity; `login list --json` retains its array. Host rows include bound harness/name pairs. Storage is accrued in month spend only and never reserved; see [logins](../docs/hub/logins.md) and [host status](../docs/hub/host-status-stop.md).

`cland login remove <name>` removes an idle project login through the local human
CLI or Neovim. Provider-confirmed disk deletions and encrypted-key removal precede
row removal; incomplete deletions retain exact ids for retry and the shared auth
store key stays. See [removal](../docs/hub/logins.md#removing-a-login).
