# hub/test/adapter-native-boundary.test.ts

Claude's MCP and settings files carry private session authority from T-1220.
Keep the native bg/log rollback cases' empty-run-directory and exited-child
assertions. The adapter owns staged flags through `LaunchFiles`: failure removes
new files and only empty parents it created, or restores prior file bytes/modes
on relaunch. Stop a started background harness before undoing its resources;
a failed stop must retain the resources with its watcher. Partial-write cases
also preserve the hub-owned credential and a peer session's private directory.

T-1471 partial-write injection targets settings.json inside the new immutable generation directory, not the superseded flat files. It requires the fault to fire before any native child starts, the failed generation to be removed before rejection and both hub-owned/peer credentials to survive. Earlier flat private files keep their exact bytes and modes.

OpenCode's Host-owned serve.log descriptor closes after native spawn. Inject its
close fault only on that exact handle: spawn resolves, records
host-spawn-log-close-failed with the owned PID, and retains the normal live
session/config/password/child until explicit stop. A config handle's close fails
before spawn and still rejects, leaves zero native children and rolls back its
files and staging.

Codex uses the same exact post-spawn log-handle diagnostic control, asserting
its thread/socket and owned live child before explicit stop. Its pre-spawn log
handle control revokes authorization after opening that log, then injects a close
failure: the launch rejects, starts no app-server child and rolls back its log
and socket directory. Host.spawn rechecks authorization after async log preparation.
The fake version CLI now answers through a short native process on Host.run;
identity, all other native processes and the rollback assertions stay real.

T-1644 forced injection-point migration preserves every assertion and test name:
OpenCode ignore creation/partial writes inject the Host publication staging
FileHandle.writeFile, selected by its exact scratch parent and .stage- basename.
Append faults inject fs.promises.appendFile. A concurrent editor is planted
after the native staging write completes, before publication. These keep native
staging cleanup, once-failed append retry and no-clobber preservation reachable.
Config/password, link and all lifecycle injection paths remain unchanged.

Each of the six relocated cases increments and asserts its own injection counter,
proving the production Host boundary was reached in that case.
