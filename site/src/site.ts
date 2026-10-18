// Constants shared by the landing, the build log and the RSS feed.

export const SITE = 'https://cland.app';
export const GITHUB = 'https://github.com/Kealman/cland-v0';
export const DOCS = '/docs/';
export const TAGLINE = 'One coding crew across every AI plan you pay for.';

/** The wordmark's strokes on its 296×84 grid (the c, l, n and d stems). */
export const wordmarkPath = 'M40.62 37.98A22 22 0 1 0 40.62 74.02M74 6V78M146 34V78M174 78V56A22 22 0 0 1 218 56V78M290 6V78';

/** Build-log dates are calendar days; format them in UTC so the day never shifts. */
export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
