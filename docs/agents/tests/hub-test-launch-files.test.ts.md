# hub/test/launch-files.test.ts

T2 uses a recording local Host and tempProject, with no hub or native harness.
Assert directory creation, exact bytes/mode restoration, log truncation and
removal through Host operations. Replay the previous serialized undo shape and
assert final filesystem bytes plus an empty recovery snapshot. Hub-side metadata
reads remain local. Refusal cases call every new test-Host operation and require
the Host name and operation in each error and log.

Keep session-launch.test.ts and session-stop-races.test.ts unedited as controls;
session-host.test.ts additionally exercises durable old pending-stop recovery.
The reusable native cases live in host-contract.ts through the T3 local wrapper.

The testHost stat guard refuses by default and for arbitrary fileType overrides.
Only a double explicitly delegating shared local fileType/writeFile/removePath
receives native stat metadata; publish/append keep their default refusals. The
Claude polling fixture explicitly delegates file metadata/publication and real
record reads, retaining only synthetic project settings reads.

The mapped remote rollback guard plants distinct hub and Host bytes/modes. Native
hub stat/read spies reject access, with positive controls before resetting the
counter. Production LaunchFiles restores the remote bytes/mode and leaves the
hub mirror unchanged and unread.


The missing-native-exit regression first timed out without a production bound.
With a 10 ms injected receipt deadline, concurrent rollback calls report
cleanup-incomplete, retain the exact child/undo/file bytes, and a later retry
cannot repeat Host.stop. Only resolution of the captured native exit permits
file undo and an empty final snapshot. Cleanup releases the held receipt and
joins rollback before fixture directory removal; no native process is started.
