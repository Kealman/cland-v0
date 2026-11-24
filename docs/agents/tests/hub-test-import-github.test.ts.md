# hub/test/import-github.test.ts

The T2 import fixture retains one sealed CLI subprocess proof and exercises
repeat imports in process with a fixture-only GitHub runner. `runImport` scopes
the ambient process environment through `fixtureEnvironment` to isolate fixture
execution. Production import forwards its explicit environment to every nested
socket request, including batches and unresolved-edge retries.
The synthetic outer-session regression records the actual socket peer's frames
and requires an explicit human actor without the outer credential. Its gh runner
reads only scratch fixture files; no GitHub authentication or network is used.

The explicit-human and explicit-session controls preserve a distinct synthetic
ambient session identity and assert the exact actor received by the peer. Task
and crew controls protect their existing explicit-environment forwarding.

The peer fixture registers `caseDeadlines` and fenced cleanup before acquisition.
Setup, action and peer closure have separate named, load-scaled observation
bounds; original timed-out work stays owned until joined. Native launch guards
include positive controls and remain installed through cleanup. Cleanup fences
admission, releases and joins held work, observes server and connection closure,
then removes the root before restoring environment and native seams. A rejected
close retains the root and both seams; retrying cleanup requires a successful
close receipt. The cancellation controls exercise real guarded removal while a
writer is held, including a rejected action. The rejected-close control exercises
both guarded removal and shared cleanup refusal, then repairs the close and
observes removal and restoration.
