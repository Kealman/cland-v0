# hub/test/host-memory.test.ts

Run `node --test hub/test/host-memory.test.ts`.

`launch memory policy refuses below floor, admits exact floor and unknown
non-Linux memory` injects the shared reader and proves refusal at 1,200,000,000 and
1,299,999,999 bytes, admission at exactly 1,300,000,000 and 1,400,000,000, and
admission with no available-memory verdict. No native process or clock is used.
The actual agent/fake-host and Claude paths are in host-agent.test.ts and
claude-code-remote.test.ts. Shared fake controls are JSON `availableBytes` in the
`available-memory` file beside the fake boot-id, gated by `CLAND_FAKE_HOSTS`.
