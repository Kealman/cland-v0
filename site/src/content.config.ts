import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // The build log: one Markdown or MDX file per post in src/content/log/, served at /log/<slug>/.
  log: defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/log' }),
    schema: z.object({
      title: z.string(),
      /** One or two sentences: the list, the landing cards, RSS and social cards. */
      description: z.string(),
      date: z.coerce.date(),
      /** The release the post is about, e.g. "v0.1.3". */
      release: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
};
