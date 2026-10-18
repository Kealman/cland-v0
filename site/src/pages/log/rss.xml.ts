import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, postHref } from '../../log';
import { SITE } from '../../site';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: 'cland build log',
    description: 'How cland is built by its own crew: what each release took, what it cost, what broke and what we changed.',
    site: context.site ?? SITE,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postHref(post),
      categories: post.data.tags,
    })),
    customData: '<language>en</language>',
  });
}
