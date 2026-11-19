---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
metadata:
  origin: "mattpocock/skills skills/engineering/implement at 6d6a5b90; MIT, Copyright (c) 2026 Matt Pocock"
  changes: "CHANGES"
---

Implement the work described by the user in the spec or tickets.

Request validators distinguish known-invalid fields (`invalid_argument`) from
unknown types. Pairing codes share the CLI/protocol format module; preserve
error-only older-hub replies when changing request diagnostics. See
[remote commands](../../../docs/hub/remote-commands.md).

For provider credential work, read docs/hub/provider-credential-migration.md for
the human's startup-export migration, store command and shell evidence limits.

For evidence publication, use `publishSessionEvidence` from the shared
[scan-and-publish helper](../qa/EVIDENCE.md).
It scans the exact private snapshot and calls artifact.create only after a clean
receipt with a generated positive control. A refusal stops publication; redact
false positives in the export and invoke the helper again.

Artifact inline content is limited to 65536 UTF-8 bytes. Publish larger material
with `path`. After a lost reply, reuse the same `retryKey` and identical arguments
(`cland artifact new --retry-key <key>`); a new key requests a new artifact.

Doctor's release-tool check (`[release] web_bundle = true`) asks the running hub
for an opt-in gh executable lookup, never auth/network. Old/offline hub results
stay unknown. Missing release tools name the hub PATH and require restart with
the tool on PATH; caller-side GitHub auth checks remain separate.

Doctor's sign-in mode check reads config mode and hub `user.list` counts only;
see `docs/hub/cland-doctor.md` and the doctor-users per-test guide. Refused
counts stay unknown with reload guidance; offline counts name hub start.

Remote doctor discovery distinguishes received refusals from transport failure.
Keep `HubRefusal` Error messages compatible for existing callers; doctor prints
only its safe refusal class and credential/host repair, never raw refusal text.
Refusal metadata uses `refusalCode`, separate from OS transport error `code`.
Keep error-only older-hub coverage and JSON Check fields stable.

Setup's optional agent-host offer uses the hub's metadata-only `host.providers`
filter before a pool exists; it never reads the caller's provider token. Keep
`--yes` at No and require the separate paid-pool confirmation. Untouched
nonterminal hosts without `--yes` skip with exact commands in the detail; partial pools remain
open. Keep existing successful unattended setup exit assertions.
Missing role pools are read-only `open` (setup exit 1) and doctor `warn`, even
under `--yes`; share configure-or-local repair guidance from host/missing-pools.ts.
Persist pool keys through `config.set` and role pools through `role.launch`, then reload. Preserve
the unfiltered provider reply for older clients. See docs/hub/cland-setup.md.
Setup readiness also opts in to account-aware `host.status roleLogins`; an older
reply without that map stays unknown/open. Use `LoginRecords.freeCount` for both
pool counts and per-role eligibility, including the optional account filter.
Image and first-login offers each require separate default-No consent. Name the
configured builder and its declared price; leave unpriced builders open. A failed
terminal login retains its signin command and continues to the Aide. See setup's
per-test guide for simulated terminal receipts versus native stage QA evidence.
Configured readiness also requires the shared doctor image-key receipt. Setup
uses the terminal owner's hub-assigned name and named login.list readback;
before admission retain add guidance. Older unfiltered replies stay compatible.
Named metadata omits binding inventory; absence is unknown, not an empty list.
After paid yes, re-read displayed terms and leave changes open. T-1858 tracks
shared admission pinning beyond the one-human interactive setup trust model.

Setup's sign-in step runs between hub and remotes. Its offer and switch
confirmation default No; `--yes` skips single mode, nonterminal without it skips
with the auth command. Existing users mode reports its user count. Use the hub's auth switch and
opt-in `user.list setup:true` metadata; older replies stay unknown. Print the
invite only through terminal narration, never SetupLine or a prompt transcript.
Wait for the persisted passkey receipt and join the abortable terminal reader;
Enter leaves `cland user invite <name>`. See docs/hub/cland-setup.md.

Waiting suite tickets have no age expiry; native birth protects new tickets across
clock corrections. Exit 75 plus a runner-recorded `suite infrastructure:` cause is
incomplete infrastructure evidence; a matching test-output line supplies no cause.
See `docs/hub/running.md#waiting-suite-tickets` for older-runner compatibility.

## Merge-delta advisory comments

Nightly soak admission calibrates worker projections, including Web, against
observed soak receipts with a 2.17 floor, retaining its deadline reserve. Dynamic
calibration requires a remote start log marker and native finish on the same
remote clock; unknown intervals retain the last valid calibration or floor,
and exclude host T0. Oversized
bases rotate files within each tier through durable cursors before repetitions;
omitted files stay unexecuted in the log and heartbeat. An unfittable first-file
set refuses before machine creation.
Timeout evidence distinguishes unexecuted files from incomplete files and
completed tests. See `docs/hub/running.md#soak-deadline-accounting`.

The hosting hub records clean reviewed-head/dev merges as report-only item
comments with path and shared-import-graph facts. The conservative rule treats
runtime/config/test/generated changes as potentially coupled. Unknown graph
facts are explicit. `patchIdCurrent` is freshness eligibility, not a gate receipt.
These comments never replace the Reviewer's merge-delta review before the next
verification under rule 11; existing patch-id carry-over stays unchanged. See
`docs/hub/web-workspace.md`, "Merge-delta assessments (report mode)". No role clause changes
or additional permissions are needed.

Claude Code's managed Bash `PreToolUse` guard refuses computed rm/rmdir targets
(command substitutions, named variables, xargs and unquoted globs) before native approval stalls
the session. Read its reason, print the path if needed, and retry with every path
written literally, or leave a fresh `mktemp -d` directory in place. Init/update install it for hand-started sessions when `cland`
is on PATH; hub launches/relaunches inject it. Literal paths, `git rm` and heredoc
bodies pass; the guard needs no running hub.

When working as a custom role, read `docs/agents/session-permissions.md#custom-roles` for the own-claim review/verification path and route completion to the Coordinator.

When editing a kept upstream skill, write the change and item in a new sibling `CHANGES/<item>-<topic>.md` file; keep `metadata.changes: CHANGES` stable.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

For task CLI syntax, use `cland task <subcommand> --help` (or `-h`)
immediately after the subcommand: it prints its forms and shared options without
requiring a hub or valid project configuration.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Before writing or changing a test, read "Test levels" in `docs/agents/tests.md` and put each test at the lowest tier that proves its behaviour: no new real process without a lifecycle reason, and no wall-clock waits. A `[t3-lifecycle]` refusal at line 1 of an existing T3/T4 file means its lifecycle header was lost: restore that first comment block before reading process-helper allowances.

Platform-conditional skips supply a nonblank prerequisite reason on the skipping
branch and `false` on the running branch. The report-only `skip-reason` census
detects direct boolean skip options; see `docs/agents/tests.md#test-lint-reports`
and the prerequisite receipt fixture in
`docs/agents/tests/hub-test-durations-runner.test.ts.md` for `5/5 skipped` evidence.

On `cover-quiet`, an authenticated refusal registers a durable one-shot
`test-slot-available` hub report. Do other work or end the turn until it arrives;
never poll with sleep or `cland verify queue`. Retry the targeted command after
the report; it checks admission again. If the running hub still says "wait for
it to finish", report the missing wake-up capability to the Coordinator and
end the turn until its release notice or authorized restart.

Before local tests or typechecking in cland, check `node --version` against
cland's root `package.json` engine range. For provisioned QA skills, use
`.agents/skills/qa/node-engines.json`, shipped from that same contract; the host
project's manifest is not cland's runtime authority. With nvm, source `"$NVM_DIR/nvm.sh"` (or
`"$HOME/.nvm/nvm.sh"` when NVM_DIR is unset), then `nvm use 24`; confirm the
selected version meets the full range, including its minimum patch. Otherwise
prepend an installed supported Node's `bin` directory to PATH for the command;
an absolute `node` alone does not select the runtime for its child commands.
Targeted admission prints one warning per admission on unsupported Node,
including standalone runs; treat that evidence as unsupported and rerun on the
supported version. This warning does not replace cover-quiet admission.

Landing test-lint read failures retry three times, then retain batch membership and green evidence under `merge-git` for automatic retry, including after restart. Genuine lint findings still drop their member. See `docs/hub/running.md`.

After shutdown, a later passing host-check receipt supersedes an aborted attempt
only at the same run, tree and command. Retain both attempts in log and notice;
unbound legacy interruptions stay inconclusive. No recovery command is added.

Run typechecking and targeted single test files while implementing. Merge batches run T0 before configured tiers, skip T1 only with complete structured mode-free exact-head member receipts and another configured runtime tier, and add Web after T1 (after configured tiers without T1) for web/ diffs; use the receipt/bisection seams in `docs/agents/tests.md#queued-merge-batches` for changes there. In a hub session, run the full suite only after a clear source review, as described below; outside the hub, run it once at the end.

For README/docs edits, follow [documentation placement](../../../docs/agents/documentation.md).

Batch interaction reports also include advisory T3 importer files, separately
from the T2/Web run switch. These files are unexecuted projections, including
when the switch is `run`; null means unknown and older reports may omit them.
See docs/hub/additive-interaction-selection-t-1454.md.

For README/docs edits (including site MDX prose), run `node hub/test/lint-closed-item-wording.ts` against the
candidate tracker. Fix landed-work claims; document any historical or unrelated
runtime wording with the reason-required line exemption in
`docs/agents/tests.md` (closed-item wording guard).

Once done, request the hub Reviewer as described below; outside a hub session, use the "code-review" skill.

Task claim/launch links absent worktree `node_modules` to the root install.
Read `worktree.warning` for stale own installs or links; never replace an install
under running readers. A host check's `dependencies out of date: run npm install`
means a locked package is missing: report it to the item lead so the Coordinator
can arrange a root install after shared readers stop.

Verify CLI admission waits up to 90 seconds for local or remote discovery (diagnostics: 120 seconds), including candidate validation before persistence.
Verify admission returns the durable run id before scheduler inspection and
worker launch. If a sent request exits 75 without a reply, check the queue once
before any explicit retry; the CLI does not resubmit automatically.

Commit your work to the current branch.

On a tool result with `code: "invalid_argument"`, correct the named fields using its accepted values and retry. A `forbidden` result is a permission refusal: stop that action and follow the lead-chain escalation in your role clause. See `docs/agents/session-permissions.md`.

In a hub session, use the claimed item's existing topic; if it has none, open it with `cland topic create "<title>" --item T-<n> --json` or the `topic.create` tool. An Implementer may open only its own item's topic.

In a hub session, mark every acceptance criterion done with `cland task criterion T-<n> done C<n>` before requesting the final review. Read `task view` for the criterion ids. Done marks are separate from Reviewer/QA verification; ready needs both. If only done marks are missing, the hub notices the claimant in the item topic, repeating only when that claimant’s missing set changes. A replacement claimant receives its own first notice.

The `send` tool accepts `to` as one recipient string or an array of strings (`string | string[]`); for review, use `to: "reviewer"` or `to: ["reviewer"]`. Other shapes are validation errors; omitted `to` or `[]` addresses the human.

In a hub session, set your claimed item to `review` and send `review request T-<n>` to `reviewer` in the item's topic with the committed branch/head and criteria. Inspect the send outcomes: `resolvedTo` names the selected Reviewer; a `queued` outcome waiting for the next free verifier means the hub will assign it automatically and send you an assignment or refusal notice. Wait for that notice instead of resending the same request. A refusal names the retry rule. When no verifier is live, report the staffing blocker to `lead T-<n>` so it can launch one; the queued request remains pending. For verifier routing or pending-marker changes, use `docs/agents/tests/hub-test-verifier-routing.test.ts.md`, including its ready-transition reservation and legacy `{item,kind}` restart recovery cases.

Before requesting review, fetch and merge `origin/dev`, then commit and push the head to review. After a clear source verdict, run `cland verify` at the exact reviewed head and wait for its hub result. A fix or later merge that changes the head needs a new review before a new run. An unchanged head may reuse an earlier green run through the tree-hash cache. The Reviewer settles the final verdict when the same-head result arrives; see `docs/agents/tests.md`.

A verify queued locally after a remote-budget fallback can reclaim a free remote slot in its original queue order, including after a hub restart; the hub reports the move in its topic. Wait for that request rather than resubmitting. Explicit `--executor local` stays local.

Cache evidence names the original occasion and executor. Release reuse requires
full matching coverage on the effective executor/OS, including configured defaults;
a local macOS stage receipt cannot satisfy a droplet release request. See
`docs/agents/tests.md` for receipt identity and provenance.

## Verifier request procedure

Typed file-start progress arms the command worker's startup watchdog: 30 seconds
of shared load-scaled setup headroom, capped at half the no-output timeout.
First test/suite start or a completed empty file disarms it. A startup stall
uses the existing owned cleanup and native exit/pipe/process evidence; it does
not change test behaviour deadlines. The delivered-tree package runner owns the
same guard on droplets; phase start/finish receipts delegate local outer
startup cleanup, with native exit/close reclaim and the no-output backstop for
a hung inner runner. See docs/hub/running.md and the suite-command/phase guides.

- Inspect request outcomes: `resolvedTo` names the verifier; `queued` waiting for a free verifier means the hub will deliver automatically and notify you. Wait instead of resending. If no verifier is live, report the staffing blocker to your lead; a refusal notice names the retry rule.
- Text after the item on the request's first line is detail: `review request T-12 — branch, head, scope` resolves one verifier exactly like the bare form, so a detail placed after the id never turns the request into a role broadcast. A letter glued to the id (`review request T-12abc`) is no request at all.

## Review/QA request procedure

Clause procedure (defaults implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build after the `qa` skill’s lint preflight; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

Clause procedure (project implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

## Verdict procedure

- On a not-clear verdict, fix the findings, commit and push a new head, then request review again before a new verification run and request affected QA again yourself. A clear source verdict starts verification; the Reviewer settles the final verdict on its same-head result. A final clear verdict needs no relay to the Coordinator: the hub checks freshness and sends the nearest supervising Lead (or the Coordinator) the one `ready` status event. Keep your claim until merge; report only if blocked.

Voice echo delivery owns a separate ready intent and terminal outcome from the
inbound FIFO. Preserve bounded numbered parts, stable part keys and unknown-send
fences, and prove held accepted-echo close/restart plus later General input.
Empty/missing speech commands keep audio and name command setup.



## Host admission

Demand placement requires regional login capacity; fixtures that expect growth
seed a ready regional disk before launch. Minimum/manual/login-add creates need
no free login. Use the indexed capacity selector and existing LoginBinder; see
[login capacity](../../../docs/hub/logins.md#placement-capacity).

Pool settings use the shared `host/pools.ts` parser; config set publishes them
immediately. Start a pool by setting provider; custom sizes require slots.
See [pool configuration](../../../docs/hub/host-providers.md#pool-configuration).
Pool names use `host/pool-name.ts`: 1–64 ASCII letters, digits and hyphens,
starting with a letter or digit; config reading rejects underscores.

Pool image preparation, creation, inventory and destruction (`cland host prepare [pool]`,
`cland host create [pool]`, `cland host list`, `cland host destroy <id>`) are restricted to the local human CLI or Neovim, like host revocation. Implementers
prove it in disposable sealed fixtures, never by preparing the live project.
See [pool images](../../../docs/hub/host-providers.md#pool-images).

Failed-launch rollback keeps child/file ownership when the captured native exit
receipt misses its post-stop deadline. Preserve that receipt fence; retrying
cleanup must not repeat an acknowledged stop. See the [recovery boundary](../../../docs/hub/adapters-and-sessions.md).

Host file preparation uses `publishFile` for atomic create-only or replacement,
`appendFile` for shared-ignore repair and `stat` for rollback permissions/offsets.
OpenCode's shared ignore runs on its launch Host; do not add local filesystem
exceptions. Remote publish/append settle their prepared token after a lost reply;
never retry an unknown append. See [atomic files](../../../docs/hub/ssh-host.md#atomic-files-and-metadata).

SSH item worktrees come from the host clone's socket origin; the hub grants the
branch lease and stores the owning host/root/path in hub.db. List and prune use
that owner after restart. Preserve the executable proxy wrapper: Git does not
interpret `core.gitProxy` as shell source. See
[host clone and worktrees](../../../docs/hub/ssh-host.md#territory-clone-and-task-worktrees).

When changing forwarded host clients, preserve their session credentials on CLI,
hook and mod-bridge frames. A host secret never grants human authority. Consult
[host admission](../../../docs/hub/adapters-and-sessions.md#host-secret-admission-and-revocation)
for the deny-by-default boundary and local human revocation procedure.
Remote Claude requires an installed host mod directory and agent capability
`claude-launch-adopt-v1`; the agent owns the single launch discovery and native
worker receipt. Adopt by generation, never by caller PID. Keep CLAND_LAUNCH_TOKEN
in the generation's private 0600 MCP/settings files, outside argv and command
plans; remove them after confirmed stop and retain them on incomplete cleanup.
After tree closure, confirm native stop or positive native absence before
calling the generation receipt’s release callback and deleting private files.
Recover pending cleanup by re-adopting its durable generation after restart.
Keep remote Claude MCP/settings outside generic LaunchFiles undo; its bounded
LaunchSettled callback owns deletion after native settlement. The optional
settleFailedLaunch fallback rebuilds that callback only when the captured observer
is absent; missing state/receipt holds the row and role. Forget acknowledgement
follows durable pending-stop clearance and prunes only settled metadata/cache.
See the failed-launch section in the adapter/session reference for its restart
acknowledgement intent and typed non-admission boundary. An agent command result's
`claudeAdmission` receipt must match the requested generation before SSH maps
`refused-before-spawn` to non-admission. Old replies lacking it stay conservative;
never infer non-admission from an error string or missing worker receipt.
Native `no-process` proof comes from the run owner before spawn or after a no-PID
error and joined close; Claude removes its pending checkpoint before publishing
the generation refusal. Any observed PID or incomplete close retains the fence. Pre-wire cancellation is
proven only by wire() observing its own aborted signal before the request write;
after any write, cancellation alone grants no cleanup authority. Shared incomplete
classification must honor positive owner receipts before any diagnostic-text
fallback, including when an executable or config path contains those words.
A terminal remote Claude PID owns one bounded native settlement and one retry
through restart recovery; recurring liveness/discovery never launches a CLI.
Keep the row and role held with the cleanup-incomplete cause until settlement.
For adopted Claude, a positively exited or replaced pinned birth is settled,
not descendant churn. Unknown identity gets one bounded native re-read; a
persistent unknown remains incomplete. Adopted stop sends TERM to the pinned root
before descendant convergence; two consecutive matching captures authorize
survivor escalation and two empty captures confirm closure within the stop deadline.
Keep the first-census, UID and live pinned-parent ancestry gates; checkpoint every
new birth before signalling it. A pinned live parent can anchor a new child after
the root exits; an unproved orphan cannot. There is no fixed recapture count.
Scripted proof assumes graceful Claude shutdown; real-binary behavior is unverified.
A late orphan without observed ancestry stays held, never signalled by group.
See [agent receipts](../../../docs/agents/host-agent.md#claude-launch-receipts).

## Users-mode remote publications

Use `remotePublications` and `RemoteStore.publicationPairings()` for outbound
General and card copies, independently of the current native input context.
Keep native admission pinned to the captured project owner through awaits.
Telegram chat availability and gap state are per destination in users mode;
single-mode keys and labels remain compatible. See
[remote commands](../../../docs/hub/remote-commands.md#telegram-publications-in-users-mode).

## Subsystem documentation

Host branch lease changes use `host/branch-leases.ts`: grant/revoke own the
territory lock; public revoke waits up to the push cap plus 2 seconds for a
receive/release, using the shared bounded lock backoff. Its `waitMs` is injectable;
an active matching-root lock is reused without waiting. Immediate contention and
bounded-wait exhaustion both refuse as `TerritoryBusy` with "another territory
operation holds the lock", appending the last observed holder PID when known. Merge's branch-wide revoke
requires the caller's existing lock; receive waits up to 30 seconds through bounded lock backoff; merge keeps immediate refusal.
Keep receive-pack locked through native close with a 30 second stalled-push cap,
test expiry with an injected short `receiveTimeoutMs` plus a default-constant
assertion, leave upload-pack concurrent, and pin batch member heads in a short revoke/read
critical section. Preserve `worktrees.serial` → `territory.lock` → Git lock order. Host add/relaunch preparation and watch registration run outside the territory lock between durable `adding` and revalidated finalization. Prune checkpoints `removing`, releases the lock for agent publisher drainage/removal, then reacquires and revalidates row, tip, lease and eligibility before deleting metadata. Add/relaunch refuse removing rows; `host-prune-changed` retains new state. Never hold the territory lock while joining a Host operation that can await a push. Both checkpoint acquisitions use the existing 32 second bounded backoff; an already-locked caller refuses before any Host operation rather than waiting on itself.

Public cross-host relaunch admission uses the same checkout checkpoint policy before adapter drain: acquire with the bounded backoff, then refresh task eligibility, destination registration and exact row ownership before admission. Prune observes Host state first and refreshes row, tip, leases and synchronous item eligibility after those asynchronous observations, immediately before cleanup admission. An item reopened during an occupant query retains its branch and removing checkpoint.
Use scratch host socket tests and the unedited territory/merge preservation files;
see `docs/agents/tests/hub-test-host-allow-list.test.ts.md`.

Read the matching [subsystem reference](../../../hub/README.md) for implementation guidance. Follow [documentation placement](../../../docs/agents/documentation.md) when adding item documentation.

OpenCode remote readiness, HTTP and SSE use the same per-session Unix forward.
Keep its host-local URL in the process record for native attach, and cancel the
forward after identity-verified stop or failed-launch rollback using LaunchSettled.
The callback covers the current hub lifetime; post-restart forward settlement is
tracked by T-1671. Preserve the OpenCode adapter/native tests unchanged when
changing this path; the remote lifecycle and cleanup guides name its evidence.
Normal remote exits retain supervision until identity cleanup, client socket and
watch work drain, and forward cancellation settle; failed cancellation retries
before the exit notice.

Host revocation uses `Sessions.settleHostBeforeCut` / `host/settle.ts` before the
authority cut. Its derived 12-second bound (concurrent generation stop/reap plus
retirement and inventory headroom) reports unresolved generations and unknown
inventory; no later Host cleanup is authorised. Provider removal will reuse this
entry point; no remove command is shipped. See docs/agents/host-agent.md.

Changed-boot lifecycle owners call `Sessions.retainHostGeneration(process,
{cause: 'host-rebooted', bootId})` before exit publication, with the authenticated
returning boot id. It records exact native closure for any harness and fences
pending failed-launch retries without signals or file deletion. Preserve pending
undo and host-local files outside the run folder for authorised retirement;
closure alone never proves those resources removed.

Fake-host agent, supervisor and admission-bootstrap identity observations share
`agentBootId`: fake mode requires `CLAND_HOST_BOOT_ID_FILE` on every platform,
and missing evidence refuses before agent recovery. Non-fake Linux ignores a
stray boot-file variable and uses the kernel. Keep fixture birth expectations
in that host's boot namespace; hub-local cleanup retains physical native births.

Keep the old-generation native fence independently of resource retirement:
clearing the final file/receipt obligation must never reopen native operations
through previously captured Hosts, including before the eventual authority cut.

Remote terminal attach uses the launch-written private host record and a separate
pinned-key SSH connection. Never print session credentials in the attach command.
Use `cland host attach` on the host; ending its client leaves the session alive.
See [terminal attach](../../../docs/hub/ssh-host.md#terminal-attach).

Host task branches are published by cland on every commit/ref move. Verify and
ready flush the existing leased agent publisher and require matching worktree
and territory HEADs. A fenced watch, unknown push or mismatch refuses admission;
resolve the named cause through the item lead. Verification uses a pinned,
hub-local detached territory snapshot, never the host session directory. See
[host publication admission](../../../docs/agents/host-agent.md#publication-admission).

A cross-host item relaunch uses optional `session.resume.host` with `relaunch`
(frame only). An available original host refuses migration. A lost or rebooted
host permits a registered destination to fetch the pushed task tip, take the
exclusive branch lease and start a fresh native conversation with the recorded
brief and loss note. Cland identity and claim stay; old native obligations stay
retained. See docs/agents/host-agent.md, "Relaunching an item on another host".

A pending or unknown cross-host handoff remains fenced with its destination owner
and failure reason. A settled native-admission failure with a captured checkout
receipt permits explicit retry even if the source has returned: same-host retry
validates checkout/Git-admin identity and refreshes the pushed tip; onward retry
retains the old checkout/ref-watch as a named settlement obligation. Missing
receipts stay fenced. Report unresolved obligations to the item lead; never resume
the old native generation or discard retained ownership. Successful publication commits the native
row, ready checkout, restart warning and intent completion atomically.

DigitalOcean pool image preparation uses the executor builder lease, watchdog and
spend with pool-specific image/recovery records. Host creation uses the published lease, armed watchdog and hosts reservation
receipts; see docs/hub/digitalocean-host-admission.md. Image preparation uses its
existing executor builder controls.
Use the scripted pool preparation tests and preserve executor preparation tests
unchanged. See [pool preparation](../../../docs/hub/host-providers.md#pool-images).

For host spawn memory admission and fake byte controls, see
[host-agent memory admission](../../../docs/agents/host-agent.md).

Role host pool settings use `[<role>.launch] pool` (default `local`) or
`cland role launch <role> --pool <pool>`. Coordinator and Aide accept only
`local`. Check syntax independently of pool existence; see
[role pool defaults](../../../docs/hub/roles.md#role-host-pool-defaults).

Login thaw replay uses the helper's exit-0 receipt, including `already thawed by userspace`
for the exact util-linux C-locale FITHAW EINVAL diagnostic on a validated ext4
mount with FSTYPE and mount identity rechecked under the operation lock. Provisioned
hosts use the helper as sole freeze owner; kernel freeze holders (Linux v6.8
fs/super.c), device-mapper snapshots, suspend/hibernate and other FIFREEZE users
are outside that host contract. This receipt concerns cland's userspace freeze.
The agent's null
reply and Host's void result remain compatible; snapshot recovery removes its
freeze after success and release still requires confirmed detach. Existing hosts
need the updated image or installed helper; see docs/hub/logins.md.

For project login work, use `HostRecords.logins` and isolated SQLite or projectHub
fixtures. Authenticated web users can list, snapshot and remove logins, stop hosts,
and start disk sign-ins through the card runner; users mode requires an admin.
Login set, key adds and terminal completion stay local human CLI/Neovim only;
sessions and remotes remain refused. `cland login signin <name>`
renews a signed-out disk through the same terminal owner, preserving live bindings
and sessions. Use beginSignIn/finishSignIn rather than the generic creating
transition; refuse unresolved binding, snapshot, release and removal ownership.
Renewal snapshots enter LoginSnapshots.signIn so release joins the same freeze
and thaw. Peer loss, graceful stop and startup recovery use the renewal owner's
interrupt path without native cleanup, retaining an exact-machine fence until
the release owner's persisted machine deletion receipt, never elapsed time or
detached inventory. No existing terminal SSH census identifies that writer.
The exact pending connection's post-child-close completion is the native receipt;
owner loss joins a completion already admitted with that receipt. Renewal drains
older snapshot preparation before validating and admitting its own generation.
Exercise `login.add`, `login.signin` and
connection-pinned `login.signed-in` only in disposable fake-provider fixtures.
Cards use the same preparation/snapshot owners through the captured Host's
`signin-v1` operation and shared SignIn types/close parser. Web disk starts
return the persisted link/code card; terminal completion stays connection-owned.
Existing hub cards can be answered from web and remotes.
At expiry withdraw the code card and stop input; disk settlement still requires
the exact native close. See [project logins](../../../docs/hub/logins.md).

Pool-host launch binds a project disk login at the shared native spawn boundary,
after item/role/checkout admission; role accounts select
login account names rather than hub-machine paths. Missing eligible logins refuse
with the harness and pool. Keep `LoginBinding.phase: pending` fenced until a
positive mount/commit or full rollback receipt; shutdown joins binding work to
native settlement or existing deadlines (abortable
operations are T-1801). Fresh/cross-host spawns bind at their destination; normal
native resume keeps its recorded binding.
Host-stop release leaves pending bindings fenced for the binder's positive
mount/commit or full rollback receipt. Settled disk
bindings release in parallel through the shared destroy boundary before transport
removal. Destroy also joins watchdog retirement before lease cancellation or
release; retain `watchdog-stop-incomplete` ownership for retry (see
docs/hub/host-providers.md). Use the snapshot beginRelease/onReleased hooks and positive detach
receipts; lost/gone hosts use the snapshot owner's hostLost release mode,
skip unmount and retry detached volume inventory with the hub Clock. Existing
SSH reachability is observed synchronously; deleted-host sessions settle before
volume inventory, and early gone-host startup keeps the disk bound for the
installed release owner.
An unconfirmed release retains the binding and existing hard spend deadline. Use explicit
settledLogin seeds in placement fixtures and readyLogin directory-backed volumes
for native host-create fixtures. See [login binding](../../../docs/hub/logins.md#binding-at-launch).


Demand-created pool hosts start disk attachment at createHost.onConnecting through
the Sessions-owned binder. Join the hook's ready finish before publishing host
readiness, and its failed rollback before host-stop release. Preserve pending
bindings on unknown outcomes. Captured waits retain exact admission and current
account checks after awaits; creation failure/abort fences new attachment work.
Ordinary login refusal stays launch-scoped and preserves a healthy host; see
docs/hub/logins.md, Binding at launch.

Login storage reporting retains provider lifetime receipts on the disk row. Use the existing create/delete owners and LoginRecords storage methods, with the hub Clock; never infer dates from sign-in or reserve storage as host spend. See docs/hub/logins.md.

Project login removal accepts local-human CLI/Neovim or authenticated web users. Use disposable fake
fixtures when implementing it; partial deletion retains its removal claim and
remaining ids for `cland login remove <name>` to retry. Never clear that claim
through another transition. See [login removal](../../../docs/hub/logins.md#removing-a-login).

Disk renewal uses the shared afterSignIn hook after finishSignIn commits. The
hot-applied hosts.relaunch_after_signin boolean defaults false and init omits it;
when enabled only live sessions of that host/harness relaunch through the existing
resume owner, preserving worktree and conversation. Stopped sessions stay stopped.
