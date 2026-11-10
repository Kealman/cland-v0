# hub/test/login-exclusive-native.test.ts

Run `node --test hub/test/login-exclusive-native.test.ts` in an exclusive native
preservation slot with inherited CLAND variables stripped. T3 starts two fake
agents and existing fake Codex binaries in disposable roots with sealed fixture
environments. No real provider, credential, harness sign-in or network is used.

The two hosts bind one non-exclusive login. Sign-in seeds the original, a snapshot
seeds the reader clone, and each host performs a native rotating-file turn.
Native run-host completion precedes host destruction. After both destroy receipts,
the original file contains only the writer host's turn and provider inventory
confirms the clone absent and the original detached. Fixture cleanup joins native
owners before root removal. Linux task verification runs this changed T3 file;
full T3 belongs to the merge batch, and T4 to stage/epic occasions.
