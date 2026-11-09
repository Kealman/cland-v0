# hub/test/host-create-admission.test.ts

T2 public scratch CLI coverage, projectHub in process, no native host.
Run `node --test hub/test/host-create-admission.test.ts` on supported Node with
inherited CLAND variables removed. `C4 create refuses an unprepared pool naming
host prepare` checks the refusal text before any acquisition. `C5 host help
lists create and list` checks both help entries without a hub.

`C4 create refuses a prepared image after harness pins change` proves stale-image refusal after a successful prepare, before any native acquisition.

`DigitalOcean create requires a prepared pool before acquisition API calls`
uses an unprepared DigitalOcean pool. A positive-control fetch interceptor proves
zero provider calls while the CLI names host prepare. Direct missing-receipt
coverage lives in host-provider-digitalocean.test.ts.

`DigitalOcean SSH gate records the provision identity and address without fake environment reads`
records the actual probe command. It checks the supplied client key, strict pin,
private known-host file and machine destination; fake-variable getters throw on
read. No native SSH process or cloud machine starts.

The pre-row admission refusal case prepares a fake image, injects a refusal into
the real create path after asynchronous image checks, and asserts the callback
ran once, provider.acquire never ran, and no provision record was published.
It does not start SSH or a harness and stays at T2.
