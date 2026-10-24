# hub/test/item-summary-lua.test.ts

`item-summary-lua.test.ts` is T3 because its independent oracle executes the real
Lua through headless Neovim. It copies every live tracker file into a disposable
project, adds a guaranteed closed-release/open-epic/planned-task regression,
recursively restores closed containers and tasks through bounded parent pages,
deduplicating retained ancestors by identity, then compares every summary
and the Lua roll-up rules with the snapshot plus bounded by-id closed-text reads, and asserts the copied items
frame fits 1 MiB.
It also feeds separate plan reads to Lua's stage selector. The dated E-880
allowance preserves this all-body differential guard. Neither the source tracker
nor the human's HOME, accounts or Git configuration is used for execution.
