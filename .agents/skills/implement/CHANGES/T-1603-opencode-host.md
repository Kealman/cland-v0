T-1603: document OpenCode Unix HTTP/SSE forwarding and bounded in-memory failed-launch settlement, including the T-1671 restart limitation.

Source-review correction: normal terminal settlement retains retry ownership; drain native HTTP/SSE sockets and watch snapshots/subscription before cancelling the forward.
