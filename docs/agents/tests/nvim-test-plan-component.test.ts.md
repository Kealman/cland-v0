# nvim/test/plan-component.test.ts

T2 seam: sealed stub hub and owned headless Neovim. T-323 holds initial
`hub.status` and `task.list` answers, selects an explicit item card, then sends
real `gp` or `:Cland view plan T-12` input. Release each snapshot order. A protocol
round trip after the first release observes its callback before asserting that
navigation has not resolved. After the second release, retain the rendered plan
or the exact missing-item/no-epic notice and the outbound plan-fetch assertion.
Connection alone is not snapshot readiness.
`waitHeldSnapshot` bounds each capture receipt to 5 seconds; rendered outcomes
have their own client wait bound after release.

The follow-up cases retain the original view across the callbacks: a newer plan
request replaces the earlier id, a different view cancels the request even after
returning with real `Space Space` input before release, and a failed snapshot
produces its native error rather than a no-epic decision.

Refresh only this file with `node hub/test/record-nvim-frames.ts
nvim/test/plan-component.test.ts`. Audit the catalog and plan-component slice;
ordinary T2 runs consume their committed frames without importing hub producers.
The client fixture owns environment sealing, process exit and directory cleanup.
