import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'log'>;

/** All build-log posts, newest first; posts of one day keep a stable order by id. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('log');
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || b.id.localeCompare(a.id));
}

export const postHref = (post: Post) => `/log/${post.id}/`;
