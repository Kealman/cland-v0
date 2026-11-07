# hub/test/host-readiness-owner.test.ts

T2 typed carrier/Git owners, in-memory store and FakeClock. No native transport,
provider, browser or network. Each case arms a bounded down-poll observer before
ready(id), then closes or removes the owner without a caller signal or clock
advance. The exact ready promise must reject before close/remove returns, and
its timer must be released. Cleanup joins readiness before closing storage.
The cleanup-only clock advance drains the negative control against old source;
it is not evidence for the behaviour under test.
