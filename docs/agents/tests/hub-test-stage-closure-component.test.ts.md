# hub/test/stage-closure-component.test.ts

The synthetic scale case seeds 5,000 suite jobs across trees and occasions into
an isolated fixture store, then builds ten epics with three after-stage plans
each. It observes persisted planned statuses, reads the CLI's task.plan show
reply through the socket, and refreshes the explorer. Each plan-write-to-planned
receipt and the stage-read/forced-refresh/rejected-history/control interval
report elapsed time as diagnostics only; fixture startup and initial setup are
excluded from the latter timing. No timings of differently scoped intervals
are compared as a speedup.
An instrumented job iterable counts each actual yield and asserts exactly 5,000
visits. The explorer check arms an item-change observer, edits an epic's title,
observes that title in the published projection, and asserts zero additional
job yields. A second 5,000-cover history has only rejected Linux heads: thirty
settled stage reads perform zero head-accessor reads. The prior Tracker source
fails that assertion with 150,000 actual reads. A deliberate old-style candidate
walk positively controls the accessor counter with 75,000 reads. Shared ancestry
queries and stage-specific containment checks are reported separately; this
fixture's empty landing sets perform zero containment checks. Tip changes and
retry receipts invalidate shared ancestry without changing unknown ordering.
Paired and unpaired candidate lists unlink rejected heads and iterate lazily,
including a per-tree unpaired list; reads never sort/copy the retained candidates.
The whole callback enrolls the item-local stageCase before acquisition and
adopts its root in the producing continuation. The owner joins original work,
then requires a successful tracker/component close receipt before storage/root
cleanup. A failed or timed-out observation keeps its actual work and native
guard retained. Only confirmed writer closure plus settled remaining cleanup
permits restoration; an unrelated post-close diagnostic remains a failure.
The component uses the owner's resource context: its partial-startup stop hook
is enrolled before acquisition, so a lost startup observation cannot lose the
successful-close prerequisite when the returned component is unavailable.
Unmerged children keep stages open despite matching platform receipts. Git and
platform facts are injected; no provider, native worker or browser runs in this case.

T-1029: start the in-process hub twice with legacy two-platform suite receipts,
without a prior QA verdict or saved stage closure. Hold the second start's tree
read, record QA through the authenticated spoke, and assert that restored evidence
is pending and QA currency is unknown. Release the read and retain the assertions
that the original cover ids count and that this post-restart verdict is current.
The fixture's optional `stageTree` seam holds product work, not elapsed time.
The paired `suite-close-component.test.ts` regression proves actual shard completion
and checkpoint restoration separately; this case needs no provider execution.

T-1276: the publication case records a completed publish landing, reopens the tracker and observes task/view and after-stage progress. A same-tree Linux cover that lacks the published dev merge is rejected; the containing Linux/macOS pair closes the stage. Publication never creates a merge-recovery receipt. Git and covers are injected; no process or browser runs.

T-1082: force a checkpoint-free recompute over the pinned copied tracker plus
1,200 synthetic historical covers. Assert the selected durable closure, one
ancestry pair and log elapsed time as a diagnostic; timing is not an assertion.
The diagnostic uses injected Git on the runner platform and excludes native Git latency. Reopen the tracker
and retain its recorded closure. A separate open-stage differential compares
16 settled histories with the previous full selection algorithm, including
rejected newer covers, different trees and missing platform pairs. Unknown
newer candidates remain pending before older history is considered.
