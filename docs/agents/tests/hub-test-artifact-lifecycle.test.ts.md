# hub/test/artifact-lifecycle.test.ts

T2 uses a scratch Store, the public Unix frame edge and the artifact lifecycle's
filesystem/SQLite seams. Fixtures use `tempProject`; no real provider, credential
or human directory is involved. The existing no-project `startHub` seam supplies
the explicit Store and filesystem faults; no separate hub process is launched.
Run the file alone with `node --test hub/test/artifact-lifecycle.test.ts`.

`artifact subscriptions publish only after the existing artifact/post transaction
commits` and `a refused folder publication rolls back its directory and id
reservation` use `failPostWrite`: a SQLite trigger refuses the human post's
messages insertion before the artifact/post transaction commits. Keep all
existing refused-result, index, subscription history, event-delivery, directory,
id-reuse and accepted-retry assertions. The trigger is removed before retry.
A human-send logger throw is post-commit and cannot supply this rollback boundary.

`a post-commit human-send log failure keeps one stored artifact post and reports
the operator diagnostic` retains a separate logger fault. It observes the actual
spoke delivery, drains ordered UI/spoke replies, and asserts one stored post,
one UI message, one spoke delivery, retained artifact bytes and one
`publication-failed` record in the hub's operator LogFn sink. A second Store
handle independently reads the committed artifact and exact message id. Its
five-second native test bound is separate from fixture/frame observers. This
case must fail against the earlier pre-commit human-send logger behavior;
the source was restored from Git and diff-checked for that positive control.

Other cases retain the existing promotion/archive/reopen, retention rollback,
confinement, revocation, moved-file, hard-link and writer-drain assertions.
Post-commit subscriber or error-logger faults keep committed bytes and index;
pre-commit write failures still refuse and permit a clean retry.
