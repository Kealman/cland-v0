# hub/test/host-scheduler.test.ts

`hub/test/host-scheduler.test.ts` is T1: direct calls to the pure
`decidePlacement` snapshot boundary, with no processes, provider, transport,
filesystem fixture or time. Run `node --test hub/test/host-scheduler.test.ts`.

- `default weights fill eight slots with Claude Code or mixed Codex sessions`:
  C1, exact slot boundaries for 1, 0.5 and 0.75 weights.
- `dense packing chooses fullest eligible host and spread chooses emptiest`:
  C2, skips a full host and preserves input order/data.
- `weight overrides change placement and leave unspecified defaults intact`:
  C3, partial overrides, custom harness and invalid/missing weights.
- `non-serving hosts are skipped for each verdict and default serves every harness`:
  C4, signed-out/no-login, per-host/per-harness calls and defaults.
- `no room creates below the limit but promises booting room before another create`:
  C5, creation below maximum, boot wait before creation and full booting hosts.
- `reservations, unavailable hosts and verdicts preserve the boot and maximum fences`:
  C5, promised room already consumed, ready before boot, unavailable exclusion,
  rejected boot verdict, boot-only maximum and zero maximum.

- `fractional overrides convert once to milli-slots and reject one milli excess`:
  C3/C5, 7900 + 100 fits eight slots, 7901 + 100 does not, on ready and booting
  hosts; finer overrides round to 0.001 including tiny positive weights to zero.
- `accumulated fractional weights fill eight slots exactly`:
  C3/C5, accumulates 39 converted 0.2 weights, accepts the fortieth on ready and
  booting hosts, and refuses the forty-first.
- `used and promised milli-slots share capacity and affect dense packing`:
  C2/C5, split running/reserved capacity, a ready/boot mix, a genuine excess of
  one milli-slot, and refusal of invalid snapshot integer totals.

These prove policy only. Later launch/wait integration owns atomic reservation
updates and lifecycle-state mapping; this file does not prove runtime placement,
provisioning or login availability. After-stage QA can find each assertion by its
exact generated test name above. No duration allowance is required for these
synchronous cases.

`healthy binding precedes can-bind and bindable room precedes creation` proves
T-1784 C1 at the pure scheduler seam, including bindable booting room.
