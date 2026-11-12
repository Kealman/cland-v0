# hub/test/login-card-recovery.test.ts

T2 indexed records, FakeClock, fake platform ports and in-memory Store. No native
harness, browser or external API. Run `node --test hub/test/login-card-recovery.test.ts`
with supported Node 24, inherited `CLAND_*` removed and cover-quiet admission.

Generated cases:

- `secret cleanup recovers captured ingress without a repeated update and retries on the hub clock`
- `card recovery retires a positively completed login without an unknown-outcome notice`
- `failed unknown-outcome notice retains its intent for one later recovery publication`
- `Gateway shutdown joins a held second deletion after the first durable checkpoint fails`
- `Discord adapter stop joins its native deletion after cancellation`
- `card intent recovery pages only captured active records off the startup turn`
- `secret cleanup startup bounds indexed pages and shares concurrent work per native message`
- `recovered unknown new-login intent keeps disk ownership and publishes the named cut once`

The budget cases seed 130 active obligations and 1000 unrelated retained records.
Constructor/startup turns decode no pages; each page has at most 64 records and
the snapshot takes at most four page reads. Intent recovery decodes only its 130
captured admissions, excluding a later admission. Cleanup decodes at most 260
records including its primary-key work reads. Concurrent calls for one native
message share the same promise. These are work-count bounds on synthetic new
private-table data, not live-history timing or native sign-in coverage.

Shutdown tests arm failure and held-second-operation observers before stopping;
dependencies stay owned until that second operation and its checkpoint settle.
Retry advances exactly 1000 ms on the hub clock after the failed attempt is
persisted. Unknown new-login recovery never invokes native preparation/cleanup:
creating row, volume and the named cut remain owned by the shared future recovery
work. A notice persistence failure retains the intent; ready state retires an
already positively completed intent without an incorrect unknown notice.
