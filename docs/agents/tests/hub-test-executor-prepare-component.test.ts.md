# hub/test/executor-prepare-component.test.ts

Use the existing sealed `projectHub` fixture with scripted provider and machine
I/O and `FakeClock`. No real provider, SSH, native harness or browser is involved.
Keep builder release, snapshot and accounting assertions on their existing
durable status/journal receipts.

Delivery upload retries use the real `DropletRun.deliver` policy through the
injected machine transport and `FakeClock`, with bundle bytes written only in
the disposable fixture. The 9 MiB sample has a 318000 ms attempt allowance.
The first failed copy consumes 125000 simulated ms; the next successful copy
consumes 250 ms. Assert the persisted delivered lease and both timed run-log
attempts. Exhaustion must leave delivery unset and supply no failing-test
receipt to `diagnosticResult`, which must remain inconclusive. These simulated
durations are policy checks, not network throughput measurements. No real
provider, key, SSH process or network transfer is used.

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

T-1709 provisioning evidence: run `node --test hub/test/executor-prepare-component.test.ts` with supported Node and inherited `CLAND_*` removed. Native T3 runs require the stage preservation lock and disposable fixture roots; never run a provisioning script on the host. Scripted component tests prove root hook ordering and failure output. Key tests prove hook and generic recipe staleness; native prepare tests hash committed hook bytes and retain no-hook snapshot coverage. Recipe inspection checks every Chromium library and both Neovim pins against project sources. QA runs these checks on stage dev; the Coordinator restarts the hub and rebuilds the snapshot before collecting full Linux suite evidence.
