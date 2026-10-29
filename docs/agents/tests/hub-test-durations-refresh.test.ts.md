# hub/test/durations-refresh.test.ts

`node --test hub/test/durations-refresh.test.ts` exercises full and add-only
refresh directly at T1. The ownership cases use a scratch tier manifest and
synthetic timing plus ordinary file-completion records. They assert retained
owned baselines, no imported file/test/allowance entries, and explicit skip output.
Existing cases retain compatibility without a tier manifest and byte preservation.

`node --test hub/test/durations.test.ts` covers the CLI at T3. Its cover-log case
copies the remote-docs excerpts from A-12925 (Linux) and A-12929 (macOS), both
c675faa3, into a sealed scratch project. The committed excerpts contain the exact
six remote-docs timing rows per log, the head and green finish marker; unrelated
suite rows are omitted. It invokes the shipped refresh CLI and `npm run test:tiers`
using a copied tier entry point and a symlink to the production planner, verifies
the wrapper baseline, then injects an unowned file key and proves admission refuses.
It runs no original documentation tests or browsers and uses no platform credentials.
