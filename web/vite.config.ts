import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { webSources, type WebSources, type WebBuildStamp } from '../hub/src/web-bundle.ts';
import { checkAssets } from './check-assets.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('./dist/', import.meta.url));
let before: WebSources;
export default defineConfig({
  plugins: [react(), {
    name: 'cland-build-stamp',
    async buildStart() {
      await rm(`${dist}/build-stamp.json`, { force: true });
      before = await webSources(root);
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'cland-build-stamp', content: before.digest }, injectTo: 'head' }];
    },
    async writeBundle() {
      await checkAssets(dist);
      const after = await webSources(root);
      if (before.digest !== after.digest) throw new Error('Web sources changed during build; rebuild before serving');
      const stamp: WebBuildStamp = { version: 1, sources: after.digest, builtAt: Date.now() };
      await writeFile(`${dist}/build-stamp.json`, `${JSON.stringify(stamp)}\n`);
    },
  }],
});
