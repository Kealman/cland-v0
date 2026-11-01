# hub/test/invites.test.ts

T1 uses Users on in-memory SQLite. Check digest-only rows and literal 24-hour
expiry, reopen the owner, spend once and retain distinct used/unknown/expired
refusals. Replacement and Users.onReset revoke every open invite. Names reject
reserved words, role/session collisions, non-slugs and duplicates.
