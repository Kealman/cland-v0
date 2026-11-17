# hub/test/executor-droplet-component.test.ts

T2 status regressions inject Machine's native execution callback and provider
lookup, with a fake clock and disposable lease storage. No SSH binary, droplet,
user lookup or machine service runs. User lookup, private-key format/permissions
and spawn failures must retain unknown status with the local-client cause past
300 seconds, clear an older durable unreachable timestamp, then recover to the
remote running receipt. Keep the prior unknown reply without cause in the
ordinary connection-timeout control, followed by lost at exactly five minutes.
Provider absence (404 or null resource) and expired lifetime still win; provider
lookup failure alone remains unknown. CLI role controls use the in-process hub.

Each status scenario enrolls caseDeadlines with beforeDirectories and
guardDirectoryRemoval before acquiring its root. The whole admitted callback
joins status and lease I/O before root disposal; each continuation enters
through the shared step fence. Executor teardown is registered through the
owner's fixture hooks. Do not use a cancellation experiment on the live project.

Status tests call the production DropletExecutor repeatedly, retaining its
DropletRun observer. Capture its structured LogFn sink before the first poll.
Each hold emits one enter event and one leave event, with run id, cause and the
bounded transport error retained on leave; repeated held/recovered polls emit
no duplicate. Provider-loss exit also retains the original diagnostic.

The uploaded status-program regression runs the production generated JavaScript
in a VM with fake filesystem/process boundaries and a positively controlled
native-launch guard. It rejects whole-file cause reads, counts at most4096bytes
plus one oversize sentinel across short reads, and observes descriptor close.
Valid, oversized, missing, failed-read and failed-close receipts preserve the
recorded exit, including a green exit with unavailable cause metadata. The
bounded reader implementation is shared with local commands and embedded by the
hosting source, so production activation still requires a hub restart.
The VM case registers teardown before guard acquisition and captures its restorer
through the same pre-mutation owner callback as the fake command matrix.
