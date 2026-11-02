## Prebuilt Web release assets

For cland itself, `[release] web_bundle = true` in the committed dev config
opts into publishing `cland-web.tar.gz` and `cland-web.tar.gz.sha256`. Generated
and older configs default to false, so ordinary projects gain no build or gh
requirement. The release machine needs Node/npm, Git, tar, network access for
locked dependencies, and an installed `gh` already authenticated to github.com
with release-write access. No login is started, no credential is put in argv,
and gh’s authentication output is not copied to hub logs.

Dry-run checks gh authentication before approval, archives the pinned Git commit
into an isolated build directory, installs locked dev dependencies with lifecycle
scripts disabled, builds and checks the source stamp. It caches the archive by
commit in ignored `.cland/release-web/`, retaining the build root so no native
writer loses its directory during cleanup. The plain/JSON preview names the repo,
tag, both filenames, byte sizes and archive SHA-256; the checksum file contains
that digest and archive name. Include these exact facts in the single release
approval. Dry-run makes no GitHub writes; it may install build dependencies and
write the ignored cache. The release CLI allows 30 minutes for the reply.

After the atomic product push, release creates a draft GitHub Release when
needed, uploads missing assets, downloads both to compare the exact approved
bytes, and publishes the draft. Existing assets are never clobbered. The optional
`webBundle` reply and item comment report the final facts; older replies without
it remain supported. Asset publication is a separate transaction. On a
`web-bundle` follow-up failure, preserve `release.tmp` and its cached assets;
retry the same item/version. The receipt pins repo, commit and checksum despite
later dev/config changes, and remote readback recovers lost upload replies.
Conflicting remote bytes refuse replacement. Item closure waits for the assets
and any Homebrew follow-up; old receipts without Web assets keep their scope.
The installer accepts verified, source-matching assets and otherwise builds
from source, including tags that predate these assets. Homebrew keeps building
from source.

