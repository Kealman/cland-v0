# hub/test/merge-queue.test.ts

T-1232 uses the sealed projectHub fixture, fake batch repository and FakeClock.
Throw only for `noticeTo`'s `merge-batch-result` notice after preparation fails;
observe the exact `merge-batch-report-failed` log within a bound, then assert
public merge.queue and hub.status replies retain the blocked member and reason.
No hub process, Git command or executor worker is needed to prove serving survives.

T-542: Public T2 merge/merge.queue frames retain sorted workspace/root manifest and lockfile changes as an explicit root npm install requirement. All candidate facts are injected; no installer runs.
