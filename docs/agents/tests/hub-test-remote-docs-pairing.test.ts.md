# hub/test/remote-docs-pairing.test.ts

T2 executes the guide's `sh telegram-pairing` blocks in document order using
sealed CLI children, `projectHub` and the loopback fake Bot API. The precondition
is the guide's initialised project with a running hub; the fixture renders its
managed config with a scratch verification lock. `secretProject`/`secretCli`
own stdin, redaction, native close and capture drainage for the fabricated token.
Every other command is passed unchanged to the CLI, except replacing `<code>`
with the invitation actually received by the fake human's private chat.

Arm the first poll before enabling, and the confirmation poll before fake Start.
Observe that exact update's offset, compare the invitation's code with the
inbox's numeric identity, then approve and retain final remote.status and empty
pairing-row assertions. Stop the hub before inspecting drained logs/journal or
removing the root. Report token checks with value-free diagnostics. The fake
clock advances queue pacing only; live waits remain bounded. Run this file
alone; it uses no real platform, credential, browser or native hub process.
