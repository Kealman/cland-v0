# hub/test/adapter-native-boundary.test.ts

Claude's MCP and settings files carry private session authority from T-1220.
Keep the native bg/log rollback cases' empty-run-directory and exited-child
assertions. The adapter owns staged flags through `LaunchFiles`: failure removes
new files and only empty parents it created, or restores prior file bytes/modes
on relaunch. Stop a started background harness before undoing its resources;
a failed stop must retain the resources with its watcher. Partial-write cases
also preserve the hub-owned credential and a peer session's private directory.
