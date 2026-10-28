/** Keep legacy sources readable; messenger names have their public capitalization. */
export function remoteSource(via: unknown): string | undefined {
  return via === 'telegram' ? 'via Telegram' : via === 'discord' ? 'via Discord' : undefined;
}
export function sourceLabel(via: string): string {
  return remoteSource(via) ?? via;
}

const recording = (artifact: import('../../shared/wire/index.ts').Artifact) =>
  /\.(?:ogg|oga|opus|mp3|m4a|wav|flac|aac|webm)$/i.test(artifact.path) || /^(?:video-note-\d+\.mp4|audio-\d+\.bin)$/i.test(artifact.title);

/** Voice uses the existing persisted transcript prefix and attached recording. */
export function voicePresentation(message: import('../../shared/wire/index.ts').TopicMessage): { mark?: string; body: string } {
  const body = message.text;
  if (message.fromKind !== 'human' || !remoteSource(message.via) || !body.startsWith('🎤 ') || ![...(message.artifact ? [message.artifact] : []), ...message.artifacts ?? []].some(recording)) return { body };
  const transcript = body.slice('🎤 '.length);
  if (transcript === 'nothing recognised') return { mark: '🎤 nothing recognised', body: '' };
  if (transcript === 'not transcribed' || transcript.startsWith('not transcribed: ')) return { mark: '🎤 not transcribed', body: transcript.slice('not transcribed'.length).replace(/^: /, '') };
  return { mark: '🎤', body: transcript };
}
