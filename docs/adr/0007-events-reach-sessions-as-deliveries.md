# Events reach sessions as deliveries, digested at turn boundaries

A session learns about other sessions, items and topics by subscribing through the hub, not by polling and not by other sessions relaying. An event arrives as a delivery from the hub, through the same queue, stages and injection as a message, so every adapter carries it the way it carries a message. By default events are digested: they accumulate and arrive as one message when the session's next turn starts; a subscription may ask for immediate delivery where the harness can steer a running turn. Progress notes between sessions follow the same rule: a message sent with the kind progress never starts a turn and arrives with the next one. A lead is subscribed by default to the events of its node's subtree, less the subtrees with their own leads.

## Considered options

- **A separate event stream, a second channel into the session**: rejected. Every adapter would need a second delivery path, and Claude Code accepts input only at a turn boundary anyway; one queue keeps the ordering and the journal.
- **Polling tools only (`who`, `history`, `task.list`)**: rejected by the v0 journal (T-82): a monitor polled `session.list` every 10 seconds, 2,783 times, and about 80 Coordinator turns were pure relays of state that other sessions could have received themselves.
- **Immediate delivery for everything**: rejected. Claude Code sessions take input only when idle, so immediacy is not available there; digesting at the turn boundary gives the same timing with fewer turn starts, and folding progress notes removes up to 59% of them.

## Consequences

- The hub keeps subscriptions per session, coalesces repeated events, caps a digest, and drops subscriptions with their subscriber.
- `send` carries a kind; role clauses mark progress notes; a report, a question or a decision still starts a turn.
- Lifecycle notices (died, idle, waiting for approval) reach the lead of the node, not only the Agents log.
- The journal records event deliveries like messages; the human sees them only at the background layer.
