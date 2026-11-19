# hub/test/merge-queue.test.ts

The file remains T2, its tier before T-1932. CLI assertions use production modules
under the [sealed component boundary](hub-test-suite-protocol.test.ts.md) and a
positively controlled launch guard through cleanup.

T-1900: The ordinary landing case launches an in-process fake Claude Coordinator,
waits for accepted role input, and makes it idle. A lead's progress note remains
queued without channel delivery or native input; the following ready report
delivers it in the ordered digest. After making Claude idle again, completion
of the fake batch must inject the exact landing report once without another
message to wake it. Named `until` waits use the shared load-scaled deadline
helper (1500 ms base), rather than a product latency bound. The executor and Git
remain fake; this proves routing and injection, excluding native Claude behaviour.
Changing the landing notice to progress makes the injection wait fail.
The ready report and progress reach persisted `injected` history stages. Landing
uses the journal's exact message id and Coordinator `injected` receipt: its
aggregate history stage also includes the spoke-only claimant's delivery.

T-1232 uses the sealed projectHub fixture, fake batch repository and FakeClock.
Throw only for `noticeTo`'s `merge-batch-result` notice after preparation fails;
observe the exact `merge-batch-report-failed` log within a bound, then assert
public merge.queue and hub.status replies retain the blocked member and reason.
No hub process, Git command or executor worker is needed to prove serving survives.

T-542: Public T2 merge/merge.queue frames retain sorted workspace/root manifest and lockfile changes as an explicit root npm install requirement. All candidate facts are injected; no installer runs.

T-1207: Public merge/topic.history frames assert successful enqueue and the exact epic/files in advisory demo warnings, routed to Coordinator/item lead. Git history is injected; lease files and tracker landing/verdict records are seeded only in the sealed disposable root. Active unexpired leases (even after an earlier recorded demo) and due demos warn; stage QA does not complete a demo. Building, completed, closed, unlanded and unrelated epics remain quiet, as do expired/released leases after a recorded demo. The merge reply is the warning publication boundary, so history is read after that receipt without elapsed-time waits.

T-1207 M1: Corrupt lease JSON and null, malformed or throwing Git history reads retain a successful enqueue/queue entry and exact unavailable-warning diagnostic. Only diagnostic reads are faulted; existing admission/authorization controls stay active.

T-1425 seeds a closed task with its durable merge receipt and an old failed
batch before projectHub starts. Observe the injected repository's cleanup
receipt, then assert the public merge.queue frame has cleared the batch.
Preparation, checkout and budget reads fail the test: recovery needs no new run.

T-1503: Enqueue through a fake Coordinator spoke and the public merge frame.
Use the fake executor and immutable batch Git facts, intercepting only the
queued TaskMerges landing to persist a merge receipt and close the item. This
checks queue orchestration and delivery, not native Git. Capture the batch id
before completing the fake worker; wait for durable closure and batch cleanup,
then assert one item-topic report and one native channel event for each of the
requester and pre-closure claimant. The red control observed zero reports.

Recovery controls retain a pending report across a sealed crash image with a
closed matching merge receipt and no queue/claim. Public queue cases hold the
landing across a Coordinator rename and old-name reuse, deduplicate a shared
requester/claimant, and retry null notice admission after batch cleanup.
Use caseDeadlines before fixture acquisition for separate bounded hub/UI and
spoke readiness; register emergency held-merge release before acquiring them.
The shared case-deadlines controls retain late startup and stop before removing
roots. The fake landing and executor still exclude native Git/executor proof.

Recipients settle independently: an unknown identity stays pending while known
recipients receive the single durable report. Later resolution appends only the
missing delivery, preserving the message id and earlier receipts. Human enqueue
has a topic receipt and delivers to the claimant without inventing a human session.
Definite pre-landing refusals and base rebuilds retire the attempt obligation;
recoverable or uncertain landing errors retain it. The refused/re-enqueued
same-head control and late-recipient reconnect control guard against duplicates.
