/** Signed CDN URLs never use the bot credential or follow a redirect. */
export async function discordCdn(url: string, limit: number, signal: AbortSignal, fakeRoot?: string): Promise<Buffer> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), 35_000);
  try {
    const target = new URL(url);
    const fake = fakeRoot ? new URL(fakeRoot) : undefined;
    const allowed = target.protocol === 'https:' && ['cdn.discordapp.com', 'media.discordapp.net'].includes(target.hostname) && !target.port;
    const loopback = fake && ['127.0.0.1', '[::1]'].includes(fake.hostname) && fake.protocol === 'http:'
      && target.origin === fake.origin && target.pathname.startsWith(`${fake.pathname.replace(/\/$/, '')}/cdn/`);
    if ((!allowed && !loopback) || target.username || target.password || target.hash) throw new Error();
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.any([signal, deadline.signal]) });
    if (!response.ok) { await response.body?.cancel(); throw new CdnError(response.status); }
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of response.body!) {
      size += chunk.length;
      if (size > limit) { throw new CdnError(413); }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof CdnError) throw error;
    throw new CdnError(0);
  } finally { clearTimeout(timer); }
}
export class CdnError extends Error {
  readonly status: number;
  constructor(status: number) { super('Discord attachment download failed'); this.status = status; }
}
