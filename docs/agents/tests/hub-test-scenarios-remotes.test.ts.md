# hub/test/scenarios/remotes.test.ts

T3 scenario `remotes`, one sealed project with both production messenger factories,
loopback Telegram, Discord REST/ws and fake speech. Three sequential projectHub
starts; no daemon processes, real platform, browser or credential. Disposable
roots and the harness environment builder isolate HOME, XDG and Git.

Declaration-to-step audit:

- C1: a mapped Discord Other button opens a modal; its submission is the one stored
  answer, the Telegram copy loses buttons, and inbox archive reads answered.
- C2: each platform sends a photo and voice; history retains original bytes,
  one artifact and source per input. The other native platform receives one marked
  copy, including the transcript. Final history count excludes restart duplicates.
- C3: stop for 30 seconds, then four minutes using injected time. Discord resumes
  the short stop with a buffered press and text; the long stop reads history after
  fresh Identify. Both inputs have late annotations and remain unique. Open cards
  are retained/replaced per platform lifetime; old edits need durable sent receipts.
- C4: fake getUpdates returns 401, the observed poll closes, Telegram status names
  token cause, and Discord still accepts and publishes General exactly once.
- C6's lower-tier rule: telegram-graceful-restart.test.ts; the integrated restart
  keeps both platform lifetimes active in the same hub.

Injected time is not elapsed restart latency. The pacing driver advances from
committed queued Telegram waits and newly sent Discord reactions, serially.
Native controls are bounded and teardown stops writers before Store/root removal.
C5's five-repeat two-worker load probe is external evidence, following source
review and shared machine leases; Linux mode-free verification supplies its own
receipt. Neither is claimed from an ordinary local test run.

The shared `remotes-fixture.ts` delegates every hub acquisition to `pacingOwner`:
setup observes an independent bounded readiness receipt before native startup,
and disposal fences later starts, joins late hubs and closes storage only after
writers stop. The T2 file drives omitted and pre-aborted serving receipts through
that same fixture and checks native closure, closed storage and zero pending
owners/timers. Destination uploads assert original-byte SHA-256 and byte length,
one attachment and one upload, and zero source-platform file echoes. C1 counts
the human `answerTo` message as well as the original ask and archived departure.
