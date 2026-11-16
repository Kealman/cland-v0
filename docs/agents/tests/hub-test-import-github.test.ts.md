# hub/test/import-github.test.ts

The T2 import fixture retains one sealed CLI subprocess proof and exercises
repeat imports in process with a fixture-only GitHub runner. `runImport` scopes
the ambient process environment through `fixtureEnvironment` because the
production import command's nested socket request uses its default environment.
The synthetic outer-session regression records the actual socket peer's frames
and requires an explicit human actor without the outer credential. Its gh runner
reads only scratch fixture files; no GitHub authentication or network is used.

The peer fixture uses `pathFixture`/`fixtureWork` before root acquisition. Every
setup and request sequence is admitted through its step fence; late listener
acquisition is captured and closed in the joined sequence's finally block.
Environment restoration follows the sequence and peer closure, and incomplete
work or resource closure retains the root. Held file-work controls cover both
normal cancellation and setup failure: cleanup fences the next operation, joins
the admitted write, closes the peer and only then removes the root. Their release
and join are registered before admission so an interrupted assertion cannot
strand a writer.
