import { build, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { webSources, type WebSources, type WebBuildStamp } from '../hub/src/web-bundle.ts';
import { checkAssets } from './check-assets.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('./dist/', import.meta.url));
let before: WebSources;
let panel: string;
export default defineConfig({
  plugins: [react(), {
    name: 'cland-build-stamp',
    async buildStart() {
      await rm(`${dist}/build-stamp.json`, { force: true });
      this.addWatchFile(fileURLToPath(new URL('./src/artifacts/mermaid-viewer.ts', import.meta.url)));
      this.addWatchFile(fileURLToPath(new URL('./src/artifacts/MermaidViewer.module.css', import.meta.url)));
      before = await webSources(root);
      const tokens = await readFile(new URL('./src/tokens.css', import.meta.url), 'utf8');
      const value = tokens.match(/--panel:\s*([^;]+);/)?.[1]?.trim();
      if (!value) throw new Error('Missing panel colour in tokens.css');
      panel = value;
    },
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { name: 'cland-build-stamp', content: before.digest }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: panel }, injectTo: 'head' },
      ];
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify({
        id: '/', scope: '/', start_url: '/?area=inbox', display: 'standalone',
        theme_color: panel, background_color: panel,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }) + '\n' });
    },
    async writeBundle() {
      // Classic script in an opaque sandbox: no CORS or same-origin grant.
      // Library mode inlines dynamic imports; this entry is absent from the shell.
      await build({ configFile: false, define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: {
        outDir: dist, emptyOutDir: false,
        lib: { entry: fileURLToPath(new URL('./src/artifacts/mermaid-viewer.ts', import.meta.url)), name: 'ClandMermaid', formats: ['iife'], fileName: () => 'mermaid.js', cssFileName: 'mermaid' },
      } });
      await checkAssets(dist);
      const after = await webSources(root);
      if (before.digest !== after.digest) throw new Error('Web sources changed during build; rebuild before serving');
      const stamp: WebBuildStamp = { version: 1, sources: after.digest, builtAt: Date.now() };
      await writeFile(`${dist}/build-stamp.json`, `${JSON.stringify(stamp)}\n`);
    },
  }],
});
