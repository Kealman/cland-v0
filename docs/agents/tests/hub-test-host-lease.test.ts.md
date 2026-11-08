# hub/test/host-lease.test.ts

Run `node --test hub/test/host-lease.test.ts` on supported Node, with inherited
CLAND variables removed. T2 uses a disposable scratch HOME/XDG/Git environment,
in-memory SQLite, directory-only fake provider and FakeClock; no network,
native SSH, browser or real provider credential is required.

Cases prove pool reservation and mirror ordering, cap refusal before acquire,
quarter-lease cadence, idle predicate suppression, hourly cadence for long leases,
refused renewal preserving both deadlines, failed mirror publication retaining an earlier file deadline, unconfirmed deletion retaining the
reservation, confirmed deletion settling the actual lifetime, one-second publication retries, effective deadline expiry fencing with deletion held,
successful retry cancelling the old expiry, and registry
shutdown joining a ledger-blocked renewal before SQLite closes. A shutdown-hook
negative control must fail on reservation 2 versus expected 2.5.

`host-provision-gate.test.ts` (T3) also asserts that the lease row already exists
inside the fake provider acquire callback. Native host consumer files run
serially under the stage's preservation lock. Stage QA runs on integrated dev;
these component cases supply the C1–C5 lease seam evidence.

Source-review corrections add initial DB/mirror/provision failure controls,
ledger-held admission past expiry, positively known non-acquisition at zero cost,
unknown-acquire reservation retention, and malformed/unreadable published mirrors
with typed expiry and registry transport drainage. Native provider-refused and
lost-reply controls live in host-provision-gate.test.ts; host-spend.test.ts proves
zero cancellation frees caps while acquired lifetimes retain the pinned minimum.
