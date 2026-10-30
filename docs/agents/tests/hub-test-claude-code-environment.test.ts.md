# hub/test/claude-code-environment.test.ts

Read generated settings and MCP configuration from the private file paths in
recorded argv. The credential contract covers two named owners plus relaunch;
assert credential equality as a boolean and absence from every argv entry.
Use a disposable directory for launch files even when execFile is replaced.

Launch settings retain exactly one synchronous Bash PreToolUse literal-rm guard
across project/local settings permutations; all status hooks stay asynchronous.


T-1471 covers immutable settings/MCP paths and fresh generation ids with stable
session identity. Exited-row and absent-PID controls exercise nonzero, thrown,
held and fresh-absence native stop results; replacement waits for settlement.
Duplicate inspection proves a shared native read, positive same-job `/clear`,
and unavailable when the captured job is missing. Bridge controls rotate the
captured generation before use, retain the old-disconnect assertion, and confirm
exactly one new bridge receipt with no old send. The command edge is mocked;
these results do not claim native process lifecycle coverage.


The post-stop freshness regression captures an empty native snapshot before a
failed stop, makes the job listed, and holds the old snapshot until the adapter
reports waiting at that earlier-query boundary. Releasing it must trigger a
second query, retain supervision and admit no replacement. Query completion alone
is not a post-stop invocation receipt. The fixture uses its own disposable root
and drains held callbacks and adapter work before removal.


Held/failed-stop controls also retain the outer stop-receipt assertions: no
receipt before native settlement, exactly one after native stop/confirmed absence,
and none after nonzero/throw with the job still listed. The receipt precedes --bg.
