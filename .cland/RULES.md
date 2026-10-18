# Project rules
<!-- cland: rule high-water 14 -->

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

## 9 P1. Wait for the exact thing the test asserts
Scope: implementer, reviewer
Date: 2026-10-15
Status: active
Origin: session:aide-rules
Reason: load exposes the gap between the two boundaries, so fixed sleeps and immediate cross-boundary assertions flake.

A process-lifecycle test waits with a bounded condition for the exact observation it asserts, such as a PID being gone after an acknowledged stop, and keeps the final assertion. A lifecycle acknowledgement may mark a different boundary, for example "not running" as against the OS having reaped the PID.

## 10 P2. Observe completion before timing the report
Scope: implementer, reviewer
Date: 2026-10-15
Status: active
Origin: session:aide-rules
Reason: permission to finish isn't observed completion. One deadline over both produced a false timeout (A-3099, A-3120).

A test that releases a worker barrier observes the worker's completion receipt before it starts a bounded wait for the worker's downstream report, unless it is measuring end-to-end latency. It bounds the completion and report assertions separately, and keeps the concurrency assertions before the release.

## 11 P3. Keep a reviewed head stable
Scope: implementer, reviewer, coordinator
Date: 2026-10-15
Status: active
Origin: session:aide-rules
Reason: a generic merge-dev-before-review habit discarded valid Linux receipts today.

After the first source review, the task head takes only shared fixes the Coordinator posts. It is not merged with dev unless the Coordinator asks or `cland merge` reports a conflict. Any change to the head needs a fresh source review before verification.

## 12 P4. Stop fixture writers before deleting their directories
Scope: implementer, reviewer
Date: 2026-10-15
Status: active
Origin: session:aide-rules
Reason: Linux reports ENOTEMPTY when a live hub writes .cland/run during a recursive rm (T-498, T-508).

A test that deletes a fixture directory first stops every writer in it and observes that they're gone. If the assertion itself needs a live process with a deleted root, the test keeps that assertion and uses bounded removal retries, recording the bound and the reason.

## 13 No opencode CLI inside a session until T-296
Scope: all
Date: 2026-10-16
Status: retired 2026-10-16
Origin: message:general/9670ff36-30f0-4b97-a0e3-6c76f7d15738
Reason: OpenCode's background service resumes any mid-turn session it finds in the shared default database (upstream #51213), so two processes would then drive one cland session, the second without cland's spoke and with the user's global config (E-424, T-296).; Its own retirement condition is met. T-296 (OpenCode's own database) merged as 50c9f92c on 2026-10-16, and the hub restarted on green cover 1d78a0ff at about 07:22Z with T-296 live. No pre-T-296 OpenCode session is in the crew: every live role session runs on Codex or Claude Code.
Retired-origin: message:general/9670ff36-30f0-4b97-a0e3-6c76f7d15738

Never run the `opencode` CLI inside a cland session against the user's default OpenCode data directory or database until T-296 (OpenCode's own database) merges. Tests and probes that need the real binary set their own scratch HOME, XDG_DATA_HOME, config and OPENCODE_DB under a temp directory and start a standalone server. T-296's merge retires this rule.

## 14 Marketing pushes on cland-marketing's word
Scope: coordinator
Date: 2026-10-18
Status: active
Origin: message:general/96f55758-7a6f-4567-a884-47df25be611f
Reason: The human talks to cland-marketing about the site and should not have to repeat each push request in General; release-gated code must still never reach GitHub this way.

The human authorizes cland-marketing to tell the Coordinator when to publish marketing material to GitHub outside a release. On cland-marketing's request the Coordinator pushes the named commits to GitHub `site` and `main` without a fresh human confirmation, but only when:
- every changed path is in site/**, docs/brand/**, README.md, LICENSE or .github/workflows/pages.yml;
- the push fast-forwards main from its current GitHub tip;
- the diff carries no secret.
The Coordinator then merges the published tip into dev; it never runs `cland sync` for this. Anything outside those paths, or not a fast-forward, still needs the human's own confirmation.

