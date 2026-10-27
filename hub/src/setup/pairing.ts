import type { RemoteVia } from '../protocol.ts';
import type { SetupHub } from './hub.ts';
import type { SetupLine } from './types.ts';
import type { Prompter } from './prompter.ts';

/** Pairing questions are shared by messengers; the caller supplies the platform's gesture. */
export async function pairRemote(input: {
  messenger: RemoteVia; name: string; detail: string; link: string; gesture: string;
  client: SetupHub; prompter: Prompter;
}): Promise<SetupLine> {
  const { messenger, name, detail, link, gesture, client, prompter } = input;
  const fix = `cland remote approve ${messenger} <code>`;
  const open: SetupLine = { name, verdict: 'open', detail: `${detail}; open ${link} and ${gesture}`, fix };
  if (!client.pairings || !client.approve) return open;
  const pause = () => prompter.pause(`Open ${link}; ${gesture}, then Enter`);
  const waiting = async () => (await client.pairings!()).filter(row => row.messenger === messenger);
  await pause();
  let rows = await waiting();
  if (!rows.length && await prompter.confirm('No waiting code. Wait once more?', false)) {
    await pause();
    rows = await waiting();
  }
  if (!rows.length) return open;
  const selection = rows.length === 1 ? rows[0]!.code : await prompter.choose('Which pairing code?', rows.map(row => ({ value: row.code, label: row.text })), rows[0]!.code);
  const selected = rows.find(row => row.code === selection)!;
  if (!await prompter.confirm(selected.text, false)) return { ...open, fix: selected.command };
  const pairing = await client.approve(messenger, selected.code);
  return { name, verdict: 'done', detail: `${detail}; paired ${pairing.name} (${pairing.userId})` };
}
