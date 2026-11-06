# hub/test/host-provider-digitalocean.test.ts

T2, macOS and Linux. Run `node --test hub/test/host-provider-digitalocean.test.ts`
with a supported Node 24 runtime and a fixtureEnvironment-sealed launcher (shared
procedure in tests.md). No credentials, real API, native machine or browser is
needed. The fake API uses `machine: 'scripted'`, a FakeClock and disposable state.
The provider writes only in that state; fake close drains work before removal.

The `digitalocean:` cases come from hostProviderContract: declarations; prepare,
create, observe and confirmed release; project/pool reap isolation; refused and
failed acquisition; delayed boot, never boot and ignored deletion. Scenarios map
to fake API faults, not parallel provider behavior. Ready explicitly GETs every
created droplet after making boot observable; no wall-clock sleep is used.

The remaining exact case names in the test entry cover C1 configured inputs,
region refusal and unique SSH keys; C2 split DELETE 404/GET 200 for both resources;
C3 tagged orphan and pool-prefixed key deletion with no intent, and retained host
ownership; C4 lost create response recovered after provider recreation; C5
sentinel-free output/errors/request bodies and no native launch; missing images;
and registry caching plus the production acquisition fence. Use Node's
`--test-name-pattern` with the full name to rerun one case.

Preserve executor-droplet, executor-prepare and executor-safety unedited under
the stage's preservation lock. Also run digitalocean-pacing, digitalocean-endpoint,
host-provider-fake, host-provider-declarations and host-provider-volumes one file
at a time. T0 includes lints and typecheck. These are required preservation
receipts, separate from the new provider's T2 receipt. Stage QA runs affected
coverage on dev; this item supplies no real cloud or production admission proof.

Review regressions cover ownership published while inventory or a preceding
delete is held, an owner fence retained through both GET absence receipts,
key-only owner admission, legacy snapshot-only fail-closed behavior, and the
overlapping pools `agents` / `agents-host-x` with and without local intents.

The incomplete retirement regression persists an owner reservation, refuses claims
after incomplete removal and owner/provider recreation, withholds a droplet from
list inventory, and keeps claims refused until both deletion GETs confirm absence.

The empty-inventory recovery case injects a transient final key GET failure,
recreates the owner/provider and proves both positive absence GETs settle the
persisted pending target even when neither inventory lists a resource.

The composed keyed-preparation regression uses the real preparePools and registry
with only the public external image GET boundary routed to the scripted API.
DigitalOcean rejects keyed preparation without API calls, a new recipe receipt or
changes to an existing receipt after harness pins change. No-argument contract
preparation remains covered; fake keyed preparation stays in host-prepare tests.
