# hub/test/executor-reap-confirmation.test.ts

T2 uses the existing scripted DigitalOcean fixture, fake clock, disposable project
and sealed environment. No native machine, cloud account or browser runs.

Run `node --test hub/test/executor-reap-confirmation.test.ts` after the shared
load/disk preflight. Reap droplet/key cases keep an expired durable lease open
through DELETE404/GET200, check the returned unconfirmed summary and excluded
count, then observe a second DELETE and confirmation on the next reap.
Sweep cases assert per-ID GET receipts, exact confirmed counts and unconfirmed
log events, deferred failure accounting, a single discovery listing and successful
next-sweep retry. Existing executor-prepare-retry tests retain the previous empty
reply shape. Release/watchdog and suite completion collection are unchanged.

Recovery cases hide pending IDs from both provider listings, rename the project and recreate the executor,
retain the second DELETE404/GET200 as unconfirmed, then observe a third DELETE
and GET404. Changed provider identities refuse mutation and retain pending state
until the captured identity returns. The private reap-pending record is serialized
under the project reap lock and cleared only after individual confirmation.
