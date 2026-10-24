# hub/test/claude-code-environment.test.ts

Read generated settings and MCP configuration from the private file paths in
recorded argv. The credential contract covers two named owners plus relaunch;
assert credential equality as a boolean and absence from every argv entry.
Use a disposable directory for launch files even when execFile is replaced.
