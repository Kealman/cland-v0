# nvim/test/events.test.ts

Run `node --test nvim/test/events.test.ts` for the recorded-stub/headless Neovim
boundary. The first identity covers day grouping, 200-row pagination, folds,
selection preservation, live pushes and subject navigation.

The calendar regression uses fixed October 26/27 rows, a UTC child environment
and a fixture-local implicit `os.date` pinned to October 28 at midnight. Explicit
timestamps still use native date formatting. Its first-page receipt requires the
rendered dated heading and first event row, with the ordinary 10-second bound;
the final assertion checks that yesterday has no `today` suffix. Older-page
loading observes its dated heading before moving to the final row of that page.
Do not restore a module-scope current-date stamp or require `today` for a page
whose rows may have been created before midnight. The original T-1416 failure
already showed the full first page; the missing `today` suffix caused the wait.

Load evidence for T-1416 uses two lanes of five fresh exact-identity processes
plus an owned CPU worker, under a Coordinator-granted exclusive machine slot.
Every repetition must retain its exact passing identity, terminal summary, native
close receipt and positive CPU progress. This diagnostic occasion is separate
from mode-free configured verification.
