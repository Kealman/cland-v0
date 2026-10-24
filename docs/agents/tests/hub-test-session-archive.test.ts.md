# hub/test/session-archive.test.ts

For session archive scheduling, `session-archive.test.ts` uses 250 durable rows
in a scratch `projectHub` with fake time. It retains scan-count and public
`session.list` archive receipts across ten idle minutes, the exact dated
threshold, unrelated item updates, stop/close transitions and reopening. Deferred
failed-resume rollback retains its stopped row across lifecycle release, then
proves recovery settlement archives an overdue row or arms its future deadline.
These two smaller Sessions fixtures share the hub fake clock with an explicitly
owned `recoveryClock`; production native cleanup retries retain real time.
`node hub/scripts/measure-idle.ts /absolute/project/.cland/tasks` copies canonical
tracker files into a sealed scratch hub with 250 synthetic stopped session rows.
It measures ten real minutes of process CPU after startup, reports archive sweep
counts and separately times the hourly P90 calculation on 10,000 scalar receipts.
This is local diagnostic evidence, not a suite pass. Run on a quiet machine,
record the implementation head/tree and platform, and publish the output through
`artifact.create`. Adapters and native probes are fixture substitutes; it makes
no claim about native harness idle load or the live workbench.
