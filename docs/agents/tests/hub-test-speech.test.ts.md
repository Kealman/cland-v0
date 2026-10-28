# hub/test/speech.test.ts

`hub/test/speech.test.ts` is T2: production native fetch against the loopback
fake in `hub/test/fakes/speech/fake-api.ts`, with no hub, child process, account,
real platform or real key. Run `node --test hub/test/speech.test.ts` on Node 24.
The exchange owner registers cleanup before acquisition, aborts and joins both
note/retry work and individual provider calls before closing native connections,
clears delayed responses and joins request handlers. Setup and drain each have
a separate two-second native bound; each exchange has a five-second native
cancellation guard independent of behavior time. Missing/aborted listening setup,
in-flight request teardown and frozen-backoff teardown have explicit controls. Request captures contain key presence only,
form fields and original audio metadata/bytes. No artifacts export credentials.

C1 is the OGG request/transcript case. C2 is the permanent failure table, missing
key, persistent 429/503 and slow-response cases. C3 is the observed Retry-After
scheduling receipt, exact two-second boundary and three-attempt cap, plus the
30-second-attempt/cancellation case. C4 checks native redirect refusal with an
untouched target and every SpeechError kind with registered fictional keys.
Language names, ISO aliases, subtags and custom model/hint fields are also covered.

Retry and deadline measurements use injected FakeClock time, not real elapsed
latency. Setup waits are separately bounded at two real seconds, observing the
fake's parsed request or the injected clock's scheduling receipt before advancing.
The final result/error and request counts remain asserted. The held provider
case proves the wrapper bounds providers that ignore AbortSignal; real providers
must still release their own I/O when cancelled. Tests do not claim gateway
voice-pipeline, command-provider or paid-service coverage.
