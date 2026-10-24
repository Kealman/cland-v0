# web/test/topics.test.ts

`web/test/topics.test.ts` uses the isolated Headless Shell and disposable
`projectHub` frame seam for topic grouping, browser-only group folds, a
300-message numeric history traversal and item links. It holds real history
replies while an ask is answered and a message arrives, then retains the final
ordered identities and prepend anchor assertions against fresh history pages.
A rejected earlier page stays failed after another scroll event; a later live
DOM row fences that event before asserting the error and absence of another
request. Explicit Retry followed by a held reply retains the old top message
and complete ordered identities. A real public resume request forces a fresh
snapshot across a held initial read: the replacement request must arrive before
the stale reply is released, and a later live DOM row fences that stale reply.
A held fake-adapter injection proves delivery-stage updates without another
history or topic-list read. Reconnect tests retain cached history during ring
replay and require a new history read after a restarted hub's snapshot.
Browser-controlled time proves the one-second read threshold; a controlled
document visibility boundary cancels incomplete intervals and keeps hidden
messages unread. A second frame client checks the hub's unread count, including
a viewport whose last visible message precedes the thread's end. These are Web
checks, with no native hub process or GUI browser.

The partial-viewport read case holds the outgoing read frame, checks the unread
count before applying it, then arms a second client's exact topic read-sequence
and unread receipt before release. The final list assertion follows that receipt;
observing only a browser-sent frame cannot fence another client's list request.
Topics also asserts its registered pane/page surfaces after area-module integration.
`hub/test/web-area-state.test.ts` retains topic and artifact visibility replacements
in one frame and asserts no inventory reads through the public connection callback.
