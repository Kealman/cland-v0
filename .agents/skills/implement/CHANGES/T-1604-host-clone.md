T-1604 adds clone-local socket Git proxy, bundle fallback over the pinned master,
clone walk-up discovery, and hub.db host worktree ownership for list/prune.
Consumers: Host operations remain at the previous wire shape; SSH registry,
TaskWorktrees, Store, CLI host help and git-proxy routing consume the additions.
Atomic launch uses the new grantBranchLeaseLocked helper; public grant keeps its existing nonreentrant contract. The helper asserts an active matching-root lock.

Source review corrections: retain accepted checkout ownership on checkpoint failure; disable SCP connection fallback; migrate the owning HOST_USAGE frozen fixture. Fault regressions cover both effect boundaries.

Merge-batch correction: clone preparation belongs to task worktree admission after carrier readiness. No-territory projects skip cloning; clone progress/failure is separate and shutdown joins preparation. Existing SSH Host and remote-discovery tests are preserved unedited.

Readiness review correction: direct registry.close uses the same quiesce transition as daemon shutdown before joining preparation, so disconnected settlement reports incomplete ownership rather than deadlocking. The regression observes an admitted native writer, held cancellation, intact storage and eventual durable cleanup. Corrected the earlier held-clone guide to identify its pre-native Host.run seam.
