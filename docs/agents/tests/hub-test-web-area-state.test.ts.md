# hub/test/web-area-state.test.ts

T1: connectHub's public callback over a scripted browser socket and mocked clock;
no real browser, network, hub or process. Area replacement and live-delta controls
retain session/account/artifact state and fence stale replies.

`active sign-in identities update incrementally across live inbox message and
terminal cards` covers live ask, message and flattened inbox ingestion,
same-login replacement, an older terminal receipt retaining the newer active id,
and positive terminal history recovery.

`card delta and inbox publication copy bounded paths with 2000 retained cards`
seeds the production connection via ask frames. Its positive iteration control
visits all 2,000 retained entries, then each ingestion path visits zero retained
entries and copies at most `id.length * 4 * 16` radix slots. Published versions
remain immutable; updates preserve insertion order. The active sign-in selector
also performs 1,000 lookups without history iteration. This is a deterministic
work count, not a timing or browser rendering measurement.

`retained card versions match native Map lookup and insertion order for every
consumer` compares replacements, prefix/Unicode/empty ids, lookup, size and all
iteration APIs with a native Map. Inbox, sign-in and remote topic card consumers
continue to use their existing lookup and row order. Browser rendering coverage
remains in `web/test/asks.test.ts`, `web/test/hosts-view.test.ts` (including the
previous wire shape), and `web/test/remotes.test.ts`; the connection wire shape
is unchanged.

`active sign-in row lookup reads no retained history on a synthetic card
inventory` retains its duration identity and measures the selector separately:
2,000 synthetic terminal frames plus one active frame, a positive iteration
control, then 1,000 lookups with zero card reads or iteration.
