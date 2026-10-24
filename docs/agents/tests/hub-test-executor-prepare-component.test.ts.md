# hub/test/executor-prepare-component.test.ts

Use the existing sealed `projectHub` fixture with scripted provider and machine
I/O and `FakeClock`. No real provider, SSH, native harness or browser is involved.
Keep builder release, snapshot and accounting assertions on their existing
durable status/journal receipts.

For prepare report routing, submit without `report` and observe the completed
snapshot report in Agents before asserting empty General history and artifact
list (including no log chip). Prepare currently emits a report without creating
a suite log artifact; do not invent one for the test. An explicit General topic
still receives its completed report. Unlike suite log cases in
`suite-admission.test.ts`, the positive receipt here is the snapshot report.
Default raw frames retain their previous shape (omitted optional `report`);
the new hub chooses Agents and addresses the Coordinator. `--report` remains
optional in old and new executor clients. Drain preparation and stop fixture hubs
before closing the fake provider or removing any directories.
