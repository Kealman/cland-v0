# hub/test/doctor-hosts.test.ts

`hub/test/doctor-hosts.test.ts` is T2. Run one file with
`node --test hub/test/doctor-hosts.test.ts` on supported Node, under the current
native preservation slot and cover-quiet admission. No browser or real provider
is needed. Fixtures register disposal at allocation; the fake DigitalOcean API
uses scripted machines and a fake clock. All token values are sentinels.

Cases:

- `C1/C6 doctor reads hub token presence=false without provider calls` and the
  `presence=true` case run text and JSON doctor. They assert absent-token recovery,
  the literal fingerprint, no raw sentinel, and an empty fake API request log.
- `C2 doctor names a changed lock and the image prepare command` first proves
  a current image, then changes the scratch lock and asserts `stale: lock`.
- `C7 doctor reports no pool and hub-backed unknowns with their fix` covers
  an empty project, absent image and a stopped hub.
- `C3/C4/C5 doctor reports free and signed-out logins, outage start and 80 percent spend`
  seeds login metadata through the fixture records, drives the registry's health
  subscription on the hub clock, and settles a scratch spend ledger. It checks
  each exact recovery command and the 80 percent boundary.
- `doctor accepts the previous host status shape and labels missing outage and spend unknown`
  uses a literal old reply without `outageSince`, unknown spend, and a refused
  `host.providers`. It must remain readable without inventing facts.
- `C3 doctor counts actual key logins only for placed harnesses`, with the
  `shared` and `exclusive` variants, proves one key/shared login counts once,
  three exclusive logins exceed a two-host admission cap, and unplaced harnesses
  and removed pools get no free-login rows. The first run failed with
  `2 free !== 1 free` (key/shared) and `2 free !== 3 free` (exclusive).
  Missing `freeLogins` on the previous wire shape is explicitly unavailable.

Source evidence: the first token run failed on missing `host digitalocean token`;
image/offline runs failed on missing image/login rows; the capacity run failed on
missing `host agents codex logins` before those checks were implemented. Native
targeted receipts are partial implementation evidence; task verification and stage
QA run separately at their pinned heads. Route findings to `lead T-1829` in its
item topic. No per-item QA brief is required: E-1537 QA is after-stage on dev.
