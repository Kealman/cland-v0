# hub/test/quarantine-runner.test.ts

`hub/test/quarantine-runner.test.ts` is T3: its public `runSuite` fixture proves
real Node coordinator exits and reporter publication, without a browser or hub
daemon. The fixture seals its HOME, XDG and Git environment and obeys cover-quiet
before setup. Its ten-second child deadline bounds the whole fixture.

For an interrupted phase, arm the stdout observer before releasing the runner;
kill the owned process group only after the exact held test's execution-order
start receipt. Fault missing, empty and truncated receipt reads after the writer
has stopped. Assert `incomplete: receipt missing`, the test identity, native
exit/signal, captured stderr tail, non-zero status and absence of a JSON parse
error. Also retain the zero-native-exit/missing-receipt case. Keep the cleanup
sweep before pipe closure so a surviving descendant cannot block its own cleanup.

`hub/test/quarantine.test.ts` exercises reporter streams at T1. Its filesystem
publication test holds an existing receipt while a staging write fails, then
observes the complete replacement and consumed staging path after stream flush.
Unit consumers inside test workers retain streamed JSON and cannot overwrite
their containing phase's receipt. Load repetitions own distinct receipt paths;
the existing quarantined repetition test proves their accounting remains green.

Fault all three unusable receipt forms for failed quarantined repetitions too:
each keeps its identity, native exit/stderr and five failed attempts, with no
quarantine excuse or parser exception. At the runner pipe edge, split every
multi-byte identity inside its UTF-8 bytes and assert the exact Unicode identity
in the incomplete report; a streaming decoder must preserve it across chunks.
