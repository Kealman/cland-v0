# hub/test/doctor-harness-probe.test.ts

OpenCode Console comparison uses injected installation facts and `auth list
--standalone --format json` replies at T1. Distinguish cland's selected database
from the default XDG/HOME OpenCode database, ignoring an inherited OPENCODE_DB.
Prove a missing Console provider warns even when another provider is connected;
compare provider ids, exclude environment connections, and label failed,
malformed or timed-out default-store reads incomplete without exposing their
raw output. No executable, account or credential store is opened by these cases.
