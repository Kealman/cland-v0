---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
metadata:
  origin: "mattpocock/skills skills/engineering/implement at 6d6a5b90; MIT, Copyright (c) 2026 Matt Pocock"
  changes: "CHANGES"
---

Implement the work described by the user in the spec or tickets.

## Merge-delta advisory comments

The hosting hub records clean reviewed-head/dev merges as report-only item
comments with path and shared-import-graph facts. The conservative rule treats
runtime/config/test/generated changes as potentially coupled. Unknown graph
facts are explicit. `patchIdCurrent` is freshness eligibility, not a gate receipt.
These comments never replace the Reviewer's merge-delta review before the next
verification under rule 11; existing patch-id carry-over stays unchanged. See
`docs/hub/web-workspace.md`, "Merge-delta assessments (report mode)". No role clause changes
or additional permissions are needed.

Claude Code's managed Bash `PreToolUse` guard refuses computed rm/rmdir targets
(command substitutions, named variables and xargs) before native approval stalls
the session. Read its reason, print the path if needed, and retry with every path
written literally. Init/update install it for hand-started sessions when `cland`
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

Run typechecking and targeted single test files while implementing. Merge batches run T0 before configured tiers and add Web after T1 for web/ diffs; use the receipt/bisection seams in `docs/agents/tests.md#queued-merge-batches` for changes there. In a hub session, run the full suite only after a clear source review, as described below; outside the hub, run it once at the end.

For README/docs edits, follow [documentation placement](../../../docs/agents/documentation.md).

For README/docs edits, run `node hub/test/lint-closed-item-wording.ts` against the
candidate tracker. Fix landed-work claims; document any historical or unrelated
runtime wording with the reason-required line exemption in
`docs/agents/tests.md` (closed-item wording guard).

Once done, request the hub Reviewer as described below; outside a hub session, use the "code-review" skill.

Task claim/launch links absent worktree `node_modules` to the root install.
Read `worktree.warning` for stale own installs or links; never replace an install
under running readers. A host check's `dependencies out of date: run npm install`
means a locked package is missing: report it to the item lead so the Coordinator
can arrange a root install after shared readers stop.

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
acknowledgement intent and typed non-admission boundary.
A terminal remote Claude PID owns one bounded native settlement and one retry
through restart recovery; recurring liveness/discovery never launches a CLI.
Keep the row and role held with the cleanup-incomplete cause until settlement.
For adopted Claude, a positively exited or replaced pinned birth is settled,
not descendant churn. Unknown identity gets one bounded native re-read; a
persistent unknown remains incomplete. Keep the single recapture for new
unpinned descendants and the UID/ancestry/birth gates unchanged.
That budget is shared across the outer capture and final pre-TERM helper for
one admitted stop, held only in memory; a new admission creates a fresh budget.
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
requires the caller's existing lock; receive/merge keep immediate refusal.
Keep receive-pack locked through native close with a 30 second stalled-push cap,
test expiry with an injected short `receiveTimeoutMs` plus a default-constant
assertion, leave upload-pack concurrent, and pin batch member heads in a short revoke/read
critical section. Preserve `worktrees.serial` → `territory.lock` → Git lock order.
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
