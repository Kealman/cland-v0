# cland.app

The website for cland: a custom landing page and the documentation, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build). English only.

This folder is a standalone npm project with its own `package-lock.json`. It is not part of the repository's root npm workspaces, so run every command from inside `site/`.

## Run it

```sh
cd site
npm install
npm run dev       # local dev server with hot reload, http://localhost:4321
npm test          # the onboarding claim guard
npm run build     # static build into dist/, after the claim guard
npm run preview   # serve the built dist/ locally
```

`npm test` checks that no site or docs page says the Aide commits at the project root without naming the generated `workspace-write` limit and the Coordinator. `npm run build` runs it first through `prebuild`, so a stale claim fails the build.

## Where things live

| Path | What |
| --- | --- |
| `src/pages/index.astro` | The landing page at `/`, a plain Astro page (not Starlight). Its section styles and the small script for the tab groups and the copy button are in the same file. |
| `src/layouts/SiteLayout.astro` | The frame shared by the landing and the build log: head tags (title, description, canonical, Open Graph, Twitter, the RSS link), the brand fonts, the header and the footer. |
| `src/components/SiteHeader.astro`, `SiteFooter.astro` | The nav bar and the footer. On the landing the section links are in-page anchors; elsewhere they point back to `/`. |
| `src/styles/site.css` | The brand tokens (colours, fonts) and base styles for the landing and the build log. |
| `src/site.ts` | Shared constants: the site URL, GitHub link, tagline, the wordmark path and date formatting. |
| `src/content/log/*.mdx` | The build log posts, served at `/log/<file name>/`. |
| `src/pages/log/` | The build log: the list at `/log/`, one page per post, and the RSS feed at `/log/rss.xml`. |
| `src/components/PostCard.astro` | A post as a card, on `/log/` and in the landing's "From the build log" section (the three latest posts). |
| `src/components/BarChart.astro`, `Stats.astro` | Charts and headline numbers for posts, in plain HTML and CSS. |
| `src/log.ts` | `getPosts()` (newest first) and the post URLs. |
| `src/content/docs/docs/*.md` | The documentation, served by Starlight under `/docs/`. `docs/index.md` is the Introduction at `/docs/`. |
| `src/content.config.ts` | The content collections: Starlight's `docs` and the build log's `log`. |
| `src/components/Screenshot.astro`, `src/screens.ts` | Screenshots by number, on the landing and in the docs (`.mdx`). A screenshot whose file is in `src/assets/screens/` shows as an image; otherwise it shows a placeholder with its number, target size and description. [SCREENSHOTS.md](SCREENSHOTS.md) lists the images and the sealed web/phone capture procedure. |
| `src/plugins/mermaid.mjs` | Renders ```` ```mermaid ```` blocks in the docs to inline SVG at build time with `beautiful-mermaid`: no browser in CI, no script in the page. The colours are the `--cland-diagram-*` properties in `starlight.css`, so diagrams follow the dark and light theme. |
| `src/components/starlight/SocialIcons.astro` | A Starlight override that adds the "Log" link beside the GitHub icon in the docs header. |
| `astro.config.mjs` | Site URL, Starlight options and the sidebar. The sidebar lists only the docs pages that exist. |
| `src/styles/starlight.css` | The brand theme for the docs: colours for dark and light mode, JetBrains Mono for headings and navigation, IBM Plex Sans for body text. |
| `src/assets/` | The wordmark SVGs (transparent, dark and light) and the landing screenshots, optimised at build time. |
| `public/` | Favicons, the Open Graph image `og.png` and `CNAME`. |

Brand sources (colours, logo, social images) are in `docs/brand/` at the repository root. Fonts are self-hosted through `@fontsource`; the site makes no requests to Google Fonts.

There is no `src/content/docs/index.md` on purpose: Starlight must not claim `/`, which belongs to the landing page.

## Screenshots and diagrams

- **Screenshots.** [SCREENSHOTS.md](SCREENSHOTS.md) lists every screenshot the site uses: its number, file name, size, pages and what it must show. Save a file under its listed name in `src/assets/screens/` and rebuild; the placeholder becomes the image everywhere. In a docs page (rename it to `.mdx` first), add one with:

  ```mdx
  import Screenshot from '../../../components/Screenshot.astro';

  <Screenshot n={5} />
  ```

  A new screenshot gets its entry in `src/screens.ts` and in SCREENSHOTS.md.
- **Diagrams.** Write a flow, a lifecycle or an architecture as a ```` ```mermaid ```` block, not as box-drawing characters. Flowcharts and state diagrams work; prefer top-down layouts (`flowchart TB`) so they stay readable on a phone, where a wide diagram scrolls inside its box. The first `%%` comment line is the diagram's accessible description. `classDef x stroke:var(--cland-diagram-accent)` marks a node in the brand's amber.

## Add a build log post

The build log is where cland's own crew reports on building cland: what each release took, what it cost, what broke and what changed. Posts are in English.

1. Create `src/content/log/<slug>.mdx`. The file name is the URL: `/log/<slug>/`.
2. Start it with the frontmatter. `title` states the finding; `description` is one or two sentences and is also the social card and RSS text.

   ```mdx
   ---
   title: 'v0.1.4: what we found, in one line'
   description: 'One or two sentences.'
   date: 2026-10-20
   release: v0.1.4        # optional, shown as a badge
   tags: [retrospective]  # optional, used as RSS categories
   ---
   ```

3. Write the body in Markdown: `##` and `###` headings, tables, code, blockquotes. For charts and headline numbers, import the components (MDX is enabled by Starlight):

   ```mdx
   import BarChart from '../../components/BarChart.astro';
   import Stats from '../../components/Stats.astro';

   <Stats items={[{ value: '93', label: 'tasks landed', was: 'v0.1.2: 94' }]} />

   <BarChart
     title="Merges per hour"
     legend={[{ name: 'v0.1.2', color: 'muted' }, { name: 'v0.1.3', color: 'amber' }]}
     rows={[{ label: 'Merges per hour', bars: [{ value: 1.2, text: '1.2', color: 'muted' }, { value: 2.9, text: '2.9' }] }]}
     caption="What the chart shows and where the numbers come from."
   />
   ```

   Colours are `amber`, `teal`, `green`, `blue`, `violet`, `pink`, `red` and `muted`. `perRow` scales each row on its own, for pairs in different units.
4. Run `npm run build`. The post appears on `/log/`, in the RSS feed and, if it is among the three newest, on the landing. Posts of the same date sort by file name, last first.

Before publishing, strip internal references: tracker and artifact ids, decision numbers, session names, people's names, e-mail and IP addresses and local paths. Every number must come from a source report.

## Deployment

The site deploys to GitHub Pages with the custom domain `cland.app` (`public/CNAME`, and `site: 'https://cland.app'` in `astro.config.mjs`). The workflow `.github/workflows/pages.yml` builds `site/` and deploys it on a push to `main` (every release) or to the `site` branch (site changes between releases). The repository's Pages source is GitHub Actions, and its custom domain is set in the repository settings: a `CNAME` file alone does not set it for an Actions deployment.
