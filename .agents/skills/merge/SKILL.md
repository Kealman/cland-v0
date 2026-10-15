---
name: merge
description: Land a reviewed cland task through the hierarchy verdict gate, or handle a gate refusal.
---

Lane order uses `follows` between epics, separate from `blocked_by`. A follow is met when its predecessor closes, or has task children all closed with its last ticket merged. When every ticket of the predecessor’s last stage is in review, cut the following epic’s tickets with `to-tickets` and write its `plan-epic`; launch the first stage on the last merge once blockers are closed and follows met. The predecessor’s QA demo runs in parallel. Until either demo verdict is recorded or the predecessor closes, the merge gate holds follower tickets whose diff overlaps files changed by that predecessor’s merges on dev; tickets with no overlap can merge.

Use the hub's `merge` tool with `item: T-<n>`, or `cland merge T-<n>` from the supervising Lead's or Coordinator's shell. Task work reaches the task base (`dev` by default) only through this gate.

The supervising Lead merges scheduled tasks within its claimed subtree; the Coordinator merges unscheduled tasks and tasks outside a Lead's scope. Perform the merge yourself. **Never delegate a merge to a sub-agent:** it inherits the launching session's authority.

On the hub’s `ready` status event, read the item with `task.view` and call the gate yourself. This one event starts the supervising Lead’s or Coordinator’s turn and stands for the item lead’s ready report. The claimant leads its review and QA loop: it requests the Reviewer verdict and, when `task.view`’s `qaPolicy` has a non-none scope and `when: per-item`, the QA verdict, and fixes not-clear findings before requesting a new pass. Reports address `lead T-<n>`; the nearest container Lead, then Coordinator, is the fallback for an unclaimed item. Let the lead handle the loop instead of relaying verdicts. Only the latest hub-written verdict of each kind counts: the writer must have held the corresponding role at write time, must not claim the item, and the verdict must be clear and current for the task branch. A Coordinator's rescue-run verdict does not satisfy the gate.

Default subscriptions give each Lead its subtree outside descendant leads and the Coordinator the remainder, plus the immediate `ready` exception. Other events are digested at the next turn; use `subscribe` for additional subjects and `subscriptions` to inspect them instead of polling. Send routine status updates as kind `progress`; blockers and actionable refusals use `question` or `report`.

Request source review first. Only after a clear source verdict does the Implementer run `cland verify` (the transition alias is `cland suite`) at the exact reviewed head. A fix or merge that changes the head needs a new source review before a new run. An unchanged head may reuse an earlier green run through the tree-hash cache. Require the same-head successful result and the Reviewer’s final verdict before merging; queueing or a source verdict alone is not a pass. The gate still relies on current hub-written review/QA verdicts. See `docs/agents/tests.md`.

After integrating a batch, the Coordinator runs ordinary `cland verify` on `dev` with one slot. At stage close, epic close or before release, it runs `cland verify all --occasion stage|epic|release --report <topic>`. Only the Coordinator may set these occasions; QA may set `epic` for its integrated demo. Remote closes shard into free slots up to `[verification] shards` (default 2), within the daily spend cap ($3 here). If fewer than two slots or insufficient cap remain, one warn notice names the cause and the whole run uses one slot. Read the merged report, per-shard logs, durations and costs: two ten-minute c-8 lifetimes estimate $0.0833 total, plus any additional provisioning/cleanup lifetime. See `docs/agents/tests.md` for the admission and cache rules.

A green same-head result from either executor satisfies the gate's suite evidence. A Linux droplet result lists macOS-only cases as skips; those cases run in the release's final local run ("Release v0.1.2 from the item"). Read the executor and platform in the result, and the droplet's lifetime and cost; a Linux pass leaves the final macOS checks to that release run.

Call `merge` when that evidence is present. No check command runs in the gate; review and QA supply the evidence. The hub merges the tree without rewriting the task branch, lands one squash commit, closes the item and its topic, releases the claim and removes its worktree and branch. Removal waits while a session stands inside; stop finished sessions so cleanup can complete.

On refusal:

- `forbidden` naming a level or subtree: report the request to `lead T-<n>` for your claimed node. The Coordinator keeps releases, sync, push, unscheduled merges and Lead launches.

- Missing, invalid, not-clear or stale verdict: send the refusal to `lead T-<n>` with kind `report`; the lead requests the new verdict from the role named by the refusal. For an unclaimed item, request it yourself.
- `verdict-missing`: preserve the durable record and restore its missing or altered comment; an older clear cannot replace it.
- Freshness pending: let the async cache settle, then retry once; if still pending, report the refusal.
- Conflict: send the named files to the Implementer to rebase in its worktree. A changed head needs source review before another verification run; the gate still checks whether the reviewed patch is preserved.
- `merge-hold`: wait for the named predecessor’s demo verdict or closure, then retry the same head. Keep the `follows` relation and the gate in place.
- `merge-unpublished`: the root’s `dev` has commits absent from the territory; a Lead reports it to `lead T-<n>` for its own node. The Coordinator commits remaining tracker work, runs `cland push` from its own shell, then retries merge. A refused merge leaves refs and checkout unchanged and names those unpublished commits.
- Touched root edits or wrong checkout: preserve the root's work and restore the task-base checkout before retrying.
- `merge-recovery`: neither integration ref landed the prepared commit, but checkout restoration is pending. Preserve the durable receipt, remove the named obstruction, and retry the same item; it restores the checkout before rechecking the gate.
- If `merge-recovery` names pending `cland sync`, finish that sync retry before merging; its receipt pins dev until recovery completes.

Only the human's own shell may run `cland merge T-<n> --override "<reason>"`, for changes confined to `.cland/tasks/**`, `.cland/RULES.md`, `docs/**`, `GLOSSARY.md`, files named `README.md` in any directory, and `qa/briefs/**`. The gate checks the immutable merge candidate against its task base, including deletions and both sides of renames. `merge-override-scope` names every other changed path; send that work through review. Configuration files and skill instructions require review even when they are Markdown. When a permitted override decision is needed, ask the human through the Coordinator's `ask`; the reason goes on the item and into the journal. Override skips verdicts and criteria; conflicts and Git safety still apply.

Report the returned commit and cleanup status in the item's topic. If cleanup keeps uncommitted work or a branch moved since merge, preserve its branch and worktree. Use the human's `cland worktree prune` only after the work is safe to remove.

If the result says `merged, follow-up failed: <step>`, the returned commit has already landed. Repair the named rollback, checkout, publish, close, release, topic or cleanup failure and retry `merge` for the same item. Checkout recovery preserves staged and untracked work; reconcile any changed index before retrying it. The hub verifies its durable prepared landing against Git and completes the remaining steps without creating another commit, including after a hub restart.
