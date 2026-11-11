# hub/test/login-key-spawn.test.ts

T3 at the authenticated prepared-spawn boundary. Two directory-backed fake hosts
run the existing fake OpenCode binary's key-proof command concurrently. Its only
output is the SHA-256 digest, compared with the fixture sentinel's known digest.
No real provider, credential, login or network is used.

`two fake hosts receive a key only at spawn and retain no plaintext through agent restart`
checks the prepared record while it exists, preserves a nonsecret marker,
observes native digest output and liveness on both hosts, then scans every regular
file under the fixture root (including encrypted auth and SQLite files) and the
captured launch argv. It stops the first native owner before agent restart and
launches again from the key store. Cleanup joins stops, clients and agents before
closing storage or disposing the root. Missing digest receipts include a bounded,
redacted native-output tail.

Run on supported Node 24 in the release preservation slot, stripping inherited
CLAND variables. Run each new case alone five times in fresh processes in the macOS native slot. Linux evidence comes from mode-free cland verify on the configured droplet at the reviewed head. The incomplete local Docker attempt is excluded from evidence.
The native scenario complements T2 session/adapter coverage; it does not itself
prove a hub restart or process-table publication.

T2 `login-binding.test.ts` case `pool key launch carries a secret separately from persisted account environment`
proves public launch, secret-free process replies and database, a real projectHub
restart with a rotated encrypted key file, and human host.stop leaving the key
ready with no bindings. It scans the actual hub log and journal after shutdown.
`ready key selection permits simultaneous hosts without disk bindings` forbids
provider resolution and proves reusable key selection.

T2 `opencode-launch-policy.test.ts` cases `successful key launch returns only login metadata`
and `key spawn environment reaches native spawn but never the returned process or errors`
prove adapter separation and login-named failure. Existing launch cases retain
the previous request shape without secretEnv.

T3 host-agent case `admission plan excludes environment while native launch receives it`
reads the durable plan before bootstrap, checks absence of env/fakeEnv and the
sentinel, then requires native exit zero from the child's environment assertions.

Linux task verification supplies T1/T2 and changed T3. The local native slot also
covers host-create-ready, host-destroy-native, host-restart, host-restart-reconcile,
host-unreachable, host-stop, login-write-back and host-prepared. Remaining T3 is
deferred to the configured merge/integrated occasions; T4 and stage QA run on dev
at stage/epic occasions. No browser is involved.

`composed key launches on two hosts resume a persisted conversation after hub and agent restart` runs production Sessions, OpenCodeAdapter and sshHost against two agent sockets and the fake OpenCode HTTP/SSE server. It reads prepared checkpoints inside the admission callback before commit, observes bootstrap plans before spawn, and checks native key digests, persisted login/account metadata, both live processes, captured native argv and every regular file in the disposable root. A planted hub-local file proves positive scanner detection. After native stop/close receipts, it restarts both agents and projectHub, rotates the encrypted key and resumes the persisted session and harness conversation ids. The new native PID must prove the rotated digest; logs, journal, database, ciphertext and process rows are scanned again after shutdown. The fixture removes a stale fake Unix listener only after confirmed native closure; it starts no SSH process or network connection.

T2 typed-refusal cases cover memory, account, authority and unknown ownership failures, preserving the same error instance and safe structured receipt fields while removing the key from message and stack. The hub-restart case also injects an escaped synthetic key into event and reason through AdapterHost.log and checks decoded persisted values; the event itself is a positive persistence receipt.

The composed fixture registers its owner disposal through the shared onCleanup resource phase immediately after allocation. A directory-removal guard retains the root unless that join succeeds. `composed fixture early failure joins native and storage before root disposal` ends a nested scope with a live native fake server after a forced body rejection; it requires the independent cleanup owners SIGKILL close receipt, both storage-close receipts while the root exists, and root removal only afterwards. The separate loginFixtureOwners after hook is an idempotent fallback.

The retained creating-key restart in login-list.test.ts remains legal metadata-only coverage. Startup key registration enumerates only ready keys; login-selection.test.ts now covers ready-key enumeration excluding creating/signed-out rows. Its 10,000-row positive decode control, disk query counts, history-decode limit and no-scan/no-temp-sort assertions are retained; OpenCode keys have their own indexed two-query path.
