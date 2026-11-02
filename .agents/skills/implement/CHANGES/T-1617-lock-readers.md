T-1617: Document shared foreign lock reader classification, offline synchronous acquisition, native identity handoffs and lifecycle preservation guidance. Generic async locks and role permissions remain unchanged.
Migration renews ownership throughout work and cleanup and fences publication on lock loss. Held-boundary tests cover foreign stop successors and migration lifetime.
After A-15913: projectHub defaults to captured native identity; doctor shares the same capture, and only foreign negative controls opt into synthetic identity. This preserves existing CLI consumer assertions.
After merge-batch import-budget failure: keep lifecycle reader imports lazy and preserve the existing CLI module-count and SQLite-free assertions.
