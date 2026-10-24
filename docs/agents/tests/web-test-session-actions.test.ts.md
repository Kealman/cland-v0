# web/test/session-actions.test.ts

`web/test/session-actions.test.ts` owns Stop confirmation/cancellation, Resume
identity/role/claim retention, Archive, adapter capabilities and missing adapters,
the session page at desktop and narrow widths, and the fresh-launch brief after
unavailable resume. It uses sealed in-process fake harnesses and Headless Shell,
with CLI `session list` readback for Stop/Resume. The held fake Stop observes
adapter submission with a separate bound, checks duplicate Enter is inert until
the receipt, releases the gate in cleanup and retains the final stopped row.
The narrow-page case checks Stop cancellation, Esc back to the same focused row,
inert list action keys, Enter re-entry and archived-row return with the toggle retained. Failed actions retain the hub's reason.
No real harness or live hub is used.
