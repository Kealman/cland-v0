# hub/test/web-area-state.test.ts

T1: connectHub's public callback over a scripted browser socket and mocked clock;
no real browser, network, hub or process. Area replacement and live-delta controls
retain session/account/artifact state and fence stale replies.

`active sign-in identities update incrementally across live inbox message and
terminal cards` covers live ask, message and flattened inbox ingestion,
same-login replacement, an older terminal receipt retaining the newer active id,
and positive terminal history recovery.

`active sign-in row lookup reads no retained history on a synthetic card
inventory` uses 2,000 answered and eight cancelled synthetic cards. A positive
iteration control is followed by 1,000 production selector lookups with zero
retained-history iterations or reads. The existing whole-map publication copy is
explicitly measured/excluded as T-1840; this does not claim bounded legacy cache
ingestion. No live database or API data is used by the committed fixture. An
earlier read-only live database metadata count was outside the permitted data
boundary, discarded as provenance and replaced by these plain synthetic counts.
