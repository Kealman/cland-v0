## Thread runs and fold lines

`session.history` reads the named session's sent messages and deliveries across
all topics, using the same traffic membership as the session's own `history`.
It defaults to 50 messages and clamps larger limits to 50. `limit` must be a
positive safe integer; `before` is an exclusive non-negative safe-integer message
number (`seq`), independent of timestamps. Pages select the latest matching
messages and return them oldest first. `more` and the first message's numeric
`before` cursor let a client page back. Empty histories return
`{messages: [], more: false}`. Whole-message pages stay below 256 KiB, with the
same single oversized-message exception as topic history. The spoke's own
`history` request, filters and limit are unchanged.

`topic.history` pages include `runs: ThreadRun[]`. Each foldable `TopicMessage`
has `runId`; the page includes exactly one complete run for every referenced id,
even when its first message is outside the page or an Agents filter selects only
some members. Counts and the latest step describe the whole retained run, not
just the loaded messages. Numeric and legacy message-id cursors keep their
existing ordering and exclusive boundaries. Run metadata counts against the
history byte budget; a single oversized message with its metadata retains the
existing one-message exception.

A run consists of consecutive agent-to-agent messages in one topic and one
local calendar day on the hub host (the day-rule boundary from `thread.lua`).
Asks, verdicts, answers, requests, and messages to or from the human or an Aide
end it; the next eligible message starts a new run. Verdicts use the shared
structured/first-line verdict classifier. An agent's unaddressed artifact
creation chip can join the surrounding run. Ordinary unaddressed sends go to the
human and cannot join. Run membership describes message facts independently of
visibility preferences; this extension does not change Neovim's existing folds.

`ThreadRun` carries:

- `id` (`run:<first-message-id>`) and `firstSeq`, the first durable message number;
- `participants`, the first three distinct sender/addressee names in encounter
  order, and `otherParticipants`, the count of the remaining distinct names;
- `messageCount` and `latest: {kind, preview, at}`, where `preview` is the latest
  message's first 12 whitespace-separated words, capped at 120 characters;
- `ageMs` at composition and `foldLine`, for example
  `impl → rev · 4 messages · report: Checks complete · 2m`.

The hub builds this line entirely from stored facts and its clock; no model
supplies it. Ages use whole seconds, minutes, hours or days, with `0s` for the
current message. A live `message` delta includes the message's `runId` and a
complete `run` replacement with the same id each time the run grows. Consumers
replace by id without re-reading history. Boundary messages omit both fields.
The ordinary and numbered/replay delivery paths carry the same run facts;
there are no timer-only age deltas. `latest.at` anchors the age between changes.

The store updates its derived run tables as messages are recorded (questions
finalize on publication, after the send transaction attaches any ask card), preserving
membership and ids across restart, including an Aide recipient's role at send
time. Eligibility is held on each message, separately from derived group rows,
so rebuilding after retention cannot fold a surviving former-Aide boundary.
Queued verifier assignment recomposes only its affected run's participant facts
from the durable messages, preserving its id, first number and message count;
the assignment delta and later history name the selected session.
Existing topics backfill lazily in sequence pages on their first read or
append; legacy recipient roles use the mapping available at backfill. Physical
message deletion invalidates only affected topics' projections: their next read
or append rebuilds runs from the retained messages. If a first message was
removed, the rebuilt run receives its new retained first message's id/number.
Agent/internal `history` retains its existing response shape; the additive run
metadata is supplied on client `topic.history` pages and `message` events.

