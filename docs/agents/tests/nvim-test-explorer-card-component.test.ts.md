# nvim/test/explorer-card-component.test.ts

T2 uses the sealed stub client and committed protocol recordings. The
same-timestamp verification-signal case includes an unavailable result after a
failed one and asserts the rendered suite label. Refresh the complete file with
`npm run test:nvim-fixtures -- nvim/test/explorer-card-component.test.ts` after
changing scenarios; inspect new frames before committing and retain the existing
recordings. No human browser or native harness session is involved.

The epic-card case retains descendant verdict facts on a cold cache without a
descendant `task.view` request or reason line. Selecting the descendant and
returning to the epic shows its cached reason without an additional fetch.

Every `zR` → `select` step waits for the anchored rendered target row; a task
name elsewhere in the card is not a tree-row receipt. The epic-card case holds
`fold_all` until its first screen observation sees the still-folded tree, then
releases the real action. It asserts that hold was observed and retains the
full descendant-cache and closed-plan checks. Removing the row wait reproduces
`missing row T-10` deterministically, without sleeps or product changes. The
headless client owns and drains its stub process group before fixture removal.
