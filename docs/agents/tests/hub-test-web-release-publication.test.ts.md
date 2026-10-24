# hub/test/web-release-publication.test.ts

T3 native Git/archive/npm contract; no daemon, browser or public endpoint.
Run `node --test hub/test/web-release-publication.test.ts` on its own.
Prepared product/territory/GitHub stand-ins are private disposable repositories;
all environments use fixtureEnvironment after overlays. The asset transport is
an in-process fake owning a local directory, so no gh command contacts GitHub.

The first test exercises releaseGit: opt-in committed config, gh preflight
failure before build/push, dry-run asset facts, product-before-asset ordering,
pinned checksum receipt, lost upload reply and retry despite later dev/config.
The second builds a tiny committed project through native npm/tar, checks archive
bytes and SHA-256, and proves the live checkout is ignored and cache reuse is
byte-identical. The fake gh transport then exercises the real asset publisher:
draft/create, two uploads with exact remote byte readback, lost successful reply,
idempotent retry, final publication and refusal of conflicting remote bytes.
No token is supplied or captured. The production command boundary suppresses gh
authentication output. This is sealed contract evidence, not a public release or
a measurement of the real product's installation time.

The companion T1 `homebrew.test.ts` also covers default-off/round-trip/type
validation for web_bundle and the CLI reader at the previous wire response shape
without optional Web facts. Installer acceptance/fallback has its own native file.
