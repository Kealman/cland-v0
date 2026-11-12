import type { TestContext } from 'node:test';
import { before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensureWebBuild } from '../../hub/test/web-build.ts';
import { projectHub } from '../../hub/test/harness.ts';
import { testHost } from '../../hub/src/host/test-host.ts';
import { webFixture } from './harness.ts';

before(() => ensureWebBuild(fileURLToPath(new URL('../../', import.meta.url))));

/** A registered remote with synthetic directory facts; native operations refuse. */
export function sessionHostFixture(t: TestContext) {
  return webFixture(t, { startHub: (root, env, options) => projectHub(t, root, env, {
    ...options,
    hosts: [{ ...testHost('fake-host', () => {}),
      statDirectory: async () => ({ refusal: null, identity: null }),
      realpath: async path => path,
    }],
  }) });
}
