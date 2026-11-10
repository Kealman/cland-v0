# hub/test/host-provider-digitalocean-volumes.test.ts

Run `node --test hub/test/host-provider-digitalocean-volumes.test.ts` with supported
Node 24 and targeted admission. Strip inherited CLAND_* for local runs. T2 uses
scripted fake DigitalOcean, FakeClock and disposable roots, no sockets, native
process, browser, real cloud or credentials. The factory uses fixtureEnvironment
with overlays inside the builder. Fake close joins its writers before removal.

The factory supplies pool agents and login admission explicitly; there is no production default.
`hostProviderVolumeContract('digitalocean', factory, registrar)` registers:

- `digitalocean: volumes create, list and confirm deletion`: C1/C5, project tag
  inventory and confirmed/idempotent deletion.
- `digitalocean: volumes enforce one attachment and region binding`: C1/C2/C5,
  attachment ownership, wrong detach, attached-delete refusal and region binding.
- `digitalocean: ignored volume deletion retains inventory`: C4/C5, opt-in DELETE
  404 with live GET 200 returns incomplete and retains inventory.
- `digitalocean: volumes rate limit snapshots until retry time`: C3/C5, fake 429
  headers give exact ISO retryAt; advance the shared clock 600000 ms and retry.

Additional generated cases:

- `digitalocean volume create carries lon1, 1 GiB and project/pool tags`: C1.
- `digitalocean volume actions publish attachment only after completed`: C1,
  delayed attach/detach keep state until action completion; exact 100 ms polling
  step is driven by FakeClock after an observer records that exact admitted timer
  (transport timers do not qualify). Setup and operation join use bounded
  until/testWaitMs; the join is registered before API/root close and also runs
  for injected assertion failure before poll admission. A failed join retains
  the root. Each final
  assertion checks the completed action and resulting attachment.
- `digitalocean volume admission selects pool and shares the creation pause`:
  admission context tags the correct pool;
  a volume 429 pauses both resource creates until retryAt.
- `digitalocean lost volume create reply retains discoverable resource without replay`:
  mutation persists before the fake loses its reply; list recovers it; only one POST.

Preserve machine/provider/fake/volume, endpoint/pacing and executor deadline tests.
No per-item QA run is required: stage QA runs affected cases on integrated dev.

- `digitalocean known snapshot refusal returns immediately for the exact volume identity`:
  repeated calls use the captured refusal with no GET/POST or fake-clock advance;
  expiry sends nothing until the caller explicitly retries.

T-1782 enables the shared `digitalocean: snapshot history, cloning and confirmed deletion`
case: ordered history, clone in source region, deleted-snapshot refusal, volume-gone,
surviving snapshot lookup/restore by ID and confirmed deletion (C2/C4).
`digitalocean volume create requires login admission outside the fake-host fence`
proves missing admission makes no API call, and admitted creation with an empty
environment reaches the scripted API (C3/C5).
`digitalocean snapshot restore sends source region and tags; deletion needs observed absence`
asserts the exact restore POST, snapshot ID and ownership tags (C1), split DELETE
404/GET 200 retains history, and confirmed/idempotent delete plus lookup failure (C2).
All bounds use the shared FakeClock; these cases create no native processes.
Linux mode-free verification supplies T1/T2 and selected changed process tests;
full T3 belongs to the merge batch, T4 to stage/epic occasions. No changed native
case requires a local preservation slot for this item.

`digitalocean snapshot receipts and source project fence destructive use across restart`
rejects forged volumeId/created receipts without DELETE and cross-project clones
without POST, then proves a same-project restore and deletion after source-volume
deletion and provider restart. Ownership is persisted under the provider root.
`digitalocean volume fixture closes API and retains root after rejected owner drain`
checks attempt-all cleanup, explicit storage retention and both diagnostic errors.

`digitalocean snapshot restore keeps retained region when API region order changes`
returns native regions `[fra1, lon1]` for a snapshot retained from lon1, then
asserts both the clone and restore POST keep lon1 rather than the API's first
region or caller's requested ams3 (C1).
