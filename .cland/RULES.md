# Project rules
<!-- cland: rule high-water 8 -->

## 1 Briefs address the role
Scope: coordinator, lead, implementer, aide
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/brief-address-the-role.md
Reason: A report addressed to a session name stays with that session after a handover; addressing the responsible role keeps the thread with its current holder.

Briefs and requests identify the responsible role or item lead rather than the current holder’s session name, and specify role-based routing where the sender’s role permits it. Handover notes identify outstanding reports by their responsible role so that a change of holder does not strand a reply.

## 2 No long foreground commands as Coordinator
Scope: coordinator
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/coordinator-no-long-foreground.md
Reason: Long foreground commands block the event-driven Coordinator from handling hub deliveries and leave the crew waiting.

The Coordinator submits suites through cland verify and runs other commands that take more than a few seconds in the background, acting on their completion reports. Foreground commands are limited to quick checks so hub deliveries, verdicts and questions continue to be handled.

## 3 One full suite at a time
Scope: all
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/one-suite-at-a-time.md
Reason: Concurrent suites spawn enough hubs, spokes and hook processes to starve the event loop, disconnect sessions and leave orphan daemons.

On each machine, at most one full suite runs at a time. Submit suites through cland verify and let the runners manage their queue and machine lock; never wrap a current runner in the old manual mkdir lock. Deliberate machine-wide stress load takes the same exclusive capacity, and QA load measurements require a quiet machine. Targeted single-file runs do not require the suite lock, subject to the project’s load restrictions; remote runs use the hub’s configured machine slots.

## 4 Verdicts go to the lead
Scope: all
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/verdicts-go-to-lead.md
Reason: Verdicts route to the item’s lead, so waiting for a separate Coordinator delivery can strand a completed review or a required retry.

Reviewer and QA reports go to lead T-<n> in the request’s item topic, falling back to the Coordinator for closed or unknown items. The item’s lead requests review and QA, handles not-clear verdicts and retries, and reads the item topic or verdict list when checking evidence. The supervising Lead or Coordinator acts on the hub’s final ready event; a final clear verdict needs no manual relay.

## 5 No routing around refusals
Scope: all
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/no-route-around-refusals.md
Reason: A workaround such as signalling a worker after suite cancellation is refused defeats the hub’s permission boundary.

When a hub action is refused, stop that action and do not achieve the same outcome through another command, another session or another path. Wait, escalate through the authorized decision chain, or wait for the capability to become available through an authorized change. Distinguish an absent tool from an explicit refusal: once the tool refuses, that refusal governs.

## 6 The batch-merge rule
Scope: coordinator, lead
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/batch-merge-rule.md
Reason: Serial full-suite waits delayed review-clear small changes for hours, while risky hub changes still exposed real regressions and repeated hot-file conflicts consumed additional reviews and suite runs.

Small or Neovim-side deltas may merge under the batch rule when review is clear, required QA is clear, targeted tests pass and the merge is clean against freshly fetched dev; a Neovim-only item needs its own green Neovim run. Batch at most three items, then run a full integrated dev cover before restarting the hub. Hub changes to launch, ownership, storage, routing or the merge gate require their own pre-merge full suite. An integrated run may be skipped only when every item is Neovim-side and each passed at a head containing the current dev tip; every hub-side change must be covered by the latest full integrated run before restart. Fix forward or revert a red integrated result within an hour, keeping dev unreleasable until green, and record batch coverage on the affected items. Serialize items that share hot files. Before waiving a full verify after conflict resolution, require searches of both hub/test and nvim/test for all changed text and identifiers and runs of every matching test file; otherwise require full verification.

## 7 Verify the head before merging
Scope: coordinator, lead
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/verify-head-before-merge.md
Reason: A ready status or a matching remote branch can conceal stale criterion verification, missing suite evidence or unpushed commits on the local branch that the merge actually uses.

Before cland merge, compare the actual local task-branch head and freshly fetched origin head with the clear verdict and every criterion’s verification commit, rather than trusting ready status alone. Changed heads require fresh review and criterion verification. Inspect task view’s verify result and commit, and require passed evidence at the head wherever a suite is required, with any approved batch or temporary flake exception stated explicitly. Do not request follow-up commits on an already verified item without reopening its review.

## 8 Check the verify queue before committing on dev
Scope: coordinator, aide
Date: 2026-10-15
Status: active
Origin: memory:/Users/evgeniyivanov/.claude/projects/-Users-evgeniyivanov-Projects-cland-v0/memory/tracker-commits-cancel-dev-runs.md
Reason: Moving or dirtying the tree used by an integrated cover cancels valuable batch evidence and costs the crew a lengthy rerun; a fixed clean copy isolates planning changes while hub-code changes still need coverage.

Check cland verify queue before a dev commit that changes hub code, and coordinate that commit with the Coordinator when integrated coverage is queued or running. Keep planning changes committed promptly through their authorized owner. Tracker, spec and glossary commits need no waiting when the cover runs from a separate clean copy at a fixed dev commit. Run integrated covers from a clean detached worktree and, before a hub restart, confirm that the hub code at the dev tip still matches the cover’s commit.

