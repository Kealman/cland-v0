/** Discord's supported Markdown subset. Native code blocks remain literal. */
export function discordMarkdown(text: string): string {
  const lines = text.split('\n'), out: string[] = [];
  let fence: string | undefined;
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1]![0] === fence[0] && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
      out.push(line); continue;
    }
    if (fence) { out.push(line); continue; }
    if (line.includes('|') && lines[i + 1]?.includes('|') && cells(lines[i + 1]!).every(cell => /^:?-{3,}:?$/.test(cell))) {
      const rows = [cells(line)]; i++;
      while (lines[i + 1]?.includes('|') && lines[i + 1]!.trim()) rows.push(cells(lines[++i]!));
      const widths = rows[0]!.map((_, col) => Math.max(...rows.map(row => Array.from(row[col] ?? '').length)));
      out.push('```', ...rows.map(row => widths.map((width, col) => {
        const cell = row[col] ?? ''; return cell + ' '.repeat(width - Array.from(cell).length);
      }).join(' | ').trimEnd()), '```');
    } else out.push(line.replace(/^\s*#{4,6}\s+(.+?)\s*#*$/, '**$1**')
      .replace(/^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/, '──────────')
      .replace(/^(\s*(?:[-+*]|\d+\.)\s+)\[([ xX])\]/, (_, prefix: string, checked: string) => `${prefix}${checked === ' ' ? '☐' : '☑'}`)
      .replace(/\|\|/g, '\\|\\|'));
  }
  if (fence) throw new Error('Unclosed Markdown fence');
  return out.join('\n');
}

const size = (text: string) => Array.from(text).length;

/** Reserve the final numbering and fence suffix before choosing each cut. */
function split(header: string, text: string, total: number, fences = true): string[] {
  const parts: string[] = [];
  let fence: { marker: string; opener: string } | undefined;
  let body = '';
  const prefix = () => `${header}${total > 1 ? ` ${parts.length + 1}/${total}` : ''}\n`;
  const suffix = () => fence ? `${body.endsWith('\n') ? '' : '\n'}${fence.marker}` : '';
  const flush = () => {
    parts.push(prefix() + body + suffix());
    body = fence ? `${fence.opener}\n` : '';
  };
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const [index, line] of lines.entries()) {
    // Keep a paragraph together when it fits on a fresh part.
    if (!fence && body && index > 0 && lines[index - 1] === '\n' && line !== '\n') {
      let block = '';
      for (let end = index; end < lines.length && lines[end] !== '\n'; end++) block += lines[end];
      if (size(prefix() + block) <= 2000 && size(prefix() + body + block) > 2000) flush();
    }
    const marker = fences && /^ {0,3}(`{3,}|~{3,})([^\n]*)/.exec(line);
    if (marker) {
      const closes = fence && marker[1]![0] === fence.marker[0] && marker[1]!.length >= fence.marker.length && !marker[2]!.trim();
      const next = closes ? undefined : fence ?? { marker: marker[1]!, opener: line.trimEnd() };
      const reserve = next ? size(next.marker) + 1 : 0;
      if (size(prefix() + body + line) + reserve > 2000) flush();
      if (size(prefix() + body + line) + reserve > 2000) throw new Error('Oversized fence');
      body += line; fence = next; continue;
    }
    let rest = Array.from(line);
    if (size(prefix() + body + line + suffix()) > 2000 && body && !fence) flush();
    while (rest.length) {
      const room = 2000 - size(prefix() + body) - (fence ? size(fence.marker) + 1 : 0);
      if (room <= 0) throw new Error('Oversized header');
      body += rest.slice(0, room).join(''); rest = rest.slice(room);
      if (rest.length) flush();
    }
  }
  if (body || !parts.length) parts.push(prefix() + body + suffix());
  return parts;
}

export function renderDiscord(header: string, text: string): string[] {
  const render = (value: string, fences: boolean) => {
    let total = 1;
    for (;;) {
      const parts = split(header, value, total, fences);
      if (parts.length === total) return parts;
      total = parts.length;
    }
  };
  try { return render(discordMarkdown(text), true); }
  catch { return render(text, false); }
}
