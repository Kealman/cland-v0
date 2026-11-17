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
