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

The two hosts are pool members with explicit settled disk metadata. The
native fixture now opts into `sshHostFixture`'s directory-provider acquisition:
both captured machines share the project's fake-provider inventory, while each
SSH/agent fixture retains its own native handles. `mountedSettledLogin` confirms
each volume's attachment and mount before projectHub starts. Provision metadata
uses those exact machine identities. After agents/workers/carriers join, the
outer fixture runs the mounted-login cleanup callbacks before removing their
shared storage root; a callback failure retains that root. Other SSH fixtures
keep the default provided-host setup. No real provider or credentials are used.

The nested cleanup control plants an agent-close rejection with two live native
workers. The fixture censuses its own root plus only its captured machine's
directory, joins that worker and its descendants, and retains its secret/root
when a provider owner's close is incomplete. A native completion-receipt observer
is armed before teardown, with the exact 5000ms bound; the sibling worker must
still be alive. Retrying the joined owner completes cleanup without orphaning
metadata. The new control has its own 8s duration allowance (Linux timing remains
a projection until configured evidence runs).

The existing 29s/24s/27s case allowances cover the 2026-11-11 macOS arm64 Node24.21.0
diagnostic samples 7.150s/6.055s/5.889s. A 1.6x Linux projection with 1.5x headroom
would require 18s/15s/15s; these projections are not Linux execution receipts.

The running case checks source `codex-f1` and destination `codex-f2`, account `work`,
and destination-only CODEX_HOME in the spawn and persisted process row. The new
`C2/C3 admitted host relaunch no-login keeps durable native and checkout ownership`
case omits the destination login, asserts the harness/pool refusal and zero
destination spawns, and retains the source row/checkout ownership. These are
scripted native lifecycle checks with confirmed fake-provider attachment and
Host.loginDisk mounts; no real provider or harness login is used.

The setup Store is allocated by `withFixtureStore`: its owner is registered
immediately, joins configuration/secret seeding on rejection or cleanup, and
closes idempotently after setup settles. Pure `fixture-store.test.ts` controls
hold both successful and rejected setup producers and observe close afterward.
