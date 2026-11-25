# hub/test/web-area-state.test.ts

T1: connectHub's public callback over a scripted browser socket and mocked clock;
no real browser, network, hub or process. Area replacement and live-delta controls
retain session/account/artifact state and fence stale replies.

The event summary cases drive `connectHub` through fake socket frames and virtual
time. A 100-event burst produces one read after one second and the emitted
summary equals the complete returned page. Events received during a slow read
produce one follow-up window; the final page includes the tail. Sustained
traffic (1,200 frames over 60 virtual seconds) starts 60 reads, and advancing an
idle clock starts none. Stopping the connection cancels a pending window.
These are request-count and state receipts, not browser rendering or real-time
latency measurements.
The rejection and timeout cases send no further event after the failed read;
each retains one pending retry window and verifies the final successful page
and projected row, followed by zero further idle requests.
Result-then-stop/close/replacement controls dispose the connection before promise
continuations run and check the exact retained page. The replacement control
also verifies a new socket can complete its own summary read.

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
