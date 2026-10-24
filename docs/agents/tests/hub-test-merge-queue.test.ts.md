# hub/test/merge-queue.test.ts

T-1232 uses the sealed projectHub fixture, fake batch repository and FakeClock.
Throw only for `noticeTo`'s `merge-batch-result` notice after preparation fails;
observe the exact `merge-batch-report-failed` log within a bound, then assert
public merge.queue and hub.status replies retain the blocked member and reason.
No hub process, Git command or executor worker is needed to prove serving survives.

T-542: Public T2 merge/merge.queue frames retain sorted workspace/root manifest and lockfile changes as an explicit root npm install requirement. All candidate facts are injected; no installer runs.

T-1207: Public merge/topic.history frames assert successful enqueue and the exact epic/files in advisory demo warnings, routed to Coordinator/item lead. Git history is injected; lease files and tracker landing/verdict records are seeded only in the sealed disposable root. Active unexpired leases (even after an earlier recorded demo) and due demos warn; stage QA does not complete a demo. Building, completed, closed, unlanded and unrelated epics remain quiet, as do expired/released leases after a recorded demo. The merge reply is the warning publication boundary, so history is read after that receipt without elapsed-time waits.

T-1207 M1: Corrupt lease JSON and null, malformed or throwing Git history reads retain a successful enqueue/queue entry and exact unavailable-warning diagnostic. Only diagnostic reads are faulted; existing admission/authorization controls stay active.
