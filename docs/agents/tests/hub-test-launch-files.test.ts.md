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
