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
