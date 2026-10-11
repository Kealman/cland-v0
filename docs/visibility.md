# Visibility classification

The hub owns the §3.5 classifier (`hub/src/hub/visibility.ts`). Its outgoing
snapshots, history, live events and replayed results carry an additive `layer`
field: `now`, `watch`, `background` or `archive`. Decisions use the current clock
and the project's configuration, rather than persisting a layer that can go stale.
Artifact authors retain their creation role so a later role handover does not
change ownership classification; older artifacts fall back to the recorded session
role. Missing layer fields from an older hub remain unknown in Neovim.

The thread's `message_layer.layer` compatibility alias reads that hub field.
Background message runs fold as before, watch messages are dimmed, and Coordinator
reports to the human are now watch. The palette dims background and archive hits,
including artifact hits. Its search is an explicit way to reach archived records.
Task events also publish updated item layers, keeping cached palette rows current
when the current release changes. Their optional `layers` map is omitted when the
item index is empty, including removal of the last item.
The sessions chip counts only sessions classified now. The separate needs-you chip
and inbox header always use the hub's `needsYou`; Neovim never derives that number
from its locally visible records.
Live session-state frames use the process's status and launch role: a stop or exit
stays background even when idle is overridden to now; stopped Aides retain the
aide cell.

`needsYou` counts only now asks, approvals and waiting topics without an open
ask. Notifications never contribute, even when a project override places one in
Now. Subscription deliveries to agent leads remain independent of inbox placement.

Not-clear verdicts (including agent-to-agent verdict reports) and hub session-death
notices carry `severity: "warn"` from the shared classifier. Verdict task events
carry structured verdict/result/run facts into the Agents log even when their report
belongs to a bound item topic; death subscription events carry their lifecycle fact.
Bound-topic agent verdict references retain the verdict result too. Their inbox entries
and event-log messages show an amber `⚠` marker, sorted with the other events.
Warnings default to Watch even under a project now override; explicit human pins
and mutes then adjust their layer while retaining warn severity. Old messages still follow the
seven-day archive policy and retain their severity. Warnings are information:
there is no dismissal, acknowledgement or later-clear resolution rule. `d` refuses
a warning and `D` retains warnings while dismissing ordinary notifications.
Clear verdicts and long idles default to Watch; role bookkeeping is Background.

## Human pins and mutes

In a thread or topics panel, on a session row, or on an artifact in its browser or
file buffer, `gP` toggles a pin and `gM` toggles a mute. A pin raises the effective
layer to now; a mute lowers the default/project layer by one step (now → watch →
background → archive; archive stays archive). Repeating the current choice restores
the default; choosing the other replaces it. `gp` still opens an epic plan.

The human-only `visibility.set` frame takes `surface` (`topics`, `sessions` or
`artifacts`), `target` (the record id or session name), and `mode` (`pin` or `mute`).
It refuses unknown targets and session callers, asynchronously updates `ui.json` with an atomic replacement, and
publishes a `visibility` event. Open clients refresh snapshots and threads on that
event; future history, live frames, palette hits and the hub's now counts use the
same effective placement. These choices change presentation, not message delivery,
workflow status, artifact ownership, kept status or retention.

The file's `visibility` object maps each surface to ids and `pin`/`mute` choices.
The hub preserves layout fields, and Neovim preserves the hub-owned visibility
field on its debounced layout writes. Both writers hold a shared directory lock
across read and replacement. Recovery removes only a proven-dead owner's unique
file, preserving a competing replacement and uncertain PID owners. A busy layout
save defers; a busy pin/mute returns a retry message. Hub writes serialize without
blocking unrelated requests. Both survive cold restarts. Direct topic,
session and artifact choices win over inherited choices. Topic choices also affect
that topic's messages, artifacts, bound items and inbox entries; session choices
also affect its messages and inbox entries. A creation chip uses its artifact's
effective layer once, so a mute does not lower it twice.

The items panel keeps its workflow views and adds explicit layer filters: `gn`
(now), `gw` (watch), `gb` (background) and `gA` (archive), across the ranked project
items. The default release board shows foreground tasks in status sections and
folds background tasks, including done work, behind counts. `zR` does not reveal
archive; the archive filter and the complete tree are explicit archive actions.
Done tasks raised to Now or Watch remain visible in the default board and plan,
including through closed parent items.

Topics similarly fold background behind `more (N)`, with `za` to unfold and `A` for
archive. Artifacts use their effective layer in all browser sections, including a
pin on an archived artifact.

Threads hide archive-layer messages by default. `A` requests them and toggles them
back out; ordinary agent-run unfold keys leave archive hidden. Recent answers and
artifact chips remain visible when an older companion ask is archived. The
ordinary view keeps the latest 200 messages. Requesting archive pages through all retained history.

## Project overrides

The hub reads `.cland/config.toml` at startup. Restart it after editing visibility.
Each `[visibility]` entry is `surface.kind = "layer"`; omitted cells use the defaults.
For example, to place long idles in Now (without changing `needsYou`):

```toml
[visibility]
inbox.idle = "now"
```

`cland init` writes an empty `[visibility]` table. `cland update` preserves its
configured cells in managed files. Unknown surfaces, unknown kinds and invalid
layers produce a `config-unreadable` log and keep the built-in project defaults;
managed-file updates keep invalid files for the human to correct.

| Surface | Kind keys and default layers |
|---|---|
| `messages` | `human`, `ask`: now; `not_clear`, `coordinator_report`, `clear`: watch; `agent`: background; `old`: archive |
| `inbox` | `ask`, `approval`, `waiting`: now; `not_clear`, `death`, `clear`, `release`, `import`, `idle`: watch; `other`: background |
| `sessions` | `aide`, `waiting`, `busy`: now; `idle`: watch (unknown states also use this cell); `stopped`: background |
| `items` | `active` and `planned` require current-release membership: now and watch respectively; `backlog`, `unscheduled`, `done`: background; `closed_release`: archive |
| `artifacts` | `human`, `coordinator`, `kept`: watch; `agent`: background; `archived`: archive |
| `topics` | `waiting`: now; `open`: watch; `closed`: archive (for palette entries) |

Message age takes precedence: `old` means strictly older than seven days. Asks,
human/Aide traffic and verdicts then take precedence over ordinary message kinds.
An `active` item is in progress, review, QA or ready beneath the current release.
The current release is the open top-level configured container with the lowest
SemVer version; unversioned containers follow versioned ones, and item id breaks
ties. Planned items use watch; work outside that release is unscheduled/background.
Aides use the aide cell even when stopped. Human/Aide artifacts use the human cell;
shared or sent Coordinator artifacts use the coordinator cell. Archived artifacts
use archived before considering their author.
Kept agent artifacts use the kept cell before the coordinator or agent cell.
Creation chips share their artifact's current placement, including keep and unkeep;
ordinary messages with attachments keep message policy. Message age still takes
precedence over creation-chip placement. Open threads refresh that projection on
artifact changes, and history resolves current artifact metadata after restart.
