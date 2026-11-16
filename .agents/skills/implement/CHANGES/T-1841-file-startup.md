T-1841: describe the per-file first-test-start watchdog, its shared setup scaling,
half-stall cap and existing owned cleanup/evidence path. Test behaviour bounds
and the until helper's exports remain unchanged.

Review correction: share the guard with the delivered-tree run-suite phase,
document phase ownership start/finish, native exit/close reclaim and no-output
fallback for a hung inner runner; no executor re-prepare is needed.
