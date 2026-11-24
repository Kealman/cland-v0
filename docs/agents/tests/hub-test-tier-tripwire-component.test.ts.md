# hub/test/tier-tripwire-component.test.ts

T2 exercises `installTierTripwire` with `fakeOnlyFixture`'s real positive
controls and fake callback/custom launch boundaries. No native child starts.
Both report-only and enforce modes retain refusal receipts without mismatches;
unguarded exec and execFile calls still record mismatches, and enforcement
prevents their fake launch. An ordinary error with the guard's exact message
does not earn a refusal receipt. The test restores builtins and exit status.
Shared case deadlines enroll before acquisition and name guard setup, root
setup, body action and the complete sequence. Timed-out observations retain
their original work; fenced cleanup restores builtins only after successful
drainage and fixture cleanup.

Run `node --test hub/test/tier-tripwire-component.test.ts` for this seam.
Worker startup and real resource interception remain the T3 runner contract.
