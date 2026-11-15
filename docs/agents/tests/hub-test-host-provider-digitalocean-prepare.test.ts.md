# hub/test/host-provider-digitalocean-prepare.test.ts

T2, in-process scripted DigitalOcean API and scripted machine, fake clock and
disposable roots. No provider network, droplets, native harness or browser.
Run `node --test hub/test/host-provider-digitalocean-prepare.test.ts`.

`digitalocean preparation fixture drains queued issuance before storage and root
disposal` uses the actual factory and shared admission-close contract. It holds
one persisted issue, queues a failure followed by a valid issue, starts teardown
and checks that both SQLite and the exact watchdog file remain available.
New issuance refuses, repeated close shares completion, and every queued attempt
settles before API/root disposal. See the provider per-test guide for owner order
and the signal-path scope.

Cases:

- `digitalocean production create names the missing host lease watchdog and spend before API access`: C6, sealed production refusal with zero API calls.
- `digitalocean prepare builds an agent image then root provision and runner prepare, and reuses its key`: C1/C2, recipe pins, execution identities/order, durable image/region, provider tags and zero-call current reuse.
- `digitalocean create refuses a missing or stale pool image and sends provider prelude with a current one`: C4/C7, missing/stale refusal before API access, current image id, automount rule, sudoers and Codex credential store.
- `digitalocean replacement publishes before retirement and retains a split DELETE404 with live GET`: C3, publication observed before deletion, recovery retaining previous identity and by-id absence before periodic reconciliation settles it without another prepare.

- `digitalocean prepare transfers an unchanged image after the pool region changes`: region transfer keeps image identity and publishes usable placement before acquire.
- `digitalocean pool key invalidates an omitted harness default without changing executor digest`: effective default changes invalidate pool recipe bytes while executor digest is unchanged.
- `digitalocean periodic reconciliation leaves an admitted pool builder recovery owned until it joins`: a held root provision receipt arms periodic reconciliation; the build record remains owned until preparation joins.

Executor compatibility (C5) uses unedited executor-droplet, executor-prepare,
executor-prepare-component, executor-safety and verify-prepare files at the reviewed
head under the preservation slot. The prepare-key and image-recipe files preserve
executor key and recipe identities. Full stage QA runs on dev after the stage.
