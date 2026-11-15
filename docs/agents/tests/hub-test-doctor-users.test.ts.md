# hub/test/doctor-users.test.ts

T2: `node --test hub/test/doctor-users.test.ts`, supported Node, cover-quiet
admission and load below 20. No native harness, browser, provider or live database.
Fixtures own roots on allocation and join socket/hub shutdown before disposal.
Route findings to `lead T-1836` in its item topic. QA is after-stage on dev.

- `C1 doctor reports single mode from the running hub`: one exact JSON row and
  text row against projectHub. Initial red: missing row, `0 !== 1`.
- `C2 doctor reads users counts from the hub and labels offline counts unknown`:
  offline config users warns with hub start; projectHub switches using auth.mode,
  adds an invited admin, then reports one active, one invited, two total admins
  and one active admin. Synthetic Git user name only. No credential capture.
- `doctor warns when config users disagrees with a running single-mode hub`:
  projectHub remains single while its config file changes to users. Real
  user.list refusal yields reload guidance without parsing error text.
- `C3 doctor warns with invite fix when no active admin exists`: literal fake
  user.list reply with one invited admin. A real hub refuses startup without an
  authorized first admin, so this recovery shape uses the owned legacy socket
  fixture, not a database edit.
- `doctor reports hub not running for stale discovery with a live PID`: closes
  the fake server and observes shutdown before doctor uses its retained discovery.
  Initial red incorrectly gave reload instead of hub start; native connection
  refusal now reports offline counts.
- `doctor keeps held live user counts unknown after timeout`: the fake socket
  acknowledges hello and observes user.list but holds its reply. A separate
  load-scaled setup bound observes that receipt before advancing only the
  injected transport clock by 3000 ms. The check returns unavailable counts and
  reload guidance while the listener remains open. Cleanup joins the check
  before root removal. This test exercises checkUsers directly; the other six
  cases cover its integration in doctor text/JSON. Initial red reported hub
  not running/start despite the held live request. No native time wait or
  duration allowance is needed.
- `C4 doctor omits planted identity and credential material in text and JSON`:
  positive control detects all three synthetic markers in the literal fake reply
  before doctor runs; the same detector sees none in either report. Counts remain
  asserted, so an empty output cannot pass. No actual secret is used.

Coordinator decision 4324006e in topic-1517: mode always comes from config;
only counts come from user.list. Existing old-hub refusal is covered by the
single-mode disagreement test. Existing wire shape is unchanged.
