// @ts-check
import { existsSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import clandMermaid from './src/plugins/mermaid.mjs';
import starlightLlmsTxt from 'starlight-llms-txt';

const SITE = 'https://cland.app';
const GITHUB = 'https://github.com/Kealman/cland-v0';
const DISCORD = 'https://discord.gg/Ssv3YFcA8Z';

// Docs pages are written separately; list only the ones that exist so a
// missing page never breaks the build. Slug `docs` is docs/index.md.
const docsDir = new URL('./src/content/docs/', import.meta.url);
const hasPage = (/** @type {string} */ slug) => {
  const file = slug === 'docs' ? 'docs/index' : slug;
  return ['.md', '.mdx'].some((ext) => existsSync(new URL(file + ext, docsDir)));
};
const group = (/** @type {string} */ label, /** @type {[string, string][]} */ items) => ({
  label,
  items: items.filter(([, slug]) => hasPage(slug)).map(([itemLabel, slug]) => ({ label: itemLabel, slug })),
});
const sidebar = [
  group('Start here', [
    ['Introduction', 'docs'],
    ['Quickstart', 'docs/quickstart'],
    ['Install', 'docs/install'],
  ]),
  // What cland does, one page per feature; the overview links every feature.
  group('Features', [
    ['Overview', 'docs/features'],
    ['Items and the tracker', 'docs/items'],
    ['Topics and the inbox', 'docs/topics'],
    ['Sessions and harness access', 'docs/sessions'],
    ['Accounts and limits', 'docs/accounts'],
    ['Verification and release', 'docs/verification-and-release'],
    ['Web and phone', 'docs/web-and-phone'],
    ['Remote control', 'docs/remote-control'],
  ]),
  // How to drive and configure it.
  group('Using cland', [
    ['Concepts', 'docs/concepts'],
    ['The workbench', 'docs/workbench'],
    ['Crew configuration', 'docs/crew'],
  ]),
  group('Reference', [
    ['CLI', 'docs/cli'],
    ['FAQ', 'docs/faq'],
  ]),
].filter((g) => g.items.length > 0);

export default defineConfig({
  site: SITE,
  integrations: [
    // Renders ```mermaid blocks to themed SVG at build time; see src/plugins/mermaid.mjs.
    clandMermaid(),
    starlight({
      title: 'cland',
      description: 'One coding crew across every AI plan you pay for.',
      logo: {
        dark: './src/assets/wordmark-dark.svg',
        light: './src/assets/wordmark-light.svg',
        alt: 'cland',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      // llms.txt, llms-full.txt and llms-small.txt at the site root, for coding agents and LLM tools.
      plugins: [
        starlightLlmsTxt({
          projectName: 'cland',
          description:
            'Open-source crew runner: Claude Code, Codex and OpenCode as one coding crew on the subscriptions you already pay for.',
          details:
            'A strong model leads, cheaper and open models do the legwork, and the human makes the decisions. cland runs the official claude, codex and opencode CLIs under your own logins, with one hub, one tracker in your repo, review and QA gates before every merge, and releases from the tracker. Apache-2.0, macOS and Linux.',
          optionalLinks: [
            { label: 'Source code', url: 'https://github.com/Kealman/cland-v0', description: 'The repository' },
            { label: 'Build log', url: 'https://cland.app/log/', description: 'What each release took, cost and broke' },
          ],
        }),
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: GITHUB },
        { icon: 'discord', label: 'Discord', href: DISCORD },
      ],
      // Adds a "Log" link to the build log beside the social icons.
      components: { SocialIcons: './src/components/starlight/SocialIcons.astro' },
      editLink: {},
      lastUpdated: false,
      customCss: [
        '@fontsource/ibm-plex-sans/400.css',
        '@fontsource/ibm-plex-sans/500.css',
        '@fontsource/ibm-plex-sans/600.css',
        '@fontsource/jetbrains-mono/400.css',
        '@fontsource/jetbrains-mono/700.css',
        './src/styles/starlight.css',
      ],
      head: [
        // Cookieless visit counts for the website; see GOATCOUNTER in src/site.ts.
        { tag: 'script', attrs: { 'data-goatcounter': 'https://cland.goatcounter.com/count', async: true, src: 'https://gc.zgo.at/count.js' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192.png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE}/og.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1280' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '640' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE}/og.png` } },
        { tag: 'meta', attrs: { name: 'twitter:site', content: '@cland_app' } },
        { tag: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', title: 'cland build log', href: `${SITE}/log/rss.xml` } },
      ],
      sidebar,
    }),
  ],
});
