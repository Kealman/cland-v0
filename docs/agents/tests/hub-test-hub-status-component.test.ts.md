# hub/test/hub-status-component.test.ts

The startup relay records exact UTF-8 JSON result frames, with envelope and
newline, for status, rules, General history, artifacts, open item summaries,
events, sessions and accounts. It retains the rendered completion assertion and
waits separately for the eight reply receipts. An oversized rule reply exercises
the per-reply failure guard without depending on an oversized item list.
`hub-status-component.test.ts` checks compact/default and opt-in historical
status, complete-message before-id pages, artifact cursor pages and all eight
budgets on a small durable fixture. It uses the smoke's shared pure byte guard,
including per-reply and total oversize controls. Timing still requires the
rendered Neovim receipt.
