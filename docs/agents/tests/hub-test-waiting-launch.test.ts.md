# hub/test/waiting-launch.test.ts

T2 through session.launch/list/stop, inbox.list, provided Hosts, fake adapters
and scratch parsed pool configuration with explicit slots. No native children,
provider network or browser. Run `node --test hub/test/waiting-launch.test.ts`
with supported Node and inherited CLAND_* removed.

The full-pool case fills two single-slot Hosts with four half-weight Codex
workers. Its fifth reply has waiting facts and no process. Inbox status does
not change needsYou or asks. Duplicate name refuses; stop cancels and releases
it. A fake positive exit yields exactly one published queued process on host a.
The observer is armed before the exit and asserts the final process and empty
waiting list.

The final-ready case starts both Hosts cloning, queues a worker and commits
ready through the actual hub's provision owner, captured by an injected manual
create seam. Its published process is the completion receipt. The complementary
departure case moves the only ready Host to destroying and observes its reason
change without a timer. Setup uses eventually's testWaitMs bound.

Memory-floor admission uses the production typed refusal with synthetic byte
values, no process row, then fresh capacity reports and a changed-byte reason.
The recovered launch is observed in session.list. Log receipts assert one start,
one changed reason and one placed end, with no repeated same-reason notice.
This proves scheduler consumption of a Host report; native agent emission and
SSH forwarding are covered by host-agent.test.ts.

After-stage QA reports to lead T-1744 in the item's topic. Wait durability is
the successor item's scope. These cases measure no lifecycle wall-time bound.

CLI subprocesses are used only to test CLI launch/list/stop output. The Coordinator
MCP case proves session.launch forwards the no-process reply and session.stop
cancels it under the existing role grant. A credentialed early hello on retry
uses assignRole:false, so the fixture does not mutate the waiting name's role.
The cancellation race holds adapter preparation, requests stop, proves duplicate
name refusal, releases preparation and asserts no native spawn or process row.

Review regressions cover capacity released between selection and insertion,
an unpublished launch releasing its slot promise, cancellation of idle B while
A is held, shutdown that must close the registered adapter to unblock a retry,
and positive failed-stop/retained-generation closure after the earlier process
status has already ended. Held-capacity setup waits for the queued admission's
second release receipt before the producer frees the slot, so the insertion
recheck cannot accidentally satisfy the later checkpoint test. Each observer
has a cancellation/join owner registered before UI close; patched adapters are
restored in finally after the owned retry settles. The shutdown case's runner
watchdog records timeout as incomplete and releases/joins its writer on abort;
it makes no elapsed-time performance claim.

The disconnected Coordinator pair proves that accepted waits survive transport
loss while a later role/grant revocation still prevents placement. Both cases
observe a published process or the final refusal receipt before checking the
waiting list and native spawn count.

Pinned-pool controls fill agents, admit a wait, change the role default to
other and prove the queued process still publishes on a while a new launch
uses c. The waiting reason/pool facts never migrate to other. Removing only the
agents TOML section preserves the fixture's verification settings; hub.reload
then yields exactly one Agents end notice naming queued/agents/removed, empty
active waiting/inbox rows and a successful reuse of queued on other. No terminal
history field is added to session.list. CLI help and the frozen SESSION_USAGE
fixture carry the stop-and-relaunch guidance without changing CLI status lines.

The full-pool case also requests session.list with archived:true and keeps the
empty waiting-array assertion, so the archive view never includes active waits.

The shutdown case holds an admitted retry in adapter spawn; hub close must
abort that adapter before joining the retry. Complementary no-flight
construction rollback coverage lives in fake-harness.test.ts (factory, duplicate
and registered cleanup failures), which keeps its AggregateError and all-closed
assertions. A promise must not turn synchronous construction rollback into a
detached cleanup error.
