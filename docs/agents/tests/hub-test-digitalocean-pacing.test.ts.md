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
Both HTTP cases select `machine: 'scripted', transport: 'http'`: the fake closes
its loopback listener, drains admitted work, then removes its disposable root
without a native process census. Machine and transport selection are independent;
omitting transport preserves HTTP for process machines and direct calls for
scripted machines. Run `node hub/test/run-suite.ts hub hub/test/digitalocean-pacing.test.ts`
to collect the report-only T2 resource receipt; plain `node --test` does not load
the resource tripwire. Retain the complete test summary and zero mismatch findings.

The beforeCreate controls throw a synthetic assertion through both transports.
The provider still replies with the compatible `500/lease-missing` shape, while
`fake.checked(wait)` rejects with the original error even if the executor catches
the provider reply. The observer retains failures that preceded registration.
`close()` attempts ordered drainage and removal before reporting the first hook
error. Later hook and cleanup errors appear in its enumerable `suppressed` array.
A mutable Error retains identity; a frozen or non-Error failure uses a wrapper
with the original as `cause`. Cleanup failure retains the root whenever closure
or removal could not complete. The removal-rejection controls prove this through
the real close path, with separate retained-root filesystem receipts, for both
mutable and frozen assertions.
Callbacks containing assertions must wrap their caller's wait in `checked`.
Callbacks used only as barriers or mutations retain teardown reporting. Use
`faults.create` or `createRefusals` for intentional provider failures: those do
not poison checked waits or teardown. The controls enroll receiptFixtureCase
before acquisition, keep the positive native-launch guard through teardown,
capture late setup before returning, and bound setup/actions separately. A
proxy cleanup fence keeps the native guard installed when provider close or
directory cleanup rejects after the original case joins. The same-hookCase
control holds an admitted provider writer, rejects close, and separately proves
guard identity and retained root. Repair retries that proxy owner, closes the
writer, removes the root, and only then restores the native seam. It invokes no
native launch beyond the shared guard's positively controlled setup calls. A
held setup control uses an injected observation clock, then proves guarded
removal refuses before provider closure, retains the root, and removes it after
the late rejected acquisition joins and the provider closes. All other clocks
in this control stay on their own native IO scope. No fixed sleeps are used.

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
