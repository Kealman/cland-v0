# nvim/test/explorer-outline-load.test.ts

This T4 guard runs the shared explorer release-row case twenty times sequentially.
Each owned subtest completes all T2 assertions, including the settled E-3 card's
zero requests for unselected tasks. The final count requires twenty completions.
The task verifier maps changes in `explorer_card.lua`, `explorer-component.test.ts`
and `explorer-outline-fixture.ts` to this file. Use the mode-free Linux droplet
task verification at workers 2; do not start an unleased local repetition run.
See [the T2 case](nvim-test-explorer-component.test.ts.md) for receipts and teardown.
