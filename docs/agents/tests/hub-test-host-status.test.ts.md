# hub/test/host-status.test.ts

Direct spend mutations pass the fake lock process table. The guarded status
case permits only the shared T2 scoped CLI callback launch; custom promisifiers
and other native APIs remain denied. No file tier changes.

T2, in-process projectHub, fake clock and provided test Hosts; CLI subprocesses
only exercise the status command. Run `node --test hub/test/host-status.test.ts`
under supported Node after targeted admission. No provider network or browser.

- `C1 status includes configured empty pools and zero settled spend`: frame,
  human CLI output and `--json`, including a configured pool with no inventory.
- `C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations`:
  reverse lexical host ids, one codex session (0.5 slots), two 4-slot hosts,
  two USD/hour, an October start with November clock, settled cost and a pending
  reservation. Expected day/month costs are 6/102 USD. Preserves unreachable
  state from a stored provision. Pinned ledger prices for both fake and DigitalOcean provision rows; no native
  transport or provider API. Unknown legacy billing makes pool totals unknown.
  A held placement promise counts before a running session is published.
  Provided hosts seed settled Codex disk bindings through `settledLogin`, matching
  each provision's provider and region, before ready publication. Native binding
  itself is covered by `login-binding.test.ts`; status assertions stay unchanged.

`status ledger read drains before storage closes; setup failure=false/true` holds the spend-file
read, closes an in-process base hub and asserts the positive completion order:
inventory read before the close receipt. It also keeps the closed admission fence. The injected setup-failure case proves
the prearmed release/join/close owner completes before root disposal.

`login storage accrues in its recorded pool month only without reserving spend` uses a FakeClock at the midpoint of November: one 1 GiB volume at $0.10 plus one snapshot at $0.06 produce $0.08, with today unchanged. It seeds receipts under the recorded pool; no provider API is called. Existing status cases also assert bound harness/name pairs. Sign-in receipt creation, deletion pruning and clock ownership are covered by `sign-in records volume and snapshot lifetime receipts in the admitted pool` in login-signin.test.ts (T1).
