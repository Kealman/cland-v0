---
name: merge
description: Land a reviewed cland task through the Coordinator's verdict gate, or handle a gate refusal.
---

Use the hub's `merge` tool with `item: T-<n>`, or `cland merge T-<n>` from the Coordinator's shell. Task work reaches the task base (`dev` by default) only through this gate.

The Coordinator performs the merge itself. **Never delegate a merge to a sub-agent:** a sub-agent in the Coordinator's shell is taken for the Coordinator and inherits its authority.

Read the item with `task.view`. Request a Reviewer verdict and, for `qa-required`, a QA verdict through the corresponding role. Only the latest hub-written verdict of each kind counts: the writer must have held the corresponding role at write time, must not claim the item, and the verdict must be clear and current for the task branch. A Coordinator's rescue-run verdict does not satisfy the gate.

Call `merge` when that evidence is present. No check command runs in the gate; review and QA supply the evidence. The hub merges the tree without rewriting the task branch, lands one squash commit, closes the item and its topic, releases the claim and removes its worktree and branch. Removal waits while a session stands inside; stop finished sessions so cleanup can complete.

On refusal:

- Missing, invalid, not-clear or stale verdict: send the findings to the Implementer or request a new verdict from the role named by the refusal.
- `verdict-missing`: preserve the durable record and restore its missing or altered comment; an older clear cannot replace it.
- Freshness pending: let the async cache settle, then retry once; if still pending, report the refusal.
- Conflict: send the named files to the Implementer to rebase in its worktree. After the rebase, let the gate check whether the reviewed patch is preserved.
- Touched root edits or wrong checkout: preserve the root's work and restore the task-base checkout before retrying.

Only the human's own shell may run `cland merge T-<n> --override "<reason>"`. When that decision is needed, ask the human through the Coordinator's `ask`; the reason goes on the item and into the journal. Override skips verdicts; conflicts and Git safety still apply.

Report the returned commit and cleanup status in the item's topic. If cleanup keeps uncommitted work, preserve it and use the human's `cland worktree prune` after it is safe to remove.

If the result says `merged, follow-up failed: <step>`, the returned commit has already landed. Repair the named close, release, topic or cleanup failure and retry `merge` for the same item. The hub verifies its durable prepared landing against Git and completes the remaining steps without creating another commit, including after a hub restart.
