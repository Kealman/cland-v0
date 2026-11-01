# hub/test/project-hub.test.ts

The T2 composition case keeps the production environment-to-default-adapter
wiring while injecting a recording Host.run through projectHub's optional hosts
array. This passes through serveProject and projectSessions into Sessions;
omitting it preserves the existing local default. No adapter factory replaces
the production Claude adapter, and no native harness or child command runs.

The two disposable projects use separate FakeClocks and Claude config directories,
with 50 ms and 3000 ms discovery intervals. Keep the original assertions: after
150 ms the fast hub has at least three additional queries and the slow hub still
has only its launch query. Commands consume each adapter's actual filtered
environment; no process-global environment mutation or native command mock is used.

Check disk and machine load before local execution. Use tempProject/projectHub
for isolated HOME/XDG/Git configuration and provider credential filtering. Stop
both launched fake native jobs through their frame requests before teardown.
