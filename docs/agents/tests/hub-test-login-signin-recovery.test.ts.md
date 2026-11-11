# hub/test/login-signin-recovery.test.ts

T2, projectHub with one FakeClock shared by every time reader and fake lock facts
for the hub and droplet startup. No terminal, provider network or native harness.
Durable admissions are seeded through the real sign-in store boundary to model
an abruptly lost terminal owner. A hub stop/reopen then exercises actual startup
ordering after volume reconciliation and before pool scaling.

- `restart reverts an admitted renewal without native effects, retains bindings and refuses the old token`
  proves interrupted metadata, no claimed snapshot, retained bindings, one card
  carrying the host fence reason, and refusal of old completion/new admission.
- `interrupted admission stays fenced across time and replacement births until its exact machine deletion receipt`
  proves no elapsed-time settlement, no receipt omission authority and no borrowed
  replacement-machine authority. The exact persisted machine deletion receipt
  settles the existing fence.

`confirmed host destruction clears interrupted renewal and detached snapshot release fences`
in login-release.test.ts drives that production release owner with the fake
provider, including actual deletion receipt persistence and successful readmission.

`machine deletion abandons an unbound interrupted freeze through snapshot ownership while retaining its receipt`
in login-release.test.ts covers the temporary mount that has no LoginBinding.
The exact machine receipt invokes the snapshot lost-kernel path, leaves no new
release fence, preserves a retained positive receipt, and still refuses re-sign-in
while that independent snapshot ownership stands.

The prearmed loginMetadataOwners fixture joins hub drainage, then borrowed Store
closure, before root removal. Unknown setup/drainage retains the root; adverse
controls live in login-list.test.ts. Run this file with supported Node 24;
configured task evidence comes from mode-free Linux verification after review.

`startup sign-in recovery reads only indexed admissions across retained login history`
seeds 1,000 retained rows and one admission, proves the full-history decode
control, then budgets decoded/returned rows and queries through the active and
host indices. It performs no startup native effect or retained provision scan.
