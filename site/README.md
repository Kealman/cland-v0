# cland.app

The website for cland: a custom landing page and the documentation, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build). English only.

This folder is a standalone npm project with its own `package-lock.json`. It is not part of the repository's root npm workspaces, so run every command from inside `site/`.

## Run it

```sh
cd site
npm install
npm run dev       # local dev server with hot reload, http://localhost:4321
npm run build     # static build into dist/
npm run preview   # serve the built dist/ locally
```

## Where things live

| Path | What |
| --- | --- |
| `src/pages/index.astro` | The landing page at `/`, a plain Astro page (not Starlight). Its styles and the small script for the tab groups and the copy button are in the same file. |
| `src/content/docs/docs/*.md` | The documentation, served by Starlight under `/docs/`. `docs/index.md` is the Introduction at `/docs/`. |
| `src/content.config.ts` | The Starlight `docs` content collection. |
| `astro.config.mjs` | Site URL, Starlight options and the sidebar. The sidebar lists only the docs pages that exist. |
| `src/styles/starlight.css` | The brand theme for the docs: colours for dark and light mode, JetBrains Mono for headings and navigation, IBM Plex Sans for body text. |
| `src/assets/` | The wordmark SVGs (transparent, dark and light) and the landing screenshots, optimised at build time. |
| `public/` | Favicons, the Open Graph image `og.png` and `CNAME`. |

Brand sources (colours, logo, social images) are in `docs/brand/` at the repository root. Fonts are self-hosted through `@fontsource`; the site makes no requests to Google Fonts.

There is no `src/content/docs/index.md` on purpose: Starlight must not claim `/`, which belongs to the landing page.

## Deployment

The site deploys to GitHub Pages with the custom domain `cland.app` (`public/CNAME`, and `site: 'https://cland.app'` in `astro.config.mjs`). The workflow `.github/workflows/pages.yml` builds `site/` and deploys it on a push to `main` (every release) or to the `site` branch (site changes between releases). The repository's Pages source is GitHub Actions, and its custom domain is set in the repository settings: a `CNAME` file alone does not set it for an Actions deployment.
