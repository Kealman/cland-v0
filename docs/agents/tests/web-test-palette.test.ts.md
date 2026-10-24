# web/test/palette.test.ts

`palette.test.ts` retains shell number keys outside answer rows and now expects
the handled Inbox navigation, reply, archive and removal actions in help.

Area help expectations live in `web/test/palette-help/<area>.json`, one file per area. The rendered palette test loads each area’s literal counts, keys and labels independently. Edit the matching area fixture when its help changes.
