# hub/test/human-marks.test.ts

`hub/test/human-marks.test.ts` proves cross-client monotonic events timestamps,
plan-history receipts and topic read positions through real frame clients. Its
persistence case stops and reopens `projectHub` in-process, retaining the exact
marks, topic position and one-time import receipt; it makes no OS-process
restart claim. `nvim/test/human-marks-component.test.ts` uses the headless recorded
stub and a second scripted frame peer for the Events visit, shared topic reads,
one-time legacy import and stale-copy cleanup. A held initial marks reply and a separately deferred preference write prove that startup without validated legacy keys makes no write attempt, preserving the original invalid-file notice. Peer marks updates must reach an
already connected editor, including a delta that precedes a held older
`marks.get` response. The Events visit observer starts before navigation and
waits for the exact peer-visible timestamp; cold-start replacement waits for
editor close and owned process-group disappearance. Its HOME/XDG/Git paths are scratch
and child launch applies the shared credential filter. Refresh its recording
slice and only other changed consumers with
`npm run test:nvim-fixtures -- --slice <test-file>`; startup mark frames have no
visibility projection context, so the same recording serves unchanged consumers.
The recorded mark merge calls the production function through the T3 recorder;
T2 never imports hub runtime code. `plan.test.ts` retains the native plan/restart
contract and reads receipts from the hub rather than `ui.json`.
