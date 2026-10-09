# The hierarchy is the item tree; leads are hub-held claims on nodes

cland's management hierarchy is the tree of tracker items (release, epic, item), not a tree of sessions. A session leads a node by holding the node's lead claim in the hub: the Coordinator leads the root, a Lead session leads an epic or a release, and an Implementer leads the item it claims. Reports, questions and events about an item route to the nearest lead up the item's chain; a question for the human goes up one level at a time, and only the root's lead asks the human. The levels that get dedicated Lead sessions are configured per project; with none configured the shape is flat, as in v0.

## Considered options

- **A tree of sessions, where the parent is the launcher**: rejected. Pooled Reviewers and QA serve many items, so a session would need many parents over time, and a launched-by link says nothing about what a session owns. The item tree already carries ownership and is configurable per project.
- **Fixed levels in code (coordinator, manager, lead)**: rejected. The prior-art research (T-84) shows that most systems stop at one supervising level by design and pay for each extra level in summarised results; a project should add a level only when its top saturates. The v0 journal (T-82) shows that item-level leads alone would remove up to 87% of the Coordinator's deliveries.
- **Hub-visible harness sub-agents as hierarchy nodes**: rejected. No harness lets an external host address a sub-agent as a peer (T-83); in-harness delegation stays inside one session's work and is counted as that session's cost.

## Consequences

- The hub holds a lead claim per node and routes by the item chain; a lead's default subscription is its subtree's events.
- A handover moves a node's lead together with the handover note (extends ADR 0001).
- Permissions are per level: a Lead launches, stops and merges within its node; the Coordinator keeps releases and the launch of Leads.
- The Coordinator's exclusivity narrows to the root: there is exactly one lead per node, or none.
