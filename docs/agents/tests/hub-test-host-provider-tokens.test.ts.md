# hub/test/host-provider-tokens.test.ts

T2: in-process projectHub, FakeClock, fake lock processes on both hub and
droplet paths, scripted fake DigitalOcean API; no native hosts or paid calls.
Run `node --test hub/test/host-provider-tokens.test.ts` with supported Node and
CLAND_* removed from the launch environment. Fixture owners seal child
environments and join hub/API shutdown before root removal.

- `C1/C3 provider diagnostics expose only the hub token fingerprint without provider requests`:
  a synthetic sentinel token supplied solely to the hub produces a literal known
  fingerprint; two DigitalOcean pools yield one row. The fake API request log
  stays unchanged across the frame, and flushed hub log, journal and client
  frames contain no sentinel value.
- `C2 provider diagnostics distinguish absent tokens and providers needing none`:
  local Neovim socket access, missing DigitalOcean token and token-free fake
  provider, sorted rows.
- `C4 provider diagnostics refuse sessions authenticated web and remote ingress`:
  authenticated web, messenger ingress and a launched fake session's actual
  credential all receive refusals. Human CLI still reads an empty provider list
  with no pools.

No browser binary, native transport or connect-frame recording is involved.
Existing host-status tests retain the previous reply shape. Stage QA can use
these cases for the environment-only diagnostic; doctor and setup integration
belong to their consumer items.
