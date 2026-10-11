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
Warnings stay in Watch even under a now override. Old messages still follow the
seven-day archive policy and retain their severity. Warnings are information:
there is no dismissal, acknowledgement or later-clear resolution rule. `d` refuses
a warning and `D` retains warnings while dismissing ordinary notifications.
Clear verdicts and long idles default to Watch; role bookkeeping is Background.

The placement table and consumers land in T-190. The later T-115 slices add folds
and filtering to the other panels, archive retrieval for threads, and pins/mutes.
T-190 does not implement those later panel controls or persisted overrides in
`ui.json`.

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
| `items` | `active`: now; `planned`: watch; `backlog`, `unscheduled`, `done`: background; `closed_release`: archive |
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
