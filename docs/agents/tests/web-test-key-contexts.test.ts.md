# web/test/key-contexts.test.ts

`web/test/key-contexts.test.ts` covers T-1115 through the production shell: an
explicit composer field reserves its Enter chords while ordinary fields inside
a declared block keep native input; stand-in area selection, drawers and split
content remain intact; Sessions launch actions appear in help and palette alongside navigation, session
actions and archive;
and a handled Items palette action runs after modal focus restoration. The pure
resolver cases stay in T1 `hub/test/web-keymap.test.ts`. Existing shell, palette,
fold and Items Web tests retain their existing coverage.
