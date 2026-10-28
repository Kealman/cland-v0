# hub/test/speech-command.test.ts

T3 native process-lifecycle seam on Node 24.21.0. Run this file alone with
`node --test hub/test/speech-command.test.ts`. The sealed fixture owner is
`hub/test/fakes/speech/command.ts`; scripts are written in disposable roots with
fixtureEnvironment HOME/XDG/Git settings. Synthetic credential inputs are
injected only into the production subject; none is inherited from the host.
No hub frame invokes speech yet, and no test contacts a real provider.

C1 observes exact stdin bytes, a literal space/$(…) argument and trimmed UTF-8
stdout. C2 observes only environment names and speech metadata; all five remote
and executor credential names are absent. C3 observes a nonzero exit, the
redacted diagnostic tail, missing/empty argv and a ready command that ignores
SIGTERM. FakeClock advances from that readiness receipt to 30 seconds (still
alive), then the 90-second note deadline; the result must be timeout and the
recorded PID must be reaped. The descendant case holds inherited stdout/stderr open and ignores SIGTERM;
its durable PID receipt and parent must be reaped by production cancellation
before any failure-only rescue. Production now observes both native close
and group ESRCH within the bounded drain, including Linux reaping after close. Bypassing group signals produces missing-close
red; returning timeout early produces the descendant-reaping assertion red.
Rescue observes both captured PIDs gone separately before fixture removal.
The 100 ms kill grace uses native time, independent
of the injected behavior clock. A five-second native signal bounds every run.
The idempotent registered disposer cancels and bounds operation drainage at
three native seconds, preserving the root on incomplete native close. Readiness
watchers are armed before launch with single-flight 25 ms read retries for
coalesced native file events; both their deadline and abort cancel native
reads, close the watcher and join outstanding reads before removal. Omitted and
aborted readiness controls assert the timeout/abort, native PID reaping and
removed root.

C4 checks off/null, missing-key/not-configured, command selection and executable
resolution (PATH, absolute, absent, directory and non-executable). The shared
fake ElevenLabs API also proves empty environment override suppresses the file
key, file-key fallback, nonempty override and custom model; captures record key
presence only. Additional controls cover signal failure, empty stdout and the
1 MiB overflow refusal. Existing speech.test.ts retains omitted-policy cloud
retry/cancellation behavior. No browser, gateway voice pipeline or paid-service
coverage is claimed. Linux durations await the mode-free verify receipt.
