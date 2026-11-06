# hub/test/host-relaunch.test.ts

T3 native carrier-loss, worker-birth, socket Git and checkout lifecycle. The test
uses disposable SSH fixtures for two hosts and an in-process projectHub with a
scripted native worker adapter. It proves C2/C3: f1 gone, f2 at the pushed tip,
new native conversation with recorded brief/loss note, unchanged cland identity,
claim, topic and subscriptions, retained unknown old generation, f1 push refusal
and f2 push success. The original carrier returns during the adapter drain,
after durable admission; movement still completes and drain holds no territory
lock. An injected post-publication log observer failure leaves accepted native
ownership intact. A separate refused-admission case keeps destination adding,
source process and native generation retained, and failure durable; source/same/
third-host requests refuse without overwriting the destination owner. Successful
retry is covered in host-relaunch-retry.test.ts; unknown preparation stays fenced.
The new worker writes a readiness receipt; assertions wait for it separately
from setup. Setup/harness bounds use testWaitMs/eventually. Fixture cleanup joins
all agents, carriers, Git publishers and workers before deleting roots.

Run `node --test hub/test/host-relaunch.test.ts` under the preservation lock.
Loaded evidence requires five macOS and five Linux repetitions (load 12–15);
Linux uses `docker run --init`. Duration allowances and actual samples are added
after measurement; no unexecuted repetition counts as a pass.

Compatibility: run the unedited `hub/test/session-resume.test.ts`, plus the native
preservation set specified by the item launch brief. No browser is used.

T-1698 migration authorized by Coordinator decision8a85dc4d: the refused-case f2
retry now reaches its always-refusing native fixture again, and f3 names its
unregistered destination. Their previous blanket fences represented missing retry
functionality. The drain/returned-f1 setup and no-host fence remain; the additional
spawn is counted. Other T-1614 test files are unchanged. Successful returned-source
f2/f3 retries and repeated f2→f3→f4 retention are in host-relaunch-retry.test.ts.
