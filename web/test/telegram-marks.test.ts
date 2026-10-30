import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramMarks } from '../../hub/test/telegram-marks-fixture.ts';
import { webFixture } from './harness.ts';

test('native Telegram voice marks, audio, text and approval outcome render in Chromium', async t => {
  const native = await telegramMarks(t);
  const f = await webFixture(t, native);
  const { messages, approval } = await native.exercise(f.hub);
  await f.pageCase(t, async page => {
    await page.locator('[data-inbox-archive-toggle]').click();
    const outcome = page.locator(`[data-inbox-archive-id="${approval}"]`);
    await outcome.getByText(/via Telegram/).waitFor();
    assert.match(await outcome.innerText(), /once.*via Telegram/is);
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    for (const message of messages.filter(m => m.fromKind === 'human')) {
      const row = page.locator(`[data-message-id="${message.id}"]`);
      await row.getByText('via Telegram', { exact: true }).waitFor();
      if (message.artifacts?.length === 2) {
        assert.equal(await row.locator('[data-voice-mark]').count(), 0, 'album headings stay in the body');
        assert.equal(await row.locator('[data-message-body]').innerText(), '🎤 not transcribed: track-1.mp3\nAlbum first transcript\n\n🎤 track-2.mp3: transcription failed (quota)');
        assert.match(await row.innerText(), /track-2\.mp3/);
      } else if (message.artifacts?.some(a => a.title === 'not transcribed: survivor.mp3')) {
        assert.equal(await row.locator('[data-voice-mark]').count(), 0);
        assert.equal(await row.locator('[data-message-body]').innerText(), '🎤 not transcribed: survivor.mp3\nSurviving transcript');
      } else if (message.artifacts?.some(a => a.title.startsWith('voice-'))) {
        const mark = message.text.includes('not transcribed') ? '🎤 not transcribed' : message.text.includes('nothing recognised') ? '🎤 nothing recognised' : '🎤';
        await row.locator('header [data-voice-mark]').waitFor({ timeout: 1000 });
        assert.equal(await row.locator('[data-voice-mark]').innerText(), mark);
        assert.doesNotMatch(await row.locator('[data-message-body]').innerText(), /🎤|nothing recognised|not transcribed/);
        assert.match(await row.innerText(), /voice-\d+\.ogg/);
      } else {
        assert.equal(await row.locator('[data-voice-mark]').count(), 0);
        assert.equal(await row.locator('[data-message-body]').innerText(), message.text);
      }
    }
  });
});
