# hub/test/login-card-signin-owner.test.ts

T2 component evidence with in-memory Store, HubCards, FakeClock and an injected
interactive sign-in boundary. No browser, native harness or provider network.
Run one file with supported Node 24 after cover-quiet admission:
`node --test hub/test/login-card-signin-owner.test.ts` (strip inherited `CLAND_*`).

Generated cases:

- `a prompt emitted during held native start becomes actionable only with its captured input handle`
  emits a complete prompt while start is held, observes no card, then returns the
  handle. An immediate answer from the publication subscriber reaches that exact
  input owner, which is prearmed inside the same transaction before visibility.

- `Create one offers the Claude link and its secret answer completes one snapshot`
  uses the real disk completion owner and a fake provider. It checks the secret
  card, input pipe, ready state and exactly one snapshot.
- `accepted card intent interrupted before follow-up reports once on owner recovery`
  holds post-commit work and reconstructs the owner. Recovery reports once and
  never replays a native operation.
- `runner refusal with not-admitted proof completes failed` and
  `runner refusal without proof interrupts` distinguish positive non-admission
  from unknown native ownership.
- `Codex device label output raises its code card and closes ready without an answer`
  and `Codex one-time prompt output raises its code card and closes ready without an answer`
  check complete tokens across output chunks, for the fake label and the upstream
  device-flow prompt, and the withdrawn card at completion.
- `the fifteen-minute limit waits for the matching cancellation close before signing out`
  advances the hub clock exactly 900000 ms and observes immediate withdrawal with
  reason `sign-in timed out; closing` before cancellation is admitted. A later
  answer is refused and writes no input. While native close is held, the exact
  login state and disk identity stay unchanged; only the matching close permits
  failed completion to signed-out with the volume kept.
- `a close without a native exit fact interrupts rather than authorizing disk cleanup`
  rejects a null-code/null-signal close at the card boundary.
- `unknown Create one outcome retains its mounted disk and reports the captured login and host once`
  checks the Coordinator's conservative cut, including identities persisted before
  the native run and the exact withdrawal reason. T-1814 owns later shared recovery.
- `card shutdown joins a held second native writer after the first writer fails`
  proves an earlier rejection cannot release shutdown before the second close.

These injected cases do not prove the native agent, real harness patterns or
remote platform delivery. Native sign-in evidence belongs in the companion
integration file; stage QA also runs the existing renewal and login-card cases.
Indexed restart/cleanup work budgets and failed-notice recovery live in
`hub/test/login-card-recovery.test.ts`.
