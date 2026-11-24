# web/test/sessions.test.ts

`Sessions row names its launching user only in users mode` launches a legacy
single-mode row and a users-mode row through the fixture hub, then asserts the
rendered `by <display name>` fact and the legacy row's absence of that fact.
The scratch config is managed; the browser has its own Headless Shell profile.

`web/test/sessions.test.ts` owns the Sessions list seams against fake harnesses:
group/header counts, browser-only fold persistence, merged row facts and live
hold/request changes, full waiting commands and human-ask topics, visible-row
physical navigation, stopped/archived inventories and `gs` into a folded group.
Archive reads consume the additive hub-merged `session.list.rows` field.
The merged-facts case checks P22 geometry at 1440 px and P27's 52 px two-line
rows at a test-set 600 px viewport, including the pending command, hold/request
facts, page-only metadata and absent list actions.

T-1472 adds the actual Sessions row's `deaf` rendering after held human input
ages beyond five minutes, then observes the injection receipt and rendered idle
row. Use the isolated Headless Shell. The file's prerequisite ensures a current
web bundle before cases run; a pre-existing `web/dist` is not required.

`Sessions stopped and exited rows and pages retain state reasons` uses fake
OpenCode reasons and checks each exact session id's non-live status through
`session.list` before observing row labels and page State facts. Both reason
and plain cases retain their stopped/died styling hook and failed glyph colour.
The shared stage owner captures acquisition before it starts, bounds setup and
render observations separately with load-scaled helpers, and guards the adopted
root until required close receipts succeed. Fenced cleanup retains the scratch
TMPDIR through a rejected close; the original environment is restored only
after successful cleanup. The captured browser's guarded process cleanup, PID
absence, disconnected browser, stopped hub and closed socket gate release.

`Sessions remote host fact names its host with a tooltip on ground and selection`
launches fake Codex sessions through `session.launch` on a registered `testHost`
and on `local`. It reads the remote id and tooltip from the desktop row, checks
the inherited contrast-checked muted colour before and after selection, and
checks that the local row has no host fact. Native operations on the fake host
refuse; directory admission is synthetic. No provider or external network runs.
