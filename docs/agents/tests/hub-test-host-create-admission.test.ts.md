# hub/test/host-create-admission.test.ts

T2 public scratch CLI coverage, projectHub in process, no native host.
Run `node --test hub/test/host-create-admission.test.ts` on supported Node with
inherited CLAND variables removed. `C4 create refuses an unprepared pool naming
host prepare` checks the refusal text before any acquisition. `C5 host help
lists create and list` checks both help entries without a hub.

`C4 create refuses a prepared image after harness pins change` proves stale-image refusal after a successful prepare, before any native acquisition.

`DigitalOcean create names missing E-1534 admission before image checks or API calls`
uses an unprepared DigitalOcean pool. A fetch interceptor first proves it catches
a request, then the public create CLI must name E-1534's lease, watchdog and spend
requirements with zero provider calls. The interceptor prevents external network
access even if admission regresses. This is refusal-ordering evidence, not a
DigitalOcean creation or image-preparation run.

The pre-row admission refusal case prepares a fake image, injects a refusal into
the real create path after asynchronous image checks, and asserts the callback
ran once, provider.acquire never ran, and no provision record was published.
It does not start SSH or a harness and stays at T2.
