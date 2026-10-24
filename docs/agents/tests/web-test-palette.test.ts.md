# web/test/palette.test.ts

Tier: **Web**, as classified in [`hub/test/tiers.json`](../../../hub/test/tiers.json).
The sealed scratch hub and Headless Shell fixture proves palette opening and
dismissal, prefix filtering, result order, matching highlights, keyboard selection
and opening in the other pane. It checks area help and physical-code shortcuts
with Cyrillic key values, preserves editable-field input and focus, and covers
Space-leader updates and Unicode matching. The small-viewport regression proves
that all 33 Items help rows become fully visible through complete keyboard
scrolls at 1280×720 and 1024×600.

`palette.test.ts` retains shell number keys outside answer rows and now expects
the handled Inbox navigation, reply, archive and removal actions in help.

Area help expectations live in `web/test/palette-help/<area>.json`, one file per area. The rendered palette test loads each area’s literal counts, keys and labels independently. Edit the matching area fixture when its help changes.

The dated allowances in [`hub/test/durations.json`](../../../hub/test/durations.json)
remain documented until T-1051 brings Web shell and palette tests under budget.
These are temporary caps, not measured durations:

| Test identity | Seconds | Owner | Added | Expires |
| --- | ---: | --- | --- | --- |
| `web/test/palette.test.ts::the palette and area keys help` | 12 | E-880 | 2026-10-24 | 2026-11-23 |
| `web/test/palette.test.ts::Items help contains all 33 rows within small viewports during complete keyboard scrolls` | 7.5 | E-880 | 2026-10-24 | 2026-11-23 |
