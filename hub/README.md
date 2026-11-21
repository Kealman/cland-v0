# Hub documentation

Task readiness uses completed green verification at the exact tip when the running
project config has a test or tier command, alongside current verdicts and criteria.
No test command or an empty base diff retains verdict-only readiness; same-tree
cache receipts qualify at their submitted tip. See [tracker readiness](../docs/agents/issue-tracker.md).

Implementation notes (read with the matching subsystem reference):

- [Remote commands and credentials](../docs/hub/implementation/remote.md)
- [Artifacts](../docs/hub/implementation/artifacts.md)
- [Doctor](../docs/hub/implementation/doctor.md)
- [Setup](../docs/hub/implementation/setup.md)
- [Verification and merge accounting](../docs/hub/implementation/running.md)
- [Adapters and native launch](../docs/hub/implementation/adapters.md)
- [Hosts, worktrees and placement](../docs/hub/implementation/hosts.md)
- [Logins](../docs/hub/implementation/logins.md)
- [Voice echo](../docs/hub/implementation/voice.md)

Subsystem reference and implementation guidance live in `docs/hub/`.
Live executor switching and bounded remote reachability are described in
[Remote executors](../docs/hub/running.md#remote-executors-droplets).
Evidence publication uses the session-aware `publishSessionEvidence` library;
see [scan and publication](../docs/agents/evidence-publication.md) for snapshot,
positive-control, scanner and refusal behaviour.
The [suite retention reference](../docs/hub/suite-retention.md) describes bounded
background deletion, durable publisher pins, preserved evidence and the
configurable age floor and pass cap, with an [exact consumer census](../docs/hub/suite-run-references.md).
The [remote command reference](../docs/hub/remote-commands.md) describes local
approval-code validation and known-invalid versus unknown request refusals.
The [closed-item wording guard](../docs/hub/running.md) covers Markdown docs and
site MDX prose against the candidate checkout's tracker.
The [enqueue preflight](../docs/hub/running.md#enqueue-preflight) runs the merged
candidate check outside serialization, protects bounded output before publishing
its tail and retains checkouts whose native command closure is unconfirmed.
An absent resolved check is reported explicitly as skipped in the enqueue result.
Preflight HOME, XDG and default HOME-relative npm cache writes stay in the candidate's owned Git
metadata outside its checkout; guarded removal collects both after native closure.
Duration-manifest projects also require structured exact-head Linux timing
proof before code enqueue. New passing identities measured at 4 seconds or
more need allowances; refusals provide measured 1.5x stanzas. See the same
reference for timing-capable runner deployment and receipt lookup.
Calibrated nightly soak deadlines, durable file rotation, unexecuted heartbeat
receipts and timeout execution inventories are described
in [Running](../docs/hub/running.md#soak-deadline-accounting).
Integrated dev droplet delivery pins the submitted commit, runs its check remotely
and records delivery failures as infrastructure not run; see [delivery](../docs/hub/running.md).
Merge batch baselines select passing file receipts per executed tier, including
completed passing files in red runs; see
[Running](../docs/hub/running.md) for summary provenance and repetition counts.
That reference also describes same-run host-check retries: a later pass with
matching tree and command supersedes an aborted attempt while retaining its log
and notice evidence; unmatched interruptions keep the batch inconclusive.
The [interaction reference](../docs/hub/additive-interaction-selection-t-1454.md)
describes the separate report-only T3 importer projection.
The [logins reference](../docs/hub/logins.md) also covers terminal renewal of an
existing disk with `cland login signin`, binding-preserving admission and the
24-hour one-sign-in hint.
Peer loss and hub shutdown interrupt new adds and renewal without disk cleanup; a completion
on its owning connection follows the CLI's positive SSH-close receipt.
Interrupted sign-in uses exact-machine deletion receipts to release its native
fence, with retained snapshot obligations left to their existing owner.
Add subsystem text to its file; keep this index as pointers.

Startup listener await receipts and post-serving verdict freshness admission are
described in the [startup reference](../docs/hub/coordinator-subscription-procedure.md).

Native Git read/writer classification, startup writer fences and bounded merge-prune shutdown
are documented under [merge cleanup](../docs/hub/cland-init-and-cland-update.md#merge-cleanup-shutdown).

Conditional batch T1 reuse, receipt requirements and per-member summaries are
documented under [queued batches](../docs/agents/tests.md#queued-merge-batches).
Configured T3 uses affected importers for light batches, with conservative full
triggers and per-file baseline receipts described there. Configured size and wait
remain unchanged; inherited configuration and non-cland runners retain their plans.
Partial masks never establish full periodic, stage or release coverage. Light
batches retain existing exact-head member T1 omission and report that coverage source.
Remote batches with cland tier commands share the configured shard limit and
spend reservation policy described in [Running](../docs/hub/running.md).

After terminal batch receipts, candidate cleanup failures retain a separate
guarded obligation, visible with its path, last error and retry time in merge
queue and hub status. Automatic retries back off from 1 s to at most 60 s;
they never change landed outcomes or prevent preparation of the next batch.
Item follow-up repairs still use `cland merge T-n`.
Historical probe upgrades preserve unmarked legacy roots with durable secondary
diagnostics and continue through separate clones or already-collected receipts;
see [Running](../docs/hub/running.md) for the ownership and restart rules.
The retry list keeps 32 compact records (256 KiB maximum), one due retry per
tick. Overflow is unresolved, with count and oldest path in status and an item
diagnostic; its owned roots remain and are not auto-retried. Checkout ownership
markers and native directory identities fence delayed removal, including after
restart. Unknown legacy ownership or a replacement checkout preserves the root.
At an idle upgrade boundary, an unmarked batch candidate is preserved with a
durable path/cause diagnostic; its batch retires and retained queue requests
receive a new batch id, candidate identity and run. Cancelling every member also
clears a blocked batch after its workers finish. Marked replacements still refuse
cleanup. Ownership compares the shared verification tree (excluding tracker
items and RULES), alongside the exact commit and native directory identities.
The canonical owned path scopes process guarding too. Overflow notice obligations
reuse individual meta records; one bounded keyset page replays per tick, keeping
captured requester identities until a positive durable publication receipt.

- [Prerequisite and packaging reports](../docs/hub/prerequisite-and-packaging-reports.md)
- [Start a project with cland](../docs/hub/start-a-project-with-cland.md)
- [Web workspace](../docs/hub/web-workspace.md)
- [Modules](../docs/hub/modules.md)
- [Web edge](../docs/hub/web-edge.md)
- [Spoke discovery and reconnect](../docs/hub/web-edge.md#spoke-discovery-retry)
- [Gateway authority](../docs/hub/gateway-authority.md)
- [Durable remote outbox](../docs/hub/durable-remote-outbox.md)
- [Connection events filter](../docs/hub/connection-events-filter.md)
- [Negotiated connection snapshot](../docs/hub/negotiated-connection-snapshot.md)
- [Human last looks and read marks](../docs/hub/human-last-looks-and-read-marks.md)
- [Identity and delivery](../docs/hub/identity-and-delivery.md)
- Claude mod turn-receipt timeouts retain `uncertain` deliveries for explicit retry, with batched session notifications; restart never automatically replays these unknown submissions.
- [Droplet delivery](../docs/hub/running.md): size-scaled, bounded upload retries, per-attempt run-log receipts, terminal no-lease recovery and lost-machine collection-log reconstruction under the local run's droplet lifetime; incomplete package closure keeps final reporting fenced until confirmed machine deletion.
- [Regional capacity](../docs/hub/running.md#controls-and-the-prepared-snapshot): the exact create-time size-unavailable 422 tries the next eligible configured region, recording refusals in the run log; other create errors retain their handling.
- [Test waits](../docs/agents/tests.md#waiting-for-an-observable-condition): current load sampled per setup operation, scaled browser/fake defaults, a launch-scaled Node backstop when its config setting is absent, and exact configured, injected-clock or named behaviour deadlines. Admitted Node limits without default provenance stay exact. The literal-timeout census is report-only.
  Load/Web repetition import defaults sample per child admission; explicit startup budgets stay exact, and an accidentally converted missing factor is refused.
- [Connection snapshots](../docs/hub/negotiated-connection-snapshot.md): the first unnumbered local subscription replaces presence, remote and host facts missed between hello and subscribe, then drains concurrent publications in order.
- [Condition-wait lint](../docs/agents/tests.md#test-lint-reports): AST-counted fixed bounds have a separate advisory baseline; growth reports never change admission or exit status.
- [In-process test fixtures](../docs/agents/tests.md#in-process-harnesses): `projectHub` uses fixture lock identity and process-start facts; T3 selects `lockIdentity: 'native'` and `probes: 'native'` explicitly, or uses `nativeProjectHub`.
- [Waiting suite tickets](../docs/hub/running.md#waiting-suite-tickets): native process birth preserves FIFO admission across wall-clock corrections; runner-owned infrastructure receipts retain their cause without interpreting test output. Older delivered runners without the optional cause channel retain their exit with an empty cause; droplet launcher updates require a hosting hub restart.
- [File startup watchdog](../docs/hub/running.md): typed file-start receipts in phases and each load-gate/Web repetition get 30 seconds of load-scaled setup headroom, capped at half the admitted no-output timeout, before the existing owned stall cleanup runs.
- [Local verification cancellation](../docs/hub/running.md): the live executor retains captured native descendant identities across incomplete cleanup attempts and drains detached orphans before roots and the cancelled report; copied leases inherit no live capture authority.
- [Claude terminal approval notifications](../docs/hub/adapters-and-sessions.md): retain pending hook identity across parent turns and send one reminder after 30 minutes on the hub clock; the session states reference describes resolution and legacy hook behaviour.
- [Topics](../docs/hub/topics.md)
- [Native fixture inventory](../qa/briefs/T-1806-inventory.md): shared exact name-set checks and scratch-only host socket routing.
- [Fixture residue maintenance](../docs/hub/fixture-residue.md): Coordinator-only literal alias cleanup with positive closure proof; historical roots stay retained.
- [Fixture ownership](../docs/agents/tests.md#implementer-test-selection): registration requires allocated scratch roots; readers refuse escaped roots and legacy global receipts. Allocators grant their own roots; headless QA carries its fixed-root grant through a checked Node preload outside the case environment. Optional hub/stub receipt refusals emit structured stderr diagnostics and keep serving without receipt authority for that root. Private runtime receipts and aliases stay out of Git and fixture copies; copies acquire fresh ownership.
- [Fake-Claude fixture recovery](../docs/agents/tests/hub-test-fake-claude-cleanup.test.ts.md): admitted scripted sessions hold private PID/birth receipts; guarded orphan recovery joins their spokes after test-worker death, and native adapter files end with named process censuses.
- [Host process observation](../docs/agents/host-agent.md): Linux procfs ENOENT requires an independent signal-zero ESRCH before exit; hidden live PIDs remain unknown.
- [Demo publication policy](../docs/agents/qa-demo-recording.md): remote QA captures reject Bearer credentials in Authorization headers and standalone token runs of at least 16 characters; short prose remains publishable. Manual captures still require redaction and scanning.
- [Thread runs and fold lines](../docs/hub/thread-runs-and-fold-lines.md)
- [Asks and the inbox](../docs/hub/asks-and-the-inbox.md), including internal hub cards and synchronous answer handlers; [login wait cards](../docs/hub/logins.md#login-wait-cards) share one prompt per pool/harness shortage

Card sign-in uses the prepared Host's `signin-v1` agent operation. Its owner
shares CLI preparation and disk completion, handles secret Claude Code input,
and withdraws the code card at the 15-minute hub-clock limit. Disk ownership
waits for the exact native cancellation close before failed completion. [The logins reference](../docs/hub/logins.md#login-wait-cards) states the
registration and capability conditions; component fixtures may override the runner. Secret remote
answers use native message identity without a code hash; deletion follows the
durable answer receipt, with one fallback notice when unavailable. Only the parsed
link of a stored sign-in-code card may pass remote URL masking, on an explicit
harness sign-in origin and without registered secret bytes; other URLs stay masked.
Active intent and cleanup records recover in bounded indexed pages outside
startup. Unknown new-login native outcomes use the shared interrupted-sign-in admission,
retain the mounted disk and exact-machine fence, and emit a named Agents notice.
- [Roles](../docs/hub/roles.md)
- [Rulebook](../docs/hub/rulebook.md)
- [Project logins](../docs/hub/logins.md): terminal disk sign-in, daily and on-demand backup snapshots with per-login scheduling and pending-binding deferral, human metadata listing (local CLI/Neovim or authenticated web), web Hosts Add and Sign in again with inline shared sign-in cards, SQLite records, episode-based dead-login sign-out/card recovery and Coordinator notices without stopping running sessions, transitions, provisioning-time attachment for waiting launches and launch-time disk binding, exclusive writers, snapshot-cloned readers, idle exclusive-flag updates and OpenCode keys delivered only in pool-host spawn environments.
  Thaw replay recognizes an already thawed userspace freeze on a validated ext4 mount through fsfreeze's specific C-locale EINVAL receipt, under the provisioned-host sole-freeze-owner contract; hosts need the updated image or helper for this behaviour.
- [Provider credential migration](../docs/hub/provider-credential-migration.md): store the token with `cland secret set digitalocean.token`; the human removes startup exports, then restarts the hub and sessions. Doctor warns with names only.
- [Host providers](../docs/hub/host-providers.md): local-only `host.providers` reports configured provider token presence and fingerprints from the running hub's resolved secret store/environment without provider calls; validated pool configuration and pure weighted placement decisions, provider contracts, pool image keys and local human `cland host prepare [pool]`, `host create [pool]`, `host list` and `host destroy <id>` (joins watchdog exit, retaining typed incomplete ownership on an unknown stop); pool settings apply on reload or `cland config set`, init creates no pools; fake hosts create to ready, DigitalOcean prepares with executor builder controls and requires E-1534 admission for production creation.
- [SSH transport](../docs/hub/ssh-transport.md): `hub.status` and `cland hub status` distinguish revoked hosts with their persisted first revocation time; legacy revocations show unknown time. Other carrier states stay unchanged.
- [Host revocation settlement](../docs/agents/host-agent.md#settlement-before-host-revocation): bounded pre-cut cleanup, changed-boot closure receipts and named unresolved generations.
- [Failed remote launch settlement](../docs/agents/host-agent.md#failed-codex-and-opencode-launch-settlement): Codex and OpenCode retain exact forward ownership through hub restart; missing generation state holds the role.
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
  offers sign-in mode between hub and remotes; `--yes` keeps single mode,
  while users mode confirms browser sign-out and waits for the first passkey.
  With no reachable hub, config single mode skips and users mode stays open
  with hub-start guidance.
  Optional agent pools, image builds and first terminal logins, each paid action on a separate default-No confirmation.
  Setup carries confirmed terms into admission and compares prior pool values
  on writes; changed terms refuse before paid work.
  offers agent hosts after remotes and before the Aide, default No; `--yes` skips
  untouched hosts. Missing role pools stay open (exit 1), with the role, pool and
  configure-or-local repair commands; doctor warns with the same fix.
  Nonterminal untouched hosts skip; partial pools stay open, with
  exact commands in the detail and no writes. Token
  presence comes from the hub environment; paid-pool confirmation names the
  recorded size, minimum hosts and hourly price.
- [cland init and cland update](../docs/hub/cland-init-and-cland-update.md)
- Release setup: `cland release --item T-n --preflight` reports hub tools/auth, clean root, committed versions and managed header immediately after the release epic brief, before covers. Report mode exits 0 with all findings; no GitHub writes. See [release flow](../docs/hub/cland-init-and-cland-update.md#release-and-sync).
- [Prebuilt Web release assets](../docs/hub/prebuilt-web-release-assets.md)
- [cland doctor](../docs/hub/cland-doctor.md): remote admission refusals with credential repair versus unanswered sockets with tunnel repair, toolchain, remote readiness, read-only hosts diagnostics and sign-in mode with hub-backed users counts. With `[release] web_bundle = true`, also checks gh resolution on the running hub's PATH without auth or network calls; missing tools need a hub restart with the tool on PATH.
- [The project's hub](../docs/hub/the-projects-hub.md)
- [Adapters and sessions](../docs/hub/adapters-and-sessions.md): managed Claude Bash guard refuses computed and unquoted-glob rm/rmdir targets; OpenCode server launch bounds port selections at eight, including repeated ports, within its launch deadline.
- [The tracker](../docs/hub/the-tracker.md)
- [Running](../docs/hub/running.md): executor API endpoint declarations, per-token request budgets, shared dependency preparation for local batch/probe checkouts and shared test gates for executor/host/bootstrap SSH binary overrides.
- [Enqueue preflight](../docs/hub/running.md#enqueue-preflight): isolated merged-head checks, projected closure and bounded dev-movement retries before queue mutation.
- [Artifacts](../docs/hub/artifacts.md) (includes offline QA brief lint; per-test Markdown guide references are checked by full path at the selected commit, with [report-only run-copy advice](../docs/agents/qa-brief-lint.md#corrected-run-copies))
- [Coordinator account refusal procedure](../docs/hub/coordinator-account-refusal-procedure.md)
- [Coordinator session procedure](../docs/hub/coordinator-session-procedure.md)
- [Coordinator heartbeat procedure](../docs/hub/coordinator-heartbeat-procedure.md)
- [Coordinator subscription procedure](../docs/hub/coordinator-subscription-procedure.md)
- [Additive interaction selection (T-1454)](../docs/hub/additive-interaction-selection-t-1454.md)
- [Installed verification compiler capability](../docs/hub/installed-verification-compiler-capability.md)
- [Operator retry of queued input (T-1473)](../docs/hub/operator-retry-of-queued-input-t-1473.md)
- [Pinned verifier request heads](../docs/hub/pinned-verifier-request-heads.md)
- [Merge queue landing reports (T-1503)](../docs/hub/merge-queue-landing-reports-t-1503.md)

Periodic dev T3 uses this repository's `dev_t3_every = "8h"` (new projects:
disabled). A green batch at the same verification tree suppresses it only with
structured T0/T3 and executed or member-verified T1 proof; its notice names the
batch and run. Changed-tree batch-only suppression has a durable 24h backstop
for full periodic T2/T3/Web. Unchanged trees retain their skip. Execution still
requires configured executor capacity, credentials, network and spend budget.
See [Running](../docs/hub/running.md).

Every successful batch diagnosis requires its pinned full plan on the selected
tree before landing. Test-lint read failures retry three times, then hold membership
and green evidence for a later retry; genuine findings retain member-drop behaviour. [Running](../docs/hub/running.md) describes skipped-file and
covering-run notices.
Confirmed absence of a failing file in a leave-one-out candidate drops its
omitted member; survivors run their full plan. Same-head re-enqueue rejoins a
running batch or restarts a held batch with fresh evidence. Recovery details
and commands are in [Running](../docs/hub/running.md).
- [Standing duration allowance owners](../docs/hub/standing-duration-allowance-owners.md)

The shared duration manifest reader, including `npm run check` lint and immutable
candidate lint, reports duplicate `files`, `tests` and `allow` keys with both
values. Duplicate notices remain report-only regardless of budget mode, leave
exit status and refusal counts unchanged, and retain JSON's last value.

Test case identities use Node's launched entry file for load repetitions,
duration budgets, tier accounting and quarantine, including cases registered by
imported helpers. Source locations remain in diagnostics. Older reporter events
without `entryFile` keep source-file attribution.

Filed flaky cover and batch failures can carry five same-tree hub rerun receipts;
see [flaky receipts and quarantine](../docs/agents/tests.md#test-placement-and-review)
for executor admission, stage acceptance and evidence manifest ownership.

`npm run test:tiers` and the Coordinator heartbeat report dated duration
allowances expiring within five days, including the UTC expiry and owner.
The warning is report-only; the existing expired-manifest refusal still applies.
- [Setup and doctor remote readiness](../docs/hub/setup-and-doctor-remote-readiness.md)
- [Declining an accepted verifier request (T-1494)](../docs/hub/declining-an-accepted-verifier-request-t-1494.md)

Verify CLI admission waits up to 90 seconds locally or remotely (diagnostics:
120 seconds), including candidate validation before persistence.
Verify admission returns the persisted run id and queue position before scheduler
inspection or worker launch. A sent request whose reply times out exits 75; check
`cland verify queue` before resubmitting. See [verification](../docs/hub/running.md).

See [close runs](../docs/hub/running.md#close-runs) for Linux stage covers,
optional targeted macOS stages and the macOS full epic DoD gate.

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

Executor status compares snapshot freshness to local `refs/remotes/origin/dev`,
names its short commit as `local=origin/dev@<SHA>`, and never fetches. Preparation
still fetches `origin dev` by default. Acquisition reports stale keys once in Agents;
rebuilding remains explicit. See [executor status](../docs/hub/running.md).

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

Released verification leases predating their ledger entry settle as unknown
(`cost: null` plus a missing-entry receipt). Status names the retained unknown
count alongside known totals; compaction removes them from the hot index without
inventing a zero cost. The initial index migration logs its read/indexed/settled
counts once. See the spend accounting guide for receipts and older-client fields.

- [Session pool placement](../docs/hub/session-pool-placement.md): role pool selection, capacity promises, explicit pins and session Host facts.
- [Host leases and renewal ownership](../docs/hub/host-leases.md)
- [Waiting launches](../docs/hub/waiting-launches.md): no-process replies, status records, cancellation and capacity wake-ups.
- [Detached host watchdog](../docs/hub/host-watchdog.md): lease-file expiry, confirmed provider release and spend receipts.

Waiting-launch restart ownership: [durable waits](../docs/hub/waiting-launches.md#restart-settlement).

- [Pool scale-up](../docs/hub/pool-scaling.md): minimum maintenance, waiting launches and live limits.

- [Pool idle stop](../docs/hub/pool-idle-stop.md): idle deadlines, billing floors and confirmed destruction.
- [Host restart recovery](../docs/hub/host-restart.md): provider reconciliation, restored renewal and watchdog ownership, and missing-host session exits.
- [Session recovery](../docs/hub/adapters-and-sessions.md): startup and host-ready passes pin captured session ids and report changed rows as structured skips before resuming.
- [Host status and explicit stop](../docs/hub/host-status-stop.md): weighted slots, UTC spend, pushed workbench host state and confirmed deletion.

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
CLI/Neovim or authenticated web user. Provider-confirmed disk deletions and encrypted-key removal precede
row removal; incomplete deletions retain exact ids for retry and the shared auth
store key stays. See [removal](../docs/hub/logins.md#removing-a-login).
Interactive harness sign-in uses the agent's optional `signin-v1` capability,
memory-only redacted streams, bounded output and durable admission-bound tree
close receipts; older agents refuse before spawn. See
[interactive sign-in](../docs/hub/ssh-host.md#interactive-sign-in).


Login renewal can relaunch live sessions of the renewed harness on its host when
`[hosts] relaunch_after_signin = true` (default false; init omits it). Config set
and reload apply it immediately. The shared CLI/card success hook commits sign-in
before using the existing same-conversation relaunch; stopped sessions remain
stopped. See [login renewal](../docs/hub/logins.md#relaunch-after-sign-in).

Authenticated web host/login actions and direct card sign-in replies are described in [web-started sign-in](../docs/hub/logins.md#web-started-sign-in). Users mode requires an active admin; sessions and remotes stay refused.

Web disk Add/sign-in commands allow 16 minutes for the card receipt including
cold-host setup; other commands default to 10 seconds. Pending controls prevent
repeat submission, and missing receipts remain unknown without automatic retry.
The hub's 15-minute card lifetime is unchanged; see [logins](../docs/hub/logins.md).

Sign-in code cards project an optional login-name identity from persisted hub
metadata into live/history cards and inbox rows. This restores the inline Hosts
card across a fold or reload before its start receipt; no native secret or connect
ordering changes. Older replies retain the captured-id browser fallback.

Artifact inline content is limited to 65,536 UTF-8 bytes; use `path` for larger
material. `artifact.create retryKey` / `cland artifact new --retry-key` provides
an actor-scoped durable receipt on supporting hubs; reuse identical arguments
after a lost reply. See [artifact admission and retry receipts](../docs/hub/artifacts.md#inline-admission-and-retry-receipts).

Executor preparation uses `verification.droplet.snapshot_size`, inheriting `prepare_size` when unset. This project selects c-4; paid host builders retain c-8. Matching inputs rebuild an oversized snapshot; verify admission rejects a disk mismatch before T0 and names fitting catalog sizes. See [prepared snapshots](../docs/hub/running.md#controls-and-the-prepared-snapshot).
