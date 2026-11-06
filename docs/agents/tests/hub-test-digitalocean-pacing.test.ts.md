# hub/test/digitalocean-pacing.test.ts

`hub/test/digitalocean-pacing.test.ts` is T2: injected provider calls plus fake
loopback HTTP; no real DigitalOcean API, host, droplet, keys or credentials.
Run on supported Node with inherited `CLAND_*` removed:
`node --test hub/test/digitalocean-pacing.test.ts`. Observe cover-quiet admission.
The C1/C2 fake endpoints explicitly declare 250/minute; other fixtures default
to the fake's declared 100000/minute through `CLAND_DIGITALOCEAN_API`. Its fragment
is metadata, never part of HTTP paths. All tokens are `cland-test-*`; the fake owns and drains its disposable root.
No GUI/browser runs. The clock starts at the fixture date and remains shared
between provider and clients; advancing it supplies no real timing measurement.

The 300-call case uses two clients sharing a token, observes 250 admissions,
advances to 59,999 ms with no extra sends, then completes all 300 at 60,000 ms.
Every observed moving minute retains its final maximum-250 assertion. A second
control blocks the caller for a minute before draining continuations and checks
actual provider-send times, so reservations cannot age out before sending.
The 429 cases inject one refusal with both headers, observe the typed refusal,
then explicitly request a second call. Its successful response is the completion
receipt after the later retry time; the final request count proves no replay.
HTTP and scripted modes use the same retry parser. Fake fetch responses also
prove a null JSON body retains the typed refusal and that headers fence a sibling
client while the response body stays held. The body is released and both calls
settle before teardown; the retry time remains anchored to header receipt. Header cases cover seconds,
HTTP dates, reset-only, invalid and absent headers. A missing-header HTTP 429
keeps the provider id and redacted text, has no retry time, and permits the next
explicit call without a cooldown. The exhausted-budget case
checks deadline and abort rejection, timer cleanup and independent tokens.
Independent configured API authorities with the same opaque token do not inherit
each other's traffic; clients at the same canonical API base still share a budget.

QA after stage should rerun this file and unedited executor-droplet,
executor-prepare, executor-safety and executor-run under the stage preservation
slot, retaining child exit and complete test summaries. No real cloud resource
is required. Missing, interrupted or skipped runs supply no passing evidence.

The scripted declaration regression sends 300 calls without advancing time at
100000/minute. The under-budget regression observes synchronous transport
invocation and its successful account response without driving a timer. Endpoint
parser compatibility and invalid declarations are covered in the T1 endpoint file.

`the real DigitalOcean endpoint ignores a high-rate fragment and still paces at 250`
uses a fake fetch transport: 300 queued calls send only250 before60 seconds,
all recorded request URLs omit the fragment, and captured client console output
contains no declaration metadata. It never calls the real API.
