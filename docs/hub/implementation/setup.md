# Setup implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Setup's optional agent-host offer uses the hub's metadata-only `host.providers`
filter before a pool exists; it never reads the caller's provider token. Keep
`--yes` at No and require the separate paid-pool confirmation. Untouched
nonterminal hosts without `--yes` skip with exact commands in the detail; partial pools remain
open. Keep existing successful unattended setup exit assertions.
Missing role pools are read-only `open` (setup exit 1) and doctor `warn`, even
under `--yes`; share configure-or-local repair guidance from host/missing-pools.ts.
Persist pool keys through `config.set` and role pools through `role.launch`, then reload. Preserve
the unfiltered provider reply for older clients. See docs/hub/cland-setup.md.
Setup readiness also opts in to account-aware `host.status roleLogins`; an older
reply without that map stays unknown/open. Use `LoginRecords.freeCount` for both
pool counts and per-role eligibility, including the optional account filter.
Image and first-login offers each require separate default-No consent. Name the
configured builder and its declared price; leave unpriced builders open. A failed
terminal login retains its signin command and continues to the Aide. See setup's
per-test guide for simulated terminal receipts versus native stage QA evidence.
Configured readiness also requires the shared doctor image-key receipt. Setup
uses the terminal owner's hub-assigned name and named login.list readback;
before admission retain add guidance. Older unfiltered replies stay compatible.
Named metadata omits binding inventory; absence is unknown, not an empty list.
Before paid image or login offers, require `paidTermsAdmission` in the running
hub's `welcome.enforcedFeatures`. Missing advertisement (including older hubs),
an empty list or an unreadable welcome leaves setup open with hub restart guidance.
Fresh-pool confirmation and configuration also require the advertisement before
activating the default always-on pool. Every host configuration, pool placement,
paid reload, image preparation and paid terminal login checks the effect's own
authenticated welcome before sending its request, so a restart after consent
cannot substitute an older hub. `SetupHub.reload(true)` selects paid admission;
ordinary remote reloads retain their existing compatibility.
After paid yes, re-read displayed terms and leave changes open; the hub validates
the expected terms again at admission. The shared `hub-features` module owns the
feature list, advertisement parser and refusal class for both socket transports.

Setup's sign-in step runs between hub and remotes. Its offer and switch
confirmation default No; `--yes` skips single mode, nonterminal without it skips
with the auth command. Existing users mode reports its user count. Use the hub's auth switch and
opt-in `user.list setup:true` metadata; older replies stay unknown. Print the
invite only through terminal narration, never SetupLine or a prompt transcript.
Wait for the persisted passkey receipt and join the abortable terminal reader;
Enter leaves `cland user invite <name>`. See docs/hub/cland-setup.md.
