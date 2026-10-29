# hub/test/stage-closure-component.test.ts

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
