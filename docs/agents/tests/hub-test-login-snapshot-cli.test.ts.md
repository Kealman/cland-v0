# hub/test/login-snapshot-cli.test.ts

T2 projectHub with fake hub-lock and droplet process boundaries, isolated fake
provider files and FakeClock. Only the CLI under test spawns a subprocess.

`login snapshot CLI confirms a ready disk and refuses a key with no disk` proves
C5 through the real local socket and CLI: stdout confirms the backup, a subsequent
store read sees one id, the key refusal names its absent disk, and command help
lists the syntax. Snapshot scheduling and in-use freeze/thaw are covered by
login-snapshots.test.ts. login-list.test.ts retains the previous wire-row shape
regression and covers session/web/gateway refusal for the new command too.
