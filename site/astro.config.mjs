// @ts-check
import { existsSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const SITE = 'https://cland.app';
const GITHUB = 'https://github.com/Kealman/cland-v0';

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
  group('Using cland', [
    ['Concepts', 'docs/concepts'],
    ['The workbench', 'docs/workbench'],
    ['Web and phone', 'docs/web-and-phone'],
    ['Accounts and limits', 'docs/accounts'],
    ['Crew configuration', 'docs/crew'],
    ['Verification and release', 'docs/verification-and-release'],
  ]),
  group('Reference', [
    ['CLI', 'docs/cli'],
    ['FAQ', 'docs/faq'],
  ]),
].filter((g) => g.items.length > 0);

export default defineConfig({
  site: SITE,
  integrations: [
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
      social: [{ icon: 'github', label: 'GitHub', href: GITHUB }],
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
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' } },
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
