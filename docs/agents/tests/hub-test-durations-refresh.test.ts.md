# hub/test/durations-refresh.test.ts

`node --test hub/test/durations-refresh.test.ts` exercises full and add-only
refresh directly at T1. The ownership cases use a scratch tier manifest and
synthetic timing plus ordinary file-completion records. They assert retained
owned baselines, no imported file/test/allowance entries, and explicit skip output.
Existing cases retain compatibility without a tier manifest and byte preservation.

The five-day warning case pins the pure reader and validator to the same UTC
clock. It checks one millisecond before the inclusive boundary, the exact warning
with key/owner/expiry at the boundary, successful validation while warning, and
the expired label at midnight. It imports no native fixture or process helper.

T-1879 removes allowances whose measured peak fits the tier default (and T4
allowances, since T4 is unbounded). These remain report-only duration decisions
under D73; neither removals nor the five-day warning enable enforcement.
The two integrated-v04 caps are an explicit Coordinator keep disposition
(46 s per case, 49 s per file unless a larger passing sample needs more),
separate from the under-default removal policy. Both remain in the original
469-row renewal accounting. The historical T3 growth-ratchet cap is also kept
separately because the release reports no current base projection.

`node --test hub/test/durations.test.ts` covers the CLI at T3. Its cover-log case
copies the remote-docs excerpts from A-12925 (Linux) and A-12929 (macOS), both
c675faa3, into a sealed scratch project. The committed excerpts contain the exact
six remote-docs timing rows per log, the head and green finish marker; unrelated
suite rows are omitted. It invokes the shipped refresh CLI and `npm run test:tiers`
using a copied tier entry point and a symlink to the production planner, verifies
the wrapper baseline, then injects an unowned file key and proves admission refuses.
It runs no original documentation tests or browsers and uses no platform credentials.
The same CLI case seeds a valid dated allowance relative to the real clock and
asserts the report-only warning line together with exit zero, before testing the
unowned-key refusal. Both production imports in the copied entry point resolve
through fixture-owned symlinks.
