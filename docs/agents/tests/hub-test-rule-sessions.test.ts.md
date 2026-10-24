# hub/test/rule-sessions.test.ts

T3 covers native rule delivery and a stopped process's exclusion from updates.
The fake follows T-360's last-human/agent-delivery contract even when a rule event
precedes that delivery. T-1253 updates the missed Inbox expectation: the human's
`Read retired rule.` message receives a pong in General. Match the only new Inbox
message to that exact reply's id and sender, and keep the total-count check so
the Agents retirement event cannot add another needs-you row. Explicitly exclude
the retirement event's id and Agents rows; do not read the reply away before
measuring, which would mask an unwanted row.

Arm both the retirement-event and expected-reply observers before triggering
them. Retain the rule add/edit/rename/retire, approval steer and no-extra-event
checks. The pure rule-refresh envelope control is in `codex-fake-envelope.test.ts`.
Use owned scratch fixtures and run this native file alone locally.
