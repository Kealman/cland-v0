# web/test/item-card.test.ts

`web/test/item-card.test.ts` observes real Headless Shell DOM and outgoing frames
against a sealed scratch hub: ten selected rows send zero `task.view`, opening
agents’ text sends one body request, Enter/Esc/`h` preserves the tree row, and a
closed card reads by-id summary facts and refreshes on a task delta. Split/Swap
focus round trips and a closed container with an open verdict owner retain the
matching owner reason/round/scope through a real verdict delta. The hub's
T1 tracker-summary test checks compact verification and open/closed transport;
the copied-live Lua oracle retains the snapshot byte cap. Ordinary summary lists
omit card-only transport fields while snapshots opt in, and the native
`startup-budget.test.ts` keeps the 128 KiB limit with a tighter 120 KiB margin
assertion for the 1,000-item fixture.
