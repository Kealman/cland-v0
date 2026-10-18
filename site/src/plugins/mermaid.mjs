// @ts-check
// Mermaid diagrams for the docs, rendered to inline SVG at build time.
//
// A ```mermaid code block in a docs page becomes an SVG drawn by beautiful-mermaid,
// a pure TypeScript renderer: no browser at build time, no script in the page.
// The SVG's colours are CSS custom properties (--cland-diagram-*), set for the dark
// and the light theme in src/styles/starlight.css, so a diagram follows Starlight's
// theme switch with no re-render.
//
// The first `%%` comment line of a diagram is its accessible description.
import { renderMermaidSVG } from 'beautiful-mermaid';

const COLORS = {
  bg: 'var(--cland-diagram-bg)',
  fg: 'var(--cland-diagram-fg)',
  line: 'var(--cland-diagram-line)',
  accent: 'var(--cland-diagram-accent)',
  muted: 'var(--cland-diagram-muted)',
  surface: 'var(--cland-diagram-surface)',
  border: 'var(--cland-diagram-border)',
};

/** @param {string} text */
const escapeAttr = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/**
 * Renders one diagram to the figure the page shows.
 * @param {string} code
 * @param {{ padding?: number, nodeSpacing?: number, layerSpacing?: number }} [layout] tighter spacing for small frames
 */
export function renderDiagram(code, layout = {}) {
  const label = code
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('%%'))
    ?.replace(/^%%\s*/, '');
  let svg = renderMermaidSVG(code, { ...COLORS, font: 'IBM Plex Sans', padding: 24, transparent: true, ...layout });
  // The renderer imports its font from Google Fonts; the site self-hosts its fonts.
  svg = svg.replace(/@import url\([^)]*\);?/g, '');
  const width = Number(/viewBox="[\d.]+ [\d.]+ ([\d.]+) /.exec(svg)?.[1] ?? 0);
  svg = svg.replace(
    '<svg ',
    `<svg role="img"${label ? ` aria-label="${escapeAttr(label)}"` : ''} focusable="false" `,
  );
  // One line: a blank line would end the HTML block in Markdown.
  svg = svg.replace(/\n\s*/g, ' ');
  return `<figure class="cland-diagram not-content" style="--diagram-width: ${Math.ceil(width)}"><div class="cland-diagram-scroll" tabindex="0" role="group" aria-label="${escapeAttr(label ?? 'Diagram')}, scrolls sideways">${svg}</div></figure>`;
}

/** The Sätteri mdast plugin: replaces each mermaid code block with its SVG. */
const satteriMermaid = {
  name: 'cland-mermaid',
  /** @param {{ lang?: string | null, value: string }} node */
  code(node) {
    if (node.lang !== 'mermaid') return;
    return { type: 'html', value: renderDiagram(node.value) };
  },
};

/**
 * The Astro integration. Astro 7 renders Markdown and MDX with Sätteri; the plugin
 * joins the processor's mdast plugins, before Expressive Code sees any code block.
 * @returns {import('astro').AstroIntegration}
 */
export default function clandMermaid() {
  return {
    name: 'cland-mermaid',
    hooks: {
      'astro:config:setup': ({ config, logger }) => {
        const processor = /** @type {any} */ (config.markdown)?.processor;
        if (processor?.name === 'satteri' && Array.isArray(processor.options?.mdastPlugins)) {
          processor.options.mdastPlugins.unshift(satteriMermaid);
        } else {
          throw new Error(
            `cland-mermaid: expected Astro's Sätteri markdown processor, found "${processor?.name ?? 'none'}"`,
          );
        }
        logger.debug('mermaid diagrams render at build time');
      },
    },
  };
}
