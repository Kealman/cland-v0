---
name: merge
description: Land a reviewed cland task through the Coordinator's verdict gate, or handle a gate refusal.
---

Use the hub's `merge` tool with `item: T-<n>`, or `cland merge T-<n>` from the Coordinator's shell. Task work reaches the task base (`dev` by default) only through this gate.

The Coordinator performs the merge itself. **Never delegate a merge to a sub-agent:** a sub-agent in the Coordinator's shell is taken for the Coordinator and inherits its authority.

On the hub’s `ready` status event, read the item with `task.view` and call the gate yourself. This one event starts the Coordinator’s turn and stands for the item lead’s ready report. The claimant leads its review and QA loop: it requests the Reviewer verdict and, when `task.view`’s `qaPolicy` has a non-none scope and `when: per-item`, the QA verdict, and fixes not-clear findings before requesting a new pass. Reports address `lead T-<n>`; the Coordinator is the fallback for an unclaimed item. Let the lead handle the loop instead of relaying verdicts. Only the latest hub-written verdict of each kind counts: the writer must have held the corresponding role at write time, must not claim the item, and the verdict must be clear and current for the task branch. A Coordinator's rescue-run verdict does not satisfy the gate.

Default subscriptions give the Coordinator the tree outside active item leads, plus the immediate `ready` exception. Other events are digested at the next turn; use `subscribe` for additional subjects and `subscriptions` to inspect them instead of polling. Send routine status updates as kind `progress`; blockers and actionable refusals use `question` or `report`.

Call `merge` when that evidence is present. No check command runs in the gate; review and QA supply the evidence. The hub merges the tree without rewriting the task branch, lands one squash commit, closes the item and its topic, releases the claim and removes its worktree and branch. Removal waits while a session stands inside; stop finished sessions so cleanup can complete.

On refusal:

- Missing, invalid, not-clear or stale verdict: send the refusal to `lead T-<n>` with kind `report`; the lead requests the new verdict from the role named by the refusal. For an unclaimed item, request it yourself.
- `verdict-missing`: preserve the durable record and restore its missing or altered comment; an older clear cannot replace it.
- Freshness pending: let the async cache settle, then retry once; if still pending, report the refusal.
- Conflict: send the named files to the Implementer to rebase in its worktree. After the rebase, let the gate check whether the reviewed patch is preserved.
- `merge-unpublished`: the root’s `dev` has commits absent from the territory; commit any remaining tracker work, run `cland push` from your own shell, then retry merge. A refused merge leaves refs and checkout unchanged and names those unpublished commits.
- Touched root edits or wrong checkout: preserve the root's work and restore the task-base checkout before retrying.
- `merge-recovery`: neither integration ref landed the prepared commit, but checkout restoration is pending. Preserve the durable receipt, remove the named obstruction, and retry the same item; it restores the checkout before rechecking the gate.
- If `merge-recovery` names pending `cland sync`, finish that sync retry before merging; its receipt pins dev until recovery completes.

Only the human's own shell may run `cland merge T-<n> --override "<reason>"`. When that decision is needed, ask the human through the Coordinator's `ask`; the reason goes on the item and into the journal. Override skips verdicts; conflicts and Git safety still apply.

Report the returned commit and cleanup status in the item's topic. If cleanup keeps uncommitted work or a branch moved since merge, preserve its branch and worktree. Use the human's `cland worktree prune` only after the work is safe to remove.

If the result says `merged, follow-up failed: <step>`, the returned commit has already landed. Repair the named rollback, checkout, publish, close, release, topic or cleanup failure and retry `merge` for the same item. Checkout recovery preserves staged and untracked work; reconcile any changed index before retrying it. The hub verifies its durable prepared landing against Git and completes the remaining steps without creating another commit, including after a hub restart.
